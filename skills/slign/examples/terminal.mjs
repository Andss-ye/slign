// Teaches: symbols drawn on a face, and things that appear step by step.
export const name = 'terminal';
export const label = 'Terminal';
export const oy = 146;

export function draw(pen) {
  const w = 46, h = 64, d = -10;
  const frame =
    pen.line([[-w, 0, 0], [-w, 0, h], [w, 0, h], [w, 0, 0]], { closed: true }) +
    pen.line([[-w, 0, h], [-w, d, h], [w, d, h], [w, d, 0], [w, 0, 0]]) +
    pen.line([[w, 0, h], [w, d, h]]) +
    pen.line([[-w, 0, 52], [w, 0, 52]], { thin: true }) +
    pen.dot([-38, 0, 58]) + pen.dot([-31, 0, 58]) + pen.dot([-24, 0, 58]);
  const prompt = pen.line([[-38, 0, 42], [-31, 0, 37], [-38, 0, 32]], { thin: true });
  const word = (x0, x1, z) => pen.line([[x0, 0, z], [x1, 0, z]], { thin: true });
  const typed =
    word(-24, -12, 37) +
    pen.group('t1', word(-7, 6, 37)) +
    pen.group('t2', word(-38, -18, 24)) +
    pen.group('t3', word(-13, 2, 24)) +
    pen.group('t4', word(-38, -26, 11));
  const face = pen.eye([20, 0, 30], 7) + pen.eye([33, 0, 30], 7);
  return frame + prompt + typed + face;
}

// A command gets typed, one word at a time.
export const css =
  'ROOT .sl-t1,ROOT .sl-t2,ROOT .sl-t3,ROOT .sl-t4{opacity:0}' +
  'ACTIVE .sl-t1{animation:slign-terminal-t1 2s step-end infinite}' +
  'ACTIVE .sl-t2{animation:slign-terminal-t2 2s step-end infinite}' +
  'ACTIVE .sl-t3{animation:slign-terminal-t3 2s step-end infinite}' +
  'ACTIVE .sl-t4{animation:slign-terminal-t4 2s step-end infinite}' +
  '@keyframes slign-terminal-t1{0%{opacity:0}15%,100%{opacity:1}}' +
  '@keyframes slign-terminal-t2{0%{opacity:0}35%,100%{opacity:1}}' +
  '@keyframes slign-terminal-t3{0%{opacity:0}55%,100%{opacity:1}}' +
  '@keyframes slign-terminal-t4{0%{opacity:0}75%,100%{opacity:1}}';
