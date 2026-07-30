/* =====================================================================
   m3listing — nginx autoindex re-rendered as an m3.material.io page.
   Runs entirely in the browser: it reads the plain <pre> block nginx
   already produced and builds the UI from it. No backend involved.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Config — override by defining window.M3LISTING before this script.
     ------------------------------------------------------------------ */
  var REPO = 'https://github.com/nd4y/material3-listing';

  var CFG = Object.assign({
    title: null,                      // brand name; defaults to the hostname
    repoUrl: REPO,                    // credit link in the footer
    lang: 'auto',                     // 'auto' | 'ru' | 'en'
    hide: ['@eaDir', '.betterlisting', '.m3listing', 'Thumbs.db',
           '.DS_Store', 'desktop.ini', '#recycle', '#snapshot']
  }, window.M3LISTING || {});

  /* `siteName` was the old name for `title` */
  var BRAND = CFG.title || CFG.siteName || location.host;

  /* ------------------------------------------------------------------
     i18n
     ------------------------------------------------------------------ */
  var STR = {
    ru: {
      search: 'Поиск в этом каталоге', up: 'Наверх', root: 'Корень', home: 'Корень',
      name: 'Имя', date: 'Дата', size: 'Размер', theme: 'Тема',
      find: 'Поиск', close: 'Закрыть',
      viewList: 'Список', viewGrid: 'Сетка',
      copy: 'Скопировать ссылку', download: 'Скачать', copied: 'Ссылка скопирована',
      pick: 'Выбрать', selected: 'Выбрано:', dl: 'Скачать', links: 'Ссылки',
      dlStarted: 'Загрузка: {n}', copiedN: 'Скопировано ссылок: {n}',
      nothing: 'Ничего не найдено', emptyDir: 'Каталог пуст', clear: 'Очистить',
      dirs: ['каталог', 'каталога', 'каталогов'], files: ['файл', 'файла', 'файлов'],
      folder: 'каталог', empty: 'пусто'
    },
    en: {
      search: 'Search this folder', up: 'Up', root: 'Root', home: 'Root',
      name: 'Name', date: 'Date', size: 'Size', theme: 'Theme',
      find: 'Search', close: 'Close',
      viewList: 'List', viewGrid: 'Grid',
      copy: 'Copy link', download: 'Download', copied: 'Link copied',
      pick: 'Select', selected: 'Selected:', dl: 'Download', links: 'Links',
      dlStarted: 'Downloading {n}', copiedN: '{n} links copied',
      nothing: 'Nothing found', emptyDir: 'This folder is empty', clear: 'Clear',
      dirs: ['folder', 'folders', 'folders'], files: ['file', 'files', 'files'],
      folder: 'folder', empty: 'empty'
    }
  };
  var LANG = CFG.lang === 'auto'
    ? (/^ru\b/i.test(navigator.language || '') ? 'ru' : 'en')
    : CFG.lang;
  var T = STR[LANG] || STR.en;
  var LOCALE = LANG === 'ru' ? 'ru-RU' : 'en-GB';

  function plural(n, forms) {
    if (LANG !== 'ru') return n === 1 ? forms[0] : forms[1];
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  /* ------------------------------------------------------------------
     Icons.

     Primary rendering is the Google Symbols webfont — the same face
     m3.material.io uses — as ligature text, so the FILL axis can be
     animated on hover exactly like the site does it. If the font does
     not arrive (offline, blocked, privacy setup with the @import
     removed) every glyph is swapped for the inline SVG below, which is
     the same Material Symbols artwork.
     ------------------------------------------------------------------ */
  var P = {
    folder: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z',
    folder_open: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h360q17 0 28.5 11.5T880-680q0 17-11.5 28.5T840-640H447l-80-80H160v480l79-263q8-26 29.5-41.5T316-560h516q41 0 64.5 32.5T909-457l-72 240q-8 26-29.5 41.5T760-160H160Zm84-80h516l72-240H316l-72 240Z',
    home: 'M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Z',
    arrow_upward: 'M440-647 244-451q-12 12-28 11.5T188-452q-11-12-11.5-28t11.5-28l264-264q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l264 264q11 11 11 27.5T772-452q-12 12-28.5 12T715-452L520-647v447q0 17-11.5 28.5T480-160q-17 0-28.5-11.5T440-200v-447Z',
    arrow_downward: 'M440-313v-447q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v447l196-196q12-12 28-11.5t28 12.5q11 12 11.5 28T772-452L508-188q-6 6-13 8.5t-15 2.5q-8 0-15-2.5t-13-8.5L188-452q-11-11-11-27.5t11-28.5q12-12 28.5-12t28.5 12l195 195Z',
    search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
    close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
    grid_view: 'M200-520q-33 0-56.5-23.5T120-600v-160q0-33 23.5-56.5T200-840h160q33 0 56.5 23.5T440-760v160q0 33-23.5 56.5T360-520H200Zm0 400q-33 0-56.5-23.5T120-200v-160q0-33 23.5-56.5T200-440h160q33 0 56.5 23.5T440-360v160q0 33-23.5 56.5T360-120H200Zm400-400q-33 0-56.5-23.5T520-600v-160q0-33 23.5-56.5T600-840h160q33 0 56.5 23.5T840-760v160q0 33-23.5 56.5T760-520H600Zm0 400q-33 0-56.5-23.5T520-200v-160q0-33 23.5-56.5T600-440h160q33 0 56.5 23.5T840-360v160q0 33-23.5 56.5T760-120H600ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Z',
    view_list: 'M120-280v-400q0-33 23.5-56.5T200-760h560q33 0 56.5 23.5T840-680v400q0 33-23.5 56.5T760-200H200q-33 0-56.5-23.5T120-280Zm80-320h80v-80h-80v80Zm160 0h400v-80H360v80Zm0 160h400v-80H360v80Zm0 160h400v-80H360v80Zm-160 0h80v-80h-80v80Zm0-160h80v-80h-80v80Z',
    dark_mode: 'M480-120q-151 0-255.5-104.5T120-480q0-138 90-239.5T440-838q13-2 23 3.5t16 14.5q6 9 6.5 21t-7.5 23q-17 26-25.5 55t-8.5 61q0 90 63 153t153 63q31 0 61.5-9t54.5-25q11-7 22.5-6.5T819-479q10 5 15.5 15t3.5 24q-14 138-117.5 229T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Z',
    light_mode: 'M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM80-440q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h80q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440H80Zm720 0q-17 0-28.5-11.5T760-480q0-17 11.5-28.5T800-520h80q17 0 28.5 11.5T920-480q0 17-11.5 28.5T880-440h-80ZM480-760q-17 0-28.5-11.5T440-800v-80q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v80q0 17-11.5 28.5T480-760Zm0 720q-17 0-28.5-11.5T440-80v-80q0-17 11.5-28.5T480-200q17 0 28.5 11.5T520-160v80q0 17-11.5 28.5T480-40ZM226-678l-43-42q-12-11-11.5-28t11.5-29q12-12 29-12t28 12l42 43q11 12 11 28t-11 28q-11 12-27.5 11.5T226-678Zm494 495-42-43q-11-12-11-28.5t11-27.5q11-12 27.5-11.5T734-282l43 42q12 11 11.5 28T777-183q-12 12-29 12t-28-12Zm-42-495q-12-11-11.5-27.5T678-734l42-43q11-12 28-11.5t29 11.5q12 12 12 29t-12 28l-43 42q-12 11-28 11t-28-11ZM183-183q-12-12-12-29t12-28l43-42q12-11 28.5-11t27.5 11q12 11 11.5 27.5T282-226l-42 43q-11 12-28 11.5T183-183Z',
    contrast: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm40-82q122-15 201-105t79-213q0-123-79-213t-201-105v636Z',
    download: 'M480-337q-8 0-15-2.5t-13-8.5L308-492q-12-12-11.5-28t11.5-28q12-12 28.5-12.5T365-549l75 75v-286q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v286l75-75q12-12 28.5-11.5T652-548q11 12 11.5 28T652-492L508-348q-6 6-13 8.5t-15 2.5ZM240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Z',
    chevron_right: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
    link: 'M280-280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h120q17 0 28.5 11.5T440-640q0 17-11.5 28.5T400-600H280q-50 0-85 35t-35 85q0 50 35 85t85 35h120q17 0 28.5 11.5T440-320q0 17-11.5 28.5T400-280H280Zm80-160q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520h240q17 0 28.5 11.5T640-480q0 17-11.5 28.5T600-440H360Zm200 160q-17 0-28.5-11.5T520-320q0-17 11.5-28.5T560-360h120q50 0 85-35t35-85q0-50-35-85t-85-35H560q-17 0-28.5-11.5T520-640q0-17 11.5-28.5T560-680h120q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H560Z',
    description: 'M360-240h240q17 0 28.5-11.5T640-280q0-17-11.5-28.5T600-320H360q-17 0-28.5 11.5T320-280q0 17 11.5 28.5T360-240Zm0-160h240q17 0 28.5-11.5T640-440q0-17-11.5-28.5T600-480H360q-17 0-28.5 11.5T320-440q0 17 11.5 28.5T360-400ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640Z',
    draft: 'M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640Z',
    text_snippet: 'M200-200h560v-367L567-760H200v560Zm0 80q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h367q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v367q0 33-23.5 56.5T760-120H200Zm120-160h320q17 0 28.5-11.5T680-320q0-17-11.5-28.5T640-360H320q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160h320q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160h200q17 0 28.5-11.5T560-640q0-17-11.5-28.5T520-680H320q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Z',
    image: 'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h400q12 0 18-11t-2-21L586-459q-6-8-16-8t-16 8L450-320l-74-99q-6-8-16-8t-16 8l-80 107q-8 10-2 21t18 11Z',
    movie: 'm160-800 65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h80l65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h80l65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h120q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800Zm0 240v320h640v-320H160Z',
    music_note: 'M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-382q0-17 11.5-28.5T520-840h160q17 0 28.5 11.5T720-800v80q0 17-11.5 28.5T680-680H560v400q0 66-47 113t-113 47Z',
    folder_zip: 'M640-480v-80h80v80h-80Zm0 80h-80v-80h80v80Zm0 80v-80h80v80h-80ZM447-640l-80-80H160v480h400v-80h80v80h160v-400H640v80h-80v-80H447ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z',
    picture_as_pdf: 'M400-540h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-60q-8 0-14 6t-6 14v160q0 8 6 14t14 6q8 0 14-6t6-14v-60Zm0-40v-40h40v40h-40Zm200 120q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-60q-8 0-14 6t-6 14v160q0 8 6 14t14 6h60Zm-40-40v-120h40v120h-40Zm160-40h20q8 0 14-6t6-14q0-8-6-14t-14-6h-20v-40h20q8 0 14-6t6-14q0-8-6-14t-14-6h-40q-8 0-14 6t-6 14v160q0 8 6 14t14 6q8 0 14-6t6-14v-60ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-520q0-17 11.5-28.5T120-720q17 0 28.5 11.5T160-680v520h520q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H160Z',
    code: 'm193-479 155 155q11 11 11 28t-11 28q-11 11-28 11t-28-11L108-452q-6-6-8.5-13T97-480q0-8 2.5-15t8.5-13l184-184q12-12 28.5-12t28.5 12q12 12 12 28.5T349-635L193-479Zm574-2L612-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L668-268q-12 12-28 11.5T612-269q-12-12-12-28.5t12-28.5l155-155Z',
    terminal: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm187-200-76-76q-12-12-11.5-28t12.5-28q12-11 28-11.5t28 11.5l104 104q12 12 12 28t-12 28L328-308q-11 11-27.5 11.5T272-308q-11-11-11-28t11-28l75-76Zm173 160q-17 0-28.5-11.5T480-320q0-17 11.5-28.5T520-360h160q17 0 28.5 11.5T720-320q0 17-11.5 28.5T680-280H520Z',
    album: 'M480-300q75 0 127.5-52.5T660-480q0-75-52.5-127.5T480-660q-75 0-127.5 52.5T300-480q0 75 52.5 127.5T480-300Zm0-140q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z',
    deployed_code: 'M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Z',
    table: 'M120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80-400h560v-160H200v160Zm213 200h134v-120H413v120Zm0 200h134v-120H413v120ZM200-400h133v-120H200v120Zm427 0h133v-120H627v120ZM200-200h133v-120H200v120Zm427 0h133v-120H627v120Z',
    slideshow: 'M634-463q9-6 9-17t-9-17L411-640q-10-7-20.5-1T380-623v286q0 12 10.5 18t20.5-1l223-143ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z',
    subtitles: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm120-80h240q17 0 28.5-11.5T560-360q0-17-11.5-28.5T520-400H280q-17 0-28.5 11.5T240-360q0 17 11.5 28.5T280-320Zm160-160h240q17 0 28.5-11.5T720-520q0-17-11.5-28.5T680-560H440q-17 0-28.5 11.5T400-520q0 17 11.5 28.5T440-480Zm-160 0q17 0 28.5-11.5T320-520q0-17-11.5-28.5T280-560q-17 0-28.5 11.5T240-520q0 17 11.5 28.5T280-480Zm400 160q17 0 28.5-11.5T720-360q0-17-11.5-28.5T680-400q-17 0-28.5 11.5T640-360q0 17 11.5 28.5T680-320Z',
    font_download: 'M384-362h192l35 97q4 11 14 18t22 7q20 0 32.5-16.5T684-293L532-695q-5-11-15-18t-22-7h-30q-12 0-22 7t-15 18L276-293q-8 19 4 36t32 17q13 0 22.5-7t14.5-19l35-96Zm24-70 70-198h4l70 198H408ZM160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v640q0 33-23.5 56.5T800-80H160Zm0-80h640v-640H160v640Z',
    database: 'M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z',
    key: 'M280-400q-33 0-56.5-23.5T200-480q0-33 23.5-56.5T280-560q33 0 56.5 23.5T360-480q0 33-23.5 56.5T280-400Zm0 160q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h335q8 0 15.5 3t13.5 9l80 80q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L805-325q-5 5-12 8t-14 4q-7 1-14-1t-13-7l-52-39-57 43q-5 4-11 6t-12 2q-6 0-12.5-2t-11.5-6l-61-43h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41v.5-.5l82-61 71 55 75-75h-.5.5l-40-40v-.5.5H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z',
    check: 'm382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z',
    check_box: 'm424-424-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-424ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z',
    settings: 'M433-80q-27 0-46.5-18T363-142l-9-66q-13-5-24.5-12T307-235l-62 26q-25 11-50 2t-39-32l-47-82q-14-23-8-49t27-43l53-40q-1-7-1-13.5v-27q0-6.5 1-13.5l-53-40q-21-17-27-43t8-49l47-82q14-23 39-32t50 2l62 26q11-8 23-15t24-12l9-66q4-26 23.5-44t46.5-18h94q27 0 46.5 18t23.5 44l9 66q13 5 24.5 12t22.5 15l62-26q25-11 50-2t39 32l47 82q14 23 8 49t-27 43l-53 40q1 7 1 13.5v27q0 6.5-2 13.5l53 40q21 17 27 43t-8 49l-48 82q-14 23-39 32t-50-2l-60-26q-11 8-23 15t-24 12l-9 66q-4 26-23.5 44T527-80h-94Zm7-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Z'
  };

  var GS_MODE = 'pending';        // 'pending' | 'font' | 'svg'

  function icon(name, cls, fb) {
    var s = document.createElement('span');
    s.className = 'gs' + (cls ? ' ' + cls : '');
    s.setAttribute('aria-hidden', 'true');
    s.dataset.i = name;
    if (fb) s.dataset.fb = fb;
    s.textContent = name;
    if (GS_MODE === 'svg') toSvg(s);
    return s;
  }

  /* The webfont carries a glyph for every extension below; the bundled SVG
     set is deliberately coarser (one per family), so a fine-grained name
     falls back to its family's artwork rather than bloating this file. */
  function toSvg(span) {
    var name = span.dataset.i || span.textContent.trim();
    span.textContent = '';
    span.classList.add('gs-svg');
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 -960 960 960');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', P[name] || P[span.dataset.fb] || P.draft);
    s.appendChild(p);
    span.appendChild(s);
  }

  /* Ask for the face, then decide once. Until then the CSS keeps every
     ligature invisible, so the glyph names never flash as words. */
  function resolveIcons() {
    var finish = function (ok) {
      if (GS_MODE !== 'pending') return;
      GS_MODE = ok ? 'font' : 'svg';
      if (!ok) Array.prototype.forEach.call(document.querySelectorAll('.gs'), toSvg);
      document.documentElement.classList.add('gs-ready');
    };
    setTimeout(function () { finish(false); }, 2000);
    if (!document.fonts || !document.fonts.load) { finish(false); return; }
    document.fonts.load('24px "Google Symbols"').then(function () {
      finish(document.fonts.check('24px "Google Symbols"'));
    }, function () { finish(false); });
  }

  /* ------------------------------------------------------------------
     Extension → { icon, accent, svg fallback }.

     The glyph is per extension — .html, .css, .js, .json, .py and .sh do
     not all deserve the same `code` mark. The accent is per family, so the
     page keeps eight colours rather than eighty: a1 directories, a2
     archives and disk images, a3 pictures and video, a4 audio and sheets,
     a5 everything else, a6 executables and installers, a7 documents, code,
     config and crypto, a8 PDF. All eight are container colours lifted from
     m3.material.io's own badges, fabs and pills.
     ------------------------------------------------------------------ */
  var EXT = {};
  function reg(exts, glyph, acc, fb) {
    exts.split(' ').forEach(function (e) {
      EXT[e] = { icon: glyph, acc: acc, fb: fb || glyph };
    });
  }

  var DIR_KIND  = { icon: 'folder', acc: 'a1', fb: 'folder' };
  var FILE_KIND = { icon: 'draft',  acc: 'a5', fb: 'draft'  };

  /* pictures */
  reg('jpg jpeg jfif jpe',            'photo_camera',  'a3', 'image');
  reg('png webp avif heic heif',      'image',         'a3', 'image');
  reg('gif',                          'gif_box',       'a3', 'image');
  reg('bmp',                          'wallpaper',     'a3', 'image');
  reg('tif tiff',                     'filter',        'a3', 'image');
  reg('ico icns',                     'widgets',       'a3', 'image');
  reg('svg svgz ai eps',              'draw',          'a3', 'image');
  reg('psd xcf kra',                  'brush',         'a3', 'image');
  reg('raw cr2 cr3 nef arw dng orf',  'raw_on',        'a3', 'image');

  /* video */
  reg('mp4 m4v mov',                  'movie',         'a3', 'movie');
  reg('mkv webm',                     'local_movies',  'a3', 'movie');
  reg('avi wmv flv mpg mpeg ts m2ts vob 3gp ogv', 'videocam', 'a3', 'movie');

  /* audio */
  reg('mp3',                          'music_note',    'a4', 'music_note');
  reg('flac wav aiff ape',            'graphic_eq',    'a4', 'music_note');
  reg('m4a aac ogg oga opus wma mid midi', 'audio_file', 'a4', 'music_note');

  /* archives */
  reg('zip tar tgz gz bz2 tbz xz zst lz lzma z', 'folder_zip', 'a2', 'folder_zip');
  reg('rar arj',                      'archive',       'a2', 'folder_zip');
  reg('7z',                           'inventory_2',   'a2', 'folder_zip');
  reg('cab',                          'package_2',     'a2', 'folder_zip');

  /* disk images and virtual machines */
  reg('iso',                          'album',         'a2', 'album');
  reg('img dmg nrg mdf cue',          'disc_full',     'a2', 'album');
  reg('vhd vhdx vmdk ova ovf qcow2 svm', 'hard_drive', 'a2', 'album');
  reg('wim esd',                      'storage',       'a2', 'album');

  /* executables, libraries, installers */
  reg('exe com',                      'deployed_code', 'a6', 'deployed_code');
  reg('msi msix msp appx',            'package_2',     'a6', 'deployed_code');
  reg('msu',                          'update',        'a6', 'deployed_code');
  reg('dll so dylib sys ocx',         'memory',        'a6', 'deployed_code');
  reg('lib a',                        'inventory',     'a6', 'deployed_code');
  reg('exp def map',                  'schema',        'a6', 'deployed_code');
  reg('apk aab',                      'android',       'a6', 'deployed_code');
  reg('deb rpm pkg snap flatpak',     'inventory_2',   'a6', 'deployed_code');
  reg('appimage run jar',             'terminal',      'a6', 'deployed_code');
  reg('sh bash zsh fish ksh bat cmd ps1 psm1', 'terminal', 'a6', 'terminal');

  /* certificates, keys, signatures */
  reg('pem',                          'verified_user', 'a7', 'key');
  reg('key ppk',                      'key',           'a7', 'key');
  reg('pfx p12',                      'password',      'a7', 'key');
  reg('crt cer der',                  'badge',         'a7', 'key');
  reg('pub',                          'vpn_key',       'a7', 'key');
  reg('csr',                          'contract',      'a7', 'key');
  reg('srl',                          'token',         'a7', 'key');
  reg('cms p7b p7s',                  'encrypted',     'a7', 'key');
  reg('ors',                          'policy',        'a7', 'key');
  reg('attr',                         'label',         'a7', 'key');
  reg('gpg asc sig',                  'lock',          'a7', 'key');
  reg('kdbx',                         'shield',        'a7', 'key');
  reg('lic',                          'workspace_premium', 'a7', 'key');

  /* markup, code, config */
  reg('html htm xhtml',               'html',          'a7', 'code');
  reg('css scss sass less',           'css',           'a7', 'code');
  reg('js mjs cjs jsx ts tsx',        'javascript',    'a7', 'code');
  reg('php',                          'php',           'a7', 'code');
  reg('json json5',                   'data_object',   'a7', 'code');
  reg('xml plist xsd xsl',            'data_array',    'a7', 'code');
  reg('yaml yml toml ini conf cnf cfg env properties reg service', 'settings', 'a7', 'settings');
  reg('py ipynb',                     'code_blocks',   'a7', 'code');
  reg('c cc cpp cxx java kt go rs rb lua swift scala vb asm cs r tf hcl', 'code', 'a7', 'code');
  reg('h hpp hxx',                    'integration_instructions', 'a7', 'code');
  reg('pl pm t pod',                  'api',           'a7', 'code');
  reg('sct vbs wsf',                  'frame_source',  'a7', 'code');
  reg('tmpl inc',                     'web_asset',     'a7', 'code');
  reg('sql',                          'database',      'a7', 'database');
  reg('db sqlite sqlite3 mdb accdb',  'storage',       'a7', 'database');
  reg('dump bak',                     'backup',        'a7', 'database');

  /* documents */
  reg('txt utf8 full text',           'article',       'a7', 'text_snippet');
  reg('md markdown rst adoc',         'notes',         'a7', 'text_snippet');
  reg('log',                          'list_alt',      'a7', 'text_snippet');
  reg('nfo readme me',                'sticky_note_2', 'a7', 'text_snippet');
  reg('doc docx odt rtf pages',       'description',   'a7', 'description');
  reg('epub fb2 mobi azw3 djvu',      'menu_book',     'a7', 'description');
  reg('ics ical',                     'event',         'a7', 'description');
  reg('rdp vnc ica',                  'desktop_windows', 'a7', 'description');
  reg('dat bin msb external',         'save',          'a5', 'draft');
  reg('pdf xps',                      'picture_as_pdf','a8', 'picture_as_pdf');

  /* sheets and slides */
  reg('xls xlsx xlsm ods numbers',    'table',         'a4', 'table');
  reg('csv tsv',                      'grid_on',       'a4', 'table');
  reg('ppt pptx odp key-note',        'slideshow',     'a7', 'slideshow');

  /* the rest */
  reg('ttf otf woff woff2 eot fon',   'font_download', 'a5', 'font_download');
  reg('srt ass ssa sub vtt idx',      'subtitles',     'a5', 'subtitles');
  reg('torrent magnet',               'link',          'a5', 'link');
  reg('lnk url webloc',               'link',          'a5', 'link');

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

  /* nginx prints either an exact byte count (autoindex_exact_size on) or
     a rounded "732M" token. Only the former is worth showing verbatim. */
  function parseSize(tok) {
    if (!tok || tok === '-') return null;
    var m = /^([\d.]+)([KMGTP])?$/i.exec(tok);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    if (!m[2]) return { bytes: v, exact: true };
    var pow = 'kmgtp'.indexOf(m[2].toLowerCase()) + 1;
    return { bytes: Math.round(v * Math.pow(1024, pow)), exact: false };
  }

  var UNITS = LANG === 'ru'
    ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes.toLocaleString(LOCALE) + ' ' + UNITS[0];
    var i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
    var v = bytes / Math.pow(1024, i);
    return v.toLocaleString(LOCALE, {
      minimumFractionDigits: v < 10 ? 1 : 0,
      maximumFractionDigits: v < 10 ? 1 : 0
    }) + ' ' + UNITS[i];
  }

  var DATE_FMT = new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  function ext(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  function kindOf(entry) {
    if (entry.isDir) return DIR_KIND;
    return EXT[ext(entry.name)] || FILE_KIND;
  }

  /* every ligature the page can ask the webfont for — the test suite
     renders each one and fails if it comes back as letters */
  window.M3L_GLYPHS = (function () {
    var seen = { folder: 1, draft: 1 };
    Object.keys(EXT).forEach(function (e) { seen[EXT[e].icon] = 1; });
    ['folder_open', 'home', 'arrow_upward', 'arrow_downward', 'search', 'close',
     'grid_view', 'view_list', 'check_box', 'check', 'contrast', 'light_mode',
     'dark_mode', 'download', 'chevron_right', 'link'].forEach(function (n) { seen[n] = 1; });
    return Object.keys(seen);
  })();

  /* ------------------------------------------------------------------
     Read the nginx autoindex output
     ------------------------------------------------------------------ */
  var META_RE = /(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})\s+(\S+)\s*$/;

  function readEntries(pre) {
    var out = [], parentHref = null;
    var links = pre.querySelectorAll('a');

    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href') || '';
      if (!href) continue;
      if (href === '../') { parentHref = href; continue; }

      var isDir = href.charAt(href.length - 1) === '/';
      var name;
      try { name = decodeURIComponent(isDir ? href.slice(0, -1) : href); }
      catch (e) { name = isDir ? href.slice(0, -1) : href; }

      if (CFG.hide.indexOf(name) !== -1) continue;

      var meta = a.nextSibling && a.nextSibling.nodeType === 3 ? a.nextSibling.nodeValue : '';
      var m = META_RE.exec(meta.replace(/[\r\n]+$/, ''));
      var date = null, size = null, exact = false;
      if (m) {
        date = new Date(+m[3], MONTHS[m[2]] || 0, +m[1], +m[4], +m[5]);
        var s = isDir ? null : parseSize(m[6]);
        if (s) { size = s.bytes; exact = s.exact; }
      }
      out.push({ href: href, name: name, isDir: isDir, date: date, size: size, exact: exact });
    }
    return { entries: out, parentHref: parentHref };
  }

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  var LS = {
    get: function (k, d) { try { return localStorage.getItem('m3l.' + k) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('m3l.' + k, v); } catch (e) {} }
  };

  var state = {
    query: '',
    sort: LS.get('sort', 'name'),
    desc: LS.get('desc', '0') === '1',
    view: LS.get('view', 'list'),
    cursor: -1,
    entries: [],
    visible: [],
    sel: Object.create(null),   // href → true
    selN: 0,
    picking: false,
    anchor: null
  };

  var $ = {};

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    var raw = document.querySelector('.rawwrap');
    var pre = raw && raw.querySelector('pre');
    var ui = document.querySelector('.m3l');
    if (!raw || !pre || !ui) { bail(); return; }

    var read = readEntries(pre);
    state.entries = read.entries;

    var h1 = raw.querySelector('h1');
    var path = h1 ? (h1.textContent || '').replace(/^Index of\s*/, '').trim() : '';
    if (!path) { try { path = decodeURIComponent(location.pathname); } catch (e) { path = location.pathname; } }
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.charAt(path.length - 1) !== '/') path += '/';

    buildChrome(ui, path, read.parentHref);
    render();
    resolveIcons();
    document.documentElement.classList.add('m3l-ready');
  }

  function bail() {
    document.documentElement.classList.remove('m3l-js');
  }

  /* ------------------------------------------------------------------
     Chrome
     ------------------------------------------------------------------ */
  function buildChrome(ui, path, parentHref) {
    var segs = path.split('/').filter(Boolean);
    var current = segs.length ? segs[segs.length - 1] : BRAND;

    document.title = segs.length ? current + ' · ' + BRAND : BRAND;

    /* hero */
    $.title = ui.querySelector('.hero__title');
    $.title.textContent = current;
    var sub = ui.querySelector('.hero__sub');
    sub.textContent = path;
    sub.hidden = segs.length === 0;   /* "/" under the site name says nothing */

    /* breadcrumbs */
    var crumbs = ui.querySelector('.crumbs');
    crumbs.textContent = '';
    var rootA = el('a', null, BRAND);
    rootA.href = '/';
    crumbs.appendChild(rootA);
    var acc = '';
    segs.forEach(function (s, idx) {
      acc += '/' + encodeURIComponent(s);
      var sep = el('span', 'sep');
      sep.appendChild(icon('chevron_right'));
      crumbs.appendChild(sep);
      if (idx === segs.length - 1) {
        crumbs.appendChild(el('span', 'cur', s));
      } else {
        var a = el('a', null, s);
        a.href = acc + '/';
        crumbs.appendChild(a);
      }
    });
    crumbs.scrollLeft = crumbs.scrollWidth;

    /* rail */
    var home = document.getElementById('m3l-home');
    home.querySelector('.rail-item__lbl').textContent = T.home;
    home.classList.toggle('is-on', segs.length === 0);

    $.up = document.getElementById('m3l-up');
    $.up.querySelector('.rail-item__lbl').textContent = T.up;
    if (!segs.length) $.up.disabled = true;
    else $.up.addEventListener('click', function () { location.href = parentHref || '../'; });

    $.view = document.getElementById('m3l-view');
    $.view.addEventListener('click', function () {
      state.view = state.view === 'list' ? 'grid' : 'list';
      LS.set('view', state.view);
      syncView(); render();
    });
    syncView();

    /* multi-select */
    $.pick = document.getElementById('m3l-pick');
    $.pick.querySelector('.rail-item__lbl').textContent = T.pick;
    $.pick.addEventListener('click', function () { setPicking(!state.picking); });

    $.selbar = document.querySelector('.selbar');
    $.seldl = document.getElementById('m3l-seldl');
    $.selcopy = document.getElementById('m3l-selcopy');
    $.seldl.querySelector('.selbar__t').textContent = T.dl;
    $.selcopy.querySelector('.selbar__t').textContent = T.links;
    $.seldl.addEventListener('click', downloadSelected);
    $.selcopy.addEventListener('click', copySelected);
    document.getElementById('m3l-selclear').addEventListener('click', function () {
      clearSel(); setPicking(false);
    });

    $.theme = document.getElementById('m3l-theme');
    $.theme.title = T.theme;
    $.theme.querySelector('.rail-item__lbl').textContent = T.theme;
    $.theme.addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      var next = order[(order.indexOf(LS.get('theme', 'auto')) + 1) % 3];
      LS.set('theme', next);
      applyTheme(next);
      syncTheme(next);
    });
    syncTheme(LS.get('theme', 'auto'));

    /* search — the panel is collapsed until the rail button opens it */
    $.q = document.getElementById('m3l-q');
    $.q.placeholder = T.search;
    $.clear = document.getElementById('m3l-clear');
    $.clear.title = T.clear;
    $.wrap = document.getElementById('m3l-searchwrap');
    $.fab = document.getElementById('m3l-searchfab');
    $.fab.querySelector('.rail-item__lbl').textContent = T.find;
    syncSearch(false);

    $.q.addEventListener('input', function () {
      state.query = $.q.value.trim();
      state.cursor = -1;
      $.clear.hidden = !state.query;
      render();
    });
    $.clear.addEventListener('click', function () {
      $.q.value = ''; state.query = ''; $.clear.hidden = true; render(); $.q.focus();
    });
    $.fab.addEventListener('click', function () {
      openSearch(!$.wrap.classList.contains('is-open'));
    });

    /* sort tabs */
    $.tabs = ui.querySelector('.tabs');
    ['name', 'date', 'size'].forEach(function (k) {
      var b = $.tabs.querySelector('[data-sort="' + k + '"]');
      b.textContent = T[k];
      b.appendChild(icon('arrow_upward', 'dir'));
      b.addEventListener('click', function () {
        if (state.sort === k) state.desc = !state.desc;
        else { state.sort = k; state.desc = (k !== 'name'); }
        LS.set('sort', state.sort); LS.set('desc', state.desc ? '1' : '0');
        syncSort(); render();
      });
    });
    syncSort();

    /* footer */
    var fa = ui.querySelector('.foot a');
    fa.href = CFG.repoUrl || REPO;
    fa.textContent = (CFG.repoUrl || REPO).replace(/^https?:\/\//, '');
    fa.rel = 'noopener';
    fa.target = '_blank';

    /* empty state icon is already in the markup */

    /* sticky shadow */
    var bar = ui.querySelector('.navbar');
    var onScroll = function () { bar.classList.toggle('is-stuck', window.scrollY > 6); };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('keydown', onKey);
  }

  function syncSort() {
    ['name', 'date', 'size'].forEach(function (k) {
      var b = $.tabs.querySelector('[data-sort="' + k + '"]');
      var on = state.sort === k;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('data-desc', on && state.desc ? '1' : '0');
    });
  }

  function swapIcon(host, name) {
    host.replaceChild(icon(name), host.querySelector('.gs'));
  }

  /* --- search panel ------------------------------------------------- */
  function syncSearch(open) {
    $.wrap.classList.toggle('is-open', open);
    $.fab.classList.toggle('is-on', open);
    $.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    $.fab.title = open ? T.close : T.find;
    swapIcon($.fab.querySelector('.rail-item__ico'), open ? 'close' : 'search');
    /* keep the collapsed field out of the tab order */
    $.q.tabIndex = open ? 0 : -1;
  }

  function openSearch(open) {
    if (open) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      syncSearch(true);
      $.q.focus(); $.q.select();
    } else {
      syncSearch(false);
      if ($.q.value) {
        $.q.value = ''; state.query = ''; $.clear.hidden = true; render();
      }
      $.q.blur();
    }
  }

  function syncView() {
    swapIcon($.view.querySelector('.rail-item__ico'),
             state.view === 'list' ? 'grid_view' : 'view_list');
    $.view.querySelector('.rail-item__lbl').textContent =
      state.view === 'list' ? T.viewGrid : T.viewList;
  }

  function syncTheme(mode) {
    swapIcon($.theme.querySelector('.rail-item__ico'),
             mode === 'auto' ? 'contrast' : mode === 'light' ? 'light_mode' : 'dark_mode');
  }

  function applyTheme(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }

  /* ------------------------------------------------------------------
     Multi-select
     ------------------------------------------------------------------ */
  function setPicking(on) {
    state.picking = on;
    document.documentElement.classList.toggle('is-picking', on);
    $.pick.classList.toggle('is-on', on);
    $.pick.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function selectedEntries() {
    return state.entries.filter(function (e) { return state.sel[e.href]; });
  }
  function selectedFiles() {
    return selectedEntries().filter(function (e) { return !e.isDir; });
  }

  function toggleSel(entry, index, range) {
    if (range && state.anchor != null && state.visible[state.anchor]) {
      var a = Math.min(state.anchor, index), b = Math.max(state.anchor, index);
      for (var j = a; j <= b; j++) state.sel[state.visible[j].href] = true;
    } else {
      if (state.sel[entry.href]) delete state.sel[entry.href];
      else state.sel[entry.href] = true;
      state.anchor = index;
    }
    state.selN = Object.keys(state.sel).length;
    paintSel();
  }

  function clearSel() {
    state.sel = Object.create(null);
    state.selN = 0;
    state.anchor = null;
    paintSel();
  }

  function selectAllVisible() {
    var all = state.visible.every(function (e) { return state.sel[e.href]; });
    state.visible.forEach(function (e) {
      if (all) delete state.sel[e.href]; else state.sel[e.href] = true;
    });
    state.selN = Object.keys(state.sel).length;
    paintSel();
  }

  function paintSel() {
    var nodes = document.querySelectorAll('.item');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('is-sel', !!state.sel[nodes[i].dataset.href]);
    }
    syncSelbar();
  }

  var selbarTimer;
  function syncSelbar() {
    if (!$.selbar) return;
    var n = state.selN;
    clearTimeout(selbarTimer);
    if (n) {
      $.selbar.querySelector('.selbar__n').textContent = T.selected + ' ' + n;
      $.seldl.disabled = selectedFiles().length === 0;
      $.selbar.hidden = false;
      requestAnimationFrame(function () { $.selbar.classList.add('show'); });
    } else {
      $.selbar.classList.remove('show');
      selbarTimer = setTimeout(function () { $.selbar.hidden = true; }, 340);
    }
  }

  /* Browsers throttle programmatic downloads and ask once for permission
     when more than one is triggered — spacing them out keeps that to a
     single prompt. There is no backend here, so no server-side zip. */
  function downloadSelected() {
    var files = selectedFiles();
    if (!files.length) return;
    toast(T.dlStarted.replace('{n}', files.length));
    var i = 0;
    (function next() {
      if (i >= files.length) return;
      var a = el('a');
      a.href = files[i].href;
      a.setAttribute('download', files[i].name);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      i++;
      setTimeout(next, 350);
    })();
  }

  function copySelected() {
    var entries = selectedEntries();
    if (!entries.length) return;
    var urls = entries.map(function (e) {
      return new URL(e.href, location.href).href;
    }).join('\n');
    copyText(urls, T.copiedN.replace('{n}', entries.length));
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */
  var COLLATOR = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' });

  function render() {
    var ui = document.querySelector('.m3l');
    var list = ui.querySelector('.list');
    var empty = ui.querySelector('.empty');
    var q = state.query.toLowerCase();

    var items = state.entries.filter(function (e) {
      return !q || e.name.toLowerCase().indexOf(q) !== -1;
    });

    items.sort(function (a, b) {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      var r = 0;
      if (state.sort === 'name') r = COLLATOR.compare(a.name, b.name);
      else if (state.sort === 'date') r = (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0);
      else r = (a.size || 0) - (b.size || 0);
      if (r === 0) r = COLLATOR.compare(a.name, b.name);
      return state.desc ? -r : r;
    });

    state.visible = items;
    state.anchor = null;          /* row indices just changed meaning */

    list.textContent = '';
    list.className = 'list' + (state.view === 'grid' ? ' grid' : '');

    var frag = document.createDocumentFragment();
    items.forEach(function (e, i) { frag.appendChild(row(e, i, q)); });
    list.appendChild(frag);

    empty.hidden = items.length > 0;
    if (!items.length) {
      empty.querySelector('p').textContent = state.entries.length ? T.nothing : T.emptyDir;
    }

    var nd = 0, nf = 0, total = 0;
    items.forEach(function (e) {
      if (e.isDir) nd++; else { nf++; total += (e.size || 0); }
    });
    var parts = [];
    if (nd) parts.push(nd + ' ' + plural(nd, T.dirs));
    if (nf) parts.push(nf + ' ' + plural(nf, T.files));
    if (total) parts.push(fmtSize(total));
    ui.querySelector('.stats').textContent = parts.length ? parts.join(' · ') : T.empty;

    syncSelbar();
  }

  function highlight(text, q) {
    var box = document.createDocumentFragment();
    if (!q) { box.appendChild(document.createTextNode(text)); return box; }
    var low = text.toLowerCase(), from = 0, idx;
    while ((idx = low.indexOf(q, from)) !== -1) {
      if (idx > from) box.appendChild(document.createTextNode(text.slice(from, idx)));
      box.appendChild(el('mark', null, text.slice(idx, idx + q.length)));
      from = idx + q.length;
    }
    if (from < text.length) box.appendChild(document.createTextNode(text.slice(from)));
    return box;
  }

  function row(e, i, q) {
    var k = kindOf(e);
    var a = el('div', 'item anim' + (state.sel[e.href] ? ' is-sel' : ''));
    a.style.setProperty('--i', Math.min(i, 30));
    a.style.setProperty('--acc-bg', 'var(--' + k.acc + '-bg)');
    a.style.setProperty('--acc-fg', 'var(--' + k.acc + '-fg)');
    a.dataset.href = e.href;
    a.title = e.name + (e.exact && e.size != null
      ? '\n' + e.size.toLocaleString(LOCALE) + ' ' + UNITS[0] : '');

    /* full-row link overlay — keeps one real <a> per row while still
       allowing real buttons in the trailing slot */
    var link = el('a', 'item__link');
    link.href = e.href;
    link.setAttribute('aria-label', e.name);
    link.addEventListener('click', function (ev) {
      if (state.picking || ev.ctrlKey || ev.metaKey || ev.shiftKey) {
        ev.preventDefault();
        toggleSel(e, i, ev.shiftKey);
      }
    });
    a.appendChild(link);

    /* the leading chip doubles as the checkbox */
    var ico = el('span', 'item__ico');
    ico.appendChild(icon(k.icon, 'type', k.fb));
    ico.appendChild(icon('check', 'check'));
    ico.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSel(e, i, ev.shiftKey);
    });
    a.appendChild(ico);

    var body = el('span', 'item__body');
    var nm = el('span', 'item__name');
    nm.appendChild(highlight(e.name, q));
    body.appendChild(nm);

    var meta = el('span', 'item__meta');
    var bits = [];
    if (e.date) bits.push(DATE_FMT.format(e.date));
    bits.push(e.isDir ? T.folder : fmtSize(e.size));
    meta.textContent = bits.filter(Boolean).join('  ·  ');
    body.appendChild(meta);
    a.appendChild(body);

    var tail = el('span', 'item__tail');

    var copy = el('button', 'iconbtn hoveronly');
    copy.type = 'button';
    copy.title = T.copy;
    copy.appendChild(icon('link'));
    copy.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      copyLink(new URL(e.href, location.href).href);
    });
    tail.appendChild(copy);

    if (!e.isDir) {
      var dl = el('a', 'iconbtn hoveronly');
      dl.href = e.href;
      dl.setAttribute('download', '');
      dl.title = T.download;
      dl.appendChild(icon('download'));
      dl.addEventListener('click', function (ev) { ev.stopPropagation(); });
      tail.appendChild(dl);
    } else {
      var ch = el('span', 'item__chev');
      ch.appendChild(icon('chevron_right'));
      tail.appendChild(ch);
    }
    a.appendChild(tail);
    return a;
  }

  /* ------------------------------------------------------------------
     Copy link + toast
     ------------------------------------------------------------------ */
  var toastTimer;
  function toast(msg) {
    var t = document.querySelector('.toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function copyText(text, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else fallback(text, done);
  }

  function copyLink(url) { copyText(url, T.copied); }

  function fallback(url, done) {
    var ta = el('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }

  /* ------------------------------------------------------------------
     Keyboard
     ------------------------------------------------------------------ */
  function onKey(ev) {
    var inField = ev.target === $.q;

    if (ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault(); openSearch(true); return;
    }
    if (!inField && ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault(); openSearch(true); return;
    }
    if (ev.key === 'Escape') {
      if (state.selN) { clearSel(); setPicking(false); }
      else openSearch(false);
      return;
    }
    if (!inField && ev.key === 'a' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault(); selectAllVisible(); return;
    }
    if (!inField && (ev.key === 'Backspace' || (ev.altKey && ev.key === 'ArrowLeft'))) {
      if (!$.up.disabled) { ev.preventDefault(); $.up.click(); }
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!state.visible.length) return;
      ev.preventDefault();
      var d = ev.key === 'ArrowDown' ? 1 : -1;
      state.cursor = Math.max(0, Math.min(state.visible.length - 1, state.cursor + d));
      moveCursor();
      return;
    }
    if (ev.key === 'Enter' && state.cursor >= 0) {
      var node = document.querySelectorAll('.item')[state.cursor];
      var lnk = node && node.querySelector('.item__link');
      if (lnk) { ev.preventDefault(); location.href = lnk.href; }
    }
  }

  function moveCursor() {
    var nodes = document.querySelectorAll('.item');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('is-cursor', i === state.cursor);
    if (nodes[state.cursor]) nodes[state.cursor].scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------------------------------------------
     Go
     ------------------------------------------------------------------ */
  applyTheme(LS.get('theme', 'auto'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { safe(boot); });
  } else safe(boot);

  function safe(fn) {
    try { fn(); } catch (err) {
      bail();
      if (window.console) console.error('[m3listing]', err);
    }
  }
})();
