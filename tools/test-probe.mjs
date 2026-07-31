/* Functional test for the Range-based probes and the tree crawler.
   Needs a live listing with real files behind it, so it is pointed at a
   deployment rather than at the demo:

     node tools/test-probe.mjs https://files.example.com/            */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2];
const PORT = 9400;
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
   '--hide-scrollbars', '--no-first-run',
   '--user-data-dir=' + process.env.TEMP + '\\m3l-probe', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pend = new Map();
const send = (m, p = {}, s) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s }));
  return new Promise((res, rej) => pend.set(i, { res, rej })); };
let u; for (let i = 0; i < 60 && !u; i++) { try { u = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } }
ws = new WebSocket(u); await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, S);
await send('Page.navigate', { url: BASE }, S);
await sleep(4000);

const ev = async (expr) => {
  const r = await send('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

/* ---- walk the tree and probe one file of each interesting kind ---- */
const found = await ev(`(async () => {
  const wanted = { iso: null, zip: null, exe: null, pic: null, pdf: null };
  const seenDirs = [];
  await new Promise(res => {
    let done = false;
    const stop = setTimeout(() => { if (!done) { done = true; res(); } }, 25000);
    const c = window.M3L_CRAWL(location.href, e => {
      if (e.isDir) { seenDirs.push(e.href); return; }
      const x = (e.name.split('.').pop() || '').toLowerCase();
      if (x === 'iso' && !wanted.iso) wanted.iso = e;
      if ((x === 'zip' || x === 'apk' || x === 'jar') && !wanted.zip) wanted.zip = e;
      if (x === 'exe' && !wanted.exe) wanted.exe = e;
      if (/^(jpg|jpeg|png|gif)$/.test(x) && !wanted.pic) wanted.pic = e;
      if (x === 'pdf' && !wanted.pdf) wanted.pdf = e;
      if (wanted.iso && wanted.zip && wanted.pic && !done) {
        done = true; clearTimeout(stop); c.stop(); res();
      }
    });
  });
  return {
    dirs: seenDirs.length,
    iso: wanted.iso && { href: wanted.iso.href, size: wanted.iso.size },
    zip: wanted.zip && { href: wanted.zip.href, size: wanted.zip.size },
    pic: wanted.pic && { href: wanted.pic.href, size: wanted.pic.size }
  };
})()`);
check('the crawler walks into subdirectories', found.dirs > 0, found.dirs + ' directories seen');

/* ---- ranges must be supported at all ---- */
const anyFile = found.pic || found.zip || found.iso;
if (anyFile) {
  /* asking for real bytes is the honest test — a cache in front can drop
     the Accept-Ranges header while still honouring the request */
  const rr = await ev(`(async () => {
    const r = await fetch(${JSON.stringify(anyFile.href)}, { headers: { Range: 'bytes=0-63' } });
    const b = await r.arrayBuffer();
    return { status: r.status, bytes: b.byteLength };
  })()`);
  check('the server answers Range requests', rr.status === 206 && rr.bytes === 64,
        `HTTP ${rr.status}, ${rr.bytes} bytes back`);
} else check('the server answers Range requests', false, 'no file found to test with');

async function probeOne(label, target, assert) {
  if (!target) { check(label, false, 'no such file on the share'); return; }
  try {
    const info = await ev(`(async () => {
      const h = await window.M3LProbe.head(${JSON.stringify(target.href)});
      const x = ${JSON.stringify(target.href)}.split('.').pop().toLowerCase();
      const r = await window.M3LProbe.probe(${JSON.stringify(target.href)}, x, h.size);
      return JSON.parse(JSON.stringify(r));
    })()`);
    const verdict = assert(info);
    check(label, verdict.ok, verdict.detail);
  } catch (e) {
    check(label, false, String(e.message).slice(0, 100) + ' — ' + target.href);
  }
}

await probeOne('ISO: volume label read from sector 16', found.iso, info => ({
  ok: info.kind === 'iso' && !!(info.label || info.system),
  detail: `label "${info.label}", ${info.blocks} blocks, created ${info.created || '—'}`
}));

await probeOne('ZIP: table of contents read from the tail', found.zip, info => ({
  ok: info.kind === 'zip' && info.count > 0 && info.entries.length > 0,
  detail: `${info.count} entries, first "${info.entries[0] && info.entries[0].name}"`
}));

await probeOne('picture: dimensions from the header', found.pic, info => ({
  ok: info.kind === 'image' && info.width > 0 && info.height > 0,
  detail: `${info.format} ${info.width}×${info.height}`
}));

/* The per-row "measure this directory" button feeds the crawler the row's
   own href, which is relative — that used to come back as 0 bytes. */
const measured = await ev(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const row = [...document.querySelectorAll('.item')].find(n => /\\/$/.test(n.dataset.href));
  if (!row) return { skip: 'no directory row' };
  const btn = [...row.querySelectorAll('.item__tail .iconbtn')]
    .find(b => /straighten/.test(b.textContent));
  if (!btn) return { skip: 'no measure button' };
  btn.click();
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    const m = row.querySelector('.item__meta').textContent;
    if (window.M3L_LASTMEASURE) break;
    if (i === 89) return { href: row.dataset.href, text: m, timeout: true };
  }
  return { href: row.dataset.href, text: row.querySelector('.item__meta').textContent,
           bytes: window.M3L_LASTMEASURE.bytes, files: window.M3L_LASTMEASURE.files };
})()`);
check('the size button counts a directory from a relative href',
      measured.skip ? true : (!measured.timeout && measured.bytes > 0 && measured.files > 0),
      measured.skip || `${measured.href} → ${measured.text}`);

ws.close(); chrome.kill();

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
}
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
