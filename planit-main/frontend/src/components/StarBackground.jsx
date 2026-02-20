import { useEffect, useRef, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// STAR BACKGROUND v4 — HYPER REALISTIC / OLED BLACK
//
// Enhancements:
//   1. Milky Way band            — faint diagonal star-density smear
//   2. Atmospheric extinction    — stars dim + warm near horizon
//   3. Parallax scroll           — depth layers drift on scroll
//   4. Realistic twinkle         — position-based scintillation cadence
//   5. Star wink-out             — rare occultation events
//   6. Satellite pass            — straight-line dot, no trail
//   7. Meteor entry flash        — ignition burst on spawn
//   8. Meteor fragmentation      — splits into pieces mid-flight
//   + Terminal flare             — meteors pop at end instead of fading
//   + Supernova overhaul         — multi-phase physically-based explosion
//   + Vignette                   — OLED edge darkening
//   + Nebula slow drift          — imperceptibly slow cloud movement
//
// Console commands:
//   window.__starExplosion()            — egg meteor → star → supernova
//   window.__starShower('parallel')     — parallel barrage
//   window.__starShower('radial')       — fan burst
//   window.__starShower('vformation')   — V-formation
//   window.__starShower('cluster')      — dense cluster
//   window.__starShower()               — random
// ─────────────────────────────────────────────────────────────────────────────

const TRAIL_LENGTH = 160;

// Pure white — no colour tinting so background stays neutral
const SPECTRAL = [
  { head:[255,255,255], mid:[235,240,255], tail:[190,200,230], corona:[225,230,255] },
  { head:[255,255,255], mid:[240,240,255], tail:[200,205,235], corona:[230,235,255] },
];

function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function rgba(r,g,b,a){ return `rgba(${r|0},${g|0},${b|0},${clamp(a,0,1).toFixed(3)})`; }
function lerpC(a,b,t){ return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]; }
function dist2(ax,ay,bx,by){ return (ax-bx)**2+(ay-by)**2; }
function easeOut(t,p=2){ return 1-Math.pow(1-clamp(t,0,1),p); }
function easeIn(t,p=2){ return Math.pow(clamp(t,0,1),p); }

// ─── METEOR ───────────────────────────────────────────────────────────────────
function makeMeteor(W, H, opts={}) {
  const sp = SPECTRAL[Math.floor(Math.random()*SPECTRAL.length)];
  const goRight = opts.goRight ?? (Math.random()>0.5);
  const speed   = opts.speed  ?? (7+Math.random()*14);
  const ang     = opts.ang    ?? ((15+Math.random()*42)*Math.PI/180);

  const vx = (goRight?1:-1)*Math.cos(ang)*speed;
  const vy = Math.sin(ang)*speed;

  const x = opts.x ?? (goRight ? -30 : W+30);
  const y = opts.y ?? H*(0.02+Math.random()*0.42);
  const headR = opts.headR ?? (1.2+Math.random()*2.4);

  const flares = Math.random()<0.65
    ? Array.from({length: Math.random()<0.4?2:1}, ()=>({
        t:0.12+Math.random()*0.55, mag:2+Math.random()*3,
        dur:0.06+Math.random()*0.09, fired:false, active:false, prog:0
      }))
    : [];

  // Enhancement 8: fragmentation parameters
  const canFragment = (opts.isFragment !== true) && Math.random() < 0.18;
  const fragmentAt  = 0.35 + Math.random()*0.35;

  return {
    x, y,
    vx: opts.vx ?? vx,
    vy: opts.vy ?? vy,
    headR, sp,
    tailLen: 200+Math.random()*320,
    life: 1,
    decay: opts.decay ?? (0.005+Math.random()*0.008),
    drag: 0.9984+Math.random()*0.001,
    bright: 1, flares,
    sparkles: [], nextSpark: 0,
    history: [],
    target: opts.target ?? null,
    isEgg:      opts.isEgg      ?? false,
    isFragment: opts.isFragment ?? false,
    canFragment,
    fragmentAt,
    fragmented: false,
    // Enhancement 7: entry flash
    entryFlash: 1.0,
    entryDecay: 0.07+Math.random()*0.05,
    // Terminal flare
    terminalFired: false,
  };
}

