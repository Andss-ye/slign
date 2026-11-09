export const name = 'mail';
export const label = 'Mail';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[3, 5], [21, 5], [21, 19], [3, 19]], { closed: true }) +
  pen.group('g', pen.curve([[3, 8], [12, 13], [21, 8]], { r: 1 }));

export const css =
  'ACTIVE .sl-g{animation:slign-mail-r .5s}' +
  '@keyframes slign-mail-r{50%{transform:translateY(-1.5px)}}';
