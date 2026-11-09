#!/usr/bin/env node
// Turns an object file into a self-contained Slign SVG: node draw.mjs <object.mjs> [out.svg] [--jsx] [--into page]
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPen, hinge, project } from './pen.mjs';

const LIMIT = 8192;
const KEYFRAMES = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
const PAD = { top: 14, side: 8, bottom: 6 };
const SEEDS = [7, 91];

/** "Active" means hovered, carrying .slign-active, or inside a [data-slign-trigger] that is hovered, focused or pressed. */
const active = (sel) =>
  `:is(${sel}:hover,${sel}.slign-active,[data-slign-trigger]:hover ${sel},[data-slign-trigger]:focus-within ${sel},[data-slign-trigger]:active ${sel})`;

const BASE =
  '.slign{--_w:var(--slign-stroke,3);max-width:100%;height:auto;overflow:visible}' +
  '.slign:not([width]){width:var(--slign-size,8em)}' +
  '.slign .sl-l,.slign .sl-dot{stroke-width:var(--_w)}' +
  '.slign .sl-thin{stroke-width:calc(var(--_w)*.67)}' +
  '.slign .sl-eye{stroke-width:calc(var(--_w)*1.5);transform-box:fill-box;transform-origin:center;animation:slign-blink 5.2s infinite}' +
  '.slign .sl-b{opacity:0}' +
  '.slign .sl-hop{transition:transform .45s cubic-bezier(.34,1.56,.64,1)}' +
  `${active('.slign')} .sl-hop{transform:translateY(-3px)}` +
  `${active('.slign')} .sl-a{animation:slign-boil-a .34s step-end infinite}` +
  `${active('.slign')} .sl-b{animation:slign-boil-b .34s step-end infinite}` +
  '@keyframes slign-boil-a{0%{opacity:1}50%{opacity:0}}' +
  '@keyframes slign-boil-b{0%{opacity:0}50%{opacity:1}}' +
  '@keyframes slign-blink{0%,93%,100%{transform:none}96.5%{transform:scaleY(.12)}}' +
  '@media (prefers-reduced-motion:reduce){.slign *{animation:none!important;transition:none!important}}';

/** Anchor and canvas size that crop the drawing tightly, keeping room above it for the gesture. */
function frame(o) {
  const oy = o.oy ?? 131, xs = [], ys = [];
  const marks = SEEDS.map((s) => o.draw(createPen(s, oy))).join('');
  for (const [, d] of marks.matchAll(/ d="([^"]+)"/g)) {
    const n = d.replace(/h\.01/g, '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
  }
  if (!xs.length) return { ox: 100, oy, w: 200, h: 200 };
  const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys));
  return {
    ox: 100 - x0 + PAD.side,
    oy: oy - y0 + PAD.top,
    w: Math.ceil(Math.max(...xs)) - x0 + 2 * PAD.side,
    h: Math.ceil(Math.max(...ys)) - y0 + PAD.top + PAD.bottom,
  };
}

/** The object's own gesture CSS, before ROOT and ACTIVE are expanded. */
export function gestureCss(o, f = frame(o)) {
  const origin = (p) => project(p, f.oy, f.ox).map((v) => `${+v.toFixed(1)}px`).join(' ');
  return (typeof o.css === 'function' ? o.css({ hinge, origin }) : o.css) ?? '';
}

