import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { check } from '../skills/slign/scripts/draw.mjs';

const dir = new URL('../skills/slign/examples/', import.meta.url);
const sources = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();

test('there is at least one example', () => assert.ok(sources.length > 0));

for (const file of sources) {
  test(`${file} follows the style and matches its committed svg`, async () => {
    const o = await import(new URL(file, dir));
    const { errors, warnings, svg } = check(o);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(file, `${o.name}.mjs`);
    assert.equal(readFileSync(new URL(`${o.name}.svg`, dir), 'utf8'), svg + '\n');
  });
}
