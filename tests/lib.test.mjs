import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../skills/slign/scripts/chrome.mjs';
import { styleFor } from '../skills/slign/scripts/lib.mjs';

const LIB = fileURLToPath(new URL('../skills/slign/scripts/lib.mjs', import.meta.url));
const EXAMPLES = fileURLToPath(new URL('../skills/slign/examples/', import.meta.url));

// A directory with a space in its name, so any unquoted path breaks loudly.
const sandbox = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'slign lib test-'));
  const lib = (...args) => spawnSync(process.execPath, [LIB, ...args], { cwd, encoding: 'utf8' });
  const read = (f) => readFileSync(join(cwd, f), 'utf8');
  const index = () => JSON.parse(read('slign/index.json'));
  const write = (f, text) => writeFileSync(join(cwd, f), text);
  const iconFile = (name) => {
    write(`${name}.mjs`, `export const name = '${name}';
export const label = '${name} icon';
export const style = 'icon';
export const draw = (pen) => pen.group('g', pen.line([[4, 12], [20, 12]]));
export const css = 'ACTIVE .sl-g{animation:slign-${name}-a .4s}@keyframes slign-${name}-a{50%{transform:scale(1.1)}}';
`);
    return `${name}.mjs`;
  };
  return { cwd, lib, read, index, write, iconFile, done: () => rmSync(cwd, { recursive: true, force: true }) };
};

const profile = (extra) => ({ theme: 'light', paper: '#fff', ink: '#111', accent: '#06f', gradient: null, type: { head: 'sans', body: 'sans' }, ...extra });

test('styleFor: dark with a gradient is hairline, light with serif heads is engrave, else ink', () => {
  assert.equal(styleFor(profile({ theme: 'dark', gradient: ['#4f46e5', '#06b6d4'] })), 'hairline');
  assert.equal(styleFor(profile({ type: { head: 'serif', body: 'serif' } })), 'engrave');
  assert.equal(styleFor(profile()), 'ink');
  assert.equal(styleFor(profile({ theme: 'dark' })), 'ink');
  assert.equal(styleFor(profile({ gradient: ['#000', '#fff'] })), 'ink');
  assert.equal(styleFor(profile({ theme: 'dark', type: { head: 'serif', body: 'serif' } })), 'ink');
});

test('init writes the config, an empty index and a short readme, and refuses a second run', (t) => {
  const s = sandbox();
  t.after(s.done);
  const r = s.lib('init');
  assert.equal(r.status, 0, r.stderr);
  const config = JSON.parse(s.read('slign/slign.config.json'));
  assert.equal(config.style, 'ink');
  assert.deepEqual(config.formats, ['svg', 'jsx']);
  assert.deepEqual(config.budget, { icon: 1536, illustration: 12288, component: 12288 });
  assert.ok(config.version && config.palette && 'stroke' in config);
  assert.deepEqual(s.index(), { version: 1, items: [] });
  assert.ok(s.read('slign/README.md').trim().split('\n').length <= 6);

  const again = s.lib('init');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /^error {4}.*--force/);
  assert.equal(s.lib('init', '--force').status, 0);
  assert.equal(s.lib('init', '--dir', 'other lib', '--format', 'swift').status, 0);
  assert.deepEqual(JSON.parse(s.read('other lib/slign.config.json')).formats, ['svg', 'swift']);
});

test('init --url reads the page and picks the style', { skip: !findChrome() && 'Chrome not found' }, (t) => {
  const s = sandbox();
  t.after(s.done);
  s.write('page.html', '<!doctype html><meta charset=utf-8><style>body{margin:0;background:#0a0a0f;color:#e8e8f0;font:18px Helvetica,sans-serif}h1{font-family:Helvetica,sans-serif;font-size:64px;margin:40px;background:linear-gradient(90deg,#4f46e5,#06b6d4);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}</style><h1>Ship faster</h1>');
  const r = s.lib('init', '--url', 'page.html');
  assert.equal(r.status, 0, r.stderr);
  const config = JSON.parse(s.read('slign/slign.config.json'));
  assert.equal(config.style, 'hairline');
  assert.deepEqual(config.palette.stops, ['#4f46e5', '#06b6d4']);
  assert.equal(config.palette.paper, '#0a0a0f');
});

test('add writes the svg, jsx, source and index, sorted, and rejects duplicates', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  for (const n of ['zoom', 'alpha']) assert.equal(s.lib('add', s.iconFile(n)).status, 0);
  const bell = s.lib('add', join(EXAMPLES, 'bell.mjs'));
  assert.equal(bell.status, 0, bell.stderr);

  assert.ok(s.read('slign/icons/zoom.svg').startsWith('<svg') && s.read('slign/icons/zoom.svg').endsWith('\n'));
  assert.match(s.read('slign/icons/zoom.jsx'), /export default function Zoom/);
  assert.ok(existsSync(join(s.cwd, 'slign/src/zoom.mjs')) && existsSync(join(s.cwd, 'slign/illustrations/bell.svg')));
  const items = s.index().items;
  assert.deepEqual(items.map((i) => [i.kind, i.name]), [['icon', 'alpha'], ['icon', 'zoom'], ['illustration', 'bell']]);
  const alpha = items[0];
  assert.equal(alpha.style, 'icon');
  assert.equal(alpha.file, 'icons/alpha.svg');
  assert.equal(alpha.bytes, Buffer.byteLength(s.read('slign/icons/alpha.svg').trimEnd()));
  assert.ok(alpha.gzip > 0 && /^\d{4}-\d\d-\d\d$/.test(alpha.added));

  const dup = s.lib('add', 'alpha.mjs');
  assert.equal(dup.status, 1);
  assert.match(dup.stderr, /^error {4}alpha.*--force/);
  assert.equal(s.index().items.length, 3);
  assert.equal(s.lib('add', 'alpha.mjs', '--force').status, 0);
  assert.equal(s.index().items.length, 3);
});