/** The self-contained SVG: two passes of the same drawing plus its CSS. */
export function render(o) {
  const f = frame(o), root = `.slign-${o.name}`;
  const css = BASE + gestureCss(o, f).replace(/\bACTIVE\b/g, active(root)).replace(/\bROOT\b/g, root);
  const pass = (cls, seed) => `<g class="${cls}">${o.draw(createPen(seed, f.oy, f.ox))}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" class="slign slign-${o.name}" role="img" aria-label="${o.label}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
    `<style>${css}</style><g class="sl-hop">${pass('sl-a', SEEDS[0])}${pass('sl-b', SEEDS[1])}</g></svg>`;
}

/** Style rules a machine can verify. Errors block the output; warnings do not. */
export function check(o) {
  const errors = [], warnings = [];
  if (!/^[a-z][a-z0-9-]*$/.test(o.name ?? '')) errors.push('name: export a kebab-case `name`, for example "router"');
  if (!o.label) errors.push('label: export a human-readable `label`; it becomes the aria-label');
  if (typeof o.draw !== 'function') errors.push('draw: export a `draw(pen)` function that returns the markup');
  if (errors.length) return { errors, warnings };

  const own = gestureCss(o), svg = render(o);
  if (/<(script|image|foreignObject|text|filter|linearGradient|radialGradient|pattern)\b/i.test(svg) || /fill\s*[:=]\s*["']?(?!none)[#a-z]/i.test(svg)) {
    errors.push('ink: only strokes drawn by the pen are allowed; no fills, gradients, filters, text or scripts');
  }
  for (const [, frames, body] of own.matchAll(KEYFRAMES)) {
    if (!frames.startsWith(`slign-${o.name}-`)) errors.push(`scope: name keyframes "slign-${o.name}-…" so two objects never clash (found "${frames}")`);
    for (const [, prop] of body.matchAll(/[{;]\s*([a-z-]+)\s*:/g)) {
      if (prop !== 'transform' && prop !== 'opacity') errors.push(`motion: animate only transform and opacity (found "${prop}" in ${frames})`);
    }
  }
  for (const [, list] of own.matchAll(/transition\s*:\s*([^;}]+)/g)) {
    for (const part of list.replace(/\([^)]*\)/g, '').split(',')) {
      const prop = part.trim().split(/\s+/)[0];
      if (prop !== 'transform' && prop !== 'opacity') errors.push(`motion: transition only transform and opacity (found "${prop}")`);
    }
  }
  for (const [, sel] of own.replace(KEYFRAMES, '').matchAll(/(?:^|\})\s*([^{}]+)\{/g)) {
    if (!/^(ROOT|ACTIVE)\b/.test(sel.trim())) errors.push(`scope: start every selector with ROOT or ACTIVE (found "${sel.trim()}")`);
  }

  if (Buffer.byteLength(svg) > LIMIT) warnings.push(`size: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB is over the 8 KB target; drop detail`);
  if (!/class="[^"]*\bsl-eye\b/.test(svg)) warnings.push('face: no eyes; leave them out only if a face hurts this drawing');
  if (!/\bACTIVE\b/.test(own)) warnings.push('gesture: nothing happens on hover; give the object its own gesture');
  return { errors, warnings, svg };
}

/** The same drawing as a React component module; extra classes and props pass through. */
export function toJsx(svg, name) {
  const component = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  const body = svg
    .replace(' xmlns="http://www.w3.org/2000/svg"', '')
    .replace(`class="slign slign-${name}"`, `className={\`slign slign-${name} \${className}\`} {...props}`)
    .replace(/class=/g, 'className=')
    .replace(/stroke-line(cap|join)=/g, 'strokeLine$1=')
    .replace(/<style>(.*?)<\/style>/s, '<style>{`$1`}</style>');
  return `export default function ${component}({ className = '', ...props }) {\n  return (${body});\n}`;
}

/** Puts the svg in a page at `<!-- slign:name -->`, or over the same drawing already there. */
export function placeInto(page, svg, name) {
  const marker = `<!-- slign:${name} -->`;
  const drawn = new RegExp(`<svg\\b[^>]*class="slign\\b[^"]*\\bslign-${name}\\b[^"]*"[\\s\\S]*?</svg>`);
  if (page.includes(marker)) return page.replace(marker, () => svg);
  if (drawn.test(page)) return page.replace(drawn, () => svg);
  return null;
}

const USAGE = 'usage: node draw.mjs <object.mjs> [out.svg] [--jsx] [--into page]';

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const jsx = args.includes('--jsx');
  const at = args.indexOf('--into');
  const into = at >= 0 ? args[at + 1] : null;
  const [src, out] = args.filter((a, i) => a !== '--jsx' && (at < 0 || (i !== at && i !== at + 1)));
  if (!src || (at >= 0 && !into)) {
    console.error(USAGE);
    return 2;
  }
  let o;
  try {
    o = await import(pathToFileURL(resolve(src)).href);
  } catch (e) {
    console.error(`could not load ${src}: ${e.message}`);
    return 1;
  }
  const { errors, warnings, svg } = check(o);
  for (const w of warnings) console.error(`warning  ${w}`);
  for (const e of errors) console.error(`error    ${e}`);
  if (errors.length) return 1;
  if (into) {
    const page = placeInto(readFileSync(into, 'utf8'), svg, o.name);
    if (page === null) {
      console.error(`error    ${into}: add <!-- slign:${o.name} --> where the drawing goes`);
      return 1;
    }
    writeFileSync(into, page);
    console.log(`${into}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
    if (!out && !jsx) return 0;
  }
  const file = out ? resolve(out) : resolve(dirname(src), `${o.name}.svg`);
  writeFileSync(file, svg + '\n');
  console.log(`${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
  if (jsx) {
    const jsxFile = file.replace(/\.svg$/, '') + '.jsx';
    writeFileSync(jsxFile, toJsx(svg, o.name) + '\n');
    console.log(jsxFile);
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
