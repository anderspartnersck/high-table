/* ============================================================================
   STICK-MAP.js — one native button/axis map for the Castle Killscreen games.
   Pairs with stick.js. Lets STICK LAB (or any page) bind a physical stick once
   and save a profile that the games honor.

     <script src="lib/stick.js"></script>
     <script src="lib/stick-map.js"></script>

   WHY
   ---
   8BitDo and the Mayflash F300 each enumerate differently in every mode
   (X-input / D-input / Switch). stick.js already folds the LEVER into one 8-way
   direction, so most games "just work". This module covers the rest: which
   physical buttons mean a/b/x/y/etc., the analog steer axes, and the deadzone —
   the things a player may want to re-bind per stick.

   PROFILES (localStorage, per-origin — open this page the SAME way you launch
   the games so they share storage)
     ckGamepad       — the universal CK profile this module owns
     highTableGamepad — the exact key ONE TIMER: THE HIGH TABLE already reads,
                        written for you by saveAll() so the binding works today

   API
     StickMap.load()                  -> profile (merged over DEFAULTS)
     StickMap.save(profile)           -> persist the universal profile
     StickMap.saveAll(profile)        -> save universal + push to game keys
     StickMap.applyTo(Stick, profile) -> feed deadzone/buttons into the driver
     StickMap.toHighTable(profile)    -> translate to the High Table schema
     StickMap.DEFAULTS, StickMap.ACTIONS, StickMap.AXES
   ============================================================================ */
(function (root) {
  'use strict';

  var KEY = 'ckGamepad';
  var HIGH_TABLE_KEY = 'highTableGamepad';

  // Standard layout indices — the same names stick.js uses.
  var DEFAULTS = {
    v: 1,
    deadzone: 0.30,
    axisX: 0, axisY: 1, invertX: false, invertY: false,
    buttons: {
      a: 0, b: 1, x: 2, y: 3,
      l1: 4, r1: 5, l2: 6, r2: 7,
      select: 8, start: 9, l3: 10, r3: 11,
      up: 12, down: 13, left: 14, right: 15, home: 16
    }
  };

  // The bindable face/shoulder buttons we surface in the mapper UI, with the
  // role each one plays across the games (so Joe knows what he's binding).
  var ACTIONS = [
    { k: 'a',      lab: 'A',      role: 'primary — flip / shot / beam / confirm' },
    { k: 'b',      lab: 'B',      role: 'secondary — cheese / carom / warble' },
    { k: 'x',      lab: 'X',      role: 'tertiary — toast / blast / special' },
    { k: 'y',      lab: 'Y',      role: 'fourth shot / chord tone' },
    { k: 'l1',     lab: 'L1',     role: 'modifier — grade contrast / octave down' },
    { k: 'r1',     lab: 'R1',     role: 'modifier — grade sepia / octave up' },
    { k: 'l2',     lab: 'L2',     role: 'extra — kick' },
    { k: 'r2',     lab: 'R2',     role: 'extra — hat' },
    { k: 'select', lab: 'SELECT', role: 'reset grade / change key' },
    { k: 'start',  lab: 'START',  role: 'pause / confirm / arp bed' }
  ];
  var AXES = [
    { k: 'axisX', inv: 'invertX', lab: 'STEER / AIM  ◄ ►' },
    { k: 'axisY', inv: 'invertY', lab: 'STEER / GAS  ▲ ▼' }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var m = JSON.parse(root.localStorage.getItem(KEY));
      if (m && m.v) {
        var d = clone(DEFAULTS);
        d.buttons = Object.assign({}, DEFAULTS.buttons, m.buttons || {});
        return Object.assign(d, m, { buttons: d.buttons });
      }
    } catch (e) {}
    return clone(DEFAULTS);
  }

  function save(profile) {
    profile.v = 1;
    try { root.localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}
    return profile;
  }

  // Translate the universal profile into the schema THE HIGH TABLE engines read.
  // side.html's 3-button cab reads buttons.trap / blast / big / getbig (NOT snap/carom).
  // House layout (Joe 2026-06-26, F300 + 8BitDo): A=TRAP (hold/catch) · B=GET BIG (team power) · RT=BLAST (fire) · START=confirm.
  function toHighTable(p) {
    var b = p.buttons || {};
    return {
      v: 1, deadzone: p.deadzone, axisX: p.axisX, axisY: p.axisY,
      invertX: !!p.invertX, invertY: !!p.invertY,
      buttons: {
        trap: b.a, big: b.b, getbig: b.b, blast: b.r2, confirm: b.start,
        tableUp: b.up, cupDown: b.down,
        snap: b.a, carom: b.b   // legacy aliases (older breakaway build read these)
      }
    };
  }

  // Save the universal profile AND push it to every game key that consumes one,
  // so a single bind in STICK LAB lights up the games immediately.
  function saveAll(profile) {
    save(profile);
    try { root.localStorage.setItem(HIGH_TABLE_KEY, JSON.stringify(toHighTable(profile))); } catch (e) {}
    return profile;
  }

  // Live-apply to the driver in THIS page (deadzone + button remap).
  function applyTo(Stick, profile) {
    if (!Stick || !Stick.config) return;
    var p = profile || load();
    Stick.config({ deadzone: p.deadzone, buttons: p.buttons });
  }

  root.StickMap = {
    KEY: KEY, HIGH_TABLE_KEY: HIGH_TABLE_KEY,
    DEFAULTS: DEFAULTS, ACTIONS: ACTIONS, AXES: AXES,
    load: load, save: save, saveAll: saveAll, toHighTable: toHighTable, applyTo: applyTo,
    clone: clone
  };
})(typeof window !== 'undefined' ? window : this);
