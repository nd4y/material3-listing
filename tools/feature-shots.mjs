/* Screenshots of what only exists against real files: an archive's table
   of contents pulled over Range, and a recursive search. Needs a
   deployment rather than the demo.
     node tools/feature-shots.mjs http://your-share.example/ screenshots  */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2], OUT = process.argv[3], PORT = 9401;
mkdirSync(OUT, { recursive: true });
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
   '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + process.env.TEMP + '\\m3l-fs', 'about:blank'],
  { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
const send = (m, p = {}, s) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s }));
  return new Promise((res, rej) => pend.set(i, { res, rej })); };
let u; for (let i = 0; i < 60 && !u; i++) { try { u = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } }
ws = new WebSocket(u); await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, S)).result.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' }, S);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('wrote', name);
};

for (const dark of [false, true]) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 2, mobile: false }, S);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] }, S);

  /* a ZIP: table of contents pulled from the tail */
  await send('Page.navigate', { url: BASE }, S);
  await sleep(1500);
  await ev(`localStorage.setItem('m3l.lang','en')`);     /* repo shots are English */
  await send('Page.navigate', { url: BASE + 'Tools/' }, S);
  await sleep(4200);
  await ev(`(() => { const r = [...document.querySelectorAll('.item')].find(n => /AIDA64\\.zip$/.test(n.dataset.href));
    r.querySelector('.iconbtn').click(); })()`);
  await sleep(3500);
  await shot(dark ? 'feat-zip-dark' : 'feat-zip-light');
  await ev(`document.querySelector('.viewer__close').click()`);
  await sleep(600);

  /* filter chips + a recursive search */
  await send('Page.navigate', { url: BASE }, S);
  await sleep(4200);
  await ev(`(() => {
    document.getElementById('m3l-searchfab').click();
    const q = document.getElementById('m3l-q');
    q.value = 'openssl'; q.dispatchEvent(new Event('input'));
  })()`);
  await sleep(400);
  await ev(`document.querySelector('.deepbtn').click()`);
  await sleep(9000);
  await shot(dark ? 'feat-deep-dark' : 'feat-deep-light');
}
ws.close(); chrome.kill(); process.exit(0);
