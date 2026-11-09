import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, render, toJsx, toSwift } from '../skills/slign/scripts/draw.mjs';

const DRAW = fileURLToPath(new URL('../skills/slign/scripts/draw.mjs', import.meta.url));
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

const box = (extra = {}) => ({
  name: 'box',
  label: 'Box',
  draw: (pen) => pen.line([[0, 0, 0], [10, 0, 0], [10, 10, 0]]) + pen.eye([2, 0, 5]) + pen.group('lid', pen.dot([0, 0, 9])),
  css: `ROOT .sl-lid{transition:transform .4s ${SPRING}}ACTIVE .sl-lid{transform:translateY(-4px)}`,
  ...extra,
});

const SOURCE = `export const name = 'box';
export const label = 'Box';
export const draw = (pen) => pen.line([[0, 0, 0], [10, 0, 0]]) + pen.eye([2, 0, 5]);
export const css = 'ACTIVE .sl-l{transform:translateY(-2px)}';
`;

function project(files) {
  const dir = join(mkdtempSync(join(tmpdir(), 'slign ')), 'my objects');
  mkdirSync(dir);
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

test('render gives a self-contained single-ink svg with both passes', () => {
  const svg = render(box());
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" class="slign slign-box"/);
  assert.ok(svg.includes('stroke="currentColor"') && svg.includes('fill="none"'));
  assert.ok(svg.includes('class="sl-a"') && svg.includes('class="sl-b"'));
  assert.ok(svg.includes('prefers-reduced-motion'));
});

test('ROOT and ACTIVE expand to the object scope', () => {
  const svg = render(box());
  assert.ok(!/\bROOT\b|\bACTIVE\b/.test(svg));
  assert.ok(svg.includes('.slign-box .sl-lid{transition'));
  assert.ok(svg.includes(':is(.slign-box:hover,.slign-box.slign-active,[data-slign-trigger]:hover .slign-box,') && svg.includes(' .sl-lid{transform'));
});

test('css can be a function that receives hinge and origin', () => {
  const svg = render(box({ css: ({ hinge, origin }) => `ROOT .sl-lid{transform-origin:${origin([0, 0, 0])}}ACTIVE .sl-lid{transform:${hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: 0 })}}` }));
  assert.match(svg, /transform-origin:[\d.]+px [\d.]+px/);
  assert.ok(svg.includes('transform:matrix(1,0,0,1,0,0)'));
});

const viewBox = (svg) => svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
const coords = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].flatMap(([, d]) => d.replace(/h\.01/g, '').match(/-?\d+(\.\d+)?/g).map(Number));

test('the canvas is cropped to the drawing, with its origin at 0 0', () => {
  const svg = render(box());
  const [x, y, w, h] = viewBox(svg);
  assert.deepEqual([x, y], [0, 0]);
  assert.ok(w < 80 && h < 80, `expected a tight box, got ${w}x${h}`);
  const n = coords(svg);
  for (let i = 0; i < n.length; i += 2) assert.ok(n[i] > 0 && n[i] < w && n[i + 1] > 0 && n[i + 1] < h);
});

