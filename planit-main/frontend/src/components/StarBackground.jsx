import { useEffect, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// STAR BACKGROUND v7 — PHOTOREALISTIC ADAPTIVE RENDERER
// Larger Milky Way band · enhanced low-device optimisation
//
// console: window.__starExplosion() | window.__starShower() | window.__tier()
// ═══════════════════════════════════════════════════════════════════════════════

const lerp   = (a,b,t) => a+(b-a)*t;
const clamp  = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const rgba   = (r,g,b,a) => `rgba(${r|0},${g|0},${b|0},${clamp(a,0,1).toFixed(3)})`;
const lerpC  = (a,b,t) => [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const dist2  = (ax,ay,bx,by) => (ax-bx)**2+(ay-by)**2;
const TAU    = Math.PI * 2;

// ─── DEVICE TIER DETECTION ────────────────────────────────────────────────────
function detectTier() {
  // Honour reduced-motion preference → force tier 0
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
  try {
    const mem = navigator.deviceMemory ?? 4;
    const cpu = navigator.hardwareConcurrency ?? 4;
    const t0  = performance.now();
    const c   = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const cx  = c.getContext('2d');
    for (let i=0; i<200; i++) {
      const g = cx.createRadialGradient(128,128,0,128,128,128);
      g.addColorStop(0,'rgba(255,255,255,0.5)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(128,128,128,0,TAU); cx.fill();
    }
    const ms    = performance.now() - t0;
    const score = (ms < 10 ? 2 : ms < 25 ? 1 : 0)
                + (mem >= 4 ? 1 : 0)
                + (cpu >= 4 ? 1 : 0);
    return score >= 4 ? 2 : score >= 2 ? 1 : 0;
  } catch { return 1; }
}

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────
// Low tier: drastically reduced work, 30 fps cap, no dust, no spikes, no ion
const TIER_CFG = [
  // Low  — mobile / integrated GPU
  { stars:120, mwStars:1400, mwGlow:8,  drawSpikes:false, ionTrail:false, fragmentation:false, sparkles:false, targetFPS:30, mwDust:false, mwAnimStars:false },
  // Mid
  { stars:280, mwStars:5000, mwGlow:22, drawSpikes:true,  ionTrail:false, fragmentation:true,  sparkles:true,  targetFPS:60, mwDust:true,  mwAnimStars:true  },
  // High — discrete GPU
  { stars:420, mwStars:9000, mwGlow:32, drawSpikes:true,  ionTrail:true,  fragmentation:true,  sparkles:true,  targetFPS:60, mwDust:true,  mwAnimStars:true  },
];

// ─── SPECTRAL STAR COLOURS ────────────────────────────────────────────────────
const SPECTRAL = [
  { col:[160,180,255], w:0.003 },
  { col:[175,195,255], w:0.012 },
  { col:[210,222,255], w:0.065 },
  { col:[250,248,255], w:0.120 },
  { col:[255,248,225], w:0.210 },
  { col:[255,220,155], w:0.300 },
  { col:[255,185,105], w:0.290 },
];
const SPEC_CDF = (() => {
  let acc=0, total=SPECTRAL.reduce((s,t)=>s+t.w,0);
  return SPECTRAL.map(t=>{ acc+=t.w/total; return acc; });
})();
function spectralColor() {
  const r=Math.random();
  for (let i=0;i<SPEC_CDF.length;i++) if (r<=SPEC_CDF[i]) return [...SPECTRAL[i].col];
  return [255,255,255];
}

// ─── STAR GENERATION ─────────────────────────────────────────────────────────
function makeStar(layerBias) {
  const u = Math.random();
  let mag = u < 0.003 ? 1.0 + Math.random()
          : u < 0.015 ? 2.0 + Math.random() * 0.9
          : u < 0.06  ? 2.9 + Math.random() * 1.1
          : u < 0.22  ? 4.0 + Math.random() * 1.0
          : u < 0.60  ? 5.0 + Math.random() * 1.5
          :             6.5 + Math.random() * 2.5;
  mag += layerBias;
  const cls = mag<2?'A': mag<3?'B': mag<4?'C': mag<5.5?'D': mag<7?'E':'F';
  const col = spectralColor();
  const scintAmp = cls==='A'?0.05 : cls==='B'?0.09 : cls==='C'?0.16 : cls==='D'?0.28 : 0.42;
  const airyR = mag<2 ? 2.0+Math.random()*0.9 : mag<3 ? 1.3+Math.random()*0.5
              : mag<4 ? 0.85+Math.random()*0.28 : mag<5 ? 0.50 : 0.32;
  const spikeCount = cls==='A' ? (Math.random()<0.45?6:4) : cls==='B' ? 4 : 0;
  const spikeLen   = cls==='A' ? 16+Math.random()*24 : cls==='B' ? 7+Math.random()*9 : 0;
  const bloomMult  = cls==='A' ? 6+Math.random()*4 : cls==='B' ? 3.5+Math.random()*2 : cls==='C' ? 2.2 : 1.1;
  return {
    xr: Math.random(), yr: Math.random(),
    mag, cls, col, airyR, bloomMult, spikeCount, spikeLen, scintAmp,
    ts0:0.17+Math.random()*0.52, ts1:0.29+Math.random()*0.78, ts2:0.43+Math.random()*1.1,
    to0:Math.random()*TAU, to1:Math.random()*TAU, to2:Math.random()*TAU,
    spikeRot: Math.random() * Math.PI / (spikeCount||4),
    winking:false, winkTimer:0, winkDur:0, winkNext:200+Math.random()*900,
  };
}

// ─── STAR RENDERER ────────────────────────────────────────────────────────────
function drawStar(ctx, s, sx, sy, scint, drawSpikes) {
  const { mag, cls, col, airyR, bloomMult, spikeCount, spikeLen } = s;
  const magB  = Math.pow(10, -(mag - 1) * 0.4) * 0.9;
  const B     = clamp(magB * (1.0 - s.scintAmp * (1 - scint)), 0, 1);
  if (B < 0.003) return;
  const warm = (1 - scint) * 0.18;
  const cr = clamp(col[0] + warm * 20, 0, 255)|0;
  const cg = col[1]|0;
  const cb = clamp(col[2] - warm * 12, 0, 255)|0;
  const jAmp = (cls==='A'?0.12 : cls==='B'?0.22 : cls==='C'?0.38 : 0.50) * (1-scint);
  const px = sx + Math.cos(s.to1 * 2.7 + scint) * jAmp;
  const py = sy + Math.sin(s.to2 * 2.3 + scint) * jAmp;

  if (cls==='F') {
    const g = ctx.createRadialGradient(px,py,0,px,py,airyR*1.6);
    g.addColorStop(0, rgba(cr,cg,cb,B*0.22)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*1.6,0,TAU); ctx.fillStyle=g; ctx.fill(); return;
  }
  if (cls==='E') {
    const g = ctx.createRadialGradient(px,py,0,px,py,airyR*2.2);
    g.addColorStop(0, rgba(cr,cg,cb,B*0.48)); g.addColorStop(0.5,rgba(cr,cg,cb,B*0.15)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*2.2,0,TAU); ctx.fillStyle=g; ctx.fill(); return;
  }
  if (cls==='D') {
    const g1 = ctx.createRadialGradient(px,py,0,px,py,airyR*3.2);
    g1.addColorStop(0,rgba(cr,cg,cb,B*0.28)); g1.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*3.2,0,TAU); ctx.fillStyle=g1; ctx.fill();
    const g2 = ctx.createRadialGradient(px,py,0,px,py,airyR*1.5);
    g2.addColorStop(0,rgba(255,255,255,B)); g2.addColorStop(0.4,rgba(cr,cg,cb,B*0.55)); g2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*1.5,0,TAU); ctx.fillStyle=g2; ctx.fill(); return;
  }
  if (cls==='C') {
    const sr = airyR * 3;
    const g1 = ctx.createRadialGradient(px,py,0,px,py,sr);
    g1.addColorStop(0, rgba(255,255,255,B*0.88));
    g1.addColorStop(0.3,rgba(lerp(255,cr,0.35)|0,lerp(255,cg,0.35)|0,lerp(255,cb,0.35)|0, B*0.52));
    g1.addColorStop(0.7,rgba(cr,cg,cb,B*0.14)); g1.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,sr,0,TAU); ctx.fillStyle=g1; ctx.fill();
    const g2 = ctx.createRadialGradient(px,py,0,px,py,airyR*1.05);
    g2.addColorStop(0,rgba(255,255,255,B)); g2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*1.05,0,TAU); ctx.fillStyle=g2; ctx.fill(); return;
  }
  const bloom = airyR * bloomMult;
  {
    const g = ctx.createRadialGradient(px,py,airyR*0.8,px,py,bloom);
    g.addColorStop(0,rgba(cr,cg,cb,B*0.20)); g.addColorStop(0.25,rgba(cr,cg,cb,B*0.08));
    g.addColorStop(0.6,rgba(cr,cg,cb,B*0.025)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,bloom,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  {
    const sr = airyR * 4.2;
    const g  = ctx.createRadialGradient(px,py,0,px,py,sr);
    g.addColorStop(0,rgba(255,255,255,B*0.92));
    g.addColorStop(0.18,rgba(lerp(255,cr,0.3)|0,lerp(255,cg,0.3)|0,lerp(255,cb,0.3)|0,B*0.72));
    g.addColorStop(0.50,rgba(cr,cg,cb,B*0.32)); g.addColorStop(0.80,rgba(cr,cg,cb,B*0.08)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,sr,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  {
    const g = ctx.createRadialGradient(px,py,0,px,py,airyR*1.1);
    g.addColorStop(0,rgba(255,255,255,B)); g.addColorStop(0.7,rgba(255,255,255,B*0.88)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,airyR*1.1,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  if (cls==='A') {
    const cR = airyR*5.8;
    const g  = ctx.createRadialGradient(px,py,airyR*1.6,px,py,cR);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.4,rgba(158,175,255,B*0.13)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,cR,0,TAU); ctx.fillStyle=g; ctx.fill();
  } else {
    const cR = airyR*3.8;
    const g  = ctx.createRadialGradient(px,py,airyR*1.3,px,py,cR);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.5,rgba(160,178,255,B*0.06)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(px,py,cR,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  if (drawSpikes && spikeCount>0 && B>0.04) {
    ctx.save(); ctx.translate(px,py); ctx.rotate(s.spikeRot);
    const step = Math.PI / spikeCount;
    for (let k=0; k<spikeCount; k++) {
      const a = k * step;
      for (const d of [1,-1]) {
        const ex = Math.cos(a)*spikeLen*B*d, ey = Math.sin(a)*spikeLen*B*d;
        const sg2 = ctx.createLinearGradient(0,0,ex,ey);
        sg2.addColorStop(0,rgba(cr,cg,cb,B*0.22)); sg2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex,ey);
        ctx.strokeStyle=sg2; ctx.lineWidth=airyR*(cls==='A'?3.8:2.4); ctx.lineCap='round'; ctx.stroke();
        const sg = ctx.createLinearGradient(0,0,ex,ey);
        sg.addColorStop(0,rgba(255,255,255,B*0.88)); sg.addColorStop(0.12,rgba(cr,cg,cb,B*0.65));
        sg.addColorStop(0.45,rgba(cr,cg,cb,B*0.20)); sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex,ey);
        ctx.strokeStyle=sg; ctx.lineWidth=airyR*(cls==='A'?0.48:0.30); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ─── MILKY WAY — enlarged ─────────────────────────────────────────────────────
// bandW bumped from 0.13 → 0.22, coreR from 0.10 → 0.18, length 2.5 → 2.8
const MW = {
  coreCX:0.38, coreCY:0.55,
  bandAngle:-0.50,
  bandW:0.22,          // ← wider band
  coreR:0.18,          // ← bigger core
  length:2.8,
};

function buildMWStars(count) {
  const stars=[]; const {coreCX,coreCY,bandAngle,bandW,coreR} = MW;
  const cos=Math.cos(bandAngle), sin=Math.sin(bandAngle);
  for (let i=0;i<count;i++) {
    const t  = (Math.random()*2-1);
    const wm = 1.0 + Math.abs(t)*0.55;
    const s  = (Math.random()-0.5)*2;
    const pS = s*Math.abs(s)*bandW*wm;
    const xr = coreCX + cos*t*1.1 - sin*pS;
    const yr = coreCY + sin*t*1.1 + cos*pS;
    if (xr<-0.12||xr>1.12||yr<-0.12||yr>1.12) continue;
    const dx=xr-coreCX, dy=yr-coreCY;
    const cd=Math.sqrt(dx*dx+dy*dy);
    const cBoost=Math.exp(-cd/coreR*2.2);
    const sz=Math.random();
    const r = sz<0.75?0.10+Math.random()*0.20 : sz<0.93?0.20+Math.random()*0.32 : 0.34+Math.random()*0.52;
    const baseA=clamp((0.028+Math.random()*0.12)*(Math.exp(-Math.abs(t)*1.1)*0.65+0.35)*(1+cBoost*3.2), 0, 0.68);
    const coreC=lerpC([255,208,135],[255,228,175],Math.random());
    const armC =lerpC([195,212,255],[230,238,255],Math.random());
    const col  =lerpC(armC,coreC,clamp(cBoost*3,0,1));
    const ts=0.06+Math.random()*0.45, to=Math.random()*TAU;
    stars.push({xr,yr,r,baseA,ts,to,col});
  }
  return stars;
}

function buildMWDust(count=60) {
  const {coreCX,coreCY,bandAngle}=MW; const cos=Math.cos(bandAngle),sin=Math.sin(bandAngle);
  const d=[];
  for (let i=0;i<count;i++) {
    const t=(Math.random()*2-1)*0.88, perp=(Math.random()-0.5)*0.14;
    d.push({
      xr:coreCX+cos*t-sin*perp, yr:coreCY+sin*t+cos*perp,
      rr:0.028+Math.random()*0.08, ax:0.5+Math.random()*1.6, ay:0.3+Math.random()*0.75,
      rot:bandAngle+(Math.random()-0.5)*0.45, op:0.022+Math.random()*0.042,
    });
  }
  return d;
}

function renderMWOffscreen(W, H, mwStars, mwDust, blobCount, useDust) {
  const oc = document.createElement('canvas'); oc.width=W; oc.height=H;
  const cx = oc.getContext('2d');
  const minD=Math.min(W,H);
  const {coreCX,coreCY,bandAngle,bandW,coreR,length}=MW;
  const cos=Math.cos(bandAngle), sin=Math.sin(bandAngle);

  // Pass 0: large-scale background luminance
  for (let i=0;i<12;i++) {
    const t=(i/11)*2-1;
    const cx2=(coreCX+cos*t*1.15)*W, cy2=(coreCY+sin*t*1.15)*H;
    const r=minD*(0.30+Math.exp(-Math.abs(t)*1.2)*0.12);   // ← larger halos
    const a=0.006*Math.exp(-Math.abs(t)*0.75);
    const g=cx.createRadialGradient(cx2,cy2,0,cx2,cy2,r);
    g.addColorStop(0,rgba(215,215,228,a)); g.addColorStop(1,'rgba(0,0,0,0)');
    cx.beginPath(); cx.arc(cx2,cy2,r,0,TAU); cx.fillStyle=g; cx.fill();
  }

  // Pass 1: diffuse band glow blobs (wider scale)
  for (let i=0;i<blobCount;i++) {
    const t=(i/(blobCount-1))*2-1;
    const bx=(coreCX+cos*t*(length*0.5))*W, by=(coreCY+sin*t*(length*0.5))*H;
    const dist=Math.abs(t);
    const intensity=Math.exp(-dist*1.4)*0.85+0.22;
    const wm=dist<0.18?1.80:1.0+Math.random()*0.3;
    const warmth=Math.exp(-dist*2.4);
    const rc=lerp(205,255,warmth), gc=lerp(195,235,warmth), bc=lerp(192,215,warmth*0.25+0.75);
    const rAlong=bandW*minD*(1.1+Math.random()*0.5);      // ← bigger blobs
    const rPerp =bandW*minD*wm*(0.9+Math.random()*0.6);
    const rmax=Math.max(rAlong,rPerp);
    cx.save(); cx.translate(bx,by); cx.rotate(bandAngle);
    cx.scale(rAlong/rmax, rPerp/rmax);
    const g1=cx.createRadialGradient(0,0,0,0,0,rmax*1.9);
    g1.addColorStop(0,rgba(rc,gc,bc,intensity*0.014)); g1.addColorStop(1,'rgba(0,0,0,0)');
    cx.beginPath(); cx.arc(0,0,rmax*1.9,0,TAU); cx.fillStyle=g1; cx.fill();
    const g2=cx.createRadialGradient(0,0,0,0,0,rmax*0.75);
    g2.addColorStop(0,rgba(rc,gc,bc,intensity*0.030)); g2.addColorStop(0.6,rgba(rc,gc,bc,intensity*0.010)); g2.addColorStop(1,'rgba(0,0,0,0)');
    cx.beginPath(); cx.arc(0,0,rmax*0.75,0,TAU); cx.fillStyle=g2; cx.fill();
    cx.restore();
  }

  // Pass 2: galactic core bulge — now larger
  const ccx=coreCX*W, ccy=coreCY*H;
  for (const [r,a,col] of [
    [coreR*0.65*minD, 0.080, [255,228,168]],
    [coreR*2.2*minD,  0.048, [245,218,155]],
    [coreR*5.0*minD,  0.022, [230,208,148]],
    [coreR*9.0*minD,  0.010, [218,200,140]],
    [coreR*14*minD,   0.004, [210,195,135]],   // ← extra outer bloom
  ]) {
    const g=cx.createRadialGradient(ccx,ccy,0,ccx,ccy,r);
    g.addColorStop(0,rgba(col[0],col[1],col[2],a)); g.addColorStop(0.5,rgba(col[0],col[1],col[2],a*0.45)); g.addColorStop(1,'rgba(0,0,0,0)');
    cx.beginPath(); cx.arc(ccx,ccy,r,0,TAU); cx.fillStyle=g; cx.fill();
  }

  // Pass 3: dust lanes — skipped on low tier
  if (useDust) {
    cx.save(); cx.globalCompositeOperation='multiply';
    for (const d of mwDust) {
      const dx=d.xr*W, dy=d.yr*H, r=d.rr*minD, rx=r*d.ax, ry=r*d.ay, rm=Math.max(rx,ry);
      cx.save(); cx.translate(dx,dy); cx.rotate(d.rot); cx.scale(rx/rm,ry/rm);
      const g=cx.createRadialGradient(0,0,0,0,0,rm);
      g.addColorStop(0,rgba(0,0,0,d.op)); g.addColorStop(0.5,rgba(0,0,0,d.op*0.45)); g.addColorStop(1,'rgba(0,0,0,0)');
      cx.beginPath(); cx.arc(0,0,rm,0,TAU); cx.fillStyle=g; cx.fill();
      cx.restore();
    }
    cx.restore();
  }

  // Pass 4: resolved micro-stars
  for (const s of mwStars) {
    const sx=s.xr*W, sy=s.yr*H;
    cx.beginPath(); cx.arc(sx,sy,s.r,0,TAU);
    cx.fillStyle=rgba(s.col[0],s.col[1],s.col[2],s.baseA);
    cx.fill();
  }

  return oc;
}

function drawMilkyWay(ctx, mwCanvas, mwStars, W, H, t, doAnim) {
  if (mwCanvas) ctx.drawImage(mwCanvas, 0, 0);
  if (!doAnim) return;
  for (const s of mwStars) {
    if (s.baseA < 0.12) continue;
    const sx=s.xr*W, sy=s.yr*H;
    const tw=0.65+0.35*Math.sin(t*s.ts*0.38+s.to);
    const a=(s.baseA*tw - s.baseA)*0.6;
    if (Math.abs(a)<0.005) continue;
    ctx.beginPath(); ctx.arc(sx,sy,s.r,0,TAU);
    ctx.fillStyle=rgba(s.col[0],s.col[1],s.col[2],Math.max(0,a));
    ctx.fill();
  }
}

// ─── METEOR SYSTEM ────────────────────────────────────────────────────────────
const MSPEC = [
  { head:[255,255,255], coma:[255,238,195], plasma:[255,218,145], trail:[185,205,255], corona:[228,232,255] },
  { head:[255,255,248], coma:[255,245,185], plasma:[255,228,128], trail:[205,215,255], corona:[238,240,255] },
  { head:[255,255,255], coma:[228,236,255], plasma:[208,224,255], trail:[162,188,255], corona:[218,226,255] },
];

function makeMeteor(W, H, opts={}) {
  const sp    = MSPEC[Math.floor(Math.random()*MSPEC.length)];
  const goR   = opts.goRight ?? (Math.random()>0.5);
  const spd   = opts.speed   ?? (5+Math.random()*18);
  const ang   = opts.ang     ?? ((10+Math.random()*50)*Math.PI/180);
  const vx = (goR?1:-1)*Math.cos(ang)*spd;
  const vy = Math.sin(ang)*spd;
  const canFrag = (opts.isFragment!==true) && Math.random()<0.22;
  const hasIon  = (opts.isFragment!==true) && Math.random()<0.38;
  return {
    x: opts.x ?? (goR ? -30 : W+30),
    y: opts.y ?? H*(0.02+Math.random()*0.44),
    vx: opts.vx??vx, vy: opts.vy??vy,
    headR: opts.headR ?? (0.9+Math.random()*2.8),
    sp, life:1, decay:opts.decay??(0.004+Math.random()*0.009),
    drag:0.9982+Math.random()*0.0013, bright:1,
    tailMax:160+Math.random()*300,
    flares: Math.random()<0.55 ? Array.from({length:Math.random()<0.3?2:1},()=>({
      t:0.10+Math.random()*0.55, mag:1.8+Math.random()*3.5, dur:0.05+Math.random()*0.10,
      fired:false, active:false, prog:0
    })) : [],
    sparkles:[], nextSpark:0,
    history:[], histLen:110,
    target: opts.target??null,
    isEgg: opts.isEgg??false, isFragment: opts.isFragment??false,
    canFrag, fragAt:0.28+Math.random()*0.42, fragmented:false,
    hasIon, ionTrail:[],
    entryFlash:1.0, entryDecay:0.06+Math.random()*0.06,
    curSpd:spd,
  };
}

function stepMeteor(m, meteors, W, H, cfg) {
  m.vx*=m.drag; m.vy*=m.drag;
  m.x+=m.vx;   m.y+=m.vy;
  m.curSpd = Math.hypot(m.vx,m.vy);
  m.history.unshift({x:m.x, y:m.y});
  if (m.history.length>m.histLen) m.history.pop();
  if (m.entryFlash>0) m.entryFlash=Math.max(0,m.entryFlash-m.entryDecay);
  m.life -= m.decay;
  const lf = 1-m.life;
  m.bright=1;
  for (const f of m.flares) {
    if (!f.fired && lf>=f.t){ f.fired=true; f.active=true; f.prog=0; }
    if (f.active) {
      f.prog+=m.decay/f.dur;
      const e=f.prog<0.4 ? f.prog/0.4 : 1-(f.prog-0.4)/0.6;
      m.bright=Math.max(m.bright,1+(f.mag-1)*Math.max(0,e));
      if(f.prog>=1) f.active=false;
    }
  }
  if (cfg.fragmentation && m.canFrag && !m.fragmented && lf>=m.fragAt) {
    m.fragmented=true;
    const spd=m.curSpd, pieces=2+Math.floor(Math.random()*2);
    for (let i=0;i<pieces;i++) {
      const sa=(Math.random()-0.5)*0.52, ca=Math.atan2(m.vy,m.vx), fs=spd*(0.48+Math.random()*0.42);
      const frag=makeMeteor(W,H,{x:m.x,y:m.y,vx:Math.cos(ca+sa)*fs,vy:Math.sin(ca+sa)*fs,
        headR:m.headR*(0.28+Math.random()*0.34),decay:m.decay*(1.3+Math.random()*0.7),isFragment:true});
      frag.life=m.life*(0.48+Math.random()*0.38); frag.entryFlash=0.5;
      meteors.push(frag);
    }
    m.decay*=2.0;
  }
  if (cfg.ionTrail && m.hasIon) {
    m.ionTrail.unshift({x:m.x,y:m.y,life:1.0});
    if (m.ionTrail.length>70) m.ionTrail.pop();
    for (let i=m.ionTrail.length-1;i>=0;i--) {
      m.ionTrail[i].life-=0.010;
      if(m.ionTrail[i].life<=0) m.ionTrail.splice(i,1);
    }
  }
  if (cfg.sparkles && --m.nextSpark<=0) {
    m.nextSpark=1+Math.floor(Math.random()*3);
    m.sparkles.push({
      x:m.x+(Math.random()-0.5)*m.curSpd*0.5, y:m.y+(Math.random()-0.5)*m.curSpd*0.5,
      vx:(Math.random()-0.5)*0.9, vy:(Math.random()-0.5)*0.9+0.15,
      life:0.55+Math.random()*0.5, decay:0.015+Math.random()*0.025, r:0.28+Math.random()*0.85,
      col:lerpC(m.sp.coma,m.sp.trail,Math.random()),
    });
  }
  for (let i=m.sparkles.length-1;i>=0;i--) {
    const s=m.sparkles[i]; s.x+=s.vx; s.y+=s.vy; s.life-=s.decay;
    if(s.life<=0) m.sparkles.splice(i,1);
  }
}

function drawMeteor(ctx, m) {
  if (m.history.length<2) return;
  const eb=clamp(m.bright*m.life,0,1);
  if (m.hasIon && m.ionTrail.length>2) {
    ctx.save(); ctx.globalCompositeOperation='screen';
    for (let i=1;i<m.ionTrail.length;i++) {
      const a=m.ionTrail[i].life*0.048; if (a<0.003) continue;
      const w=(1-i/m.ionTrail.length)*2.8;
      ctx.beginPath(); ctx.moveTo(m.ionTrail[i-1].x,m.ionTrail[i-1].y); ctx.lineTo(m.ionTrail[i].x,m.ionTrail[i].y);
      ctx.strokeStyle=rgba(135,228,175,a); ctx.lineWidth=w; ctx.stroke();
    }
    ctx.restore();
  }
  let dist=0; const pts=[m.history[0]];
  for (let i=1;i<m.history.length;i++) {
    dist+=Math.hypot(m.history[i].x-m.history[i-1].x,m.history[i].y-m.history[i-1].y);
    if(dist>m.tailMax) break; pts.push(m.history[i]);
  }
  const N=pts.length; if(N<2) return;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for (let i=1;i<N;i++) {
    const t=i/(N-1), te=Math.pow(t,0.55);
    const a=eb*(1-te)*0.11; if(a<0.004) continue;
    const w=m.headR*(1-te*0.86)*9;
    const col=lerpC(m.sp.coma,m.sp.trail,te);
    ctx.beginPath(); ctx.moveTo(pts[i-1].x,pts[i-1].y); ctx.lineTo(pts[i].x,pts[i].y);
    ctx.strokeStyle=rgba(col[0],col[1],col[2],a); ctx.lineWidth=w; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation='screen';
  for (let i=1;i<N;i++) {
    const t=i/(N-1), te=Math.pow(t,0.65);
    const a=eb*(1-te)*0.26; if(a<0.005) continue;
    const w=Math.max(m.headR*(1-te*0.90)*4.2,0.28);
    const col=lerpC(m.sp.plasma,m.sp.trail,te);
    ctx.beginPath(); ctx.moveTo(pts[i-1].x,pts[i-1].y); ctx.lineTo(pts[i].x,pts[i].y);
    ctx.strokeStyle=rgba(col[0],col[1],col[2],a); ctx.lineWidth=w; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
  for (let i=1;i<N;i++) {
    const t=i/(N-1), te=Math.pow(t,0.72);
    const a=eb*Math.pow(1-te,1.35)*0.92; if(a<0.006) continue;
    const w=Math.max(m.headR*(1-te*0.95),0.22);
    const col=t<0.5 ? lerpC(m.sp.head,m.sp.plasma,t*2) : lerpC(m.sp.plasma,m.sp.trail,(t-0.5)*2);
    ctx.beginPath(); ctx.moveTo(pts[i-1].x,pts[i-1].y); ctx.lineTo(pts[i].x,pts[i].y);
    ctx.strokeStyle=rgba(col[0],col[1],col[2],a); ctx.lineWidth=w; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
  }
  const hx=m.history[0].x, hy=m.history[0].y;
  if (m.entryFlash>0) {
    const ef=m.entryFlash, er=m.headR*(4+ef*9);
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,er);
    g.addColorStop(0,rgba(255,255,255,ef*0.88)); g.addColorStop(0.3,rgba(255,255,255,ef*0.4)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(hx,hy,er,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  const fr=m.headR*clamp(m.bright,1,4.5);
  { const g=ctx.createRadialGradient(hx,hy,0,hx,hy,fr);
    g.addColorStop(0,rgba(255,255,255,eb)); g.addColorStop(0.35,rgba(255,255,255,eb*0.9)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(hx,hy,fr,0,TAU); ctx.fillStyle=g; ctx.fill(); }
  { const hr=fr*5.2, cc=m.sp.coma;
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,hr);
    g.addColorStop(0,rgba(cc[0],cc[1],cc[2],eb*0.72)); g.addColorStop(0.4,rgba(cc[0],cc[1],cc[2],eb*0.25)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fillStyle=g; ctx.fill(); }
  if (m.headR>1.8 && eb>0.35) {
    const a=Math.atan2(m.vy,m.vx), sl=fr*12*eb;
    ctx.save(); ctx.translate(hx,hy); ctx.rotate(a);
    const sg=ctx.createLinearGradient(0,0,sl,0);
    sg.addColorStop(0,rgba(255,255,255,eb*0.82)); sg.addColorStop(0.6,rgba(255,255,255,eb*0.18)); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(sl,0);
    ctx.strokeStyle=sg; ctx.lineWidth=fr*0.55; ctx.lineCap='round'; ctx.stroke();
    ctx.restore();
  }
  for (const s of m.sparkles) {
    if(s.life<=0) continue;
    const sa=clamp(s.life*0.9,0,1);
    const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*5);
    g.addColorStop(0,rgba(s.col[0],s.col[1],s.col[2],sa*0.42)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r*5,0,TAU); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU); ctx.fillStyle=rgba(s.col[0],s.col[1],s.col[2],sa); ctx.fill();
  }
}

// ─── SUPERNOVA ────────────────────────────────────────────────────────────────
function makeExplosion(x,y) {
  const debris=Array.from({length:130},()=>{
    const a=Math.random()*TAU, spd=0.7+Math.pow(Math.random(),1.7)*15, mass=Math.random();
    return {x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:0.65+Math.random()*1.1,
      decay:0.004+Math.random()*0.008, r:0.4+Math.pow(1-mass,2)*3.6,
      col:lerpC([255,255,255],[205,218,255],mass), grav:0.007+Math.random()*0.022,
      drag:0.974+Math.random()*0.018, streak:spd>5.5};
  });
  const rings=[
    {r:2,maxR:320+Math.random()*110,life:1,decay:.008, col:[255,255,255],lw:2.8},
    {r:2,maxR:178+Math.random()*65, life:1,decay:.013, col:[218,228,255],lw:1.6},
    {r:2,maxR:520+Math.random()*100,life:.6,decay:.005,col:[255,255,255],lw:0.9},
    {r:2,maxR:90+Math.random()*42,  life:1,decay:.021, col:[255,255,255],lw:3.5},
  ];
  const remnant=Array.from({length:38},()=>{
    const a=Math.random()*TAU, spd=0.12+Math.random()*0.85;
    return {x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:0,maxLife:0.55+Math.random()*0.45,
      startDelay:0.28+Math.random()*0.52, decay:0.0017+Math.random()*0.0024,
      r:8+Math.random()*28, col:lerpC([195,210,255],[158,178,228],Math.random())};
  });
  return {x,y,debris,rings,remnant,phase:0,phaseTime:0,nova:2.3,novaPeak:2.3,
    col:[218,228,255],active:true, fireball:{r:0,maxR:88+Math.random()*42,life:1,decay:.017}};
}
function stepExplosion(e) {
  e.phaseTime+=0.013; if(e.nova>0) e.nova-=0.009;
  const fb=e.fireball; if(fb.life>0){fb.r+=(fb.maxR-fb.r)*0.08; fb.life-=fb.decay;}
  for(const r of e.rings){if(r.life<=0)continue; r.r+=r.maxR/65; r.life-=r.decay;}
  for(let i=e.debris.length-1;i>=0;i--){
    const d=e.debris[i]; d.vx*=d.drag; d.vy*=d.drag; d.vy+=d.grav; d.x+=d.vx; d.y+=d.vy; d.life-=d.decay;
    if(d.life<=0) e.debris.splice(i,1);
  }
  for(const n of e.remnant){
    if(e.phaseTime<n.startDelay) continue; n.x+=n.vx; n.y+=n.vy;
    if(n.life<n.maxLife) n.life=Math.min(n.maxLife,n.life+0.022); else n.life=Math.max(0,n.life-n.decay);
  }
  e.active=e.nova>-0.5||e.debris.length>0||e.rings.some(r=>r.life>0)||fb.life>0||e.remnant.some(n=>n.life>0);
}
function drawExplosion(ctx,e) {
  const {x,y}=e;
  if(e.nova>0){
    const na=clamp(e.nova/e.novaPeak,0,1), age=e.novaPeak-e.nova;
    for(const[sz,al,col]of[[9+age*20,na*1.0,[255,255,255]],[28+age*58,na*.85,[255,255,255]],[88+age*125,na*.54,e.col],[225+age*165,na*.27,e.col],[400+age*110,na*.11,e.col]]){
      const g=ctx.createRadialGradient(x,y,0,x,y,sz);
      g.addColorStop(0,rgba(col[0],col[1],col[2],al)); g.addColorStop(0.32,rgba(col[0],col[1],col[2],al*.58)); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(x,y,sz,0,TAU); ctx.fillStyle=g; ctx.fill();
    }
  }
  const fb=e.fireball;
  if(fb.life>0&&fb.r>1){
    const fa=clamp(fb.life,0,1);
    const g1=ctx.createRadialGradient(x,y,0,x,y,fb.r);
    g1.addColorStop(0,rgba(255,255,255,fa*.9)); g1.addColorStop(.2,rgba(255,255,255,fa*.7)); g1.addColorStop(.6,rgba(e.col[0],e.col[1],e.col[2],fa*.48)); g1.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x,y,fb.r,0,TAU); ctx.fillStyle=g1; ctx.fill();
  }
  for(const n of e.remnant){
    if(n.life<=0) continue;
    const na=clamp(n.life*0.55,0,0.20);
    const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r);
    g.addColorStop(0,rgba(n.col[0],n.col[1],n.col[2],na)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
  ctx.save();
  for(const r of e.rings){
    if(r.life<=0||r.r<1) continue; const ra=clamp(r.life,0,1);
    ctx.beginPath(); ctx.arc(x,y,r.r,0,TAU); ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.20); ctx.lineWidth=r.lw*ra*9; ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,r.r,0,TAU); ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.95); ctx.lineWidth=r.lw*ra; ctx.stroke();
  }
  ctx.restore();
  for(const d of e.debris){
    if(d.life<=0) continue; const da=clamp(d.life*.9,0,1);
    if(d.streak&&Math.hypot(d.vx,d.vy)>1.5){
      ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.vx*5.5,d.y-d.vy*5.5);
      ctx.strokeStyle=rgba(d.col[0],d.col[1],d.col[2],da*.8); ctx.lineWidth=d.r*.72; ctx.lineCap='round'; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,TAU); ctx.fillStyle=rgba(d.col[0],d.col[1],d.col[2],da); ctx.fill();
    const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*5);
    g.addColorStop(0,rgba(d.col[0],d.col[1],d.col[2],da*.46)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r*5,0,TAU); ctx.fillStyle=g; ctx.fill();
  }
}

// ─── SHOWER PATTERNS ─────────────────────────────────────────────────────────
function showerSingle(W,H){ return [{meteor:makeMeteor(W,H),delayMs:0}]; }
function showerParallel(W,H){
  const n=3+Math.floor(Math.random()*3), goR=Math.random()>.5, ang=(18+Math.random()*34)*Math.PI/180;
  const bY=H*(0.03+Math.random()*.22), sp=25+Math.random()*65, bSpd=8+Math.random()*11;
  return Array.from({length:n},(_,i)=>({meteor:makeMeteor(W,H,{goRight:goR,ang,speed:bSpd*(.82+Math.random()*.35),y:bY+i*sp+(Math.random()-.5)*16,headR:1.1+Math.random()*2.0}),delayMs:i*(60+Math.random()*150)}));
}
function showerRadial(W,H){
  const n=4+Math.floor(Math.random()*4), cx=W*(.22+Math.random()*.56), cy=H*(.02+Math.random()*.12);
  return Array.from({length:n},(_,i)=>{
    const deg=-42+(i/(n-1))*84+(Math.random()-.5)*14, ar=deg*Math.PI/180, spd=8+Math.random()*12;
    const m=makeMeteor(W,H,{headR:1.3+Math.random()*2.4,decay:.005+Math.random()*.008});
    m.x=cx+(Math.random()-.5)*35; m.y=cy+(Math.random()-.5)*25;
    m.vx=Math.sin(ar)*spd; m.vy=Math.abs(Math.cos(ar)*spd*.8)+0.5;
    return {meteor:m,delayMs:i*(42+Math.random()*110)};
  });
}
function showerVformation(W,H){
  const n=3+Math.floor(Math.random()*2), out=[];
  for(let i=0;i<n;i++){
    out.push({meteor:makeMeteor(W,H,{goRight:true,x:-30-i*28,y:H*(.03+i*.072),speed:9+Math.random()*9,headR:1.2+Math.random()*1.7}),delayMs:i*125});
    out.push({meteor:makeMeteor(W,H,{goRight:false,x:W+30+i*28,y:H*(.03+i*.072),speed:9+Math.random()*9,headR:1.2+Math.random()*1.7}),delayMs:i*125+62});
  }
  return out;
}
function showerCluster(W,H){
  const n=4+Math.floor(Math.random()*5), cx=W*(.10+Math.random()*.80), cy=H*(.01+Math.random()*.18);
  return Array.from({length:n},()=>{
    const goR=cx<W/2?Math.random()>.18:Math.random()<.18;
    const m=makeMeteor(W,H,{headR:.8+Math.random()*1.8,speed:10+Math.random()*15,goRight:goR});
    m.x=cx+(Math.random()-.5)*120; m.y=cy+(Math.random()-.5)*50; if(m.vy<0) m.vy*=-1;
    return {meteor:m,delayMs:Math.random()*700};
  });
}
function showerRandom(W,H){
  const fns=[showerSingle,showerSingle,showerSingle,showerParallel,showerRadial,showerVformation,showerCluster];
  return fns[Math.floor(Math.random()*fns.length)](W,H);
}

// ─── SATELLITE ────────────────────────────────────────────────────────────────
function makeSatellite(W,H){
  const fl=Math.random()>.5; const y=H*(.08+Math.random()*.6); const spd=.32+Math.random()*.58;
  return {x:fl?-8:W+8,y,vx:fl?spd:-spd,vy:(Math.random()-.5)*.11,r:.85+Math.random()*.65,
    flash:0,flashFrame:0,flashInterval:85+Math.random()*130,dead:false,W,H};
}
function stepSatellite(sat){
  sat.x+=sat.vx; sat.y+=sat.vy; sat.flashFrame++;
  if(sat.flashFrame>sat.flashInterval){sat.flashFrame=0;sat.flash=1;}
  if(sat.flash>0) sat.flash=Math.max(0,sat.flash-.075);
  if(sat.x<-20||sat.x>sat.W+20||sat.y<-20||sat.y>sat.H+20) sat.dead=true;
}
function drawSatellite(ctx,sat){
  const a=.52+sat.flash*.48, r=sat.r*(1+sat.flash*1.6);
  ctx.beginPath(); ctx.arc(sat.x,sat.y,r,0,TAU); ctx.fillStyle=rgba(255,255,255,a); ctx.fill();
  if(a>.28){const g=ctx.createRadialGradient(sat.x,sat.y,0,sat.x,sat.y,r*4.5);
    g.addColorStop(0,rgba(255,255,255,a*.3)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(sat.x,sat.y,r*4.5,0,TAU); ctx.fillStyle=g; ctx.fill();}
}

function drawVignette(ctx,W,H){
  const g=ctx.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.26,W*.5,H*.5,Math.max(W,H)*.84);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.78)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function drawAirglow(ctx,W,H){
  const g=ctx.createLinearGradient(0,H*.76,0,H);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.4,'rgba(20,55,30,.020)'); g.addColorStop(1,'rgba(10,30,16,.030)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StarBackground({ fixed=true, starCount=null }) {
  const canvasRef = useRef(null);
  const tier      = useMemo(() => detectTier(), []);
  const cfg       = TIER_CFG[tier];
  const count     = starCount ?? cfg.stars;

  const layers = useMemo(() => [
    Array.from({length:Math.floor(count*0.28)}, ()=>makeStar(0)),
    Array.from({length:Math.floor(count*0.42)}, ()=>makeStar(1.2)),
    Array.from({length:Math.floor(count*0.30)}, ()=>makeStar(2.4)),
  ], [count]);

  const mwStars = useMemo(() => buildMWStars(cfg.mwStars), [cfg.mwStars]);
  const mwDust  = useMemo(() => buildMWDust(), []);

  useEffect(() => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx    = canvas.getContext('2d');

    let raf=null, meteors=[], explosions=[], lastTs=0, eggFired=false;
    let nextShowerMs=2800+Math.random()*3800, showerAccumMs=0;
    let satellite=null, nextSatMs=42000+Math.random()*95000, satAccumMs=0;
    let isScrolling=false, scrollTimer=null;
    const minFrameMs = cfg.targetFPS >= 60 ? 0 : 1000/cfg.targetFPS;
    let lastDrawTs=0;
    let mwCanvas=null, mwW=0, mwH=0;
    const sessionStart=performance.now();

    const onScroll=()=>{ isScrolling=true; clearTimeout(scrollTimer); scrollTimer=setTimeout(()=>{ isScrolling=false; },150); };
    window.addEventListener('scroll',onScroll,{passive:true});

    function resize(){
      canvas.width =canvas.offsetWidth;
      canvas.height=canvas.offsetHeight;
      if(canvas.width!==mwW||canvas.height!==mwH){
        mwW=canvas.width; mwH=canvas.height;
        requestAnimationFrame(()=>{
          mwCanvas=renderMWOffscreen(mwW,mwH,mwStars,mwDust,cfg.mwGlow,cfg.mwDust);
        });
      }
    }

    function addShower(entries){
      for(const{meteor,delayMs}of entries){
        if(delayMs<=0) meteors.push(meteor);
        else setTimeout(()=>{if(canvas)meteors.push(meteor);},delayMs);
      }
    }

    function pickBrightStar(W,H){
      const pool=layers[0].filter(s=>s.cls==='A'&&s.xr>.15&&s.xr<.85&&s.yr>.10&&s.yr<.78);
      if(!pool.length) return {x:W*.5,y:H*.3};
      const s=pool[Math.floor(Math.random()*pool.length)];
      return {x:s.xr*W,y:s.yr*H};
    }

    function triggerEgg(W,H){
      eggFired=true;
      const target=pickBrightStar(W,H);
      const{x:tx,y:ty}=target;
      const fromLeft=tx>W/2;
      const startX=fromLeft?-55:W+55, startY=Math.max(18,ty-145-Math.random()*90);
      const angle=Math.atan2(ty-startY,tx-startX), speed=8+Math.random()*6;
      const m=makeMeteor(W,H,{headR:3.8+Math.random()*2.0,decay:0.0015,isEgg:true,target});
      m.x=startX; m.y=startY; m.vx=Math.cos(angle)*speed; m.vy=Math.sin(angle)*speed; m.history=[];
      meteors.push(m);
    }

    window.__starExplosion=()=>{eggFired=false;triggerEgg(canvas.width,canvas.height);};
    window.__starShower=(p)=>{
      const W=canvas.width,H=canvas.height;
      const map={parallel:showerParallel,radial:showerRadial,vformation:showerVformation,cluster:showerCluster};
      addShower((p&&map[p]?map[p]:showerRandom)(W,H));
    };
    window.__tier=()=>console.log(`Device tier: ${tier} (0=low,1=mid,2=high)`);
    console.log(`%c✨ StarBG v7 | tier=${tier} | stars=${count} | mwStars=${cfg.mwStars}`,'color:#adf;font-size:11px');

    function tick(ts){
      if(ts-lastDrawTs < minFrameMs){raf=requestAnimationFrame(tick);return;}
      // While scrolling, skip canvas redraws so iOS compositor can use its
      // fast off-thread scroll path. Stars are frozen but imperceptible.
      if(isScrolling){lastTs=ts; raf=requestAnimationFrame(tick); return;}
      const dt=Math.min(ts-lastTs,50); lastTs=ts; lastDrawTs=ts;
      showerAccumMs+=dt; satAccumMs+=dt;
      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H);
      const t=ts*.001;

      drawMilkyWay(ctx,mwCanvas,mwStars,W,H,t,cfg.mwAnimStars);

      for(let li=layers.length-1;li>=0;li--){
                for(const s of layers[li]){
          const sx=s.xr*W+Math.sin(t*.030+s.to0)*.5*(li+1);
          const sy=s.yr*H+Math.cos(t*.024+s.to0)*.35*(li+1);
          const margin=s.cls==='A'?65:s.cls==='B'?32:12;
          if(sx<-margin||sx>W+margin||sy<-margin||sy>H+margin) continue;
          if(!s.winking){
            s.winkNext--;
            if(s.winkNext<=0){s.winking=true;s.winkTimer=0;s.winkDur=80+Math.random()*220;s.winkNext=250+Math.random()*950;}
          } else {s.winkTimer++;if(s.winkTimer>=s.winkDur)s.winking=false;}
          const wm=s.winking ? clamp(Math.sin(s.winkTimer/s.winkDur*Math.PI),0,1) : 1;
          if(wm<0.01) continue;
          const atm=0.45+s.yr*0.85;
          const sc0=0.5+0.5*Math.sin(t*s.ts0*atm+s.to0);
          const sc1=0.5+0.5*Math.sin(t*s.ts1*atm+s.to1);
          const sc2=0.5+0.5*Math.sin(t*s.ts2*atm+s.to2);
          const scint=clamp((sc0*.50+sc1*.32+sc2*.18)*wm,0,1);
          const horizFade=clamp(1-(s.yr-0.74)*4.5,0.12,1);
          const magAdj=s.mag+(1-horizFade)*2.8;
          const savedMag=s.mag; s.mag=magAdj;
          drawStar(ctx,s,sx,sy,scint,cfg.drawSpikes);
          s.mag=savedMag;
        }
      }

      drawAirglow(ctx,W,H);

      // Skip satellites on low tier
      if(tier>0){
        if(satAccumMs>=nextSatMs){satAccumMs=0;nextSatMs=48000+Math.random()*105000;satellite=makeSatellite(W,H);}
        if(satellite){stepSatellite(satellite);drawSatellite(ctx,satellite);if(satellite.dead)satellite=null;}
      }

      if(showerAccumMs>=nextShowerMs){
        showerAccumMs=0; nextShowerMs=3000+Math.random()*6200;
        addShower(showerRandom(W,H));
      }

      if(!eggFired&&performance.now()-sessionStart>=5*60*1000) triggerEgg(W,H);

      for(let i=meteors.length-1;i>=0;i--){
        const m=meteors[i];
        stepMeteor(m,meteors,W,H,cfg);
        if(m.isEgg&&m.target&&m.history.length>5&&dist2(m.x,m.y,m.target.x,m.target.y)<32*32){
          explosions.push(makeExplosion(m.target.x,m.target.y));
          meteors.splice(i,1); continue;
        }
        if(m.life<=0||m.x<-700||m.x>W+700||m.y<-600||m.y>H+600){meteors.splice(i,1);continue;}
        drawMeteor(ctx,m);
      }

      for(let i=explosions.length-1;i>=0;i--){
        stepExplosion(explosions[i]); drawExplosion(ctx,explosions[i]);
        if(!explosions[i].active) explosions.splice(i,1);
      }

      drawVignette(ctx,W,H);
      raf=requestAnimationFrame(tick);
    }

    resize();
    lastTs=performance.now();
    raf=requestAnimationFrame(tick);
    const ro=new ResizeObserver(resize); ro.observe(canvas);

    return ()=>{
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('scroll',onScroll);
      delete window.__starExplosion; delete window.__starShower; delete window.__tier;
    };
  },[layers,mwStars,mwDust,cfg,tier]);

  const style = {position:fixed?'fixed':'absolute',top:0,left:0,right:0,bottom:fixed?0:undefined,height:fixed?'100%':'100vh',pointerEvents:'none',zIndex:0,background:'#000',transform:'translateZ(0)',WebkitTransform:'translateZ(0)',willChange:'transform',backfaceVisibility:'hidden',WebkitBackfaceVisibility:'hidden'};

  return <canvas ref={canvasRef} style={style} />;
}
