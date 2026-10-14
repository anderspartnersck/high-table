/* cabinet.js — THE FILING CABINET for THE HIGH TABLE (Joe 2026-10-14). The one record the CLOSED BOX keeps:
   numbers (stats), unlockables, cheats, initials. Lives in ONE key ('htCabinet') through lib/store.js, so:
     · the public web build keeps it in memory for the visit and saves NOTHING (lib/store.js rule);
     · the Pi quarter-eater / the console / the app keep it on the device until someone WIPES it.
   No network, no ids, no names beyond three arcade initials. Load lib/store.js first.

   HTCabinet.get()            the whole record (a copy)
   HTCabinet.record(ev)       apply one game event (see EVENTS below) and save
   HTCabinet.hasUnlock(k)     true once earned on this box
   HTCabinet.setCheat(k,on)   cheat toggles (only ones the game really has)
   HTCabinet.addInitials(o)   {ini:'JOE', what:'RAISE IT', tbl:'nachos', score:'4-2'} -> the HALL (top 10)
   HTCabinet.wipe()           shreds the cabinet + the campaign rung (settings + controller maps are NOT in here)
   HTCabinet.listen(fn)       fn(record) after every change (the console's RECORDS page redraws live)

   EVENTS (posted by side.html, or relayed by console.html from its game frame):
     {t:'game',  won, n, f, tbl, twoP, mode}        one finished match (mode: exhibition|raiseit|campaign|castle|vs|away|bonus)
     {t:'series',won, w, l, twoP, variant, tbl}     a best-of-7 decided
     {t:'unlock',key}                               killscreen | bee_afraid | queens_ransom | freeplay
     {t:'camp',  rung}                              campaign ladder rung reached (0..4)                      */
