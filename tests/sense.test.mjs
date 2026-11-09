import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findChrome, launch } from '../skills/slign/scripts/chrome.mjs';
import { profileOf } from '../skills/slign/scripts/sense.mjs';

const SENSE = fileURLToPath(new URL('../skills/slign/scripts/sense.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'slign-sense-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const LIGHT = `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#f5efe0;color:#2b2118;font:18px Georgia,serif}
h1{font-family:Georgia,serif;font-size:56px;margin:40px}
p{margin:40px;max-width:600px}
a.btn{display:inline-block;margin:40px;padding:12px 24px;background:#1a56db;color:#fff;border-radius:6px;font-family:Georgia,serif}
</style><h1>Slow coffee</h1><p>Beans roasted in small batches and sent on the day they cool.</p><a class=btn href=#>Order now</a>`;

const DARK = `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#0a0a0f;color:#e8e8f0;font:18px Helvetica,Arial,sans-serif}
h1{font-family:Helvetica,Arial,sans-serif;font-size:64px;margin:40px;background:linear-gradient(90deg,#4f46e5,#06b6d4);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
p{margin:40px;max-width:600px}
.badge{display:inline-block;margin:40px;padding:6px 18px;border-radius:999px;background:#7c3aed;color:#fff}
</style><h1>Ship faster</h1><p>Analytics for teams that measure everything twice.</p><span class=badge>New</span>`;

async function sense(html) {
  const file = join(dir, `p${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(file, html);
  const chrome = await launch();
  try {
    await chrome.open(file);
    return await profileOf(chrome);
  } finally {
    await chrome.close();
  }
}

test('the profile tells a light serif page from a dark sans one with a gradient', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const light = await sense(LIGHT);
  const dark = await sense(DARK);
  assert.equal(light.theme, 'light');
  assert.equal(light.paper, '#f5efe0');
  assert.equal(light.type.head, 'serif');
  assert.equal(light.accent, '#1a56db');
  assert.equal(light.gradient, null);
  assert.equal(light.texture, 'flat');
  assert.equal(dark.theme, 'dark');
  assert.equal(dark.paper, '#0a0a0f');
  assert.equal(dark.type.head, 'sans');
  assert.deepEqual(dark.gradient, ['#4f46e5', '#06b6d4']);
  assert.equal(dark.radius, 999);
  for (const p of [light, dark]) assert.ok(JSON.stringify(p).length <= 600);
});

test('the CLI prints one JSON line and a png, and fails clearly on a missing page', (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const file = join(dir, 'cli.html');
  const png = join(dir, 'cli.png');
  writeFileSync(file, LIGHT);
  const ok = spawnSync(process.execPath, [SENSE, file, '--out', png], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).theme, 'light');
  const bad = spawnSync(process.execPath, [SENSE, join(dir, 'missing.html')], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^error {4}/);
});
