/* =====================================================================
   m3listing — nginx autoindex re-rendered as an m3.material.io page.
   Runs entirely in the browser: it reads the plain <pre> block nginx
   already produced and builds the UI from it. No backend involved.
   ===================================================================== */
(function () {
  'use strict';

  var REPO = 'https://github.com/nd4y/material3-listing';

  /* ------------------------------------------------------------------
     Config — override by defining window.M3LISTING before this script.
     ------------------------------------------------------------------ */
  var CFG = Object.assign({
    title: null,                      // brand name; defaults to the hostname
    repoUrl: REPO,                    // credit link in the rail
    lang: 'auto',                     // 'auto' | 'ru' | 'en'
    newDays: 7,                       // "new" badge window
    thumbMaxMB: 6,                    // biggest picture worth a thumbnail
    crawlConcurrency: 3,              // parallel requests when walking the tree
    crawlMaxDirs: 3000,               // runaway guard
    hide: ['@eaDir', '.betterlisting', '.m3listing', 'Thumbs.db',
           '.DS_Store', 'desktop.ini', '#recycle', '#snapshot']
  }, window.M3LISTING || {});

  var BRAND = CFG.title || CFG.siteName || location.host;

  /* ------------------------------------------------------------------
     i18n
     ------------------------------------------------------------------ */
  var STR = {
    ru: {
      search: 'Поиск в этом каталоге', up: 'Наверх', root: 'Корень', home: 'Корень',
      name: 'Имя', date: 'Дата', size: 'Размер', theme: 'Тема',
      find: 'Поиск', close: 'Закрыть', source: 'Исходники',
      viewList: 'Список', viewGrid: 'Сетка',
      copy: 'Скопировать ссылку', download: 'Скачать', copied: 'Ссылка скопирована',
      props: 'Свойства', pick: 'Выбрать', selected: 'Выбрано:',
      dl: 'Скачать', links: 'Ссылки', asList: 'Списком',
      dlStarted: 'Загрузка: {n}', copiedN: 'Скопировано ссылок: {n}',
      copiedList: 'Список скопирован',
      nothing: 'Ничего не найдено', emptyDir: 'Каталог пуст', clear: 'Очистить',
      dirs: ['каталог', 'каталога', 'каталогов'], files: ['файл', 'файла', 'файлов'],
      folder: 'каталог', empty: 'пусто', fresh: 'новое',
      deep: 'Искать во всех подкаталогах', deepStop: 'Остановить',
      deepDone: 'Просмотрено каталогов: {n}', deepIn: 'в {p}',
      calcSize: 'Посчитать размер', calculating: 'считаю…',
      lang: 'Язык', langAuto: 'Как в системе', langRu: 'Русский', langEn: 'English',
      themeAuto: 'Как в системе', themeLight: 'Светлая', themeDark: 'Тёмная',
      ddTitle: 'Скачать каталог', ddSub: 'Целиком, со вложенными каталогами',
      ddHere: 'Скачать этот каталог',
      ddFs: 'Сохранить на диск', ddWget: 'Команда wget', ddAria: 'Список для aria2c',
      ddFsHint: 'Браузер спросит, куда складывать. Структура каталогов сохранится, '
              + 'уже скачанные файлы того же размера пропускаются.',
      ddNoFs: 'Сохранение прямо на диск умеют Chrome и Edge. В остальных браузерах '
            + 'возьмите команду или список — они надёжнее и качают с докачкой.',
      ddScan: 'Считаю дерево…', ddScanned: 'Найдено: {n} файлов, {s}',
      ddGo: 'Скачано {i} из {n} · {done} из {total}',
      ddSkip: 'пропущено (уже скачано): {n}',
      ddDone: 'Готово: {n} файлов', ddCancel: 'Отмена', ddClose: 'Закрыть',
      ddCopied: 'Команда скопирована', ddListed: 'Список сохранён',
      ddFail: 'Не получилось: {e}',
      qr: 'QR-код', noPreview: 'Предпросмотр недоступен',
      loading: 'Читаю…', probeFail: 'Свойства прочитать не удалось',
      inside: 'Внутри архива', more: 'и ещё {n}',
      f: {
        format: 'Формат', dim: 'Размер изображения', depth: 'Глубина цвета',
        color: 'Цветовая модель', duration: 'Длительность', tracks: 'Дорожки',
        container: 'Контейнер', video: 'Видео', audio: 'Аудио', subs: 'Субтитры',
        bitrate: 'Битрейт', rate: 'Частота', channels: 'Каналы', bits: 'Разрядность',
        title: 'Название', artist: 'Исполнитель', album: 'Альбом', year: 'Год',
        track: 'Трек', genre: 'Жанр', label: 'Метка тома', system: 'Система',
        publisher: 'Издатель', preparer: 'Подготовил', application: 'Приложение',
        volumeSize: 'Объём образа', created: 'Создан', blocks: 'Блоков',
        entries: 'Файлов внутри', totalSize: 'Распакованный размер',
        packedSize: 'Упакованный размер', ratio: 'Сжатие',
        make: 'Камера', model: 'Модель', taken: 'Снято', exposure: 'Выдержка',
        fnumber: 'Диафрагма', iso: 'ISO', focal: 'Фокусное', lens: 'Объектив',
        muxer: 'Мультиплексор', vbr: 'Переменный битрейт'
      },
      groups: { all: 'Все', dir: 'Каталоги', pic: 'Картинки', vid: 'Видео',
                snd: 'Аудио', arch: 'Архивы', doc: 'Документы', code: 'Код',
                bin: 'Программы', other: 'Прочее' }
    },
    en: {
      search: 'Search this directory', up: 'Up', root: 'Root', home: 'Root',
      name: 'Name', date: 'Date', size: 'Size', theme: 'Theme',
      find: 'Search', close: 'Close', source: 'Source',
      viewList: 'List', viewGrid: 'Grid',
      copy: 'Copy link', download: 'Download', copied: 'Link copied',
      props: 'Properties', pick: 'Select', selected: 'Selected:',
      dl: 'Download', links: 'Links', asList: 'As list',
      dlStarted: 'Downloading {n}', copiedN: '{n} links copied',
      copiedList: 'List copied',
      nothing: 'Nothing found', emptyDir: 'This directory is empty', clear: 'Clear',
      dirs: ['directory', 'directories', 'directories'], files: ['file', 'files', 'files'],
      folder: 'directory', empty: 'empty', fresh: 'new',
      deep: 'Search all subdirectories', deepStop: 'Stop',
      deepDone: '{n} directories scanned', deepIn: 'in {p}',
      calcSize: 'Measure size', calculating: 'measuring…',
      lang: 'Language', langAuto: 'System', langRu: 'Русский', langEn: 'English',
      themeAuto: 'System', themeLight: 'Light', themeDark: 'Dark',
      ddTitle: 'Download directory', ddSub: 'Everything in it, subdirectories included',
      ddHere: 'Download this directory',
      ddFs: 'Save to disk', ddWget: 'wget command', ddAria: 'aria2c list',
      ddFsHint: 'The browser will ask where to put it. The directory structure is kept '
              + 'and files already there with the same size are skipped.',
      ddNoFs: 'Saving straight to disk works in Chrome and Edge. Elsewhere take the '
            + 'command or the list — they resume, which matters for large trees.',
      ddScan: 'Walking the tree…', ddScanned: 'Found {n} files, {s}',
      ddGo: '{i} of {n} · {done} of {total}',
      ddSkip: 'skipped (already there): {n}',
      ddDone: 'Done: {n} files', ddCancel: 'Cancel', ddClose: 'Close',
      ddCopied: 'Command copied', ddListed: 'List saved',
      ddFail: 'Failed: {e}',
      qr: 'QR code', noPreview: 'No preview available',
      loading: 'Reading…', probeFail: 'Could not read the properties',
      inside: 'Archive contents', more: 'and {n} more',
      f: {
        format: 'Format', dim: 'Dimensions', depth: 'Bit depth',
        color: 'Colour model', duration: 'Duration', tracks: 'Tracks',
        container: 'Container', video: 'Video', audio: 'Audio', subs: 'Subtitles',
        bitrate: 'Bitrate', rate: 'Sample rate', channels: 'Channels', bits: 'Bits',
        title: 'Title', artist: 'Artist', album: 'Album', year: 'Year',
        track: 'Track', genre: 'Genre', label: 'Volume label', system: 'System',
        publisher: 'Publisher', preparer: 'Prepared by', application: 'Application',
        volumeSize: 'Image size', created: 'Created', blocks: 'Blocks',
        entries: 'Files inside', totalSize: 'Unpacked size',
        packedSize: 'Packed size', ratio: 'Compression',
        make: 'Camera', model: 'Model', taken: 'Taken', exposure: 'Exposure',
        fnumber: 'Aperture', iso: 'ISO', focal: 'Focal length', lens: 'Lens',
        muxer: 'Muxer', vbr: 'Variable bitrate'
      },
      groups: { all: 'All', dir: 'Directories', pic: 'Pictures', vid: 'Video',
                snd: 'Audio', arch: 'Archives', doc: 'Documents', code: 'Code',
                bin: 'Programs', other: 'Other' }
    }
  };
  /* The language is re-selectable at runtime, so everything derived from it
     is a plain var reset by setLang() rather than a one-shot constant. */
  var LANG, T, LOCALE, UNITS, DATE_FMT, COLLATOR;

  function detectLang() {
    return /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
  }

  /* what 'auto' resolves to: the page's own configured default if it has
     one, the browser's language otherwise */
  function autoLang() {
    return (CFG.lang && CFG.lang !== 'auto') ? CFG.lang : detectLang();
  }

  function setLang(mode) {
    LANG = (!mode || mode === 'auto') ? autoLang() : mode;
    if (!STR[LANG]) LANG = 'en';
    T = STR[LANG];
    LOCALE = LANG === 'ru' ? 'ru-RU' : 'en-GB';
    UNITS = LANG === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ']
                          : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    DATE_FMT = new Intl.DateTimeFormat(LOCALE, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    COLLATOR = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' });
    document.documentElement.lang = LANG;
  }

  function plural(n, forms) {
    if (LANG !== 'ru') return n === 1 ? forms[0] : forms[1];
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  function fill(s, o) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; });
  }

  /* ------------------------------------------------------------------
     Icons. Primary rendering is the Google Symbols webfont — the same
     face m3.material.io uses — as ligature text, so the FILL axis can be
     animated on hover exactly like the site does it. If the font never
     arrives, every glyph is swapped for the inline SVG below.
     ------------------------------------------------------------------ */
  var P = {
    folder: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z',
    folder_open: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h360q17 0 28.5 11.5T880-680q0 17-11.5 28.5T840-640H447l-80-80H160v480l79-263q8-26 29.5-41.5T316-560h516q41 0 64.5 32.5T909-457l-72 240q-8 26-29.5 41.5T760-160H160Zm84-80h516l72-240H316l-72 240Z',
    home: 'M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Z',
    arrow_upward: 'M440-647 244-451q-12 12-28 11.5T188-452q-11-12-11.5-28t11.5-28l264-264q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l264 264q11 11 11 27.5T772-452q-12 12-28.5 12T715-452L520-647v447q0 17-11.5 28.5T480-160q-17 0-28.5-11.5T440-200v-447Z',
    arrow_downward: 'M440-313v-447q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v447l196-196q12-12 28-11.5t28 12.5q11 12 11.5 28T772-452L508-188q-6 6-13 8.5t-15 2.5q-8 0-15-2.5t-13-8.5L188-452q-11-11-11-27.5t11-28.5q12-12 28.5-12t28.5 12l195 195Z',
    arrow_back: 'M400-647 244-491q-11 11-28 11t-28-11q-11-11-11-28t11-28l184-184q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l184 184q11 11 11 28t-11 28q-11 11-28 11t-28-11L400-647Z',
    search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
    close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
    grid_view: 'M200-520q-33 0-56.5-23.5T120-600v-160q0-33 23.5-56.5T200-840h160q33 0 56.5 23.5T440-760v160q0 33-23.5 56.5T360-520H200Zm0 400q-33 0-56.5-23.5T120-200v-160q0-33 23.5-56.5T200-440h160q33 0 56.5 23.5T440-360v160q0 33-23.5 56.5T360-120H200Zm400-400q-33 0-56.5-23.5T520-600v-160q0-33 23.5-56.5T600-840h160q33 0 56.5 23.5T840-760v160q0 33-23.5 56.5T760-520H600Zm0 400q-33 0-56.5-23.5T520-200v-160q0-33 23.5-56.5T600-440h160q33 0 56.5 23.5T840-360v160q0 33-23.5 56.5T760-120H600ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Z',
    view_list: 'M120-280v-400q0-33 23.5-56.5T200-760h560q33 0 56.5 23.5T840-680v400q0 33-23.5 56.5T760-200H200q-33 0-56.5-23.5T120-280Zm80-320h80v-80h-80v80Zm160 0h400v-80H360v80Zm0 160h400v-80H360v80Zm0 160h400v-80H360v80Zm-160 0h80v-80h-80v80Zm0-160h80v-80h-80v80Z',
    dark_mode: 'M480-120q-151 0-255.5-104.5T120-480q0-138 90-239.5T440-838q13-2 23 3.5t16 14.5q6 9 6.5 21t-7.5 23q-17 26-25.5 55t-8.5 61q0 90 63 153t153 63q31 0 61.5-9t54.5-25q11-7 22.5-6.5T819-479q10 5 15.5 15t3.5 24q-14 138-117.5 229T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Z',
    light_mode: 'M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM80-440q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h80q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440H80Zm720 0q-17 0-28.5-11.5T760-480q0-17 11.5-28.5T800-520h80q17 0 28.5 11.5T920-480q0 17-11.5 28.5T880-440h-80ZM480-760q-17 0-28.5-11.5T440-800v-80q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v80q0 17-11.5 28.5T480-760Zm0 720q-17 0-28.5-11.5T440-80v-80q0-17 11.5-28.5T480-200q17 0 28.5 11.5T520-160v80q0 17-11.5 28.5T480-40ZM226-678l-43-42q-12-11-11.5-28t11.5-29q12-12 29-12t28 12l42 43q11 12 11 28t-11 28q-11 12-27.5 11.5T226-678Zm494 495-42-43q-11-12-11-28.5t11-27.5q11-12 27.5-11.5T734-282l43 42q12 11 11.5 28T777-183q-12 12-29 12t-28-12Zm-42-495q-12-11-11.5-27.5T678-734l42-43q11-12 28-11.5t29 11.5q12 12 12 29t-12 28l-43 42q-12 11-28 11t-28-11ZM183-183q-12-12-12-29t12-28l43-42q12-11 28.5-11t27.5 11q12 11 11.5 27.5T282-226l-42 43q-11 12-28 11.5T183-183Z',
    contrast: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm40-82q122-15 201-105t79-213q0-123-79-213t-201-105v636Z',
    download: 'M480-337q-8 0-15-2.5t-13-8.5L308-492q-12-12-11.5-28t11.5-28q12-12 28.5-12.5T365-549l75 75v-286q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v286l75-75q12-12 28.5-11.5T652-548q11 12 11.5 28T652-492L508-348q-6 6-13 8.5t-15 2.5ZM240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Z',
    chevron_right: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
    chevron_left: 'm456-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L372-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L456-480Z',
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
    settings: 'M433-80q-27 0-46.5-18T363-142l-9-66q-13-5-24.5-12T307-235l-62 26q-25 11-50 2t-39-32l-47-82q-14-23-8-49t27-43l53-40q-1-7-1-13.5v-27q0-6.5 1-13.5l-53-40q-21-17-27-43t8-49l47-82q14-23 39-32t50 2l62 26q11-8 23-15t24-12l9-66q4-26 23.5-44t46.5-18h94q27 0 46.5 18t23.5 44l9 66q13 5 24.5 12t22.5 15l62-26q25-11 50-2t39 32l47 82q14 23 8 49t-27 43l-53 40q1 7 1 13.5v27q0 6.5-2 13.5l53 40q21 17 27 43t-8 49l-48 82q-14 23-39 32t-50-2l-60-26q-11 8-23 15t-24 12l-9 66q-4 26-23.5 44T527-80h-94Zm7-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Z',
    check: 'm382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z',
    check_box: 'm424-424-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-424ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z',
    info: 'M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z',
    travel_explore: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 14-1 27t-3 26q-19-8-38.5-12t-40.5-4q1-8 1.5-16.5t.5-16.5h-158q-2 27-6.5 52.5T617-374q-18 5-34.5 12.5T551-343q10-31 16-63.5t8-69.5H385q4 45 12 85t20 71q-14 11-25.5 24T371-269q-20-45-32-98t-16-109H165q22 71 75 122t124 71q6 22 15.5 41.5T402-206q-16-2-31-5t-30-8q-58-20-105.5-57t-81-86.5Q120-412 100-471.5T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880Zm0 80q-27 39-46.5 82T402-628h156q-12-45-31.5-88T480-800Zm-83 10q-21 33-36.5 71T335-628H206q35-59 89.5-100T397-790Zm166 0q47 19 101.5 60T754-628H625q-10-43-25.5-81T563-790ZM165-548h158q1-20 2.5-40t4.5-40H171q-3 20-4.5 40t-1.5 40Zm570 0q0-20-1.5-40t-4.5-40H637q3 20 4.5 40t2.5 40h91ZM714-40l-84-84q-19 11-40 17.5t-44 6.5q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 23-6.5 44T682-176l84 84q11 11 11 28t-11 28q-11 11-26 11t-26-11ZM546-180q33 0 56.5-23.5T626-260q0-33-23.5-56.5T546-340q-33 0-56.5 23.5T466-260q0 33 23.5 56.5T546-180Z',
    straighten: 'M120-320q-33 0-56.5-23.5T40-400v-160q0-33 23.5-56.5T120-640h720q33 0 56.5 23.5T920-560v160q0 33-23.5 56.5T840-320H120Zm0-80h720v-160H720v80q0 17-11.5 28.5T680-440q-17 0-28.5-11.5T640-480v-80h-80v80q0 17-11.5 28.5T520-440q-17 0-28.5-11.5T480-480v-80h-80v80q0 17-11.5 28.5T360-440q-17 0-28.5-11.5T320-480v-80h-80v80q0 17-11.5 28.5T200-440q-17 0-28.5-11.5T160-480v-80h-40v160Zm360-80Z',
    qr_code_2: 'M680-160v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm160-80v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm-80 80v-80h80v80h-80Zm-160 160v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm320-320v-80h80v80h-80ZM200-440q-17 0-28.5-11.5T160-480v-40h-40q-17 0-28.5-11.5T80-560q0-17 11.5-28.5T120-600h40v-40q0-17 11.5-28.5T200-680q17 0 28.5 11.5T240-640v40h40q17 0 28.5 11.5T320-560q0 17-11.5 28.5T280-520h-40v40q0 17-11.5 28.5T200-440Zm-40 280q-33 0-56.5-23.5T80-240v-120q0-17 11.5-28.5T120-400q17 0 28.5 11.5T160-360v120h120q17 0 28.5 11.5T320-200q0 17-11.5 28.5T280-160H160Zm520 0q-17 0-28.5-11.5T640-200q0-17 11.5-28.5T680-240h120v-120q0-17 11.5-28.5T840-400q17 0 28.5 11.5T880-360v120q0 33-23.5 56.5T800-160H680ZM120-560q-17 0-28.5-11.5T80-600v-120q0-33 23.5-56.5T160-800h120q17 0 28.5 11.5T320-760q0 17-11.5 28.5T280-720H160v120q0 17-11.5 28.5T120-560Zm720 0q-17 0-28.5-11.5T800-600v-120H680q-17 0-28.5-11.5T640-760q0-17 11.5-28.5T680-800h120q33 0 56.5 23.5T880-720v120q0 17-11.5 28.5T840-560Z',
    play_arrow: 'M320-273v-414q0-17 12-28.5t28-11.5q5 0 10.5 1.5T381-721l326 208q9 6 13.5 15t4.5 18q0 9-4.5 18T707-447L381-239q-5 3-10.5 4.5T360-233q-16 0-28-11.5T320-273Z',
    format_list_bulleted: 'M360-200q-17 0-28.5-11.5T320-240q0-17 11.5-28.5T360-280h440q17 0 28.5 11.5T840-240q0 17-11.5 28.5T800-200H360ZM200-200q-17 0-28.5-11.5T160-240q0-17 11.5-28.5T200-280q17 0 28.5 11.5T240-240q0 17-11.5 28.5T200-200Zm160-240q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520h440q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H360Zm-160 0q-17 0-28.5-11.5T160-480q0-17 11.5-28.5T200-520q17 0 28.5 11.5T240-480q0 17-11.5 28.5T200-440Zm160-240q-17 0-28.5-11.5T320-720q0-17 11.5-28.5T360-760h440q17 0 28.5 11.5T840-720q0 17-11.5 28.5T800-680H360Zm-160 0q-17 0-28.5-11.5T160-720q0-17 11.5-28.5T200-760q17 0 28.5 11.5T240-720q0 17-11.5 28.5T200-680Z'
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
  reg('ppt pptx odp',                 'slideshow',     'a7', 'slideshow');

  /* the rest */
  reg('ttf otf woff woff2 eot fon',   'font_download', 'a5', 'font_download');
  reg('srt ass ssa sub vtt idx',      'subtitles',     'a5', 'subtitles');
  reg('torrent magnet lnk url webloc','link',          'a5', 'link');

  /* the filter chips group by family, derived from the fallback artwork */
  var GRP = {
    image: 'pic', movie: 'vid', music_note: 'snd',
    folder_zip: 'arch', album: 'arch',
    deployed_code: 'bin', terminal: 'bin',
    code: 'code', settings: 'code', database: 'code', key: 'code',
    description: 'doc', text_snippet: 'doc', picture_as_pdf: 'doc',
    table: 'doc', slideshow: 'doc'
  };

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

  function ext(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  function kindOf(entry) {
    if (entry.isDir) return DIR_KIND;
    return EXT[ext(entry.name)] || FILE_KIND;
  }

  function groupOf(entry) {
    if (entry.isDir) return 'dir';
    var k = EXT[ext(entry.name)];
    return k ? (GRP[k.fb] || 'other') : 'other';
  }

  function isFresh(e) {
    return e.date && (Date.now() - e.date.getTime()) < CFG.newDays * 864e5;
  }

  function abs(href) { return new URL(href, location.href).href; }

  /* every ligature the page can ask the webfont for — the test suite
     renders each one and fails if it comes back as letters */
  window.M3L_GLYPHS = (function () {
    var seen = {};
    Object.keys(EXT).forEach(function (e) { seen[EXT[e].icon] = 1; });
    Object.keys(P).forEach(function (n) { seen[n] = 1; });
    ['folder_open', 'check_box', 'info', 'travel_explore', 'straighten',
     'qr_code_2', 'play_arrow', 'format_list_bulleted', 'chevron_left',
     'arrow_back', 'code'].forEach(function (n) { seen[n] = 1; });
    return Object.keys(seen);
  })();

  /* ------------------------------------------------------------------
     Reading an autoindex listing
     ------------------------------------------------------------------ */
  var META_RE = /(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})\s+(\S+)\s*$/;

  function readEntries(pre, baseUrl) {
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
      out.push({
        href: baseUrl ? new URL(href, baseUrl).href : href,
        name: name, isDir: isDir, date: date, size: size, exact: exact
      });
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
    path: '/',
    query: '',
    group: 'all',
    sort: LS.get('sort', 'name'),
    desc: LS.get('desc', '0') === '1',
    view: LS.get('view', 'list'),
    cursor: -1,
    entries: [],
    visible: [],
    parentHref: null,
    deep: null,            // active recursive search
    deepHits: null,        // results of a recursive search
    sel: Object.create(null),
    selN: 0,
    picking: false,
    anchor: null
  };

  var $ = {};

  /* ==================================================================
     Boot
     ================================================================== */
  function boot() {
    var raw = document.querySelector('.rawwrap');
    var pre = raw && raw.querySelector('pre');
    var ui = document.querySelector('.m3l');
    if (!raw || !pre || !ui) { bail(); return; }

    cacheRefs(ui);
    wireChrome(ui);

    var read = readEntries(pre);
    applyListing(pathFromDoc(raw), read.entries, read.parentHref);

    var q = new URLSearchParams(location.search).get('q');
    if (q) { $.q.value = q; state.query = q.trim(); $.clear.hidden = !q; syncSearch(true); }

    render();
    resolveIcons();
    document.documentElement.classList.add('m3l-ready');
  }

  function bail() { document.documentElement.classList.remove('m3l-js'); }

  function pathFromDoc(scope) {
    var h1 = scope.querySelector('h1');
    var p = h1 ? (h1.textContent || '').replace(/^Index of\s*/, '').trim() : '';
    if (!p) { try { p = decodeURIComponent(location.pathname); } catch (e) { p = location.pathname; } }
    if (p.charAt(0) !== '/') p = '/' + p;
    if (p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  }

  function cacheRefs(ui) {
    $.ui = ui;
    $.title = ui.querySelector('.hero__title');
    $.sub = ui.querySelector('.hero__sub');
    $.stats = ui.querySelector('.stats');
    $.crumbs = ui.querySelector('.crumbs');
    $.list = ui.querySelector('.list');
    $.empty = ui.querySelector('.empty');
    $.tabs = ui.querySelector('.tabs');
    $.chips = ui.querySelector('.chips');
    $.progress = ui.querySelector('.progress');
    $.deepBar = ui.querySelector('.deepbar');
    $.deepBtn = ui.querySelector('.deepbtn');
    $.q = document.getElementById('m3l-q');
    $.clear = document.getElementById('m3l-clear');
    $.wrap = document.getElementById('m3l-searchwrap');
    $.fab = document.getElementById('m3l-searchfab');
    $.home = document.getElementById('m3l-home');
    $.up = document.getElementById('m3l-up');
    $.view = document.getElementById('m3l-view');
    $.pick = document.getElementById('m3l-pick');
    $.theme = document.getElementById('m3l-theme');
    $.lang = document.getElementById('m3l-lang');
    $.repo = document.getElementById('m3l-repo');
    $.ddHere = ui.querySelector('.ddhere');
    $.dlg = document.querySelector('.dialog');
    $.ddFs = document.getElementById('m3l-dd-fs');
    $.ddWget = document.getElementById('m3l-dd-wget');
    $.ddAria = document.getElementById('m3l-dd-aria');
    $.ddClose = document.getElementById('m3l-dd-close');
    $.selbar = document.querySelector('.selbar');
    $.seldl = document.getElementById('m3l-seldl');
    $.selcopy = document.getElementById('m3l-selcopy');
    $.sellist = document.getElementById('m3l-sellist');
    $.viewer = document.querySelector('.viewer');
  }

  function wireChrome(ui) {
    /* rail */
    $.home.addEventListener('click', function (ev) { ev.preventDefault(); go('/', true); });
    $.up.addEventListener('click', function () {
      if (state.parentHref) go(new URL(state.parentHref, location.href).href, true);
    });
    $.view.addEventListener('click', function () {
      state.view = state.view === 'list' ? 'grid' : 'list';
      LS.set('view', state.view);
      syncView(); render();
    });
    $.pick.addEventListener('click', function () { setPicking(!state.picking); });
    $.theme.addEventListener('click', function () { openThemeMenu(); });
    $.lang.addEventListener('click', function () { openLangMenu(); });

    /* the credit lives in the rail, where the site keeps its own
       secondary controls — a lone link under the list read as debris */
    $.repo.href = CFG.repoUrl || REPO;
    $.repo.title = (CFG.repoUrl || REPO).replace(/^https?:\/\//, '');

    /* search */
    syncSearch(false);
    $.q.addEventListener('input', onQuery);
    $.clear.addEventListener('click', function () {
      $.q.value = ''; onQuery(); $.q.focus();
    });
    $.fab.addEventListener('click', function () {
      openSearch(!$.wrap.classList.contains('is-open'));
    });

    /* deep search */
    $.deepBtn.addEventListener('click', function () {
      if (state.deep) stopDeep(); else startDeep();
    });

    /* sort tabs */
    ['name', 'date', 'size'].forEach(function (k) {
      var b = $.tabs.querySelector('[data-sort="' + k + '"]');
      b.addEventListener('click', function () {
        if (state.sort === k) state.desc = !state.desc;
        else { state.sort = k; state.desc = (k !== 'name'); }
        LS.set('sort', state.sort); LS.set('desc', state.desc ? '1' : '0');
        syncSort(); render();
      });
    });

    /* selection bar */
    $.seldl.addEventListener('click', downloadSelected);
    $.selcopy.addEventListener('click', copySelected);
    $.sellist.addEventListener('click', copyAsList);
    document.getElementById('m3l-selclear').addEventListener('click', function () {
      clearSel(); setPicking(false);
    });

    /* sticky shadow */
    var bar = ui.querySelector('.navbar');
    var onScroll = function () { bar.classList.toggle('is-stuck', window.scrollY > 6); };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('keydown', onKey);
    addEventListener('popstate', function () { go(location.href, false); });
    wireViewer();
    wireDirDownload(ui);
    applyStrings();
  }

  /* Every visible string in one place, so switching language is a relabel
     plus a render rather than a reload. */
  function applyStrings() {
    var lbl = function (node, text) { node.querySelector('.rail-item__lbl').textContent = text; };
    lbl($.fab, T.find);
    lbl($.home, T.home);
    lbl($.up, T.up);
    lbl($.pick, T.pick);
    lbl($.repo, T.source);
    lbl($.theme, T.theme);
    $.theme.title = T.theme;
    lbl($.lang, T.lang);

    $.q.placeholder = T.search;
    $.clear.title = T.clear;
    $.deepBtn.querySelector('.deepbtn__t').textContent = T.deep;

    ['name', 'date', 'size'].forEach(function (k) {
      var b = $.tabs.querySelector('[data-sort="' + k + '"]');
      b.textContent = T[k];
      b.appendChild(icon('arrow_upward', 'dir'));
    });

    $.seldl.querySelector('.selbar__t').textContent = T.dl;
    $.selcopy.querySelector('.selbar__t').textContent = T.links;
    $.sellist.querySelector('.selbar__t').textContent = T.asList;

    $.ddHere.querySelector('.ddhere__t').textContent = T.ddHere;
    $.dlg.querySelector('.dialog__title').textContent = T.ddTitle;
    $.ddFs.querySelector('.dlgbtn__t').textContent = T.ddFs;
    $.ddWget.querySelector('.dlgbtn__t').textContent = T.ddWget;
    $.ddAria.querySelector('.dlgbtn__t').textContent = T.ddAria;
    $.ddClose.textContent = T.ddClose;

    $.vQrBtn.title = T.qr;
    $.vDl.title = T.download;
    $.vCopy.title = T.copy;

    syncView();
    syncSort();
    syncTheme(LS.get('theme', 'auto'));
    syncLang();
    syncSearch($.wrap.classList.contains('is-open'));
    if (state.path) applyListing(state.path, state.entries, state.parentHref);
  }

  function syncLang() {
    var mode = LS.get('lang', 'auto');
    var name = mode === 'auto' ? T.langAuto : (mode === 'ru' ? T.langRu : T.langEn);
    $.lang.querySelector('.rail-item__lbl').textContent = mode === 'auto' ? T.lang : name;
    $.lang.setAttribute('data-mode', mode);
    $.lang.title = T.lang + ' · ' + name;
  }

  /* ==================================================================
     Navigation without a reload
     ================================================================== */
  var navSeq = 0;

  function go(url, push) {
    var seq = ++navSeq;
    busy(true);
    stopDeep();
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        if (seq !== navSeq) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pre = doc.querySelector('pre');
        if (!pre) { location.href = url; return; }
        var read = readEntries(pre);
        if (push) history.pushState({}, '', url);
        clearSel();
        $.q.value = ''; state.query = ''; $.clear.hidden = true;
        state.group = 'all';
        applyListing(pathFromDoc(doc.body), read.entries, read.parentHref);
        render();
        window.scrollTo({ top: 0, behavior: 'auto' });
      })
      .catch(function () { location.href = url; })
      .then(function () { if (seq === navSeq) busy(false); });
  }

  function busy(on) { $.progress.classList.toggle('is-on', !!on); }

  function applyListing(path, entries, parentHref) {
    state.path = path;
    state.entries = entries;
    state.parentHref = parentHref;
    state.deepHits = null;
    state.cursor = -1;

    var segs = path.split('/').filter(Boolean);
    var current = segs.length ? segs[segs.length - 1] : BRAND;
    document.title = segs.length ? current + ' · ' + BRAND : BRAND;

    $.title.textContent = current;
    $.sub.textContent = path;
    $.sub.hidden = segs.length === 0;

    /* breadcrumbs */
    $.crumbs.textContent = '';
    var rootA = el('a', null, BRAND);
    rootA.href = '/';
    $.crumbs.appendChild(rootA);
    var acc = '';
    segs.forEach(function (s, idx) {
      acc += '/' + encodeURIComponent(s);
      var sep = el('span', 'sep');
      sep.appendChild(icon('chevron_right'));
      $.crumbs.appendChild(sep);
      if (idx === segs.length - 1) $.crumbs.appendChild(el('span', 'cur', s));
      else {
        var a = el('a', null, s);
        a.href = acc + '/';
        $.crumbs.appendChild(a);
      }
    });
    Array.prototype.forEach.call($.crumbs.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
        ev.preventDefault(); go(a.href, true);
      });
    });
    $.crumbs.scrollLeft = $.crumbs.scrollWidth;

    $.home.classList.toggle('is-on', segs.length === 0);
    $.up.disabled = segs.length === 0;
  }

  /* ==================================================================
     Walking the tree — used by recursive search and by directory sizes
     ================================================================== */
  function crawl(startUrl, opts) {
    /* Absolute from here down. A row's href is relative — it comes
       straight out of the listing — and `new URL(href, base)` throws when
       the base is relative too, which the catch below would swallow into
       an empty crawl: the size came back as 0 bytes and the tree as no
       files at all. */
    startUrl = new URL(startUrl, location.href).href;
    var queue = [startUrl], seen = Object.create(null), active = 0;
    var dirs = 0, stopped = false;
    seen[startUrl] = 1;

    /* one directory per call, so the URL is captured per request — a
       shared `var` in the pump loop gets overwritten before the async
       handler runs, and every entry ends up attributed to whichever
       directory happened to be dequeued last */
    function fetchDir(url) {
      active++;
      dirs++;
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) {
          if (stopped || !html) return;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var pre = doc.querySelector('pre');
          if (!pre) return;
          var read = readEntries(pre, url);
          read.entries.forEach(function (e) {
            e.dirUrl = url;
            if (opts.onEntry) opts.onEntry(e);
            if (e.isDir && !seen[e.href]) { seen[e.href] = 1; queue.push(e.href); }
          });
        })
        .catch(function () {})
        .then(function () {
          active--;
          if (opts.onProgress) opts.onProgress(dirs, queue.length);
          step();
        });
    }

    function step() {
      if (stopped) return;
      while (active < CFG.crawlConcurrency && queue.length && dirs < CFG.crawlMaxDirs) {
        fetchDir(queue.shift());
      }
      if (!queue.length && !active && opts.onDone) opts.onDone(dirs);
    }
    step();

    return { stop: function () { stopped = true; queue.length = 0; } };
  }
  /* test seam: tools/test-probe.mjs drives the crawler directly */
  window.M3L_CRAWL = function (url, onEntry) {
    return crawl(url, { onEntry: onEntry });
  };

  /* ---- recursive search -------------------------------------------- */
  function startDeep() {
    if (!state.query) return;
    var q = state.query.toLowerCase();
    state.deepHits = [];
    state.deep = crawl(location.href, {
      onEntry: function (e) {
        if (e.name.toLowerCase().indexOf(q) === -1) return;
        e.rel = relPath(e.dirUrl);
        state.deepHits.push(e);
        if (state.deepHits.length % 12 === 0) render();
      },
      onProgress: function (n) {
        $.deepBar.textContent = fill(T.deepDone, { n: n }) + ' · ' + state.deepHits.length;
      },
      onDone: function (n) {
        state.deep = null;
        syncDeep();
        $.deepBar.textContent = fill(T.deepDone, { n: n }) + ' · ' + state.deepHits.length;
        render();
      }
    });
    syncDeep();
    render();
  }

  function stopDeep() {
    if (state.deep) { state.deep.stop(); state.deep = null; syncDeep(); }
  }

  function syncDeep() {
    var on = !!state.deep;
    $.deepBtn.classList.toggle('is-on', on);
    $.deepBtn.querySelector('.deepbtn__t').textContent = on ? T.deepStop : T.deep;
    $.deepBar.hidden = !state.deepHits;
    busy(on);
  }

  function relPath(dirUrl) {
    try {
      var p = decodeURIComponent(new URL(dirUrl).pathname);
      return p === state.path ? '' : p;
    } catch (e) { return ''; }
  }

  /* ---- directory size ---------------------------------------------- */
  function measure(entry, node) {
    if (entry._measuring) return;
    entry._measuring = true;
    var bytes = 0, files = 0;
    var meta = node.querySelector('.item__meta');
    var paint = function (done) {
      meta.textContent = (entry.date ? DATE_FMT.format(entry.date) + '  ·  ' : '') +
        (done ? '' : T.calculating + ' ') + fmtSize(bytes) +
        '  ·  ' + files + ' ' + plural(files, T.files);
    };
    paint(false);
    crawl(entry.href, {
      onEntry: function (e) { if (!e.isDir) { files++; bytes += e.size || 0; } },
      onProgress: function () { paint(false); },
      onDone: function () {
        entry.measured = { bytes: bytes, files: files };
        entry._measuring = false;
        paint(true);
        window.M3L_LASTMEASURE = entry.measured;   /* test seam */
      }
    });
  }

  /* ==================================================================
     Downloading a whole directory.

     Three routes, because none of them is right everywhere:
       · File System Access — the only one that recreates the tree on disk
         and streams straight to it, but Chromium only;
       · a wget command — one line, works anywhere, resumes, and needs no
         crawl at all since wget walks the listings itself;
       · an aria2c input file — the crawl we can do here turned into paths
         a real downloader can act on.
     ================================================================== */
  var ddTarget = null, ddAbort = null, ddRunning = false;

  function wireDirDownload(ui) {
    $.ddHere.addEventListener('click', function () { openDD({ href: location.href, name: '' }); });
    $.dlg.querySelector('.dialog__scrim').addEventListener('click', closeDD);
    $.ddClose.addEventListener('click', closeDD);
    $.ddFs.hidden = !window.showDirectoryPicker;
    $.ddFs.addEventListener('click', function () { fsaDownload(ddTarget); });
    $.ddWget.addEventListener('click', function () {
      copyText(wgetCmd(ddTarget.href), T.ddCopied);
    });
    $.ddAria.addEventListener('click', function () { ariaList(ddTarget); });
  }

  function openDD(entry) {
    ddTarget = entry;
    $.dlg.hidden = false;
    requestAnimationFrame(function () { $.dlg.classList.add('show'); });
    $.dlg.querySelector('.dialog__sub').textContent =
      (entry.name || decodeURIComponent(new URL(entry.href).pathname)) + ' — ' + T.ddSub;
    $.dlg.querySelector('.dialog__hint').textContent =
      window.showDirectoryPicker ? T.ddFsHint : T.ddNoFs;
    ddProgress(null);
  }

  function closeDD() {
    if (ddRunning && ddAbort) ddAbort.cancelled = true;
    ddRunning = false;
    $.dlg.classList.remove('show');
    setTimeout(function () { if (!$.dlg.classList.contains('show')) $.dlg.hidden = true; }, 320);
  }

  function ddProgress(text, frac, file) {
    var box = $.dlg.querySelector('.dialog__prog');
    box.hidden = text == null;
    if (text == null) return;
    $.dlg.querySelector('.dialog__stat').textContent = text;
    $.dlg.querySelector('.dialog__file').textContent = file || '';
    var bar = $.dlg.querySelector('.dialog__bar span');
    bar.style.width = frac == null ? '100%' : Math.round(frac * 100) + '%';
    bar.classList.toggle('is-indeterminate', frac == null);
  }

  /* wget walks the autoindex pages itself, so this needs no crawl —
     --cut-dirs strips exactly the depth of the directory being fetched */
  function wgetCmd(href) {
    var u = new URL(href, location.href);
    var depth = u.pathname.split('/').filter(Boolean).length;
    return 'wget -r -np -nH --cut-dirs=' + depth +
           ' -R "index.html*" -e robots=off ' + JSON.stringify(u.href);
  }

  function relParts(fileHref, baseHref) {
    var b = new URL(baseHref, location.href).pathname;
    var p = new URL(fileHref, location.href).pathname;
    var rel = p.indexOf(b) === 0 ? p.slice(b.length) : p;
    try { rel = decodeURIComponent(rel); } catch (e) {}
    return rel.split('/').filter(Boolean);
  }

  function scanTree(entry, onProgress) {
    var files = [], bytes = 0;
    return new Promise(function (res) {
      ddAbort = crawl(entry.href, {
        onEntry: function (e) {
          if (e.isDir) return;
          files.push(e);
          bytes += e.size || 0;
        },
        onProgress: function () { onProgress(files.length, bytes); },
        onDone: function () { res({ files: files, bytes: bytes }); }
      });
    });
  }

  function ariaList(entry) {
    ddRunning = true;
    ddProgress(T.ddScan, null);
    scanTree(entry, function (n, b) {
      ddProgress(fill(T.ddScanned, { n: n, s: fmtSize(b) }), null);
    }).then(function (r) {
      if (!ddRunning) return;
      var lines = r.files.map(function (f) {
        return abs(f.href) + '\n  out=' + relParts(f.href, entry.href).join('/');
      }).join('\n');
      var name = (entry.name || 'directory') + '.aria2.txt';
      var a = el('a');
      a.href = URL.createObjectURL(new Blob([lines], { type: 'text/plain' }));
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      ddProgress(fill(T.ddScanned, { n: r.files.length, s: fmtSize(r.bytes) }), 1,
                 'aria2c -i ' + name + ' -d . -c -x4');
      toast(T.ddListed);
      ddRunning = false;
    });
  }

  async function fsaDownload(entry) {
    var root;
    try {
      root = await window.showDirectoryPicker({ mode: 'readwrite', id: 'm3listing' });
    } catch (e) { return; }                      /* the picker was dismissed */

    ddRunning = true;
    ddProgress(T.ddScan, null);
    var tree = await scanTree(entry, function (n, b) {
      ddProgress(fill(T.ddScanned, { n: n, s: fmtSize(b) }), null);
    });
    if (!ddRunning) return;

    var done = 0, skipped = 0, bytes = 0;
    for (var i = 0; i < tree.files.length; i++) {
      if (!ddRunning) break;
      var f = tree.files[i];
      var parts = relParts(f.href, entry.href);
      ddProgress(fill(T.ddGo, {
        i: i + 1, n: tree.files.length,
        done: fmtSize(bytes), total: fmtSize(tree.bytes)
      }), tree.bytes ? bytes / tree.bytes : (i + 1) / tree.files.length, parts.join('/'));
      try {
        var how = await saveOne(root, parts, f.href, f.exact ? f.size : 0);
        if (how === 'skip') skipped++;
      } catch (e) {
        ddProgress(fill(T.ddFail, { e: e.message }), null, parts.join('/'));
        ddRunning = false;
        return;
      }
      done++;
      bytes += f.size || 0;
    }
    ddProgress(fill(T.ddDone, { n: done }) +
               (skipped ? ' · ' + fill(T.ddSkip, { n: skipped }) : ''), 1, '');
    ddRunning = false;
  }

  /* streams the response straight into the file, so a 4 GB image never
     sits in memory; a file already there at the same size is left alone */
  async function saveOne(root, parts, url, expectSize) {
    var dir = root;
    for (var i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    var name = parts[parts.length - 1];
    if (expectSize) {
      try {
        var have = await (await dir.getFileHandle(name)).getFile();
        if (have.size === expectSize) return 'skip';
      } catch (e) {}
    }
    var fh = await dir.getFileHandle(name, { create: true });
    var w = await fh.createWritable();
    var r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) { try { await w.abort(); } catch (e) {} throw new Error('HTTP ' + r.status); }
    await r.body.pipeTo(w);
    return 'ok';
  }

  /* ==================================================================
     Search field
     ================================================================== */
  function onQuery() {
    state.query = $.q.value.trim();
    state.cursor = -1;
    $.clear.hidden = !state.query;
    if (state.deepHits) { stopDeep(); state.deepHits = null; syncDeep(); }
    var u = new URL(location.href);
    if (state.query) u.searchParams.set('q', state.query); else u.searchParams.delete('q');
    history.replaceState({}, '', u.pathname + (u.search || '') );
    $.deepBtn.hidden = !state.query;
    render();
  }

  var searchAnim;
  function syncSearch(open) {
    $.wrap.classList.toggle('is-open', open);
    $.fab.classList.toggle('is-on', open);
    $.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    $.fab.title = open ? T.close : T.find;
    swapIcon($.fab.querySelector('.rail-item__ico'), open ? 'close' : 'search');
    $.q.tabIndex = open ? 0 : -1;
    $.deepBtn.hidden = !state.query;

    /* height animates from a number, but the panel must be free to grow
       afterwards — the chips and the deep-search row appear later */
    clearTimeout(searchAnim);
    if (open) {
      $.wrap.style.height = $.wrap.scrollHeight + 'px';
      searchAnim = setTimeout(function () {
        if ($.wrap.classList.contains('is-open')) $.wrap.style.height = 'auto';
      }, 340);
    } else {
      if (!$.wrap.style.height || $.wrap.style.height === 'auto') {
        $.wrap.style.height = $.wrap.scrollHeight + 'px';
      }
      void $.wrap.offsetHeight;
      $.wrap.style.height = '0px';
    }
  }

  function openSearch(open) {
    if (open) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      syncSearch(true);
      $.q.focus(); $.q.select();
    } else {
      syncSearch(false);
      if ($.q.value) { $.q.value = ''; onQuery(); }
      $.q.blur();
    }
  }

  function swapIcon(host, name) {
    host.replaceChild(icon(name), host.querySelector('.gs'));
  }

  function syncSort() {
    ['name', 'date', 'size'].forEach(function (k) {
      var b = $.tabs.querySelector('[data-sort="' + k + '"]');
      var on = state.sort === k;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('data-desc', on && state.desc ? '1' : '0');
    });
  }

  function syncView() {
    var next = state.view === 'list' ? T.viewGrid : T.viewList;
    swapIcon($.view, state.view === 'list' ? 'grid_view' : 'view_list');
    $.view.title = next;
    $.view.setAttribute('aria-label', next);
  }

  function syncTheme(mode) {
    swapIcon($.theme.querySelector('.rail-item__ico'),
             mode === 'auto' ? 'contrast' : mode === 'light' ? 'light_mode' : 'dark_mode');
    var name = mode === 'auto' ? T.themeAuto
             : mode === 'light' ? T.themeLight : T.themeDark;
    $.theme.querySelector('.rail-item__lbl').textContent = mode === 'auto' ? T.theme : name;
    $.theme.title = T.theme + ' · ' + name;
  }

  function applyTheme(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }

  function sysDark() {
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /* ==================================================================
     Menus

     Language and theme used to be buttons that cycled through their
     three states. A cycling button cannot show which state it is in —
     you press it and find out. These are anchored single-choice menus
     instead: every option is on screen, the active one is ticked, and
     picking one is a single click.
     ================================================================== */
  var menuState = null;

  function menuHost() {
    if ($.menu) return;
    $.menu = document.querySelector('.menu');
    $.menuCard = $.menu.querySelector('.menu__card');
    /* the overlay is the whole viewport, so anything outside the card
       closes the menu — including a second press on its own button */
    $.menu.addEventListener('click', function (ev) {
      if (ev.target === $.menu) closeMenu();
    });
    $.menuCard.addEventListener('keydown', onMenuKey);
    addEventListener('resize', function () { if (menuState) placeMenu(); });
  }

  function openMenu(anchor, items, current, onPick) {
    var reopening = menuState && menuState.anchor === anchor;
    closeMenu();
    if (reopening) return;
    menuHost();

    var card = $.menuCard;
    card.textContent = '';
    items.forEach(function (it) {
      var on = it.key === current;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu__item' + (on ? ' is-on' : '');
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      if (it.icon) b.appendChild(icon(it.icon, 'menu__lead'));
      var t = document.createElement('span');
      t.className = 'menu__t';
      t.appendChild(document.createTextNode(it.label));
      if (it.sub) {
        var s = document.createElement('span');
        s.className = 'menu__sub';
        s.textContent = it.sub;
        t.appendChild(s);
      }
      b.appendChild(t);
      b.appendChild(icon('check', 'menu__ck'));
      b.addEventListener('click', function () { closeMenu(); onPick(it.key); });
      card.appendChild(b);
    });

    $.menu.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    menuState = { anchor: anchor };
    /* placeMenu() reads offsetWidth, which flushes layout and commits the
       closed state — so the class can go on in the same tick and the
       transition still runs. A requestAnimationFrame here would never
       fire in a background tab, leaving the menu invisible. */
    placeMenu();
    $.menu.classList.add('show');
    var first = card.querySelector('.menu__item.is-on') || card.querySelector('.menu__item');
    if (first) first.focus({ preventScroll: true });
  }

  /* Anchored to the rail, which is on the left on a desktop and along
     the bottom on a phone — so the menu grows sideways out of the
     button in one case and upwards out of it in the other. */
  function placeMenu() {
    var card = $.menuCard, r = menuState.anchor.getBoundingClientRect();
    var w = card.offsetWidth, h = card.offsetHeight;
    var vw = innerWidth, vh = innerHeight, gap = 8, pad = 8;
    var left, top, ox, oy;
    if (matchMedia('(max-width: 768px)').matches) {
      left = Math.max(pad, Math.min(r.left + r.width / 2 - w / 2, vw - w - pad));
      top = r.top - h - gap; ox = 'center'; oy = 'bottom';
      if (top < pad) { top = Math.min(r.bottom + gap, vh - h - pad); oy = 'top'; }
    } else {
      left = r.right + gap; ox = 'left'; oy = 'bottom';
      top = Math.max(pad, Math.min(r.bottom - h, vh - h - pad));
      if (left + w > vw - pad) { left = Math.max(pad, r.left - w - gap); ox = 'right'; }
    }
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.setProperty('--mo', ox + ' ' + oy);
  }

  function closeMenu() {
    if (!menuState) return;
    var anchor = menuState.anchor;
    menuState = null;
    $.menu.classList.remove('show');
    anchor.setAttribute('aria-expanded', 'false');
    if ($.menuCard.contains(document.activeElement)) anchor.focus({ preventScroll: true });
    setTimeout(function () { if (!menuState) $.menu.hidden = true; }, 320);
  }

  function onMenuKey(ev) {
    var items = Array.prototype.slice.call($.menuCard.querySelectorAll('.menu__item'));
    var i = items.indexOf(document.activeElement);
    if (ev.key === 'Tab') { closeMenu(); return; }
    if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (ev.key === 'Home') { ev.preventDefault(); items[0].focus(); }
    else if (ev.key === 'End') { ev.preventDefault(); items[items.length - 1].focus(); }
    /* whatever the key was, the listing behind must not also react to it */
    ev.stopPropagation();
  }

  function openThemeMenu() {
    openMenu($.theme, [
      { key: 'auto',  icon: 'contrast',   label: T.themeAuto,
        sub: sysDark() ? T.themeDark : T.themeLight },
      { key: 'light', icon: 'light_mode', label: T.themeLight },
      { key: 'dark',  icon: 'dark_mode',  label: T.themeDark }
    ], LS.get('theme', 'auto'), function (k) {
      LS.set('theme', k);
      applyTheme(k);
      syncTheme(k);
    });
  }

  /* No leading icons here: a glyph per language would either be a flag —
     which is not what a language is — or the same globe three times. */
  function openLangMenu() {
    openMenu($.lang, [
      { key: 'auto', label: T.langAuto, sub: autoLang() === 'ru' ? T.langRu : T.langEn },
      { key: 'ru',   label: T.langRu },
      { key: 'en',   label: T.langEn }
    ], LS.get('lang', 'auto'), function (k) {
      LS.set('lang', k);
      setLang(k);
      applyStrings();
      render();
    });
  }

  /* ==================================================================
     Multi-select
     ================================================================== */
  function setPicking(on) {
    state.picking = on;
    document.documentElement.classList.toggle('is-picking', on);
    $.pick.classList.toggle('is-on', on);
    $.pick.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function pool() { return state.deepHits || state.entries; }
  function selectedEntries() {
    return pool().filter(function (e) { return state.sel[e.href]; });
  }
  function selectedFiles() {
    return selectedEntries().filter(function (e) { return !e.isDir; });
  }

  function toggleSel(entry, index, rangeSel) {
    if (rangeSel && state.anchor != null && state.visible[state.anchor]) {
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

  var selbarTimer, selbarRaf = 0;
  function syncSelbar() {
    if (!$.selbar) return;
    var n = state.selN;
    clearTimeout(selbarTimer);
    cancelAnimationFrame(selbarRaf);
    if (n) {
      $.selbar.querySelector('.selbar__n').textContent = T.selected + ' ' + n;
      $.seldl.disabled = selectedFiles().length === 0;
      $.selbar.hidden = false;
      selbarRaf = requestAnimationFrame(function () {
        if (state.selN) $.selbar.classList.add('show');
      });
    } else {
      $.selbar.classList.remove('show');
      selbarTimer = setTimeout(function () { if (!state.selN) $.selbar.hidden = true; }, 340);
    }
  }

  /* Browsers throttle programmatic downloads and ask once for permission
     when more than one is triggered — spacing them out keeps that to a
     single prompt. There is no backend here, so no server-side zip. */
  function downloadSelected() {
    var files = selectedFiles();
    if (!files.length) return;
    toast(fill(T.dlStarted, { n: files.length }));
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
    copyText(entries.map(function (e) { return abs(e.href); }).join('\n'),
             fill(T.copiedN, { n: entries.length }));
  }

  function copyAsList() {
    var entries = selectedEntries();
    if (!entries.length) return;
    copyText(entries.map(function (e) {
      return [e.name,
              e.isDir ? T.folder : fmtSize(e.size),
              e.date ? DATE_FMT.format(e.date) : ''].join('\t');
    }).join('\n'), T.copiedList);
  }

  /* ==================================================================
     Render
     ================================================================== */
  function render() {
    var q = state.query.toLowerCase();
    var deep = !!state.deepHits;
    var src = deep ? state.deepHits : state.entries;

    var items = src.filter(function (e) {
      if (!deep && q && e.name.toLowerCase().indexOf(q) === -1) return false;
      if (state.group !== 'all' && groupOf(e) !== state.group) return false;
      return true;
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
    state.anchor = null;

    renderChips(src);

    $.list.textContent = '';
    $.list.className = 'list' + (state.view === 'grid' ? ' grid' : '');

    var frag = document.createDocumentFragment();
    items.forEach(function (e, i) { frag.appendChild(row(e, i, q)); });
    $.list.appendChild(frag);
    observeThumbs();

    $.empty.hidden = items.length > 0;
    if (!items.length) {
      $.empty.querySelector('p').textContent =
        (state.entries.length || deep) ? T.nothing : T.emptyDir;
    }

    var nd = 0, nf = 0, total = 0;
    items.forEach(function (e) {
      if (e.isDir) nd++; else { nf++; total += (e.size || 0); }
    });
    var parts = [];
    if (nd) parts.push(nd + ' ' + plural(nd, T.dirs));
    if (nf) parts.push(nf + ' ' + plural(nf, T.files));
    if (total) parts.push(fmtSize(total));
    $.stats.textContent = parts.length ? parts.join(' · ') : T.empty;

    syncSelbar();
  }

  function renderChips(src) {
    var counts = { all: src.length };
    src.forEach(function (e) {
      var g = groupOf(e);
      counts[g] = (counts[g] || 0) + 1;
    });
    var order = ['all', 'dir', 'pic', 'vid', 'snd', 'arch', 'doc', 'code', 'bin', 'other'];
    $.chips.textContent = '';
    var shown = 0;
    order.forEach(function (g) {
      if (g !== 'all' && !counts[g]) return;
      shown++;
      var b = el('button', 'chip' + (state.group === g ? ' is-on' : ''));
      b.type = 'button';
      b.textContent = T.groups[g] + (g === 'all' ? '' : ' ' + counts[g]);
      b.addEventListener('click', function () {
        state.group = state.group === g ? 'all' : g;
        render();
      });
      $.chips.appendChild(b);
    });
    $.chips.hidden = shown < 3;
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

    /* Touch has no modifier keys, and the phone's bottom bar carries no
       Select button — a long press starts selection there, the same
       gesture a phone's own file manager uses. */
    var pressed = false, pressTimer = null;
    var pressOff = function () { clearTimeout(pressTimer); pressTimer = null; };
    a.addEventListener('touchstart', function () {
      pressed = false;
      pressTimer = setTimeout(function () {
        pressed = true;
        if (!state.picking) setPicking(true);
        toggleSel(e, i);
        if (navigator.vibrate) navigator.vibrate(10);
      }, 500);
    }, { passive: true });
    ['touchmove', 'touchend', 'touchcancel'].forEach(function (t) {
      a.addEventListener(t, pressOff, { passive: true });
    });

    var link = el('a', 'item__link');
    link.href = e.href;
    link.setAttribute('aria-label', e.name);
    link.addEventListener('click', function (ev) {
      /* the tap that ended a long press must not also open the row */
      if (pressed) { pressed = false; ev.preventDefault(); return; }
      if (state.picking || ev.ctrlKey || ev.metaKey || ev.shiftKey) {
        ev.preventDefault();
        toggleSel(e, i, ev.shiftKey);
        return;
      }
      if (ev.button) return;
      if (e.isDir) { ev.preventDefault(); go(link.href, true); return; }
      if (previewKind(e)) { ev.preventDefault(); openViewer(e); }
    });
    a.appendChild(link);

    /* the leading chip doubles as the checkbox */
    var ico = el('span', 'item__ico');
    ico.appendChild(icon(k.icon, 'type', k.fb));
    ico.appendChild(icon('check', 'check'));
    if (thumbable(e)) { ico.dataset.thumb = e.href; a.classList.add('has-thumb'); }
    ico.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      toggleSel(e, i, ev.shiftKey);
    });
    a.appendChild(ico);

    var body = el('span', 'item__body');
    /* the badge is a sibling of the name, not a child: inside it, a long
       name's ellipsis swallows the badge or shoves it off the row */
    var title = el('span', 'item__title');
    var nm = el('span', 'item__name');
    nm.appendChild(highlight(e.name, q));
    title.appendChild(nm);
    if (isFresh(e)) title.appendChild(el('span', 'freshdot', T.fresh));
    body.appendChild(title);

    var meta = el('span', 'item__meta');
    var bits = [];
    if (e.rel) bits.push(fill(T.deepIn, { p: e.rel }));
    if (e.date) bits.push(DATE_FMT.format(e.date));
    bits.push(e.isDir
      ? (e.measured ? fmtSize(e.measured.bytes) + '  ·  ' + e.measured.files + ' ' +
                      plural(e.measured.files, T.files) : T.folder)
      : fmtSize(e.size));
    meta.textContent = bits.filter(Boolean).join('  ·  ');
    body.appendChild(meta);
    a.appendChild(body);

    var tail = el('span', 'item__tail');

    if (e.isDir) {
      var msr = el('button', 'iconbtn hoveronly');
      msr.type = 'button';
      msr.title = T.calcSize;
      msr.appendChild(icon('straighten'));
      msr.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation(); measure(e, a);
      });
      tail.appendChild(msr);

      var ddb = el('button', 'iconbtn hoveronly');
      ddb.type = 'button';
      ddb.title = T.ddTitle;
      ddb.appendChild(icon('download'));
      ddb.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation(); openDD(e);
      });
      tail.appendChild(ddb);
    } else {
      var inf = el('button', 'iconbtn hoveronly');
      inf.type = 'button';
      inf.title = T.props;
      inf.appendChild(icon('info'));
      inf.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation(); openViewer(e, true);
      });
      tail.appendChild(inf);
    }

    var copy = el('button', 'iconbtn hoveronly');
    copy.type = 'button';
    copy.title = T.copy;
    copy.appendChild(icon('link'));
    copy.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      copyText(abs(e.href), T.copied);
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

  /* ---- thumbnails --------------------------------------------------- */
  var THUMBS = 'jpg jpeg jfif png gif webp bmp avif svg ico';

  function thumbable(e) {
    if (e.isDir) return false;
    var x = ext(e.name);
    if (THUMBS.split(' ').indexOf(x) === -1) return false;
    return e.size == null || e.size <= CFG.thumbMaxMB * 1048576;
  }

  var thumbObserver = null;
  function observeThumbs() {
    if (!('IntersectionObserver' in window)) return;
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver(function (rows) {
        rows.forEach(function (r) {
          if (!r.isIntersecting) return;
          thumbObserver.unobserve(r.target);
          loadThumb(r.target);
        });
      }, { rootMargin: '300px' });
    }
    Array.prototype.forEach.call($.list.querySelectorAll('.item__ico[data-thumb]'),
      function (n) { thumbObserver.observe(n); });
  }

  function loadThumb(ico) {
    var url = ico.dataset.thumb;
    delete ico.dataset.thumb;
    var img = new Image();
    img.className = 'item__thumb';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', function () {
      ico.appendChild(img);
      requestAnimationFrame(function () { ico.classList.add('has-img'); });
    });
    img.src = url;
  }

  /* ==================================================================
     Viewer — preview plus properties, one overlay for both
     ================================================================== */
  var PREV = {
    image: 'jpg jpeg jfif jpe png gif webp bmp avif svg ico',
    video: 'mp4 m4v webm mov mkv ogv',
    audio: 'mp3 flac wav ogg oga m4a aac opus',
    pdf:   'pdf',
    text:  'txt md markdown log nfo readme conf cnf cfg ini yaml yml toml json xml ' +
           'html htm css js mjs ts py sh bash bat ps1 c h cpp hpp cc pl pm t sql ' +
           'csv tsv srt vtt env service properties pem csr'
  };

  function previewKind(e) {
    if (e.isDir) return null;
    var x = ext(e.name);
    for (var k in PREV) if (PREV[k].split(' ').indexOf(x) >= 0) return k;
    return null;
  }

  function wireViewer() {
    $.vTitle = $.viewer.querySelector('.viewer__name');
    $.vStage = $.viewer.querySelector('.viewer__stage');
    $.vProps = $.viewer.querySelector('.viewer__props');
    $.vQr = $.viewer.querySelector('.viewer__qr');
    $.viewer.querySelector('.viewer__scrim').addEventListener('click', closeViewer);
    $.viewer.querySelector('.viewer__close').addEventListener('click', closeViewer);
    $.viewer.querySelector('.viewer__prev').addEventListener('click', function () { step(-1); });
    $.viewer.querySelector('.viewer__next').addEventListener('click', function () { step(1); });
    $.vQrBtn = $.viewer.querySelector('.viewer__qrbtn');
    $.vQrBtn.title = T.qr;
    $.vQrBtn.setAttribute('aria-pressed', 'false');
    $.vQrBtn.addEventListener('click', function () {
      showQR(!$.vQr.classList.contains('is-open'));
    });
    $.vDl = $.viewer.querySelector('.viewer__dl');
    $.vDl.title = T.download;
    $.vCopy = $.viewer.querySelector('.viewer__copy');
    $.vCopy.title = T.copy;
    $.vCopy.addEventListener('click', function () { copyText(abs(state.viewing.href), T.copied); });
  }

  /* The panel is measured to be animated, so its height is a number while
     it moves and `auto` once it has arrived — otherwise a taller QR code
     for a longer URL would be clipped at the old height. */
  var qrTimer;

  function showQR(on) {
    var n = $.vQr;
    clearTimeout(qrTimer);
    if (on) {
      n.hidden = false;
      drawQR(n, abs(state.viewing.href));
      n.style.height = '0px';
      void n.offsetHeight;              /* commit the closed state first */
      n.classList.add('is-open');
      n.style.height = n.scrollHeight + 'px';
      qrTimer = setTimeout(function () {
        if (n.classList.contains('is-open')) n.style.height = 'auto';
      }, 340);
    } else {
      n.style.height = n.scrollHeight + 'px';
      void n.offsetHeight;
      n.classList.remove('is-open');
      n.style.height = '0px';
      qrTimer = setTimeout(function () {
        if (!n.classList.contains('is-open')) { n.hidden = true; n.textContent = ''; }
      }, 340);
    }
    $.vQrBtn.classList.toggle('is-on', on);
    $.vQrBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function resetQR() {
    clearTimeout(qrTimer);
    $.vQr.classList.remove('is-open');
    $.vQr.style.height = '';
    $.vQr.textContent = '';
    $.vQr.hidden = true;
    $.vQrBtn.classList.remove('is-on');
    $.vQrBtn.setAttribute('aria-pressed', 'false');
  }

  /* The enter transition needs a frame between `hidden = false` and the
     `show` class. Tracking that with the class alone breaks on a fast
     open-then-close: the queued frame puts `show` back after the close
     already ran, and the overlay stays up forever. Hence the flag. */
  var viewerOpen = false, viewerRaf = 0;

  function openViewer(entry, propsOnly) {
    state.viewing = entry;
    viewerOpen = true;
    $.viewer.hidden = false;
    cancelAnimationFrame(viewerRaf);
    viewerRaf = requestAnimationFrame(function () {
      if (viewerOpen) $.viewer.classList.add('show');
    });
    $.vTitle.textContent = entry.name;
    $.vDl.href = entry.href;
    /* stepping to the next file keeps the QR panel open — it is a mode,
       not a one-off — but redraws it for the file now on screen */
    var keepQR = $.vQr.classList.contains('is-open');
    resetQR();
    if (keepQR) {
      $.vQr.hidden = false;
      drawQR($.vQr, abs(entry.href));
      $.vQr.classList.add('is-open');
      $.vQr.style.height = 'auto';
      $.vQrBtn.classList.add('is-on');
      $.vQrBtn.setAttribute('aria-pressed', 'true');
    }
    $.vStage.textContent = '';
    $.vProps.textContent = '';

    var kind = propsOnly ? null : previewKind(entry);
    if (kind) renderPreview(kind, entry);
    else {
      var ph = el('div', 'viewer__none');
      ph.appendChild(icon(kindOf(entry).icon, null, kindOf(entry).fb));
      ph.appendChild(el('p', null, T.noPreview));
      $.vStage.appendChild(ph);
    }
    loadProps(entry);
  }

  function renderPreview(kind, entry) {
    var n;
    if (kind === 'image') {
      n = new Image();
      n.className = 'viewer__img';
      n.alt = entry.name;
      n.src = entry.href;
    } else if (kind === 'video' || kind === 'audio') {
      n = document.createElement(kind);
      n.className = 'viewer__media';
      n.src = entry.href;
      n.controls = true;
      n.autoplay = true;
      n.addEventListener('ended', function () { step(1, true); });
    } else if (kind === 'pdf') {
      n = el('iframe', 'viewer__frame');
      n.src = entry.href;
      n.setAttribute('title', entry.name);
    } else {
      n = el('pre', 'viewer__text', T.loading);
      fetch(entry.href, { headers: { Range: 'bytes=0-524287' }, credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          n.textContent = t;
          if (entry.size > 524288) n.textContent += '\n\n…';
        })
        .catch(function () { n.textContent = T.probeFail; });
    }
    $.vStage.appendChild(n);
  }

  function step(dir, onlyMedia) {
    var list = state.visible.filter(function (e) {
      var k = previewKind(e);
      return onlyMedia ? (k === 'audio' || k === 'video') : !!k;
    });
    if (!list.length) return;
    var idx = list.indexOf(state.viewing);
    var next = list[(idx + dir + list.length) % list.length];
    if (next && next !== state.viewing) openViewer(next);
  }

  function closeViewer() {
    viewerOpen = false;
    cancelAnimationFrame(viewerRaf);
    $.viewer.classList.remove('show');
    var media = $.vStage.querySelector('video, audio');
    if (media) { try { media.pause(); } catch (e) {} }
    setTimeout(function () {
      if (!viewerOpen) {
        $.viewer.hidden = true;
        $.vStage.textContent = '';
      }
    }, 320);
    state.viewing = null;
  }

  /* ---- properties --------------------------------------------------- */
  function loadProps(entry) {
    var dl = el('dl', 'props');
    addProp(dl, T.size, entry.size != null
      ? fmtSize(entry.size) + (entry.exact ? ' (' + entry.size.toLocaleString(LOCALE) + ')' : '')
      : null);
    addProp(dl, T.date, entry.date ? DATE_FMT.format(entry.date) : null);
    $.vProps.appendChild(dl);

    var x = ext(entry.name);
    if (!window.M3LProbe || !window.M3LProbe.supports(x)) return;

    var wait = el('p', 'props__wait', T.loading);
    $.vProps.appendChild(wait);

    var size = entry.size;
    var run = function (sz) {
      return window.M3LProbe.probe(entry.href, x, sz).then(function (info) {
        wait.remove();
        renderProps(info);
      });
    };
    /* a rounded size from the listing is not good enough for tail reads */
    var pre = entry.exact ? Promise.resolve(size)
                          : window.M3LProbe.head(entry.href).then(function (h) { return h.size || size; });
    pre.then(run).catch(function () {
      wait.textContent = T.probeFail;
    });
  }

  function addProp(dl, k, v) {
    if (v == null || v === '' || v === false) return;
    dl.appendChild(el('dt', null, k));
    dl.appendChild(el('dd', null, String(v)));
  }

  function renderProps(info) {
    var F = T.f;
    var dl = el('dl', 'props');

    if (info.kind === 'image') {
      addProp(dl, F.format, info.format);
      if (info.width && info.height) addProp(dl, F.dim, info.width + ' × ' + info.height);
      addProp(dl, F.depth, info.depth ? info.depth + ' bit' : null);
      addProp(dl, F.color, info.color);
      var x = info.exif;
      if (x) {
        addProp(dl, F.make, x.make);
        addProp(dl, F.model, x.model);
        addProp(dl, F.lens, x.lens);
        addProp(dl, F.taken, x.taken || x.datetime);
        addProp(dl, F.exposure, x.exposure ? (x.exposure < 1
          ? '1/' + Math.round(1 / x.exposure) + ' s' : x.exposure + ' s') : null);
        addProp(dl, F.fnumber, x.fnumber ? 'f/' + x.fnumber : null);
        addProp(dl, F.iso, x.iso);
        addProp(dl, F.focal, x.focal ? Math.round(x.focal) + ' мм' : null);
      }
    } else if (info.kind === 'video') {
      addProp(dl, F.container, info.container + (info.brand ? ' (' + info.brand + ')' : ''));
      addProp(dl, F.title, info.title);
      addProp(dl, F.duration, window.M3LProbe.fmtDuration(info.duration));
      if (info.width && info.height) addProp(dl, F.dim, info.width + ' × ' + info.height);
      addProp(dl, F.muxer, info.muxer);
      (info.tracks || []).forEach(function (t) {
        var label = t.type === 'vide' ? F.video : t.type === 'soun' ? F.audio : F.subs;
        var bits = [t.codec];
        if (t.width && t.height) bits.push(t.width + '×' + t.height);
        if (t.channels) bits.push(t.channels + ' ch');
        if (t.rate) bits.push(Math.round(t.rate) + ' Hz');
        if (t.lang) bits.push(t.lang);
        if (t.name) bits.push(t.name);
        addProp(dl, label, bits.filter(Boolean).join(' · '));
      });
    } else if (info.kind === 'audio') {
      addProp(dl, F.format, info.format);
      addProp(dl, F.duration, window.M3LProbe.fmtDuration(info.duration));
      var tg = info.tags || {};
      addProp(dl, F.title, tg.title);
      addProp(dl, F.artist, tg.artist);
      addProp(dl, F.album, tg.album);
      addProp(dl, F.year, tg.year || tg.date);
      addProp(dl, F.track, tg.track || tg.tracknumber);
      addProp(dl, F.genre, tg.genre);
      addProp(dl, F.bitrate, info.bitrate ? info.bitrate + ' kbps' + (info.vbr ? ' VBR' : '') : null);
      addProp(dl, F.rate, info.rate ? info.rate + ' Hz' : null);
      addProp(dl, F.channels, info.channels);
      addProp(dl, F.bits, info.bits);
      if (info.cover) {
        var c = new Image();
        c.className = 'props__cover';
        c.src = info.cover;
        $.vProps.appendChild(c);
      }
    } else if (info.kind === 'iso') {
      addProp(dl, F.label, info.label);
      addProp(dl, F.system, info.system);
      addProp(dl, F.publisher, info.publisher);
      addProp(dl, F.preparer, info.preparer);
      addProp(dl, F.application, info.application);
      addProp(dl, F.volumeSize, info.volumeSize ? fmtSize(info.volumeSize) : null);
      addProp(dl, F.blocks, info.blocks ? info.blocks.toLocaleString(LOCALE) : null);
      addProp(dl, F.created, info.created ? DATE_FMT.format(info.created) : null);
    } else if (info.kind === 'zip') {
      addProp(dl, F.entries, info.count);
      addProp(dl, F.totalSize, fmtSize(info.totalSize));
      addProp(dl, F.packedSize, fmtSize(info.packedSize));
      if (info.totalSize) {
        addProp(dl, F.ratio, Math.round(100 - info.packedSize / info.totalSize * 100) + '%');
      }
    }

    if (dl.childNodes.length) $.vProps.appendChild(dl);

    if (info.kind === 'zip' && info.entries.length) {
      $.vProps.appendChild(el('h3', 'props__h', T.inside));
      var tbl = el('div', 'zip');
      info.entries.forEach(function (z) {
        var r = el('div', 'zip__row' + (z.dir ? ' is-dir' : ''));
        r.appendChild(el('span', 'zip__n', z.name));
        r.appendChild(el('span', 'zip__s', z.dir ? '' : fmtSize(z.size)));
        tbl.appendChild(r);
      });
      $.vProps.appendChild(tbl);
      if (info.truncated) {
        $.vProps.appendChild(el('p', 'props__wait',
          fill(T.more, { n: info.count - info.shown })));
      }
    }
  }

  /* ==================================================================
     QR — byte mode, ECC level L, versions 1..10. Enough for a URL, and
     it keeps the page free of any external request.
     ================================================================== */
  var QR_CAP = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  var QR_TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  var QR_ECB = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  var QR_BLOCKS = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
  var QR_ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34],
                  [6,22,38], [6,24,42], [6,26,46], [6,28,50]];

  var GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
  (function () {
    for (var i = 0, x = 1; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
  })();
  function gmul(a, b) { return (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0; }

  function rsGen(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gmul(g[j], GF_EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function rsEncode(data, n) {
    var g = rsGen(n), res = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (f) for (var j = 0; j < n; j++) res[j] ^= gmul(g[j + 1], f);
    }
    return res;
  }

  function qrEncode(text) {
    var bytes = new TextEncoder().encode(text);
    var ver = 0;
    while (ver < 10 && bytes.length > QR_CAP[ver]) ver++;
    if (bytes.length > QR_CAP[ver]) return null;
    var version = ver + 1;

    var lenBits = version >= 10 ? 16 : 8;
    var bits = [];
    var push = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(4, 4);
    push(bytes.length, lenBits);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var totalCw = QR_TOTAL[ver], ecPer = QR_ECB[ver], blocks = QR_BLOCKS[ver];
    var dataCw = totalCw - ecPer * blocks;
    push(0, Math.min(4, dataCw * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k];
      data.push(v);
    }
    var pads = [0xEC, 0x11], pi = 0;
    while (data.length < dataCw) data.push(pads[pi++ % 2]);

    /* split into blocks: the tail blocks are one codeword longer */
    var short = Math.floor(dataCw / blocks), longCount = dataCw % blocks;
    var dBlocks = [], eBlocks = [], at = 0;
    for (var bi = 0; bi < blocks; bi++) {
      var len = short + (bi >= blocks - longCount ? 1 : 0);
      var chunk = data.slice(at, at + len); at += len;
      dBlocks.push(chunk);
      eBlocks.push(rsEncode(chunk, ecPer));
    }
    var out = [];
    var maxLen = Math.max.apply(null, dBlocks.map(function (d) { return d.length; }));
    for (var c = 0; c < maxLen; c++)
      for (var bb = 0; bb < blocks; bb++) if (c < dBlocks[bb].length) out.push(dBlocks[bb][c]);
    for (var c2 = 0; c2 < ecPer; c2++)
      for (var bb2 = 0; bb2 < blocks; bb2++) out.push(eBlocks[bb2][c2]);

    return { version: version, codewords: out };
  }

  function qrMatrix(text) {
    var enc = qrEncode(text);
    if (!enc) return null;
    var version = enc.version, size = version * 4 + 17;
    var m = [], reserved = [];
    for (var i = 0; i < size; i++) { m.push(new Uint8Array(size)); reserved.push(new Uint8Array(size)); }

    function setF(r, c, v) { if (r >= 0 && c >= 0 && r < size && c < size) { m[r][c] = v; reserved[r][c] = 1; } }

    /* finders + separators */
    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(function (p) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                 (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                 (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setF(p[0] + r, p[1] + c, on ? 1 : 0);
      }
    });
    /* timing */
    for (var t = 8; t < size - 8; t++) { setF(6, t, t % 2 ? 0 : 1); setF(t, 6, t % 2 ? 0 : 1); }
    /* alignment */
    var al = QR_ALIGN[version - 1];
    for (var a1 = 0; a1 < al.length; a1++) for (var a2 = 0; a2 < al.length; a2++) {
      var ar = al[a1], ac = al[a2];
      if ((ar <= 7 && ac <= 7) || (ar <= 7 && ac >= size - 8) || (ar >= size - 8 && ac <= 7)) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++)
        setF(ar + dr, ac + dc, (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (!dr && !dc)) ? 1 : 0);
    }
    /* dark module + format/version reservations */
    setF(size - 8, 8, 1);
    for (var f = 0; f < 9; f++) { if (f !== 6) { reserved[8][f] = 1; reserved[f][8] = 1; } }
    for (var f2 = 0; f2 < 8; f2++) { reserved[8][size - 1 - f2] = 1; reserved[size - 1 - f2][8] = 1; }
    if (version >= 7) {
      for (var vr = 0; vr < 6; vr++) for (var vc = 0; vc < 3; vc++) {
        reserved[vr][size - 11 + vc] = 1; reserved[size - 11 + vc][vr] = 1;
      }
    }

    /* data placement */
    var cw = enc.codewords, bitIdx = 0, dir = -1, row = size - 1;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (var s = 0; s < 2; s++) {
          var cc = col - s;
          if (!reserved[row][cc]) {
            var bit = 0;
            if (bitIdx < cw.length * 8) bit = (cw[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
            m[row][cc] = bit;
          }
        }
        row += dir;
        if (row < 0 || row >= size) { row -= dir; dir = -dir; break; }
      }
    }

    /* mask selection over the standard eight patterns */
    var MASKS = [
      function (r, c) { return (r + c) % 2 === 0; },
      function (r) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ];
    var best = null, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var cand = m.map(function (r) { return Uint8Array.from(r); });
      for (var r2 = 0; r2 < size; r2++) for (var c2b = 0; c2b < size; c2b++)
        if (!reserved[r2][c2b] && MASKS[mk](r2, c2b)) cand[r2][c2b] ^= 1;
      placeFormat(cand, size, mk);
      if (version >= 7) placeVersion(cand, size, version);
      var sc = penalty(cand, size);
      if (sc < bestScore) { bestScore = sc; best = cand; }
    }
    return { size: size, m: best };
  }

  function placeFormat(m, size, mask) {
    var data = (0x01 << 3) | mask;              /* ECC level L = 01 */
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
    var bitsv = (((data << 10) | rem) ^ 0x5412);
    /* Bit 0 is the LSB and sits at (0,8) / (8,size-1); the sequence then
       walks inwards. Mirroring these two runs produces a code that looks
       perfectly well formed and decodes in nothing. */
    for (var k = 0; k < 15; k++) {
      var bit = (bitsv >> k) & 1;
      /* vertical run, column 8 */
      if (k < 6) m[k][8] = bit;
      else if (k < 8) m[k + 1][8] = bit;
      else m[size - 15 + k][8] = bit;
      /* horizontal run, row 8 */
      if (k < 8) m[8][size - 1 - k] = bit;
      else if (k === 8) m[8][7] = bit;
      else m[8][14 - k] = bit;
    }
    m[size - 8][8] = 1;
  }

  function placeVersion(m, size, version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >> 11) & 1) * 0x1F25);
    var bitsv = (version << 12) | rem;
    for (var k = 0; k < 18; k++) {
      var bit = (bitsv >> k) & 1;
      var r = Math.floor(k / 3), c = k % 3;
      m[r][size - 11 + c] = bit;
      m[size - 11 + c][r] = bit;
    }
  }

  function penalty(m, size) {
    var score = 0, r, c, run, i;
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
      var s = m[r][c] + m[r][c + 1] + m[r + 1][c] + m[r + 1][c + 1];
      if (s === 0 || s === 4) score += 3;
    }
    var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    for (r = 0; r < size; r++) for (c = 0; c + 11 <= size; c++) {
      var ok = true;
      for (i = 0; i < 11; i++) if (m[r][c + i] !== pat[i]) { ok = false; break; }
      if (ok) score += 40;
      ok = true;
      for (i = 0; i < 11; i++) if (m[c + i][r] !== pat[i]) { ok = false; break; }
      if (ok) score += 40;
    }
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
    return score;
  }

  function drawQR(host, text) {
    host.textContent = '';
    var q = qrMatrix(text);
    if (!q) { host.appendChild(el('p', 'props__wait', T.probeFail)); return; }
    var quiet = 4, scale = 5, px = (q.size + quiet * 2) * scale;
    var cv = document.createElement('canvas');
    cv.width = cv.height = px;
    cv.className = 'qr';
    var g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, px, px);
    g.fillStyle = '#000';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++)
      if (q.m[r][c]) g.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    host.appendChild(cv);
  }
  window.M3L_QR = qrMatrix;

  /* ==================================================================
     Clipboard + toast
     ================================================================== */
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
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var ta = el('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }

  /* ==================================================================
     Keyboard
     ================================================================== */
  var typeBuf = '', typeTimer;

  function onKey(ev) {
    /* an open menu owns the keyboard; it stops what it handles from
       reaching here, and the rest must not reach here either */
    if (menuState) return;
    var inField = ev.target === $.q;

    if (state.viewing) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeViewer(); return; }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); step(1); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(-1); return; }
    }

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
      if (lnk) { ev.preventDefault(); lnk.click(); }
      return;
    }
    /* type-ahead: letters jump to the first matching name */
    if (!inField && !ev.ctrlKey && !ev.metaKey && !ev.altKey &&
        ev.key.length === 1 && ev.key !== ' ') {
      typeBuf += ev.key.toLowerCase();
      clearTimeout(typeTimer);
      typeTimer = setTimeout(function () { typeBuf = ''; }, 900);
      for (var i = 0; i < state.visible.length; i++) {
        if (state.visible[i].name.toLowerCase().indexOf(typeBuf) === 0) {
          state.cursor = i; moveCursor(); break;
        }
      }
    }
  }

  function moveCursor() {
    var nodes = document.querySelectorAll('.item');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('is-cursor', i === state.cursor);
    if (nodes[state.cursor]) nodes[state.cursor].scrollIntoView({ block: 'nearest' });
  }

  /* ==================================================================
     Go
     ================================================================== */
  applyTheme(LS.get('theme', 'auto'));
  setLang(LS.get('lang', 'auto'));

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
