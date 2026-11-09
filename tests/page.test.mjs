import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findChrome, launch } from '../skills/slign/scripts/chrome.mjs';
import { parseArgs, shoot } from '../skills/slign/scripts/page.mjs';

const PAGE = fileURLToPath(new URL('../skills/slign/scripts/page.mjs', import.meta.url));
const SVG = readFileSync(new URL('../skills/slign/examples/rocket.svg', import.meta.url), 'utf8');

const FIXTURE = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:rgb(240,235,220);color:rgb(20,60,90);font:16px sans-serif}
.spacer{height:1500px}.after{height:2000px}
#hero{width:200px;height:120px;border-radius:12px;background:#ccc}
</style>
<div class="spacer"></div>
<section><h2>Pricing That Scales</h2><p>Simple plans.</p><div id="hero">Stock photo</div></section>
<div class="after"></div>`;

/** Fixture on disk in a directory whose name has a space. */
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'slign page '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const html = join(dir, 'index page.html');
  writeFileSync(html, FIXTURE);
  return { dir, html, out: join(dir, 'out.png') };
}

const chrome = findChrome();
const needChrome = (t) => { if (!chrome) { t.skip('no Chrome'); return false; } return true; };

test('arguments: defaults, and clear errors for bad input', () => {
  const a = parseArgs(['a.html', '--text', 'x', '--out', 'o.png']);
  assert.deepEqual([a.at, a.width, a.height], ['before', 1280, 900]);
  assert.throws(() => parseArgs(['a.html', '--out', 'o.png']), /--text or --target/);
  assert.throws(() => parseArgs(['a.html', '--text', 'x']), /--out/);
  assert.throws(() => parseArgs(['a.html', '--text', 'x', '--out', 'o', '--at', 'under']), /--at/);
  assert.throws(() => parseArgs(['a.html', '--text', 'x', '--out', 'o', '--size-px', '800']), /--size-px/);
  assert.equal(parseArgs(['a.html', '--text', 'x', '--out', 'o', '--size-px', '800x600']).width, 800);
});

test('the CLI fails with one line when nothing is asked', () => {
  const r = spawnSync(process.execPath, [PAGE], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^error {4}/);
});

test('the scroll position is the same with and without the drawing', async (t) => {
  if (!needChrome(t)) return;
  const f = fixture(t);
  const base = { url: f.html, text: 'pricing that', out: f.out };
  const plain = await shoot(base);
  const drawn = await shoot({ ...base, svg: SVG });
  assert.ok(plain.scrollY > 1000, `scrolled to ${plain.scrollY}`);
  assert.equal(drawn.scrollY, plain.scrollY);
  assert.ok(existsSync(f.out));
});

test('the wrapper takes the paper behind the element and the page ink', async (t) => {
  if (!needChrome(t)) return;
  const f = fixture(t);
  const r = await shoot({ url: f.html, text: 'Simple plans', out: f.out, svg: SVG, at: 'after' });
  assert.equal(r.wrapper.paper, 'rgb(240, 235, 220)');
  assert.equal(r.wrapper.color, 'rgb(20, 60, 90)');
  assert.equal(r.wrapper.trigger, true);
  assert.equal(r.wrapper.at, 'after');
});

test('replace keeps the box of the replaced element and only hides it', async (t) => {
  if (!needChrome(t)) return;
  const f = fixture(t);
  const r = await shoot({ url: f.html, target: '#hero', out: f.out, svg: SVG, at: 'replace' });
  assert.deepEqual([r.wrapper.width, r.wrapper.height], [200, 120]);
  assert.equal(r.wrapper.radius, '12px');
  assert.equal(r.replacedDisplay, 'none');
});

test('a missing text is an error and Chrome is gone afterwards', async (t) => {
  if (!needChrome(t)) return;
  const f = fixture(t);
  const profiles = [];
  const launcher = async (o) => { const c = await launch(o); profiles.push(c.profile); return c; };
  await assert.rejects(
    shoot({ url: f.html, text: 'nothing like this', out: f.out }, launcher),
    { message: 'no element contains "nothing like this"' },
  );
  await shoot({ url: f.html, text: 'Pricing', out: f.out }, launcher);
  assert.equal(profiles.length, 2);
  for (const p of profiles) {
    assert.equal(existsSync(p), false, 'profile removed');
    assert.notEqual(spawnSync('pgrep', ['-f', p]).status, 0, 'no process left');
  }
});

test('the CLI prints the error line and exits 1 for a missing text', (t) => {
  if (!needChrome(t)) return;
  const f = fixture(t);
  const r = spawnSync(process.execPath, [PAGE, f.html, '--text', 'zzz', '--out', f.out], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'error    no element contains "zzz"');
});
