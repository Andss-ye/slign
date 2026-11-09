export const name = 'user';
export const label = 'User';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[4, 21], [4, 16], [20, 16], [20, 21]], { r: 9 }) +
  pen.group('g', pen.ring([12, 8], 4));

export const css =
  'ACTIVE .sl-g{animation:slign-user-r .5s}' +
  '@keyframes slign-user-r{50%{transform:translateY(-1.5px)}}';