(function (root) {
  var KEY = 'htCabinet', S = root.HTStore || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  var TABLES = { bee: 'RIVALRY · BEE END', queens: 'RIVALRY · QUEENS END', nachos: 'THE HIGH TABLE', bees: 'THE HONEY HOLE',
                 throne: 'THE THRONE ROOM', killscreen: 'CASTLE KILLSCREEN', garden: 'GENERICA GARDEN', box: 'GENERICA BOX', prime: 'GENERICA PRIME' };
  /* THE UNLOCKS (Joe 2026-10-14: "not a lot, just a few table unlocks"). Earned ONCE on this box, kept until a WIPE.
     The ALL ACCESS edition (lib/edition.js, HT_EDITION='all') opens all of them from the start.
       CASTLE KILLSCREEN  10 game wins on THE HIGH TABLE (the turbo table), vs the CPU
       THE HONEY HOLE     win RAISE IT as the BEES   · or clear its campaign rung (3)
       THE THRONE ROOM    win RAISE IT as the QUEENS · or clear its campaign rung (2)
       THE GARAGE + OLD-TYME FREEPLAY   clear the whole campaign
       BEE AFRAID / QUEENS RANSOM       win the one-game playoff that follows a RAISE IT win
     The arcade quarter-eater keeps its own old-cab rule: secrets earned there last the RUN only. */
  var KS_WINS = 10;
  var UNLOCKS = [
    { key: 'throneroom',    name: 'THE THRONE ROOM',   how: 'win RAISE IT as the QUEENS, or clear the Throne Room in the campaign' },
    { key: 'honeyhole',     name: 'THE HONEY HOLE',    how: 'win RAISE IT as the BEES, or clear the Honey Hole in the campaign' },
    { key: 'killscreen',    name: 'CASTLE KILLSCREEN', how: 'win ' + KS_WINS + ' games on THE HIGH TABLE' },
    { key: 'bee_afraid',    name: 'BEE AFRAID',        how: 'QUEENS @ THE HONEY HOLE · win the playoff after a RAISE IT' },
    { key: 'queens_ransom', name: 'QUEENS RANSOM',     how: 'BEES @ THE THRONE ROOM · win the playoff after a RAISE IT' },
    { key: 'garage',        name: 'THE GARAGE',        how: 'clear the OLD-TYME CAMPAIGN (the cab gallery)' },
    { key: 'freeplay',      name: 'OLD-TYME FREEPLAY', how: 'clear the OLD-TYME CAMPAIGN' } ];
  var ALL = root.HT_EDITION === 'all';
  var CHEATS = [    // switches the engine already has (side.html HT_CHEAT) — nothing invented
    { key: 'tableoff', name: 'TABLE OFF',   how: 'kill the air: the puck drags like a dead table' },
    { key: 'mono',     name: 'MONOCHROME',  how: 'the whole show in black and white' } ];
  function fresh() {
    return { v: 1, since: Date.now(),
      stats: { games: 0, wins: 0, losses: 0, gf: 0, ga: 0, shutouts: 0, streak: 0, best: 0,
               series: 0, seriesWon: 0, htWins: 0, vs: 0, vsP1: 0, vsP2: 0, byTable: {}, byMode: {} },
      unlocks: {}, camp: 0, cheats: {}, cheatsUsed: 0, hall: [] };
  }
  var R = load(), fans = [];
  function load() { var r = null; try { r = JSON.parse(S.getItem(KEY) || 'null'); } catch (e) { r = null; }
    if (!r || r.v !== 1 || !r.stats) return fresh();
    var f = fresh(); for (var k in f) if (!(k in r)) r[k] = f[k]; for (var s in f.stats) if (!(s in r.stats)) r.stats[s] = f.stats[s];
    return r; }
  function save() { try { S.setItem(KEY, JSON.stringify(R)); } catch (e) {} for (var i = 0; i < fans.length; i++) { try { fans[i](get()); } catch (e) {} } }
  function get() { return JSON.parse(JSON.stringify(R)); }
  function bump(o, k, n) { o[k] = (o[k] || 0) + (n == null ? 1 : n); }
  function record(ev) {
    if (!ev || !ev.t) return; R = load();   // re-read: another frame on the same box may have written since
    var s = R.stats;
    if (ev.t === 'game') {
      var n = ev.n | 0, f = ev.f | 0;
      if (ev.twoP) { bump(s, 'vs'); bump(s, ev.won ? 'vsP1' : 'vsP2'); }
      else {
        bump(s, 'games'); bump(s, ev.won ? 'wins' : 'losses'); bump(s, 'gf', n); bump(s, 'ga', f);
        if (ev.won && f === 0) bump(s, 'shutouts');
        s.streak = ev.won ? s.streak + 1 : 0; if (s.streak > s.best) s.best = s.streak;
        var tb = s.byTable[ev.tbl] || (s.byTable[ev.tbl] = { g: 0, w: 0 }); tb.g++; if (ev.won) tb.w++;
        bump(s.byMode, ev.mode || 'exhibition');
        if (ev.won && ev.tbl === 'nachos') { bump(s, 'htWins'); if (s.htWins >= KS_WINS) grant('killscreen'); }
      }
    } else if (ev.t === 'series') { if (!ev.twoP) { bump(s, 'series'); if (ev.won) bump(s, 'seriesWon');
        if (ev.won && ev.variant === 'standard') { if (ev.team === 'queens') grant('throneroom'); else if (ev.team === 'bees') grant('honeyhole'); } } }
    else if (ev.t === 'unlock') { if (ev.key === 'bee_afraid' || ev.key === 'queens_ransom') grant(ev.key); }   // the run's killscreen card doesn't count here: on the box it's the 10 High Table wins
    else if (ev.t === 'camp') { var r = Math.max(0, Math.min(4, ev.rung | 0)); if (r > R.camp) R.camp = r;
      if (R.camp >= 2) grant('throneroom'); if (R.camp >= 3) grant('honeyhole'); if (R.camp >= 4) { grant('freeplay'); grant('garage'); } }
    else if (ev.t === 'cheat') { bump(R, 'cheatsUsed'); }
    save();
  }
  function grant(k) { if (!R.unlocks[k]) { R.unlocks[k] = Date.now(); R.fresh = (R.fresh || []).concat(k); } }   // fresh = announce on the HOME screen once
  function setCheat(k, on) { R = load(); R.cheats[k] = !!on; save(); }
  function addInitials(o) { R = load(); var ini = String(o.ini || '???').toUpperCase().replace(/[^A-Z0-9 .]/g, '').slice(0, 3) || '???';
    R.hall.unshift({ ini: ini, what: o.what || '', tbl: o.tbl || '', score: o.score || '', at: Date.now() });
    if (R.hall.length > 10) R.hall.length = 10; save(); }
  function wipe() { R = fresh(); try { S.removeItem(KEY); S.removeItem('htCampRung'); } catch (e) {} save(); }
  root.HTCabinet = { get: get, record: record, setCheat: setCheat, addInitials: addInitials, wipe: wipe,
    hasUnlock: function (k) { return ALL || !!R.unlocks[k]; }, all: ALL, KS_WINS: KS_WINS,
    takeFresh: function () { R = load(); var f = R.fresh || []; if (f.length) { R.fresh = []; save(); } return f; },
    progress: function (k) { var s = R.stats; if (k === 'killscreen') return Math.min(s.htWins || 0, KS_WINS) + ' / ' + KS_WINS + ' HIGH TABLE WINS'; if (k === 'garage' || k === 'freeplay') return R.camp + ' / 4 CAMPAIGN TABLES'; return ''; }, listen: function (fn) { fans.push(fn); },
    reload: function () { R = load(); return get(); }, UNLOCKS: UNLOCKS, CHEATS: CHEATS, TABLES: TABLES, KEY: KEY };
})(window);
