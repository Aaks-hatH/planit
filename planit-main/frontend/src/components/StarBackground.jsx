import { useEffect, useRef, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// STAR BACKGROUND v3 — Fixed + Enhanced
//
// Console commands (open DevTools → Console tab):
//   window.__starExplosion()            — fires egg meteor → star → nova BOOM
//   window.__starShower('parallel')     — parallel barrage (like the photo)
//   window.__starShower('radial')       — fan burst from center-top
//   window.__starShower('vformation')   — V-formation from both sides
//   window.__starShower('cluster')      — dense cluster burst
//   window.__starShower()               — random pattern
// ─────────────────────────────────────────────────────────────────────────────

const TRAIL_LENGTH = 140;

const SPECTRAL = [
  { head:[255,255,255], mid:[230,235,255], tail:[180,190,220], corona:[220,225,255] },
];

function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function rgba(r,g,b,a){ return `rgba(${r|0},${g|0},${b|0},${clamp(a,0,1).toFixed(3)})`; }
function lerpC(a,b,t){ return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]; }
function dist2(ax,ay,bx,by){ return (ax-bx)**2+(ay-by)**2; }

// ─── METEOR ───────────────────────────────────────────────────────────────────
function makeMeteor(W, H, opts={}) {
  const sp = SPECTRAL[Math.floor(Math.random()*SPECTRAL.length)];
  const goRight = opts.goRight ?? (Math.random()>0.5);
  const speed   = opts.speed  ?? (7+Math.random()*12);
  const ang     = opts.ang    ?? ((18+Math.random()*38)*Math.PI/180);

  // Default vx/vy from angle — can be overridden after creation
  const vx = (goRight?1:-1)*Math.cos(ang)*speed;
  const vy = Math.sin(ang)*speed;

  const x = opts.x ?? (goRight ? -30 : W+30);
  const y = opts.y ?? H*(0.02+Math.random()*0.42);
  const headR = opts.headR ?? (1.2+Math.random()*2.2);

  const flares = Math.random()<0.6
    ? Array.from({length: Math.random()<0.4?2:1}, ()=>({
        t:0.15+Math.random()*0.55, mag:2+Math.random()*2.5,
        dur:0.07+Math.random()*0.08, fired:false, active:false, prog:0
      }))
    : [];

  return {
    x, y,
    vx: opts.vx ?? vx,
    vy: opts.vy ?? vy,
    headR, sp,
    tailLen: 200+Math.random()*280,
    life: 1,
    decay: opts.decay ?? (0.006+Math.random()*0.008),
    drag: 0.9983+Math.random()*0.0012,
    bright: 1, flares,
    sparkles: [], nextSpark: 0,
    history: [],
    target: opts.target ?? null,
    isEgg:  opts.isEgg  ?? false,
  };
}