function stepMeteor(m, meteors, W, H) {
  m.vx *= m.drag; m.vy *= m.drag;
  m.x  += m.vx;  m.y  += m.vy;
  m.history.unshift({x:m.x, y:m.y});
  if(m.history.length > TRAIL_LENGTH) m.history.pop();

  // Enhancement 7: entry flash decay
  if(m.entryFlash > 0) m.entryFlash = Math.max(0, m.entryFlash - m.entryDecay);

  m.life -= m.decay;
  const lf = 1-m.life;

  m.bright = 1;
  for(const f of m.flares){
    if(!f.fired && lf>=f.t){ f.fired=true; f.active=true; f.prog=0; }
    if(f.active){
      f.prog += m.decay/f.dur;
      const e = f.prog<0.4 ? f.prog/0.4 : 1-(f.prog-0.4)/0.6;
      m.bright = Math.max(m.bright, 1+(f.mag-1)*Math.max(0,e));
      if(f.prog>=1) f.active=false;
    }
  }

  // Enhancement 8: fragmentation
  if(m.canFragment && !m.fragmented && lf >= m.fragmentAt){
    m.fragmented = true;
    const pieces = 2+Math.floor(Math.random()*2);
    const speed  = Math.hypot(m.vx, m.vy);
    for(let i=0; i<pieces; i++){
      const spreadAng = (Math.random()-.5)*0.45;
      const curAng    = Math.atan2(m.vy, m.vx);
      const fragSpd   = speed*(0.55+Math.random()*0.35);
      const frag = makeMeteor(W, H, {
        x: m.x, y: m.y,
        vx: Math.cos(curAng+spreadAng)*fragSpd,
        vy: Math.sin(curAng+spreadAng)*fragSpd,
        headR: m.headR*(0.35+Math.random()*0.3),
        decay: m.decay*(1.3+Math.random()*0.6),
        isFragment: true,
      });
      frag.life     = m.life*(0.55+Math.random()*0.3);
      frag.entryFlash = 0.6;
      meteors.push(frag);
    }
    // Parent fades after splitting
    m.decay *= 1.8;
  }

  if(--m.nextSpark <= 0){
    m.nextSpark = 2+Math.floor(Math.random()*3);
    const spd = Math.hypot(m.vx,m.vy);
    m.sparkles.push({
      x: m.x+(Math.random()-.5)*spd*.45,
      y: m.y+(Math.random()-.5)*spd*.45,
      life: .65+Math.random()*.45,
      decay: .016+Math.random()*.028,
      r: .35+Math.random()*.95,
      col: lerpC(m.sp.mid, m.sp.tail, Math.random())
    });
  }
  for(let i=m.sparkles.length-1; i>=0; i--){
    m.sparkles[i].life -= m.sparkles[i].decay;
    if(m.sparkles[i].life<=0) m.sparkles.splice(i,1);
  }
}

