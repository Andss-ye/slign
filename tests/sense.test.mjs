import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const page = (body) => `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff;color:#111;font:18px sans-serif}</style>${body}`;

test('only real media or a covering background counts as a photo', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const strip = await sense(page(`<h1>Hi</h1><div style="width:60%;height:60px;background:url(${PIXEL})"></div>`));
  assert.equal(strip.texture, 'flat');
  const img = await sense(page(`<img src="${PIXEL}" style="width:60%;height:200px">`));
  assert.equal(img.texture, 'photo');
  const cover = await sense(page(`<div style="width:60%;height:60px;background:url(${PIXEL}) center/cover"></div>`));
  assert.equal(cover.texture, 'photo');
  const hero = await sense(page(`<div style="width:60%;height:60%;position:absolute;background:url(${PIXEL})"></div>`));
  assert.equal(hero.texture, 'photo');
});

test('accent votes come from exact class tokens, not substrings', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const p = await sense(page(`<style>.tagline{background:#e11d48;color:#fff;padding:8px}.btn{background:#1a56db;color:#fff;padding:8px}</style>
<p>Plain text that is not an accent.</p><div class=tagline>one</div><div class=tagline>two</div><div class=hot-tags>three</div><span class=btn>Go</span>`));
  assert.equal(p.accent, '#1a56db');
});

test('the CLI writes its screenshot to the temp dir unless --out says otherwise', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'slign-sense-cwd-'));
  const shot = join(tmpdir(), 'slign-sense.png');
  t.after(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(shot, { force: true }); });
  if (!findChrome()) return t.skip('no Chrome');
  const file = join(dir, 'default-out.html');
  writeFileSync(file, LIGHT);
  rmSync(shot, { force: true });
  const r = spawnSync(process.execPath, [SENSE, file], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(cwd), []);
  assert.ok(existsSync(shot));
});

test('on a dark page the accent is the bright end of the heading gradient, not a dark button', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const p = await sense(`<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#05070f;color:#e8ecf4;font:18px Helvetica,Arial,sans-serif}
h1{font-size:64px;margin:40px;background:linear-gradient(90deg,#2563eb,#a4f4fd);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
a{color:#e8ecf4;margin:0 20px}
.btn{display:inline-block;margin:40px;padding:12px 24px;background:#0b2551;color:#fff;border-radius:8px}
</style><h1>Ship faster</h1><p><a href=#>Docs</a><a href=#>Blog</a></p><a class=btn href=#>Pricing</a>`);
  assert.equal(p.accent, '#a4f4fd');
  assert.equal(p.ink, '#e8ecf4');
});

test('ink is the heading color and the accent is never the paper', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const p = await sense(`<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#f4efe1;color:#000;font:18px Helvetica,Arial,sans-serif}
nav{background:#26241f;padding:12px}nav a{color:#f4efe1;margin:0 14px}
h1{color:#26241f;font-size:56px;margin:40px}
.btn{display:inline-block;margin:40px;padding:12px 24px;background:#3DB02C;color:#fff;border-radius:6px}
</style><nav><a href=#>Menu</a><a href=#>Shop</a><a href=#>Visit</a><a href=#>About</a></nav><h1>Fresh bread</h1><a class=btn href=#>Order</a>`);
  assert.equal(p.ink, '#26241f');
  assert.equal(p.accent, '#3db02c');
});

test('a body set in Space Mono reads as mono even when a wrapper carries the font', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const p = await sense(page(`<style>h1{font-family:Georgia,serif}</style><h1>Notes</h1><main style="font-family:'Space Mono',monospace"><p>The quick brown fox jumps over the lazy dog, again and again.</p><p>Second paragraph of plain mono text.</p></main>`));
  assert.equal(p.type.body, 'mono');
  assert.equal(p.type.head, 'serif');
});

test('--out without a path fails before Chrome starts', () => {
  for (const args of [['page.html', '--out'], ['--out', '--other', 'page.html']]) {
    const r = spawnSync(process.execPath, [SENSE, ...args], { encoding: 'utf8', env: { ...process.env, CHROME: '/nonexistent' } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^error {4}--out needs a path\n$/);
  }
});
