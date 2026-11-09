export const name = 'bell';
export const label = 'Alert bell';
export const oy = 150;

const on = (deg, z, r) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), z];
const side = (deg) => [on(deg, 10, 30), on(deg, 22, 24), on(deg, 40, 19), on(deg, 56, 15), [0, 0, 66]];

export function draw(pen) {
  const shell =
    pen.ring([0, 0, 10], 30, { from: -45, to: 135 }) +
    pen.ring([0, 0, 4], 33, { from: -45, to: 135 }) +
    pen.line([on(-45, 10, 30), on(-45, 4, 33)]) +
    pen.line([on(135, 10, 30), on(135, 4, 33)]) +
    pen.curve(side(135)) +
    pen.curve(side(-45)) +
    pen.ring([0, 0, 40], 19, { from: -20, to: 110, thin: true });
  const loop = pen.ring([0, 0, 71], 6, { plane: 'xz', from: -30, to: 210 });
  const clapper = pen.group('clapper', pen.ring([10, 10, -6], 5));
  const face = pen.eye(on(30, 26, 23), 7) + pen.eye(on(62, 26, 23), 7);
  const waves =
    pen.group('wave1', pen.ring([0, 0, 50], 40, { plane: 'xz', from: -25, to: 25, thin: true })) +
    pen.group('wave2', pen.ring([0, 0, 50], 40, { plane: 'yz', from: 155, to: 205, thin: true }));
  return pen.group('bell', clapper + shell + loop + face) + waves;
}

export const css = ({ origin }) =>
  `ROOT .sl-bell{transform-box:view-box;transform-origin:${origin([0, 0, 72])}}` +
  'ROOT .sl-wave1,ROOT .sl-wave2{opacity:0}' +
  'ACTIVE .sl-bell{animation:slign-bell-swing .9s ease-in-out infinite}' +
  'ACTIVE .sl-wave1,ACTIVE .sl-wave2{animation:slign-bell-wave .9s ease-out infinite}' +
  '@keyframes slign-bell-swing{0%,100%{transform:rotate(0)}25%{transform:rotate(9deg)}75%{transform:rotate(-9deg)}}' +
  '@keyframes slign-bell-wave{0%,40%{opacity:0}60%{opacity:1}100%{opacity:0}}';
