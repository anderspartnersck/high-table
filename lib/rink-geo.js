/* ============================================================================
   rink-geo.js — per-table geometry bridge for ONE-TIMER: THE HIGH TABLE
   ----------------------------------------------------------------------------
   Traced table art  <->  normalized rink coordinates.  No dependencies.
   Plain script (attaches to globalThis.RinkGeo) so it works over file:// and as
   a <script src> in the LAB and the engines — NOT an ES module (those fail on
   file://). Fixed/condensed from the GPT brief: real Gaussian solve instead of
   the undefined solveSVD stub, real 3×3 inverse, corners as image FRACTIONS.

   NORMALIZED RINK COORDS (gameplay lives here, reusable across every skin):
     u = left -> right          v = near goal -> far goal
     [0,0]=top-left  [1,0]=top-right  [1,1]=bottom-right  [0,1]=bottom-left
     near goal = v 1.0 (bottom)   far goal = v 0.0 (top)
   Corners are FRACTIONS of the image (0..1) so a 2560px downscale and a 6400px
   master share one preset (homography is scale-free). rinkToScreen() returns
   image-fraction coords; the caller multiplies by the drawn image size.
   ============================================================================ */
(function (root) {
"use strict";

var PUCK_RADIUS = 0.025, GOAL_X0 = 0.38, GOAL_X1 = 0.62;
var GOALS = { near:{x0:GOAL_X0,x1:GOAL_X1,v:1.0}, far:{x0:GOAL_X0,x1:GOAL_X1,v:0.0} };
var FACEOFF_POINTS = [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75],[0.5,0.5]];
var lerp = function (a, b, t) { return a + (b - a) * t; };

// Solve A x = b for an n×n system (Gaussian elimination, partial pivot).
function solveLinear(A, b) {
  var n = b.length, i, r, c, k, M = [];
  for (i = 0; i < n; i++) M.push(A[i].concat([b[i]]));
  for (c = 0; c < n; c++) {
    var p = c; for (r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
    var piv = M[c][c] || 1e-12;
    for (r = 0; r < n; r++) { if (r === c) continue; var f = M[r][c] / piv; for (k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  var x = []; for (i = 0; i < n; i++) x.push(M[i][n] / (M[i][i] || 1e-12)); return x;
}

// Homography src(4)->dst(4). src=unit square, dst=traced corners. Returns 3×3, H[2][2]=1.
function computeHomography(src, dst) {
  var A = [], b = [], i;
  for (i = 0; i < 4; i++) {
    var x = src[i][0], y = src[i][1], X = dst[i][0], Y = dst[i][1];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  var h = solveLinear(A, b);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

function invert3x3(m) {
  var a=m[0][0],b=m[0][1],c=m[0][2],d=m[1][0],e=m[1][1],f=m[1][2],g=m[2][0],h=m[2][1],i=m[2][2];
  var A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g, det=a*A+b*B+c*C, id=1/(det||1e-12);
  return [[A*id,(c*h-b*i)*id,(b*f-c*e)*id],
          [B*id,(a*i-c*g)*id,(c*d-a*f)*id],
          [C*id,(b*g-a*h)*id,(a*e-b*d)*id]];
}

function applyHomography(H, u, v) {
  var x=H[0][0]*u+H[0][1]*v+H[0][2], y=H[1][0]*u+H[1][1]*v+H[1][2], w=H[2][0]*u+H[2][1]*v+H[2][2];
  return [x / w, y / w];
}
function applyInv(Hi, x, y) {
  var u=Hi[0][0]*x+Hi[0][1]*y+Hi[0][2], v=Hi[1][0]*x+Hi[1][1]*y+Hi[1][2], w=Hi[2][0]*x+Hi[2][1]*y+Hi[2][2];
  return [u / w, v / w];
}
function trapezoidMap(C, u, v) {
  var lx=lerp(C.tl[0],C.bl[0],v), ly=lerp(C.tl[1],C.bl[1],v),
      rx=lerp(C.tr[0],C.br[0],v), ry=lerp(C.tr[1],C.br[1],v);
  return [lerp(lx, rx, u), lerp(ly, ry, u)];
}

var SRC = [[0,0],[1,0],[1,1],[0,1]];   // tl, tr, br, bl
function rebuildPreset(p) {
  var C = p.corners;
  p.H = computeHomography(SRC, [C.tl, C.tr, C.br, C.bl]);
  p.Hinv = invert3x3(p.H);
  return p;
}
function ensure(p) { if (!p.H) rebuildPreset(p); return p; }
function rinkToScreen(p, u, v) { ensure(p); return p.mode === 'trapezoid' ? trapezoidMap(p.corners, u, v) : applyHomography(p.H, u, v); }
function screenToRink(p, x, y) { ensure(p); return applyInv(p.Hinv, x, y); }

function clampPuck(u, v) {
  return [Math.max(PUCK_RADIUS, Math.min(1 - PUCK_RADIUS, u)),
          Math.max(PUCK_RADIUS, Math.min(1 - PUCK_RADIUS, v))];
}
function isGoal(u, v) {
  var inX = u >= GOAL_X0 && u <= GOAL_X1;
  if (v <= 0.015 && inX) return 'far';
  if (v >= 0.985 && inX) return 'near';
  return null;
}
function puckScaleFromV(v) { return lerp(0.55, 1.15, v); }
function nudgeCorner(p, name, dx, dy) { p.corners[name][0]+=dx; p.corners[name][1]+=dy; rebuildPreset(p); }
function exportPreset(p) {
  return JSON.stringify({ id:p.id, image:p.image, mode:p.mode, view:p.view, corners:p.corners, goals:p.goals }, null, 2);
}

// Debug overlay. toImg:(fx,fy)->[px,py] maps an image-fraction to canvas pixels.
function drawRinkDebug(ctx, p, toImg, opt) {
  opt = opt || {};
  function line(a, b) {
    var A = toImg.apply(null, rinkToScreen(p, a[0], a[1])), B = toImg.apply(null, rinkToScreen(p, b[0], b[1]));
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  }
  ctx.save();
  ctx.strokeStyle = opt.grid || 'rgba(39,246,255,0.5)'; ctx.lineWidth = 1;
  for (var i = 0; i <= 10; i++) { var t = i/10; line([t,0],[t,1]); line([0,t],[1,t]); }
  ctx.strokeStyle = opt.center || 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; line([0,0.5],[1,0.5]);
  ctx.strokeStyle = opt.goal || '#ffe23a'; ctx.lineWidth = 5; line([GOAL_X0,1],[GOAL_X1,1]);
  ctx.strokeStyle = opt.goalFar || '#b14cff'; line([GOAL_X0,0],[GOAL_X1,0]);
  ctx.fillStyle = opt.dot || 'rgba(255,255,255,0.9)';
  for (var j = 0; j < FACEOFF_POINTS.length; j++) {
    var P = toImg.apply(null, rinkToScreen(p, FACEOFF_POINTS[j][0], FACEOFF_POINTS[j][1]));
    ctx.beginPath(); ctx.arc(P[0], P[1], 6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// corners as image fractions; PLACEHOLDER insets — TUNE in RINK LAB, then paste back.
function inset(l, t, r, b) { return { tl:[l,t], tr:[1-r,t], br:[1-r,1-b], bl:[l,1-b] }; }
var GOALMOUTH = { near:{mouth:[[GOAL_X0,1],[GOAL_X1,1]]}, far:{mouth:[[GOAL_X0,0],[GOAL_X1,0]]} };

// tops use the UNCROPPED masters (table_*_top.png) so all 4 corners are in-frame for tracing.
var RINK_PRESETS = {
  rivalry_top:     { id:'rivalry_top',     view:'top', mode:'homography', image:'sprites/table_rivalry_top.png', corners:{tl:[0.1724,0.2059],tr:[0.824,0.2059],br:[0.8303,0.8282],bl:[0.1542,0.8295]}, goalHalf:0.122, goalAxis:'u', centerV:0.5, goals:GOALMOUTH, notes:'RE-TRACED 2026-07-01 (Joe, RINK LAB). Master blueprint.' },
  honey_top:       { id:'honey_top',       view:'top', mode:'trapezoid',  image:'sprites/table_bees_top.png',    corners:{tl:[0.1483,0.2333],tr:[0.8474,0.2371],br:[0.8802,0.8135],bl:[0.1094,0.8213]}, goalHalf:0.122, goalAxis:'u', goals:GOALMOUTH, notes:'LOCKED 2026-06-18 (Joe).' },
  throne_top:      { id:'throne_top',      view:'top', mode:'homography', image:'sprites/table_throne_top.png',  corners:{tl:[0.0964,0.1735],tr:[0.9062,0.1865],br:[0.9045,0.8161],bl:[0.0834,0.8355]}, goalHalf:0.142, goalAxis:'u', goals:GOALMOUTH, notes:'LOCKED 2026-06-18 (Joe).' },
  penalty_box_top: { id:'penalty_box_top', view:'top', mode:'homography', image:'sprites/table_nachos_top.png',  corners:{tl:[0.1311,0.2372],tr:[0.8109,0.2372],br:[0.8174,0.7628],bl:[0.13,0.7578]}, goalHalf:0.218, goalAxis:'u', centerV:0.47, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB) on the new TRUE PLAN-VIEW render. goalHalf 0.141->0.218 (the plan view shows the real mouth), centerV 0.47. Lab crop noted x .0042 y .0221 w .9665 h .9328 — rink-geo has no crop field and RINK LAB states corner mapping is unchanged by it, so the art is NOT recut; re-map if it ever is.' },
};
var SIDE_PRESETS = {
  rivalry_bee:    { id:'rivalry_bee',    view:'side', mode:'homography', image:'sprites/table_bee_side.png',    corners:{tl:[0.3411,0.3734],tr:[0.6779,0.3775],br:[0.9412,0.7928],bl:[0.0661,0.7887]}, goalHalf:0.118, goalAxis:'v', centerV:0.545, goals:GOALMOUTH, notes:'RE-TRACED 2026-07-01 (Joe, RINK LAB).' },
  rivalry_queens: { id:'rivalry_queens', view:'side', mode:'homography', image:'sprites/table_queens_side.png', corners:{tl:[0.3438,0.3631],tr:[0.6725,0.3631],br:[0.9075,0.7756],bl:[0.0963,0.7794]}, goalHalf:0.104, goalAxis:'v', centerV:0.58, goals:GOALMOUTH, notes:'RE-TRACED 2026-07-08 (Joe, RINK LAB) — tightened corners + centerV 0.37->0.58.' },
  honey_side_1:   { id:'honey_side_1',   view:'side', mode:'homography', image:'sprites/table_bees_side.png',   corners:{tl:[0.3569,0.2602],tr:[0.6473,0.2602],br:[0.868,0.7285],bl:[0.1001,0.726]}, goalHalf:0.112, goalAxis:'v', centerV:0.57, goals:GOALMOUTH, notes:'re-traced on REDO art + centerV 0.605 (RINK LAB 2026-06-19).' },
  throne_side_1:  { id:'throne_side_1',  view:'side', mode:'homography', image:'sprites/table_throne_side.png', corners:{tl:[0.345,0.2338],tr:[0.6676,0.2312],br:[0.891,0.7486],bl:[0.1082,0.7524]}, goalHalf:0.119, goalAxis:'v', centerV:0.605, goals:GOALMOUTH, notes:'re-traced (control art) + centerV 0.605 (RINK LAB 2026-06-19).' },
  throne_side_2:  { id:'throne_side_2',  view:'side', mode:'homography', image:'sprites/table_throne_side2.png', corners:{tl:[0.3443,0.2564],tr:[0.6523,0.2539],br:[0.8663,0.77],bl:[0.116,0.7713]}, goalHalf:0.119, goalAxis:'v', centerV:0.61, goals:GOALMOUTH, notes:'THRONE ROOM SIDE 2 (queens family) — traced in RINK LAB 2026-06-19.' },
  nachos_side_1:  { id:'nachos_side_1',  view:'side', mode:'homography', image:'sprites/table_nachos_side.png',  corners:{tl:[0.3435,0.2734],tr:[0.6467,0.2849],br:[0.8568,0.766],bl:[0.1213,0.7726]}, goalHalf:0.189, goalAxis:'v', centerV:0.54, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB) on the new render. goalHalf 0.13->0.189, centerV 0.52->0.54.' },
  nachos_side_2:  { id:'nachos_side_2',  view:'side', mode:'homography', image:'sprites/table_nachos_side2.png', corners:{tl:[0.3435,0.2947],tr:[0.6587,0.2931],br:[0.8951,0.7693],bl:[0.1038,0.7726]}, goalHalf:0.185, goalAxis:'v', centerV:0.545, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB) on the new render. goalHalf 0.127->0.185; centerV settled at 0.545 on a second pass.' },
  killscreen_side_1: { id:'killscreen_side_1', view:'side', mode:'homography', image:'sprites/table_killscreen_side.png',  corners:{tl:[0.3533,0.3194],tr:[0.6445,0.3177],br:[0.8426,0.7201],bl:[0.1651,0.7135]}, goalHalf:0.169, goalAxis:'v', centerV:0.595, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB) on the KS SIDE 1 REDO art. goalHalf 0.137->0.169, centerV 0.605->0.595.' },
  killscreen_side_2: { id:'killscreen_side_2', view:'side', mode:'homography', image:'sprites/table_killscreen_side2.png', corners:{tl:[0.3402,0.3013],tr:[0.6587,0.3046],br:[0.8481,0.7414],bl:[0.1377,0.7381]}, goalHalf:0.162, goalAxis:'v', centerV:0.565, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB) on the KS SIDE 2 REDO art. goalHalf 0.111->0.162, centerV 0.53->0.565.' },
  // GENERICA test rinks — generic art (tools/render_generica.py), geometry cloned from real tables for 1:1 feel.
  generica_garden: { id:'generica_garden', view:'side', mode:'homography', image:'sprites/table_garden_side.png', corners:{tl:[0.3247,0.2709],tr:[0.6805,0.267],br:[0.9453,0.7083],bl:[0.0737,0.6928]}, goalHalf:0.15,  goalAxis:'v', goals:GOALMOUTH, notes:'TEST — clone of RIVALRY (rivalry_bee).' },
  generica_box:    { id:'generica_box',    view:'side', mode:'homography', image:'sprites/table_box_side.png',    corners:{tl:[0.361,0.2865],tr:[0.6321,0.2878],br:[0.8529,0.8316],bl:[0.1454,0.8252]}, goalHalf:0.176, goalAxis:'v', goals:GOALMOUTH, notes:'TEST — clone of PENALTY BOX (nachos_side_1); house-rules candidate.' },
  generica_prime:  { id:'generica_prime',  view:'side', mode:'homography', image:'sprites/table_prime_side.png',  corners:{tl:[0.32,0.26],tr:[0.68,0.26],br:[0.90,0.80],bl:[0.10,0.80]}, goalHalf:0.16, goalAxis:'v', goals:GOALMOUTH, notes:'TEST — Claude ideal side specs, tuned to the _34 knockers.' },
};
// MOUSE_PRESETS — the table_temp_engine.html mouse-clicker venues. All HORIZONTAL (table runs
// left↔right, goals on the short L/R ends → goalAxis 'u'). Only the photographic playable tops are
// kept here; the flat logo-texture _bg venues (bees/throne/rivalry) were redundant and removed.
var MOUSE_PRESETS = {
  nachos_mouse:   { id:'nachos_mouse',   view:'top', mode:'homography', image:'sprites/table_nachos_top_land.png', corners:{tl:[0.1311,0.2372],tr:[0.8109,0.2372],br:[0.8174,0.7628],bl:[0.13,0.7578]}, goalHalf:0.218, goalAxis:'u', centerV:0.47, goals:GOALMOUTH, notes:'CARRIED from Joe\'s penalty_box_top placement 2026-09-25 — table_nachos_top_land.png is the SAME plan-view render, just the larger copy, so the normalised corners transfer exactly. Re-place here if the two ever diverge.' },
  killscreen_mouse:{ id:'killscreen_mouse',view:'top', mode:'homography', image:'sprites/table_killscreen_top.png',   corners:{tl:[0.141,0.1874],tr:[0.8568,0.1943],br:[0.8568,0.7953],bl:[0.1486,0.785]}, goalHalf:0.193, goalAxis:'u', centerV:0.5, goals:GOALMOUTH, notes:'PLACED BY JOE 2026-09-25 (RINK LAB). First CASTLE KILLSCREEN top-down; white ice on the HYSCORE FOREST blacklight wall. goalHalf 0.193 measured (my 0.13 was borrowed from nachos_mouse).' },
  throneuv_mouse: { id:'throneuv_mouse', view:'top', mode:'homography', image:'sprites/table_throne_uv.png',      corners:{tl:[0.0945,0.1593],tr:[0.8994,0.1593],br:[0.9176,0.8524],bl:[0.0884,0.8394]}, goalHalf:0.116, goalAxis:'u', centerV:0.5, goals:GOALMOUTH, notes:'Mouse venue — Throne UV (blacklight). LOCKED 2026-06-18 (Joe). centerV 0.5 (RINK LAB 2026-06-19).' },
};

/* ----------------------------------------------------------------------------
   SLIDERIDE_PRESETS — SLIDE AND RIDE (3v3 + tender box lacrosse; BLUE CRABS vs GHOSTS).
   Same homography geometry as the air-hockey tables (4 corners + goal mouth),
   plus the two lacrosse-specific zones tuned in FIELD LAB.html (not RINK LAB):
     creaseR   = goalie crease HALF-WIDTH in u-units; the apex reaches creaseR/AR
                 into the floor (AR≈2 long:wide → crease looks circular on art).
     slotDepth = how far the SNIPE SLOT extends off the goal line (v-units).
     slotHalf  = slot HALF-WIDTH in u-units (a catch in here arms a one-timer).
   Corners are PLACEHOLDER perspective floors — open FIELD LAB, drag onto the art,
   press S/A to export, paste back here. Image paths await the field renders.
---------------------------------------------------------------------------- */
function rideField(id, image, notes) {
  return { id:id, view:'side', mode:'homography', image:image,
    corners:{tl:[0.31,0.30], tr:[0.69,0.30], br:[1.02,0.99], bl:[-0.02,0.99]},
    goalHalf:0.13, goalAxis:'v', creaseR:0.16, slotDepth:0.42, slotHalf:0.19,
    goals:GOALMOUTH, notes:notes||'PLACEHOLDER — tune in FIELD LAB.' };
}
var SLIDERIDE_PRESETS = {
  slideride_boil:    rideField('slideride_boil',   'sprites/field_boil_side.png',   'THE BOIL — Blue Crabs home barn (rivalry centerpiece).'),
  slideride_pier:    rideField('slideride_pier',   'sprites/field_pier_side.png',   'THE PIER — family / learn box.'),
  slideride_sandbar: rideField('slideride_sandbar','sprites/field_sandbar_side.png','THE SANDBAR — open-air variant.'),
};

root.RinkGeo = {
  PUCK_RADIUS:PUCK_RADIUS, GOAL_X0:GOAL_X0, GOAL_X1:GOAL_X1, GOALS:GOALS, FACEOFF_POINTS:FACEOFF_POINTS,
  computeHomography:computeHomography, invert3x3:invert3x3, applyHomography:applyHomography,
  rebuildPreset:rebuildPreset, rinkToScreen:rinkToScreen, screenToRink:screenToRink,
  clampPuck:clampPuck, isGoal:isGoal, puckScaleFromV:puckScaleFromV,
  nudgeCorner:nudgeCorner, exportPreset:exportPreset, drawRinkDebug:drawRinkDebug,
  RINK_PRESETS:RINK_PRESETS, SIDE_PRESETS:SIDE_PRESETS, MOUSE_PRESETS:MOUSE_PRESETS, SLIDERIDE_PRESETS:SLIDERIDE_PRESETS,
  ALL_PRESETS: Object.assign({}, RINK_PRESETS, SIDE_PRESETS, MOUSE_PRESETS, SLIDERIDE_PRESETS),
};
})(typeof globalThis !== 'undefined' ? globalThis : this);
