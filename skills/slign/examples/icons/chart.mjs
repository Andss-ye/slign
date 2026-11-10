export const name = 'chart';
export const label = 'Chart';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[3, 3], [3, 21], [21, 21]]) +
  pen.group('g', pen.line([[8, 17], [8, 12]]) + pen.line([[13, 17], [13, 7]]) + pen.line([[18, 17], [18, 10]]));

export const css =
  'ACTIVE .sl-g{transform-origin:0 17px;animation:slign-chart-r .5s}' +
  '@keyframes slign-chart-r{0%{transform:scaleY(.4)}}';
