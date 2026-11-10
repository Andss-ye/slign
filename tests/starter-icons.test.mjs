import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { check } from '../skills/slign/scripts/draw.mjs';

const dir = new URL('../skills/slign/examples/icons/', import.meta.url);

const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();

test('the twelve starter icons exist', () => {
  assert.deepEqual(files.map((f) => f.slice(0, -4)), ['bell', 'calendar', 'chart', 'check', 'home', 'lock', 'mail', 'plus', 'search', 'settings', 'trash', 'user']);
});

for (const file of files) {
  test(`${file} is a clean icon under 670 bytes with its committed svg`, async () => {
    const o = await import(new URL(file, dir));
    const { errors, warnings, svg } = check(o);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(o.style, 'icon');
    assert.equal(file, `${o.name}.mjs`);
    assert.ok(Buffer.byteLength(svg) <= 670, `${Buffer.byteLength(svg)} bytes`);
    assert.equal(readFileSync(new URL(`${o.name}.svg`, dir), 'utf8'), svg + '\n');
  });
}
