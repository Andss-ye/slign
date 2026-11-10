export const name = 'calendar';
export const label = 'Calendar';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[3, 5], [21, 5], [21, 21], [3, 21]], { closed: true }) +
  pen.line([[3, 10], [21, 10]]) + pen.dot([12, 15]) +
  pen.group('g', pen.line([[8, 3], [8, 7]]) + pen.line([[16, 3], [16, 7]]));

export const css =
  'ACTIVE .sl-g{animation:slign-calendar-r .5s}' +
  '@keyframes slign-calendar-r{50%{transform:translateY(-1.5px)}}';