function stepMeteor(m) {
  m.vx *= m.drag; m.vy *= m.drag;
  m.x  += m.vx;  m.y  += m.vy;
  m.history.unshift({x:m.x, y:m.y});
  if(m.history.length > TRAIL_LENGTH) m.history.pop();
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

  if(--m.nextSpark <= 0){
    m.nextSpark = 2+Math.floor(Math.random()*4);
    const spd = Math.hypot(m.vx,m.vy);
    m.sparkles.push({
      x: m.x+(Math.random()-.5)*spd*.4,
      y: m.y+(Math.random()-.5)*spd*.4,
      life: .7+Math.random()*.4,
      decay: .017+Math.random()*.025,
      r: .4+Math.random()*.9,
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

  // Draw tail back→front
  for(let i=N-1; i>=0; i--){
    const t  = i/Math.max(N-1,1);
    const te = Math.pow(t, 0.65);
    const r  = m.headR*(1-te*.89);
    const col = t<.5 ? lerpC(m.sp.head,m.sp.mid,t*2) : lerpC(m.sp.mid,m.sp.tail,(t-.5)*2);
    const a   = eb*Math.pow(1-te,1.5)*.95;
    if(a<.005||r<.1) continue;

    if(i < N*.35 && r>.5){
      const gr = r*4.5;
      const g  = ctx.createRadialGradient(pts[i].x,pts[i].y,0, pts[i].x,pts[i].y,gr);
      g.addColorStop(0, rgba(col[0],col[1],col[2],a*.28));
      g.addColorStop(1, rgba(col[0],col[1],col[2],0));
      ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,gr,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,r,0,Math.PI*2);
    ctx.fillStyle=rgba(col[0],col[1],col[2],a); ctx.fill();
  }

  const hx=m.history[0].x, hy=m.history[0].y;
  const fr=m.headR*clamp(m.bright,1,3.5);

  // Nucleus
  { const g=ctx.createRadialGradient(hx,hy,0,hx,hy,fr);
    g.addColorStop(0,  rgba(255,255,255,eb));
    g.addColorStop(.5, rgba(255,255,255,eb*.8));
    g.addColorStop(1,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,fr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); }

  // Halo
  { const hr=fr*4.5;
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,hr);
    g.addColorStop(0,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],eb*.7));
    g.addColorStop(.5, rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],eb*.25));
    g.addColorStop(1,  rgba(m.sp.head[0],m.sp.head[1],m.sp.head[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); }

  // Corona (flares/big meteors only)
  const cs = clamp((m.bright-1)*.6+(m.headR-1.5)*.25, 0, 1);
  if(cs>.04){
    const cr=fr*11;
    const g=ctx.createRadialGradient(hx,hy,0,hx,hy,cr);
    g.addColorStop(0, rgba(m.sp.corona[0],m.sp.corona[1],m.sp.corona[2],cs*eb*.4));
    g.addColorStop(1, rgba(m.sp.corona[0],m.sp.corona[1],m.sp.corona[2],0));
    ctx.beginPath(); ctx.arc(hx,hy,cr,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }

  // Sparkles
  for(const s of m.sparkles){
    if(s.life<=0) continue;
    const sa=clamp(s.life*.9,0,1);
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle=rgba(s.col[0],s.col[1],s.col[2],sa); ctx.fill();
    if(s.r>.55){
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3.5);
      g.addColorStop(0, rgba(s.col[0],s.col[1],s.col[2],sa*.35));
      g.addColorStop(1, rgba(s.col[0],s.col[1],s.col[2],0));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r*3.5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
  }
}

// ─── EXPLOSION ────────────────────────────────────────────────────────────────
function makeExplosion(x, y) {
  const col = [220,230,255]; // cold white-blue
  const debris = Array.from({length:70}, ()=>{
    const ang=Math.random()*Math.PI*2, spd=1.5+Math.random()*9;
    const c = lerpC([255,255,255],[180,190,220],Math.random());
    return { x,y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
      life:.9+Math.random()*.9, decay:.006+Math.random()*.012,
      r:.5+Math.random()*2.5, col:c, grav:.022+Math.random()*.04, drag:.974+Math.random()*.016 };
  });
  const rings=[
    {r:2, maxR:230+Math.random()*80, life:1, decay:.012, col:[255,255,255],lw:2.5},
    {r:2, maxR:130+Math.random()*50, life:1, decay:.019, col:[200,215,255],lw:1.2},
    {r:2, maxR:340+Math.random()*80, life:.7,decay:.008, col:[255,255,255],lw:1.0},
  ];
  return { x,y,debris,rings, nova:1.8,novaPeak:1.8, col, active:true };
}

function stepExplosion(e) {
  if(e.nova>0) e.nova -= .011;
  for(const r of e.rings){
    if(r.life<=0) continue;
    r.r += r.maxR/70; r.life -= r.decay;
  }
  for(let i=e.debris.length-1; i>=0; i--){
    const d=e.debris[i];
    d.vx*=d.drag; d.vy*=d.drag; d.vy+=d.grav;
    d.x+=d.vx; d.y+=d.vy; d.life-=d.decay;
    if(d.life<=0) e.debris.splice(i,1);
  }
  e.active = e.nova>-0.5 || e.debris.length>0 || e.rings.some(r=>r.life>0);
}

function drawExplosion(ctx, e) {
  const {x,y}=e;

  // Nova bloom layers
  if(e.nova>0){
    const na  = clamp(e.nova/e.novaPeak, 0, 1);
    const age = e.novaPeak-e.nova;
    for(const [sz,al,col] of [
      [16+age*28,   na*.98, [255,255,255]],
      [60+age*70,   na*.62, e.col],
      [160+age*120, na*.30, e.col],
      [320+age*80,  na*.13, e.col],
    ]){
      const g=ctx.createRadialGradient(x,y,0,x,y,sz);
      g.addColorStop(0,  rgba(col[0],col[1],col[2],al));
      g.addColorStop(.4, rgba(col[0],col[1],col[2],al*.55));
      g.addColorStop(1,  rgba(col[0],col[1],col[2],0));
      ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
  }

  // Shock rings
  ctx.save();
  for(const r of e.rings){
    if(r.life<=0||r.r<1) continue;
    const ra=clamp(r.life,0,1);
    ctx.beginPath(); ctx.arc(x,y,r.r,0,Math.PI*2);
    ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.35);
    ctx.lineWidth=r.lw*ra*5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,r.r,0,Math.PI*2);
    ctx.strokeStyle=rgba(r.col[0],r.col[1],r.col[2],ra*.9);
    ctx.lineWidth=r.lw*ra; ctx.stroke();
  }
  ctx.restore();

  // Debris streaks + dots
  for(const d of e.debris){
    if(d.life<=0) continue;
    const da=clamp(d.life*.9,0,1);
    const spd=Math.hypot(d.vx,d.vy);
    if(spd>1.2){
      ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.vx*4,d.y-d.vy*4);
      ctx.strokeStyle=rgba(d.col[0],d.col[1],d.col[2],da*.75);
      ctx.lineWidth=d.r*.7; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
    ctx.fillStyle=rgba(d.col[0],d.col[1],d.col[2],da); ctx.fill();
    const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*4);
    g.addColorStop(0, rgba(d.col[0],d.col[1],d.col[2],da*.45));
    g.addColorStop(1, rgba(d.col[0],d.col[1],d.col[2],0));
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r*4,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  }
}

