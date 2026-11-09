// Renders a Slign SVG to a PNG so you can look at it: node shot.mjs <drawing.svg> [out.png] [--dark] [--active]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from './chrome.mjs';

const CHROME = findChrome();

/** Page that shows the drawing large, on paper or dark, optionally mid-gesture. */
export function pageFor(svg, { dark = false, active = false } = {}) {
  const body = active ? svg.replace('class="slign ', 'class="slign slign-active ') : svg;
  const [ink, paper] = dark ? ['#ededed', '#121214'] : ['#2a17d4', '#dedede'];
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:${paper};color:${ink}}` +
    `body{display:grid;place-items:center}.slign.slign{height:560px!important;width:auto!important;max-width:600px!important}</style>${body}`;
}

export function main(args) {
  const [src, out = 'slign.png'] = args.filter((a) => !a.startsWith('--'));
  if (!src) {
    console.error('usage: node shot.mjs <drawing.svg> [out.png] [--dark] [--active]');
    return 1;
  }
  if (!CHROME) {
    console.error('error    Chrome not found: install it or set CHROME to its path');
    return 1;
  }
  const dir = mkdtempSync(join(tmpdir(), 'slign-shot-'));
  const page = join(dir, 'page.html');
  writeFileSync(page, pageFor(readFileSync(src, 'utf8'), { dark: args.includes('--dark'), active: args.includes('--active') }));
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=640,640',
    '--virtual-time-budget=600', `--user-data-dir=${join(dir, 'profile')}`,
    `--screenshot=${resolve(out)}`, pathToFileURL(page).href,
  ], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0 || !existsSync(resolve(out))) {
    console.error(`error    Chrome did not write ${out}`);
    return 1;
  }
  console.log(resolve(out));
  return 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
