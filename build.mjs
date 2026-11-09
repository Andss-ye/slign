// Regenerates every example SVG and the local preview: node build.mjs
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { check } from './skills/slign/scripts/draw.mjs';

const figures = [];

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
    writeFileSync(new URL(`${o.name}.svg`, dir), svg + '\n');
    const kb = (Buffer.byteLength(svg) / 1024).toFixed(1);
    if (preview) figures.push(`<figure>${svg}<figcaption>${o.name} · ${kb} KB</figcaption></figure>`);
    console.log(`${o.name}  ${kb} KB`);
  }
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
