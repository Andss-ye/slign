import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, render } from '../skills/slign/scripts/draw.mjs';
import { hatchLines } from '../skills/slign/pens/engrave.mjs';

const DRAW = fileURLToPath(new URL('../skills/slign/scripts/draw.mjs', import.meta.url));
const SQUARE = [[0, 0], [40, 0], [40, 40], [0, 40]];

const hairline = (extra = {}) => ({
  name: 'hl',
  label: 'Wire',
  style: 'hairline',
  palette: { stops: ['#4f8cff', '#9be7ff'] },
  groups: ['a', 'b'],
  draw: (pen) =>
    pen.group('a', pen.line([[0, 0, 0], [30, 0, 0], [30, 30, 0]], { closed: true })) +
    pen.group('b', pen.ring([15, 15, 0], 8) + pen.dot([15, 15, 20])),
  ...extra,
});

const engrave = (extra = {}) => ({
  name: 'et',
  label: 'Slab',
  style: 'engrave',
  groups: ['top', 'side'],
  draw: (pen) =>
    pen.group('top', pen.face([[0, 0, 20], [30, 0, 20], [30, 30, 20], [0, 30, 20]], { tone: 0.3 })) +
    pen.group('side', pen.face([[30, 0, 0], [30, 30, 0], [30, 30, 20], [30, 0, 20]], { tone: 0.8 }) + pen.stipple([[0, 30, 0], [30, 30, 0], [30, 30, 20], [0, 30, 20]], { n: 20 })),
  ...extra,
});

const count = (svg, re) => (svg.match(re) ?? []).length;
const lengthOf = (segs) => segs.length;

test('a hairline render scopes its gradient, classes and keyframes to the object', () => {
  const svg = render(hairline());
  assert.ok(svg.includes('<linearGradient id="slign-hl-g" gradientUnits="userSpaceOnUse"'));
  assert.ok(svg.includes('stroke="url(#slign-hl-g)"'));
  assert.ok(svg.includes('#4f8cff') && svg.includes('#9be7ff'));
  assert.deepEqual([...svg.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]), ['slign-hl-g']);
  assert.ok(svg.includes(':is(.slign-hl:hover') && svg.includes('@keyframes slign-hl-pulse'));
  assert.ok(!/\bROOT\b|\bACTIVE\b/.test(svg) && !svg.includes('sl-eye') && !svg.includes('boil'));
  assert.ok(svg.includes('prefers-reduced-motion'));
});

test('hairline without stops strokes in currentColor and draws no gradient', () => {
  const svg = render(hairline({ palette: undefined }));
  assert.ok(svg.includes('stroke="currentColor"') && !svg.includes('linearGradient'));
});

