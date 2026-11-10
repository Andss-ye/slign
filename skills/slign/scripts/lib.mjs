#!/usr/bin/env node
// Keeps a project's drawings in order: node lib.mjs <init|add|list|place|build> [args]
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { findChrome, launch } from './chrome.mjs';
import { check, placeInto, toJsx, toSwift } from './draw.mjs';
import { profileOf } from './sense.mjs';

const USAGE = `usage: node lib.mjs <command> [--dir slign]
  init [--url <page|file.html>] [--format jsx|swift] [--force]
  add <object.mjs> [--kind icon|illustration|component] [--force]
  list [--json]
  place <name> --into <page>
  build`;
const BUDGET = { icon: 1536, illustration: 12288, component: 12288 };
const VALUE_FLAGS = new Set(['--url', '--dir', '--kind', '--into', '--format']);
const README = `# Slign library
Drawings for this project, kept in order: icons, illustrations and components.
Add one: node <skill>/scripts/lib.mjs add <object.mjs>. See them: node <skill>/scripts/lib.mjs list.
Put one in a page: node <skill>/scripts/lib.mjs place <name> --into <page>.
Everything in icons/, illustrations/ and components/ is generated from src/: edit src/<name>.mjs.
Then run node <skill>/scripts/lib.mjs build, which fails when a file drifted.
`;

/** A problem the person can fix; the message says how. */
class Fail extends Error {
  constructor(...messages) {
    super(messages.join('\n'));
    this.messages = messages;
  }
}
const fail = (message) => {
  throw new Fail(message);
};

/** Style that suits the page: dark with a gradient draws hairline, light with serif heads engraves. */
export const styleFor = ({ theme, gradient, type }) =>
  theme === 'dark' && gradient?.length ? 'hairline' : theme === 'light' && type?.head === 'serif' ? 'engrave' : 'ink';

const parse = (args) => {
  const flags = {}, rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) rest.push(a);
    else if (!VALUE_FLAGS.has(a)) flags[a.slice(2)] = true;
    else if (args[i + 1] === undefined) fail(`${a} needs a value`);
    else flags[a.slice(2)] = args[++i];
  }
  return { flags, rest };
};

