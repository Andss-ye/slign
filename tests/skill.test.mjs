import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const root = new URL('../skills/slign/', import.meta.url);
const skill = readFileSync(new URL('SKILL.md', root), 'utf8');
const description = skill.match(/^description: (.+)$/m)[1];

test('SKILL.md stays small: it is loaded every time the skill triggers', () => {
  assert.ok(skill.split('\n').length <= 60, `${skill.split('\n').length} lines`);
  assert.ok(Buffer.byteLength(skill) <= 3000, `${Buffer.byteLength(skill)} bytes`);
});

test('the description stays short: it is loaded in every session', () => {
  assert.ok(description.split(/\s+/).length <= 60, `${description.split(/\s+/).length} words`);
});

test('every file and example the skill names exists', () => {
  for (const [, path] of skill.matchAll(/<skill>\/((?:references|scripts)\/[\w.-]+)/g)) assert.ok(existsSync(new URL(path, root)), path);
  const examples = readdirSync(new URL('examples/', root)).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4));
  for (const name of examples) assert.ok(skill.includes(`\`${name}\``), `SKILL.md does not list ${name}`);
});
