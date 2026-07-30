/* Motion + shape assertions against the running demo, over CDP.
   Checks that every transition uses m3.material.io's single easing curve
   and one of its three durations, and that hover actually morphs shape,
   colour and the icon FILL axis.
   Usage: node tools/test-motion.mjs [baseUrl] */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] || 'http://localhost:8777/';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9394;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const DURATIONS = ['0.2s', '0.3s', '0.5s'];

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + process.env.TEMP + '\\m3l-motion-profile', 'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
};

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
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
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, S);
await send('Page.navigate', { url: BASE }, S);
await sleep(4000);

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
    (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); };

/* ---- 1. every declared transition uses the site's curve + durations ---- */
const decls = await evaluate(`(() => {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    const walk = rs => { for (const r of rs) {
      if (r.style && r.style.transition) out.push({sel: r.selectorText, v: r.style.transition});
      if (r.cssRules) walk(r.cssRules);
    }};
    walk(rules);
  }
  return out;
})()`);

const strayEase = decls.filter(d =>
  /\\d(\\.\\d+)?m?s/.test(d.v) && !d.v.includes('cubic-bezier(.2, 0, 0, 1)')
                              && !d.v.includes('cubic-bezier(0.2, 0, 0, 1)')
                              && !d.v.includes('var(--ease)'));
check('every transition uses cubic-bezier(.2,0,0,1)', strayEase.length === 0,
      strayEase.map(d => d.sel + ' → ' + d.v).join('; '));
check('transitions declared', decls.length > 20, decls.length + ' declarations');

/* ---- 2. computed transitions on the key surfaces ---- */
const computed = await evaluate(`(() => {
  const g = (sel, prop) => {
    const n = document.querySelector(sel);
    return n ? getComputedStyle(n)[prop] : null;
  };
  return {
    body:       g('body', 'transition'),
    rail:       g('.rail', 'transition'),
    railIco:    g('.rail-item__ico', 'transition'),
    fab:        g('.rail-item--fab .rail-item__ico', 'transition'),
    circle:     g('.rail-item--circle .rail-item__ico', 'transition'),
    searchwrap: g('.searchwrap', 'transition'),
    search:     g('.search', 'transition'),
    selbar:     g('.selbar', 'transition'),
    shell:      g('.m3l', 'transition'),
    tab:        g('.tab', 'transition'),
    item:       g('.item', 'transition'),
    itemIco:    g('.item__ico', 'transition'),
    gs:         g('.item__ico .gs', 'transition'),
    chev:       g('.item__chev', 'transition'),
    hero:       g('.hero', 'transition'),
    wash:       g('.hero__wash', 'animation'),
    firstItem:  g('.item', 'animation'),
    navbar:     g('.navbar', 'transition')
  };
})()`);

for (const [k, v] of Object.entries(computed)) {
  const has = v && v !== 'none' && v !== 'all 0s ease 0s';
  /* `animation: blur 3s ease` serialises as "3s blur" — the default easing
     keyword is dropped, so only the transition entries carry the curve */
  const isAnim = k === 'wash' || k === 'firstItem';
  const easeOk = !has || isAnim || v.includes('cubic-bezier(0.2, 0, 0, 1)');
  const durOk = !has || DURATIONS.some(d => v.includes(d)) || v.includes('3s');
  check(`motion on ${k}`, has && easeOk && durOk, v);
}

check('icon FILL axis is animated',
      (computed.gs || '').includes('font-variation-settings'), computed.gs);
check('hero wash runs the site\'s 3s blur keyframes',
      (computed.wash || '').includes('blur') && (computed.wash || '').includes('3s'), computed.wash);
check('search panel eases on height + opacity, like the site\'s nav container',
      (computed.searchwrap || '').includes('height') && (computed.searchwrap || '').includes('opacity'),
      computed.searchwrap);
check('layout eases on resize (rail gutter + shell padding)',
      (computed.body || '').includes('padding') && (computed.shell || '').includes('padding'),
      `${computed.body} || ${computed.shell}`);

/* the shell must fill the space beside the rail, not hug it */
const centring = await evaluate(`(() => {
  const s = document.querySelector('.m3l').getBoundingClientRect();
  const railW = document.querySelector('.rail').getBoundingClientRect().width;
  return { left: Math.round(s.left), right: Math.round(innerWidth - s.right), railW: Math.round(railW) };
})()`);
check('shell is centred in the space beside the rail',
      Math.abs((centring.left - centring.railW) - centring.right) <= 2,
      `gap left ${centring.left - centring.railW}px, right ${centring.right}px`);