function drawMeteor(ctx, m) {
  if(m.history.length<2) return;
  const eb = clamp(m.bright*m.life, 0, 1);

  // Build visible trail
  let dist=0;
  const pts=[m.history[0]];
  for(let i=1; i<m.history.length; i++){
    dist += Math.hypot(m.history[i].x-m.history[i-1].x, m.history[i].y-m.history[i-1].y);
    if(dist>m.tailLen) break;
    pts.push(m.history[i]);
  }
  const N=pts.length;

  // Draw tail back→front with enhanced glow layers
  for(let i=N-1; i>=0; i--){
    const t  = i/Math.max(N-1,1);
    const te = Math.pow(t, 0.6);
    const r  = m.headR*(1-te*.91);
    const col = t<.5 ? lerpC(m.sp.head,m.sp.mid,t*2) : lerpC(m.sp.mid,m.sp.tail,(t-.5)*2);
    const a   = eb*Math.pow(1-te,1.4)*.97;
    if(a<.004||r<.09) continue;

    // Outer diffuse glow along trail
    if(i < N*.4 && r>.45){
      const gr = r*5.5;
      const g  = ctx.createRadialGradient(pts[i].x,pts[i].y,0, pts[i].x,pts[i].y,gr);
      g.addColorStop(0, rgba(col[0],col[1],col[2],a*.32));
      g.addColorStop(1, rgba(col[0],col[1],col[2],0));
      ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,gr,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,r,0,Math.PI*2);
    ctx.fillStyle=rgba(col[0],col[1],col[2],a); ctx.fill();
  }

  const hx=m.history[0].x, hy=m.history[0].y;

  // Enhancement 7: entry flash bloom at head
  if(m.entryFlash > 0){
    const ef = m.entryFlash;
    const er = m.headR*(3+ef*8);
    const g  = ctx.createRadialGradient(hx,hy,0,hx,hy,er);
    g.addColorStop(0, rgba(255,255,255,ef*.9));
    g.addColorStop(.3,rgba(255,255,255,ef*.5));
    g.addColorStop(1, rgba(255,255,255,0));
    ctx.beginPath(); ctx.arc(hx,hy,er,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }

  const fr=m.headR*clamp(m.bright,1,4);

  // Nucleus — tight bright core
  { const g=ctx.createRadialGradient(hx,hy,0,hx,hy,fr);
    g.addColorStop(0,  rgba(255,255,255,eb));
    g.addColorStop(.4, rgba(255,255,255,eb*.9));
    g.addColorStop(1,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,fr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); }

  // Inner halo
  { const hr=fr*5;
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,hr);
    g.addColorStop(0,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],eb*.75));
    g.addColorStop(.45,rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],eb*.28));
    g.addColorStop(1,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); }

  // Outer corona
  const cs = clamp((m.bright-1)*.65+(m.headR-1.5)*.28, 0, 1);
  if(cs>.03){
    const cr=fr*13;
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,cr);
    g.addColorStop(0, rgba(m.sp.corona[0],m.sp.corona[1],m.sp.corona[2],cs*eb*.45));
    g.addColorStop(1, rgba(m.sp.corona[0],m.sp.corona[1],m.sp.corona[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,cr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }

  // Sparkles
  for(const s of m.sparkles){
    if(s.life<=0) continue;
    const sa=clamp(s.life*.92,0,1);
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=rgba(s.col[0],s.col[1],s.col[2],sa); ctx.fill();
    if(s.r>.5){
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*4);
      g.addColorStop(0, rgba(s.col[0],s.col[1],s.col[2],sa*.38));
      g.addColorStop(1, rgba(s.col[0],s.col[1],s.col[2],0));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r*4,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
  }
}

// ─── SUPERNOVA (complete overhaul) ────────────────────────────────────────────
// Multi-phase physically-based explosion:
//   Phase 1: Ignition flash (0–0.12)  — instantaneous white-hot core blowout
//   Phase 2: Fireball expansion (0–0.35) — hot plasma sphere expanding
//   Phase 3: Ejecta ring (0.1–0.7)    — fast-moving shock rings
//   Phase 4: Debris cloud (0–1.0)     — hundreds of particles
//   Phase 5: Remnant nebula (0.5–2.0) — slow glowing gas cloud
function makeExplosion(x, y) {
  // Debris — 120 particles with realistic mass distribution
  const debris = Array.from({length:120}, ()=>{
    const ang = Math.random()*Math.PI*2;
    const spd = 0.8+Math.pow(Math.random(),1.8)*14;
    const mass = Math.random();
    const c = lerpC([255,255,255],[210,220,255],mass);
    return {
      x, y,
      vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
      life: 0.7+Math.random()*1.1,
      decay: 0.004+Math.random()*0.009,
      r: 0.4+Math.pow(1-mass,2)*3.5,
      col: c,
      grav: 0.008+Math.random()*0.025,
      drag: 0.975+Math.random()*0.018,
      streak: spd>6,
    };
  });

  // Shock rings — 4 rings at different speeds
  const rings = [
    {r:2, maxR:320+Math.random()*100, life:1, decay:.009, col:[255,255,255], lw:2.8},
    {r:2, maxR:180+Math.random()*60,  life:1, decay:.014, col:[220,230,255], lw:1.6},
    {r:2, maxR:500+Math.random()*100, life:.6,decay:.006, col:[255,255,255], lw:0.9},
    {r:2, maxR:90+Math.random()*40,   life:1, decay:.022, col:[255,255,255], lw:3.5},
  ];

  // Remnant nebula particles (slow, large, long-lived)
  const remnant = Array.from({length:35}, ()=>{
    const ang = Math.random()*Math.PI*2;
    const spd = 0.15+Math.random()*0.8;
    return {
      x, y,
      vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
      life: 0, maxLife: 0.6+Math.random()*0.4,
      startDelay: 0.3+Math.random()*0.5,
      decay: 0.0018+Math.random()*0.0025,
      r: 8+Math.random()*28,
      col: lerpC([200,215,255],[160,180,230],Math.random()),
    };
  });

  return {
    x, y, debris, rings, remnant,
    phase: 0,        // 0–1 overall progress
    phaseTime: 0,
    nova: 2.2, novaPeak: 2.2,
    col: [220,230,255],
    active: true,
    // Fireball
    fireball: { r:0, maxR:85+Math.random()*40, life:1, decay:.018 },
  };
}

function stepExplosion(e) {
  e.phaseTime += 0.013;

  // Nova flash
  if(e.nova>0) e.nova -= 0.009;

  // Fireball
  const fb = e.fireball;
  if(fb.life>0){
    fb.r  += (fb.maxR - fb.r)*0.08;
    fb.life -= fb.decay;
  }

  // Rings
  for(const r of e.rings){
    if(r.life<=0) continue;
    r.r    += r.maxR/65;
    r.life -= r.decay;
  }

  // Debris
  for(let i=e.debris.length-1; i>=0; i--){
    const d=e.debris[i];
    d.vx*=d.drag; d.vy*=d.drag;
    d.vy+=d.grav;
    d.x+=d.vx; d.y+=d.vy;
    d.life-=d.decay;
    if(d.life<=0) e.debris.splice(i,1);
  }

  // Remnant nebula
  for(const n of e.remnant){
    if(e.phaseTime < n.startDelay) continue;
    n.x += n.vx; n.y += n.vy;
    if(n.life < n.maxLife) n.life = Math.min(n.maxLife, n.life + 0.025);
    else n.life = Math.max(0, n.life - n.decay);
  }

  e.active = e.nova>-0.5
    || e.debris.length>0
    || e.rings.some(r=>r.life>0)
    || fb.life>0
    || e.remnant.some(n=>n.life>0);
}

function drawExplosion(ctx, e) {
  const {x, y} = e;

  // ── Phase 1+2: Nova flash + fireball ─────────────────────────────────────
  if(e.nova>0){
    const na  = clamp(e.nova/e.novaPeak, 0, 1);
    const age = e.novaPeak-e.nova;

    // Core white-out flash — multiple layered blooms
    for(const [sz,al,col] of [
      [8+age*18,     na*1.0,  [255,255,255]],
      [25+age*55,    na*.85,  [255,255,255]],
      [80+age*110,   na*.55,  e.col],
      [200+age*150,  na*.28,  e.col],
      [380+age*100,  na*.12,  e.col],
      [600+age*60,   na*.05,  e.col],
    ]){
      const g=ctx.createRadialGradient(x,y,0,x,y,sz);
      g.addColorStop(0,  rgba(col[0],col[1],col[2],al));
      g.addColorStop(.35,rgba(col[0],col[1],col[2],al*.6));
      g.addColorStop(1,  rgba(col[0],col[1],col[2],0));
      ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
  }

  // ── Fireball ─────────────────────────────────────────────────────────────
  const fb = e.fireball;
  if(fb.life>0 && fb.r>1){
    const fa = clamp(fb.life,0,1);
    // Hot core
    const g1=ctx.createRadialGradient(x,y,0,x,y,fb.r);
    g1.addColorStop(0,  rgba(255,255,255,fa*.9));
    g1.addColorStop(.2, rgba(255,255,255,fa*.7));
    g1.addColorStop(.6, rgba(e.col[0],e.col[1],e.col[2],fa*.5));
    g1.addColorStop(1,  rgba(e.col[0],e.col[1],e.col[2],0));
    ctx.beginPath(); ctx.arc(x,y,fb.r,0,Math.PI*2); ctx.fillStyle=g1; ctx.fill();
    // Outer diffuse halo
    const g2=ctx.createRadialGradient(x,y,fb.r*.4,x,y,fb.r*2.8);
    g2.addColorStop(0, rgba(e.col[0],e.col[1],e.col[2],fa*.2));
    g2.addColorStop(1, rgba(e.col[0],e.col[1],e.col[2],0));
    ctx.beginPath(); ctx.arc(x,y,fb.r*2.8,0,Math.PI*2); ctx.fillStyle=g2; ctx.fill();
  }

  // ── Remnant nebula (drawn under rings/debris) ─────────────────────────────
  for(const n of e.remnant){
    if(n.life<=0) continue;
    const na = clamp(n.life*0.6, 0, 0.18);
    if(na<0.005) continue;
    const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r);
    g.addColorStop(0, rgba(n.col[0],n.col[1],n.col[2],na));
    g.addColorStop(1, rgba(n.col[0],n.col[1],n.col[2],0));
    ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }

  // ── Shock rings ───────────────────────────────────────────────────────────
  ctx.save();
  for(const r of e.rings){
    if(r.life<=0||r.r<1) continue;
    const ra=clamp(r.life,0,1);
    // Soft glow behind ring
    ctx.beginPath(); ctx.arc(x,y,r.r,0,Math.PI*2);
    ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.22);
    ctx.lineWidth=r.lw*ra*9; ctx.stroke();
    // Sharp ring edge
    ctx.beginPath(); ctx.arc(x,y,r.r,0,Math.PI*2);
    ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.95);
    ctx.lineWidth=r.lw*ra; ctx.stroke();
  }
  ctx.restore();

  // ── Debris ────────────────────────────────────────────────────────────────
  for(const d of e.debris){
    if(d.life<=0) continue;
    const da=clamp(d.life*.92,0,1);
    const spd=Math.hypot(d.vx,d.vy);

    // Streak for fast particles
    if(d.streak && spd>1.5){
      ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.vx*5,d.y-d.vy*5);
      ctx.strokeStyle=rgba(d.col[0],d.col[1],d.col[2],da*.8);
      ctx.lineWidth=d.r*.8; ctx.stroke();
    }

    // Core dot
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
    ctx.fillStyle=rgba(d.col[0],d.col[1],d.col[2],da); ctx.fill();

    // Soft glow around each piece
    const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*5);
    g.addColorStop(0, rgba(d.col[0],d.col[1],d.col[2],da*.5));
    g.addColorStop(1, rgba(d.col[0],d.col[1],d.col[2],0));
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r*5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }
}

