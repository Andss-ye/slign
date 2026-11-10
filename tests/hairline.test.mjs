import test from 'node:test';
import assert from 'node:assert/strict';
import { check, render } from '../skills/slign/scripts/draw.mjs';
import { createPen } from '../skills/slign/pens/hairline.mjs';

const far = [[0, 0, 0], [30, 0, 0], [30, 30, 0], [0, 30, 0]];
const near = [[10, 10, 10], [25, 10, 10], [25, 25, 10], [10, 25, 10]];

const hairline = (draw, extra = {}) => ({ name: 'hf', label: 'Faces', style: 'hairline', draw, ...extra });
const stacked = (pen) => pen.face(far) + pen.face(near);
const count = (s, re) => (s.match(re) ?? []).length;

test('a face is a paper fill under a glowing outline', () => {
  const svg = render(hairline((pen) => pen.face(far)));
  assert.equal(count(svg, /<path class="sl-fill"/g), 1);
  assert.equal(count(svg, /<path class="sl-halo"/g), 1);
  assert.equal(count(svg, /<path class="sl-l"/g), 1);
  assert.ok(svg.indexOf('<path class="sl-fill"') < svg.indexOf('<path class="sl-halo"'));
  assert.ok(svg.indexOf('<path class="sl-halo"') < svg.indexOf('<path class="sl-l"'));
  assert.ok(svg.includes('.sl-fill{fill:var(--slign-paper,#ffffff);stroke:none}'));
});

test('a face is not wrapped in the run glow again', () => {
  const svg = render(hairline((pen) => pen.face(far) + pen.line([[0, 0, 0], [9, 0, 0]])));
  assert.equal(count(svg, /<g class="sl-glow">/g), 1);
  assert.equal(count(svg, /class="sl-halo"/g), 1);
});

test('a nearer face painted later covers the outline and glow of a farther one', () => {
  const svg = render(hairline(stacked));
  const blocks = svg.match(/<g class="sl-face">.*?<\/g>/g);
  assert.equal(blocks.length, 2);
  assert.ok(svg.indexOf(blocks[0]) < svg.indexOf(blocks[1]));
  for (const b of blocks) assert.match(b, /^<g class="sl-face"><path class="sl-fill"[^>]*\/><path class="sl-halo"[^>]*\/><path class="sl-l"[^>]*\/><\/g>$/);
});

test('the paper comes from palette.paper and is validated', () => {
  const svg = render(hairline((pen) => pen.face(far), { palette: { paper: '#101014' } }));
  assert.ok(svg.includes('.sl-fill{fill:var(--slign-paper,#101014);stroke:none}'));
  const bad = check(hairline((pen) => pen.face(far), { palette: { paper: 'red;} .x{fill:url(//e)' } }));
  assert.deepEqual(bad.errors, ['palette: paper/ink must be a plain CSS color']);
});

test('check accepts the paper fill in hairline only through faces, and never in icon', () => {
  assert.deepEqual(check(hairline(stacked)).errors, []);
  const rule = '.sl-fill{fill:var(--slign-paper,#fff);stroke:none}';
  const icon = check({ name: 'sn', label: 'Sneak', style: 'icon', draw: (pen) => `<path d="M1 1" style="${rule}"/>` + pen.line([[4, 12], [20, 12]]) });
  assert.ok(icon.errors.some((e) => e.startsWith('ink:')), icon.errors.join());
  const red = check(hairline((pen) => pen.line([[0, 0, 0], [9, 0, 0]]).replace('/>', ' fill="#f00"/>')));
  assert.ok(red.errors.some((e) => e.startsWith('ink:')), red.errors.join());
});

test('a face of collinear corners is an error', () => {
  assert.throws(() => createPen(0).face([[0, 0, 0], [5, 0, 0], [9, 0, 0]]), /face/);
});

test('glow width and opacity are their own variables, not the stroke', () => {
  const svg = render(hairline(stacked));
  assert.ok(svg.includes('.sl-glow{opacity:var(--slign-glow-opacity,.12)}'));
  assert.ok(svg.includes('.sl-halo{opacity:var(--slign-glow-opacity,.12)}'));
  assert.ok(svg.includes('.sl-glow path,.slign .sl-halo{stroke-width:var(--slign-glow,3.6)}'));
  assert.ok(!/sl-(glow|halo)[^{]*\{[^}]*--_w/.test(svg));
});

test('a ring is a smooth spline with a handful of segments, not a 60-point polyline', () => {
  const pen = createPen(0);
  const d = (s) => s.match(/ d="([^"]+)"/)[1];
  const full = d(pen.ring([0, 0, 0], 20));
  assert.ok(!full.includes('L'), full);
  assert.equal(count(full, /Q/g), 12);
  assert.equal(count(d(pen.ring([0, 0, 0], 20, { from: 0, to: 90 })), /Q/g), 2);
  assert.equal(count(d(pen.ring([0, 0, 0], 20, { from: 0, to: 180, plane: 'xz' })), /Q/g), 5);
});

test('a full ring stays on its circle and an arc starts and ends on it', () => {
  const pen = createPen(0, 0, 0), r = 20, iso = Math.cos(Math.PI / 6);
  const nums = (s) => s.match(/-?\d+(\.\d+)?/g).map(Number);
  // Horizontal circle in screen space: u^2 + v^2 = ((sx / iso)^2 + (2 sy)^2) / 2.
  const radius = (x, y) => Math.sqrt(((x / iso) ** 2 + (2 * y) ** 2) / 2);
  const q = nums(pen.ring([0, 0, 0], r).match(/ d="([^"]+)"/)[1]);
  assert.ok(Math.abs(radius(q[0], q[1]) - r) < 0.3, `${radius(q[0], q[1])}`);
  // Mid point of each quadratic: (start + 2 control + end) / 4.
  for (let i = 0; i + 5 < q.length; i += 4) {
    const [ax, ay, cx, cy, bx, by] = q.slice(i, i + 6);
    const rr = radius((ax + 2 * cx + bx) / 4, (ay + 2 * cy + by) / 4);
    assert.ok(Math.abs(rr - r) < 0.3, `${rr}`);
  }
  const arc = nums(pen.ring([0, 0, 0], r, { from: 0, to: 90 }).match(/ d="([^"]+)"/)[1]);
  assert.ok(Math.abs(radius(arc[0], arc[1]) - r) < 0.3);
  assert.ok(Math.abs(radius(arc.at(-2), arc.at(-1)) - r) < 0.3);
});
