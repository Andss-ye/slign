export const name = 'trash';
export const label = 'Trash';
export const style = 'icon';

export const draw = (pen) =>
  pen.curve([[6, 7], [6, 21], [18, 21], [18, 7]]) +
  pen.line([[10, 11], [10, 17]]) + pen.line([[14, 11], [14, 17]]) +
  pen.group('g', pen.line([[4, 7], [20, 7]]) + pen.line([[9, 7], [9, 4], [15, 4], [15, 7]]));

export const css =
  'ACTIVE .sl-g{transform-origin:4px 7px;animation:slign-trash-r .5s}' +
  '@keyframes slign-trash-r{50%{transform:rotate(-14deg)}}';
