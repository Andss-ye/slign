export const name = 'check';
export const label = 'Check';
export const style = 'icon';

export const draw = (pen) =>
  pen.ring([12, 12], 9) +
  pen.group('g', pen.line([[8, 12], [11, 15], [16, 9]]));

export const css =
  'ACTIVE .sl-g{transform-origin:12px 12px;animation:slign-check-r .5s}' +
  '@keyframes slign-check-r{50%{transform:scale(1.25)}}';
