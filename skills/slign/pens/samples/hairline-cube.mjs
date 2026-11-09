// Teaches: the hairline pen. A glass cube drawn as a precise wireframe with a gradient and a glow.
export const name = 'hairline-cube';
export const label = 'Glass cube';
export const style = 'hairline';
export const palette = { stops: ['#2f6bff', '#8be9ff'] };
export const groups = ['shell', 'core', 'ring'];
export const idle = true;

const S = 60, T = 12;
const square = (a, b, z) => [[a, a, z], [b, a, z], [b, b, z], [a, b, z]];

export function draw(pen) {
  // Outer box: the hidden corner at the back is drawn thin.
  const shell =
    pen.line([[S, 0, 0], [S, S, 0], [0, S, 0]]) +
    pen.line([[0, S, 0], [0, S, S], [0, 0, S], [S, 0, S], [S, 0, 0]]) +
    pen.line(square(0, S, S), { closed: true }) +
    pen.line([[S, S, 0], [S, S, S]]) +
    pen.line([[0, 0, 0], [S, 0, 0]], { thin: true }) +
    pen.line([[0, 0, 0], [0, S, 0]], { thin: true }) +
    pen.line([[0, 0, 0], [0, 0, S]], { thin: true });
  // Inner cube, inset by the wall thickness, joined to the outer corners.
  const core =
    pen.line(square(T, S - T, T), { closed: true, thin: true }) +
    pen.line(square(T, S - T, S - T), { closed: true, thin: true }) +
    [[T, T], [S - T, T], [S - T, S - T], [T, S - T]].map(([x, y]) => pen.line([[x, y, T], [x, y, S - T]], { thin: true })).join('') +
    [[0, 0], [S, 0], [S, S], [0, S]].map(([x, y], i) => pen.line([[x, y, S], [[T, S - T][x ? 1 : 0], [T, S - T][y ? 1 : 0], S - T]], { thin: true, accent: i === 2 })).join('');
  const ring = pen.ring([S / 2, S / 2, S], 16) + pen.ring([S / 2, S / 2, S], 8, { thin: true }) + pen.dot([S / 2, S / 2, S]);
  return pen.group('shell', shell) + pen.group('core', core) + pen.group('ring', ring);
}
