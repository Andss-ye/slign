import test from 'node:test';
import assert from 'node:assert/strict';
import { check, render } from '../skills/slign/scripts/draw.mjs';

const icon = (extra = {}) => ({
  name: 'tick',
  label: 'Tick',
  style: 'icon',
  draw: (pen) => pen.group('g', pen.line([[4, 12], [10, 18], [20, 6]])),
  css: 'ACTIVE .sl-g{animation:slign-tick-pop .4s}@keyframes slign-tick-pop{50%{transform:scale(1.15)}}',
  ...extra,
});

test('an icon is a flat 24 grid drawn in one scoped stroke', () => {
  const svg = render(icon());
  assert.ok(svg.includes('viewBox="0 0 24 24"') && svg.includes('class="slign slign-tick"'));
  assert.ok(svg.includes('stroke="currentColor"') && svg.includes('fill="none"'));
  assert.ok(svg.includes('stroke-linecap="round"') && svg.includes('stroke-linejoin="round"'));
  assert.ok(svg.includes('width:var(--slign-size,1.5em)') && svg.includes('stroke-width:var(--slign-stroke,1.75)'));
  assert.ok(!svg.includes(' id=') && !svg.includes('sl-eye') && !svg.includes('sl-b'));
  assert.ok(!/\bROOT\b|\bACTIVE\b/.test(svg) && svg.includes('@keyframes slign-tick-pop'));
});

test('lines are exact: no wobble and the same bytes every time', () => {
  const svg = render(icon());
  assert.ok(svg.includes('d="M4 12L10 18L20 6"'));
  assert.equal(render(icon()), svg);
});

test('palette.ink replaces currentColor', () => {
  assert.ok(render(icon({ palette: { ink: '#123456' } })).includes('stroke="#123456"'));
});

test('ring draws arcs and a dot is a zero-length stroke', () => {
  const svg = render(icon({
    draw: (pen) => pen.ring([12, 12], 6) + pen.ring([12, 12], 9, { from: 180, to: 270 }) + pen.dot([12, 12]),
  }));
  assert.ok(svg.includes('M18 12A6 6 0 0 1 6 12A6 6 0 0 1 18 12'), svg);
  assert.ok(svg.includes('M3 12A9 9 0 0 1 12 3'), svg);
  assert.ok(svg.includes('M12 12h.01'));
});

test('neighbouring paths merge into one, and straight runs use H and V', () => {
  const svg = render(icon({ draw: (pen) => pen.line([[4, 12], [20, 12]]) + pen.line([[12, 4], [12, 20]]) + pen.group('g', pen.dot([1, 1])) }));
  assert.ok(svg.includes('<path d="M4 12H20M12 4V20"/><g class="sl-g"><path d="M1 1h.01"/></g>'), svg);
});

test('curve rounds the corners with quadratic bends and closes cleanly', () => {
  const open = render(icon({ draw: (pen) => pen.curve([[4, 4], [20, 4], [20, 20]], { r: 2 }) }));
  assert.ok(open.includes('d="M4 4H18Q20 4 20 6V20"'), open);
  const closed = render(icon({ draw: (pen) => pen.curve([[4, 4], [20, 4], [20, 20], [4, 20]], { closed: true }) }));
  assert.match(closed, /d="M[\d. ]+Q[^"]+Z"/);
  assert.equal((closed.match(/Q/g) ?? []).length, 4);
});

test('every coordinate of a clean icon sits on the 24 grid', () => {
  const svg = render(icon({ draw: (pen) => pen.curve([[3, 3], [21, 3], [21, 21], [3, 21]], { closed: true }) }));
  for (const [, d] of svg.matchAll(/ d="([^"]+)"/g)) {
    for (const v of d.match(/-?\d+(\.\d+)?/g)) assert.ok(v >= 0 && v <= 24, v);
  }
});

test('check accepts a clean icon with no face warning', () => {
  const { errors, warnings } = check(icon());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('check refuses text, ids and unscoped or animated-stroke css in an icon', () => {
  assert.ok(check(icon({ draw: () => '<text>x</text>' })).errors.some((e) => e.startsWith('ink:')));
  assert.ok(check(icon({ draw: () => '<path id="a" d="M1 1L2 2"/>' })).errors.some((e) => e.startsWith('id:')));
  assert.ok(check(icon({ css: 'ACTIVE .sl-g{animation:spin 1s}@keyframes spin{to{transform:none}}' })).errors.some((e) => e.startsWith('scope:')));
  assert.ok(check(icon({ css: '@keyframes slign-tick-a{to{stroke-width:4}}' })).errors.some((e) => e.startsWith('motion:')));
});

test('an icon warns over 1.5 KB and fails over 3 KB', () => {
  const lines = (n) => (pen) => pen.group('g', Array.from({ length: n }, (_, i) => pen.line([[1 + (i % 21), 1 + (i % 17)], [23 - (i % 9), 2 + (i % 19)]])).join(''));
  const mid = check(icon({ draw: lines(110) }));
  assert.deepEqual(mid.errors, []);
  assert.ok(mid.warnings.some((w) => w.startsWith('size:')), mid.warnings.join());
  assert.ok(check(icon({ draw: lines(300) })).errors.some((e) => e.startsWith('size:')));
});

test('an icon without a gesture is told so', () => {
  assert.ok(check(icon({ css: undefined })).warnings.some((w) => w.startsWith('gesture:')));
});
