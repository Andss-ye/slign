#!/usr/bin/env node
// Turns an object file into a self-contained Slign SVG: node draw.mjs <object.mjs> [out.svg]
import { realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPen, hinge, project } from './pen.mjs';

const LIMIT = 8192;
const KEYFRAMES = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;

/** "Active" means hovered, focused, or inside a hovered [data-slign-trigger] ancestor. */
const active = (sel) => `:is(${sel}:hover,${sel}:focus-visible,[data-slign-trigger]:hover ${sel})`;

const BASE =
  '.slign{--_w:var(--slign-stroke,3)}' +
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

/** The object's own gesture CSS, before ROOT and ACTIVE are expanded. */
export function gestureCss(o) {
  const origin = (p) => project(p, o.oy ?? 131).map((v) => `${+v.toFixed(1)}px`).join(' ');
  return (typeof o.css === 'function' ? o.css({ hinge, origin }) : o.css) ?? '';
}

/** The self-contained SVG: two passes of the same drawing plus its CSS. */
export function render(o) {
  const root = `.slign-${o.name}`;
  const css = BASE + gestureCss(o).replace(/\bACTIVE\b/g, active(root)).replace(/\bROOT\b/g, root);
  const pass = (cls, seed) => `<g class="${cls}">${o.draw(createPen(seed, o.oy ?? 131))}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="slign slign-${o.name}" role="img" aria-label="${o.label}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
    `<style>${css}</style><g class="sl-hop">${pass('sl-a', 7)}${pass('sl-b', 91)}</g></svg>`;
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

async function main([src, out]) {
  if (!src) {
    console.error('usage: node draw.mjs <object.mjs> [out.svg]');
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
  const file = out ? resolve(out) : resolve(dirname(src), `${o.name}.svg`);
  writeFileSync(file, svg + '\n');
  console.log(`${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
  return 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
