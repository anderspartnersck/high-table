/* ============================================================================
   HTCatalog — ONE-TIMER: THE HIGH TABLE, single source of truth.
   Knockers · pucks · venues · modes (RAISE IT) · controller brand(), shared by
   side.html (SIDE engine) and table_temp_engine.html (TOP-DOWN engine) so the
   two front-ends stay "close on all versions." Loads as a plain global:
   window.HTCatalog. No build step. NEVER renames a sprite file on disk.
   ============================================================================ */
(function (global) {
  'use strict';

  /* ---- KNOCKERS -----------------------------------------------------------
     Canonical keys = SIDE's keys. `base` is the sprite stem; the SIDE engine
     adds the foreshortened `_34` suffix, TOP-DOWN uses the flat art. KEY_ALIAS
     maps TOP-DOWN's old keys (yellow/purple/...) at the ?knocker= boundary so
     existing launcher URLs keep working unchanged. */
  var KNOCKERS = [
    { key: 'bees',   name: 'BEES',   col: '#ffe23a', team: 'bees',   base: 'knocker_yellow' },
    { key: 'queens', name: 'QUEENS', col: '#b14cff', team: 'queens', base: 'knocker_purple' },
    { key: 'house',  name: 'HOUSE',  col: '#dfefff', team: 'bees',   base: 'knocker_white' },
    { key: 'ice',    name: 'ICE',    col: '#27a0ff', team: 'queens', base: 'knocker_blue' },
    { key: 'turf',   name: 'TURF',   col: '#39ff7a', team: 'bees',   base: 'knocker_green' },
    { key: 'red',    name: 'RED',    col: '#e64a4a', team: 'bees',   base: 'knocker_red',    sideOnly: true },
    { key: 'orange', name: 'ORANGE', col: '#ff9a3c', team: 'bees',   base: 'knocker_orange', sideOnly: true },
    { key: 'royal',  name: 'ROYAL',  col: '#5a86fa', team: 'queens', base: 'knocker_royal',  sideOnly: true }
  ];
  var KEY_ALIAS = { yellow: 'bees', purple: 'queens', white: 'house', blue: 'ice', green: 'turf' };

  function knock(key) {
    if (KEY_ALIAS[key]) key = KEY_ALIAS[key];
    for (var i = 0; i < KNOCKERS.length; i++) if (KNOCKERS[i].key === key) return KNOCKERS[i];
    return null;
  }
  function knockerSprite(k, engine) { return 'sprites/' + k.base + (engine === 'side' ? '_34' : '') + '.png'; }
  // underside sprites NEVER carry the _34 suffix (files are knocker_<col>_bottom.png for both engines)
  function knockerBottom(k) { return 'sprites/' + k.base + '_bottom.png'; }

  /* ---- PUCKS — the colour the drop squashes into; uses the existing art. ---- */
  var PUCKS = [
    { key: 'lit',       name: 'LIT',       col: '#ffffff', style: 'lit',       img: 'sprites/puck_lit.png' },
    { key: 'neutral',   name: 'CLASSIC',   col: '#ff5ae1', style: 'classic',   img: 'sprites/puck_neutral.png' },
    { key: 'zebra',     name: 'ZEBRA',     col: '#27f6ff', style: 'zebra',     img: 'sprites/puck_zebra.png' },
    { key: 'energy',    name: 'ENERGY',    col: '#27f6ff', style: 'energy',    img: 'sprites/puck_energy.png' },
    { key: 'bees',      name: 'HIVE',      col: '#ffe23a', style: 'hive',      img: 'sprites/puck_bees.png' },
    { key: 'queens',    name: 'ROYAL',     col: '#b14cff', style: 'royal',     img: 'sprites/puck_queens.png' },
    { key: 'contested', name: 'CONTESTED', col: '#dfefff', style: 'contested', img: 'sprites/puck_contested.png' }
  ];
  function puck(key) { for (var i = 0; i < PUCKS.length; i++) if (PUCKS[i].key === key) return PUCKS[i]; return null; }

  /* ---- VENUES (the rooms) -------------------------------------------------
     SIDE and TOP-DOWN use different art + a different rivalry split, so two
     lists that share only display name + team. THE HIGH TABLE = Penalty Box
     Nachos: the apex, hardest tier, where the turbo line lives.
     The rivalry ENDS are renamed (was "BEE AFRAID"/"QUEENS RANSOM") so those
     names are free for the away-game MODES below. */
  var RINKS_SIDE = [
    { key: 'bee',    name: 'RIVALRY · BEE END',    side: 'sprites/table_bee_side.png',    team: 'bees' },
    { key: 'queens', name: 'RIVALRY · QUEENS END', side: 'sprites/table_queens_side.png', team: 'queens' },
    { key: 'bees',   name: 'THE HONEY HOLE',            side: 'sprites/table_bees_side.png',   team: 'bees' },
    { key: 'throne', name: 'THE THRONE ROOM',           side: 'sprites/table_throne_side.png', team: 'queens' },
    { key: 'nachos', name: 'THE HIGH TABLE',            side: 'sprites/table_nachos_side.png', team: 'none', high: true, tag: 'PENALTY BOX NACHOS' },
    { key: 'killscreen', name: 'CASTLE KILLSCREEN',     side: 'sprites/table_killscreen_side.png', side2: 'sprites/table_killscreen_side2.png', team: 'none', bonus: true, tag: 'BONUS TABLE' },   // secret: unlocked by beating THE HIGH TABLE (session-scoped). The arcade's namesake — HYSCORE FOREST blacklight rink.
    { key: 'garden', name: 'GENERICA GARDEN',           side: 'sprites/table_garden_side.png', team: 'none', generica: true },
    { key: 'box',    name: 'GENERICA BOX',              side: 'sprites/table_box_side.png',    team: 'none', generica: true },
    { key: 'prime',  name: 'GENERICA PRIME',            side: 'sprites/table_prime_side.png',  team: 'none', generica: true }
  ];
  var RINKS_TOP = [
    { key: 'nachos',  name: 'THE HIGH TABLE',  top: 'sprites/table_nachos_top_land.png',  bg: 'sprites/table_nachos_top_land.png', venue: null,     team: 'none', high: true, tag: 'PENALTY BOX NACHOS' },
    { key: 'bees',    name: 'THE HONEY HOLE',  top: 'sprites/table_bees_top.png',    bg: 'sprites/table_bees_bg.png',         venue: 'bees',   team: 'bees' },
    { key: 'throne',  name: 'THE THRONE ROOM', top: 'sprites/table_throne_top.png',  bg: 'sprites/table_throne_bg.png',       venue: 'queens', team: 'queens' },
    { key: 'rivalry', name: 'THE RIVALRY',     top: 'sprites/table_rivalry_top.png', bg: 'sprites/table_rivalry_bg.png',      venue: null,     team: 'none' },
    { key: 'killscreen', name: 'CASTLE KILLSCREEN', top: 'sprites/table_killscreen_top.png', bg: 'sprites/table_killscreen_top.png', venue: null, team: 'none', bonus: true, tag: 'BONUS TABLE' },   // secret, same unlock as the side pair — kept OUT of ARCADE_RINKS_TOP so the rotation is unchanged
    { key: 'garden',  name: 'GENERICA GARDEN', top: 'sprites/table_garden_top.png',  bg: 'sprites/table_garden_top.png',      venue: null,     team: 'none', generica: true },
    { key: 'box',     name: 'GENERICA BOX',    top: 'sprites/table_box_top.png',     bg: 'sprites/table_box_top.png',         venue: null,     team: 'none', generica: true }
  ];
  function rinkSide(key) { for (var i = 0; i < RINKS_SIDE.length; i++) if (RINKS_SIDE[i].key === key) return RINKS_SIDE[i]; return null; }
  function rinkTop(key)  { for (var i = 0; i < RINKS_TOP.length;  i++) if (RINKS_TOP[i].key  === key) return RINKS_TOP[i];  return null; }

  /* arcade front-door trim: only the marquee venues are shown without ?jail. */
  var ARCADE_RINKS_SIDE = { bee: 1, queens: 1, nachos: 1 };
  var ARCADE_RINKS_TOP  = { rivalry: 1, nachos: 1 };

  /* jailbreak default knocker+puck per SIDE venue (boot-straight-in). */
  var JDEF = {
    bee:    { k: 'bees',   p: 'bees' },    queens: { k: 'queens', p: 'queens' },
    bees:   { k: 'bees',   p: 'bees' },    throne: { k: 'queens', p: 'queens' },
    nachos: { k: 'house',  p: 'lit' },     garden: { k: 'turf',   p: 'zebra' },
    box:    { k: 'ice',    p: 'energy' },  prime:  { k: 'house',  p: 'neutral' },
    killscreen: { k: 'house', p: 'lit' }
  };

  var CREST = { bees: 'sprites/logo_hivemind.png', queens: 'sprites/logo_queens_table.png' };
  var CHANT = { bees: 'BEE-AT DOWN', queens: 'LONG LIVE THE QUEENS' };

  /* ---- MODES / RAISE IT ---------------------------------------------------
     Away-game modes: play the rival's team in the rival's house. These are the
     unlockable "secrets" — earned per RUN, not forever (see UNLOCK flow below).
     `playoff` = winning RAISE IT fires a one-game sudden-death turbo playoff to
     unlock THIS secret. Available on both 1UP and 2UP (quarter-eater) cabs. */
  var MODES = [
    { key: 'bee_afraid',    name: 'BEE AFRAID',    venue: 'bees',   team: 'queens', unlock: true, playoff: true, blurb: 'Play the QUEENS at THE HONEY HOLE' },
    { key: 'queens_ransom', name: 'QUEENS RANSOM', venue: 'throne', team: 'bees',   unlock: true, playoff: true, blurb: 'Play the BEES at THE THRONE ROOM' }
  ];
  /* RAISE IT — best-of-7 series. Variants differ only by per-game venue routing. */
  var RAISE_IT = {
    standard:   { name: 'RAISE IT',      route: ['bee', 'queens'], jail: false, blurb: 'Best-of-7 on the Rivalry table' },
    homecooked: { name: 'HOME COOKED',   route: ['throne', 'bees'], jail: true,  blurb: 'Series back-and-forth: Throne Room ↔ Honey Hole' },
    hightable:  { name: 'THE HIGH TABLE', route: ['nachos'],        jail: true,  turbo: true, blurb: 'Full series on the High Table — turbo line' }
  };
  var SERIES_WINS = 4, SERIES_MAX = 7;   // best-of-7, first to 4 wins

  /* ---- UNLOCK flow (old-cab style) ----------------------------------------
     Win a RAISE IT series -> a SINGLE sudden-death game on the turbo line (the
     High Table) fires as the "unlock playoff" for one secret. Win it to flip
     the secret ON for THIS RUN only. Unlocks are SESSION-SCOPED: they wipe when
     the quarter run ends (game-over -> attract / credit-out). Not battery-backed,
     just like the secrets you re-earned every time you walked up with quarters. */
  var UNLOCK = {
    scope: 'run',                 // 'run' = wipes on credit-out/attract (NOT persisted)
    playoffVenue: 'nachos',       // the turbo-line table the one-game unlock plays on
    playoffSudden: true,          // single game, sudden death (next goal / short target)
    jailGrantsAll: true           // ?jail / cheat grants every secret without the playoff
  };

  /* ---- controller brand from gamepad.id (ported from CASTLE KILLSCREEN KILLBOX) ---- */
  function brand(id) {
    id = (id || '').toLowerCase();
    if (id.indexOf('mayflash') >= 0 || id.indexOf('f300') >= 0 || id.indexOf('arcade') >= 0) return 'F300';
    if (id.indexOf('8bitdo') >= 0 || id.indexOf('8bit') >= 0) return '8BITDO';
    if (id.indexOf('xbox') >= 0 || id.indexOf('xinput') >= 0) return 'XBOX';
    if (id.indexOf('054c') >= 0 || id.indexOf('sony') >= 0) return 'PLAYSTATION';
    return 'HID';
  }

  // ATTRACT ADS — the ONE source of truth for the attract reel's venue/mode slides (read by index.html AND
  // side.html's in-game reel, so the copy can't drift). Verbiage reflects the CURRENT modes (incl. VS · 2P).
  var ATTRACT_ADS = [
    { k:'pb_onetimer', src:'sprites/penaltybox_sign_onetimer.png', head:'', sub:'', col:'#c79bff', bare:true },   // neon hero, reads on its own
    { k:'honey',   src:'sprites/table_bees.png',            head:'THE HONEY HOLE',   sub:'BEES · HOME ICE',                 col:'#ffe23a', tag:'VENUE' },
    { k:'throne',  src:'sprites/table_throne.png',          head:'THE THRONE ROOM',  sub:'QUEENS · THE COURT',              col:'#b14cff', tag:'VENUE' },
    { k:'nachos',  src:'sprites/penaltybox_sign_nachos.png',head:'THE HIGH TABLE',   sub:'PENALTY BOX · THE TURBO APEX',    col:'#39ff14', tag:'VENUE' },
    { k:'vs',      src:'sprites/table_rivalry.png',         head:'VS · 2 PLAYERS',   sub:'BEST OF 7 · HOIST THE CUP',       col:'#27f6ff', tag:'HEAD-TO-HEAD' },
    { k:'raiseit', src:'sprites/table_rivalry.png',         head:'RAISE IT',         sub:'WIN THE SERIES · TAKE THE CUP',   col:'#ffd23f', tag:'1-PLAYER CUP' },
    { k:'castle',  src:'sprites/penaltybox_sign_nachos.png',head:'CASTLE RULES',     sub:'3 PERIODS · ON THE CLOCK · OT',   col:'#39ff14', tag:'TIMED' },
    { k:'camp',    src:'sprites/table_bees.png',            head:'OLD-TYME CAMPAIGN',sub:'BEAT EVERY TABLE · UNLOCK FREEPLAY', col:'#ffe23a', tag:'1-PLAYER LADDER' },
  ];

  global.HTCatalog = {
    ATTRACT_ADS: ATTRACT_ADS,
    KNOCKERS: KNOCKERS, KEY_ALIAS: KEY_ALIAS, knock: knock,
    knockerSprite: knockerSprite, knockerBottom: knockerBottom,
    PUCKS: PUCKS, puck: puck,
    RINKS_SIDE: RINKS_SIDE, RINKS_TOP: RINKS_TOP, rinkSide: rinkSide, rinkTop: rinkTop,
    ARCADE_RINKS_SIDE: ARCADE_RINKS_SIDE, ARCADE_RINKS_TOP: ARCADE_RINKS_TOP,
    JDEF: JDEF, CREST: CREST, CHANT: CHANT,
    MODES: MODES, RAISE_IT: RAISE_IT, SERIES_WINS: SERIES_WINS, SERIES_MAX: SERIES_MAX,
    UNLOCK: UNLOCK, brand: brand
  };
})(typeof window !== 'undefined' ? window : this);
