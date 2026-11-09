import { project } from '../scripts/pen.mjs';
import { LAYOUT, createPen as createLinePen } from './hairline.mjs';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const n = (v) => +v.toFixed(1);
const delay = (s) => `${+s.toFixed(2)}s`.replace(/^0\./, '.');
const unit = (v) => v.map((c) => c / Math.hypot(...v));
const LIGHT = unit([-0.5, -0.6, 0.8]);

/** Part of the line `p + t*d` that lies inside the convex polygon (Cyrus-Beck), or null. */
function clip(poly, p, d) {
  const area = poly.reduce((s, [x, y], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0);
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    // Inward normal of the edge, whichever way the polygon winds.
    const [nx, ny] = area > 0 ? [-(by - ay), bx - ax] : [by - ay, -(bx - ax)];
    const num = nx * (p[0] - ax) + ny * (p[1] - ay), den = nx * d[0] + ny * d[1];
    if (Math.abs(den) < 1e-12) {
      if (num < -1e-9) return null;
    } else if (den > 0) t0 = Math.max(t0, -num / den);
    else t1 = Math.min(t1, -num / den);
  }
  return t0 < t1 ? [t0, t1] : null;
}

/** Parallel segments `spacing` apart at `deg`, clipped to the convex polygon. Anchored to the origin, so faces line up. */
function sweep(poly, deg, spacing) {
  const a = (deg * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], nrm = [-d[1], d[0]];
  const off = poly.map(([x, y]) => x * nrm[0] + y * nrm[1]);
  const segs = [];
  for (let k = Math.ceil(Math.min(...off) / spacing); k <= Math.floor(Math.max(...off) / spacing); k++) {
    const p = [nrm[0] * k * spacing, nrm[1] * k * spacing], t = clip(poly, p, d);
    if (t && t[1] - t[0] > 0.5) segs.push([[p[0] + d[0] * t[0], p[1] + d[1] * t[0]], [p[0] + d[0] * t[1], p[1] + d[1] * t[1]]]);
  }
  return segs;
}

/** Hatch segments that shade a convex screen polygon: denser with tone, crossed above 0.7. */
export function hatchLines(poly, { tone = 0.5, angle = 35, spacing = lerp(5, 1.6, tone) } = {}) {
  return { main: sweep(poly, angle, spacing), cross: tone > 0.7 ? sweep(poly, angle + 90, spacing * 1.5) : [] };
}

/** Tone of a 3D polygon from its normal against the light: 0.15 lit, up to 1 turned away. */
function toneOf([a, b, c]) {
  const u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - b[i]);
  let nrm = unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
  // Face the viewer, so the order the author lists the corners in does not matter.
  if (nrm[0] + nrm[1] + nrm[2] < 0) nrm = nrm.map((v) => -v);
  return clamp(0.5 - 0.5 * nrm.reduce((s, v, i) => s + v * LIGHT[i], 0), 0.15, 1);
}

/** Engraving pen: the technical line pen plus shaded faces and stippling. */
export function createPen(seed, oy = 131, ox = 100) {
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
  const pen = createLinePen(0, oy, ox);
  const local = (pts) => pts.map((p) => project(p, 0, 0));
  const shift = ([x, y]) => `${n(x + ox)} ${n(y + oy)}`;

  /** A planar convex polygon in 3D: hatched by tone, then outlined. */
  const face = (points, o = {}) => {
    const { main, cross } = hatchLines(local(points), { tone: o.tone ?? toneOf(points), angle: o.angle });
    const stroke = (segs) => {
      if (!segs.length) return '';
      // The control point strays a little off the segment, so each line is slightly bent.
      const d = segs.map(([a, b]) => {
        const bend = rnd() * 0.012, m = [(a[0] + b[0]) / 2 + (a[1] - b[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend];
        return `M${shift(a)}Q${shift(m)} ${shift(b)}`;
      }).join('');
      return `<path class="sl-hatch" d="${d}"/>`;
    };
    return stroke(main) + stroke(cross) + pen.line(points, { closed: true });
  };

  /** `n` dots scattered inside a convex 3D polygon, as one path. */
  const stipple = (points, o = {}) => {
    const poly = local(points), xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sign = Math.sign(poly.reduce((s, [x, y], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0));
    const inside = ([x, y]) => poly.every(([ax, ay], i) => sign * ((poly[(i + 1) % poly.length][0] - ax) * (y - ay) - (poly[(i + 1) % poly.length][1] - ay) * (x - ax)) >= 0);
    let d = '';
    for (let found = 0, tries = 0; found < (o.n ?? 20) && tries < (o.n ?? 20) * 60; tries++) {
      const p = [x0 + ((rnd() + 1) / 2) * (x1 - x0), y0 + ((rnd() + 1) / 2) * (y1 - y0)];
      if (inside(p)) { d += `M${shift(p)}h.01`; found++; }
    }
    return `<path class="sl-dot" d="${d}"/>`;
  };

  return { ...pen, face, stipple };
}

export const finish = (markup) => markup;

export const paint = (o) => ({ stroke: o.palette?.ink ?? 'currentColor', defs: '' });

export const baseCss = () =>
  '.slign{--_w:var(--slign-stroke,1.4)}' +
  '.slign .sl-l{stroke-width:var(--_w)}' +
  '.slign .sl-hatch{stroke-width:calc(var(--_w)*.43)}' +
  '.slign .sl-dot{stroke-width:calc(var(--_w)*1.1)}' +
  LAYOUT;

/** Hatch of each named group fades in, one group after another, when the object is active. */
export function motionCss(o) {
  const groups = o.groups ?? [];
  if (!groups.length) return '';
  return (
    groups.map((g, i) => `ACTIVE .sl-${g} .sl-hatch{animation:slign-${o.name}-reveal .6s ease-out ${delay(i * 0.2)} backwards}`).join('') +
    `@keyframes slign-${o.name}-reveal{0%{opacity:0}100%{opacity:1}}`
  );
}
