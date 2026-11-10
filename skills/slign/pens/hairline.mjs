import { project } from '../scripts/pen.mjs';

const n = (v) => +v.toFixed(2);
const xy = ([x, y]) => `${n(x)} ${n(y)}`;
const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
export const unit = (v) => v.map((c) => c / Math.hypot(...v));
const delay = (s) => `${+s.toFixed(2)}s`.replace(/^0\./, '.');

/** Sizing, reduced motion and the stroke weight every non-ink style shares. */
export const LAYOUT =
  '.slign:not([width]){width:var(--slign-size,8em)}' +
  '.slign{max-width:100%;height:auto;overflow:visible}' +
  '.slign .sl-thin{stroke-width:calc(var(--_w)*.67)}' +
  '@media (prefers-reduced-motion:reduce){.slign *{animation:none!important;transition:none!important}}';

/** Unit normal from the first three corners that are not on one line. */
export function normalOf(points) {
  for (let i = 0; i < points.length - 2; i++) for (let j = i + 1; j < points.length - 1; j++) for (let k = j + 1; k < points.length; k++) {
    const [a, b, c] = [points[i], points[j], points[k]];
    const u = b.map((v, m) => v - a[m]), w = c.map((v, m) => v - b[m]);
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (Math.hypot(...cross) > 1e-9) return unit(cross);
  }
  throw new Error('face corners are collinear: a face needs three corners that are not on one line');
}

/**
 * Precise technical pen: straight segments are straight, rings are smooth splines.
 * The seed is unused; it keeps the signature of the other pens.
 */
export function createPen(seed, oy = 131, ox = 100) {
  const at = (p) => project(p, oy, ox);
  const cls = (base, o) => [base, o.thin && 'sl-thin', o.accent && 'sl-acc', o.cls].filter(Boolean).join(' ');

  /** Straight strokes through 3D points. */
  const line = (points, o = {}) =>
    `<path class="${cls('sl-l', o)}" d="M${points.map((p) => xy(at(p))).join('L')}${o.closed ? 'Z' : ''}"/>`;

  /** One smooth stroke through three or more 3D points. */
  const curve = (points, o = {}) => {
    const p = points.map(at);
    const m = (i) => mid(p[i], p[(i + 1) % p.length]);
    let d;
    if (o.closed) {
      d = `M${xy(m(p.length - 1))}`;
      p.forEach((q, i) => { d += `Q${xy(q)} ${xy(m(i))}`; });
    } else {
      d = `M${xy(p[0])}`;
      for (let i = 1; i < p.length - 1; i++) d += `Q${xy(p[i])} ${xy(i === p.length - 2 ? p[i + 1] : m(i))}`;
    }
    return `<path class="${cls('sl-l', o)}" d="${d}"/>`;
  };

  /**
   * Circle or arc as a smooth spline. Horizontal by default: 0 degrees points along +x, 90 along +y.
   * With plane 'xz' or 'yz' it stands upright: 0 points along x or y, 90 points up.
   */
  const ring = ([cx, cy, z], r, o = {}) => {
    const from = o.from ?? 0, to = o.to ?? 360, full = to - from >= 360;
    const steps = Math.max(3, Math.ceil((to - from) / 30)), pts = [];
    // Control points sit slightly outside the circle so the curve through the midpoints lands on it.
    const out = 2 / (1 + Math.cos(((to - from) / steps) * (Math.PI / 360)) ** 2);
    for (let i = 0; i < (full ? steps : steps + 1); i++) {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180, k = r * (full || (i && i < steps) ? out : 1);
      const u = k * Math.cos(a), v = k * Math.sin(a);
      pts.push(o.plane === 'xz' ? [cx + u, cy, z + v] : o.plane === 'yz' ? [cx, cy + u, z + v] : [cx + u, cy + v, z]);
    }
    return curve(pts, { ...o, closed: full });
  };

  /** A planar convex polygon in 3D: paper fill, glow and crisp outline, so it hides what was drawn before it. */
  const face = (points, o = {}) => {
    normalOf(points);
    const d = `M${points.map((p) => xy(at(p))).join('L')}Z`;
    return `<g class="sl-face"><path class="sl-fill" d="${d}"/><path class="sl-halo${o.accent ? ' sl-acc' : ''}" d="${d}"/><path class="${cls('sl-l', o)}" d="${d}"/></g>`;
  };

  const dot = (p) => `<path class="sl-dot" d="M${xy(at(p))}h.01"/>`;
  const group = (name, markup) => `<g class="sl-${name}">${markup}</g>`;

  return { line, curve, ring, face, dot, group };
}

/** Under every run of paths goes the same run, wide and faint: a glow made of strokes alone. Faces carry their own. */
export function finish(markup) {
  return markup.replace(/<g class="sl-face">.*?<\/g>|(?:<path [^>]*\/>)+/g, (run) => {
    if (run.startsWith('<g')) return run;
    const glow = run.replace(/<path class="([^"]*)" d="([^"]*)"\/>/g, (_, c, d) => `<path${c.includes('sl-acc') ? ' class="sl-acc"' : ''} d="${d}"/>`);
    return `<g class="sl-glow">${glow}</g>${run}`;
  });
}

/** Stroke paint and the defs it needs: one gradient across the drawing, or a single ink. */
export function paint(o, box) {
  const { stops, ink } = o.palette ?? {};
  if (!stops?.length) return { stroke: ink ?? 'currentColor', defs: '' };
  const id = `slign-${o.name}-g`, last = stops.length - 1;
  const stop = stops.map((c, i) => `<stop offset="${last ? i / last : 0}" stop-color="${c}"/>`).join('');
  return {
    stroke: `url(#${id})`,
    defs: `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${box.x0}" y1="${box.y0}" x2="${box.x1}" y2="${box.y1}">${stop}</linearGradient></defs>`,
  };
}

export const baseCss = (o) =>
  '.slign{--_w:var(--slign-stroke,1.1)}' +
  '.slign .sl-l{stroke-width:var(--_w)}' +
  '.slign .sl-dot{stroke-width:calc(var(--_w)*2.2)}' +
  `.slign .sl-fill{fill:var(--slign-paper,${o.palette?.paper ?? '#ffffff'});stroke:none}` +
  '.slign .sl-glow{opacity:var(--slign-glow-opacity,.12)}' +
  '.slign .sl-halo{opacity:var(--slign-glow-opacity,.12)}' +
  '.slign .sl-glow path,.slign .sl-halo{stroke-width:var(--slign-glow,3.6)}' +
  (o.palette?.accent ? `.slign .sl-acc{stroke:var(--slign-accent,${o.palette.accent})}` : '') +
  LAYOUT;

/** A staggered opacity pulse on the named groups: on hover, and slowly at rest if `idle` is set. */
export function motionCss(o) {
  const groups = o.groups ?? [];
  if (!groups.length) return '';
  return (
    (o.idle ? groups.map((g, i) => `ROOT .sl-${g}{animation:slign-${o.name}-idle 6s ease-in-out ${delay(i * 0.6)} infinite}`).join('') : '') +
    groups.map((g, i) => `ACTIVE .sl-${g}{animation:slign-${o.name}-pulse 1.4s ease-in-out ${delay(i * 0.15)} infinite}`).join('') +
    `@keyframes slign-${o.name}-pulse{0%,100%{opacity:1}50%{opacity:.35}}` +
    (o.idle ? `@keyframes slign-${o.name}-idle{0%,100%{opacity:1}50%{opacity:.82}}` : '')
  );
}
