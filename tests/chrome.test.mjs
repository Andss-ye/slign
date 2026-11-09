import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { findChrome, launch, rpc, stopGroup } from '../skills/slign/scripts/chrome.mjs';

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
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(alive(chrome.profile), false);
  assert.equal(existsSync(chrome.profile), false);
});

test('rpc rejects a call that is never answered', async () => {
  const send = rpc({ send() {} }, 50);
  await assert.rejects(send('Page.enable'), /timed out/);
});

test('rpc rejects pending calls when the socket closes', async () => {
  const ws = { send() {} };
  const send = rpc(ws, 5000);
  const call = send('Page.enable');
  ws.onclose();
  await assert.rejects(call, /closed/);
  await assert.rejects(send('Page.enable'), /closed/);
});

test('stopGroup kills the group even when the main process already exited', async () => {
  const mark = `slign-mark-${process.pid}-${Date.now()}`;
  const child = spawn('sh', ['-c', `(exec -a ${mark} sleep 300) & exit 0`], { detached: true, stdio: 'ignore' });
  const exited = new Promise((r) => child.once('exit', r));
  await exited;
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(spawnSync('pgrep', ['-f', mark]).status, 0);
  await stopGroup(child, exited, 100);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(spawnSync('pgrep', ['-f', mark]).status, 1);
});

test('launch names Node 22 when WebSocket is missing', async () => {
  const ws = globalThis.WebSocket;
  delete globalThis.WebSocket;
  try {
    await assert.rejects(launch(), (e) => /Node 22/.test(e.message) && !e.message.includes('\n'));
  } finally {
    globalThis.WebSocket = ws;
  }
});

test('package.json requires Node 22 or newer', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.engines.node, '>=22');
});

test('stopGroup kills a process that ignores SIGTERM', async () => {
  const child = spawn('sh', ['-c', 'trap "" TERM; while :; do sleep 1; done'], { detached: true, stdio: 'ignore' });
  const exited = new Promise((r) => child.once('exit', r));
  await new Promise((r) => setTimeout(r, 200));
  await stopGroup(child, exited, 100);
  assert.equal(await Promise.race([exited.then(() => true), new Promise((r) => setTimeout(() => r(false), 2000))]), true);
});