// ─── SHOWER PATTERNS ─────────────────────────────────────────────────────────
function showerSingle(W,H){ return [{ meteor:makeMeteor(W,H), delayMs:0 }]; }

function showerParallel(W,H){
  const count=3+Math.floor(Math.random()*3);
  const goRight=Math.random()>.5;
  const ang=(20+Math.random()*32)*Math.PI/180;
  const baseY=H*(.04+Math.random()*.2);
  const spacing=28+Math.random()*60;
  const baseSpd=8+Math.random()*10;
  return Array.from({length:count},(_,i)=>({
    meteor:makeMeteor(W,H,{goRight,ang,speed:baseSpd*(.85+Math.random()*.3),
      y:baseY+i*spacing+(Math.random()-.5)*14, headR:1.2+Math.random()*1.9}),
    delayMs:i*(65+Math.random()*140)
  }));
}

function showerRadial(W,H){
  const count=4+Math.floor(Math.random()*3);
  const cx=W*(.25+Math.random()*.5), cy=H*(.02+Math.random()*.1);
  return Array.from({length:count},(_,i)=>{
    const deg=-38+(i/(count-1))*76+(Math.random()-.5)*12;
    const angRad=deg*Math.PI/180;
    const spd=8+Math.random()*11;
    const m=makeMeteor(W,H,{headR:1.4+Math.random()*2.2,decay:.005+Math.random()*.008});
    m.x=cx+(Math.random()-.5)*30; m.y=cy+(Math.random()-.5)*22;
    m.vx=Math.sin(angRad)*spd; m.vy=Math.abs(Math.cos(angRad)*spd*.8)+0.5;
    return {meteor:m, delayMs:i*(45+Math.random()*100)};
  });
}

