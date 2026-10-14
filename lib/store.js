/* store.js — THE ONE STORAGE GATE for THE HIGH TABLE (Joe 2026-10-14: "save nothing, for security; saving is a
   feature of a self-contained app"). Every page reads/writes through window.HTStore instead of localStorage.

   SESSION (the public web build, e.g. github.io): NOTHING touches the visitor's disk. Values live in memory and are
   gone on reload (cabinet power-cycle). On load it also DELETES the High Table keys earlier builds left behind.
   PERSIST: the self-contained APP (window.__HT_APP baked in, or a capacitor:/ionic: page) and the LOCAL cab / LAN test
   rig (file:, localhost, 127.0.0.1, 192.168.x, 10.x) — the cab needs its KILLBOX controller pairing + button maps.
   ?store=session forces SESSION anywhere (QA; it only ever saves LESS).

   HTStore.getItem / setItem / removeItem   (same shape as localStorage)
   HTStore.mode 'session' | 'persist' · HTStore.app · HTStore.local
   HTStore.reset()  wipes saved progress + settings (the app's Settings -> RESET), keeps controller maps + the filing cabinet. */
(function (root) {
  var loc = root.location || {}, host = loc.hostname || '', proto = loc.protocol || '';
  var q = ''; try { q = new URLSearchParams(loc.search || '').get('store') || ''; } catch (e) {}
  var LOCAL = proto === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(host) || /^(192\.168|10)\./.test(host);
  var APP = root.__HT_APP === true || /^(capacitor|ionic):$/.test(proto);
  var MODE = (q === 'session') ? 'session' : ((APP || LOCAL) ? 'persist' : 'session');
  var OWN = /^(ht[A-Z]|side[A-Z]|sideRink\.|highTableGamepad$)/;   // the keys THE HIGH TABLE owns (CK-wide ckPads/ckGamepad belong to the KILLBOX)
  var KEEP = /^(highTableGamepad|htCabinet)$/;                     // reset() keeps the controller map + the FILING CABINET (only console.html's guarded WIPE shreds that)
  var ls = null; try { ls = root.localStorage; } catch (e) {}
  function ownKeys() { var out = []; try { for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && OWN.test(k)) out.push(k); } } catch (e) {} return out; }
  if (MODE === 'session' && ls && q !== 'session') ownKeys().forEach(function (k) { try { ls.removeItem(k); } catch (e) {} });   // tidy what older web builds saved
  var mem = {}, S;
  if (MODE === 'persist' && ls) S = {
    getItem: function (k) { try { return ls.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { ls.setItem(k, String(v)); } catch (e) {} },
    removeItem: function (k) { try { ls.removeItem(k); } catch (e) {} } };
  else S = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; } };
  S.mode = MODE; S.app = APP; S.local = LOCAL;
  S.reset = function () {
    Object.keys(mem).forEach(function (k) { if (!KEEP.test(k)) delete mem[k]; });
    if (MODE === 'persist' && ls) ownKeys().forEach(function (k) { if (!KEEP.test(k)) { try { ls.removeItem(k); } catch (e) {} } });
  };
  root.HTStore = S;
})(window);
