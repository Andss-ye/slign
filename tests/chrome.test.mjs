import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findChrome, launch } from '../skills/slign/scripts/chrome.mjs';

const alive = (profile) => spawnSync('pgrep', ['-f', profile]).status === 0;

test('it drives Chrome, evaluates in the page, screenshots, and leaves nothing running', async (t) => {
  if (!findChrome()) return t.skip('no Chrome');
  const dir = mkdtempSync(join(tmpdir(), 'slign-chrome-test-'));
  const page = join(dir, 'page.html');
  writeFileSync(page, '<!doctype html><title>hi</title><h1 id=a>Hello</h1>');
  const chrome = await launch({ width: 800, height: 600 });
  try {
    await chrome.open(page);
    assert.equal(await chrome.evaluate('document.getElementById("a").textContent'), 'Hello');
    assert.equal(await chrome.evaluate('window.innerWidth'), 800);
    await assert.rejects(chrome.evaluate('throw new Error("boom")'), /boom/);
    const png = join(dir, 'out.png');
    await chrome.screenshot(png);
    assert.equal(readFileSync(png).subarray(1, 4).toString(), 'PNG');
    assert.ok(alive(chrome.profile));
  } finally {
    await chrome.close();
  }
  assert.equal(alive(chrome.profile), false);
  assert.equal(existsSync(chrome.profile), false);
});
