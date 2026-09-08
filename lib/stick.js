/* ============================================================================
   STICK.js — native arcade-stick driver for the Castle Killscreen games.
   Zero dependencies. Drop in with:  <script src="lib/stick.js"></script>

   WHY THIS EXISTS
   ---------------
   The same physical stick reports its lever THREE different ways depending on
   which mode it's switched into:

     • analog stick  -> gp.axes[0] (X), gp.axes[1] (Y)        [XInput / analog]
     • D-pad buttons -> gp.buttons[12..15]                    [XInput "standard"]
     • hat switch    -> one high axis, ~ -1..+1 in 8 steps    [DInput / Switch]

   An arcade lever like the Mayflash F300 is ALWAYS digital, so on the F300 the
   lever is the D-pad/hat — never a true analog axis. This driver folds all
   three sources into one clean 8-way direction so a game never has to care what
   mode the stick is in. That is the whole point: talk to the stick once, here.

   API (poll style — call Stick.update() once per animation frame)
   ---------------------------------------------------------------
     Stick.update()            // advance edge-detection; call first each frame
     Stick.connected()         // bool — is a pad live right now
     Stick.dir()               // {x,y} each in {-1,0,1} — unified 8-way lever
     Stick.axis()              // {x,y} raw analog, deadzoned (-1..1 floats)
     Stick.held(name)          // bool — button held this frame  (e.g. 'a')
     Stick.pressed(name)       // bool — button went down THIS frame (edge)
     Stick.released(name)      // bool — button went up THIS frame (edge)
     Stick.anyPressed()        // bool — any button edge this frame (menus)
     Stick.snapshot()          // full debug object (used by STICK TEST.html)
     Stick.identify(gp)        // {brand, mode, note} best-guess from the id
     Stick.config({deadzone, hatAxis, buttons})  // override defaults

   Button NAMES (standard layout; remap per game via Stick.config({buttons}))
     a=0 b=1 x=2 y=3  l1=4 r1=5 l2=6 r2=7  select=8 start=9  l3=10 r3=11
     up=12 down=13 left=14 right=15  home=16
   ============================================================================ */
