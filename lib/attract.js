/* lib/attract.js — window.HTAttract: THE TOP-DOWN ATTRACT (Joe 2026-11-17).
 *
 * "please be consistent in all game modes with the attract ... make a similar but new one with all new game demo action
 *  in top down on all tables with various pucks knockers and game mode explanations."
 *
 * One full-screen overlay any HIGH TABLE page can mount (TO-GO 1P/2P/iPhone, 2-UP, the ★ HOME console). It plays:
 *   1. BOOT (opts.boot): ANDERS & PARTNERS PRESENTS -> the CASTLE KILLSCREEN ident -> the HIGH TABLE title plate.
 *      The two logo cards can't be pressed through (CK BOOT STANDARD, BOOT-STANDARD.md).
 *   2. THE LOOP: real TOP-DOWN demo matches (CPU vs CPU in the actual engine: topdown-3d.html?demo&mute&attract with a
 *      fixed seed per segment) on EVERY table, each with its own knocker pair + puck, and a MODE CARD that says in one
 *      line what CLASSIC / RAISE IT! / CAMPAIGN / CASTLE RULES / 2-UP VS / TO-GO / 2 PLAYER / HYSCORE are, over a
 *      controls strip that matches the input you're holding (keys+mouse / pad / touch). The A&P PRESENTS beat and the
 *      title plate come round once per loop.
 *   Music: its OWN one-bed Mus (two+ looping voices crossfaded 1.2 s; a segment on the same bed keeps it playing, never a
 *   restart from 0) + one cue voice (the CK ident sting) that ducks the bed. stop() fades everything out in 0.6 s, so the
 *   host's bed crossfades in under it. The host must keep ITS bed down while the attract runs (opts.onEnter).
 *   Input: the first press on a page whose audio is still locked only turns the sound on; after that ANY key / click / tap /
 *   pad button (outside the logo cards) calls opts.onExit() — the host shows its TITLE. The attract NEVER starts a match.
 *
 *   HTAttract.mount({ boot:true, onExit:fn, onEnter:fn, first:'togo', engine:'topdown-3d.html', idle:45, isIdle:fn })
 *   HTAttract.start([withBoot]) · HTAttract.stop() · HTAttract.active · HTAttract.peek()   (?qa: window.__htAttract)
 * Render / flow / audio only: the demo engine's physics + CPU are untouched (it just gets ?seed, ?k1/?k2, ?puck).
 */
