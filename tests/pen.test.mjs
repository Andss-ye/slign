import test from 'node:test';
import assert from 'node:assert/strict';
import { createPen, hinge, project, projectVector } from '../skills/slign/scripts/pen.mjs';

const count = (s, re) => (s.match(re) || []).length;

test('project puts the 3D origin at the canvas anchor', () => {
  assert.deepEqual(project([0, 0, 0]), [100, 131]);
  assert.deepEqual(project([0, 0, 10], 150), [100, 140]);
});

test('x recedes right-down, y recedes left-down, z goes up', () => {
  const [xx, xy] = projectVector([10, 0, 0]);
  assert.ok(xx > 0 && xy > 0);
  const [yx, yy] = projectVector([0, 10, 0]);
  assert.ok(yx < 0 && yy > 0);
  assert.deepEqual(projectVector([0, 0, 10]), [0, -10]);
});

test('hinge gives the projected matrix of a lid closing 15 degrees', () => {
  assert.equal(hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: -15 }), 'matrix(0.871,0.094,0.224,0.837,0,0)');
});

test('hinge of 0 degrees is the identity', () => {
  assert.equal(hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: 0 }), 'matrix(1,0,0,1,0,0)');
});

test('the same seed draws the same line and another seed a different one', () => {
  const square = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]];
  assert.equal(createPen(7).line(square), createPen(7).line(square));
  assert.notEqual(createPen(7).line(square), createPen(91).line(square));
});

test('a closed line has one segment per side', () => {
  const d = createPen(7).line([[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], { closed: true });
  assert.equal(count(d, /Q/g), 4);
  assert.ok(!d.includes('NaN'));
});

test('thin and cls end up in the class list', () => {
  const d = createPen(7).line([[0, 0, 0], [10, 0, 0]], { thin: true, cls: 'sl-x' });
  assert.ok(d.includes('class="sl-l sl-thin sl-x"'));
});

test('a full ring is a closed curve of twelve segments', () => {
  const d = createPen(7).ring([0, 0, 0], 30);
  assert.equal(count(d, /Q/g), 12);
  assert.ok(!d.includes('NaN'));
});

test('an arc ring stays open', () => {
  const d = createPen(7).ring([0, 0, 0], 30, { from: -45, to: 135 });
  assert.equal(count(d, /Q/g), 5);
});

test('eye is a stroke with the eye class and group wraps markup', () => {
  const pen = createPen(7);
  assert.ok(pen.eye([0, 0, 10]).includes('sl-eye'));
  assert.equal(pen.group('lid', '<path/>'), '<g class="sl-lid"><path/></g>');
});

test('pen methods work when destructured', () => {
  const { ring, eye } = createPen(7);
  assert.ok(ring([0, 0, 0], 10).startsWith('<path'));
  assert.ok(eye([0, 0, 0]).startsWith('<path'));
});