test('add fills style and palette from the config but the object wins', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  const config = JSON.parse(s.read('slign/slign.config.json'));
  Object.assign(config, { style: 'hairline', palette: { ...config.palette, stops: ['#111111', '#eeeeee'] } });
  s.write('slign/slign.config.json', JSON.stringify(config));
  s.write('wire.mjs', `export const name='wire';export const label='Wire';
export const draw=(pen)=>pen.line([[0,0,0],[30,0,0],[30,30,0]]);`);
  assert.equal(s.lib('add', 'wire.mjs').status, 0);
  assert.ok(s.read('slign/illustrations/wire.svg').includes('<linearGradient id="slign-wire-g"'));
  assert.equal(s.index().items[0].style, 'hairline');
  assert.equal(s.lib('add', s.iconFile('own')).status, 0);
  assert.equal(s.index().items.find((i) => i.name === 'own').style, 'icon');
});

test('add stops on a broken or over-budget object and writes nothing', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  s.write('Bad.mjs', "export const name='Bad';export const label='x';export const style='icon';export const draw=()=>'';");
  const bad = s.lib('add', 'Bad.mjs');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^error {4}name:/m);

  const config = JSON.parse(s.read('slign/slign.config.json'));
  config.budget.icon = 100;
  s.write('slign/slign.config.json', JSON.stringify(config));
  const big = s.lib('add', s.iconFile('big'));
  assert.equal(big.status, 1);
  assert.match(big.stderr, /^error {4}big.*\d+ bytes.*100/m);
  assert.equal(s.lib('add', 'missing.mjs').status, 1);
  assert.deepEqual(s.index().items, []);
  assert.ok(!existsSync(join(s.cwd, 'slign/icons')) && !existsSync(join(s.cwd, 'slign/src/big.mjs')));
});

test('commands need a library and a known command', (t) => {
  const s = sandbox();
  t.after(s.done);
  const r = s.lib('list');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^error {4}.*init/);
  assert.equal(s.lib('nope').status, 1);
});

test('list prints a table, and --json the index items', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  s.lib('add', s.iconFile('beta'));
  s.lib('add', s.iconFile('alpha'));
  const table = s.lib('list').stdout.trim().split('\n');
  assert.match(table[0], /^name\s+kind\s+style\s+bytes$/);
  assert.match(table[1], /^alpha\s+icon\s+icon\s+\d+$/);
  assert.match(table[2], /^beta\s/);
  const json = JSON.parse(s.lib('list', '--json').stdout);
  assert.deepEqual(json.map((i) => i.name), ['alpha', 'beta']);
});

test('place puts the stored svg at its marker and tells which marker is missing', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  s.lib('add', s.iconFile('alpha'));
  s.write('page.html', '<p><!-- slign:alpha --></p>');
  const r = s.lib('place', 'alpha', '--into', 'page.html');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(s.read('page.html').includes(s.read('slign/icons/alpha.svg').trimEnd()));
  s.write('empty.html', '<p></p>');
  const miss = s.lib('place', 'alpha', '--into', 'empty.html');
  assert.equal(miss.status, 1);
  assert.match(miss.stderr, /^error {4}.*<!-- slign:alpha -->/);
  assert.match(s.lib('place', 'ghost', '--into', 'page.html').stderr, /^error {4}ghost/);
});

test('build regenerates from src and reports drift', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init');
  s.lib('add', s.iconFile('alpha'));
  const clean = s.lib('build');
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(clean.stdout.trim(), 'ok');

  const before = s.read('slign/icons/alpha.svg');
  s.write('slign/icons/alpha.svg', '<svg/>\n');
  const drift = s.lib('build');
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /icons\/alpha\.svg/);
  assert.equal(s.read('slign/icons/alpha.svg'), before);
  assert.equal(s.lib('build').stdout.trim(), 'ok');

  const config = JSON.parse(s.read('slign/slign.config.json'));
  config.formats = ['svg'];
  s.write('slign/slign.config.json', JSON.stringify(config));
  assert.equal(s.lib('build').status, 0);
});

test('index.json and every printed path stay relative to the library', (t) => {
  const s = sandbox();
  t.after(s.done);
  s.lib('init', '--dir', 'my lib');
  const added = s.lib('add', join(s.cwd, s.iconFile('alpha')), '--dir', 'my lib');
  assert.equal(added.status, 0, added.stderr);
  const index = s.read('my lib/index.json');
  assert.ok(!index.includes(s.cwd) && !index.includes('/Users') && !index.includes('..'), index);
  assert.ok(!added.stdout.includes(s.cwd), added.stdout);
  assert.match(added.stdout, /my lib\/icons\/alpha\.svg/);
});
