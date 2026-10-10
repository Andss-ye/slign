// Teaches: a tall object made of several parts, and pieces that separate.
export const name = 'rocket';
export const label = 'Rocket';
export const oy = 166;

const R = 15;
const on = (deg, z, r = R) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), z];

export function draw(pen) {
  const body =
    pen.ring([0, 0, 72], R, { from: -45, to: 135 }) +
    pen.ring([0, 0, 18], R, { from: -45, to: 135 }) +
    pen.line([on(-45, 72), on(-45, 18)]) +
    pen.line([on(135, 72), on(135, 18)]) +
    pen.curve([on(135, 72), on(135, 90, 9), [0, 0, 106], on(-45, 90, 9), on(-45, 72)]);
  const fin = (deg) => pen.line([on(deg, 40), on(deg, 8, R + 16), on(deg, 20)]);
  const flame = pen.curve([on(135, 14, 7), [0, 0, -6], on(-45, 14, 7)], { thin: true });
  const face = pen.eye(on(27, 54), 7) + pen.eye(on(63, 54), 7);
  const smoke =
    pen.group('smoke1', pen.ring([-18, 12, 0], 7, { thin: true })) +
    pen.group('smoke2', pen.ring([16, -8, 0], 6, { thin: true })) +
    pen.group('smoke3', pen.ring([4, 22, 0], 5, { thin: true }));
  return pen.group('ship', body + fin(135) + fin(-45) + flame + face) + smoke;
}

// The ship lifts off and leaves puffs of smoke on the ground.
export const css =
  'ROOT .sl-ship{transition:transform .5s cubic-bezier(.34,1.56,.64,1)}' +
  'ACTIVE .sl-ship{transform:translateY(-12px)}' +
  'ROOT .sl-smoke1,ROOT .sl-smoke2,ROOT .sl-smoke3{opacity:0;transform-box:fill-box;transform-origin:center}' +
  'ACTIVE .sl-smoke1{animation:slign-rocket-puff 1s ease-out infinite}' +
  'ACTIVE .sl-smoke2{animation:slign-rocket-puff 1s ease-out .25s infinite}' +
  'ACTIVE .sl-smoke3{animation:slign-rocket-puff 1s ease-out .5s infinite}' +
  '@keyframes slign-rocket-puff{0%{opacity:0;transform:scale(.4)}30%{opacity:1}100%{opacity:0;transform:scale(1.5)}}';
