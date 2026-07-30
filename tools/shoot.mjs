/* Headless-Chrome screenshotter driven over CDP (no npm deps).
   Usage: node tools/shoot.mjs <baseUrl> <outDir>
   The Browser pane's own screenshot tool cannot composite frames in this
   environment, so verification shots are taken this way instead. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] || 'http://localhost:8777/';
const OUT = process.argv[3] || 'screenshots';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9393;

mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--remote-allow-origins=*',
  '--hide-scrollbars',
  '--no-first-run',
  '--user-data-dir=' + process.env.TEMP + '\\m3l-shoot-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('chrome did not come up');
}

const wsUrl = await connect();
ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  }
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = sessionId;

await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);

const shots = [
  { name: 'list-light',  w: 1280, h: 900,  dark: false },
  { name: 'list-dark',   w: 1280, h: 900,  dark: true  },
  { name: 'grid-dark',   w: 1280, h: 900,  dark: true,  pre: "localStorage.setItem('m3l.view','grid')" },
  { name: 'search-light',w: 1280, h: 900,  dark: false, post: "document.getElementById('m3l-searchfab').click(); setTimeout(function(){var q=document.getElementById('m3l-q');q.value='iso';q.dispatchEvent(new Event('input'));},400)" },
  { name: 'select-light',w: 1280, h: 900,  dark: false, post: "var c=document.querySelectorAll('.item__ico');c[4].click();c[5].click();c[7].click()" },
  { name: 'mobile-light',w: 400,  h: 860,  dark: false, dsf: 2 },
  { name: 'mobile-dark', w: 400,  h: 860,  dark: true,  dsf: 2 },
  { name: 'mobile-select',w: 400, h: 860,  dark: false, dsf: 2, post: "var c=document.querySelectorAll('.item__ico');c[1].click();c[4].click()" }
];

for (const s of shots) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: s.w, height: s.h, deviceScaleFactor: s.dsf || 2, mobile: !!s.dsf
  }, S);
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: s.dark ? 'dark' : 'light' }]
  }, S);

  /* reset per-shot state, then apply the shot's own preconditions */
  await send('Page.navigate', { url: 'about:blank' }, S);
  await sleep(120);
  await send('Page.navigate', { url: BASE }, S);
  await sleep(400);
  /* the repository's screenshots are English regardless of the machine
     they are taken on */
  await send('Runtime.evaluate', {
    expression: `localStorage.clear();localStorage.setItem('m3l.lang','en');${s.pre || ''}`
  }, S);
  await send('Page.navigate', { url: BASE }, S);
  await sleep(3500);                       // let the webfonts settle
  if (s.post) await send('Runtime.evaluate', { expression: s.post }, S);
  await sleep(800);

  const { data } = await send('Page.captureScreenshot', { format: 'png' }, S);
  writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(data, 'base64'));
  console.log('wrote', s.name);
}

ws.close();
chrome.kill();
process.exit(0);
