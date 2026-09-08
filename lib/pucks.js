/* PuckArt — procedural side-view pucks for ONE-TIMER: THE HIGH TABLE (Joe 2026-06-19 "major puck pass").
 * One renderer, every style, in COLOUR · MONO · LINE — so the duplicate bw/gray/color art collapses into a
 * single source and the puck always matches the side geometry (a low chip seen 3/4, like puck_lit), never a
 * flat top-down disc that tips on its side. Animated (spin sweep / flame flicker / energy arcs). No raster.
 * API:  PuckArt.draw(ctx, cx, cy, R, {style, mono, line, blk, t, spin})   ·   PuckArt.STYLES
 */
(function(){
'use strict';
function hexA(h,a){ h=h.replace('#',''); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; const n=parseInt(h,16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
function ell(ctx,cx,cy,rx,ry){ ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,6.2832); }

// per-style palette: f0/f1 = top-face gradient · rim/rimD = the chip's side band · acc = pattern ink · glow = halo
const PAL={
  classic:{f0:'#3a3340',f1:'#15121a',rim:'#241f2b',rimD:'#0b0910',acc:'#ff5ae1',glow:'#ff5ae1'},
  neutral:{f0:'#34303c',f1:'#141019',rim:'#231f2b',rimD:'#0b0910',acc:'#ff5ae1',glow:'#ff5ae1'},
  lit:    {f0:'#ffffff',f1:'#d4d7e2',rim:'#b4b7c4',rimD:'#787c8b',acc:'#aab4c8',glow:'#cfe6ff'},
  zebra:  {f0:'#eaf6ff',f1:'#afcad6',rim:'#16323c',rimD:'#06141b',acc:'#0c1118',glow:'#27f6ff'},
  flame:  {f0:'#ffb061',f1:'#7a1500',rim:'#5e1400',rimD:'#2a0800',acc:'#ffe23a',glow:'#ff7a1a'},
  energy: {f0:'#1d4e6e',f1:'#06121f',rim:'#0c2740',rimD:'#040c16',acc:'#7df3ff',glow:'#27f6ff'},
  hive:   {f0:'#ffd24a',f1:'#7a5200',rim:'#5e3f00',rimD:'#2a1c00',acc:'#241800',glow:'#ffe23a'},
  royal:  {f0:'#c98bff',f1:'#3a116a',rim:'#2c0c52',rimD:'#150528',acc:'#efe2ff',glow:'#b14cff'},
  contested:{f0:'#b9a6e8',f1:'#1a1430',rim:'#241a40',rimD:'#0b081a',acc:'#ffffff',glow:'#c9b8ff'},
};
const MONO={f0:'#f3f3f6',f1:'#bdbfc8',rim:'#34343a',rimD:'#0d0d11',acc:'#0c0c10',glow:'#ffffff'};
const STYLES=['classic','lit','zebra','energy','hive','royal','contested'];   // 'flame' retired from pickers (Joe 2026-06-30); render branch below stays as harmless dead code

// ---- top-face pattern, drawn already clipped to the top ellipse ----
function overlay(ctx,style,cx,cy,rx,ry,t,o,P,mono,line){
  const ink=(mono||line)?'#0c0c10':P.acc, lw=Math.max(1,rx*0.05), spin=o.spin||0;
  ctx.lineWidth=lw;
  if(style==='zebra'){                                   // diagonal hi-viz bars, slight drift = roll
    const off=((spin*0.04)%1)*rx*0.7;
    ctx.save(); ctx.translate(cx,cy);
    for(let i=-5;i<=5;i++){ const x=i*rx*0.34+off; ctx.fillStyle=(i&1)?(mono||line?'#0c0c10':'#0c1118'):(mono||line?'#f3f3f6':P.f0);
      ctx.beginPath(); ctx.moveTo(x-rx*0.16,-ry*1.4); ctx.lineTo(x+rx*0.16,-ry*1.4); ctx.lineTo(x+rx*0.16+ry*0.5,ry*1.4); ctx.lineTo(x-rx*0.16+ry*0.5,ry*1.4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else if(style==='flame'){                            // licking tongues + flicker
    if(!line){ const g=ctx.createRadialGradient(cx,cy+ry*0.4,rx*0.1,cx,cy,rx*1.1); g.addColorStop(0,hexA(P.acc,0.95)); g.addColorStop(0.5,hexA(P.glow,0.5)); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ell(ctx,cx,cy,rx,ry); ctx.fill(); }
    ctx.strokeStyle=ink; ctx.lineCap='round';
    for(let i=0;i<5;i++){ const a=-1.57+(i-2)*0.5, fl=0.7+0.3*Math.sin(t*9+i*1.7); ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*rx*0.1, cy+Math.sin(a)*ry*0.1+ry*0.5);
      ctx.quadraticCurveTo(cx+Math.cos(a)*rx*0.5, cy+Math.sin(a)*ry*0.2, cx+Math.cos(a)*rx*0.5*fl, cy-ry*0.9*fl); ctx.stroke(); }
  } else if(style==='energy'){                           // rotating bolts / arcs
    ctx.strokeStyle=ink; ctx.lineCap='round';
    for(let i=0;i<3;i++){ const a0=spin*0.12+i*2.094; ctx.beginPath(); ctx.ellipse(cx,cy,rx*(0.5+i*0.16),ry*(0.5+i*0.16),0,a0,a0+1.4); ctx.stroke(); }
    if(!line){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=hexA(P.glow,0.5); ell(ctx,cx,cy,rx*0.2,ry*0.2); ctx.fill(); ctx.restore(); }
    // a jagged bolt
    ctx.beginPath(); ctx.moveTo(cx-rx*0.3,cy-ry*0.5); ctx.lineTo(cx+rx*0.05,cy); ctx.lineTo(cx-rx*0.1,cy+ry*0.1); ctx.lineTo(cx+rx*0.3,cy+ry*0.5); ctx.stroke();
  } else if(style==='hive'){                             // honeycomb
    ctx.strokeStyle=ink;
    for(let r=0;r<2;r++)for(let c=-2;c<=2;c++){ const hx=cx+c*rx*0.4, hy=cy+(r-0.5)*ry*0.9+(c&1?ry*0.45:0); hexp(ctx,hx,hy,rx*0.22,ry*0.22); ctx.stroke(); }
  } else if(style==='royal'){                            // crown + sparkle
    ctx.strokeStyle=ink; ctx.fillStyle=hexA(ink,0.9); const cw=rx*0.55,ch=ry*0.6;
    ctx.beginPath(); ctx.moveTo(cx-cw,cy+ch*0.4); ctx.lineTo(cx-cw,cy-ch*0.2); ctx.lineTo(cx-cw*0.5,cy+ch*0.05); ctx.lineTo(cx,cy-ch*0.5); ctx.lineTo(cx+cw*0.5,cy+ch*0.05); ctx.lineTo(cx+cw,cy-ch*0.2); ctx.lineTo(cx+cw,cy+ch*0.4); ctx.closePath(); line?ctx.stroke():ctx.fill();
    for(let i=0;i<3;i++){ const a=spin*0.1+i*2.1, sx=cx+Math.cos(a)*rx*0.7, sy=cy+Math.sin(a)*ry*0.7; star(ctx,sx,sy,rx*0.06); ctx.fillStyle=mono||line?'#0c0c10':P.acc; ctx.fill(); }
  } else if(style==='contested'){                        // split disc, gold vs purple (mono = split hatch)
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy-ry); ctx.lineTo(cx,cy+ry); ctx.lineTo(cx-rx,cy+ry); ctx.lineTo(cx-rx,cy-ry); ctx.closePath(); ctx.clip();
    ctx.fillStyle=mono||line?'#f3f3f6':'#ffd24a'; ell(ctx,cx,cy,rx,ry); ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy-ry); ctx.lineTo(cx,cy+ry); ctx.lineTo(cx+rx,cy+ry); ctx.lineTo(cx+rx,cy-ry); ctx.closePath(); ctx.clip();
    ctx.fillStyle=mono||line?'#0c0c10':'#b14cff'; ell(ctx,cx,cy,rx,ry); ctx.fill(); ctx.restore();
    ctx.strokeStyle=ink; ctx.beginPath(); ctx.moveTo(cx,cy-ry); ctx.lineTo(cx,cy+ry); ctx.stroke();
  } else if(style==='classic'||style==='neutral'){       // a clean ring + centre pip
    ctx.strokeStyle=mono||line?'#0c0c10':hexA(P.acc,0.9); ell(ctx,cx,cy,rx*0.66,ry*0.66); ctx.stroke();
    ctx.fillStyle=mono||line?'#0c0c10':hexA(P.acc,0.5); ell(ctx,cx,cy,rx*0.12,ry*0.12); ctx.fill();
  }
  // 'lit' = clean white face, no pattern
}
function hexp(ctx,x,y,rx,ry){ ctx.beginPath(); for(let i=0;i<6;i++){ const a=i*1.047-0.523, px=x+Math.cos(a)*rx, py=y+Math.sin(a)*ry; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); }
function star(ctx,x,y,r){ ctx.beginPath(); for(let i=0;i<8;i++){ const a=i*0.785, rr=(i&1)?r*0.4:r; const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); }

function draw(ctx,cx,cy,R,o){ o=o||{}; const t=o.t||0, mono=!!o.mono, line=!!o.line, blk=!!o.blk;
  const style=o.style||'classic', P=mono?MONO:(PAL[style]||PAL.classic);
  const rx=R, ry=R*0.30, th=R*0.26, topY=cy-th*0.5, botY=cy+th*0.5;   // flatter to the surface: squashed top + thin chip
  // SHADOW on the ice — wide + low so the chip reads as lying ON the table
  ctx.save(); ctx.globalAlpha=line?0.2:0.40; ctx.fillStyle='#000'; ell(ctx,cx,botY+ry*0.28,rx*1.12,ry*0.62); ctx.fill(); ctx.restore();
  // GLOW HALO — REMOVED (no puck glow)
  // SIDE BAND (the chip's thickness)
  ctx.beginPath(); ctx.moveTo(cx-rx,topY); ctx.lineTo(cx-rx,botY); ctx.ellipse(cx,botY,rx,ry,0,Math.PI,0,true); ctx.lineTo(cx+rx,topY); ctx.ellipse(cx,topY,rx,ry,0,0,Math.PI,true); ctx.closePath();
  if(line){ ctx.fillStyle='#f3f3f6'; ctx.fill(); ctx.strokeStyle='#0c0c10'; ctx.lineWidth=Math.max(1.4,R*0.05); ctx.stroke(); }
  else { const sg=ctx.createLinearGradient(0,topY,0,botY); sg.addColorStop(0,P.rim); sg.addColorStop(1,P.rimD); ctx.fillStyle=sg; ctx.fill(); }
  // TOP FACE
  ell(ctx,cx,topY,rx,ry);
  if(line){ ctx.fillStyle='#f7f7fa'; ctx.fill(); }
  else { const fg=ctx.createLinearGradient(0,topY-ry,0,topY+ry); fg.addColorStop(0,P.f0); fg.addColorStop(1,P.f1); ctx.fillStyle=fg; ctx.fill(); }
  // PATTERN (clipped to the face)
  ctx.save(); ell(ctx,cx,topY,rx,ry); ctx.clip(); overlay(ctx,style,cx,topY,rx,ry,t,o,P,mono,line); ctx.restore();
  // RIM line
  ctx.save(); ell(ctx,cx,topY,rx,ry); ctx.lineWidth=Math.max(1.2,R*0.045); ctx.strokeStyle=(mono||line)?'#0c0c10':hexA(P.rimD,0.95); ctx.stroke(); ctx.restore();
  // spinning spec highlight — REMOVED (no puck glow)
}
window.PuckArt={ draw, STYLES, PAL };
})();