function showerVformation(W,H){
  const count=3+Math.floor(Math.random()*2), out=[];
  for(let i=0;i<count;i++){
    out.push({meteor:makeMeteor(W,H,{goRight:true,x:-30-i*25,y:H*(.03+i*.07),speed:9+Math.random()*8,headR:1.3+Math.random()*1.6}),delayMs:i*120});
    out.push({meteor:makeMeteor(W,H,{goRight:false,x:W+30+i*25,y:H*(.03+i*.07),speed:9+Math.random()*8,headR:1.3+Math.random()*1.6}),delayMs:i*120+60});
  }
  return out;
}

function showerCluster(W,H){
  const count=4+Math.floor(Math.random()*4);
  const cx=W*(.1+Math.random()*.8), cy=H*(.01+Math.random()*.15);
  return Array.from({length:count},()=>{
    const goRight=cx<W/2?Math.random()>.2:Math.random()<.2;
    const m=makeMeteor(W,H,{headR:.8+Math.random()*1.7,speed:10+Math.random()*14,goRight});
    m.x=cx+(Math.random()-.5)*110; m.y=cy+(Math.random()-.5)*45;
    if(m.vy<0) m.vy*=-1;
    return {meteor:m, delayMs:Math.random()*650};
  });
}

function showerRandom(W,H){
  const fns=[showerSingle,showerSingle,showerSingle,showerParallel,showerRadial,showerVformation,showerCluster];
  return fns[Math.floor(Math.random()*fns.length)](W,H);
}

// ─── STARS ────────────────────────────────────────────────────────────────────
function makeStarLayer(count, layer){
  return Array.from({length:count}, () => {
    const sz=Math.random();
    const bright=layer===0&&sz>.88;
    // Enhancement 5: wink-out state
    return {
      xr:Math.random(), yr:Math.random(),
      r: bright ? 1.5+Math.random()*.9
        : sz<.7  ? .13+Math.random()*.36
                 : .35+Math.random()*.52,
      baseA: layer===0 ? .55+Math.random()*.45
           : layer===1 ? .22+Math.random()*.32
                       : .07+Math.random()*.18,
      ts: .12+Math.random()*1.1,
      to: Math.random()*Math.PI*2,
      tint:[255,255,255],
      bright,
      ox:0, oy:0,
      // Wink state
      winking: false,
      winkTimer: 0,
      winkDur: 0,
      winkNext: 60+Math.random()*400,
    };
  });
}

