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
     {t:'game',  won, n, f, tbl, twoP, mode, sp}    one finished match (mode: exhibition|raiseit|campaign|castle|vs|away|bonus)
                                                    sp (1124) = the SPECIAL GOALS per end, COUNTS ONLY: {n:{ot,bl,bank,ctr,so},f:{...}}
     {t:'sweep', won, twoP, variant}                (1124) a series / RAISE IT / campaign swept (4-0)
   v2 (1124, _DOCS/BACKEND-AUDIT-HT-SR-1124.md §3): the game event also carries pts:[n,f] (SCORE), goals:[n,f] (pucks in the
     net), tier (0..2), secs (live play), shutout:'for'|'against'|null and sp2:{near:{ot,otGoals,blasts,blastGoals,bank,ctr,hat},far:{..}};
     the series event carries sweep. A v1 record loads as v2 with the new counters at zero; v1 events (no pts/goals) still count.
     {t:'game', mode:'topdown', won, n, f, tbl, twoP, tier, secs}   (1124 B5) a TOP-DOWN match (table_temp_engine / topdown-3d):
                                                    kept in its own stats.topdown book, so it never feeds the side game's
                                                    W-L, streak, tables or the 10-HIGH-TABLE-wins KILLSCREEN rule
     {t:'series',won, w, l, twoP, variant, tbl}     a best-of-7 decided
     {t:'unlock',key}                               killscreen | bee_afraid | queens_ransom | freeplay
     {t:'camp',  rung}                              campaign ladder rung reached (0..4)                      */
