/* Render QR codes with the page's own encoder and dump them as PNGs so a
   real decoder can be pointed at them. A QR that is structurally perfect
   and decodes into nothing looks exactly like a working one, so this round
   trip is the only honest test — it is how the mirrored format-info bug
   in the first cut of the encoder was found.
 *
 *   node tools/qr-verify.mjs http://localhost:8777/ /tmp/qr
 *   zbarimg -q --raw /tmp/qr/qr*.png          # apt install zbar-tools
 *
 * Every line zbarimg prints must equal the corresponding CASES entry.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2];
const OUT = process.argv[3];
const PORT = 9398;
mkdirSync(OUT, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
   '--hide-scrollbars', '--no-first-run',
   '--user-data-dir=' + process.env.TEMP + '\\m3l-qr', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pend = new Map();
const send = (m, p = {}, s) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s }));
  return new Promise((res, rej) => pend.set(i, { res, rej })); };
let u; for (let i = 0; i < 60 && !u; i++) { try { u = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } }
ws = new WebSocket(u); await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
await send('Page.navigate', { url: BASE }, S);
await sleep(3500);

const CASES = [
  'https://public.st1.nd4y.icu/',
  'https://public.st1.nd4y.icu/ISO/talos-metal-amd64.iso',
  'https://public.st1.nd4y.icu/Distrib/Dell_Driver_Pack_for_Windows_OS_LCDRVPCK_WIN_24.03.200.61.ISO',
  'https://public.st1.nd4y.icu/%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B/%D0%9E%D1%82%D1%87%D1%91%D1%82%20%D0%B7%D0%B0%202025.xlsx',
  'https://example.com/a/very/long/path/that/pushes/the/encoder/into/a/higher/version/because/it/keeps/going/and/going/file-with-a-long-name-v2.tar.gz'
];

for (let i = 0; i < CASES.length; i++) {
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const q = window.M3L_QR(${JSON.stringify(CASES[i])});
      if (!q) return null;
      const scale = 6, quiet = 4, px = (q.size + quiet*2) * scale;
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, px, px);
      g.fillStyle = '#000';
      for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++)
        if (q.m[r][c]) g.fillRect((c+quiet)*scale, (r+quiet)*scale, scale, scale);
      return JSON.stringify({ size: q.size, png: cv.toDataURL('image/png').split(',')[1] });
    })()`, returnByValue: true
  }, S);
  const v = r.result.value;
  if (!v) { console.log(`case ${i}: encoder refused`); continue; }
  const o = JSON.parse(v);
  writeFileSync(`${OUT}/qr${i}.png`, Buffer.from(o.png, 'base64'));
  console.log(`case ${i}: matrix ${o.size}x${o.size} -> qr${i}.png`);
}
ws.close(); chrome.kill(); process.exit(0);
