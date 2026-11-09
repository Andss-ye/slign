// Teaches: hidden lines in the hairline pen. Three plates and a post are drawn back to front with pen.face,
// so each nearer face covers the edges behind it and no polyline needs trimming by eye.
export const name = 'hairline-stack';
export const label = 'Stacked plates';
export const style = 'hairline';
export const palette = { stops: ['#2f6bff', '#8be9ff'], accent: '#ff7ad9' };
export const groups = ['post', 'plates'];

const S = 50;

/** The three faces of a box that face the viewer: top, +x side and +y side. */
const box = (pen, [x0, x1], [y0, y1], [z0, z1], o = {}) =>
  pen.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], o) +
  pen.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], o) +
  pen.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], o);

export function draw(pen) {
  // The post stands behind the plates, so it goes first.
  const post = box(pen, [-16, -8], [18, 26], [0, 62]);
  // Plates go from the lowest to the highest: each one hides the part of the post and the plates below it.
  const plates =
    box(pen, [0, S], [0, S], [0, 5]) +
    box(pen, [0, S], [0, S], [16, 21]) +
    box(pen, [0, S], [0, S], [32, 37], { accent: true }) +
    pen.ring([S / 2, S / 2, 37], 14) +
    pen.ring([S / 2, S / 2, 37], 7, { thin: true }) +
    pen.dot([S / 2, S / 2, 37]);
  return pen.group('post', post) + pen.group('plates', plates);
}