/* ---- 2a. every glyph the page can ask for is a real ligature ----
   A name the font does not know renders as its letters, which is several
   times wider than the 24px glyph box — that is what this measures. */
const glyphs = await evaluate(`(() => {
  const names = window.M3L_GLYPHS || [];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:visible';
  document.body.appendChild(box);
  const bad = [];
  for (const n of names) {
    const s = document.createElement('span');
    s.className = 'gs';
    s.style.visibility = 'visible';
    s.textContent = n;
    box.appendChild(s);
    const w = s.getBoundingClientRect().width;
    if (w > 34) bad.push(n + ' (' + Math.round(w) + 'px)');
    s.remove();
  }
  box.remove();
  return { total: names.length, bad };
})()`);
check(`all ${glyphs.total} glyph names exist in the webfont`,
      glyphs.bad.length === 0, glyphs.bad.join(', ') || `${glyphs.total} checked`);

/* ---- 2b. the search panel really collapses and expands ---- */
const searchStates = await evaluate(`(() => {
  const w = document.getElementById('m3l-searchwrap');
  const before = getComputedStyle(w).height;
  document.getElementById('m3l-searchfab').click();
  return { before, open: w.classList.contains('is-open') };
})()`);
await sleep(600);
const searchOpenH = await evaluate(
  `getComputedStyle(document.getElementById('m3l-searchwrap')).height`);
check('search starts collapsed and the button expands it',
      searchStates.before === '0px' && searchStates.open && parseFloat(searchOpenH) > 40,
      `${searchStates.before} → ${searchOpenH}`);
await evaluate(`document.getElementById('m3l-searchfab').click()`);
await sleep(500);

/* ---- 2b2. filter chips, viewer, thumbnails, QR ---- */
const feat = await evaluate(`(() => {
  const out = {};
  const chips = [...document.querySelectorAll('.chip')];
  out.chips = chips.length;
  const pic = chips.find(c => /Картинки|Pictures/.test(c.textContent));
  if (pic) { pic.click(); out.filtered = document.querySelectorAll('.item').length; pic.click(); }
  out.restored = document.querySelectorAll('.item').length;

  const rows = [...document.querySelectorAll('.item')];
  const md = rows.find(r => /notes\\.md/.test(r.dataset.href));
  if (md) md.querySelector('.item__link').click();
  out.viewerOpen = !document.querySelector('.viewer').hidden;
  out.viewerName = document.querySelector('.viewer__name').textContent;
  document.querySelector('.viewer__close').click();

  out.thumbSlots = document.querySelectorAll('.item.has-thumb').length;
  const q = window.M3L_QR('https://example.com/x');
  out.qrSize = q ? q.size : 0;
  return out;
})()`);
check('filter chips are built from the listing', feat.chips >= 5, feat.chips + ' chips');
check('a chip narrows the list and releases it',
      feat.filtered > 0 && feat.filtered < feat.restored,
      `${feat.filtered} of ${feat.restored}`);
check('clicking a previewable file opens the viewer',
      feat.viewerOpen && /notes\.md/.test(feat.viewerName), feat.viewerName);
check('pictures are marked for thumbnails', feat.thumbSlots > 0, feat.thumbSlots + ' rows');
check('the QR encoder returns a matrix', feat.qrSize >= 21, feat.qrSize + '×' + feat.qrSize);

/* a long name must ellipsise without shoving the "new" badge off the row */
const longRow = await evaluate(`(() => {
  const row = [...document.querySelectorAll('.item')]
    .find(r => r.querySelector('.freshdot') && r.querySelector('.item__name').textContent.length > 40);
  if (!row) return { skip: true };
  const b = row.querySelector('.freshdot').getBoundingClientRect();
  const r = row.getBoundingClientRect();
  return { badgeRight: Math.round(b.right), rowRight: Math.round(r.right),
           overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`);
check('a long name keeps its badge inside the row',
      longRow.skip || (longRow.badgeRight <= longRow.rowRight && longRow.overflow <= 0),
      longRow.skip ? 'no long+fresh row in the fixture'
                   : `badge ends at ${longRow.badgeRight}, row at ${longRow.rowRight}, page overflow ${longRow.overflow}px`);

