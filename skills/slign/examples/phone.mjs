// Teaches: an upright slab with rounded corners, a side button, and a shake around its base.
export const name = 'phone';
export const label = 'Phone';

const W = 22, H = 92, T = 4, C = 7;
// Rounded rectangle on the front face, corners cut at 45 degrees and smoothed by the pen.
const face = (inset, y = T) => {
  const x = W - inset, z0 = inset, z1 = H - inset, c = C - inset / 2;
  return [[-x + c, y, z0], [x - c, y, z0], [x, y, z0 + c], [x, y, z1 - c], [x - c, y, z1], [-x + c, y, z1], [-x, y, z1 - c], [-x, y, z0 + c]];
};

export function draw(pen) {
  const body =
    pen.curve(face(0), { closed: true }) +
    pen.line([[-W + C, T, H], [-W + C, -T, H], [W - C, -T, H], [W - C, T, H]]) +
    pen.line([[W, T, H - C], [W, -T, H - C], [W, -T, C], [W, T, C]], { thin: true }) +
    pen.line([[W - C, -T, H], [W, -T, H - C]]) +
    pen.line([[W, -T, C], [W - C, -T, 0], [W - C, T, 0]]) +
    pen.line([[W, 0, 60], [W + 2.5, 0, 60], [W + 2.5, 0, 74], [W, 0, 74]], { thin: true });
  const screen = pen.curve(face(4), { closed: true, thin: true }) + pen.line([[-6, T, 80], [6, T, 80]], { thin: true });
  const mouth = pen.curve([[-6, T, 40], [0, T, 35], [6, T, 40]], { thin: true });
  const buzz =
    pen.group('wave1', pen.ring([0, 0, 46], 34, { plane: 'yz', from: 148, to: 188, thin: true })) +
    pen.group('wave2', pen.ring([0, 0, 46], 34, { plane: 'yz', from: -8, to: 32, thin: true }));
  return pen.group('phone', body + screen + pen.eye([-7, T, 52], 9) + pen.eye([7, T, 52], 9) + mouth) + buzz;
}

// The phone buzzes around its base while two arcs flash beside it.
export const css = ({ origin }) =>
  `ROOT .sl-phone{transform-box:view-box;transform-origin:${origin([0, 0, 0])}}` +
  'ROOT .sl-wave1,ROOT .sl-wave2{opacity:0}' +
  'ACTIVE .sl-phone{animation:slign-phone-buzz .5s ease-in-out infinite}' +
  'ACTIVE .sl-wave1,ACTIVE .sl-wave2{animation:slign-phone-wave .5s ease-out infinite}' +
  '@keyframes slign-phone-buzz{0%,100%{transform:rotate(0)}25%{transform:rotate(-2.2deg)}75%{transform:rotate(2.2deg)}}' +
  '@keyframes slign-phone-wave{0%{opacity:0}40%{opacity:1}100%{opacity:0}}';
