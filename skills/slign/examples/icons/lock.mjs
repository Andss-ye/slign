export const name = 'lock';
export const label = 'Lock';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[5, 11], [19, 11], [19, 21], [5, 21]], { closed: true }) +
  pen.line([[12, 15], [12, 17]]) +
  pen.group('g', pen.line([[8, 11], [8, 8]]) + pen.ring([12, 8], 4, { from: 180, to: 360 }) + pen.line([[16, 8], [16, 11]]));

export const css =
  'ACTIVE .sl-g{animation:slign-lock-r .5s}' +
  '@keyframes slign-lock-r{50%{transform:translateY(-2px)}}';
