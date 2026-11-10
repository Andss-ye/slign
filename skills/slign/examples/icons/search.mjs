export const name = 'search';
export const label = 'Search';
export const style = 'icon';

export const draw = (pen) =>
  pen.group('g', pen.ring([10, 10], 7) + pen.line([[15, 15], [21, 21]]));

export const css =
  'ACTIVE .sl-g{animation:slign-search-r .6s}' +
  '@keyframes slign-search-r{50%{transform:translate(1px,-1px)}}';
