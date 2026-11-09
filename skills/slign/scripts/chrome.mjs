// Drives a headless Chrome over the DevTools protocol, with no dependencies.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Path to a Chrome or Chromium binary, or undefined. */
export function findChrome() {
  return [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((p) => p && existsSync(p));
}

/** An http(s)/file/data URL as is; anything else is a local path. */
const toUrl = (u) => (/^(https?|file|data|about):/.test(u) ? u : pathToFileURL(resolve(u)).href);

/** Starts Chrome and returns { open, evaluate, screenshot, close, profile }. Always close() it. */
export async function launch({ width = 1280, height = 900 } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error('Chrome not found: install it or set CHROME to its path');
  const profile = mkdtempSync(join(tmpdir(), 'slign-chrome-'));
  const child = spawn(bin, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
    `--window-size=${width},${height}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { detached: true, stdio: 'ignore' });
  const exited = new Promise((r) => child.once('exit', r));
  let ws;
  const close = async () => {
    try { ws?.close(); } catch {}
    for (const sig of ['SIGTERM', 'SIGKILL']) {
      try { process.kill(-child.pid, sig); } catch {}
      if (await Promise.race([exited.then(() => true), sleep(2000)])) break;
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };

  try {
    const portFile = join(profile, 'DevToolsActivePort');
    for (let i = 0; !existsSync(portFile); i++) {
      if (i > 100) throw new Error('Chrome did not start');
      await sleep(100);
    }
    const port = readFileSync(portFile, 'utf8').split('\n')[0];
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools connection failed')); });

    let id = 0;
    const pending = new Map();
    const waiting = new Set();
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else for (const w of waiting) w(m.method);
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      pending.set(++id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const loaded = () => new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('page did not load')), 30000).unref();
      const w = (method) => {
        if (method !== 'Page.loadEventFired') return;
        clearTimeout(timer);
        waiting.delete(w);
        res();
      };
      waiting.add(w);
    });

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

    return {
      profile,
      close,
      async open(url) {
        const load = loaded();
        load.catch(() => {});
        const { errorText } = await send('Page.navigate', { url: toUrl(url) });
        if (errorText) throw new Error(`page did not load: ${errorText}`);
        await load;
        await sleep(600);
      },
      async evaluate(expression) {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
      },
      async screenshot(outPath) {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(outPath, Buffer.from(data, 'base64'));
      },
    };
  } catch (e) {
    await close();
    throw e;
  }
}