// ─── SHOWER PATTERNS ─────────────────────────────────────────────────────────
// Each returns Array<{meteor, delayMs}>

function showerSingle(W,H){
  return [{ meteor: makeMeteor(W,H), delayMs:0 }];
}

function showerParallel(W,H){
  const count = 3+Math.floor(Math.random()*3); // 3–5
  const goRight = Math.random()>.5;
  const ang = (22+Math.random()*30)*Math.PI/180;
  const baseY = H*(.04+Math.random()*.2);
  const spacing = 30+Math.random()*55;
  const baseSpd = 8+Math.random()*9;
  return Array.from({length:count}, (_,i) => ({
    meteor: makeMeteor(W,H, {
      goRight, ang, speed: baseSpd*(.85+Math.random()*.3),
      y: baseY+i*spacing+(Math.random()-.5)*14,
      headR: 1.2+Math.random()*1.8
    }),
    delayMs: i*(70+Math.random()*130)
  }));
}

function showerRadial(W,H){
  const count = 4+Math.floor(Math.random()*3); // 4–6
  const cx = W*(.25+Math.random()*.5);
  const cy = H*(.02+Math.random()*.1);
  return Array.from({length:count}, (_,i) => {
    const deg = -35+(i/(count-1))*70+(Math.random()-.5)*10;
    const angRad = deg*Math.PI/180;
    const spd = 8+Math.random()*10;
    const m = makeMeteor(W,H, { headR:1.4+Math.random()*2, decay:.006+Math.random()*.007 });
    m.x  = cx+(Math.random()-.5)*30;
    m.y  = cy+(Math.random()-.5)*20;
    m.vx = Math.sin(angRad)*spd;
    m.vy = Math.abs(Math.cos(angRad)*spd*.8)+0.5;
    return { meteor:m, delayMs: i*(50+Math.random()*90) };
  });
}

function showerVformation(W,H){
  const count = 3+Math.floor(Math.random()*2); // 3–4 per side
  const out = [];
  for(let i=0; i<count; i++){
    out.push({ meteor:makeMeteor(W,H, {
      goRight:true, x:-30-i*25, y:H*(.03+i*.07),
      speed:9+Math.random()*7, headR:1.3+Math.random()*1.5
    }), delayMs:i*120 });
    out.push({ meteor:makeMeteor(W,H, {
      goRight:false, x:W+30+i*25, y:H*(.03+i*.07),
      speed:9+Math.random()*7, headR:1.3+Math.random()*1.5
    }), delayMs:i*120+60 });
  }
  return out;
}

function showerCluster(W,H){
  const count = 4+Math.floor(Math.random()*4); // 4–7
  const cx = W*(.1+Math.random()*.8);
  const cy = H*(.01+Math.random()*.15);
  return Array.from({length:count}, () => {
    const goRight = cx<W/2 ? Math.random()>.2 : Math.random()<.2;
    const m = makeMeteor(W,H, { headR:.8+Math.random()*1.6, speed:10+Math.random()*13, goRight });
    m.x = cx+(Math.random()-.5)*100;
    m.y = cy+(Math.random()-.5)*40;
    if(m.vy<0) m.vy *= -1;
    return { meteor:m, delayMs: Math.random()*600 };
  });
}

