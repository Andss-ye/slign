// Teaches: the engraving pen. A box under a lid, shaded by hatching and stippled on top.
export const name = 'engrave-cube';
export const label = 'Box with a lid';
export const style = 'engrave';
export const palette = {};
export const groups = ['body', 'lid'];

const W = 60, H = 40, L = 8, O = 4;
const right = (x, y0, y1, z0, z1) => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]];
const left = (y, x0, x1, z0, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];

export function draw(pen) {
  const body = pen.face(right(W, 0, W, 0, H - O), { tone: 0.6 }) + pen.face(left(W, 0, W, 0, H - O), { tone: 0.9 });
  const top = H + L, a = -O, b = W + O;
  const lid =
    pen.face(right(b, a, b, H, top), { tone: 0.5 }) +
    pen.face(left(b, a, b, H, top), { tone: 0.75 }) +
    pen.face([[a, a, top], [b, a, top], [b, b, top], [a, b, top]], { angle: -30 }) +
    pen.stipple([[a, a, top], [b, a, top], [b, b, top], [a, b, top]], { n: 70 });
  return pen.group('body', body) + pen.group('lid', lid);
}
