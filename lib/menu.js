/* ============================================================================
   menu.js — shared front-end TOOLKIT for ONE-TIMER: THE HIGH TABLE.
   window.HTMenu. Not a framework that owns the page — a set of helpers both
   engines call so the SIDE and TOP-DOWN menus stay "close on all versions":
     blacklight()         board treatment (inky B&W, team hue kept)
     makeLoader()         the carpet-wipe loader (goLoad)
     buildKnockers/Rinks/Pucks()   grids from HTCatalog data
     nav()                keyboard + stick selection bridge (window.__htNav)
     controlToggles()     live mouse/keyboard/stick switches (self-styling)
     controllerStatus()   detected F300 / 8BitDo P1/P2 strip (self-styling)
   Each engine keeps its own DOM + onPick/launch wiring. catalog.js optional
   (guarded) so the headless harness never throws if a lib didn't load.
   ============================================================================ */
(function (global) {
  'use strict';
  var C = global.HTCatalog;   // may be undefined under the harness — guard all use

  /* board treatment: inky B&W + bees-gold / queens-purple kept, darkened hard. */
  function blacklight(img) {
    var w = img.naturalWidth, h = img.naturalHeight, oc = document.createElement('canvas');
    oc.width = w; oc.height = h; var x = oc.getContext('2d'); x.drawImage(img, 0, 0);
    try {
      var im = x.getImageData(0, 0, w, h), d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn, sv = mx === 0 ? 0 : dl / mx, keep = false;
        if (dl > 0) { var hh; if (mx === r) hh = ((g - b) / dl) % 6; else if (mx === g) hh = (b - r) / dl + 2; else hh = (r - g) / dl + 4; hh *= 60; if (hh < 0) hh += 360;
          if (hh >= 34 && hh <= 68 && sv > 0.28) keep = true; else if (hh >= 250 && hh <= 306 && sv > 0.15) keep = true; }
        if (keep) { d[i] = Math.min(255, r * 1.16); d[i + 1] = Math.min(255, g * 1.16); d[i + 2] = Math.min(255, b * 1.16); }
        else { var L = (0.299 * r + 0.587 * g + 0.114 * b); L = L * 0.46; L = (L - 46) * 1.25 + 46; d[i] = d[i + 1] = d[i + 2] = L < 0 ? 0 : L > 255 ? 255 : L; }
      }
      x.putImageData(im, 0, 0);
    } catch (e) { /* tainted (file://): leave original art */ }
    return oc;
  }

  /* carpet diagonal-wipe loader carrying a jumbotron beat (crest + chant), then swaps. */
  function makeLoader(loadEl, sfx) {
    var crestEl = loadEl.querySelector('#m-loadcrest') || loadEl.querySelector('.m-loadcrest');
    var txtEl = loadEl.querySelector('.m-loadtxt'), subEl = loadEl.querySelector('.m-loadsub');
    return function goLoad(then, content) {
      content = content || {};
      if (crestEl) { if (content.crest) { crestEl.src = content.crest; crestEl.style.display = 'block'; } else crestEl.style.display = 'none'; }
      if (txtEl) txtEl.textContent = content.title || 'DROPPING THE PUCK…';
      if (subEl) subEl.textContent = content.sub || '';
      loadEl.classList.remove('out'); loadEl.classList.add('in');
      if (content.sting) { try { content.sting(); } catch (e) {} } else if (sfx && sfx.drop) sfx.drop();
      setTimeout(function () {
        then(); loadEl.classList.remove('in'); loadEl.classList.add('out');
        setTimeout(function () { loadEl.classList.remove('out'); }, 440);
      }, 460);
    };
  }

  /* knocker grid — engine resolves the sprite (side adds _34, top-down flat). */
  function buildKnockers(grid, knockers, opts) {
    opts = opts || {}; var engine = opts.engine || 'side'; grid.innerHTML = '';
    knockers.forEach(function (K) {
      if (engine !== 'side' && K.sideOnly) return;   // top-down only carries the 5 base knockers
      var img = C ? C.knockerSprite(K, engine) : (K.img || ('sprites/' + K.base + '.png'));
      var card = document.createElement('div'); card.className = 'card kcard'; card.dataset.team = K.team;
      card.innerHTML = '<img src="' + img + '" alt="' + K.name + '"><div class="cap" style="color:' + K.col + '">' + K.name + '</div>';
      card.onclick = function () { if (opts.onPick) opts.onPick(K, card); };
      grid.appendChild(card);
    });
  }

  /* rink/venue grid — engine picks side vs top art; High Table gets the hot border. */
  function buildRinks(grid, rinks, opts) {
    opts = opts || {}; var engine = opts.engine || 'side'; grid.innerHTML = '';
    rinks.forEach(function (R) {
      if (opts.filter && !opts.filter(R)) return;
      var card = document.createElement('div'); card.className = 'card rcard'; card.dataset.team = R.team;
      if (R.high) card.classList.add('high');
      var cap = document.createElement('div'); cap.className = 'cap'; cap.textContent = R.name;
      cap.style.color = R.team === 'bees' ? '#ffcf2a' : R.team === 'queens' ? '#b14cff' : R.high ? '#ff7a1a' : '#dfefff';
      var src = engine === 'side' ? R.side : R.top;
      if (src) { var im = new Image(); im.onload = function () { card.insertBefore(blacklight(im), card.firstChild); }; im.onerror = function () {}; im.src = src; }
      card.appendChild(cap);
      if (R.tag) { var t = document.createElement('div'); t.className = 'tag'; t.textContent = R.tag; card.appendChild(t); }
      card.onclick = function () { if (opts.onPick) opts.onPick(R, card); };
      grid.appendChild(card);
    });
  }

  /* puck grid — procedural thumbnail via PuckArt (matches the in-game puck). */
  function buildPucks(grid, pucks, opts) {
    opts = opts || {}; grid.innerHTML = '';
    pucks.forEach(function (P) {
      var card = document.createElement('div'); card.className = 'card pcard';
      var cv = document.createElement('canvas'); cv.width = cv.height = 128; var x = cv.getContext('2d');
      if (global.PuckArt) global.PuckArt.draw(x, 64, 70, 36, { style: P.style || 'classic', t: 0, spin: 8, blk: true });
      else if (P.img) { var im = new Image(); im.onload = function () { try { x.drawImage(im, 14, 14, 100, 100); } catch (e) {} }; im.src = P.img; }
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', '<div class="cap" style="color:' + P.col + '">' + P.name + '</div>');
      card.onclick = function () { if (opts.onPick) opts.onPick(P, card); };
      grid.appendChild(card);
    });
  }

  /* keyboard + stick selection over a list of {el, go}; exposes window.__htNav
     so an engine's gamepad poll can drive the same selection (left stick/d-pad + A). */
  function nav(opts) {
    opts = opts || {}; var items = opts.items || [], sel = 0;
    var isOpen = opts.isOpen || function () { return true; };
    function set(i) { if (!items.length) return; sel = (i + items.length) % items.length;
      items.forEach(function (it, n) { it.el.classList.toggle('sel', n === sel); });
      try { items[sel].el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
    function move(d) { set(sel + d); }
    function go() { var it = items[sel]; if (it && it.go) it.go(); }
    global.__htNav = { open: isOpen, move: move, go: go };
    window.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    if (items.length) set(0);
    return { set: set, move: move, go: go, items: items };
  }

  /* ---- self-styling widgets (inject CSS once) ---- */
  var _css = false;
  function injectCSS() {
    if (_css) return; _css = true;
    var s = document.createElement('style'); s.textContent =
      '.ht-ctrls{display:flex;flex-direction:column;gap:8px;max-width:430px;margin:0 auto}' +
      '.ht-ctog{display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid #1c2740;border-radius:10px;background:rgba(8,10,20,.55);cursor:pointer;transition:border-color .12s,background .12s;text-align:left}' +
      '.ht-ctog:hover{border-color:#3a4a6e}' +
      '.ht-ctog .box{width:38px;height:21px;flex:none;border-radius:11px;background:#26324c;position:relative;transition:.15s}' +
      '.ht-ctog .box i{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#7f97a8;transition:.15s}' +
      '.ht-ctog.on .box{background:#ffe23a}.ht-ctog.on .box i{left:19px;background:#06070d}' +
      '.ht-ctog .nm{font:800 13px/1.2 "Helvetica Neue",Arial;letter-spacing:.08em;color:#fff}' +
      '.ht-ctog .hk{color:#7f97a8;font-size:10.5px;letter-spacing:.04em;margin-top:3px}' +
      '.ht-ctog .txt{flex:1}' +
      '.ht-cstatus{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;font:800 11px/1 "Helvetica Neue",Arial;letter-spacing:.1em}' +
      '.ht-pad{display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid #1c2740;border-radius:20px;background:rgba(8,10,20,.55);color:#7f97a8}' +
      '.ht-pad .dot{width:9px;height:9px;border-radius:50%;background:#3a4a6e}' +
      '.ht-pad.live{color:#cfe6ff;border-color:#2a6e4a}.ht-pad.live .dot{background:#27f6a0;box-shadow:0 0 8px #27f6a0}' +
      '.ht-pad b{color:#fff}';
    (document.head || document.documentElement).appendChild(s);
  }

  var CTRL_META = [
    { key: 'mouse',    nm: 'MOUSE',                hk: 'move cursor to steer · click TRAP' },
    { key: 'keyboard', nm: 'KEYBOARD',             hk: 'WASD / arrows · C TRAP · V BLAST · SPACE GET BIG' },
    { key: 'stick',    nm: 'STICK (F300 / 8BitDo)', hk: 'left stick / d-pad · A TRAP · B BLAST · RT GET BIG' }
  ];
  /* live control switches bound to a CTRL object; save() persists. */
  function controlToggles(container, CTRL, save, opts) {
    injectCSS(); opts = opts || {}; container.classList.add('ht-ctrls'); container.innerHTML = '';
    CTRL_META.forEach(function (m) {
      if (opts.only && opts.only.indexOf(m.key) < 0) return;
      var row = document.createElement('div'); row.className = 'ht-ctog' + (CTRL[m.key] ? ' on' : '');
      row.innerHTML = '<div class="box"><i></i></div><div class="txt"><div class="nm">' + m.nm + '</div><div class="hk">' + m.hk + '</div></div>';
      row.onclick = function (e) { e.stopPropagation(); CTRL[m.key] = !CTRL[m.key]; row.classList.toggle('on', CTRL[m.key]); if (save) save(); };
      container.appendChild(row);
    });
    return container;
  }

  /* live "what's plugged in" strip: F300 / 8BitDo P1+P2 via ckPads pairing.
     opts.minimal = single "CONTROLLER" pill (top-down). Returns { stop() }. */
  function controllerStatus(container, opts) {
    injectCSS(); opts = opts || {}; container.classList.add('ht-cstatus');
    var brand = (C && C.brand) || function () { return 'PAD'; };
    function paired() { try { var p = JSON.parse(localStorage.getItem('ckPads') || 'null'); if (p && p.v) return p; } catch (e) {} return { v: 1, p1: null, p2: null }; }
    function gpFor(a, gp) { if (!a) return null; for (var i = 0; i < gp.length; i++) if (gp[i] && (gp[i].id === a.id || gp[i].index === a.index)) return gp[i]; return null; }
    var stopped = false;
    function pill(label, txt, live) { var el = document.createElement('div'); el.className = 'ht-pad' + (live ? ' live' : ''); el.innerHTML = '<span class="dot"></span><span>' + label + '</span> <b>' + txt + '</b>'; container.appendChild(el); }
    function render() {
      if (stopped) return; container.innerHTML = '';
      var gp = navigator.getGamepads ? navigator.getGamepads() : [], live = [];
      for (var i = 0; i < gp.length; i++) if (gp[i] && gp[i].connected) live.push(gp[i]);
      if (opts.minimal) { pill('CONTROLLER', live.length ? brand(live[0].id) : 'none', live.length); return; }
      var P = paired();
      if (!P.p1 && !P.p2) {                       // unpaired: show what's plugged in + hint
        if (live.length) { live.slice(0, 2).forEach(function (g, i) { pill('P' + (i + 1), brand(g.id), true); }); pill('', 'pair in KILLBOX', false); }
        else pill('CONTROLLERS', 'none — plug in / pair in KILLBOX', false);
        return;
      }
      var g1 = gpFor(P.p1, gp), g2 = gpFor(P.p2, gp);
      pill('P1', P.p1 ? (g1 ? brand(g1.id) : brand(P.p1.id) + ' (off)') : '—', !!g1);
      pill('P2', P.p2 ? (g2 ? brand(g2.id) : brand(P.p2.id) + ' (off)') : '—', !!g2);
    }
    render(); var iv = setInterval(render, opts.interval || 600);
    return { stop: function () { stopped = true; clearInterval(iv); }, refresh: render };
  }

  global.HTMenu = {
    blacklight: blacklight, makeLoader: makeLoader,
    buildKnockers: buildKnockers, buildRinks: buildRinks, buildPucks: buildPucks,
    nav: nav, controlToggles: controlToggles, controllerStatus: controllerStatus
  };
})(typeof window !== 'undefined' ? window : this);
