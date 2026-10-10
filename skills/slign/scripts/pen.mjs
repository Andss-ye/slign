const ISO = Math.cos(Math.PI / 6);
const OX = 100;
const n = (v) => +v.toFixed(1);
const xy = ([x, y]) => `${n(x)} ${n(y)}`;
const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);

/** Isometric projection of a 3D direction: x recedes right, y recedes left, z is up. */
export const projectVector = ([x, y, z]) => [(x - y) * ISO, (x + y) / 2 - z];

/** Screen position of a 3D point on the 200x200 canvas. */
export const project = (p, oy = 131) => {
  const [sx, sy] = projectVector(p);
  return [OX + sx, oy + sy];
};

/**
 * CSS matrix for a flat part turning `deg` around `axis`.
 * `up` is any direction that lies on the part, across the axis.
 */
export function hinge({ axis, up, deg }) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const len = Math.hypot(...axis), a = axis.map((v) => v / len);
  const cross = [a[1] * up[2] - a[2] * up[1], a[2] * up[0] - a[0] * up[2], a[0] * up[1] - a[1] * up[0]];
  const dot = a[0] * up[0] + a[1] * up[1] + a[2] * up[2];
  const turned = up.map((v, i) => v * c + cross[i] * s + a[i] * dot * (1 - c));
  const [ux, uy] = projectVector(a), [vx, vy] = projectVector(up), [wx, wy] = projectVector(turned);
  const det = ux * vy - vx * uy;
  const m = [(ux * vy - wx * uy) / det, (uy * vy - wy * uy) / det, (wx * ux - ux * vx) / det, (wy * ux - uy * vx) / det];
  return `matrix(${m.map((v) => +v.toFixed(3) || 0).join(',')},0,0)`;
}

/**
 * Hand-ink pen over the isometric projection.
 * Each seed gives a different pulse of the same drawing.
 */
export function createPen(seed, oy = 131) {
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
  const at = (p, jitter) => {
    const [x, y] = project(p, oy);
    return [x + rnd() * jitter, y + rnd() * jitter];
  };
  const cls = (base, o) => [base, o.thin && 'sl-thin', o.cls].filter(Boolean).join(' ');

  /** Straight-ish strokes through 3D points, with sharp corners. */
  const line = (points, o = {}) => {
    const all = o.closed ? [...points, points[0]] : points;
    let d = `M${xy(at(all[0], 1.3))}`;
    for (let i = 1; i < all.length; i++) d += `Q${xy(at(mid(all[i - 1], all[i]), 1.3))} ${xy(at(all[i], 1.3))}`;
    return `<path class="${cls('sl-l', o)}" d="${d}"/>`;
  };

  /** One smooth stroke through three or more 3D points. */
  const curve = (points, o = {}) => {
    const p = points.map((q) => at(q, 1.1));
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
   * Circle or arc. Horizontal by default: 0 degrees points along +x, 90 along +y.
   * With plane 'xz' or 'yz' it stands upright: 0 points along x or y, 90 points up.
   */
  const ring = ([cx, cy, z], r, o = {}) => {
    const from = o.from ?? 0, to = o.to ?? 360, full = to - from >= 360;
    const steps = Math.max(3, Math.ceil((to - from) / 30)), pts = [];
    for (let i = 0; i < (full ? steps : steps + 1); i++) {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
      const u = r * Math.cos(a), v = r * Math.sin(a);
      pts.push(o.plane === 'xz' ? [cx + u, cy, z + v] : o.plane === 'yz' ? [cx, cy + u, z + v] : [cx + u, cy + v, z]);
    }
    return curve(pts, { ...o, closed: full });
  };

  const dot = (p) => `<path class="sl-dot" d="M${xy(at(p, 0.8))}h.01"/>`;
  const eye = ([x, y, z], h = 8) => line([[x, y, z + h / 2], [x, y, z - h / 2]], { cls: 'sl-eye' });
  const group = (name, markup) => `<g class="sl-${name}">${markup}</g>`;

  return { line, curve, ring, dot, eye, group };
}