test('every hairline path is drawn twice: a faint wide glow under the crisp line', () => {
  const svg = render(hairline());
  const crisp = count(svg, /<path class="sl-(l|dot)"/g);
  assert.ok(crisp > 0);
  assert.equal(count(svg, /<g class="sl-glow">/g), 2);
  assert.equal(count(svg, /<path d="/g), crisp);
  assert.ok(svg.includes('.sl-glow{opacity:.12}') && svg.includes('.sl-glow path{stroke-width:calc(var(--_w)*4)}'));
});

test('hairline straight segments stay straight and rings are polylines', () => {
  const svg = render(hairline());
  const lines = [...svg.matchAll(/class="sl-l" d="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lines.every((d) => /^M[\d. -]+(L[\d. -]+)+Z?$/.test(d)), lines.join('\n'));
});

test('an engrave render is one ink with hatch lines and an outline per face', () => {
  const svg = render(engrave());
  assert.ok(svg.includes('stroke="currentColor"') && !svg.includes(' id='));
  assert.equal(count(svg, /<path class="sl-l"/g), 2);
  assert.ok(count(svg, /<path class="sl-hatch"/g) >= 2);
  assert.ok(svg.includes(' .sl-top .sl-hatch{animation') && svg.includes('@keyframes slign-et-reveal'));
  assert.ok(!/\bROOT\b|\bACTIVE\b/.test(svg) && !svg.includes('sl-eye'));
});

test('engrave stroke widths: outline thicker than hatch', () => {
  const svg = render(engrave());
  assert.match(svg, /--slign-stroke,1\.4/);
  assert.match(svg, /\.sl-hatch\{stroke-width:calc\(var\(--_w\)\*\.43\)\}/);
});

test('palette ink overrides currentColor in engrave', () => {
  assert.ok(render(engrave({ palette: { ink: '#222' } })).includes('stroke="#222"'));
});

test('hatch segments never leave a convex polygon and a smaller one gets fewer lines', () => {
  const { main, cross } = hatchLines(SQUARE, { tone: 1 });
  assert.ok(main.length > 5 && cross.length > 5);
  for (const [a, b] of [...main, ...cross]) {
    for (const [x, y] of [a, b]) assert.ok(x >= -1e-6 && x <= 40 + 1e-6 && y >= -1e-6 && y <= 40 + 1e-6, `${x},${y}`);
  }
  const small = hatchLines(SQUARE.map(([x, y]) => [x / 4, y / 4]), { tone: 1 });
  assert.ok(small.main.length < main.length);
  const tri = hatchLines([[0, 0], [40, 0], [0, 40]], { tone: 0.5, angle: 0 });
  for (const [a, b] of tri.main) for (const [x, y] of [a, b]) assert.ok(x + y <= 40 + 1e-6 && x >= -1e-6 && y >= -1e-6);
  assert.deepEqual(hatchLines(SQUARE, { tone: 1 }), { main, cross });
});

test('hatch gets denser as the tone grows', () => {
  const counts = [0.1, 0.3, 0.5, 0.7].map((tone) => lengthOf(hatchLines(SQUARE, { tone }).main));
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], counts.join());
  const all = [0.2, 0.5, 0.8, 1].map((tone) => hatchLines(SQUARE, { tone }));
  const totals = all.map(({ main, cross }) => main.length + cross.length);
  for (let i = 1; i < totals.length; i++) assert.ok(totals[i] > totals[i - 1], totals.join());
});

test('hatch lines follow the requested screen direction', () => {
  for (const [a, b] of hatchLines(SQUARE, { tone: 0.5, angle: 0 }).main) assert.ok(Math.abs(a[1] - b[1]) < 1e-6);
  const [[a, b]] = hatchLines(SQUARE, { tone: 0.5, angle: 90 }).main;
  assert.ok(Math.abs(a[0] - b[0]) < 1e-6);
});

test('cross-hatch appears only above tone 0.85', () => {
  for (const tone of [0.15, 0.5, 0.85]) assert.equal(hatchLines(SQUARE, { tone }).cross.length, 0, `tone ${tone}`);
  for (const tone of [0.86, 0.95, 1]) assert.ok(hatchLines(SQUARE, { tone }).cross.length > 0, `tone ${tone}`);
  const dark = [...render(engrave()).matchAll(/class="sl-hatch" d="/g)].length;
  const light = [...render(engrave({ draw: (pen) => pen.face([[0, 0, 20], [30, 0, 20], [30, 30, 20], [0, 30, 20]], { tone: 0.3 }) })).matchAll(/class="sl-hatch" d="/g)].length;
  assert.equal(light, 1);
  assert.ok(dark > light);
});

test('face without tone is darker when turned away from the light', () => {
  const draw = (pts) => (pen) => pen.face(pts);
  const hatches = (pts) => render(engrave({ groups: [], draw: draw(pts) })).match(/class="sl-hatch" d="[^"]*"/g).join('').length;
  const top = [[0, 0, 20], [30, 0, 20], [30, 30, 20], [0, 30, 20]];
  const side = [[30, 0, 0], [30, 30, 0], [30, 30, 20], [30, 0, 20]];
  assert.ok(hatches(side) > hatches(top));
});

test('tone outside 0..1 is clamped and still hatches', () => {
  for (const tone of [5, -3]) {
    const { main } = hatchLines(SQUARE, { tone });
    assert.ok(main.length > 5 && main.length < 100, `tone ${tone}`);
  }
  assert.deepEqual(hatchLines(SQUARE, { tone: 5 }), hatchLines(SQUARE, { tone: 1 }));
  assert.deepEqual(hatchLines(SQUARE, { tone: -3 }), hatchLines(SQUARE, { tone: 0 }));
});

test('hatchLines rejects a spacing that is not positive or would draw an absurd number of lines', () => {
  for (const spacing of [0, -2, NaN, 1e-9]) assert.throws(() => hatchLines(SQUARE, { spacing }), /spacing/, `spacing ${spacing}`);
});

test('a face whose first corners are collinear takes its normal from the first real triple', () => {
  const top = [[0, 0, 20], [30, 0, 20], [30, 30, 20], [0, 30, 20]];
  const lead = [[0, 0, 20], [15, 0, 20], [30, 0, 20], [30, 30, 20], [0, 30, 20]];
  const strokes = (pts) => count(render(engrave({ groups: [], draw: (pen) => pen.face(pts) })).match(/class="sl-hatch" d="[^"]*"/)[0], /M/g);
  assert.ok(strokes(lead) > 0);
  assert.equal(strokes(lead), strokes(top));
  const line = [[0, 0, 0], [10, 0, 0], [20, 0, 0]];
  assert.throws(() => render(engrave({ groups: [], draw: (pen) => pen.face(line) })), /collinear/);
});

test('stipple draws n dots inside the polygon as one path', () => {
  const svg = render(engrave({ groups: [], draw: (pen) => pen.stipple([[0, 0, 0], [30, 0, 0], [30, 30, 0], [0, 30, 0]], { n: 25 }) }));
  const d = svg.match(/class="sl-dot" d="([^"]+)"/)[1];
  assert.equal(count(d, /h\.01/g), 25);
  assert.equal(count(svg, /class="sl-dot"/g), 1);
});

test('the same object renders to the same bytes, and the canvas fits every style', () => {
  for (const o of [hairline(), engrave()]) {
    const svg = render(o);
    assert.equal(render(o), svg);
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const pts = [...svg.matchAll(/ d="([^"]+)"/g)].flatMap(([, d]) => d.replace(/h\.01/g, '').match(/-?\d+(\.\d+)?/g).map(Number));
    for (let i = 0; i < pts.length; i += 2) assert.ok(pts[i] > 0 && pts[i] < w && pts[i + 1] > 0 && pts[i + 1] < h, `${o.style} ${pts[i]},${pts[i + 1]} in ${w}x${h}`);
  }
});

test('hairline motion pulses staggered groups on hover and only at rest when asked', () => {
  const svg = render(hairline());
  assert.match(svg, /\.sl-a\{animation:slign-hl-pulse [\d.]+s ease-in-out 0s infinite\}/);
  assert.match(svg, /\.sl-b\{animation:slign-hl-pulse [\d.]+s ease-in-out \.15s infinite\}/);
  assert.ok(!svg.includes('slign-hl-idle'));
  const idle = render(hairline({ idle: true }));
  assert.match(idle, /\.slign-hl \.sl-a\{animation:slign-hl-idle 6s /);
});

test('engrave motion reveals the hatch of each named group in sequence, visible at rest', () => {
  const svg = render(engrave());
  assert.match(svg, /\.sl-top \.sl-hatch\{animation:slign-et-reveal [\d.]+s ease-out 0s backwards\}/);
  assert.match(svg, /\.sl-side \.sl-hatch\{animation:slign-et-reveal [\d.]+s ease-out \.2s backwards\}/);
  assert.ok(!/\.sl-hatch\{opacity:0/.test(svg));
});

test('style defaults to ink and ink output does not change', async () => {
  const rocket = await import('../skills/slign/examples/rocket.mjs');
  const a = check(rocket), b = check({ ...rocket, style: 'ink' });
  assert.deepEqual(a.errors, []);
  assert.equal(a.svg + '\n', readFileSync(new URL('../skills/slign/examples/rocket.svg', import.meta.url), 'utf8'));
  assert.equal(b.svg, a.svg);
});

test('check rejects an unknown style', () => {
  assert.ok(check(hairline({ style: 'neon' })).errors.some((e) => e.startsWith('style:')));
});

test('check accepts clean hairline and engrave objects without eye warnings', () => {
  for (const o of [hairline(), engrave()]) {
    const { errors, warnings } = check(o);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  }
});

test('check refuses extra ids, filters and animated stroke-width in hairline', () => {
  const extraId = check(hairline({ draw: (pen) => pen.line([[0, 0, 0], [9, 0, 0]]).replace('<path', '<path id="x"') }));
  assert.ok(extraId.errors.some((e) => /id/.test(e)), extraId.errors.join());
  const filter = check(hairline({ draw: (pen) => '<filter id="slign-hl-f"/>' + pen.line([[0, 0, 0], [9, 0, 0]]) }));
  assert.ok(filter.errors.length >= 1);
  const stroke = check(hairline({ css: 'ACTIVE .sl-a{animation:slign-hl-w 1s}@keyframes slign-hl-w{0%{stroke-width:1}100%{stroke-width:3}}' }));
  assert.ok(stroke.errors.some((e) => e.includes('stroke-width')));
  const second = check(hairline({ draw: (pen) => '<linearGradient id="slign-hl-h"/>' + pen.line([[0, 0, 0], [9, 0, 0]]) }));
  assert.ok(second.errors.length >= 1);
});

test('check keeps scope rules on the new styles', () => {
  for (const make of [hairline, engrave]) {
    assert.ok(check(make({ css: '.sl-a{opacity:0}' })).errors.some((e) => e.startsWith('scope:')));
    assert.ok(check(make({ css: 'ACTIVE .sl-a{animation:spin 1s}@keyframes spin{0%{transform:none}}' })).errors.some((e) => e.startsWith('scope:')));
  }
  assert.ok(check(engrave({ draw: () => '<linearGradient id="slign-et-g"/>' })).errors.length >= 1);
  assert.ok(check(engrave({ draw: (pen) => '<text>a</text>' + pen.line([[0, 0, 0], [9, 0, 0]]) })).errors.length >= 1);
});

test('the size budget is 60 KB to warn and 120 KB to fail for the new styles', () => {
  const big = (n) => (pen) => Array.from({ length: n }, (_, i) => pen.line([[0, i % 90, 0], [30, i % 90, 0], [30, i % 90, 9]])).join('');
  const sizeOf = (o) => Buffer.byteLength(check(o).svg ?? render(o));
  let n = 100;
  while (sizeOf(hairline({ draw: big(n) })) < 62 * 1024) n += 100;
  const warn = check(hairline({ draw: big(n) }));
  assert.ok(warn.warnings.some((w) => w.startsWith('size:')) && !warn.errors.some((e) => e.startsWith('size:')));
  let m = n;
  while (sizeOf(hairline({ draw: big(m) })) < 122 * 1024) m += 100;
  assert.ok(check(hairline({ draw: big(m) })).errors.some((e) => e.startsWith('size:')));
  assert.ok(!check(hairline({ draw: big(10) })).warnings.some((w) => w.startsWith('size:')));
});

test('the sample objects follow the style and stay under the size budget', async () => {
  for (const file of ['hairline-cube', 'engrave-cube']) {
    const o = await import(`../skills/slign/pens/samples/${file}.mjs`);
    const { errors, warnings, svg } = check(o);
    assert.deepEqual(errors, [], file);
    assert.deepEqual(warnings, [], file);
    assert.ok(Buffer.byteLength(svg) < 60 * 1024, `${file} ${Buffer.byteLength(svg)} bytes`);
  }
});

test('the CLI draws the new styles and --swift is ink only', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'slign-styles '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'wire.mjs'), `export const name = 'wire';\nexport const label = 'Wire';\nexport const style = 'hairline';\nexport const draw = (pen) => pen.line([[0, 0, 0], [20, 0, 0], [20, 20, 0]]);\nexport const css = 'ACTIVE .sl-l{opacity:.5}';\n`);
  const ok = spawnSync('node', [DRAW, 'wire.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(readFileSync(join(dir, 'wire.svg'), 'utf8').includes('slign-wire'));
  const swift = spawnSync('node', [DRAW, 'wire.mjs', '--swift'], { cwd: dir, encoding: 'utf8' });
  assert.equal(swift.status, 1);
  assert.match(swift.stderr, /error    --swift supports only the ink style/);
});

test('a style that is a property of Object.prototype is an error, never a crash', () => {
  for (const style of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const { errors } = check(engrave({ style }));
    assert.equal(errors.length, 1, style);
    assert.match(errors[0], /not a style/);
  }
  assert.doesNotThrow(() => render(engrave({ style: 'constructor', draw: (pen) => pen.line([[0, 0, 0], [10, 0, 0]]) })));
});

test('the paper may be any plain CSS color and is checked like the ink', () => {
  for (const paper of ['#fefdfa', 'rgb(250, 248, 240)', 'hsl(40 30% 96%)', 'oklch(97% .01 90)', 'ivory']) {
    assert.deepEqual(check(engrave({ palette: { paper } })).errors, [], paper);
  }
  const bad = 'red;} .x{fill:url(//e)';
  for (const [style, palette] of [['engrave', { paper: bad }], ['engrave', { ink: bad }], ['icon', { ink: '#000";onload="x' }], ['hairline', { stops: ['#111', '#eee'], ink: '<b>' }]]) {
    const { errors } = check({ ...engrave(), style, palette, ...(style === 'icon' ? { draw: (pen) => pen.line([[4, 12], [20, 12]]) } : {}) });
    assert.deepEqual(errors, ['palette: paper/ink must be a plain CSS color'], style);
  }
});

test('an engraved face is filled with the paper so what is behind it stays hidden', () => {
  const svg = render(engrave({ palette: { paper: '#fefdfa' } }));
  assert.ok(svg.includes('class="sl-fill"'));
  assert.ok(svg.includes('.sl-fill{fill:var(--slign-paper,#fefdfa);stroke:none}'));
  assert.ok(svg.indexOf('class="sl-fill"') < svg.indexOf('class="sl-hatch"'), 'the paper goes under the hatching');
  assert.deepEqual(check(engrave({ palette: { paper: '#fefdfa' } })).errors, []);
});