/* language and theme are menus, not cycling toggles: the current choice
   must be readable before anything is clicked */
const menu = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btn = document.getElementById('m3l-lang');
  const el = document.querySelector('.menu'), card = el.querySelector('.menu__card');
  const langBefore = document.documentElement.lang;
  btn.click();
  const start = getComputedStyle(card).opacity;
  const expanded = btn.getAttribute('aria-expanded');
  await sleep(450);
  const rows = [...card.querySelectorAll('.menu__item')];
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect(), b = btn.getBoundingClientRect();
  return {
    hidden: el.hidden, expanded, start, end: cs.opacity,
    transition: cs.transition, transform: cs.transform,
    n: rows.length,
    role: card.getAttribute('role'), itemRole: rows[0].getAttribute('role'),
    checked: rows.filter(x => x.getAttribute('aria-checked') === 'true').length,
    onLabel: (rows.find(x => x.classList.contains('is-on')) || {}).textContent,
    ck: rows.map(x => getComputedStyle(x.querySelector('.menu__ck')).opacity),
    anchored: r.left >= b.right && r.top >= 0 && r.bottom <= innerHeight,
    langBefore, langNow: document.documentElement.lang
  };
})()`);
check('the language control opens a menu',
      !menu.hidden && menu.n === 3 && menu.role === 'menu' &&
      menu.itemRole === 'menuitemradio' && menu.expanded === 'true',
      `${menu.n} items, expanded=${menu.expanded}`);
check('the menu fades and scales in on the site\'s curve',
      menu.start === '0' && menu.end === '1' &&
      menu.transition.includes(EASE) && menu.transform === 'matrix(1, 0, 0, 1, 0, 0)',
      `${menu.start} → ${menu.end}, ${menu.transform}`);
check('exactly one option is ticked',
      menu.checked === 1 && menu.ck.filter(o => o === '1').length === 1,
      `${menu.onLabel} · checks ${menu.ck.join('/')}`);
check('the menu is anchored beside its button', menu.anchored, String(menu.anchored));
check('opening the menu alone changes nothing',
      menu.langBefore === menu.langNow, menu.langNow);

/* keyboard: arrows walk the options, Escape closes and hands focus back */
const mkeys = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fire = k => document.activeElement.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const first = document.activeElement.textContent;
  fire('ArrowDown'); const second = document.activeElement.textContent;
  fire('ArrowUp');   const back = document.activeElement.textContent;
  fire('Escape');    await sleep(400);
  return { first, second, back, closed: document.querySelector('.menu').hidden,
           focus: document.activeElement.id,
           cursors: document.querySelectorAll('.item.is-cursor').length };
})()`);
check('arrow keys walk the menu',
      mkeys.second !== mkeys.first && mkeys.back === mkeys.first,
      `${mkeys.first} → ${mkeys.second} → ${mkeys.back}`);
check('Escape closes it and returns focus to the button',
      mkeys.closed && mkeys.focus === 'm3l-lang', mkeys.focus);
check('the listing behind the menu ignores those keys',
      mkeys.cursors === 0, mkeys.cursors + ' rows moved');

/* picking relabels the chrome without a reload, and the choice is still
   ticked when the menu is reopened */
const picked = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btn = document.getElementById('m3l-lang');
  const card = document.querySelector('.menu__card');
  const before = document.querySelector('.tab').textContent;
  btn.click(); await sleep(60);
  [...card.querySelectorAll('.menu__item')][2].click();      /* English */
  await sleep(400);
  const en = { lang: document.documentElement.lang,
               tab: document.querySelector('.tab').textContent,
               closed: document.querySelector('.menu').hidden,
               stored: localStorage.getItem('m3l.lang') };
  btn.click(); await sleep(60);
  const rows = [...card.querySelectorAll('.menu__item')];
  en.reopened = (rows.find(x => x.classList.contains('is-on')) || {}).textContent;
  rows[0].click(); await sleep(350);                         /* back to system */
  return { before, en };
})()`);
check('picking a language relabels without a reload',
      picked.en.lang === 'en' && picked.en.tab !== picked.before &&
      picked.en.closed && picked.en.stored === 'en',
      `${picked.before} → ${picked.en.tab}`);
check('the reopened menu shows what was picked',
      /English/.test(picked.en.reopened || ''), picked.en.reopened);

const themeMenu = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btn = document.getElementById('m3l-theme');
  const card = document.querySelector('.menu__card');
  btn.click(); await sleep(60);
  const rows = [...card.querySelectorAll('.menu__item')];
  const icons = rows.map(x => (x.querySelector('.menu__lead') || {}).textContent);
  const sub = rows[0].querySelector('.menu__sub');
  const subText = sub && sub.textContent;
  rows[1].click(); await sleep(350);                         /* light */
  const light = document.documentElement.getAttribute('data-theme');
  btn.click(); await sleep(60);
  const ticked = (card.querySelector('.menu__item.is-on') || {}).textContent;
  const railTitle = btn.title;
  [...card.querySelectorAll('.menu__item')][0].click();      /* back to system */
  await sleep(350);
  return { icons, subText, light, ticked, railTitle,
           auto: document.documentElement.getAttribute('data-theme') };
})()`);
check('the theme menu carries one glyph per mode',
      themeMenu.icons.join(',') === 'contrast,light_mode,dark_mode',
      themeMenu.icons.join(', '));