(function (root) {
  'use strict';

  // --- tunables ---------------------------------------------------------------
  var CFG = {
    deadzone: 0.30,      // analog magnitude below this reads as 0 for dir()
    hatAxis: null,       // null = auto-detect the hat axis; set a number to pin it
    buttons: {           // semantic name -> standard button index
      a: 0, b: 1, x: 2, y: 3,
      l1: 4, r1: 5, l2: 6, r2: 7,
      select: 8, start: 9, l3: 10, r3: 11,
      up: 12, down: 13, left: 14, right: 15, home: 16
    }
  };

  // hat-switch decode table: 8 compass steps -> (x,y). Index = round((h+1)/0.2857)&7
  var HX = [0, 1, 1, 1, 0, -1, -1, -1];
  var HY = [-1, -1, 0, 1, 1, 1, 0, -1];

  var prevBtn = {};   // index -> bool, last frame (for edges)
  var curBtn = {};    // index -> bool, this frame
  var everSeen = false;
  var detectedHat = null;
  var pinnedIndex = null;  // gamepad.index to lock onto, or null = "first live pad"

  // --- raw pad access ---------------------------------------------------------
  function pads() {
    return navigator.getGamepads ? Array.prototype.slice.call(navigator.getGamepads()) : [];
  }
  function livePads() {
    // accept a pad even if `connected` is undefined; reject only explicit false
    return pads().filter(function (p) { return p && p.connected !== false; });
  }
  // The pad the rest of the API talks to. Honors a pinned slot if the user picked
  // one (multi-stick rigs); otherwise the first live pad — same as the games.
  function active() {
    var ps = livePads();
    if (pinnedIndex != null) {
      for (var i = 0; i < ps.length; i++) if (ps[i].index === pinnedIndex) return ps[i];
    }
    return ps.length ? ps[0] : null;
  }
  // Pin/unpin which physical stick is "active" (pass a gamepad.index, or null).
  function setActive(index) { pinnedIndex = (index == null ? null : index | 0); return pinnedIndex; }
  function activeIndex() { var a = active(); return a ? a.index : null; }
  // Every live pad, each with its full identification — for the device finder.
  function list() {
    return livePads().map(function (gp) {
      return {
        index: gp.index, id: gp.id, mapping: gp.mapping || '(non-standard)',
        buttonCount: gp.buttons.length, axisCount: gp.axes.length,
        active: (active() === gp), info: identify(gp)
      };
    });
  }

  // --- hat detection ----------------------------------------------------------
  // A hat axis quantizes to 8 compass steps in [-1, 1]; its idle/rest value sits
  // OUTSIDE that (>1.1, or NaN). The Mayflash F300 / 8BitDo / most DInput pads
  // put the hat on axis 9 — the same slot the proven High Table engines read
  // (breakaway.html uses gp.axes[9]). So we DON'T blindly scan every axis (an
  // analog stick or a trigger resting at 0.0 would false-trigger "south", since
  // south sits at ~0.14): we read axis 9 by convention, or a caller-pinned axis.
  function readHat(gp) {
    if (CFG.hatAxis != null) { detectedHat = CFG.hatAxis; return decodeHat(gp.axes[CFG.hatAxis]); }
    if (gp.axes.length > 9) {                       // standard hat slot
      var d = decodeHat(gp.axes[9]);
      if (d.x || d.y) detectedHat = 9;
      return d;
    }
    return { x: 0, y: 0 };
  }
  // Center deadzone (|h|<=0.10) so a flat/resting axis at 0.0 reads as centered,
  // not as the nearest compass step.
  function decodeHat(h) {
    if (h == null || h !== h || h < -1.1 || h > 1.1 || Math.abs(h) <= 0.10) return { x: 0, y: 0 };
    var k = Math.round((h + 1) / 0.2857) & 7;
    return { x: HX[k], y: HY[k] };
  }

  function btnDown(gp, i) {
    var b = gp.buttons[i];
    return !!(b && (b.pressed || b.value > 0.5));
  }

  // --- public: per-frame update (drives edge detection) -----------------------
  function update() {
    var gp = active();
    prevBtn = curBtn; curBtn = {};
    if (!gp) return;
    everSeen = true;
    for (var i = 0; i < gp.buttons.length; i++) curBtn[i] = btnDown(gp, i);
  }

  // --- public: direction (unified lever) --------------------------------------
  function dir() {
    var gp = active();
    if (!gp) return { x: 0, y: 0 };
    var x = 0, y = 0;
    // 1) analog stick
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) >= CFG.deadzone) x = ax < 0 ? -1 : 1;
    if (Math.abs(ay) >= CFG.deadzone) y = ay < 0 ? -1 : 1;
    // 2) D-pad buttons (XInput standard) override/augment
    if (btnDown(gp, CFG.buttons.left)) x = -1; else if (btnDown(gp, CFG.buttons.right)) x = 1;
    if (btnDown(gp, CFG.buttons.up)) y = -1; else if (btnDown(gp, CFG.buttons.down)) y = 1;
    // 3) hat switch (DInput / Switch) fills whatever is still centered
    if (!x || !y) { var h = readHat(gp); if (!x) x = h.x; if (!y) y = h.y; }
    return { x: x, y: y };
  }

  function axis() {
    var gp = active();
    if (!gp) return { x: 0, y: 0 };
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    return {
      x: Math.abs(ax) >= CFG.deadzone ? ax : 0,
      y: Math.abs(ay) >= CFG.deadzone ? ay : 0
    };
  }

  // --- public: buttons by name -----------------------------------------------
  function idxOf(name) {
    if (typeof name === 'number') return name;
    return CFG.buttons[name];
  }
  function held(name) { var i = idxOf(name); return i == null ? false : !!curBtn[i]; }
  function pressed(name) { var i = idxOf(name); return i == null ? false : (!!curBtn[i] && !prevBtn[i]); }
  function released(name) { var i = idxOf(name); return i == null ? false : (!curBtn[i] && !!prevBtn[i]); }
  function anyPressed() {
    for (var k in curBtn) if (curBtn[k] && !prevBtn[k]) return true;
    return false;
  }

  // --- public: identify the stick from its id string --------------------------
  // Pull the USB vendor:product out of the id string. Chrome  -> "(Vendor: 2dc8
  // Product: 6101)"; Firefox/Safari -> "2dc8-6101-Name". Returns lower-case hex
  // or '' when the browser hides it (older Safari sometimes does).
  function parseVidPid(id) {
    var s = id || '';
    var m = s.match(/vendor:?\s*([0-9a-f]{4}).*?product:?\s*([0-9a-f]{4})/i);
    if (m) return { vid: m[1].toLowerCase(), pid: m[2].toLowerCase() };
    m = s.match(/\b([0-9a-f]{4})-([0-9a-f]{4})\b/i);
    if (m) return { vid: m[1].toLowerCase(), pid: m[2].toLowerCase() };
    return { vid: '', pid: '' };
  }

  // The whole point of the master suite: name the stick, name the MODE it's
  // switched into, say WHERE the lever lives in that mode, and tell Joe how to
  // flip it into a mode the browser likes. Works the same on macOS and Windows.
  function identify(gp) {
    gp = gp || active();
    if (!gp) return { brand: '—', model: '', family: 'none', mode: '—', lever: '—', note: 'no pad', hint: '' };
    var id = (gp.id || '').toLowerCase();
    var std = gp.mapping === 'standard';
    var vp = parseVidPid(id);
    var has = function (s) { return id.indexOf(s) >= 0; };

    var brand = 'Unknown stick / pad', model = '', family = 'generic';
    var mode = std ? 'XInput · standard mapping' : 'non-standard mapping';
    var lever = std ? 'D-pad buttons 12–15 (+ analog axes 0/1)' : 'hat axis (auto-detected) or analog axes';
    var note = '', hint = '';

    // -------- 8BitDo (vendor 2dc8; many also enumerate under MS/Nintendo VIDs) --
    if (vp.vid === '2dc8' || has('8bitdo') || has('8bit')) {
      brand = '8BitDo'; family = '8bitdo';
      if (has('arcade')) model = 'Arcade Stick';
      else if (has('ultimate')) model = 'Ultimate';
      else if (has('pro 2') || has('pro2')) model = 'Pro 2';
      else if (has('sn30')) model = 'SN30 Pro';
      if (std) {
        mode = 'X-input · standard mapping';
        lever = 'D-pad buttons 12–15';
        note = 'Best mode for these games — clean XInput layout.';
        hint = 'Already ideal. (Hold START+X at power-on for X-input.)';
      } else if (vp.vid === '057e' || has('switch') || has('nintendo')) {
        mode = 'Switch mode · non-standard';
        lever = 'hat axis (auto-detected)';
        note = 'Works, but A/B and X/Y read swapped vs Xbox — map them in the MAPPER below.';
        hint = 'For the cleanest layout, power on holding START+X (X-input).';
      } else {
        mode = 'D-input · non-standard';
        lever = 'hat axis (auto-detected)';
        note = 'Works via the hat. Buttons are non-standard — map them below if a game feels off.';
        hint = 'Power on holding START+X for X-input (standard layout) — re-plug after switching.';
      }
      return { brand: brand, model: model, family: family, mode: mode, lever: lever, note: note, hint: hint };
    }

    // -------- Mayflash F300 / generic arcade encoder (DragonRise vendor 0079) ---
    if (has('mayflash') || has('f300') || has('f500') || vp.vid === '0079' || has('dragonrise')) {
      brand = 'Mayflash F300'; family = 'f300';
      if (has('f500')) { brand = 'Mayflash F500'; }
      else if (vp.vid === '0079' && !has('mayflash') && !has('f300')) { brand = 'Mayflash / generic encoder'; model = 'DragonRise (vid 0079)'; }
      if (std) {
        mode = 'X-input PC mode · standard';
        lever = 'D-pad buttons 12–15';
        note = 'Bottom switch is on an X-input PC mode — ideal.';
        hint = 'Already ideal. (Bottom switch → an X/PC position.)';
      } else {
        mode = 'D-input PC mode · non-standard';
        lever = 'HAT axis (axis 9, auto-detected)';
        note = 'The F300 lever is always digital — here it rides the hat axis. The driver folds it in automatically.';
        hint = 'For a standard layout, set the bottom switch to an X/PC position and re-plug the USB.';
      }
      return { brand: brand, model: model, family: family, mode: mode, lever: lever, note: note, hint: hint };
    }

    // -------- plain XInput / Xbox-style pad -------------------------------------
    if (vp.vid === '045e' || has('xbox') || has('xinput') || (std && has('360'))) {
      brand = 'Xbox-style pad'; family = 'xbox';
      mode = 'XInput · standard mapping'; lever = 'D-pad buttons 12–15 (+ analog axes 0/1)';
      note = 'Standard mapping — everything lines up out of the box.';
      return { brand: brand, model: model, family: family, mode: mode, lever: lever, note: note, hint: hint };
    }

    // -------- PlayStation / Nintendo / Hori fall-throughs -----------------------
    if (vp.vid === '054c' || has('dualshock') || has('dualsense') || has('playstation') || has('sony')) {
      brand = 'PlayStation pad'; family = 'playstation';
      note = std ? 'Standard mapping.' : 'Non-standard — map buttons below if needed.';
      return { brand: brand, model: model, family: family, mode: mode, lever: lever, note: note, hint: hint };
    }
    if (vp.vid === '0f0d' || has('hori')) { brand = 'HORI stick / pad'; family = 'hori'; }
    else if (vp.vid === '057e' || has('nintendo') || has('switch')) { brand = 'Nintendo / Switch pad'; family = 'switch'; }

    if (!std) hint = 'If a game ignores it, set the stick to an X-input / PC mode and re-plug, or map it below.';
    return { brand: brand, model: model, family: family, mode: mode, lever: lever, note: note, hint: hint };
  }

  // --- public: full debug snapshot (probe page) -------------------------------
  function snapshot() {
    var gp = active();
    if (!gp) return { connected: false, everSeen: everSeen };
    var btns = [];
    for (var i = 0; i < gp.buttons.length; i++) {
      btns.push({ i: i, down: btnDown(gp, i), value: +(gp.buttons[i] ? gp.buttons[i].value : 0).toFixed(2) });
    }
    var axes = [];
    for (var j = 0; j < gp.axes.length; j++) axes.push(+(gp.axes[j] || 0).toFixed(3));
    return {
      connected: true,
      id: gp.id,
      mapping: gp.mapping || '(non-standard)',
      index: gp.index,
      buttonCount: gp.buttons.length,
      axisCount: gp.axes.length,
      buttons: btns,
      axes: axes,
      dir: dir(),
      analog: axis(),
      hatAxis: CFG.hatAxis != null ? CFG.hatAxis : detectedHat,
      id_info: identify(gp)
    };
  }

  function config(opts) {
    if (!opts) return CFG;
    if (opts.deadzone != null) CFG.deadzone = opts.deadzone;
    if (opts.hatAxis !== undefined) CFG.hatAxis = opts.hatAxis;
    if (opts.buttons) for (var k in opts.buttons) CFG.buttons[k] = opts.buttons[k];
    return CFG;
  }

  // --- connect/disconnect logging (handy while wiring) ------------------------
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('gamepadconnected', function (e) {
      everSeen = true;
      console.log('[stick] connected slot', e.gamepad.index, '·', e.gamepad.id,
        '· mapping:', e.gamepad.mapping || '(non-standard)',
        '·', e.gamepad.buttons.length + 'btn/' + e.gamepad.axes.length + 'ax');
    });
    window.addEventListener('gamepaddisconnected', function (e) {
      console.log('[stick] disconnected slot', e.gamepad.index);
    });
  }

  root.Stick = {
    update: update, connected: function () { return !!active(); },
    dir: dir, axis: axis,
    held: held, pressed: pressed, released: released, anyPressed: anyPressed,
    identify: identify, snapshot: snapshot, config: config,
    list: list, setActive: setActive, activeIndex: activeIndex,
    parseVidPid: parseVidPid,
    _active: active
  };
})(typeof window !== 'undefined' ? window : this);