const write = (dir, rel, text) => {
  const file = join(dir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
};
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function open(dir) {
  const read = (rel) => {
    try {
      return JSON.parse(readFileSync(join(dir, rel), 'utf8'));
    } catch (e) {
      return fail(e.code === 'ENOENT' ? `${join(dir, rel)} is missing: run \`node lib.mjs init\` first` : `${join(dir, rel)} is not valid JSON: fix it`);
    }
  };
  const config = read('slign.config.json');
  config.formats ??= ['svg'];
  config.budget = { ...BUDGET, ...config.budget };
  return { config, index: read('index.json') };
}

const load = async (src) => {
  try {
    return await import(pathToFileURL(resolve(src)).href);
  } catch (e) {
    return fail(`could not load ${src}: ${String(e.message).split('\n')[0]}`);
  }
};

/** The object with the project's style and palette filled in where it sets none. */
function prepare(mod, config) {
  const { ink, ...palette } = config.palette ?? {};
  return { ...mod, style: mod.style ?? config.style, palette: mod.palette ?? palette };
}

/** Every file a drawing generates, relative to the library, with its text. */
function outputs(o, svg, kind, config) {
  const base = `${kind}s/${o.name}`, files = { [`${base}.svg`]: svg + '\n' };
  if (config.formats.includes('jsx')) files[`${base}.jsx`] = toJsx(svg, o.name) + '\n';
  if (config.formats.includes('swift') && (o.style ?? 'ink') === 'ink') files[`${base}.swift`] = toSwift(svg, o.name);
  return files;
}

/** Checks the drawing and its budget; nothing has been written when this throws. */
function make(mod, config, kind) {
  const o = prepare(mod, config);
  const { errors, warnings, svg } = check(o);
  for (const w of warnings) console.error(`warning  ${w}`);
  if (errors.length) throw new Fail(...errors);
  const bytes = Buffer.byteLength(svg), budget = config.budget[kind];
  if (bytes > budget) fail(`${o.name} is ${bytes} bytes, over the ${budget} byte budget for ${kind}s: drop detail or raise budget.${kind} in slign.config.json`);
  return { o, svg, bytes, files: outputs(o, svg, kind, config) };
}

const entry = (o, kind, svg, bytes, added) => ({
  name: o.name, kind, style: o.style ?? 'ink', bytes, gzip: gzipSync(svg).length, file: `${kind}s/${o.name}.svg`, added,
});
const byKindThenName = (a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.name < b.name ? -1 : +(a.name > b.name));

async function init({ flags }) {
  const dir = flags.dir ?? 'slign', file = join(dir, 'slign.config.json');
  if (existsSync(file) && !flags.force) fail(`${file} already exists: pass --force to overwrite it`);
  if (flags.format && !['jsx', 'swift'].includes(flags.format)) fail('--format must be jsx or swift');
  let profile;
  if (flags.url) {
    if (!findChrome()) fail('Chrome not found: install it or set CHROME to its path');
    const chrome = await launch().catch((e) => fail(String(e.message).split('\n')[0]));
    try {
      await chrome.open(flags.url);
      profile = await profileOf(chrome);
    } catch (e) {
      fail(`could not read ${flags.url}: ${String(e.message).split('\n')[0]}`);
    } finally {
      await chrome.close();
    }
  }
  const config = {
    version: 1,
    style: profile ? styleFor(profile) : 'ink',
    palette: profile
      ? { ink: profile.ink, accent: profile.accent, paper: profile.paper, stops: profile.gradient ?? [] }
      : { ink: 'currentColor', accent: '#2a17d4', paper: '#ffffff', stops: [] },
    stroke: null,
    formats: ['svg', flags.format ?? 'jsx'],
    budget: BUDGET,
  };
  console.log(write(dir, 'slign.config.json', json(config)) + `  style ${config.style}`);
  console.log(write(dir, 'index.json', json({ version: 1, items: [] })));
  console.log(write(dir, 'README.md', README));
}

async function add({ flags, rest }) {
  const [src] = rest, dir = flags.dir ?? 'slign';
  if (!src) fail('add needs an object file: node lib.mjs add <object.mjs>');
  const { config, index } = open(dir);
  const mod = await load(src);
  const kind = flags.kind ?? ((mod.style ?? config.style) === 'icon' ? 'icon' : 'illustration');
  if (!(kind in config.budget)) fail(`--kind must be ${Object.keys(config.budget).join(', ')}`);
  const { o, svg, bytes, files } = make(mod, config, kind);
  const old = index.items.find((i) => i.name === o.name);
  if (old && !flags.force) fail(`${o.name} is already in the library as ${old.file}: pass --force to replace it`);

  if (old) for (const ext of ['svg', 'jsx', 'swift']) rmSync(join(dir, old.file.replace(/\.svg$/, `.${ext}`)), { force: true });
  const written = Object.entries(files).map(([rel, text]) => write(dir, rel, text));
  written.push(write(dir, `src/${o.name}.mjs`, readFileSync(src)));
  const items = [...index.items.filter((i) => i !== old), entry(o, kind, svg, bytes, new Date().toISOString().slice(0, 10))].sort(byKindThenName);
  write(dir, 'index.json', json({ ...index, items }));
  for (const file of written) console.log(file);
  console.log(`${o.name}  ${kind}  ${bytes} bytes`);
}

function list({ flags }) {
  const { index } = open(flags.dir ?? 'slign');
  if (flags.json) return console.log(JSON.stringify(index.items, null, 2));
  const rows = [['name', 'kind', 'style', 'bytes'], ...index.items.map((i) => [i.name, i.kind, i.style, String(i.bytes)])];
  const width = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  for (const r of rows) console.log(r.map((v, c) => v.padEnd(width[c])).join('  ').trimEnd());
}

function place({ flags, rest }) {
  const [name] = rest, dir = flags.dir ?? 'slign', into = flags.into;
  if (!name || !into) fail('place needs a name and a page: node lib.mjs place <name> --into <page>');
  const item = open(dir).index.items.find((i) => i.name === name);
  if (!item) fail(`${name} is not in the library: node lib.mjs list shows what is`);
  if (!existsSync(into)) fail(`${into} does not exist`);
  const page = placeInto(readFileSync(into, 'utf8'), readFileSync(join(dir, item.file), 'utf8').trimEnd(), name);
  if (page === null) fail(`${into}: add <!-- slign:${name} --> where the drawing goes`);
  writeFileSync(into, page);
  console.log(`${into}  ${name}`);
}

/** Regenerates every file from src/ and reports the ones that were not already in step. */
async function build({ flags }) {
  const dir = flags.dir ?? 'slign', { config, index } = open(dir), plan = {}, items = [];
  for (const item of index.items) {
    const src = join(dir, `src/${item.name}.mjs`);
    if (!existsSync(src)) fail(`${src} is missing: restore it or remove ${item.name} from index.json`);
    const { o, svg, bytes, files } = make(await load(src), config, item.kind);
    Object.assign(plan, files);
    items.push(entry(o, item.kind, svg, bytes, item.added));
  }
  plan['index.json'] = json({ ...index, items: items.sort(byKindThenName) });
  const drifted = Object.keys(plan).filter((rel) => !existsSync(join(dir, rel)) || readFileSync(join(dir, rel), 'utf8') !== plan[rel]);
  for (const rel of drifted) write(dir, rel, plan[rel]);
  if (!drifted.length) return console.log('ok');
  for (const rel of drifted) console.log(`drift  ${join(dir, rel)}`);
  process.exitCode = 1;
}

const COMMANDS = { init, add, list, place, build };

export async function main(args) {
  try {
    const [cmd, ...more] = args;
    if (cmd === '--help' || cmd === '-h') {
      console.log(USAGE);
      return 0;
    }
    if (!cmd) fail('no command: use init, add, list, place or build (--help shows the options)');
    if (!COMMANDS[cmd]) fail(`unknown command "${cmd}": use init, add, list, place or build`);
    process.exitCode = 0;
    await COMMANDS[cmd](parse(more));
    return process.exitCode;
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    for (const m of e.messages) console.error(`error    ${m}`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