test('the hinge origin lands on the drawn point after cropping', () => {
  const svg = render(box({ draw: (pen) => pen.eye([2, 0, 5]) + pen.dot([0, 0, 9]), css: ({ origin }) => `ROOT .sl-x{transform-origin:${origin([0, 0, 9])}}ACTIVE .sl-x{opacity:1}` }));
  const [ox, oy] = svg.match(/transform-origin:([\d.]+)px ([\d.]+)px/).slice(1).map(Number);
  const [dx, dy] = svg.match(/class="sl-dot" d="M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
  assert.ok(Math.abs(ox - dx) < 1.5 && Math.abs(oy - dy) < 1.5);
});

test('size follows the font with --slign-size and never overflows its container', () => {
  const svg = render(box());
  assert.ok(svg.includes('max-width:100%') && svg.includes('height:auto'));
  assert.ok(svg.includes('.slign:not([width]){width:var(--slign-size,8em)}'), 'a width attribute set on the page must still win');
});

test('a card plays the gesture on keyboard focus and on touch', () => {
  const svg = render(box());
  assert.ok(svg.includes('[data-slign-trigger]:focus-within .slign-box'));
  assert.ok(svg.includes('[data-slign-trigger]:active .slign-box'));
});

test('a well-formed object passes with no errors or warnings', () => {
  assert.deepEqual({ ...check(box()), svg: undefined }, { errors: [], warnings: [], svg: undefined });
});

test('missing or malformed exports are errors', () => {
  assert.match(check(box({ name: 'My Box' })).errors[0], /^name:/);
  assert.match(check(box({ label: '' })).errors[0], /^label:/);
  assert.match(check(box({ draw: 'nope' })).errors[0], /^draw:/);
});

test('fills and non-stroke elements are errors', () => {
  assert.ok(check(box({ draw: () => '<path fill="red" d="M0 0h1"/>' })).errors.some((e) => e.startsWith('ink:')));
  assert.ok(check(box({ draw: () => '<text>hi</text>' })).errors.some((e) => e.startsWith('ink:')));
});

test('animating anything but transform and opacity is an error', () => {
  const frames = check(box({ css: 'ACTIVE .sl-lid{animation:slign-box-grow 1s}@keyframes slign-box-grow{to{width:10px}}' }));
  assert.ok(frames.errors.some((e) => e.startsWith('motion:') && e.includes('width')));
  const transition = check(box({ css: 'ROOT .sl-lid{transition:stroke-width .2s}ACTIVE .sl-lid{transform:scale(1.1)}' }));
  assert.ok(transition.errors.some((e) => e.startsWith('motion:') && e.includes('stroke-width')));
});

test('a spring transition with commas inside cubic-bezier is accepted', () => {
  assert.deepEqual(check(box({ css: `ROOT .sl-lid{transition:transform .4s ${SPRING},opacity .2s}ACTIVE .sl-lid{opacity:.5}` })).errors, []);
});

test('unscoped selectors and unprefixed keyframes are errors', () => {
  assert.ok(check(box({ css: '.sl-lid{opacity:.5}ACTIVE .sl-lid{opacity:1}' })).errors.some((e) => e.startsWith('scope:')));
  assert.ok(check(box({ css: 'ACTIVE .sl-lid{animation:pop 1s}@keyframes pop{to{opacity:0}}' })).errors.some((e) => e.startsWith('scope:') && e.includes('slign-box-')));
});

test('no face, no gesture and oversize are warnings', () => {
  assert.ok(check(box({ draw: (pen) => pen.dot([0, 0, 0]) })).warnings.some((w) => w.startsWith('face:')));
  assert.ok(check(box({ css: '' })).warnings.some((w) => w.startsWith('gesture:')));
  const big = check(box({ draw: (pen) => pen.eye([0, 0, 0]) + Array.from({ length: 400 }, (_, i) => pen.dot([i % 20, 0, 0])).join('') }));
  assert.ok(big.warnings.some((w) => w.startsWith('size:')));
  assert.deepEqual(big.errors, []);
});

test('the CLI writes <name>.svg next to the object, from any cwd and with spaces in the path', () => {
  const dir = project({ 'box.mjs': SOURCE });
  const run = spawnSync('node', [DRAW, join(dir, 'box.mjs')], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(readFileSync(join(dir, 'box.svg'), 'utf8').startsWith('<svg'));
  assert.match(run.stdout, /box\.svg\s+\d+\.\d KB/);
});

test('the CLI honours an explicit output path', () => {
  const dir = project({ 'box.mjs': SOURCE });
  const run = spawnSync('node', [DRAW, 'box.mjs', 'out.svg'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(existsSync(join(dir, 'out.svg')));
});

test('the CLI fails clearly and writes nothing for a broken object', () => {
  const dir = project({ 'broken.mjs': 'export const name = ;', 'empty.mjs': 'export const name = "empty";' });
  const broken = spawnSync('node', [DRAW, 'broken.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /could not load broken\.mjs/);
  const empty = spawnSync('node', [DRAW, 'empty.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /label:/);
  assert.ok(!existsSync(join(dir, 'empty.svg')));
});

test('toJsx makes a component that keeps the slign classes', () => {
  const jsx = toJsx(render(box({ name: 'coffee-mug' })), 'coffee-mug');
  assert.ok(jsx.startsWith('export default function CoffeeMug({ className = \'\', ...props }) {'));
  assert.ok(jsx.includes('className={`slign slign-coffee-mug ${className}`}') && jsx.includes('{...props}'));
  assert.ok(!/\sclass=|stroke-linecap=|stroke-linejoin=|xmlns=/.test(jsx));
  assert.ok(jsx.includes('strokeLinecap="round"') && jsx.includes('<style>{`.slign{') && jsx.includes('`}</style>'));
});

test('the CLI writes a .jsx component next to the svg when asked', () => {
  const dir = project({ 'box.mjs': SOURCE });
  const run = spawnSync('node', [DRAW, 'box.mjs', '--jsx'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(readFileSync(join(dir, 'box.jsx'), 'utf8'), /^export default function Box\(/);
});

test('--into puts the svg where the marker is, and replaces it in place on a redraw', () => {
  const dir = project({ 'box.mjs': SOURCE, 'page.html': '<main>\n  <!-- slign:box -->\n  <h2>Empty</h2>\n</main>\n' });
  const first = spawnSync('node', [DRAW, 'box.mjs', '--into', 'page.html'], { cwd: dir, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const page = readFileSync(join(dir, 'page.html'), 'utf8');
  assert.match(page, /^<main>\n {2}<svg [^>]*class="slign slign-box"[\s\S]*<\/svg>\n {2}<h2>Empty<\/h2>/);
  assert.ok(!page.includes('slign:box') && !existsSync(join(dir, 'box.svg')));
  const again = spawnSync('node', [DRAW, 'box.mjs', '--into', 'page.html'], { cwd: dir, encoding: 'utf8' });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(join(dir, 'page.html'), 'utf8'), page);
});

test('--into fails clearly when the page has no marker and no drawing to replace', () => {
  const dir = project({ 'box.mjs': SOURCE, 'page.html': '<main></main>\n' });
  const run = spawnSync('node', [DRAW, 'box.mjs', '--into', 'page.html'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /<!-- slign:box -->/);
  assert.equal(readFileSync(join(dir, 'page.html'), 'utf8'), '<main></main>\n');
});

test('--help prints the usage and succeeds', () => {
  const run = spawnSync('node', [DRAW, '--help'], { encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /usage: node draw\.mjs <object\.mjs>.*--into/);
});

test('the CLI asks for an argument when there is none', () => {
  const run = spawnSync('node', [DRAW], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage:/);
});

test('toSwift makes a SwiftUI view that draws the first pass in one ink', () => {
  const swift = toSwift(render(box({ name: 'coffee-mug', label: 'Coffee mug' })), 'coffee-mug');
  assert.match(swift, /^import SwiftUI/m);
  assert.ok(swift.includes('struct CoffeeMug: View {'));
  assert.ok(swift.includes('var ink: Color = .primary') && swift.includes('var weight: CGFloat = 3'));
  assert.ok(swift.includes('.accessibilityLabel("Coffee mug")'));
  const rows = swift.match(/^ {8}\(\d, \[/gm) ?? [];
  assert.equal(rows.length, 3, 'one row per stroke: line, eye and dot');
});

test('toSwift keeps the eye and thin weights apart from the main ink', () => {
  const swift = toSwift(render(box({ draw: (pen) => pen.line([[0, 0, 0], [9, 0, 0]], { thin: true }) + pen.eye([2, 0, 5]) })), 'box');
  assert.match(swift, /^ {8}\(1, \[/m);
  assert.match(swift, /^ {8}\(2, \[/m);
});

test('the CLI writes a .swift view when asked', () => {
  const dir = project({ 'box.mjs': SOURCE });
  const r = spawnSync(process.execPath, [DRAW, join(dir, 'box.mjs'), join(dir, 'box.svg'), '--swift'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, 'box.swift'), 'utf8'), /struct Box: View/);
});

test('toSwift leaves out parts that are hidden at rest and only appear in the gesture', () => {
  const o = box({
    draw: (pen) => pen.line([[0, 0, 0], [9, 0, 0]]) + pen.group('puff', pen.ring([0, 0, 0], 4)),
    css: 'ROOT .sl-puff{opacity:0}ACTIVE .sl-puff{opacity:1}',
  });
  const rows = toSwift(render(o), 'box').match(/^ {8}\(\d, \[/gm) ?? [];
  assert.equal(rows.length, 1);
});