(function (G) {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MUTE = Q.has('mute');

  /* ---- THE SEGMENTS: every top-down table, a different knocker pair + puck each, one mode explained per segment ---- */
  var SEGS = [
    { tbl: 'rivalry',    k1: 'bees',   k2: 'queens', puck: 'lit',       mode: 'CLASSIC',            tag: 'EXHIBITION',   col: '#ffd23f', ctl: 'side1',
      line: 'ONE GAME, FIRST TO 7 · ANY TABLE, ANY KNOCKER, ANY PUCK' },
    { tbl: 'nachos',     k1: 'house',  k2: 'turf',   puck: 'energy',    mode: 'RAISE IT!',          tag: '1 PLAYER · BEST OF 7', col: '#ff7a1a', ctl: 'side1',
      line: 'A BEST OF 7 VS A CPU THAT PLAYS HARDER EVERY GAME · WIN IT, LIFT THE CUP' },
    { tbl: 'bees',       k1: 'bees',   k2: 'ice',    puck: 'bees',      mode: 'OLD-TYME CAMPAIGN',  tag: '1 PLAYER LADDER', col: '#ffe23a', ctl: 'side1',
      line: 'CLIMB AS THE BEES · RIVALRY, THRONE ROOM, HONEY HOLE, THEN THE HIGH TABLE' },
    { tbl: 'throne',     k1: 'queens', k2: 'red',    puck: 'queens',    mode: 'CASTLE RULES',       tag: 'TIMED',        col: '#39ff14', ctl: 'side1',
      line: 'THREE PERIODS ON THE CLOCK · MOST GOALS WINS · TIED? NEXT GOAL TAKES IT' },
    { tbl: 'killscreen', k1: 'red',    k2: 'ice',    puck: 'zebra',     mode: 'HYSCORE ARCADE',     tag: 'THE QUARTER-EATER', col: '#ff37c7', ctl: 'side1',
      line: 'ONE COIN, ONE GAME · BEAT THE HIGH TABLE TO OPEN CASTLE KILLSCREEN' },
    { tbl: 'rivalry',    k1: 'turf',   k2: 'queens', puck: 'contested', mode: '2-UP · VS SERIES',   tag: '2 PLAYERS · 2 ENDS', col: '#27f6ff', ctl: 'side2',
      line: 'TWO PLAYERS, EACH ON THEIR OWN END · BEST OF 7 FOR THE CUP' },
    { tbl: 'nachos',     k1: 'ice',    k2: 'house',  puck: 'neutral',   mode: 'HIGH-TABLE TO-GO!',  tag: 'TOP-DOWN · 1 PLAYER', col: '#27f6ff', ctl: 'td1',
      line: 'THE TABLE FROM ABOVE · STEER WITH A MOUSE, A FINGER OR A STICK' },
    { tbl: 'throne',     k1: 'bees',   k2: 'queens', puck: 'energy',    mode: 'TOP-DOWN · 2 PLAYER', tag: 'ONE TABLE',   col: '#c79bff', ctl: 'td2',
      line: 'TWO PLAYERS ON ONE TABLE · A FINGER EACH, OR KEYS AND A PAD' },
    { tbl: 'bees',       k1: 'house',  k2: 'bees',   puck: 'lit',       mode: 'JAILBREAK',          tag: 'EVERYTHING UNLOCKED', col: '#ff5ae1', ctl: 'side1',
      line: 'EVERY TABLE, PUCK AND KNOCKER OPEN · BUILD YOUR OWN MATCH' }
  ];
  var TNAME = { rivalry: 'THE RIVALRY', nachos: 'THE HIGH TABLE', bees: 'THE HONEY HOLE', throne: 'THE THRONE ROOM', killscreen: 'CASTLE KILLSCREEN' };
  var PNAME = { lit: 'CLASSIC PUCK', neutral: 'NEON PUCK', zebra: 'ZEBRA PUCK', energy: 'ENERGY PUCK', bees: 'HIVE PUCK', queens: 'ROYAL PUCK', contested: 'CONTESTED PUCK' };
  var BEDFOR = { bees: 'bees_breakaway', throne: 'queens_breakaway', rivalry: 'mode_select', nachos: 'mode_select', killscreen: 'mode_select' };
  var SEG_DUR = 10.5, PRESENTS_DUR = 3.2, IDENT_DUR = 2.8, TITLE_DUR = 5.5;

  /* ---- controls strips, per input (consistent with side.html's #hint and the top-down hint) ---- */
  var STRIP = {
    side1: { keys: 'P1 MOUSE OR WASD · Z TRAP · X GET BIG · C BLAST · P / ESC PAUSE',
             pad:  'STICK STEERS · A TRAP · B GET BIG · RT BLAST · START PAUSE',
             touch:'DRAG TO STEER · TRAP · GET BIG · BLAST ON THE OTHER THUMB' },
    side2: { keys: 'P1 WASD · Z X C   ·   P2 O K L ; · , GET BIG · . BLAST',
             pad:  'A PAD EACH · A TRAP · B GET BIG · RT BLAST',
             touch:'TWO PLAYERS: TWO SCREENS OR TWO PADS' },
    td1:   { keys: 'MOUSE STEERS · SPACE STARTS · SCORE IN THE FAR GOAL',
             pad:  'STICK STEERS · ANY BUTTON STARTS · SCORE IN THE FAR GOAL',
             touch:'DRAG A FINGER TO STEER · SCORE IN THE FAR GOAL' },
    td2:   { keys: 'P1 MOUSE / WASD · P2 ARROWS',
             pad:  'A PAD EACH · STICKS STEER',
             touch:'A FINGER EACH, ON YOUR OWN HALF' }
  };
  function inputKind() {
    try { var ps = navigator.getGamepads ? navigator.getGamepads() : []; for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) return 'pad'; } catch (e) {}
    try { if (G.matchMedia && G.matchMedia('(pointer:coarse)').matches) return 'touch'; } catch (e) {}
    return 'keys';
  }

  /* ---- MUS: one bed at a time (crossfaded), one cue voice that ducks it. Wall-clock fades. ---- */
  var Mus = (function () {
    var voices = {}, cur = null, cue = null, cueFade = [], MV = 0.42, XF = 1.2, last = 0, alive = false;
    function v(name) { var o = voices[name]; if (!o) { var e = new Audio('audio/' + name + '.mp3'); e.loop = true; e.preload = 'auto'; e.volume = 0; o = voices[name] = { el: e, lvl: 0, tgt: 0, on: false }; } return o; }
    function bed(name, lvl) { if (MUTE) return; alive = true;
      for (var k in voices) voices[k].tgt = 0;
      var o = v(name); o.tgt = (lvl == null ? MV : lvl); cur = name;
      if (!o.on || o.el.paused) { o.on = true; try { var p = o.el.play(); if (p && p.catch) p.catch(function () { o.on = false; }); } catch (e) { o.on = false; } } }
    function sting(name, vol) { if (MUTE) return; alive = true; if (cue) cueFade.push({ el: cue, g: cue.volume });
      try { var e = new Audio('audio/' + name + '.mp3'); e.volume = Math.min(1, vol || 0.5); cue = e; var p = e.play(); if (p && p.catch) p.catch(function () {}); } catch (e2) { cue = null; } }
    function stopCue() { if (cue) { cueFade.push({ el: cue, g: cue.volume }); cue = null; } }
    function stop() { for (var k in voices) voices[k].tgt = 0; cur = null; stopCue(); }
    function tick() { var now = performance.now(), dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016; last = now; if (!alive) return;
      if (cue && (cue.ended || (cue.duration && isFinite(cue.duration) && cue.currentTime >= cue.duration - 0.02))) cue = null;
      for (var i = cueFade.length - 1; i >= 0; i--) { var f = cueFade[i]; f.g -= dt / 0.3 * 0.6; if (f.g <= 0) { try { f.el.pause(); } catch (e) {} cueFade.splice(i, 1); } else { try { f.el.volume = f.g; } catch (e) {} } }
      var any = false;
      for (var k in voices) { var o = voices[k], tg = cue ? 0 : o.tgt, step = dt / XF * MV;
        o.lvl = tg > o.lvl ? Math.min(tg, o.lvl + step) : Math.max(tg, o.lvl - step * (cue ? 3 : 1));
        try { o.el.volume = Math.max(0, Math.min(1, o.lvl)); } catch (e) {}
        if (o.lvl <= 0 && o.tgt <= 0 && o.on) { o.on = false; try { o.el.pause(); o.el.currentTime = 0; } catch (e) {} }
        if (o.on) any = true; }
      if (!any && !cue && !cueFade.length) alive = false; }
    function unlock() { for (var k in voices) { var o = voices[k]; if (o.tgt > 0 && o.el.paused) { o.on = true; try { o.el.play(); } catch (e) {} } } }
    return { bed: bed, sting: sting, stopCue: stopCue, stop: stop, tick: tick, unlock: unlock, peek: function () { return { bed: cur, cue: !!cue }; } };
  })();

  /* ---- art ---- */
  var IMG = {};
  function img(k, src) { var im = new Image(); im.onload = function () { IMG[k] = im; }; im.src = src; }
  img('ck', 'sprites/brand/ck_logo.png'); img('title', 'sprites/title_high_table.png');
  img('cb', 'sprites/brand/crest_bees.png'); img('cq', 'sprites/brand/crest_queens.png');
  img('seam', 'sprites/fx/clash_seam.png');

  /* ---- state ---- */
  var O = { mounted: false, active: false, opts: {}, root: null, cv: null, ctx: null, fr: [null, null], frOn: 0,
            phase: 'off', t: 0, segIdx: 0, segN: 0, order: [], loaded: -1, gate: false, unlockedPress: false,
            idleT: 0, lastIn: 0, padPrev: false, raf: 0, last: 0, beatQueue: [] };
  function audioLocked() { try { var C = G.AudioContext || G.webkitAudioContext, c = new C(), s = c.state; c.close(); return s !== 'running'; } catch (e) { return false; } }
  function seed(i) { return 1117 + i * 31; }
  function segURL(S, i) {
    var eng = O.opts.engine || 'topdown-3d.html';
    return eng + '?demo=1&mute=1&attract=1&noboot&table=' + S.tbl + '&k1=' + S.k1 + '&k2=' + S.k2 + '&puck=' + S.puck + '&seed=' + seed(i);
  }
  function build() {
    if (O.root) return;
    var r = document.createElement('div'); r.id = 'htattract';
    r.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#05030c;display:none;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none';
    for (var i = 0; i < 2; i++) { var f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.setAttribute('allow', 'autoplay');
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;opacity:0;background:#05030c';
      r.appendChild(f); O.fr[i] = f; }
    var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    r.appendChild(cv); O.cv = cv; O.ctx = cv.getContext && cv.getContext('2d');
    document.body.appendChild(r); O.root = r;
  }
  function size() { if (!O.cv) return; var d = Math.min(2, G.devicePixelRatio || 1); O.cv.width = Math.round(innerWidth * d); O.cv.height = Math.round(innerHeight * d); }

  /* ---- the beat director ---- */
  function queueLoop(withBoot) {
    var q = [];
    if (withBoot) { q.push({ k: 'presents', dur: PRESENTS_DUR, hold: true }); q.push({ k: 'ident', dur: IDENT_DUR, hold: true }); q.push({ k: 'title', dur: TITLE_DUR }); }
    for (var i = 0; i < SEGS.length; i++) { var j = O.order[(O.segN + i) % O.order.length]; q.push({ k: 'seg', seg: j, dur: SEG_DUR }); }
    q.push({ k: 'presents', dur: PRESENTS_DUR - 0.6, hold: true }); q.push({ k: 'title', dur: TITLE_DUR - 1 });
    O.segN += SEGS.length; return q;
  }
  function nextBeat() {
    if (!O.beatQueue.length) O.beatQueue = queueLoop(false);
    var b = O.beatQueue.shift(); O.beat = b; O.t = 0; O.phase = b.k; O.wipeIn = O.hadBeat; O.hadBeat = true;
    if (b.k === 'seg') {
      var S = SEGS[b.seg], i = b.seg;
      if (O.loaded !== i) loadSeg(i);                        // not preloaded (first segment): load now, the wipe covers it
      O.frOn = O.loadedFr; showFrame(O.frOn);
      Mus.bed(BEDFOR[S.tbl] || 'title');
    } else {
      O.frOn = -1; showFrame(-1);
      if (b.k === 'presents' || b.k === 'title') Mus.bed('title');
      if (b.k === 'ident') Mus.sting('killscreen', 0.5);
    }
    // preload the NEXT segment into the spare frame while this beat runs
    var nb = O.beatQueue[0]; if (!nb) { O.beatQueue = queueLoop(false); nb = O.beatQueue[0]; }
    if (nb && nb.k === 'seg') O.preloadAt = Math.max(0, b.dur - 3.2), O.preloadSeg = nb.seg; else O.preloadAt = -1;
  }
  function loadSeg(i) { var spare = (O.frOn === 0 ? 1 : 0);
    var f = O.fr[spare]; if (!f) return; f.src = segURL(SEGS[i], i); O.loaded = i; O.loadedFr = spare; }
  function showFrame(n) { for (var i = 0; i < 2; i++) { var f = O.fr[i]; if (!f) continue;
      if (i === n) { f.style.transition = 'opacity .35s'; f.style.opacity = '1'; }
      else { f.style.transition = 'opacity .35s'; f.style.opacity = '0'; (function (ff, idx) { setTimeout(function () { if (O.frOn !== idx && O.loadedFr !== idx) { try { ff.src = 'about:blank'; } catch (e) {} } }, 600); })(f, i); } } }

  /* ---- drawing ---- */
  function fit(c, txt, weight, px, maxW, fam) { px = Math.round(px); c.font = weight + ' ' + px + 'px ' + (fam || '"Helvetica Neue",Arial'); while (px > 10 && c.measureText(txt).width > maxW) { px -= 2; c.font = weight + ' ' + px + 'px ' + (fam || '"Helvetica Neue",Arial'); } return px; }
  function bolts(c, cx, cy, W, H, t, a) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var b = 0; b < 7; b++) { var sd = b * 2.3, sx = cx + Math.sin(sd * 1.7 + t * 0.6) * W * 0.22, sy = cy + Math.cos(sd + t) * H * 0.05, ang = Math.sin(sd) * 1.4;
      c.globalAlpha = a * (0.25 + 0.5 * Math.abs(Math.sin(t * 23 + sd))); c.strokeStyle = b % 2 ? '#c79bff' : '#ffd86a'; c.shadowColor = c.strokeStyle; c.shadowBlur = 12; c.lineWidth = Math.max(1, H * 0.003);
      var px = sx, py = sy; c.beginPath(); c.moveTo(px, py);
      for (var k = 1; k <= 6; k++) { px += Math.cos(ang) * H * 0.03 + Math.sin(t * 31 + k * 2 + b) * H * 0.016; py += Math.sin(ang) * H * 0.02 + Math.cos(t * 27 + k + b) * H * 0.013; c.lineTo(px, py); }
      c.stroke(); }
    c.restore(); }
  function goldPurple(c, W, H, a) { var g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,210,63,' + 0.16 * a + ')'); g.addColorStop(0.5, 'rgba(5,3,12,0)'); g.addColorStop(1, 'rgba(177,76,255,' + 0.18 * a + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function drawPresents(c, W, H, t, T) {
    var fin = Math.min(1, t / 0.5), fout = Math.max(0, 1 - (T - t) / 0.45), a = fin * (1 - fout);
    c.fillStyle = '#05030c'; c.fillRect(0, 0, W, H); goldPurple(c, W, H, a);
    var cb = IMG.cb, cq = IMG.cq, u = Math.min(W, H);   // the two crests as ghosted gold / purple silhouettes either side
    [[cb, -1, '#ffd23f'], [cq, 1, '#b14cff']].forEach(function (z) { var im = z[0]; if (!im) return; var h = u * 0.5, w = h * im.naturalWidth / im.naturalHeight, dr = z[1];
      c.save(); c.globalAlpha = 0.16 * a; c.shadowColor = z[2]; c.shadowBlur = 30; c.drawImage(im, W / 2 + dr * W * 0.3 - w / 2 + dr * t * W * 0.01, H * 0.52 - h / 2, w, h); c.restore(); });
    bolts(c, W / 2, H * 0.44, W, H, t, a * Math.min(1, t / 0.9));
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = a;
    fit(c, 'ANDERS & PARTNERS', '900', H * 0.075, W * 0.86); c.fillStyle = '#eaf6ff'; c.shadowColor = '#27f6ff'; c.shadowBlur = 18 + 10 * Math.abs(Math.sin(t * 7)); c.fillText('ANDERS & PARTNERS', W / 2, H * 0.44);
    c.shadowBlur = 0; fit(c, 'PRESENTS', '700', H * 0.032, W * 0.6); c.fillStyle = '#ffd23f'; c.fillText('P R E S E N T S', W / 2, H * 0.53);
    c.restore(); }
  function drawIdent(c, W, H, t, T) {
    c.fillStyle = '#04040a'; c.fillRect(0, 0, W, H); var u = Math.min(W, H), FLY = 0.5;
    if (t < FLY) { var e = 1 - Math.pow(1 - t / FLY, 3), px = (-0.12 + e * 0.62) * W, R = u * 0.05;
      for (var i = 7; i >= 1; i--) { c.globalAlpha = 0.05 * i; c.fillStyle = '#bfffff'; c.beginPath(); c.arc(px - i * R * 0.85, H / 2, R * (1 - i * 0.05), 0, 6.28); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = '#0a0a12'; c.strokeStyle = '#dff6ff'; c.lineWidth = R * 0.14; c.beginPath(); c.arc(px, H / 2, R, 0, 6.28); c.fill(); c.stroke(); return; }
    var it = t - FLY, fout = Math.max(0, 1 - (T - t) / 0.4);
    if (it < 0.22) { c.globalAlpha = 1 - it / 0.22; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (it < 0.6) { c.save(); c.globalAlpha = 1 - it / 0.6; c.strokeStyle = '#7fe9ff'; c.shadowColor = '#27f6ff'; c.shadowBlur = 24; c.lineWidth = u * 0.005;
      for (var a = 0; a < 9; a++) { var an = a / 9 * 6.283 + 0.3, rr = u * 0.05 + it * W; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(an) * rr, H / 2 + Math.sin(an) * rr); c.stroke(); } c.restore(); }
    var lt = Math.min(1, it / 0.4), sc = 0.7 + 0.3 * (1 - Math.pow(1 - lt, 3)); c.save(); c.globalAlpha = Math.min(1, it / 0.2) * (1 - fout);
    if (IMG.ck) { var w = Math.min(W * 0.62, u * 1.0) * sc, h = w * IMG.ck.naturalHeight / IMG.ck.naturalWidth; c.drawImage(IMG.ck, W / 2 - w / 2, H / 2 - h / 2, w, h); }
    else { c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, 'CASTLE KILLSCREEN', 'italic 900', H * 0.09 * sc, W * 0.9); c.fillStyle = '#ff37c7'; c.shadowColor = '#ff37c7'; c.shadowBlur = 24; c.fillText('CASTLE KILLSCREEN', W / 2, H / 2); }
    c.restore(); }
  function pressLine(c, W, H, y) { if (Math.floor(performance.now() / 560) % 2) return; c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    var k = inputKind(), s = k === 'touch' ? '▸ TAP TO PLAY ◂' : (k === 'pad' ? '▸ PRESS ANY BUTTON ◂' : '▸ PRESS ANY KEY · OR CLICK ◂');
    fit(c, s, '800', H * 0.034, W * 0.9); c.fillStyle = '#fff'; c.shadowColor = '#ff37c7'; c.shadowBlur = 16; c.fillText(s, W / 2, y); c.restore(); }
  function drawTitle(c, W, H, t, T) {
    var fin = Math.min(1, t / 0.45), fout = Math.max(0, 1 - (T - t) / 0.45), a = fin * (1 - fout);
    c.fillStyle = '#05030c'; c.fillRect(0, 0, W, H); goldPurple(c, W, H, a); bolts(c, W / 2, H * 0.40, W, H, t, a * 0.55);
    if (IMG.title) { var u = Math.min(W * 0.66, H * 1.0), w = u * (1 + 0.02 * Math.sin(t * 1.3)), h = w * IMG.title.naturalHeight / IMG.title.naturalWidth;
      c.save(); c.globalAlpha = a; c.drawImage(IMG.title, W / 2 - w / 2, H * 0.40 - h / 2, w, h); c.restore(); }
    else { c.save(); c.globalAlpha = a; c.textAlign = 'center'; fit(c, 'ONE-TIMER: THE HIGH TABLE', 'italic 900', H * 0.09, W * 0.9); c.fillStyle = '#ffd23f'; c.fillText('ONE-TIMER: THE HIGH TABLE', W / 2, H * 0.42); c.restore(); }
    c.save(); c.globalAlpha = a; pressLine(c, W, H, H * 0.84); c.restore(); }
  function drawSeg(c, W, H, t, T, S) {
    c.clearRect(0, 0, W, H);
    // top: the table + the two knockers + the puck (what you're watching)
    var top = TNAME[S.tbl] + '   ·   ' + (S.k1 + ' vs ' + S.k2).toUpperCase() + '   ·   ' + (PNAME[S.puck] || '');
    c.save(); c.globalAlpha = Math.min(1, t / 0.5) * Math.min(1, (T - t) / 0.4);
    var bh = H * 0.07; var g = c.createLinearGradient(0, 0, 0, bh * 1.6); g.addColorStop(0, 'rgba(5,3,12,.82)'); g.addColorStop(1, 'rgba(5,3,12,0)'); c.fillStyle = g; c.fillRect(0, 0, W, bh * 1.6);
    c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, top, '800', H * 0.026, W * 0.92); c.fillStyle = '#eaf6ff'; c.shadowColor = '#000'; c.shadowBlur = 8; c.fillText(top, W / 2, bh * 0.55);
    c.font = '700 ' + Math.round(H * 0.017) + 'px "Helvetica Neue",Arial'; c.fillStyle = '#ffd23f'; c.fillText('ATTRACT · CPU vs CPU · TOP-DOWN', W / 2, bh * 1.05);
    c.restore();
    // lower third: the MODE CARD (slides in, holds, slides out)
    var ain = Math.min(1, Math.max(0, (t - 0.7) / 0.45)), aout = Math.min(1, Math.max(0, (T - 0.6 - t) / 0.45)), k = Math.min(ain, aout);
    var ease = 1 - Math.pow(1 - k, 3), cw = Math.min(W * 0.9, H * 1.7), cx = W / 2 - cw / 2 - (1 - ease) * W * 0.6, cy = H * 0.69, ch = H * 0.165;
    if (k > 0) { c.save(); c.globalAlpha = k;
      c.fillStyle = 'rgba(5,3,12,.84)'; c.beginPath(); c.moveTo(cx + ch * 0.25, cy); c.lineTo(cx + cw, cy); c.lineTo(cx + cw - ch * 0.25, cy + ch); c.lineTo(cx, cy + ch); c.closePath(); c.fill();
      c.fillStyle = S.col; c.fillRect(cx + ch * 0.25, cy, cw - ch * 0.25, Math.max(2, H * 0.005));
      c.textBaseline = 'middle'; c.textAlign = 'left'; var lx = cx + ch * 0.42;
      c.font = '800 ' + Math.round(H * 0.019) + 'px "Helvetica Neue",Arial'; c.fillStyle = S.col; c.fillText('▸ ' + S.tag, lx, cy + ch * 0.2);
      fit(c, S.mode, 'italic 900', H * 0.062, cw * 0.8); c.fillStyle = '#fff'; c.shadowColor = S.col; c.shadowBlur = 20; c.fillText(S.mode, lx, cy + ch * 0.5); c.shadowBlur = 0;
      fit(c, S.line, '700', H * 0.022, cw * 0.86); c.fillStyle = '#d9e4f2'; c.fillText(S.line, lx, cy + ch * 0.81);
      c.restore(); }
    // the controls strip (per input) + the press line
    var strip = (STRIP[S.ctl] || STRIP.side1)[inputKind()];
    c.save(); c.globalAlpha = Math.min(1, t / 0.5) * Math.min(1, (T - t) / 0.4);
    var sy = H * 0.905, sh = H * 0.05; c.fillStyle = 'rgba(5,3,12,.72)'; c.fillRect(0, sy - sh / 2, W, sh);
    c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, strip, '700', H * 0.022, W * 0.94); c.fillStyle = '#cfe6ff'; c.fillText(strip, W / 2, sy); c.restore();
    pressLine(c, W, H, H * 0.965);
  }
  function drawWipe(c, W, H, p) {   // a skewed gold -> ink -> purple carpet wipe over the beat change (state swaps at peak cover)
    if (p <= 0 || p >= 1) return; var x = (p * 2.4 - 0.7) * W, sk = H * 0.35;
    c.save(); var g = c.createLinearGradient(x - W * 0.5, 0, x + W * 0.5, 0); g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(0.25, '#ffd23f'); g.addColorStop(0.5, '#05030c'); g.addColorStop(0.75, '#b14cff'); g.addColorStop(1, 'rgba(177,76,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - W * 0.5 + sk, 0); c.lineTo(x + W * 0.5 + sk, 0); c.lineTo(x + W * 0.5 - sk, H); c.lineTo(x - W * 0.5 - sk, H); c.closePath(); c.fill(); c.restore(); }

  /* ---- the frame loop (only while active) ---- */
  function loop(now) {
    if (!O.active) { O.raf = 0; return; }
    O.raf = requestAnimationFrame(loop);
    var dt = O.last ? Math.min(0.1, (now - O.last) / 1000) : 0.016; O.last = now; O.t += dt;
    var b = O.beat; if (!b) { nextBeat(); b = O.beat; }
    if (O.preloadAt >= 0 && O.t >= O.preloadAt) { O.preloadAt = -1; loadSeg(O.preloadSeg); }
    if (O.t >= b.dur) { nextBeat(); b = O.beat; }
    pollPad();
    var c = O.ctx; if (!c) return; var W = O.cv.width, H = O.cv.height; if (W !== Math.round(innerWidth * Math.min(2, G.devicePixelRatio || 1))) size();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (b.k === 'presents') drawPresents(c, W, H, O.t, b.dur);
    else if (b.k === 'ident') drawIdent(c, W, H, O.t, b.dur);
    else if (b.k === 'title') drawTitle(c, W, H, O.t, b.dur);
    else if (b.k === 'seg') drawSeg(c, W, H, O.t, b.dur, SEGS[b.seg]);
    var nb = O.beatQueue[0];   // the wipe straddles the cut: last 0.35 s of this beat + first 0.35 s of the next
    if (nb && b.dur - O.t < 0.35) drawWipe(c, W, H, (0.35 - (b.dur - O.t)) / 0.7);
    else if (O.t < 0.35 && O.wipeIn) drawWipe(c, W, H, 0.5 + O.t / 0.7);
  }

  /* ---- input: first press may only unlock audio; logo cards hold; anything else exits to the host's title ---- */
  function press(e) {
    if (!O.active) return;
    if (e && e.cancelable) { try { e.preventDefault(); } catch (_) {} }
    if (e) { try { e.stopImmediatePropagation(); } catch (_) {} }
    O.lastIn = performance.now();
    if (O.gate) { O.gate = false; Mus.unlock(); if (O.beat && O.beat.k !== 'seg') Mus.bed(O.beat.k === 'ident' ? 'title' : (Mus.peek().bed || 'title')); return; }   // the FIRST press only turns the sound on
    if (O.beat && O.beat.hold) return;   // A&P PRESENTS + the CK ident can't be pressed through
    exit();
  }
  function pollPad() { var any = false; try { var ps = navigator.getGamepads ? navigator.getGamepads() : []; for (var i = 0; i < ps.length; i++) { var p = ps[i]; if (!p || !p.connected) continue; for (var j = 0; j < p.buttons.length; j++) if (p.buttons[j] && p.buttons[j].pressed) { any = true; break; } } } catch (e) {}
    if (any && !O.padPrev) press(null); O.padPrev = any; }
  function exit() { if (!O.active) return; O.exitAt = performance.now(); stop(); try { O.opts.onExit && O.opts.onExit(); } catch (e) {} }
  ['keydown', 'pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) {
    G.addEventListener(ev, function (e) { if (!O.active) { O.lastIn = performance.now(); return; } if (ev === 'mousedown' || (ev === 'touchstart' && 'PointerEvent' in G)) { e.stopImmediatePropagation(); return; } press(e); }, { capture: true, passive: false }); });
  G.addEventListener('keyup', function (e) { if (O.active) e.stopImmediatePropagation(); }, { capture: true });
  G.addEventListener('mousemove', function () { if (!O.active) O.lastIn = performance.now(); }, { capture: true, passive: true });

  function start(withBoot) {
    if (!O.mounted) return;
    build(); size(); O.root.style.display = 'block';
    O.active = true; O.order = O.order.length ? O.order : SEGS.map(function (_, i) { return i; });
    O.beatQueue = queueLoop(withBoot == null ? !!O.opts.boot : withBoot); O.beat = null; O.loaded = -1; O.frOn = -1; O.hadBeat = false;
    O.gate = !MUTE && audioLocked();
    try { O.opts.onEnter && O.opts.onEnter(); } catch (e) {}
    O.last = 0; if (!O.raf) O.raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!O.active) return; O.active = false; Mus.stop();
    var r = O.root; if (r) { r.style.transition = 'opacity .35s'; r.style.opacity = '0'; setTimeout(function () { if (!O.active) { r.style.display = 'none'; r.style.opacity = '1'; r.style.transition = ''; O.fr.forEach(function (f) { try { f.src = 'about:blank'; f.style.opacity = '0'; } catch (e) {} }); } }, 380); }
    O.lastIn = performance.now();
  }
  setInterval(function () { Mus.tick(); }, 40);   // the mixer runs on its own wall clock (fades finish after stop(), and in a hidden tab)
  // idle -> the attract again (only while the host says it's sitting on a title / menu)
  setInterval(function () { if (!O.mounted || O.active || !O.opts.idle) return; var ok = true; try { ok = O.opts.isIdle ? !!O.opts.isIdle() : true; } catch (e) { ok = false; }
    if (!ok) { O.lastIn = performance.now(); return; } if (performance.now() - O.lastIn > O.opts.idle * 1000) start(false); }, 500);

  function mount(opts) {
    if (G.__HT_NO_ATTRACT === true && !Q.has('attract')) return api;   // QA harnesses (tools/_qa/cdp.mjs) drive the menus directly
    O.opts = opts || {}; O.mounted = true; O.lastIn = performance.now();
    if (O.opts.first) { var f = -1; for (var i = 0; i < SEGS.length; i++) if (SEGS[i].ctl === O.opts.first || SEGS[i].mode === O.opts.first) { f = i; break; }
      O.order = SEGS.map(function (_, i) { return i; }); if (f > 0) O.order = O.order.slice(f).concat(O.order.slice(0, f)); }
    addEventListener('resize', size);
    if (O.opts.autostart !== false) start(!!O.opts.boot);
    return api;
  }
  var api = { mount: mount, start: start, stop: stop, SEGS: SEGS,
    get active() { return O.active; },
    busy: function () { return O.active || (performance.now() - (O.exitAt || -1e9) < 500); },   // hosts' pad polls: the press that exited the attract must not ALSO act on the title/menu
    peek: function () { return { active: O.active, beat: O.beat ? O.beat.k : null, seg: O.beat && O.beat.k === 'seg' ? O.beat.seg : null, t: O.t, gate: O.gate, mus: Mus.peek(), src: O.frOn >= 0 && O.fr[O.frOn] ? O.fr[O.frOn].getAttribute('src') : null }; },
    jump: function (k) { if (!O.active) return; O.beatQueue = queueLoop(false); while (O.beatQueue.length && !(O.beatQueue[0].k === 'seg' && O.beatQueue[0].seg === k)) O.beatQueue.shift(); O.t = 1e9; } };
  G.HTAttract = api; if (Q.has('qa')) G.__htAttract = api;
})(window);
