// Regenerates every example SVG and the local preview: node build.mjs
// With --readme [dir] it writes the README images (default docs/img) instead.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { check } from './skills/slign/scripts/draw.mjs';

const samples = new URL('skills/slign/pens/samples/', import.meta.url);
const argv = process.argv.slice(2);
const readme = argv.includes('--readme');
const figures = [];
const inks = [];

// Ink and paper baked in, and the pale end of the hairline gradient darkened on white: an SVG shown through <img> cannot inherit currentColor.
const THEMES = {
  light: { ink: '#2a17d4', paper: '#ffffff', glow: '#0a8fb8' },
  dark: { ink: '#c9c6ff', paper: '#0d1117', glow: '#8be9ff' },
};
const bake = (svg, t) => svg
  .replace('stroke="currentColor"', `stroke="${t.ink}"`)
  .replace('#8be9ff', t.glow)
  .replace(/var\(--slign-paper,#[0-9a-f]+\)/gi, t.paper);
const num = (n) => +n.toFixed(2);

/** A drawing placed at (x, y) with height h inside a larger SVG; its CSS is scoped to its own class. */
function nest(svg, x, y, h, gradient) {
  const [, name] = svg.match(/class="slign slign-([\w-]+)"/);
  const [, w, vh] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const paint = svg.match(/fill="none" stroke="[^"]*" stroke-linecap="round" stroke-linejoin="round"/)[0];
  let inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
    .replace(/<style>.*?<\/style>/s, (css) => css.replace(/\.slign(?![-\w])/g, `.slign-${name}`));
  let attrs = paint;
  if (gradient) {
    inner = inner.replaceAll(`slign-${name}-g`, gradient);
    attrs = attrs.replaceAll(`slign-${name}-g`, gradient);
  }
  const label = svg.match(/aria-label="([^"]*)"/)[1];
  return `<svg x="${num(x)}" y="${num(y)}" width="${num((w * h) / vh)}" height="${h}" viewBox="0 0 ${w} ${vh}" overflow="visible" role="img" aria-label="${label}" ${attrs}>` +
    `<g class="slign slign-${name}">${inner}</g></svg>`;
}

/** The banner: the ink examples in a row, the two other styles beneath. */
function hero(theme, rows) {
  const t = THEMES[theme], W = 1200, H = 420;
  const place = (items, y, h, gap) => {
    const widths = items.map((s) => {
      const [, w, vh] = s.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
      return (w * h) / vh;
    });
    let x = (W - widths.reduce((a, b) => a + b, 0) - gap * (items.length - 1)) / 2;
    return items.map((s, i) => {
      const out = nest(bake(s, t), x, y, h, `hero-${theme}-g`);
      x += widths[i] + gap;
      return out;
    }).join('');
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Slign illustrations in ink, hairline and engraved styles">` +
    `<rect width="100%" height="100%" fill="${t.paper}"/>` +
    place(rows[0], 22, 140, 22) + place(rows[1], 190, 200, 110) + '</svg>';
}

// Icons share names with illustrations (bell), so only the illustrations go in the preview.
for (const [folder, preview] of [['skills/slign/examples/', true], ['skills/slign/examples/icons/', false]]) {
  const dir = new URL(folder, import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const o = await import(new URL(file, dir));
    const { errors, warnings, svg } = check(o);
    for (const w of warnings) console.error(`${file}  warning  ${w}`);
    if (errors.length) {
      console.error(`${file}\n  ${errors.join('\n  ')}`);
      process.exit(1);
    }
    if (preview) inks.push(svg);
    if (readme) continue;
    writeFileSync(new URL(`${o.name}.svg`, dir), svg + '\n');
    const kb = (Buffer.byteLength(svg) / 1024).toFixed(1);
    if (preview) figures.push(`<figure>${svg}<figcaption>${o.name} · ${kb} KB</figcaption></figure>`);
    console.log(`${o.name}  ${kb} KB`);
  }
}

if (readme) {
  const out = pathToFileURL(resolve(argv[argv.indexOf('--readme') + 1] ?? 'docs/img') + '/');
  mkdirSync(out, { recursive: true });
  const rows = [inks, []];
  for (const f of ['hairline-cube', 'engrave-cube']) {
    const o = await import(new URL(`${f}.mjs`, samples));
    const { errors, svg } = check(o);
    if (errors.length) {
      console.error(`${f}\n  ${errors.join('\n  ')}`);
      process.exit(1);
    }
    rows[1].push(svg);
  }
  for (const theme of Object.keys(THEMES)) {
    for (const svg of inks) {
      writeFileSync(new URL(`${svg.match(/slign-([\w-]+)"/)[1]}-${theme}.svg`, out), bake(svg, THEMES[theme]) + '\n');
    }
    writeFileSync(new URL(`hero-${theme}.svg`, out), hero(theme, rows) + '\n');
  }
  process.exit(0);
}

mkdirSync(new URL('preview/', import.meta.url), { recursive: true });
writeFileSync(new URL('preview/index.html', import.meta.url), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slign preview</title>
<style>
:root { --ink: #2a17d4; --paper: #dedede; }
:root:has(#dark:checked) { --ink: #ededed; --paper: #121214; }
body { margin: 0; padding: 32px; background: var(--paper); color: var(--ink); font: 14px/1.4 ui-monospace, Menlo, monospace; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; margin-top: 24px; }
figure { margin: 0; text-align: center; }
figure svg { width: 100%; height: auto; cursor: pointer; }
</style>
<label><input type="checkbox" id="dark"> dark</label>
<main>${figures.join('')}</main>
</html>
`);