// ─── MILKY WAY BAND ───────────────────────────────────────────────────────────
// Enhancement 1: Pre-compute a band of micro-star density
function makeMilkyWay(count=420){
  const stars=[];
  for(let i=0;i<count;i++){
    // Band runs diagonally — parametric position along band + scatter
    const t=Math.random();
    const bandX=0.08+t*0.84;
    const bandY=0.75-t*0.55; // diagonal from bottom-left to top-right
    const scatter=( Math.random()-.5)*0.22*(1+Math.abs(t-.5)*0.5);
    const scatter2=(Math.random()-.5)*0.06;
    stars.push({
      xr: clamp(bandX+scatter2, 0, 1),
      yr: clamp(bandY+scatter, 0, 1),
      r: .08+Math.random()*.28,
      a: .04+Math.random()*.12,
      ts: .08+Math.random()*.55,
      to: Math.random()*Math.PI*2,
    });
  }
  return stars;
}

// ─── SATELLITE ────────────────────────────────────────────────────────────────
// Enhancement 6: ISS-like straight-line slow pass
function makeSatellite(W, H){
  const fromLeft=Math.random()>.5;
  const y=H*(.08+Math.random()*.6);
  const spd=0.35+Math.random()*0.55;
  return {
    x: fromLeft?-8:W+8, y,
    vx: fromLeft?spd:-spd,
    vy: (Math.random()-.5)*0.12,
    life: 1,
    decay: 0,
    r: 0.9+Math.random()*.6,
    flash: 0, flashTimer: 0,
    flashInterval: 80+Math.random()*120, // frames between flashes
    flashFrame: 0,
    dead: false,
    W, H,
  };
}

function stepSatellite(sat){
  sat.x+=sat.vx; sat.y+=sat.vy;
  sat.flashFrame++;
  if(sat.flashFrame>sat.flashInterval){
    sat.flashFrame=0; sat.flash=1;
  }
  if(sat.flash>0) sat.flash=Math.max(0,sat.flash-.08);
  if(sat.x<-20||sat.x>sat.W+20||sat.y<-20||sat.y>sat.H+20) sat.dead=true;
}

function drawSatellite(ctx, sat){
  const a=0.55+sat.flash*.45;
  const r=sat.r*(1+sat.flash*1.5);
  ctx.beginPath(); ctx.arc(sat.x,sat.y,r,0,Math.PI*2);
  ctx.fillStyle=rgba(255,255,255,a); ctx.fill();
  if(a>.3){
    const g=ctx.createRadialGradient(sat.x,sat.y,0,sat.x,sat.y,r*4);
    g.addColorStop(0,rgba(255,255,255,a*.3)); g.addColorStop(1,rgba(255,255,255,0));
    ctx.beginPath(); ctx.arc(sat.x,sat.y,r*4,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }
}

// ─── NEBULAE ─────────────────────────────────────────────────────────────────
function makeNebulae(){
  const pals=[
    [[25,8,60],[60,4,45]],   [[6,16,58],[12,42,82]],
    [[6,38,28],[14,58,46]],  [[48,12,6],[72,28,10]], [[38,6,38],[20,6,55]],
  ];
  return Array.from({length:6},()=>{
    const p=pals[Math.floor(Math.random()*pals.length)];
    return {
      xr:.05+Math.random()*.9, yr:.05+Math.random()*.85,
      rr:.07+Math.random()*.2,
      a:.025+Math.random()*.055,
      col:lerpC(p[0],p[1],Math.random()),
      ax:.55+Math.random()*.9, ay:.55+Math.random()*.9,
      // Enhancement: slow drift
      dxr:( Math.random()-.5)*0.00003,
      dyr:(Math.random()-.5)*0.00002,
    };
  });
}

function drawNebulae(ctx,nbs,W,H){
  for(const n of nbs){
    // Enhancement: drift position
    n.xr=clamp(n.xr+n.dxr, 0.02, 0.98);
    n.yr=clamp(n.yr+n.dyr, 0.02, 0.98);
    const cx=n.xr*W, cy=n.yr*H;
    const rx=n.rr*W*n.ax, ry=n.rr*H*n.ay;
    const r=Math.max(rx,ry);
    ctx.save(); ctx.translate(cx,cy); ctx.scale(rx/r,ry/r);
    const g=ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,  rgba(n.col[0],n.col[1],n.col[2],n.a));
    g.addColorStop(.5, rgba(n.col[0],n.col[1],n.col[2],n.a*.45));
    g.addColorStop(1,  rgba(n.col[0],n.col[1],n.col[2],0));
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.restore();
  }
}

