export const name = 'plus';
export const label = 'Plus';
export const style = 'icon';

export const draw = (pen) =>
  pen.group('g', pen.line([[12, 4], [12, 20]]) + pen.line([[4, 12], [20, 12]]));

export const css =
  'ACTIVE .sl-g{transform-origin:12px 12px;animation:slign-plus-r .5s}' +
  '@keyframes slign-plus-r{to{transform:rotate(90deg)}}';
