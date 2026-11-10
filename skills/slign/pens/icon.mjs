const n = (v) => +v.toFixed(2);
const xy = ([x, y]) => `${n(x)} ${n(y)}`;
const toward = (a, b, d) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len];
};
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Next point of a path: a vertical or horizontal run is the short command. */
const step = (from, p) => (!from ? 'M' + xy(p) : p[0] === from[0] ? `V${n(p[1])}` : p[1] === from[1] ? `H${n(p[0])}` : 'L' + xy(p));

/**
 * Flat pen for a 24x24 grid: exact lines, no wobble, no projection.
 * The seed and origin are unused; they keep the signature of the other pens.
 */
export function createPen() {
  /** Straight strokes through 2D points. */
  const line = (points, o = {}) =>
    `<path d="${points.map((p, i) => step(points[i - 1], p)).join('')}${o.closed ? 'Z' : ''}"/>`;

  /** Strokes through 2D points with every inner corner rounded by radius `r` (2 by default). */
  const curve = (points, o = {}) => {
    const { r = 2, closed } = o, len = points.length;
    let d = '', at;
    const go = (p) => { if (!at || xy(at) !== xy(p)) d += step(at, p); at = p; };
    points.forEach((p, i) => {
      const prev = points[(i - 1 + len) % len], next = points[(i + 1) % len];
      if (!closed && (i === 0 || i === len - 1)) return go(p);
      const b = toward(p, next, Math.min(r, dist(p, next) / 2));
      go(toward(p, prev, Math.min(r, dist(p, prev) / 2)));
      d += `Q${xy(p)} ${xy(b)}`;
      at = b;
    });
    return `<path d="${d}${closed ? 'Z' : ''}"/>`;
  };

  /** Circle or arc: 0 degrees points along +x, 90 along +y (down). */
  const ring = ([cx, cy], r, o = {}) => {
    const from = o.from ?? 0, to = o.to ?? 360, full = to - from >= 360;
    const at = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const arc = (a, large) => `A${n(r)} ${n(r)} 0 ${large} ${to > from ? 1 : 0} ${xy(at(a))}`;
    const half = (to - from) / 2;
    const d = full ? `${arc(from + half, 0)}${arc(to, 0)}` : arc(to, Math.abs(to - from) > 180 ? 1 : 0);
    return `<path d="M${xy(at(from))}${d}"/>`;
  };

  const dot = (p) => `<path d="M${xy(p)}h.01"/>`;
  const group = (name, markup) => `<g class="sl-${name}">${markup}</g>`;

  return { line, curve, ring, dot, group };
}

/** Arguments of a command as offsets from the pen position (x, y). */
const offsets = (c, a, x, y) =>
  c === 'H' ? [a[0] - x] : c === 'V' ? [a[0] - y] : c === 'A' ? [...a.slice(0, 5), a[5] - x, a[6] - y] : a.map((v, i) => v - (i % 2 ? y : x));

/**
 * A path rewritten with every command in whichever of its absolute or relative
 * form is shorter, a repeated command letter left out and a move to where the pen already is dropped.
 */
function shorten(d) {
  const size = { M: 2, L: 2, H: 1, V: 1, Q: 4, A: 7 };
  let x = 0, y = 0, sx = 0, sy = 0, last = '', out = '';
  const put = (piece) => (out += (/^[\d.]/.test(piece) ? ' ' : '') + piece);
  for (const [, c, args] of d.matchAll(/([MLHVQAZ]|h\.01)([^MLHVQAZh]*)/g)) {
    if (c === 'Z') { put('Z'); [x, y, last] = [sx, sy, '']; continue; }
    if (c === 'h.01') { put(c); x += 0.01; last = ''; continue; }
    const v = args.match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i < v.length; i += size[c]) {
      const a = v.slice(i, i + size[c]), ex = c === 'V' ? x : a[size[c] === 1 ? 0 : size[c] - 2], ey = c === 'H' ? y : c === 'V' ? a[0] : a[size[c] - 1];
      if (c === 'M' && out && n(ex) === n(x) && n(ey) === n(y)) continue;
      const num = (q) => String(n(q)).replace(/^(-?)0\./, '$1.');
      const piece = (l, w) => (l === last ? '' : l) + w.map(num).join(' ').replace(/ -/g, '-');
      const cost = (t) => t.length + +/^[\d.]/.test(t);
      const abs = piece(c, a), rel = piece(c.toLowerCase(), offsets(c, a, x, y));
      const short = c !== 'M' && cost(rel) < cost(abs);
      put(short ? rel : abs);
      last = c === 'M' ? '' : short ? c.toLowerCase() : c;
      if (c === 'M') [sx, sy] = [ex, ey];
      [x, y] = [ex, ey];
    }
  }
  return out;
}

/** Neighbouring paths share one stroke, so they become one path. */
export const finish = (markup) =>
  markup
    .replace(/(?:<path d="[^"]*"\/>){2,}/g, (run) => `<path d="${[...run.matchAll(/d="([^"]*)"/g)].map((m) => m[1]).join('')}"/>`)
    .replace(/ d="([^"]*)"/g, (_, d) => ` d="${shorten(d)}"`);

export const paint = (o) => ({ stroke: o.palette?.ink ?? 'currentColor', defs: '' });

export const baseCss = (o) =>
  `.slign-${o.name}{stroke-width:var(--slign-stroke,1.75);width:var(--slign-size,1.5em)}`;

export const motionCss = () => '';

/**
 * The whole SVG of an icon. `gesture` is the object's own css with ROOT and ACTIVE
 * still in it; it only runs when the reader has not asked for reduced motion.
 */
export function render(o, gesture) {
  const root = `.slign-${o.name}`;
  const active = `${root}:is(:hover,.slign-active,[data-slign-trigger]:is(:hover,:focus-within,:active) *)`;
  const motion = gesture.replace(/\bACTIVE\b/g, active).replace(/\bROOT\b/g, root);
  const css = baseCss(o) + (motion && `@media not (prefers-reduced-motion){${motion}}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="slign slign-${o.name}" role="img" aria-label="${o.label}" fill="none" stroke="${paint(o).stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    `<style>${css}</style>${finish(o.draw(createPen()))}</svg>`;
}