// ─── VIGNETTE ────────────────────────────────────────────────────────────────
function drawVignette(ctx, W, H){
  // Radial dark edge — OLED black corners
  const g=ctx.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.3, W*.5,H*.5,Math.max(W,H)*.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StarBackground({ fixed=true, starCount=320 }) {
  const canvasRef = useRef(null);

  const layers = useMemo(()=>[
    makeStarLayer(Math.floor(starCount*.32), 0),
    makeStarLayer(Math.floor(starCount*.42), 1),
    makeStarLayer(Math.floor(starCount*.26), 2),
  ],[starCount]);

  const nebulae    = useMemo(()=>makeNebulae(),[]);
  const milkyWay   = useMemo(()=>makeMilkyWay(),[]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext('2d');

    let raf=null, meteors=[], explosions=[], lastTs=0;
    const sessionStart=performance.now();
    let eggFired=false;
    let nextShowerMs=3000+Math.random()*3500;
    let showerAccumMs=0;

    // Enhancement 3: scroll parallax
    let scrollY=0;
    const onScroll=()=>{ scrollY=window.scrollY; };
    window.addEventListener('scroll',onScroll,{passive:true});

    // Enhancement 6: satellite state
    let satellite=null;
    let nextSatelliteMs=45000+Math.random()*90000;
    let satAccumMs=0;

    function resize(){
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function addShower(entries){
      for(const {meteor,delayMs} of entries){
        if(delayMs<=0){ meteors.push(meteor); }
        else { setTimeout(()=>{ if(canvas) meteors.push(meteor); }, delayMs); }
      }
    }

    function pickBrightStar(W,H){
      const pool=layers[0].filter(s=>s.bright&&s.xr>.18&&s.xr<.82&&s.yr>.12&&s.yr<.78);
      if(!pool.length) return {x:W*.5,y:H*.3};
      const s=pool[Math.floor(Math.random()*pool.length)];
      return {x:s.xr*W,y:s.yr*H};
    }

    function triggerEgg(W,H){
      eggFired=true;
      const target=pickBrightStar(W,H);
      const {x:tx,y:ty}=target;
      const fromLeft=tx>W/2;
      const startX=fromLeft?-50:W+50;
      const startY=Math.max(15,ty-130-Math.random()*90);
      const angle=Math.atan2(ty-startY,tx-startX);
      const speed=9+Math.random()*5;
      const m=makeMeteor(W,H,{headR:3.5+Math.random()*1.8,decay:0.0016,isEgg:true,target});
      m.x=startX; m.y=startY;
      m.vx=Math.cos(angle)*speed; m.vy=Math.sin(angle)*speed;
      m.history=[];
      meteors.push(m);
      console.log('%c☄️  Egg meteor launched!','color:#fa0;font-size:13px;font-weight:bold');
    }

    window.__starExplosion=()=>{ eggFired=false; triggerEgg(canvas.width,canvas.height); };
    window.__starShower=(pattern)=>{
      const W=canvas.width,H=canvas.height;
      const map={parallel:showerParallel,radial:showerRadial,vformation:showerVformation,cluster:showerCluster};
      addShower((pattern&&map[pattern]?map[pattern]:showerRandom)(W,H));
      console.log(`%c🌠 Shower: ${pattern||'random'}`,'color:#8df;font-size:13px');
    };

    console.log('%c✨ StarBG v4 ready — window.__starExplosion() | window.__starShower()','color:#adf;font-size:12px');

    function tick(ts){
      const dt=Math.min(ts-lastTs,50);
      lastTs=ts;
      showerAccumMs+=dt;
      satAccumMs+=dt;

      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H);

      // ── Nebulae ──────────────────────────────────────────────────────────
      drawNebulae(ctx,nebulae,W,H);

      // ── Enhancement 1: Milky Way band ────────────────────────────────────
      const t=ts*.001;
      for(const s of milkyWay){
        const sx=s.xr*W, sy=s.yr*H;
        const a=s.a*(.5+.5*Math.sin(t*s.ts+s.to));
        if(a<.008) continue;
        ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2);
        ctx.fillStyle=rgba(255,255,255,a); ctx.fill();
      }

      // ── Stars — 3 depth layers ───────────────────────────────────────────
      for(let li=layers.length-1; li>=0; li--){
        // Enhancement 3: parallax offset from scroll
        const parallaxShift=scrollY*(.0008*(li+1));

        for(const s of layers[li]){
          s.ox=Math.sin(t*.033+s.to)*.7*(li+1);
          s.oy=Math.cos(t*.026+s.to)*.45*(li+1);
          const sx=s.xr*W+s.ox;
          const sy=s.yr*H+s.oy-parallaxShift;

          // Enhancement 5: wink-out
          if(!s.winking){
            s.winkNext--;
            if(s.winkNext<=0){
              s.winking=true;
              s.winkTimer=0;
              s.winkDur=80+Math.random()*140;
              s.winkNext=200+Math.random()*600;
            }
          } else {
            s.winkTimer++;
            if(s.winkTimer>=s.winkDur) s.winking=false;
          }
          const winkMult=s.winking
            ? clamp(Math.sin(s.winkTimer/s.winkDur*Math.PI),0,1)
            : 1;

          // Enhancement 4: position-based twinkle
          // Stars lower on screen (higher yr) twinkle faster & more
          const atmosFactor=0.3+s.yr*.7;
          const twinkleA=s.baseA*(0.5+0.5*Math.sin(t*s.ts*atmosFactor+s.to));

          // Enhancement 2: atmospheric extinction near horizon
          const horizonFade=clamp(1-(s.yr-0.8)*3.5, 0.25, 1);
          const a=twinkleA*horizonFade*winkMult;

          if(s.bright&&s.r>1.5){
            // Diffraction spikes — 4+diagonal = 8 points
            const sl=s.r*10;
            ctx.save();
            ctx.strokeStyle=rgba(255,255,255,a*.4);
            ctx.lineWidth=.45;
            for(const [dx,dy] of [[1,0],[0,1],[.707,.707],[-.707,.707]]){
              ctx.beginPath(); ctx.moveTo(sx-dx*sl,sy-dy*sl); ctx.lineTo(sx+dx*sl,sy+dy*sl); ctx.stroke();
            }
            ctx.restore();
            // Bloom
            const g=ctx.createRadialGradient(sx,sy,0,sx,sy,s.r*6);
            g.addColorStop(0,rgba(255,255,255,a*.6)); g.addColorStop(1,rgba(255,255,255,0));
            ctx.beginPath(); ctx.arc(sx,sy,s.r*6,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
          }

          ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2);
          ctx.fillStyle=rgba(255,255,255,a); ctx.fill();
        }
      }

      // ── Enhancement 6: Satellite ─────────────────────────────────────────
      if(satAccumMs>=nextSatelliteMs){
        satAccumMs=0;
        nextSatelliteMs=50000+Math.random()*100000;
        satellite=makeSatellite(W,H);
      }
      if(satellite){
        stepSatellite(satellite);
        drawSatellite(ctx,satellite);
        if(satellite.dead) satellite=null;
      }

      // ── Meteor shower spawning ────────────────────────────────────────────
      if(showerAccumMs>=nextShowerMs){
        showerAccumMs=0;
        nextShowerMs=3200+Math.random()*5800;
        addShower(showerRandom(W,H));
      }

      // ── 5-min easter egg ─────────────────────────────────────────────────
      if(!eggFired&&performance.now()-sessionStart>=5*60*1000) triggerEgg(W,H);

      // ── Meteors ───────────────────────────────────────────────────────────
      for(let i=meteors.length-1;i>=0;i--){
        const m=meteors[i];
        stepMeteor(m, meteors, W, H);

        if(m.isEgg&&m.target&&m.history.length>5){
          if(dist2(m.x,m.y,m.target.x,m.target.y)<30*30){
            explosions.push(makeExplosion(m.target.x,m.target.y));
            console.log('%c💥 SUPERNOVA!','color:#f60;font-size:20px;font-weight:bold');
            meteors.splice(i,1); continue;
          }
        }

        if(m.life<=0||m.x<-600||m.x>W+600||m.y<-500||m.y>H+500){
          meteors.splice(i,1); continue;
        }
        drawMeteor(ctx,m);
      }

      // ── Explosions ────────────────────────────────────────────────────────
      for(let i=explosions.length-1;i>=0;i--){
        stepExplosion(explosions[i]);
        drawExplosion(ctx,explosions[i]);
        if(!explosions[i].active) explosions.splice(i,1);
      }

      // ── Vignette — last, on top of everything ────────────────────────────
      drawVignette(ctx,W,H);

      raf=requestAnimationFrame(tick);
    }

    resize();
    lastTs=performance.now();
    raf=requestAnimationFrame(tick);

    const ro=new ResizeObserver(resize);
    ro.observe(canvas);

    return ()=>{
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll',onScroll);
      delete window.__starExplosion;
      delete window.__starShower;
    };
  },[layers,nebulae,milkyWay]);

  const style=fixed
    ? {position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0,background:'#000'}
    : {position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',background:'#000'};

  return <canvas ref={canvasRef} style={style} />;
}