(function (root) {
  var KEY = 'htCabinet', S = root.HTStore || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  var TABLES = { bee: 'RIVALRY · BEE END', queens: 'RIVALRY · QUEENS END', nachos: 'THE HIGH TABLE', bees: 'THE HONEY HOLE',
                 throne: 'THE THRONE ROOM', killscreen: 'CASTLE KILLSCREEN' };
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
    return { v: 2, since: Date.now(),
      stats: { games: 0, wins: 0, losses: 0, gf: 0, ga: 0, shutouts: 0, streak: 0, best: 0,
               series: 0, seriesWon: 0, htWins: 0, vs: 0, vsP1: 0, vsP2: 0, byTable: {}, byMode: {},
               special: {}, specialAgainst: {}, vsSpecial: { p1: {}, p2: {} }, sweeps: 0, swept: 0, vsSweeps: 0,   // 1124: counts only
               goalsFor: 0, goalsAg: 0, shutoutsAg: 0, secs: 0, byTier: {}, sp: { you: {}, cpu: {}, p1: {}, p2: {} }, playoffs: 0, playoffWins: 0,   // v2: gf/ga stay the SCORE (points)
               topdown: { games: 0, wins: 0, losses: 0, gf: 0, ga: 0, vs: 0, vsP1: 0, vsP2: 0, secs: 0 } },   // B5: the TOP-DOWN book
      unlocks: {}, camp: 0, cheats: {}, cheatsUsed: 0, hall: [] };
  }
  var R = load(), fans = [];
  function load() { var r = null; try { r = JSON.parse(S.getItem(KEY) || 'null'); } catch (e) { r = null; }
    if (!r || (r.v !== 1 && r.v !== 2) || !r.stats) return fresh();
    if (r.v === 1) r.v = 2;   // v1 -> v2: additive, the new counters start at zero
    var f = fresh(); for (var k in f) if (!(k in r)) r[k] = f[k]; for (var s in f.stats) if (!(s in r.stats)) r.stats[s] = f.stats[s];
    if (!r.stats.vsSpecial.p1) r.stats.vsSpecial = { p1: {}, p2: {} };
    if (!r.stats.sp.you) r.stats.sp = { you: {}, cpu: {}, p1: {}, p2: {} };
    return r; }
  function save() { try { S.setItem(KEY, JSON.stringify(R)); } catch (e) {} for (var i = 0; i < fans.length; i++) { try { fans[i](get()); } catch (e) {} } }
  function get() { return JSON.parse(JSON.stringify(R)); }
  function bump(o, k, n) { o[k] = (o[k] || 0) + (n == null ? 1 : n); }
  function record(ev) {
    if (!ev || !ev.t) return; R = load();   // re-read: another frame on the same box may have written since
    var s = R.stats;
    if (ev.t === 'game' && ev.mode === 'topdown') {   // B5: its own book (counts only)
      var td = s.topdown, tn = Math.max(0, ev.n | 0), tf = Math.max(0, ev.f | 0), ts = ev.secs > 0 ? Math.min(36000, ev.secs | 0) : 0;
      if (ev.twoP) { bump(td, 'vs'); bump(td, ev.won ? 'vsP1' : 'vsP2'); }
      else { bump(td, 'games'); bump(td, ev.won ? 'wins' : 'losses'); bump(td, 'gf', tn); bump(td, 'ga', tf); }
      if (ts) { bump(td, 'secs', ts); bump(s, 'secs', ts); }
      bump(s.byMode, 'topdown');
    } else if (ev.t === 'game') {
      var n = ev.n | 0, f = ev.f | 0, SPK = ['ot', 'bl', 'bank', 'ctr', 'so'];
      if (ev.sp && ev.sp.n && ev.sp.f) for (var i = 0; i < SPK.length; i++) { var a = (ev.sp.n[SPK[i]] | 0), b = (ev.sp.f[SPK[i]] | 0);   // whitelisted keys, integers only
        if (ev.twoP) { if (a) bump(s.vsSpecial.p1, SPK[i], a); if (b) bump(s.vsSpecial.p2, SPK[i], b); }
        else { if (a) bump(s.special, SPK[i], a); if (b) bump(s.specialAgainst, SPK[i], b); } }
      var SP2 = ['ot', 'otGoals', 'blasts', 'blastGoals', 'bank', 'ctr', 'hat'];   // v2 per-side book, whitelisted integer counts
      if (ev.sp2 && ev.sp2.near && ev.sp2.far) for (var j = 0; j < SP2.length; j++) { var x = Math.max(0, ev.sp2.near[SP2[j]] | 0), y = Math.max(0, ev.sp2.far[SP2[j]] | 0);
        if (x) bump(s.sp[ev.twoP ? 'p1' : 'you'], SP2[j], x); if (y) bump(s.sp[ev.twoP ? 'p2' : 'cpu'], SP2[j], y); }
      if (ev.goals && ev.goals.length === 2 && !ev.twoP) { bump(s, 'goalsFor', Math.max(0, ev.goals[0] | 0)); bump(s, 'goalsAg', Math.max(0, ev.goals[1] | 0)); }
      if (ev.secs > 0) bump(s, 'secs', Math.min(36000, ev.secs | 0));
      if (ev.twoP) { bump(s, 'vs'); bump(s, ev.won ? 'vsP1' : 'vsP2'); }
      else {
        bump(s, 'games'); bump(s, ev.won ? 'wins' : 'losses'); bump(s, 'gf', n); bump(s, 'ga', f);
        if (ev.won && f === 0) bump(s, 'shutouts'); if (!ev.won && n === 0) bump(s, 'shutoutsAg');
        if (ev.tier === 0 || ev.tier === 1 || ev.tier === 2) { var bt = s.byTier[ev.tier] || (s.byTier[ev.tier] = { g: 0, w: 0 }); bt.g++; if (ev.won) bt.w++; }
        s.streak = ev.won ? s.streak + 1 : 0; if (s.streak > s.best) s.best = s.streak;
        var tb = s.byTable[ev.tbl] || (s.byTable[ev.tbl] = { g: 0, w: 0 }); tb.g++; if (ev.won) tb.w++;
        bump(s.byMode, ev.mode || 'exhibition');
        if (ev.won && ev.tbl === 'nachos') { bump(s, 'htWins'); if (s.htWins >= KS_WINS) grant('killscreen'); }
      }
    } else if (ev.t === 'series') { if (!ev.twoP) { bump(s, 'series'); if (ev.won) bump(s, 'seriesWon'); if (ev.playoff) { bump(s, 'playoffs'); if (ev.won) bump(s, 'playoffWins'); }
        if (ev.won && ev.variant === 'standard') { if (ev.team === 'queens') grant('throneroom'); else if (ev.team === 'bees') grant('honeyhole'); } } }
    else if (ev.t === 'sweep') { if (ev.twoP) bump(s, 'vsSweeps'); else bump(s, ev.won ? 'sweeps' : 'swept'); }
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
