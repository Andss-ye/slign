import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, render } from '../skills/slign/scripts/draw.mjs';

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
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="slign slign-box"'));
  assert.ok(svg.includes('stroke="currentColor"') && svg.includes('fill="none"'));
  assert.ok(svg.includes('class="sl-a"') && svg.includes('class="sl-b"'));
  assert.ok(svg.includes('prefers-reduced-motion'));
});

test('ROOT and ACTIVE expand to the object scope', () => {
  const svg = render(box());
  assert.ok(!/\bROOT\b|\bACTIVE\b/.test(svg));
  assert.ok(svg.includes('.slign-box .sl-lid{transition'));
  assert.ok(svg.includes(':is(.slign-box:hover,.slign-box:focus-visible,[data-slign-trigger]:hover .slign-box) .sl-lid{transform'));
});

test('css can be a function that receives hinge and origin', () => {
  const svg = render(box({ css: ({ hinge, origin }) => `ROOT .sl-lid{transform-origin:${origin([0, 0, 0])}}ACTIVE .sl-lid{transform:${hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: 0 })}}` }));
  assert.ok(svg.includes('transform-origin:100px 131px'));
  assert.ok(svg.includes('transform:matrix(1,0,0,1,0,0)'));
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

test('the CLI asks for an argument when there is none', () => {
  const run = spawnSync('node', [DRAW], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage:/);
});
