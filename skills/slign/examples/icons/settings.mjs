export const name = 'settings';
export const label = 'Settings';
export const style = 'icon';

export const draw = (pen) =>
  pen.line([[9, 7], [21, 7]]) + pen.line([[3, 17], [15, 17]]) +
  pen.group('g', pen.ring([7, 7], 2) + pen.ring([17, 17], 2));

export const css =
  'ACTIVE .sl-g{animation:slign-settings-r .5s}' +
  '@keyframes slign-settings-r{50%{transform:translateX(1px)}}';
