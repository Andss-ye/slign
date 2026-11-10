import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pageFor } from '../skills/slign/scripts/shot.mjs';

const SHOT = fileURLToPath(new URL('../skills/slign/scripts/shot.mjs', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('../skills/slign/examples/rocket.svg', import.meta.url));

test('the page shows the drawing on paper, dark on request, and mid-gesture on request', () => {
  const svg = '<svg class="slign slign-x"></svg>';
  assert.ok(pageFor(svg).includes('#dedede'));
  assert.ok(pageFor(svg, { dark: true }).includes('#121214'));
  assert.ok(pageFor(svg, { active: true }).includes('class="slign slign-active slign-x"'));
});

test('without a drawing it prints usage and fails', () => {
  const r = spawnSync(process.execPath, [SHOT], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage/);
});

test('it writes a png when Chrome is installed', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slign '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = join(root, 'rocket.png');
  const r = spawnSync(process.execPath, [SHOT, EXAMPLE, out, '--active'], { encoding: 'utf8' });
  if (/Chrome not found/.test(r.stderr)) return t.skip('no Chrome');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(out));
});