function showerRandom(W,H){
  // Singles are most common, showers less frequent
  const fns = [showerSingle,showerSingle,showerSingle,showerParallel,showerRadial,showerVformation,showerCluster];
  return fns[Math.floor(Math.random()*fns.length)](W,H);
}

// ─── STARS ────────────────────────────────────────────────────────────────────
function makeStarLayer(count, layer){
  return Array.from({length:count}, () => {
    const sz = Math.random();
    const bright = layer===0 && sz>.9;
    return {
      xr: Math.random(), yr: Math.random(),
      r: bright ? 1.5+Math.random()*.9
        : sz<.7  ? .15+Math.random()*.38
                 : .38+Math.random()*.5,
      baseA: layer===0 ? .5+Math.random()*.5
           : layer===1 ? .22+Math.random()*.32
                       : .08+Math.random()*.2,
      ts: .15+Math.random()*1.0,
      to: Math.random()*Math.PI*2,
      tint: [255,255,255],
      bright,
      ox:0, oy:0
    };
  });
}

function makeNebulae(){
  const pals=[
    [[30,10,70],[70,5,50]], [[8,20,65],[15,50,90]],
    [[8,45,35],[18,70,55]], [[55,15,8],[85,35,12]], [[45,8,45],[25,8,65]],
  ];
  return Array.from({length:5}, () => {
    const p=pals[Math.floor(Math.random()*pals.length)];
    return { xr:.05+Math.random()*.9, yr:.05+Math.random()*.85,
      rr:.08+Math.random()*.22, a:.03+Math.random()*.06,
      col:lerpC(p[0],p[1],Math.random()), ax:.6+Math.random()*.9, ay:.6+Math.random()*.9 };
  });
}

