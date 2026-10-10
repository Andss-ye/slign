// Checks what a run left behind: node evals/grade.mjs <outputs-dir>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : [p];
});

const files = walk(process.argv[2])
  .filter((p) => /\.(svg|html|tsx|jsx|vue|svelte|astro)$/.test(p) && !p.includes('_scratch'))
  .sort((a, b) => a.endsWith('.svg') - b.endsWith('.svg'));
const holder = files.map((p) => ({ p, text: readFileSync(p, 'utf8') })).find(({ text }) => /<svg[\s\S]*<\/svg>/.test(text));
const svg = holder ? holder.text.match(/<svg[\s\S]*<\/svg>/)[0] : '';
const jsx = holder ? /\.(tsx|jsx)$/.test(holder.p) : false;
const pkg = files.length ? walk(process.argv[2]).find((p) => p.endsWith('package.json')) : null;

const expect = (text, passed, evidence) => ({ text, passed: Boolean(passed), evidence });
const expectations = [
  expect('An inline SVG was produced', svg, holder ? holder.p : 'no file contains an <svg>'),
  expect('It is a single ink: strokes in currentColor', /stroke="currentColor"/.test(svg), 'looked for stroke="currentColor"'),
  expect('It has no fills, gradients, filters or scripts', svg && !/fill\s*[:=]\s*["'{]?(?!none)[#a-z]/i.test(svg) && !/<(script|filter|linearGradient|radialGradient|image)\b/i.test(svg), 'scanned the svg markup'),
  expect('It reacts on hover without JavaScript', /:hover/.test(svg) && !/onMouse|addEventListener|<script/i.test(holder?.text ?? ''), 'looked for :hover in the svg and no event handlers'),
  expect('It respects reduced motion', /prefers-reduced-motion/.test(svg), 'looked for the media query'),
  expect('It has the two alternating passes of the hand-ink line', /class(Name)?="sl-a"/.test(svg) && /class(Name)?="sl-b"/.test(svg), 'looked for the sl-a and sl-b groups'),
  expect('It has a face', /class(Name)?="[^"]*\bsl-eye\b/.test(svg), 'looked for a stroke with the sl-eye class'),
  expect('It weighs under 8 KB', svg && Buffer.byteLength(svg) <= 8192, `${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`),
  expect('It is not referenced through <img>', !files.some((p) => /<img[^>]+\.svg/.test(readFileSync(p, 'utf8'))), 'looked for <img src="….svg">'),
];
if (jsx) {
  expectations.push(expect('The JSX is valid: className and camelCase attributes', !/\sclass=|stroke-linecap=|stroke-linejoin=/.test(svg), 'looked for class= and kebab-case attributes'));
  expectations.push(expect('It stays a server component', !/["']use client["']/.test(holder.text), 'looked for "use client"'));
}
if (pkg) {
  const deps = Object.keys(JSON.parse(readFileSync(pkg, 'utf8')).dependencies ?? {});
  expectations.push(expect('No dependency was added', deps.length <= 3, deps.join(', ')));
}

console.log(JSON.stringify({ expectations }, null, 2));
