// Reads a page's visual style and prints it as one JSON line: node sense.mjs <url|file.html> [--out profile.png]
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, launch } from './chrome.mjs';

/** Runs inside the page: measures computed styles and returns the profile. */
async function inPage() {
  const vw = innerWidth;
  const vh = innerHeight;
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  // Any CSS color syntax -> [r, g, b, a], resolved by painting one pixel.
  const rgba = (s) => {
    if (!cache.has(s)) {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000';
      cx.fillStyle = s;
      cx.fillRect(0, 0, 1, 1);
      cache.set(s, [...cx.getImageData(0, 0, 1, 1).data]);
    }
    return cache.get(s);
  };
  const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const hsl = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((v) => v / 255);
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    return { s, l, chroma: s * (1 - Math.abs(2 * l - 1)) };
  };
  const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);

  const all = [];
  for (const el of [document.documentElement, ...document.body.querySelectorAll('*')].slice(0, 4000)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) all.push({ el, cs, r, area: r.width * r.height });
  }
  const bg = (cs) => rgba(cs.backgroundColor);

  // Paper: body, then html, then the largest element that paints a background.
  const page = [document.body, document.documentElement].map((e) => bg(getComputedStyle(e))).find((c) => c[3] > 0);
  const biggest = all.filter((x) => bg(x.cs)[3] > 128).sort((a, b) => b.area - a.area)[0];
  const paper = page ?? (biggest ? bg(biggest.cs) : [255, 255, 255, 255]);
  const ink = rgba(getComputedStyle(document.body).color);

  // Accent: the saturated color buttons, links and badges share; else the most vivid color anywhere.
  const saturated = (c) => c[3] > 128 && hsl(c).s >= 0.35 && hsl(c).l > 0.12 && hsl(c).l < 0.92;
  const votes = new Map();
  const ui = 'button,a,[role=button],.btn,.button,.badge,.tag,.cta';
  for (const { el, cs } of all) {
    if (!el.matches(ui)) continue;
    for (const [color, weight] of [[cs.backgroundColor, 3], [cs.color, 1], [cs.borderTopColor, +(parseFloat(cs.borderTopWidth) > 0)]]) {
      const c = rgba(color);
      if (weight && saturated(c)) votes.set(hex(c), (votes.get(hex(c)) ?? 0) + weight);
    }
  }
  let accent = [...votes].sort((a, b) => b[1] - a[1] || hsl(rgba(b[0])).s - hsl(rgba(a[0])).s)[0]?.[0];
  if (!accent) {
    const seen = all.flatMap(({ cs }) => [cs.color, cs.backgroundColor, cs.borderTopColor].map(rgba)).filter(saturated);
    accent = hex(seen.sort((a, b) => hsl(b).chroma - hsl(a).chroma)[0] ?? ink);
  }

  // Gradient: stops of gradient-filled text, else of a large element's linear gradient.
  const stops = (img) => {
    const out = (img.match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}/gi) ?? []).map(rgba).filter((c) => c[3] > 0).map(hex);
    return out.filter((c, i) => c !== out[i - 1]).slice(0, 4);
  };
  const clipText = (cs) => (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
  const fills = [
    ...all.filter((x) => clipText(x.cs) && x.cs.backgroundImage.includes('gradient')),
    ...all.filter((x) => x.area > 0.3 * vw * vh && x.cs.backgroundImage.includes('linear-gradient')),
  ].map((x) => stops(x.cs.backgroundImage)).filter((s) => s.length > 1);
  const gradient = fills[0] ?? null;

  // Type: the first recognised family in the stack decides.
  const SERIF = /georgia|times|garamond|playfair|cormorant|lora|merriweather|source serif|palatino|baskerville|bodoni|didot|cambria|fraunces|crimson|spectral|newsreader|tiempos|canela|noto serif|pt serif|dm serif|instrument serif|\bserif\b/;
  const MONO = /mono|courier|menlo|consolas|jetbrains|fira code|source code|monaco|ui-monospace/;
  const kind = (stack) => {
    for (const f of stack.toLowerCase().split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))) {
      if (MONO.test(f)) return 'mono';
      if (/sans/.test(f)) return 'sans';
      if (SERIF.test(f)) return 'serif';
    }
    return 'sans';
  };
  const heading = document.querySelector('h1,h2') ?? document.body;
  const type = { head: kind(getComputedStyle(heading).fontFamily), body: kind(getComputedStyle(document.body).fontFamily) };

  // Shape: corner radius of buttons and cards, thickness of drawn borders.
  const shaped = all.filter((x) => x.el.matches('button,[role=button],[class*=btn],[class*=button],[class*=card],[class*=badge],[class*=pill],article'));
  const radius = Math.round(median(shaped.map(({ cs, r }) => {
    const v = cs.borderTopLeftRadius;
    return v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(r.width, r.height) : parseFloat(v);
  })));
  const rule = median(all.flatMap(({ cs }) => {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => !/none|hidden|inset|outset|groove|ridge/.test(cs[`border${s}Style`]));
    return sides.length ? [Math.max(...sides.map((s) => parseFloat(cs[`border${s}Width`])))] : [];
  }).filter((w) => w > 0));

  // Texture: a wide image, video or covering background makes it a photo; halftoned images show hard pixel-to-pixel jumps.
  const wide = all.filter((x) => x.r.width > 0.4 * vw);
  const covers = (x) => /url\(/.test(x.cs.backgroundImage) && (/cover|contain/.test(x.cs.backgroundSize) || (x.r.width > 0.4 * vw && x.r.height > 0.4 * vh));
  const photo = wide.filter((x) => /^(IMG|PICTURE|VIDEO)$/.test(x.el.tagName)).sort((a, b) => b.area - a.area)[0] ?? wide.find(covers);
  let grain;
  if (photo) {
    try {
      const tag = photo.el.tagName;
      const img = tag === 'IMG' ? photo.el : tag === 'PICTURE' ? photo.el.querySelector('img') : tag === 'VIDEO' ? null : Object.assign(new Image(), { src: photo.cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1] });
      await Promise.race([img.decode(), new Promise((_, no) => setTimeout(no, 3000))]);
      const n = Math.min(256, img.naturalWidth, img.naturalHeight);
      const c = Object.assign(document.createElement('canvas'), { width: n, height: n });
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, (img.naturalWidth - n) / 2, (img.naturalHeight - n) / 2, n, n, 0, 0, n, n);
      const d = g.getImageData(0, 0, n, n).data;
      let jump = 0;
      let count = 0;
      for (let y = 0; y < n; y++) for (let x = 1; x < n; x++) {
        const i = (y * n + x) * 4;
        const lum = (k) => 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
        jump += Math.abs(lum(i) - lum(i - 4));
        count++;
      }
      grain = jump / count > 9;
    } catch {} // cross-origin or undecodable: leave grain out
  }

  // Density: share of the first viewport covered by text lines.
  let text = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const cs = n.parentElement && getComputedStyle(n.parentElement);
    if (!n.nodeValue.trim() || !cs || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      text += Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    }
  }
  const share = text / (vw * vh);

  return {
    theme: 0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2] < 128 ? 'dark' : 'light',
    paper: hex(paper),
    ink: hex(ink),
    accent,
    gradient,
    type,
    radius,
    rule,
    texture: photo ? 'photo' : 'flat',
    ...(grain === undefined ? {} : { grain }),
    density: share < 0.12 ? 'airy' : share < 0.28 ? 'balanced' : 'dense',
  };
}

/** Profile of the page already open in a chrome.mjs session. */
export const profileOf = (chrome) => chrome.evaluate(`(${inPage})()`);

export async function main(args) {
  const outAt = args.indexOf('--out');
  const out = outAt >= 0 ? args.splice(outAt, 2)[1] : join(tmpdir(), 'slign-sense.png');
  if (out === undefined || out.startsWith('--')) {
    console.error('error    --out needs a path');
    return 1;
  }
  const [src] = args;
  if (!src) {
    console.error('usage: node sense.mjs <url|file.html> [--out profile.png]');
    return 1;
  }
  if (!findChrome()) {
    console.error('error    Chrome not found: install it or set CHROME to its path');
    return 1;
  }
  let chrome;
  try {
    chrome = await launch();
    await chrome.open(src);
    const profile = await profileOf(chrome);
    await chrome.screenshot(resolve(out));
    console.log(JSON.stringify(profile));
    return 0;
  } catch (e) {
    console.error(`error    ${String(e.message).split('\n')[0]}`);
    return 1;
  } finally {
    await chrome?.close();
  }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