function drawNebulae(ctx,nbs,W,H){
  for(const n of nbs){
    const cx=n.xr*W, cy=n.yr*H;
    const rx=n.rr*W*n.ax, ry=n.rr*H*n.ay;
    const r=Math.max(rx,ry);
    ctx.save(); ctx.translate(cx,cy); ctx.scale(rx/r,ry/r);
    const g=ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,  rgba(n.col[0],n.col[1],n.col[2],n.a));
    g.addColorStop(.5, rgba(n.col[0],n.col[1],n.col[2],n.a*.5));
    g.addColorStop(1,  rgba(n.col[0],n.col[1],n.col[2],0));
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StarBackground({ fixed=true, starCount=300 }) {
  const canvasRef = useRef(null);

  const layers = useMemo(() => [
    makeStarLayer(Math.floor(starCount*.32), 0),
    makeStarLayer(Math.floor(starCount*.42), 1),
    makeStarLayer(Math.floor(starCount*.26), 2),
  ], [starCount]);

  const nebulae = useMemo(() => makeNebulae(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    let raf       = null;
    let meteors   = [];
    let explosions= [];
    let lastTs    = 0;

    const sessionStart = performance.now();
    let eggFired = false;

    let nextShowerMs  = 3000+Math.random()*3000;
    let showerAccumMs = 0;

    function resize(){
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function addShower(entries){
      for(const {meteor,delayMs} of entries){
        if(delayMs<=0){
          meteors.push(meteor);
        } else {
          setTimeout(() => { if(canvas) meteors.push(meteor); }, delayMs);
        }
      }
    }

    function pickBrightStar(W,H){
      const pool = layers[0].filter(s=>s.bright && s.xr>.18&&s.xr<.82&&s.yr>.12&&s.yr<.78);
      if(!pool.length) return { x:W*.5, y:H*.3, tint:[255,220,150] };
      const s = pool[Math.floor(Math.random()*pool.length)];
      return { x:s.xr*W, y:s.yr*H, tint:s.tint };
    }

    function triggerEgg(W,H){
      eggFired = true;
      const target = pickBrightStar(W,H);
      const {x:tx,y:ty} = target;

      const fromLeft = tx > W/2;
      const startX   = fromLeft ? -50 : W+50;
      const startY   = Math.max(15, ty-120-Math.random()*80);
      const angle    = Math.atan2(ty-startY, tx-startX);
      const speed    = 9+Math.random()*4;

      const m = makeMeteor(W,H, {
        headR: 3.2+Math.random()*1.5,
        decay: 0.0018,
        isEgg: true,
        target,
      });
      m.x = startX; m.y = startY;
      m.vx = Math.cos(angle)*speed;
      m.vy = Math.sin(angle)*speed;
      m.history = [];
      meteors.push(m);

      console.log('%c☄️  Egg meteor launched!  Run window.__starExplosion() again anytime.',
        'color:#fa0;font-size:13px;font-weight:bold');
    }

    // ── Expose console API ──────────────────────────────────────────────────
    window.__starExplosion = () => {
      eggFired = false;
      triggerEgg(canvas.width, canvas.height);
    };

    window.__starShower = (pattern) => {
      const W=canvas.width, H=canvas.height;
      const map = {
        parallel:   showerParallel,
        radial:     showerRadial,
        vformation: showerVformation,
        cluster:    showerCluster,
      };
      const fn = (pattern && map[pattern]) ? map[pattern] : showerRandom;
      addShower(fn(W,H));
      console.log(`%c🌠 Shower fired: ${pattern||'random'}`,
        'color:#8df;font-size:13px');
    };

    console.log('%c✨ Star Background ready!\n  window.__starExplosion()\n  window.__starShower("parallel"|"radial"|"vformation"|"cluster")',
      'color:#adf;font-size:12px');

    // ── Main render loop — NEVER stops so timers always tick ───────────────
    function tick(ts) {
      const dt = Math.min(ts-lastTs, 50);
      lastTs = ts;
      showerAccumMs += dt;

      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H);

      // Nebulae
      drawNebulae(ctx, nebulae, W, H);

      // Stars — draw back layer first
      const t = ts*.001;
      for(let li=layers.length-1; li>=0; li--){
        for(const s of layers[li]){
          s.ox = Math.sin(t*.035+s.to)*.7*(li+1);
          s.oy = Math.cos(t*.028+s.to)*.45*(li+1);
          const sx=s.xr*W+s.ox, sy=s.yr*H+s.oy;
          const a = s.baseA*(.48+.52*Math.sin(t*s.ts+s.to));

          if(s.bright && s.r>1.5){
            const sl=s.r*9;
            ctx.save();
            ctx.strokeStyle=rgba(s.tint[0],s.tint[1],s.tint[2],a*.38);
            ctx.lineWidth=.5;
            for(const [dx,dy] of [[1,0],[0,1],[.7,.7],[-.7,.7]]){
              ctx.beginPath(); ctx.moveTo(sx-dx*sl,sy-dy*sl); ctx.lineTo(sx+dx*sl,sy+dy*sl); ctx.stroke();
            }
            ctx.restore();
            const g=ctx.createRadialGradient(sx,sy,0,sx,sy,s.r*5.5);
            g.addColorStop(0, rgba(s.tint[0],s.tint[1],s.tint[2],a*.55));
            g.addColorStop(1, rgba(s.tint[0],s.tint[1],s.tint[2],0));
            ctx.beginPath(); ctx.arc(sx,sy,s.r*5.5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
          }

          ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2);
          ctx.fillStyle=rgba(s.tint[0],s.tint[1],s.tint[2],a); ctx.fill();
        }
      }

      // Automatic shower spawning
      if(showerAccumMs >= nextShowerMs){
        showerAccumMs = 0;
        nextShowerMs  = 3500+Math.random()*5500;
        addShower(showerRandom(W,H));
      }

      // 5-min easter egg auto-trigger
      if(!eggFired && performance.now()-sessionStart >= 5*60*1000){
        triggerEgg(W,H);
      }

      // Update + draw meteors
      for(let i=meteors.length-1; i>=0; i--){
        const m=meteors[i];
        stepMeteor(m);

        // Collision check for egg meteor
        if(m.isEgg && m.target && m.history.length>5){
          if(dist2(m.x,m.y,m.target.x,m.target.y) < 28*28){
            explosions.push(makeExplosion(m.target.x, m.target.y));
            console.log('%c💥 BOOM — nova!','color:#f60;font-size:18px;font-weight:bold');
            meteors.splice(i,1);
            continue;
          }
        }

        if(m.life<=0 || m.x<-500 || m.x>W+500 || m.y<-400 || m.y>H+400){
          meteors.splice(i,1); continue;
        }
        drawMeteor(ctx,m);
      }

      // Update + draw explosions
      for(let i=explosions.length-1; i>=0; i--){
        stepExplosion(explosions[i]);
        drawExplosion(ctx,explosions[i]);
        if(!explosions[i].active) explosions.splice(i,1);
      }

      // ALWAYS schedule next frame — loop never pauses
      raf = requestAnimationFrame(tick);
    }

    resize();
    lastTs = performance.now();
    raf    = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      delete window.__starExplosion;
      delete window.__starShower;
    };
  }, [layers, nebulae]);

  const style = fixed
    ? { position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0 }
    : { position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none' };

  return <canvas ref={canvasRef} style={style} />;
}
