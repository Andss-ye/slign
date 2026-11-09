#!/usr/bin/env node
// Turns an object file into a self-contained Slign SVG: node draw.mjs <object.mjs> [out.svg] [--jsx] [--swift] [--into page]
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPen, hinge, project } from './pen.mjs';
import * as engrave from '../pens/engrave.mjs';
import * as hairline from '../pens/hairline.mjs';

const LIMIT = 8192;
// The paper an engraved face is filled with is the one fill allowed.
const PAPER_FILL = /\.sl-fill\{fill:var\(--slign-paper,#[0-9a-f]{3,8}\);stroke:none\}/i;
const STYLE_LIMIT = { warn: 60 * 1024, fail: 120 * 1024 };
// The pens beyond hand ink; each exports createPen, finish, paint, baseCss and motionCss.
const STYLES = { hairline, engrave };
const styleOf = (o) => o.style ?? 'ink';
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
  const marks = (STYLES[styleOf(o)] ? [0] : SEEDS).map((s) => o.draw((STYLES[styleOf(o)]?.createPen ?? createPen)(s, oy))).join('');
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
  const own = (typeof o.css === 'function' ? o.css({ hinge, origin }) : o.css) ?? '';
  return own + (STYLES[styleOf(o)]?.motionCss(o) ?? '');
}

/** The self-contained SVG of a non-ink style: one crisp pass, one paint, its CSS. */
function renderStyled(o, f, pens) {
  const root = `.slign-${o.name}`, box = { x0: PAD.side, y0: PAD.top, x1: f.w - PAD.side, y1: f.h - PAD.bottom };
  const css = pens.baseCss(o) + gestureCss(o, f).replace(/\bACTIVE\b/g, active(root)).replace(/\bROOT\b/g, root);
  const { stroke, defs } = pens.paint(o, box);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" class="slign slign-${o.name}" role="img" aria-label="${o.label}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    `${defs}<style>${css}</style>${pens.finish(o.draw(pens.createPen(0, f.oy, f.ox)))}</svg>`;
}

/** The self-contained SVG: two passes of the same drawing plus its CSS. */
export function render(o) {
  const f = frame(o), root = `.slign-${o.name}`;
  if (STYLES[styleOf(o)]) return renderStyled(o, f, STYLES[styleOf(o)]);
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
  if (!['ink', ...Object.keys(STYLES)].includes(styleOf(o))) errors.push(`style: "${o.style}" is not a style; use ink, hairline or engrave`);
  if (errors.length) return { errors, warnings };

  const style = styleOf(o), own = gestureCss(o), svg = render(o);
  const banned = style === 'ink' ? 'linearGradient|radialGradient' : 'radialGradient';
  if (new RegExp(`<(script|image|foreignObject|text|filter|pattern|${banned})\\b`, 'i').test(svg) || /fill\s*[:=]\s*["']?(?!none)[#a-z]/i.test(style === 'engrave' ? svg.replace(PAPER_FILL, '') : svg)) {
    errors.push('ink: only strokes drawn by the pen are allowed; no fills, gradients, filters, text or scripts');
  }
  if (style !== 'ink') {
    const gradient = `slign-${o.name}-g`, wanted = style === 'hairline' && o.palette?.stops?.length ? 1 : 0;
    for (const [, id] of svg.matchAll(/\sid="([^"]*)"/g)) {
      if (id !== gradient || !wanted) errors.push(`id: the only id allowed is the gradient "${gradient}", all ids start with "slign-${o.name}-" (found "${id}")`);
    }
    if ((svg.match(/<linearGradient\b/g) ?? []).length > wanted) errors.push('ink: a hairline drawing has exactly one linearGradient, from palette.stops');
    if ([...svg.matchAll(/url\(#([^)]*)\)/g)].some(([, id]) => id !== gradient)) errors.push('ink: url(#…) may only point at the drawing gradient');
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

  const bytes = Buffer.byteLength(svg), kb = (bytes / 1024).toFixed(1);
  if (style === 'ink' && bytes > LIMIT) warnings.push(`size: ${kb} KB is over the 8 KB target; drop detail`);
  if (style !== 'ink' && bytes > STYLE_LIMIT.fail) errors.push(`size: ${kb} KB is over the 120 KB limit; drop detail`);
  else if (style !== 'ink' && bytes > STYLE_LIMIT.warn) warnings.push(`size: ${kb} KB is over the 60 KB target; drop detail`);
  if (style === 'ink' && !/class="[^"]*\bsl-eye\b/.test(svg)) warnings.push('face: no eyes; leave them out only if a face hurts this drawing');
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
    .replace(/stop-color=/g, 'stopColor=')
    .replace(/<style>(.*?)<\/style>/s, '<style>{`$1`}</style>');
  return `export default function ${component}({ className = '', ...props }) {\n  return (${body});\n}`;
}

/** The drawing as a SwiftUI view: the first ink pass only, stroked in one color. */
export function toSwift(svg, name) {
  const type = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  const [w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1);
  const label = svg.match(/aria-label="([^"]*)"/)[1];
  let pass = svg.slice(svg.indexOf('<g class="sl-a">'), svg.indexOf('<g class="sl-b">'));
  // Parts the CSS hides at rest belong to the gesture, so they are not drawn.
  for (const [, sel] of svg.matchAll(/([^{}]+)\{opacity:0[;}]/g)) {
    for (const [, part] of sel.matchAll(/\.(sl-[\w-]+)/g)) {
      pass = pass.replace(new RegExp(`<g class="${part}">.*?</g>`, 's'), '');
    }
  }
  const rows = [...pass.matchAll(/<path class="([^"]*)" d="([^"]*)"/g)].map(([, cls, d]) => {
    const kind = cls.includes('sl-eye') ? 2 : cls.includes('sl-thin') ? 1 : 0;
    const pts = d.replace(/h\.01/, '').match(/-?\d+(\.\d+)?/g);
    return `        (${kind}, [${pts.join(', ')}]),`;
  });
  return `// Generated by Slign. Strokes are in a ${w}x${h} space and scale to fit.
import SwiftUI

struct ${type}: View {
    var ink: Color = .primary
    var weight: CGFloat = 3

    // (0 line, 1 thin, 2 eye, points: move, then quad control and end pairs; one point is a dot)
    private static let strokes: [(Int, [CGFloat])] = [
${rows.join('\n')}
    ]

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width / ${w}, size.height / ${h})
            for (kind, p) in Self.strokes {
                var path = Path()
                path.move(to: CGPoint(x: p[0], y: p[1]))
                if p.count == 2 { path.addLine(to: CGPoint(x: p[0] + 0.01, y: p[1])) }
                for i in stride(from: 2, to: p.count - 3, by: 4) {
                    path.addQuadCurve(to: CGPoint(x: p[i + 2], y: p[i + 3]), control: CGPoint(x: p[i], y: p[i + 1]))
                }
                let width = weight * [1, 0.67, 1.5][kind] * scale
                context.stroke(path.applying(.init(scaleX: scale, y: scale)), with: .color(ink),
                               style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
            }
        }
        .aspectRatio(${w} / ${h}, contentMode: .fit)
        .accessibilityLabel("${label}")
    }
}
`;
}

/** Puts the svg in a page at `<!-- slign:name -->`, or over the same drawing already there. */
export function placeInto(page, svg, name) {
  const marker = `<!-- slign:${name} -->`;
  const drawn = new RegExp(`<svg\\b[^>]*class="slign\\b[^"]*\\bslign-${name}\\b[^"]*"[\\s\\S]*?</svg>`);
  if (page.includes(marker)) return page.replace(marker, () => svg);
  if (drawn.test(page)) return page.replace(drawn, () => svg);
  return null;
}

const USAGE = 'usage: node draw.mjs <object.mjs> [out.svg] [--jsx] [--swift] [--into page]';

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const jsx = args.includes('--jsx'), swift = args.includes('--swift');
  const at = args.indexOf('--into');
  const into = at >= 0 ? args[at + 1] : null;
  const [src, out] = args.filter((a, i) => a !== '--jsx' && a !== '--swift' && (at < 0 || (i !== at && i !== at + 1)));
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
  if (swift && styleOf(o) !== 'ink') {
    console.error('error    --swift supports only the ink style');
    return 1;
  }
  if (into) {
    const page = placeInto(readFileSync(into, 'utf8'), svg, o.name);
    if (page === null) {
      console.error(`error    ${into}: add <!-- slign:${o.name} --> where the drawing goes`);
      return 1;
    }
    writeFileSync(into, page);
    console.log(`${into}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
    if (!out && !jsx && !swift) return 0;
  }
  const file = out ? resolve(out) : resolve(dirname(src), `${o.name}.svg`);
  writeFileSync(file, svg + '\n');
  console.log(`${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
  if (jsx) {
    const jsxFile = file.replace(/\.svg$/, '') + '.jsx';
    writeFileSync(jsxFile, toJsx(svg, o.name) + '\n');
    console.log(jsxFile);
  }
  if (swift) {
    const swiftFile = file.replace(/\.svg$/, '') + '.swift';
    writeFileSync(swiftFile, toSwift(svg, o.name));
    console.log(swiftFile);
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
