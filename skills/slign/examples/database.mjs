// Teaches: cylinders drawn with rings, and a part that lifts with a bounce.
export const name = 'database';
export const label = 'Database';
export const oy = 148;

const R = 30, H = 16;
const on = (deg, z) => [R * Math.cos((deg * Math.PI) / 180), R * Math.sin((deg * Math.PI) / 180), z];

export function draw(pen) {
  // Only the arcs you would see: the back of a lower disc is hidden by the one above.
  const disc = (z0, top) =>
    pen.ring([0, 0, z0 + H], R, top ? {} : { from: -45, to: 135 }) +
    pen.ring([0, 0, z0], R, { from: -45, to: 135 }) +
    pen.line([on(-45, z0 + H), on(-45, z0)]) +
    pen.line([on(135, z0 + H), on(135, z0)]);
  const led = (z0) => pen.dot(on(100, z0 + H / 2));
  const face = pen.eye(on(27, 48), 7) + pen.eye(on(63, 48), 7);
  return disc(0) + led(0) + disc(20) + led(20) + pen.group('top', disc(40, true) + face);
}

// The top disc jumps.
export const css =
  'ROOT .sl-top{transition:transform .5s cubic-bezier(.34,1.8,.64,1)}' +
  'ACTIVE .sl-top{transform:translateY(-9px)}';
