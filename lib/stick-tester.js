/* ============================================================================
   STICK-TESTER.js — a comprehensive, reusable arcade-stick test panel for the
   Castle Killscreen games. Built on lib/stick.js (the unified driver) — drop in:

     <script src="lib/stick.js"></script>
     <script src="lib/stick-tester.js"></script>
     <div id="t"></div>
     <script>StickTester.mount(document.getElementById('t'), {
        title:'THE HIGH TABLE', actions:[ {label:'TRAP', on:S=>S.held('a')}, ... ] });
     </script>

   Shows, live: the detected DEVICE (brand/mode/lever/counts), the KILLBOX PAIRING
   (ckPads P1/P2 + which slot this stick is), the unified 8-WAY lever (folding
   analog + D-pad + hat + right-stick) with the analog dot + the direction source,
   every BUTTON (index + lit), every AXIS (bar), and the GAME ACTION chips that
   light when their control fires. Self-contained CSS. Never throws.
   ============================================================================ */
(function (root) {
  'use strict';
  if (!root.Stick) { console.warn('[stick-tester] needs lib/stick.js loaded first'); }

  var CSS = ''
    + '.skt{font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#cfe6ff}'
    + '.skt .skt-dev{font-weight:800;color:#fff;font-size:14px}'
    + '.skt .skt-dev.off{color:#ff6a7d}'
    + '.skt .skt-dev small{display:block;color:#9ab;font-weight:400;font-size:11px;margin-top:3px}'
    + '.skt .skt-pair{margin:6px 0 10px;color:#9ab;font-size:11.5px}'
    + '.skt .skt-pair b{color:#ffe23a} .skt .skt-pair .me{color:#39ff14}'
    + '.skt .skt-h{font:800 10px/1 system-ui;letter-spacing:.18em;color:#27f6ff;text-transform:uppercase;margin:12px 0 7px}'
    + '.skt .skt-top{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}'
    + '.skt .skt-box{position:relative;width:128px;height:128px;flex:none;background:#0b0620;border:1px solid #2a1850;border-radius:12px;overflow:hidden}'
    + '.skt .skt-box .cx{position:absolute;inset:0;background:linear-gradient(#2a185055,#2a185055) center/1px 100% no-repeat,linear-gradient(#2a185055,#2a185055) center/100% 1px no-repeat}'
    + '.skt .skt-dot{position:absolute;width:22px;height:22px;border-radius:50%;background:#39ff14;box-shadow:0 0 16px #39ff14;transform:translate(-50%,-50%);left:50%;top:50%;transition:left .04s,top .04s}'
    + '.skt .skt-dig{position:absolute;width:12px;height:12px;border-radius:50%;background:#ffe23a;box-shadow:0 0 12px #ffe23a;transform:translate(-50%,-50%);opacity:.25}'
    + '.skt .skt-src{font-size:10.5px;color:#9ab;margin-top:5px;text-align:center;width:128px}'
    + '.skt .skt-acts{display:flex;flex-wrap:wrap;gap:7px;flex:1;min-width:160px;align-content:flex-start}'
    + '.skt .skt-act{padding:8px 11px;border-radius:9px;border:1px solid #2a3550;background:#10081f;color:#8aa;font:800 12px system-ui;letter-spacing:.04em;min-width:64px;text-align:center}'
    + '.skt .skt-act.on{background:#39ff14;color:#04210a;border-color:#39ff14;box-shadow:0 0 14px #39ff14}'
    + '.skt .skt-act small{display:block;font:600 9px ui-monospace;opacity:.7;margin-top:2px;letter-spacing:0}'
    + '.skt .skt-btns{display:flex;flex-wrap:wrap;gap:5px}'
    + '.skt .skt-b{min-width:30px;height:28px;padding:0 6px;display:flex;align-items:center;justify-content:center;border:1px solid #36205e;border-radius:7px;background:#10081f;color:#7c6aa0;font-size:11px;flex-direction:column;line-height:1}'
    + '.skt .skt-b.on{background:#ffe23a;color:#1a1200;border-color:#fff7d6;box-shadow:0 0 12px #ffe23a;font-weight:800}'
    + '.skt .skt-b em{font-style:normal;font-size:8px;opacity:.7}'
    + '.skt .skt-ax{display:grid;grid-template-columns:60px 1fr 50px;gap:5px 9px;align-items:center;font-size:11px;margin:3px 0}'
    + '.skt .skt-bar{height:10px;border-radius:5px;background:#0c0720;border:1px solid #2a1850;position:relative;overflow:hidden}'
    + '.skt .skt-fill{position:absolute;top:0;bottom:0;left:50%;width:1px;background:#b14cff;box-shadow:0 0 8px #b14cff}'
    + '.skt .skt-ax .v{text-align:right;color:#cdb6ff}'
    + '.skt .skt-trouble{margin-top:10px;color:#9ab;font-size:11px;line-height:1.5;border:1px solid #2a1850;border-radius:8px;padding:8px 10px;background:#190a2c}';

  var BTNNAMES = {0:'A',1:'B',2:'X',3:'Y',4:'L1',5:'R1',6:'L2',7:'RT',8:'SEL',9:'ST',10:'L3',11:'R3',12:'▲',13:'▼',14:'◄',15:'►',16:'⌂'};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function pairing() { try { var p = JSON.parse(localStorage.getItem('ckPads') || 'null'); return (p && p.v) ? p : null; } catch (e) { return null; } }
  function brand(p) { try { return root.Stick.identify(p).brand; } catch (e) { return 'pad'; } }

  function mount(host, opts) {
    opts = opts || {}; var actions = opts.actions || [];
    if (!document.getElementById('skt-css')) { var s = el('style'); s.id = 'skt-css'; s.textContent = CSS; document.head.appendChild(s); }
    host.classList.add('skt');
    host.innerHTML = ''
      + '<div class="skt-dev off" id="skt-dev">No pad — click this page, then press a button on the stick…</div>'
      + '<div class="skt-pair" id="skt-pair"></div>'
      + '<div class="skt-h">8-way lever &amp; actions</div>'
      + '<div class="skt-top">'
      + '  <div><div class="skt-box"><div class="cx"></div><div class="skt-dot" id="skt-dot"></div><div class="skt-dig" id="skt-dig"></div></div><div class="skt-src" id="skt-src">source: —</div></div>'
      + '  <div class="skt-acts" id="skt-acts"></div>'
      + '</div>'
      + '<div class="skt-h">buttons</div><div class="skt-btns" id="skt-btns"></div>'
      + '<div class="skt-h">axes</div><div id="skt-axes"></div>'
      + '<div class="skt-trouble" id="skt-trouble" style="display:none"><b>Stick not showing?</b> Click this page first (browsers reveal a pad only after a focused button press). Use Chrome. Put the F300 on an X-input/PC mode (8BitDo: hold START+X). The lever works on the left stick, the d-pad, the hat, OR the right stick — all folded here.</div>';

    var dev = host.querySelector('#skt-dev'), pairEl = host.querySelector('#skt-pair'),
        dot = host.querySelector('#skt-dot'), dig = host.querySelector('#skt-dig'), src = host.querySelector('#skt-src'),
        actsEl = host.querySelector('#skt-acts'), btnsEl = host.querySelector('#skt-btns'),
        axesEl = host.querySelector('#skt-axes'), trouble = host.querySelector('#skt-trouble');

    actions.forEach(function (a, i) { var c = el('div', 'skt-act'); c.id = 'skt-act' + i; c.innerHTML = a.label + (a.hint ? ('<small>' + a.hint + '</small>') : ''); actsEl.appendChild(c); });

    try { window.focus(); } catch (e) {}
    document.body.addEventListener('pointerdown', function () { try { window.focus(); } catch (e) {} }, { passive: true });

    var ticks = 0;
    function loop() {
      ticks++;
      try { root.Stick.update(); } catch (e) {}
      var S = root.Stick, snap = S.snapshot();

      if (snap.connected) {
        var info = snap.id_info;
        dev.className = 'skt-dev';
        dev.innerHTML = '● ' + (info.brand || 'pad') + (info.model ? (' ' + info.model) : '')
          + ' <small>' + snap.mapping + ' · ' + snap.buttonCount + 'btn / ' + snap.axisCount + 'ax'
          + (snap.hatAxis != null ? (' · hat=axis' + snap.hatAxis) : '') + ' · lever: ' + info.lever + '</small>';
        trouble.style.display = 'none';
      } else {
        dev.className = 'skt-dev off';
        dev.textContent = 'No pad — click this page, then press a button on the stick…';
        trouble.style.display = ticks > 200 ? 'block' : 'none';
      }

      // pairing line
      var P = pairing(), live = (function () { try { return S.list(); } catch (e) { return []; } })();
      var meIdx = snap.connected ? snap.index : null, txt = '';
      if (P) {
        var p1 = P.p1 ? brand(P.p1) + ' #' + P.p1.index : '—', p2 = P.p2 ? brand(P.p2) + ' #' + P.p2.index : '—';
        function isMe(a) { return a && meIdx != null && a.index === meIdx; }
        txt = 'KILLBOX pairing — P1: <b>' + (isMe(P.p1) ? '<span class="me">' + p1 + ' (this)</span>' : p1) + '</b> · P2: <b>' + (isMe(P.p2) ? '<span class="me">' + p2 + ' (this)</span>' : p2) + '</b>';
      } else {
        txt = 'No KILLBOX pairing saved — assign P1/P2 in KILLBOX › CONTROLLERS. (' + live.length + ' stick' + (live.length === 1 ? '' : 's') + ' live)';
      }
      pairEl.innerHTML = txt;

      // 8-way + analog dot + source
      var d = snap.dir, a = snap.analog;
      dot.style.left = (50 + a.x * 42) + '%'; dot.style.top = (50 + a.y * 42) + '%';
      dig.style.left = (50 + d.x * 36) + '%'; dig.style.top = (50 + d.y * 36) + '%'; dig.style.opacity = (d.x || d.y) ? '1' : '.25';
      if (snap.connected) {
        var usingAnalog = Math.abs(a.x) > 0 || Math.abs(a.y) > 0;
        var usingRS = (snap.axes.length > 3 && (Math.abs(snap.axes[2]) > 0.5 || Math.abs(snap.axes[3]) > 0.5));
        var usingDpad = snap.buttons.slice(12, 16).some(function (b) { return b.down; });
        var usingHat = (snap.hatAxis != null && snap.axes[snap.hatAxis] >= -1.1 && snap.axes[snap.hatAxis] <= 1.1 && (d.x || d.y));
        src.textContent = 'source: ' + ([usingAnalog && 'left stick', usingRS && 'right stick', usingDpad && 'D-pad', usingHat && 'hat'].filter(Boolean).join(' + ') || 'centered');
      } else { src.textContent = 'source: —'; }

      // actions
      actions.forEach(function (act, i) { var on = false; try { on = !!act.on(S); } catch (e) {} host.querySelector('#skt-act' + i).classList.toggle('on', on); });

      // buttons
      if (snap.connected) {
        if (btnsEl.children.length !== snap.buttons.length) { btnsEl.innerHTML = ''; snap.buttons.forEach(function (b) { var x = el('div', 'skt-b'); x.id = 'skt-b' + b.i; btnsEl.appendChild(x); }); }
        snap.buttons.forEach(function (b) { var x = host.querySelector('#skt-b' + b.i); if (x) { x.innerHTML = b.i + (BTNNAMES[b.i] ? '<em>' + BTNNAMES[b.i] + '</em>' : ''); x.classList.toggle('on', b.down); } });
        if (axesEl.children.length !== snap.axes.length) { axesEl.innerHTML = ''; snap.axes.forEach(function (v, i) { var w = el('div', 'skt-ax'); w.innerHTML = '<span>axis ' + i + '</span><div class="skt-bar"><div class="skt-fill" id="skt-af' + i + '"></div></div><span class="v" id="skt-av' + i + '"></span>'; axesEl.appendChild(w); }); }
        snap.axes.forEach(function (v, i) { var f = host.querySelector('#skt-af' + i), wd = Math.abs(v) * 50; if (f) { f.style.width = Math.max(1, wd) + '%'; f.style.left = (v < 0 ? 50 - wd : 50) + '%'; } var av = host.querySelector('#skt-av' + i); if (av) av.textContent = (+v).toFixed(2); });
      } else { btnsEl.innerHTML = ''; axesEl.innerHTML = ''; }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  root.StickTester = { mount: mount, BTNNAMES: BTNNAMES };
})(typeof window !== 'undefined' ? window : this);