check('the system option says which way the system leans',
      !!themeMenu.subText, themeMenu.subText);
check('picking a theme applies it and the button says so',
      themeMenu.light === 'light' && /Light|Светлая/.test(themeMenu.ticked || '') &&
      themeMenu.auto === null && /·/.test(themeMenu.railTitle),
      `${themeMenu.light} · ${themeMenu.ticked} · ${themeMenu.railTitle}`);
await sleep(700);   /* let the viewer finish closing before hover tests */

/* ---- 2c. multi-select ---- */
const sel = await evaluate(`(() => {
  const chips = document.querySelectorAll('.item__ico');
  chips[4].click(); chips[5].click();
  const bar = document.querySelector('.selbar');
  const n = document.querySelectorAll('.item.is-sel').length;
  document.querySelectorAll('.item__link')[8].dispatchEvent(
    new MouseEvent('click', { shiftKey: true, bubbles: true, cancelable: true }));
  return { n, range: document.querySelectorAll('.item.is-sel').length,
           label: bar.querySelector('.selbar__n').textContent,
           visible: !bar.hidden,
           dlEnabled: !document.getElementById('m3l-seldl').disabled };
})()`);
check('chips select rows', sel.n === 2, `${sel.n} selected`);
check('shift-click extends the range', sel.range === 5, `${sel.range} selected`);
check('action bar appears with a count', sel.visible && /5/.test(sel.label), sel.label);
check('download action is live for files', sel.dlEnabled, String(sel.dlEnabled));

/* ---- 3. hover really morphs shape / colour / FILL ---- */
const box = await evaluate(`(() => {
  const n = document.querySelectorAll('.item')[1];
  n.scrollIntoView({ block: 'center' });
  const r = n.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  const hit = document.elementFromPoint(x, y);
  return [x, y, hit ? (hit.className || hit.tagName) : 'nothing'];
})()`);
check('the hover probe actually lands on a row',
      /item/.test(String(box[2])), `hit ${box[2]} at ${box[0]},${box[1]}`);

const before = await evaluate(`(() => {
  const n = document.querySelectorAll('.item')[1];
  const i = n.querySelector('.item__ico');
  return { radius: getComputedStyle(n).borderRadius, bg: getComputedStyle(n).backgroundColor,
           icoRadius: getComputedStyle(i).borderRadius,
           fill: getComputedStyle(i.querySelector('.gs')).fontVariationSettings };
})()`);

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box[0], y: box[1] }, S);
await sleep(900);

const after = await evaluate(`(() => {
  const n = document.querySelectorAll('.item')[1];
  const i = n.querySelector('.item__ico');
  return { radius: getComputedStyle(n).borderRadius, bg: getComputedStyle(n).backgroundColor,
           icoRadius: getComputedStyle(i).borderRadius,
           fill: getComputedStyle(i.querySelector('.gs')).fontVariationSettings };
})()`);

check('row corner morphs on hover', before.radius !== after.radius, `${before.radius} → ${after.radius}`);
check('row surface lifts on hover', before.bg !== after.bg, `${before.bg} → ${after.bg}`);
check('icon chip morphs to a circle', before.icoRadius !== after.icoRadius,
      `${before.icoRadius} → ${after.icoRadius}`);
check('icon fills on hover', before.fill !== after.fill, `${before.fill} → ${after.fill}`);

