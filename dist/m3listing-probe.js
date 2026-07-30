/* =====================================================================
   m3listing-probe — read a file's properties without downloading it.

   Everything here works on HTTP Range requests: a few kilobytes from the
   head or the tail of a file is enough to recover the volume label of an
   ISO, the table of contents of a ZIP, the duration and codecs of an MP4
   or MKV, the tags and cover art of an MP3 or FLAC, and the dimensions
   and EXIF of a picture.

   Exposes window.M3LProbe. No dependencies, no backend.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Range fetching.

     Requests are queued: an nginx in front of a file share commonly caps
     concurrent connections per client for big files (one, in the setup
     this was written for), and a burst of parallel probes would collect
     429s instead of answers.
     ------------------------------------------------------------------ */
  var queue = [], active = 0, LIMIT = 1;

  function run() {
    while (active < LIMIT && queue.length) {
      var job = queue.shift();
      active++;
      job.fn().then(job.res, job.rej).then(function () {
        active--; run();
      });
    }
  }

  function enqueue(fn) {
    return new Promise(function (res, rej) {
      queue.push({ fn: fn, res: res, rej: rej });
      run();
    });
  }

  /* start/end are inclusive, as in the Range header. A negative start
     means "the last N bytes". */
  function range(url, start, end) {
    return enqueue(function () {
      var spec = start < 0 ? 'bytes=' + start : 'bytes=' + start + '-' + end;
      return fetch(url, { headers: { Range: spec }, credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (r.status !== 206 && start !== 0) throw new Error('no range support');
          return r.arrayBuffer();
        });
    });
  }

  function head(url) {
    return enqueue(function () {
      return fetch(url, { method: 'HEAD', credentials: 'same-origin' })
        .then(function (r) {
          return {
            size: parseInt(r.headers.get('content-length') || '0', 10),
            type: r.headers.get('content-type') || '',
            modified: r.headers.get('last-modified') || '',
            ranges: (r.headers.get('accept-ranges') || '') === 'bytes'
          };
        });
    });
  }

  /* ------------------------------------------------------------------
     Byte helpers
     ------------------------------------------------------------------ */
  function DV(buf) { return new DataView(buf); }
  function U8(buf) { return new Uint8Array(buf); }

  function ascii(bytes, from, len) {
    var s = '';
    for (var i = from; i < from + len && i < bytes.length; i++) {
      var c = bytes[i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }

  function utf8(bytes, from, len) {
    try { return new TextDecoder('utf-8').decode(bytes.subarray(from, from + len)); }
    catch (e) { return ascii(bytes, from, len); }
  }

  function find(bytes, sig, from, to) {
    to = Math.min(to == null ? bytes.length : to, bytes.length) - sig.length;
    outer: for (var i = from || 0; i <= to; i++) {
      for (var j = 0; j < sig.length; j++) if (bytes[i + j] !== sig[j]) continue outer;
      return i;
    }
    return -1;
  }

  function findLast(bytes, sig, from) {
    outer: for (var i = bytes.length - sig.length; i >= (from || 0); i--) {
      for (var j = 0; j < sig.length; j++) if (bytes[i + j] !== sig[j]) continue outer;
      return i;
    }
    return -1;
  }

  function fmtDuration(sec) {
    if (!isFinite(sec) || sec <= 0) return null;
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
  }

  /* ==================================================================
     ZIP family — .zip .apk .jar .docx .xlsx .pptx .epub .ova(tar? no)
     Reads the end-of-central-directory from the tail, then the central
     directory itself: the full table of contents for a few kilobytes.
     ================================================================== */
  var EOCD = [0x50, 0x4b, 0x05, 0x06];
  var EOCD64_LOC = [0x50, 0x4b, 0x06, 0x07];
  var EOCD64 = [0x50, 0x4b, 0x06, 0x06];
  var CEN = [0x50, 0x4b, 0x01, 0x02];

  function zip(url, fileSize) {
    var tail = Math.min(fileSize, 66000);        /* EOCD + max comment */
    return range(url, fileSize - tail, fileSize - 1).then(function (buf) {
      var b = U8(buf), v = DV(buf);
      var e = findLast(b, EOCD);
      if (e < 0) throw new Error('not a zip');

      var count = v.getUint16(e + 10, true);
      var cdSize = v.getUint32(e + 12, true);
      var cdOff = v.getUint32(e + 16, true);

      /* zip64 rescue when the 32-bit fields are saturated */
      if (cdOff === 0xFFFFFFFF || cdSize === 0xFFFFFFFF || count === 0xFFFF) {
        var loc = findLast(b, EOCD64_LOC);
        if (loc >= 0) {
          var z64 = v.getUint32(loc + 8, true) + v.getUint32(loc + 12, true) * 4294967296;
          var inTail = z64 - (fileSize - tail);
          if (inTail >= 0 && inTail + 56 < b.length &&
              find(b, EOCD64, inTail, inTail + 4) === inTail) {
            count = v.getUint32(inTail + 32, true) + v.getUint32(inTail + 36, true) * 4294967296;
            cdSize = v.getUint32(inTail + 40, true) + v.getUint32(inTail + 44, true) * 4294967296;
            cdOff = v.getUint32(inTail + 48, true) + v.getUint32(inTail + 52, true) * 4294967296;
          }
        }
      }

      var have = fileSize - tail;
      if (cdOff >= have) return parseCentral(b, cdOff - have, count, cdSize);
      return range(url, cdOff, cdOff + Math.min(cdSize, 4 << 20) - 1)
        .then(function (cd) { return parseCentral(U8(cd), 0, count, cdSize); });
    });
  }

  function parseCentral(b, at, count, cdSize) {
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    var out = [], p = at, n = 0, totalRaw = 0, totalPacked = 0, truncated = false;
    while (p + 46 <= b.length && n < count) {
      if (!(b[p] === 0x50 && b[p + 1] === 0x4b && b[p + 2] === 0x01 && b[p + 3] === 0x02)) break;
      var flags = v.getUint16(p + 8, true);
      var method = v.getUint16(p + 10, true);
      var time = v.getUint16(p + 12, true);
      var date = v.getUint16(p + 14, true);
      var packed = v.getUint32(p + 20, true);
      var raw = v.getUint32(p + 24, true);
      var nameLen = v.getUint16(p + 28, true);
      var extraLen = v.getUint16(p + 30, true);
      var cmtLen = v.getUint16(p + 32, true);
      var name = (flags & 0x800) ? utf8(b, p + 46, nameLen) : ascii(b, p + 46, nameLen);

      totalRaw += raw; totalPacked += packed;
      if (out.length < 400) {
        out.push({
          name: name,
          size: raw,
          packed: packed,
          dir: name.charAt(name.length - 1) === '/',
          method: method,
          date: dosDate(date, time)
        });
      } else truncated = true;

      p += 46 + nameLen + extraLen + cmtLen;
      n++;
    }
    return {
      kind: 'zip',
      entries: out,
      count: count || n,
      shown: out.length,
      truncated: truncated || (cdSize && n < count),
      totalSize: totalRaw,
      packedSize: totalPacked
    };
  }

  function dosDate(date, time) {
    if (!date) return null;
    var y = ((date >> 9) & 0x7f) + 1980, mo = ((date >> 5) & 0x0f) - 1, d = date & 0x1f;
    var h = (time >> 11) & 0x1f, mi = (time >> 5) & 0x3f, s = (time & 0x1f) * 2;
    var dt = new Date(y, mo, d, h, mi, s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  /* ==================================================================
     ISO 9660 — the primary volume descriptor lives at a fixed offset,
     one logical sector at 32768.
     ================================================================== */
  function iso(url) {
    return range(url, 32768, 32768 + 2047).then(function (buf) {
      var b = U8(buf), v = DV(buf);
      if (ascii(b, 1, 5) !== 'CD001') throw new Error('not iso9660');
      var blocks = v.getUint32(80, true);
      var blockSize = v.getUint16(128, true);
      return {
        kind: 'iso',
        system: ascii(b, 8, 32),
        label: ascii(b, 40, 32),
        publisher: ascii(b, 318, 128),
        preparer: ascii(b, 446, 128),
        application: ascii(b, 574, 128),
        blocks: blocks,
        blockSize: blockSize,
        volumeSize: blocks * blockSize,
        created: isoDate(b, 813),
        modified: isoDate(b, 830)
      };
    });
  }

  function isoDate(b, at) {
    var s = ascii(b, at, 16);
    if (!/^\d{14}/.test(s)) return null;
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
                              +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)));
    return isNaN(d.getTime()) || d.getUTCFullYear() < 1980 ? null : d;
  }

  /* ==================================================================
     Pictures — dimensions for every common format, plus EXIF for JPEG.
     ================================================================== */
  function picture(url, ext) {
    return range(url, 0, 262143).then(function (buf) {
      var b = U8(buf), v = DV(buf);
      var r = { kind: 'image' };

      if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
        r.format = 'PNG';
        r.width = v.getUint32(16); r.height = v.getUint32(20);
        r.depth = b[24];
        r.color = ['grayscale', null, 'RGB', 'indexed', 'grayscale+alpha', null, 'RGBA'][b[25]] || null;
      } else if (b[0] === 0xFF && b[1] === 0xD8) {
        r.format = 'JPEG';
        jpeg(b, v, r);
      } else if (ascii(b, 0, 3) === 'GIF') {
        r.format = 'GIF';
        r.width = v.getUint16(6, true); r.height = v.getUint16(8, true);
      } else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
        r.format = 'WebP';
        var c = ascii(b, 12, 4);
        if (c === 'VP8X') { r.width = 1 + (b[24] | b[25] << 8 | b[26] << 16);
                            r.height = 1 + (b[27] | b[28] << 8 | b[29] << 16); }
        else if (c === 'VP8 ') { r.width = v.getUint16(26, true) & 0x3fff;
                                 r.height = v.getUint16(28, true) & 0x3fff; }
        else if (c === 'VP8L') { var n = v.getUint32(21, true);
                                 r.width = (n & 0x3fff) + 1;
                                 r.height = ((n >> 14) & 0x3fff) + 1; }
      } else if (b[0] === 0x42 && b[1] === 0x4D) {
        r.format = 'BMP';
        r.width = v.getInt32(18, true); r.height = Math.abs(v.getInt32(22, true));
        r.depth = v.getUint16(28, true);
      } else if (ascii(b, 4, 8) === 'ftypavif' || ascii(b, 4, 8) === 'ftypavis') {
        r.format = 'AVIF';
        var ispe = find(b, [0x69, 0x73, 0x70, 0x65], 0, 4096);
        if (ispe > 0) { r.width = v.getUint32(ispe + 8); r.height = v.getUint32(ispe + 12); }
      } else if (ascii(b, 4, 4) === 'ftyp') {
        r.format = 'HEIF';
      } else {
        r.format = (ext || '').toUpperCase() || null;
      }
      return r;
    });
  }

  function jpeg(b, v, r) {
    var p = 2;
    while (p + 4 < b.length) {
      if (b[p] !== 0xFF) { p++; continue; }
      var m = b[p + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; }
      var len = (b[p + 2] << 8) | b[p + 3];
      if (len < 2) break;
      var isSOF = (m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC;
      if (isSOF) {
        r.height = (b[p + 5] << 8) | b[p + 6];
        r.width = (b[p + 7] << 8) | b[p + 8];
        r.depth = b[p + 4];
        r.components = b[p + 9];
        if (r.exif) break;
      } else if (m === 0xE1 && ascii(b, p + 4, 4) === 'Exif') {
        try { r.exif = exif(b, p + 10); } catch (e) {}
      } else if (m === 0xDA) break;
      p += 2 + len;
    }
  }

  var EXIF_TAGS = {
    0x010F: 'make', 0x0110: 'model', 0x0112: 'orientation',
    0x8769: '_exifIFD', 0x8825: '_gpsIFD', 0x0132: 'datetime',
    0x829A: 'exposure', 0x829D: 'fnumber', 0x8827: 'iso',
    0x920A: 'focal', 0x9003: 'taken', 0xA002: 'pxWidth', 0xA003: 'pxHeight',
    0x9209: 'flash', 0xA430: 'owner', 0xA434: 'lens'
  };

  function exif(b, tiff) {
    var le = ascii(b, tiff, 2) === 'II';
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    var g16 = function (o) { return v.getUint16(o, le); };
    var g32 = function (o) { return v.getUint32(o, le); };
    if (g16(tiff + 2) !== 42) return null;

    var out = {};
    var readIFD = function (at, depth) {
      if (at <= 0 || at + 2 > b.length || depth > 2) return;
      var n = g16(at);
      if (n > 200) return;
      for (var i = 0; i < n; i++) {
        var e = at + 2 + i * 12;
        if (e + 12 > b.length) return;
        var tag = g16(e), type = g16(e + 2), count = g32(e + 4);
        var name = EXIF_TAGS[tag];
        if (!name) continue;
        var sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
        var unit = sizes[type] || 1;
        var total = unit * count;
        var at2 = total <= 4 ? e + 8 : tiff + g32(e + 8);
        if (at2 < 0 || at2 + Math.min(total, 4) > b.length) continue;

        if (name.charAt(0) === '_') { readIFD(tiff + g32(e + 8), depth + 1); continue; }
        if (type === 2) out[name] = ascii(b, at2, count).replace(/\0+$/, '');
        else if (type === 3) out[name] = g16(at2);
        else if (type === 4) out[name] = g32(at2);
        else if (type === 5 || type === 10) {
          var num = g32(at2), den = g32(at2 + 4);
          out[name] = den ? num / den : null;
        }
      }
    };
    readIFD(tiff + g32(tiff + 4), 0);
    return Object.keys(out).length ? out : null;
  }

  /* ==================================================================
     MP4 / MOV — walk the box tree for mvhd, tkhd, hdlr and stsd.
     The moov atom is at the head in faststart files and at the tail
     otherwise, so both ends are tried.
     ================================================================== */
  function mp4(url, fileSize) {
    return range(url, 0, Math.min(fileSize, 1 << 20) - 1).then(function (buf) {
      var r = mp4Parse(U8(buf), 0);
      if (r && r.duration != null) return r;
      var tail = Math.min(fileSize, 4 << 20);
      return range(url, fileSize - tail, fileSize - 1).then(function (buf2) {
        var r2 = mp4Parse(U8(buf2), 0);
        if (!r2 || r2.duration == null) throw new Error('moov not found');
        return r2;
      });
    });
  }

  function mp4Parse(b) {
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    var res = { kind: 'video', container: 'MP4', tracks: [] };
    var found = false;

    function walk(start, end, depth) {
      var p = start;
      while (p + 8 <= end && depth < 8) {
        var size = v.getUint32(p);
        var type = ascii(b, p + 4, 4);
        var hdr = 8;
        if (size === 1) {
          if (p + 16 > end) return;
          size = v.getUint32(p + 8) * 4294967296 + v.getUint32(p + 12);
          hdr = 16;
        } else if (size === 0) size = end - p;
        if (size < hdr || p + size > end + 64) return;

        if (type === 'ftyp') res.brand = ascii(b, p + 8, 4);
        else if (type === 'mvhd') {
          var ver = b[p + hdr];
          var o = p + hdr + 4 + (ver === 1 ? 16 : 8);
          var scale = v.getUint32(o);
          var dur = ver === 1 ? v.getUint32(o + 4) * 4294967296 + v.getUint32(o + 8)
                              : v.getUint32(o + 4);
          if (scale) { res.duration = dur / scale; found = true; }
        } else if (type === 'tkhd') {
          var tv = b[p + hdr];
          var to = p + hdr + 4 + (tv === 1 ? 32 : 20) + 4 + 8 + 2 + 2 + 2 + 2 + 36;
          var w = v.getUint32(to) / 65536, h = v.getUint32(to + 4) / 65536;
          if (w > 0 && h > 0) { res.width = Math.round(w); res.height = Math.round(h); }
        } else if (type === 'hdlr') {
          var kind = ascii(b, p + hdr + 8, 4);
          if (kind === 'vide' || kind === 'soun' || kind === 'subt' || kind === 'text')
            res._pending = kind;
        } else if (type === 'stsd') {
          var fmt = ascii(b, p + hdr + 12, 4);
          if (fmt) {
            var t = { type: res._pending || 'data', codec: fmt };
            if (res._pending === 'soun') {
              t.channels = v.getUint16(p + hdr + 8 + 8 + 8 + 8, false);
              t.rate = v.getUint32(p + hdr + 8 + 8 + 8 + 16) / 65536;
            }
            res.tracks.push(t);
            res._pending = null;
          }
        }

        if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf' ||
            type === 'stbl' || type === 'udta' || type === 'edts') {
          walk(p + hdr, Math.min(p + size, end), depth + 1);
        }
        p += size;
      }
    }
    walk(0, b.length, 0);
    delete res._pending;
    return found || res.tracks.length ? res : null;
  }

  /* ==================================================================
     Matroska / WebM — EBML, reading Info and Tracks near the head.
     ================================================================== */
  function mkv(url, fileSize) {
    return range(url, 0, Math.min(fileSize, 1 << 20) - 1).then(function (buf) {
      var b = U8(buf);
      if (!(b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3))
        throw new Error('not matroska');
      var res = { kind: 'video', container: 'Matroska', tracks: [] };
      var scale = 1000000, dur = null;

      function vint(p, keepMarker) {
        var first = b[p];
        if (first === undefined || first === 0) return null;
        var len = 1, mask = 0x80;
        while (!(first & mask) && len < 8) { mask >>= 1; len++; }
        var val = keepMarker ? first : (first & (mask - 1));
        for (var i = 1; i < len; i++) val = val * 256 + b[p + i];
        return { value: val, len: len };
      }

      function uint(p, n) { var x = 0; for (var i = 0; i < n; i++) x = x * 256 + b[p + i]; return x; }
      function flt(p, n) {
        var v = new DataView(b.buffer, b.byteOffset, b.byteLength);
        return n === 4 ? v.getFloat32(p) : n === 8 ? v.getFloat64(p) : uint(p, n);
      }

      function walk(p, end, depth, track) {
        while (p < end && depth < 8) {
          var id = vint(p, true); if (!id) return;
          var sz = vint(p + id.len, false); if (!sz) return;
          var dataAt = p + id.len + sz.len;
          var dataEnd = Math.min(dataAt + sz.value, end);
          var i = id.value;

          if (i === 0x18538067) walk(dataAt, end, depth + 1, null);            /* Segment  */
          else if (i === 0x1549A966 || i === 0x1654AE6B) walk(dataAt, dataEnd, depth + 1, null);
          else if (i === 0xAE) { var t = {}; res.tracks.push(t); walk(dataAt, dataEnd, depth + 1, t); }
          else if (i === 0xE0 || i === 0xE1) walk(dataAt, dataEnd, depth + 1, track);
          else if (i === 0x2AD7B1) scale = uint(dataAt, sz.value);
          else if (i === 0x4489) dur = flt(dataAt, sz.value);
          else if (i === 0x7BA9) res.title = utf8(b, dataAt, sz.value);
          else if (i === 0x4D80) res.muxer = utf8(b, dataAt, sz.value);
          else if (track) {
            if (i === 0x83) track.type = ({ 1: 'vide', 2: 'soun', 17: 'subt' })[uint(dataAt, sz.value)] || 'data';
            else if (i === 0x86) track.codec = ascii(b, dataAt, sz.value);
            else if (i === 0xB0) track.width = uint(dataAt, sz.value);
            else if (i === 0xBA) track.height = uint(dataAt, sz.value);
            else if (i === 0xB5) track.rate = flt(dataAt, sz.value);
            else if (i === 0x9F) track.channels = uint(dataAt, sz.value);
            else if (i === 0x22B59C) track.lang = ascii(b, dataAt, sz.value);
            else if (i === 0x536E) track.name = utf8(b, dataAt, sz.value);
          }

          if (i === 0x1F43B675) return;    /* first Cluster — stop, we have all we need */
          p = dataEnd;
          if (sz.value === 0) return;
        }
      }
      walk(4 + (vint(4, false) ? vint(4, false).len : 0), b.length, 0, null);

      if (dur) res.duration = dur * scale / 1e9;
      res.tracks.forEach(function (t) {
        if (t.width && t.height) { res.width = res.width || t.width; res.height = res.height || t.height; }
      });
      return res;
    });
  }

  /* ==================================================================
     MP3 — ID3v2 at the head, ID3v1 at the tail, bitrate from the first
     frame header. Cover art comes back as a blob URL when present.
     ================================================================== */
  function mp3(url, fileSize) {
    return range(url, 0, Math.min(fileSize, 1 << 20) - 1).then(function (buf) {
      var b = U8(buf), r = { kind: 'audio', format: 'MP3', tags: {} };

      if (ascii(b, 0, 3) === 'ID3') {
        var ver = b[3];
        var size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
        id3v2(b, 10, Math.min(10 + size, b.length), ver, r);
        r.audioAt = 10 + size;
      }
      frameHeader(b, r.audioAt || 0, r);
      if (!r.tags.title && fileSize > 128) {
        return range(url, fileSize - 128, fileSize - 1).then(function (t) {
          var tb = U8(t);
          if (ascii(tb, 0, 3) === 'TAG') {
            r.tags.title = ascii(tb, 3, 30);
            r.tags.artist = ascii(tb, 33, 30);
            r.tags.album = ascii(tb, 63, 30);
            r.tags.year = ascii(tb, 93, 4);
          }
          return r;
        }, function () { return r; });
      }
      return r;
    });
  }

  var ID3_FRAMES = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TYER: 'year',
                     TDRC: 'year', TRCK: 'track', TCON: 'genre', TPE2: 'albumArtist',
                     TBPM: 'bpm', TPUB: 'publisher', COMM: 'comment' };

  function id3v2(b, p, end, ver, r) {
    var idLen = ver >= 3 ? 4 : 3, hdrLen = ver >= 3 ? 10 : 6;
    while (p + hdrLen <= end) {
      var id = ascii(b, p, idLen);
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      var size;
      if (ver >= 4) size = ((b[p + 4] & 0x7f) << 21) | ((b[p + 5] & 0x7f) << 14) |
                           ((b[p + 6] & 0x7f) << 7) | (b[p + 7] & 0x7f);
      else if (ver === 3) size = (b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7];
      else size = (b[p + 3] << 16) | (b[p + 4] << 8) | b[p + 5];
      if (size <= 0 || p + hdrLen + size > end) break;

      var at = p + hdrLen, name = ID3_FRAMES[id];
      if (name) r.tags[name] = decodeText(b, at, size);
      else if (id === 'APIC' || id === 'PIC') r.cover = apic(b, at, size, id === 'PIC');
      p += hdrLen + size;
    }
  }

  function decodeText(b, at, size) {
    var enc = b[at], body = at + 1, len = size - 1;
    try {
      if (enc === 1 || enc === 2) {
        return new TextDecoder(enc === 1 ? 'utf-16' : 'utf-16be')
          .decode(b.subarray(body, body + len)).replace(/\0+$/, '').trim();
      }
      if (enc === 3) return utf8(b, body, len).replace(/\0+$/, '').trim();
    } catch (e) {}
    return ascii(b, body, len);
  }

  function apic(b, at, size, short) {
    var p = at + 1;
    var mime;
    if (short) { mime = 'image/' + ascii(b, p, 3).toLowerCase(); p += 3; }
    else { var s = p; while (b[p] && p < at + size) p++; mime = ascii(b, s, p - s); p++; }
    p++;                                            /* picture type */
    while (b[p] && p < at + size) p++; p++;         /* description  */
    if (p >= at + size) return null;
    try {
      return URL.createObjectURL(new Blob([b.subarray(p, at + size)],
        { type: mime || 'image/jpeg' }));
    } catch (e) { return null; }
  }

  var BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  var RATES = [44100, 48000, 32000, 0];

  function frameHeader(b, from, r) {
    for (var p = from; p < Math.min(b.length - 4, from + 200000); p++) {
      if (b[p] !== 0xFF || (b[p + 1] & 0xE0) !== 0xE0) continue;
      var layer = (b[p + 1] >> 1) & 3;
      if (layer === 0) continue;
      var bIdx = (b[p + 2] >> 4) & 0xF, rIdx = (b[p + 2] >> 2) & 3;
      if (bIdx === 0 || bIdx === 15 || rIdx === 3) continue;
      r.bitrate = BITRATES[bIdx];
      r.rate = RATES[rIdx];
      r.channels = ((b[p + 3] >> 6) & 3) === 3 ? 1 : 2;
      var xing = find(b, [0x58, 0x69, 0x6e, 0x67], p, p + 200) >= 0 ||
                 find(b, [0x49, 0x6e, 0x66, 0x6f], p, p + 200) >= 0;
      r.vbr = xing;
      return;
    }
  }

  /* ==================================================================
     FLAC — STREAMINFO gives an exact duration, VORBIS_COMMENT the tags,
     PICTURE the cover.
     ================================================================== */
  function flac(url, fileSize) {
    return range(url, 0, Math.min(fileSize, 1 << 20) - 1).then(function (buf) {
      var b = U8(buf), v = DV(buf);
      if (ascii(b, 0, 4) !== 'fLaC') throw new Error('not flac');
      var r = { kind: 'audio', format: 'FLAC', tags: {} };
      var p = 4;
      while (p + 4 <= b.length) {
        var last = b[p] & 0x80, type = b[p] & 0x7f;
        var len = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
        var at = p + 4;
        if (at + len > b.length) break;

        if (type === 0) {
          r.rate = (b[at + 10] << 12) | (b[at + 11] << 4) | (b[at + 12] >> 4);
          r.channels = ((b[at + 12] >> 1) & 7) + 1;
          r.bits = (((b[at + 12] & 1) << 4) | (b[at + 13] >> 4)) + 1;
          var samples = ((b[at + 13] & 0x0f) * 4294967296) + v.getUint32(at + 14);
          if (r.rate) r.duration = samples / r.rate;
        } else if (type === 4) {
          var vp = at + 4 + v.getUint32(at, true);
          var n = v.getUint32(vp, true); vp += 4;
          for (var i = 0; i < n && vp + 4 <= at + len; i++) {
            var l = v.getUint32(vp, true); vp += 4;
            var s = utf8(b, vp, l); vp += l;
            var eq = s.indexOf('=');
            if (eq > 0) r.tags[s.slice(0, eq).toLowerCase()] = s.slice(eq + 1);
          }
        } else if (type === 6 && !r.cover) {
          var pp = at + 4;
          var mlen = v.getUint32(pp); pp += 4;
          var mime = ascii(b, pp, mlen); pp += mlen;
          var dlen = v.getUint32(pp); pp += 4 + dlen;
          pp += 16;                                  /* w, h, depth, colors */
          var plen = v.getUint32(pp); pp += 4;
          if (pp + plen <= b.length) {
            try { r.cover = URL.createObjectURL(new Blob([b.subarray(pp, pp + plen)],
              { type: mime || 'image/jpeg' })); } catch (e) {}
          }
        }
        p = at + len;
        if (last) break;
      }
      return r;
    });
  }

  /* ==================================================================
     Dispatcher
     ================================================================== */
  var ZIPS = 'zip apk aab jar docx xlsx pptx odt ods odp epub whl nupkg vsix xpi crx';
  var PICS = 'jpg jpeg jfif jpe png gif webp bmp avif heic heif';
  var MP4S = 'mp4 m4v mov m4a';
  var MKVS = 'mkv webm mka';

  function probe(url, ext, size) {
    ext = (ext || '').toLowerCase();
    if (ZIPS.indexOf(ext) >= 0 && size) return zip(url, size);
    if (ext === 'iso') return iso(url);
    if (PICS.indexOf(ext) >= 0) return picture(url, ext);
    if (MP4S.indexOf(ext) >= 0 && size) return mp4(url, size);
    if (MKVS.indexOf(ext) >= 0 && size) return mkv(url, size);
    if (ext === 'mp3' && size) return mp3(url, size);
    if (ext === 'flac' && size) return flac(url, size);
    return Promise.reject(new Error('unsupported'));
  }

  function supports(ext) {
    ext = (ext || '').toLowerCase();
    return ZIPS.indexOf(ext) >= 0 || PICS.indexOf(ext) >= 0 || MP4S.indexOf(ext) >= 0 ||
           MKVS.indexOf(ext) >= 0 || ext === 'iso' || ext === 'mp3' || ext === 'flac';
  }

  window.M3LProbe = {
    probe: probe,
    supports: supports,
    head: head,
    range: range,
    fmtDuration: fmtDuration,
    setConcurrency: function (n) { LIMIT = Math.max(1, n | 0); }
  };
})();
