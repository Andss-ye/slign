// Photographs a page section, optionally with a Slign drawing placed in it.
// node page.mjs <url|file.html> --text "<text>" | --target "<css>" --out <png> [--svg <drawing.svg>]
//   [--at before|after|replace] [--ink <color>] [--size <em>] [--size-px WxH]
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

const SCROLL_MARGIN = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OPTIONS = ['text', 'target', 'out', 'svg', 'at', 'ink', 'size', 'size-px'];

/** CLI arguments -> options; throws a one-line message on bad input. */
export function parseArgs(argv) {
  const o = { at: 'before', width: 1280, height: 900 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(.+)$/.exec(argv[i]);
    if (!m) { rest.push(argv[i]); continue; }
    if (!OPTIONS.includes(m[1])) throw new Error(`unknown option --${m[1]}`);
    if (argv[i + 1] === undefined) throw new Error(`--${m[1]} needs a value`);
    const v = argv[++i];
    if (m[1] === 'size-px') {
      const s = /^(\d+)x(\d+)$/.exec(v);
      if (!s) throw new Error('--size-px must look like 1280x900');
      [o.width, o.height] = [+s[1], +s[2]];
    } else if (m[1] === 'size') {
      if (!(+v > 0)) throw new Error('--size must be a number of em');
      o.size = +v;
    } else o[m[1]] = v;
  }
  [o.url] = rest;
  if (!o.url) throw new Error('usage: node page.mjs <url|file.html> --text "<text>" --out <png> [--svg f] [--at before|after|replace]');
  if (!o.text && !o.target) throw new Error('give --text or --target');
  if (!o.out) throw new Error('give --out <png>');
  if (!['before', 'after', 'replace'].includes(o.at)) throw new Error('--at must be before, after or replace');
  return o;
}

/** Runs in the page: finds the element and returns where to scroll, before anything is injected. */
function locate({ text, target, margin }) {
  const visible = (e) => e.getClientRects().length > 0;
  let el;
  if (target) {
    el = [...document.querySelectorAll(target)].find(visible);
    if (!el) return { error: `no element matches "${target}"` };
  } else {
    const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(text);
    // The most specific match wins: a <li> that holds the heading loses to the heading.
    el = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,li,figure')]
      .filter((e) => visible(e) && norm(e.textContent).includes(want))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!el) return { error: `no element contains "${text}"` };
  }
  document.documentElement.style.scrollBehavior = 'auto';
  window.__slignTarget = el;
  return { y: Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - margin)) };
}

/** Runs in the page: places the drawing before, after or in place of the located element. */
function inject({ svg, at, ink, size }) {
  const el = window.__slignTarget;
  const cs = getComputedStyle(el);
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const clear = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    return cx.getImageData(0, 0, 1, 1).data[3] === 0;
  };
  let bg = el;
  while (bg && clear(getComputedStyle(bg).backgroundColor)) bg = bg.parentElement;
  const rect = el.getBoundingClientRect();

  const box = document.createElement('div');
  box.setAttribute('data-slign-trigger', '');
  const style = {
    '--slign-paper': bg ? getComputedStyle(bg).backgroundColor : '#fff',
    color: ink || cs.color,
    'font-size': '16px',
  };
  if (size) style['--slign-size'] = `${size}em`;
  if (at === 'replace') {
    Object.assign(style, {
      display: cs.display.startsWith('inline') ? 'inline-grid' : 'grid',
      'place-items': 'center',
      'box-sizing': 'border-box',
      'flex-shrink': '0',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      'border-radius': cs.borderRadius,
      margin: cs.margin,
    });
  } else {
    Object.assign(style, {
      display: 'flex',
      'justify-content': cs.textAlign === 'center' ? 'center' : 'flex-start',
      margin: at === 'before' ? '0 0 1.5rem' : '1.5rem 0 0',
    });
  }
  for (const [k, v] of Object.entries(style)) box.style.setProperty(k, v);
  box.innerHTML = svg;

  if (at === 'after') el.after(box);
  else el.before(box);
  if (at === 'replace') el.style.display = 'none';

  const b = box.getBoundingClientRect();
  return {
    at,
    paper: style['--slign-paper'],
    color: style.color,
    trigger: box.hasAttribute('data-slign-trigger'),
    width: Math.round(b.width),
    height: Math.round(b.height),
    radius: box.style.borderRadius,
    replacedDisplay: at === 'replace' ? getComputedStyle(el).display : undefined,
  };
}

const call = (fn, arg) => `(${fn})(${JSON.stringify(arg)})`;

/** Waits for web fonts and images, so the photo is not taken mid-load. */
const settle = () => Promise.race([
  Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]),
  new Promise((r) => setTimeout(r, 5000)),
]);

/**
 * Photographs the section and returns a report { y, scrollY, wrapper, replacedDisplay }.
 * The scroll offset is measured before the injection, so photos with and without a drawing match.
 */
export async function shoot(opts, launcher = launch) {
  const { url, text, target, out, at = 'before', ink, size, width = 1280, height = 900 } = opts;
  const svg = opts.svg ?? '';
  if (!/^(https?|file|data|about):/.test(url) && !existsSync(url)) throw new Error(`no such file ${url}`);
  const c = await launcher({ width, height });
  try {
    await c.open(url);
    await c.evaluate(`(${settle})()`);
    const spot = await c.evaluate(call(locate, { text, target, margin: SCROLL_MARGIN }));
    if (spot.error) throw new Error(spot.error);
    const scrollTo = () => c.evaluate(`scrollTo({ top: ${spot.y}, behavior: 'instant' })`);
    const report = { y: spot.y };
    if (svg) {
      const placed = await c.evaluate(call(inject, { svg, at, ink, size }));
      const { replacedDisplay, ...wrapper } = placed;
      Object.assign(report, { wrapper, replacedDisplay });
      await c.evaluate(`(${settle})()`);
    }
    await scrollTo();
    await sleep(500);
    await scrollTo();
    await sleep(300);
    report.scrollY = Math.round(await c.evaluate('scrollY'));
    await c.screenshot(out);
    return report;
  } finally {
    await c.close();
  }
}

export async function main(args) {
  try {
    const o = parseArgs(args);
    if (o.svg) o.svg = readFileSync(o.svg, 'utf8');
    await shoot(o);
    console.log(o.out);
    return 0;
  } catch (e) {
    console.error(`error    ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
