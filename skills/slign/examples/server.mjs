// Teaches: a plain box, repeated detail, and a staggered sequence.
export const name = 'server';
export const label = 'Server';
export const oy = 152;

export function draw(pen) {
  const w = 26, h = 66;
  const body =
    pen.line([[-w, -w, h], [w, -w, h], [w, w, h], [-w, w, h]], { closed: true }) +
    pen.line([[-w, w, h], [-w, w, 0], [w, w, 0], [w, -w, 0], [w, -w, h]]) +
    pen.line([[w, w, h], [w, w, 0]]);
  let units = '';
  for (const z of [22, 44]) units += pen.line([[-w, w, z], [w, w, z], [w, -w, z]], { thin: true });
  [11, 33].forEach((z, i) => {
    units += pen.group(`led${i + 1}`, pen.dot([-17, w, z]) + pen.dot([-10, w, z])) +
      pen.line([[0, w, z], [17, w, z]], { thin: true });
  });
  const vents = [-12, 0, 12].map((y) => pen.line([[w, y - 4, 55], [w, y + 4, 55]], { thin: true })).join('');
  const face = pen.eye([-8, w, 55]) + pen.eye([6, w, 55]) + pen.group('led3', pen.dot([18, w, 60]));
  return body + units + vents + face;
}

// The lights come on from the bottom unit to the top one.
export const css =
  'ROOT .sl-led1,ROOT .sl-led2,ROOT .sl-led3{opacity:.3}' +
  'ACTIVE .sl-led1{animation:slign-server-on .9s ease-out infinite}' +
  'ACTIVE .sl-led2{animation:slign-server-on .9s ease-out .15s infinite}' +
  'ACTIVE .sl-led3{animation:slign-server-on .9s ease-out .3s infinite}' +
  '@keyframes slign-server-on{0%,100%{opacity:.3}30%{opacity:1}}';
