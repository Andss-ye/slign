// Teaches: a thin panel with thickness, and a part that turns on a hinge.
export const name = 'laptop';
export const label = 'Laptop';

export function draw(pen) {
  let keys = '';
  for (let x = -28; x <= 28; x += 8) for (let y = -16; y <= 4; y += 10) keys += pen.dot([x, y, 6]);
  const scribble = [];
  for (let i = 0; i < 7; i++) scribble.push([i % 2 ? 30 : 16 + i, -23, 52 - i * 2.6]);

  const deck =
    pen.line([[-40, -28, 6], [40, -28, 6], [40, 28, 6], [-40, 28, 6]], { closed: true }) +
    pen.line([[-40, 28, 6], [-40, 28, 0], [40, 28, 0], [40, -28, 0], [40, -28, 6]]) +
    pen.line([[40, 28, 6], [40, 28, 0]]) +
    pen.line([[-10, 12, 6], [10, 12, 6], [10, 22, 6], [-10, 22, 6]], { closed: true }) +
    keys;
  const lid =
    pen.line([[-40, -23, 6], [-40, -23, 62], [40, -23, 62], [40, -23, 6]], { closed: true }) +
    pen.line([[-40, -23, 62], [-40, -29, 62], [40, -29, 62], [40, -29, 6], [40, -23, 6]]) +
    pen.line([[40, -23, 62], [40, -29, 62]]) +
    pen.line([[-34, -23, 12], [-34, -23, 56], [34, -23, 56], [34, -23, 12]], { thin: true, closed: true }) +
    pen.line(scribble, { thin: true }) +
    pen.eye([-8, -23, 37]) + pen.eye([8, -23, 37]);
  return deck + pen.group('lid', lid);
}

// The lid closes 15 degrees around the hinge, the x axis through the back of the deck.
export const css = ({ hinge, origin }) =>
  `ROOT .sl-lid{transform-box:view-box;transform-origin:${origin([0, -23, 6])};transition:transform .6s cubic-bezier(.34,1.56,.64,1)}` +
  `ACTIVE .sl-lid{transform:${hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: -15 })}}`;
