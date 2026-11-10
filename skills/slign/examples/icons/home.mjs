export const name = 'home';
export const label = 'Home';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[5, 10], [5, 21], [19, 21], [19, 10]]) +
  pen.curve([[10, 21], [10, 15], [14, 15], [14, 21]], { r: 1 }) +
  pen.group('g', pen.curve([[2, 12], [12, 3], [22, 12]], { r: 1 }));

export const css =
  'ACTIVE .sl-g{animation:slign-home-r .5s}' +
  '@keyframes slign-home-r{50%{transform:translateY(-1.5px)}}';
