export const name = 'bell';
export const label = 'Bell';
export const style = 'icon';

export const draw = (pen) =>
  pen.group('g',
    pen.ring([12, 9], 6, { from: 180, to: 360 }) +
    pen.line([[18, 9], [18, 14], [20, 17], [4, 17], [6, 14], [6, 9]]) +
    pen.ring([12, 19.5], 2, { from: 0, to: 180 }));

export const css =
  'ACTIVE .sl-g{transform-origin:12px 3px;animation:slign-bell-r .6s}' +
  '@keyframes slign-bell-r{25%{transform:rotate(12deg)}75%{transform:rotate(-12deg)}}';
