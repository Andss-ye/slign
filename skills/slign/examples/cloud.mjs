// Teaches: an organic outline with curve(), and continuous motion.
export const name = 'cloud';
export const label = 'Cloud';
export const oy = 132;

export function draw(pen) {
  const puff = [[-44, 0, 0], [-52, 0, 14], [-40, 0, 28], [-26, 0, 24], [-18, 0, 46], [4, 0, 50], [16, 0, 32], [32, 0, 36], [48, 0, 18], [42, 0, 0]];
  // Thickness shows on the far side: the same outline pushed back, top and right only.
  const back = puff.slice(3).map(([x, , z]) => [x, -14, z]);
  const body =
    pen.curve(puff) +
    pen.line([[-44, 0, 0], [42, 0, 0]]) +
    pen.curve(back) +
    pen.line([[42, 0, 0], [42, -14, 0]]);
  const face = pen.eye([-10, 0, 18]) + pen.eye([6, 0, 18]);
  const rain = [-24, -4, 18].map((x, i) => pen.group(`drop${i + 1}`, pen.line([[x, 0, -8], [x, 0, -17]], { thin: true }))).join('');
  return pen.group('puff', body + face) + rain;
}

// The cloud floats and three drops fall in turn.
export const css =
  'ROOT .sl-drop1,ROOT .sl-drop2,ROOT .sl-drop3{opacity:0}' +
  'ACTIVE .sl-puff{animation:slign-cloud-float 2.4s ease-in-out infinite alternate}' +
  'ACTIVE .sl-drop1{animation:slign-cloud-rain .9s linear infinite}' +
  'ACTIVE .sl-drop2{animation:slign-cloud-rain .9s linear .3s infinite}' +
  'ACTIVE .sl-drop3{animation:slign-cloud-rain .9s linear .6s infinite}' +
  '@keyframes slign-cloud-float{to{transform:translateY(-5px)}}' +
  '@keyframes slign-cloud-rain{0%{opacity:0;transform:translateY(-4px)}30%{opacity:1}100%{opacity:0;transform:translateY(12px)}}';