/* hover screenshot for the record */
mkdirSync('screenshots', { recursive: true });
const shot = await send('Page.captureScreenshot', { format: 'png' }, S);
writeFileSync('screenshots/hover.png', Buffer.from(shot.data, 'base64'));

/* ---- 3b. the view switch heads the list, and the phone bar is short ---- */
await send('Emulation.setEmulatedMedia', { features: [] }, S);
await send('Page.navigate', { url: BASE }, S);
await sleep(2500);
const viewSwitch = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = document.getElementById('m3l-view');
  const bar = document.querySelector('.listbar').getBoundingClientRect();
  const tabs = document.querySelector('.tabs').getBoundingClientRect();
  const r = b.getBoundingClientRect();
  const inRail = !!document.querySelector('.rail #m3l-view');
  const first = b.querySelector('.gs').textContent;
  b.click(); await sleep(400);
  const grid = document.querySelector('.list').classList.contains('grid');
  const second = b.querySelector('.gs').textContent;
  b.click(); await sleep(400);
  return { inRail, first, second, grid,
           rightAligned: Math.abs(r.right - bar.right) < 2 && r.left >= tabs.right - 1,
           sameRow: Math.abs(r.top - tabs.top) < 2,
           aboveList: r.bottom <= document.querySelector('.list').getBoundingClientRect().top };
})()`);
check('the view switch sits at the right of the list header, not in the rail',
      !viewSwitch.inRail && viewSwitch.rightAligned && viewSwitch.sameRow && viewSwitch.aboveList,
      `rail=${viewSwitch.inRail}, right=${viewSwitch.rightAligned}, row=${viewSwitch.sameRow}`);
check('it switches the list and says what it will do next',
      viewSwitch.grid && viewSwitch.first === 'grid_view' && viewSwitch.second === 'view_list',
      `${viewSwitch.first} → ${viewSwitch.second}`);

await send('Emulation.setDeviceMetricsOverride',
  { width: 400, height: 860, deviceScaleFactor: 2, mobile: true }, S);
await sleep(600);
const phoneBar = await evaluate(`(() => {
  const rail = document.querySelector('.rail');
  const shown = [...rail.querySelectorAll('.rail-item')].filter(n => n.offsetParent !== null);
  return { ids: shown.map(n => n.id), horizontal: rail.getBoundingClientRect().width > 300,
           overflows: rail.scrollWidth > rail.clientWidth + 1,
           viewH: Math.round(document.getElementById('m3l-view').getBoundingClientRect().height) };
})()`);
check('the phone bar drops Select and stops overflowing',
      phoneBar.horizontal && phoneBar.ids.length === 5 &&
      phoneBar.ids.indexOf('m3l-pick') === -1 && !phoneBar.overflows,
      phoneBar.ids.join(', '));
check('the view switch shrinks with the sort strip on a phone',
      phoneBar.viewH === 68, phoneBar.viewH + 'px');

/* a long press is how selection starts where there is no Select button */
const longPress = await evaluate(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const row = document.querySelector('.item');
  const touch = t => row.dispatchEvent(new Event(t, { bubbles: true }));
  touch('touchstart'); await sleep(650); touch('touchend');
  const picking = document.documentElement.classList.contains('is-picking');
  const selected = document.querySelectorAll('.item.is-sel').length;
  const nav = location.pathname;
  row.querySelector('.item__link').click();      /* the tap that ends the press */
  await sleep(200);
  const stayed = location.pathname === nav;
  document.getElementById('m3l-selclear').click(); await sleep(300);
  return { picking, selected, stayed,
           cleared: document.querySelectorAll('.item.is-sel').length };
})()`);
check('a long press starts selection on touch',
      longPress.picking && longPress.selected === 1,
      `picking=${longPress.picking}, ${longPress.selected} selected`);
check('the tap that ends the press does not also open the row',
      longPress.stayed && longPress.cleared === 0, String(longPress.stayed));

await send('Emulation.clearDeviceMetricsOverride', {}, S);

/* ---- 4. reduced motion zeroes everything ---- */
await send('Emulation.setEmulatedMedia',
  { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, S);
await send('Page.navigate', { url: BASE }, S);
await sleep(2500);
const reduced = await evaluate(
  `getComputedStyle(document.querySelector('.item')).transitionDuration`);
check('prefers-reduced-motion zeroes transitions',
      reduced.split(',').every(v => parseFloat(v) < 0.005), reduced);

ws.close(); chrome.kill();

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
}
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
