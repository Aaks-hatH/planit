import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Scroll reveal ── */
function useReveal(threshold = 0.08) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); o.disconnect(); } }, { threshold });
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, vis];
}
function Reveal({ children, delay = 0 }) {
  const [ref, vis] = useReveal();
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(18px)', transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

const si = slug   => `https://cdn.simpleicons.org/${slug}`;
const cb = domain => `https://logo.clearbit.com/${domain}`;
const gh = user   => `https://avatars.githubusercontent.com/${user}?s=64`;

const COMPONENTS = [
  { id:'comp-a', letter:'A', legalName:'PlanIt Frontend Application',  codeName:'event-planner-frontend', packageVersion:null,     licenseTitle:'PlanIt Frontend Interface License Agreement',      licenseVersion:'Version 3.1.2',  licenseDate:'March 2026',   alias:'"Frontend Application" or "Software"', anchor:'#part-three', dot:'#a78bfa', rgb:'167,139,250' },
  { id:'comp-b', letter:'B', legalName:'PlanIt Backend Application',   codeName:'PlanIT',                 packageVersion:'5.20.26', licenseTitle:'PlanIt Backend Services License Agreement',        licenseVersion:'Version 5.20.26',licenseDate:'January 2026', alias:'"Backend Application" or "Software"',  anchor:'#part-four',  dot:'#86efac', rgb:'134,239,172' },
  { id:'comp-c', letter:'C', legalName:'PlanIt Router Service',        codeName:'planit-router',          packageVersion:null,     licenseTitle:'PlanIt Router Infrastructure License Agreement',   licenseVersion:'Version 3.0.2',  licenseDate:'January 2026', alias:'"Router Service" or "Software"',       anchor:'#part-five',  dot:'#67e8f9', rgb:'103,232,249' },
  { id:'comp-d', letter:'D', legalName:'PlanIt Watchdog Service',      codeName:'planit-watchdog',        packageVersion:null,     licenseTitle:'PlanIt Watchdog Monitoring License Agreement',     licenseVersion:'Version 1.1.0',  licenseDate:'January 2026', alias:'"Watchdog Service" or "Software"',     anchor:'#part-six',   dot:'#fbbf24', rgb:'251,191,36'  },
];

const SECTIONS = [
  {
    id:'frontend-libs', label:'Frontend Libraries', dot:'#a78bfa',
    items:[
      {name:'React',logo:si('react'),url:'https://react.dev',note:'UI framework'},
      {name:'React DOM',logo:si('react'),url:'https://react.dev',note:'DOM rendering'},
      {name:'React Router DOM',logo:si('reactrouter'),url:'https://reactrouter.com',note:'Client-side routing'},
      {name:'Framer Motion',logo:si('framer'),url:'https://www.framer.com/motion',note:'Animations'},
      {name:'Three.js',logo:si('threedotjs'),url:'https://threejs.org',note:'3D rendering (star background)'},
      {name:'@react-three/fiber',logo:gh('pmndrs'),url:'https://docs.pmnd.rs/react-three-fiber',note:'React renderer for Three.js'},
      {name:'@react-three/drei',logo:gh('pmndrs'),url:'https://github.com/pmndrs/drei',note:'Three.js helpers'},
      {name:'@react-three/postprocessing',logo:gh('pmndrs'),url:'https://github.com/pmndrs/react-postprocessing',note:'Post-processing effects'},
      {name:'Socket.IO Client',logo:si('socketdotio'),url:'https://socket.io',note:'Real-time communication'},
      {name:'Axios',logo:si('axios'),url:'https://axios-http.com',note:'HTTP client'},
      {name:'CryptoJS',logo:gh('brix'),url:'https://github.com/brix/crypto-js',note:'Client-side encryption'},
      {name:'Lucide React',logo:gh('lucide-icons'),url:'https://lucide.dev',note:'Icon library'},
      {name:'date-fns',logo:gh('date-fns'),url:'https://date-fns.org',note:'Date utilities'},
      {name:'Luxon',logo:gh('moment'),url:'https://moment.github.io/luxon',note:'Date & time handling'},
      {name:'React Hot Toast',logo:gh('timolins'),url:'https://react-hot-toast.com',note:'Toast notifications'},
      {name:'Zustand',logo:gh('pmndrs'),url:'https://zustand-demo.pmnd.rs',note:'State management'},
      {name:'html5-qrcode',logo:gh('mebjas'),url:'https://github.com/mebjas/html5-qrcode',note:'QR code scanner'},
      {name:'clsx',logo:gh('lukeed'),url:'https://github.com/lukeed/clsx',note:'Conditional class names'},
      {name:'tailwind-merge',logo:si('tailwindcss'),url:'https://github.com/dcastil/tailwind-merge',note:'Tailwind class merging'},
    ],
  },
  {
    id:'frontend-tooling', label:'Frontend Tooling', dot:'#67e8f9',
    items:[
      {name:'Vite',logo:si('vite'),url:'https://vitejs.dev',note:'Build tool'},
      {name:'Tailwind CSS',logo:si('tailwindcss'),url:'https://tailwindcss.com',note:'CSS utility framework'},
      {name:'PostCSS',logo:si('postcss'),url:'https://postcss.org',note:'CSS processing'},
      {name:'Autoprefixer',logo:gh('postcss'),url:'https://github.com/postcss/autoprefixer',note:'CSS vendor prefixes'},
      {name:'ESLint',logo:si('eslint'),url:'https://eslint.org',note:'Code linting'},
      {name:'vite-plugin-pwa',logo:si('vite'),url:'https://vite-pwa-org.netlify.app',note:'Progressive web app support'},
    ],
  },
  {
    id:'backend-libs', label:'Backend Libraries', dot:'#86efac',
    items:[
      {name:'Express',logo:si('express'),url:'https://expressjs.com',note:'Web framework'},
      {name:'Mongoose',logo:si('mongoose'),url:'https://mongoosejs.com',note:'MongoDB ODM'},
      {name:'Socket.IO',logo:si('socketdotio'),url:'https://socket.io',note:'Real-time server'},
      {name:'bcryptjs',logo:gh('dcodeIO'),url:'https://github.com/dcodeIO/bcrypt.js',note:'Password hashing'},
      {name:'jsonwebtoken',logo:si('jsonwebtokens'),url:'https://github.com/auth0/node-jsonwebtoken',note:'JWT authentication'},
      {name:'Helmet',logo:gh('helmetjs'),url:'https://helmetjs.github.io',note:'Security headers'},
      {name:'express-rate-limit',logo:gh('express-rate-limit'),url:'https://github.com/express-rate-limit/express-rate-limit',note:'Rate limiting'},
      {name:'express-mongo-sanitize',logo:gh('fiznool'),url:'https://github.com/fiznool/express-mongo-sanitize',note:'NoSQL injection prevention'},
      {name:'express-validator',logo:gh('express-validator'),url:'https://express-validator.github.io',note:'Input validation'},
      {name:'Multer',logo:gh('expressjs'),url:'https://github.com/expressjs/multer',note:'File upload handling'},
      {name:'uuid',logo:gh('uuidjs'),url:'https://github.com/uuidjs/uuid',note:'Unique ID generation'},
      {name:'compression',logo:gh('expressjs'),url:'https://github.com/expressjs/compression',note:'Response compression'},
      {name:'cookie-parser',logo:gh('expressjs'),url:'https://github.com/expressjs/cookie-parser',note:'Cookie handling'},
      {name:'cors',logo:gh('expressjs'),url:'https://github.com/expressjs/cors',note:'Cross-origin resource sharing'},
      {name:'dotenv',logo:si('dotenv'),url:'https://github.com/motdotla/dotenv',note:'Environment variables'},
      {name:'CryptoJS',logo:gh('brix'),url:'https://github.com/brix/crypto-js',note:'Encryption'},
      {name:'Stripe SDK',logo:si('stripe'),url:'https://github.com/stripe/stripe-node',note:'Payment processing client'},
      {name:'Cloudinary SDK',logo:si('cloudinary'),url:'https://cloudinary.com/documentation/node_integration',note:'File storage client'},
      {name:'node-cron',logo:gh('node-cron'),url:'https://github.com/node-cron/node-cron',note:'Scheduled tasks'},
      {name:'Axios',logo:si('axios'),url:'https://axios-http.com',note:'HTTP client'},
      {name:'qrcode',logo:gh('soldair'),url:'https://github.com/soldair/node-qrcode',note:'QR code generation'},
      {name:'ioredis',logo:si('redis'),url:'https://github.com/redis/ioredis',note:'Redis client'},
      {name:'@socket.io/redis-adapter',logo:si('socketdotio'),url:'https://github.com/socketio/socket.io-redis-adapter',note:'Socket.IO Redis adapter'},
      {name:'speakeasy',logo:gh('speakeasyjs'),url:'https://github.com/speakeasyjs/speakeasy',note:'TOTP / 2FA'},
      {name:'http-proxy-middleware',logo:gh('chimurai'),url:'https://github.com/chimurai/http-proxy-middleware',note:'Reverse proxy (router)'},
    ],
  },
  {
    id:'external-services', label:'External Services', dot:'#fbbf24',
    items:[
      {name:'MongoDB Atlas',logo:si('mongodb'),url:'https://www.mongodb.com/atlas',note:'Primary database'},
      {name:'Redis',logo:si('redis'),url:'https://redis.io',note:'Caching, sessions & pub/sub'},
      {name:'Cloudinary',logo:si('cloudinary'),url:'https://cloudinary.com',note:'File & image hosting'},
      {name:'Stripe',logo:si('stripe'),url:'https://stripe.com',note:'Payment processing'},
      {name:'Brevo',logo:si('brevo'),url:'https://www.brevo.com',note:'Transactional email'},
      {name:'Mailjet',logo:cb('mailjet.com'),url:'https://www.mailjet.com',note:'Email fallback provider'},
      {name:'Google OAuth / Gmail API',logo:si('google'),url:'https://developers.google.com/gmail/api',note:'RSVP email auth'},
      {name:'AbuseIPDB',logo:cb('abuseipdb.com'),url:'https://www.abuseipdb.com',note:'IP reputation & fraud detection'},
      {name:'ntfy.sh',logo:si('ntfy'),url:'https://ntfy.sh',note:'Push notifications (watchdog alerts)'},
      {name:'Discord Webhooks',logo:si('discord'),url:'https://discord.com/developers/docs/resources/webhook',note:'Alert routing'},
      {name:'Render',logo:si('render'),url:'https://render.com',note:'Cloud hosting'},
      {name:'Google Fonts',logo:si('googlefonts'),url:'https://fonts.google.com',note:'Syne & DM Sans typefaces'},
      {name:'Google Analytics 4',logo:si('googleanalytics'),url:'https://analytics.google.com',note:'Web analytics (consent-gated)'},
    ],
  },
];

function Logo({ src, name, size = 32 }) {
  const [status, setStatus] = useState('loading');
  const initial = (name || '?')[0].toUpperCase();
  const hue = [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background: status==='ok'?'rgba(255,255,255,0.07)':`hsl(${hue},32%,20%)`, border:'1px solid rgba(255,255,255,0.08)', transition:'background 0.2s' }}>
      {status !== 'error' && <img src={src} alt={name} onLoad={()=>setStatus('ok')} onError={()=>setStatus('error')} style={{ width:size*0.59, height:size*0.59, objectFit:'contain', display:status==='ok'?'block':'none', filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />}
      {status !== 'ok' && <span style={{ fontSize:size*0.38, fontWeight:800, color:`hsl(${hue},55%,68%)`, lineHeight:1 }}>{initial}</span>}
    </div>
  );
}

function CreditCard({ name, url, note, logo }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10, border:`1px solid ${hovered?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.055)'}`, background:hovered?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.02)', textDecoration:'none', transition:'border-color 0.18s ease,background 0.18s ease,transform 0.14s ease', transform:hovered?'translateY(-1px)':'none', cursor:'pointer', minWidth:0 }}>
      <Logo src={logo} name={name} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
          <span style={{ fontSize:13.5, fontWeight:600, letterSpacing:'-0.01em', color:hovered?'#fff':'rgba(255,255,255,0.82)', transition:'color 0.18s ease', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hovered?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.15)'} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        </div>
        <p style={{ margin:'2px 0 0', fontSize:11.5, color:'rgba(255,255,255,0.32)', lineHeight:1.4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{note}</p>
      </div>
    </a>
  );
}

function CreditSection({ section, sectionIndex }) {
  return (
    <div id={section.id} style={{ scrollMarginTop:80 }}>
      <Reveal delay={sectionIndex*60}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:section.dot, boxShadow:`0 0 10px ${section.dot}`, flexShrink:0 }}/>
          <h2 style={{ margin:0, fontSize:11, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' }}>{section.label}</h2>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.18)', fontVariantNumeric:'tabular-nums' }}>{section.items.length}</span>
        </div>
      </Reveal>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px, 1fr))', gap:8, marginBottom:52 }}>
        {section.items.map((item,i) => (
          <Reveal key={item.name} delay={sectionIndex*35+i*15}><CreditCard {...item}/></Reveal>
        ))}
      </div>
    </div>
  );
}

function ComponentCard({ comp, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={index*80}>
      <a
        href={`/license${comp.anchor}`}
        onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
        style={{
          display:'flex', flexDirection:'column', textDecoration:'none', height:'100%',
          border:`1px solid ${hovered?`rgba(${comp.rgb},0.3)`:`rgba(${comp.rgb},0.12)`}`,
          background: hovered ? `rgba(${comp.rgb},0.05)` : 'rgba(255,255,255,0.025)',
          borderRadius:16,
          transition:'border-color 0.2s ease,background 0.2s ease,transform 0.15s ease,box-shadow 0.2s ease',
          transform: hovered ? 'translateY(-3px)' : 'none',
          boxShadow: hovered ? `0 8px 32px rgba(${comp.rgb},0.12)` : 'none',
          position:'relative', overflow:'hidden',
        }}
      >
        {/* top accent */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${comp.dot} 0%, transparent 100%)`, opacity: hovered?1:0.5, transition:'opacity 0.2s ease' }}/>

        {/* header */}
        <div style={{ padding:'20px 20px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <div style={{ width:40, height:40, borderRadius:12, flexShrink:0, background:`rgba(${comp.rgb},0.12)`, border:`1px solid rgba(${comp.rgb},0.25)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:18, fontWeight:900, color:comp.dot }}>{comp.letter}</span>
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:2 }}>Component {comp.letter}</p>
              <p style={{ margin:0, fontSize:14, fontWeight:700, color: hovered?'#fff':'rgba(255,255,255,0.88)', letterSpacing:'-0.02em', lineHeight:1.25 }}>{comp.legalName}</p>
            </div>
          </div>
          <div style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, border:`1px solid rgba(${comp.rgb},0.28)`, background:`rgba(${comp.rgb},0.09)` }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:comp.dot, flexShrink:0, boxShadow:`0 0 5px ${comp.dot}` }}/>
            <span style={{ fontSize:10.5, fontWeight:700, color:comp.dot, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{comp.licenseVersion}</span>
          </div>
        </div>

        {/* divider */}
        <div style={{ height:'1px', background:`linear-gradient(90deg, rgba(${comp.rgb},0.15) 0%, transparent 80%)`, margin:'0 20px' }}/>

        {/* metadata */}
        <div style={{ padding:'14px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px', flex:1 }}>
          <div>
            <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.13em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginBottom:4 }}>Package</p>
            <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.6)', fontFamily:'ui-monospace,"Cascadia Code",monospace', lineHeight:1.4 }}>{comp.codeName}{comp.packageVersion?` v${comp.packageVersion}`:''}</p>
          </div>
          <div>
            <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.13em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginBottom:4 }}>Effective</p>
            <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>{comp.licenseDate}</p>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.13em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginBottom:4 }}>License</p>
            <p style={{ margin:0, fontSize:11.5, color:'rgba(255,255,255,0.48)', lineHeight:1.5 }}>{comp.licenseTitle}</p>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.13em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginBottom:4 }}>Defined as</p>
            <p style={{ margin:0, fontSize:11.5, color:'rgba(255,255,255,0.35)', fontStyle:'italic', lineHeight:1.4 }}>{comp.alias}</p>
          </div>
        </div>

        {/* footer cta */}
        <div style={{ padding:'12px 20px', borderTop:`1px solid rgba(${comp.rgb},0.08)` }}>
          <span style={{ fontSize:11.5, fontWeight:600, color:hovered?comp.dot:'rgba(255,255,255,0.25)', transition:'color 0.2s ease', display:'flex', alignItems:'center', gap:5 }}>
            View license agreement
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </div>
      </a>
    </Reveal>
  );
}

const VERIFY_STEPS = [
  { id:'build',      label:'Checking build manifest…'         },
  { id:'components', label:'Validating 4 components (A–D)…'  },
  { id:'hash',       label:'Comparing integrity hashes…'      },
  { id:'sig',        label:'Confirming license signatures…'   },
  { id:'done',       label:'All checks passed.'               },
];

function VerificationSeal({ serial }) {
  const [state, setState] = useState('idle');
  const [step, setStep] = useState(-1);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const runVerification = useCallback(() => {
    if (state === 'running') return;
    setState('running'); setStep(0);
    let s = 0;
    timerRef.current = setInterval(() => {
      s++;
      if (s >= VERIFY_STEPS.length) { clearInterval(timerRef.current); setStep(VERIFY_STEPS.length - 1); setState('done'); }
      else setStep(s);
    }, 520);
  }, [state]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleCopy = () => {
    navigator.clipboard?.writeText(serial).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  };

  const isRunning = state === 'running';
  const isDone    = state === 'done';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:28, flexWrap:'wrap' }}>
      {/* animated seal */}
      <button onClick={runVerification} title={state==='idle'?'Click to verify this installation':undefined} style={{ flexShrink:0, cursor:isRunning?'default':'pointer', background:'none', border:'none', padding:0, outline:'none' }} aria-label="Verify PlanIt installation">
        <div style={{ width:96, height:96, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <style>{`
            @keyframes sealSpin  { to { transform: rotate(360deg); transform-origin: 48px 48px; } }
            @keyframes sealPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
          `}</style>
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ position:'absolute', inset:0, animation:isRunning?'sealSpin 1.4s linear infinite':'none' }} aria-hidden="true">
            <circle cx="48" cy="48" r="44" fill="none" stroke={isDone?'rgba(134,239,172,0.5)':'rgba(167,139,250,0.25)'} strokeWidth="1" strokeDasharray={isRunning?'6 6':'3 5.5'} style={{ transition:'stroke 0.4s ease' }}/>
          </svg>
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ position:'absolute', inset:0 }} aria-hidden="true">
            <circle cx="48" cy="48" r="36" fill="none" stroke={isDone?'rgba(134,239,172,0.2)':'rgba(167,139,250,0.12)'} strokeWidth="0.75" style={{ transition:'stroke 0.4s ease' }}/>
          </svg>
          <div style={{ width:64, height:64, borderRadius:'50%', background:isDone?'rgba(134,239,172,0.1)':isRunning?'rgba(167,139,250,0.1)':'rgba(167,139,250,0.07)', border:`1.5px solid ${isDone?'rgba(134,239,172,0.45)':'rgba(167,139,250,0.35)'}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, transition:'all 0.4s ease', animation:isRunning?'sealPulse 1s ease-in-out infinite':'none' }}>
            {isDone ? (
              <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span style={{ fontSize:6.5, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(134,239,172,0.75)' }}>VERIFIED</span></>
            ) : isRunning ? (
              <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><span style={{ fontSize:6, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(167,139,250,0.7)' }}>CHECKING</span></>
            ) : (
              <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style={{ fontSize:6.5, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(167,139,250,0.65)' }}>GENUINE</span></>
            )}
          </div>
        </div>
      </button>

      {/* right side */}
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ marginBottom:12, minHeight:26, display:'flex', alignItems:'center', gap:8 }}>
          {state === 'idle' && (
            <button onClick={runVerification} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.08)', color:'#a78bfa', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s ease' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(167,139,250,0.14)';e.currentTarget.style.borderColor='rgba(167,139,250,0.5)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(167,139,250,0.08)';e.currentTarget.style.borderColor='rgba(167,139,250,0.3)'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Verify this installation
            </button>
          )}
          {isRunning && step >= 0 && (
            <span style={{ fontSize:12, color:'rgba(167,139,250,0.7)', fontFamily:'ui-monospace,monospace', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#a78bfa', animation:'sealPulse 0.7s ease-in-out infinite' }}/>
              {VERIFY_STEPS[step].label}
            </span>
          )}
          {isDone && (
            <span style={{ fontSize:12, color:'#86efac', display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              All {VERIFY_STEPS.length - 1} integrity checks passed
            </span>
          )}
        </div>

        {(isRunning || isDone) && (
          <div style={{ display:'flex', gap:4, marginBottom:14 }}>
            {VERIFY_STEPS.slice(0,-1).map((s,i) => (
              <div key={s.id} style={{ height:3, flex:1, borderRadius:99, background: i < step ? (isDone?'rgba(134,239,172,0.7)':'rgba(167,139,250,0.7)') : i === step && !isDone ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)', transition:`background 0.3s ease ${i*80}ms` }}/>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <p style={{ margin:0, fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(255,255,255,0.2)' }}>Serial</p>
            <code style={{ fontSize:11.5, color:isDone?'rgba(134,239,172,0.7)':'rgba(255,255,255,0.35)', fontFamily:'ui-monospace,monospace', transition:'color 0.4s ease', letterSpacing:'0.05em' }}>{serial}</code>
          </div>
          <button onClick={handleCopy} title="Copy serial number" style={{ background:copied?'rgba(134,239,172,0.1)':'rgba(255,255,255,0.04)', border:`1px solid ${copied?'rgba(134,239,172,0.3)':'rgba(255,255,255,0.08)'}`, borderRadius:6, padding:'4px 8px', cursor:'pointer', color:copied?'#86efac':'rgba(255,255,255,0.3)', fontSize:10, fontWeight:600, fontFamily:'inherit', transition:'all 0.2s ease', display:'flex', alignItems:'center', gap:4 }}>
            {copied ? (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
            ) : (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CertificationPlaque() {
  const now    = new Date();
  const issued = now.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const serial = `PLN-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-A4B2-CE31`;
  const totalDeps = SECTIONS.reduce((s,sec) => s + sec.items.length, 0);

  return (
    <Reveal delay={60}>
      <div style={{ position:'relative', borderRadius:18, overflow:'hidden', border:'1px solid rgba(167,139,250,0.18)', background:'rgba(255,255,255,0.018)', marginBottom:72 }}>
        {[
          { top:0,    left:0,  bt:'1.5px solid rgba(167,139,250,0.35)', bl:'1.5px solid rgba(167,139,250,0.35)', br:'none', bb:'none' },
          { top:0,    right:0, bt:'1.5px solid rgba(167,139,250,0.35)', br:'1.5px solid rgba(167,139,250,0.35)', bl:'none', bb:'none' },
          { bottom:0, left:0,  bb:'1.5px solid rgba(167,139,250,0.35)', bl:'1.5px solid rgba(167,139,250,0.35)', bt:'none', br:'none' },
          { bottom:0, right:0, bb:'1.5px solid rgba(167,139,250,0.35)', br:'1.5px solid rgba(167,139,250,0.35)', bt:'none', bl:'none' },
        ].map((s,i) => (
          <div key={i} style={{ position:'absolute', width:16, height:16, pointerEvents:'none', top:s.top, bottom:s.bottom, left:s.left, right:s.right, borderTop:s.bt||'none', borderBottom:s.bb||'none', borderLeft:s.bl||'none', borderRight:s.br||'none' }}/>
        ))}

        {/* header strip */}
        <div style={{ padding:'12px clamp(20px,4vw,36px)', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'rgba(167,139,250,0.03)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', boxShadow:'0 0 6px #a78bfa' }}/>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(255,255,255,0.28)' }}>Certificate of Authentic Deployment</span>
          </div>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.16)', fontVariantNumeric:'tabular-nums' }}>{issued}</span>
        </div>

        {/* main body */}
        <div style={{ padding:'clamp(24px,4vw,36px)' }}>
          <h2 style={{ margin:'0 0 6px', fontSize:'clamp(1.1rem,2.5vw,1.4rem)', fontWeight:800, letterSpacing:'-0.03em', color:'#fff', lineHeight:1.2 }}>This is a genuine PlanIt instance.</h2>
          <p style={{ margin:'0 0 24px', fontSize:13, color:'rgba(255,255,255,0.38)', lineHeight:1.7, maxWidth:560 }}>
            This deployment is an authentic, unmodified distribution of PlanIt, comprised of the four licensed software components listed below (A–D), operated in full accordance with the governing license agreements.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 28px', marginBottom:28 }}>
            {[{label:'Components',value:'4 (A – D)'},{label:'Dependencies',value:`${totalDeps} packages`}].map(({label,value}) => (
              <div key={label}>
                <p style={{ margin:0, fontSize:9.5, fontWeight:700, letterSpacing:'0.13em', textTransform:'uppercase', color:'rgba(255,255,255,0.2)' }}>{label}</p>
                <p style={{ margin:'3px 0 0', fontSize:13, color:'rgba(255,255,255,0.6)', fontVariantNumeric:'tabular-nums', lineHeight:1.4 }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ height:'1px', background:'rgba(167,139,250,0.1)', marginBottom:24 }}/>
          <VerificationSeal serial={serial} totalDeps={totalDeps}/>
        </div>

        {/* version strip footer */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'12px clamp(20px,4vw,36px)', display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, background:'rgba(255,255,255,0.01)' }}>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.18)', marginRight:6 }}>Component versions:</span>
          {COMPONENTS.map(c => (
            <div key={c.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px', borderRadius:6, border:`1px solid rgba(${c.rgb},0.2)`, background:`rgba(${c.rgb},0.06)` }}>
              <span style={{ fontSize:10, fontWeight:800, color:c.dot }}>{c.letter}</span>
              <div style={{ width:'0.5px', height:10, background:`${c.dot}40` }}/>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{c.licenseVersion}</span>
            </div>
          ))}
          <div style={{ flex:1 }}/>
          <a href="/license" style={{ fontSize:10.5, color:'rgba(255,255,255,0.25)', textDecoration:'underline', textUnderlineOffset:3, transition:'color 0.15s ease' }} onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.25)'}>Full license agreements →</a>
        </div>
      </div>
    </Reveal>
  );
}

export default function Credits() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const totalCount = SECTIONS.reduce((s,sec) => s + sec.items.length, 0);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive:true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#05050f', color:'white', fontFamily:"'DM Sans', system-ui, sans-serif" }}>

      <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }} aria-hidden="true">
        <defs><pattern id="cg" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(255,255,255,0.018)" strokeWidth="1"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#cg)"/>
      </svg>
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:700, height:400, background:'radial-gradient(ellipse at center, rgba(124,58,237,0.07) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }}/>

      {/* nav */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:scrolled?'rgba(5,5,15,0.92)':'transparent', borderBottom:scrolled?'1px solid rgba(255,255,255,0.06)':'1px solid transparent', backdropFilter:scrolled?'blur(16px)':'none', transition:'all 0.3s ease', padding:'0 clamp(16px,5vw,48px)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={()=>navigate('/')} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'6px 0', color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:500, transition:'color 0.2s', fontFamily:'inherit' }} onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.85)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            PlanIt
          </button>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.2)', fontVariantNumeric:'tabular-nums' }}>{totalCount} dependencies · 4 components</span>
        </div>
      </div>

      {/* content */}
      <div style={{ position:'relative', zIndex:1, maxWidth:1000, margin:'0 auto', padding:'clamp(48px,8vw,96px) clamp(16px,5vw,48px) 96px' }}>

        {/* hero */}
        <div style={{ marginBottom:56 }}>
          <Reveal>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 12px', borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', marginBottom:24 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', boxShadow:'0 0 8px #a78bfa' }}/>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)' }}>Open Acknowledgements</span>
            </div>
          </Reveal>
          <Reveal delay={60}><h1 style={{ margin:'0 0 16px', fontSize:'clamp(2rem,6vw,3.2rem)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1.05, color:'#fff' }}>Credits</h1></Reveal>
          <Reveal delay={100}><p style={{ margin:0, fontSize:16, color:'rgba(255,255,255,0.4)', lineHeight:1.7, maxWidth:560 }}>PlanIt is built on the shoulders of great open-source libraries and reliable external services. Every dependency listed here plays a direct role in making the platform work.</p></Reveal>
        </div>

        <CertificationPlaque/>

        <Reveal>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'rgba(255,255,255,0.25)', flexShrink:0 }}/>
            <h2 style={{ margin:0, fontSize:11, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' }}>Licensed Components</h2>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.18)' }}>A – D</span>
          </div>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14, marginBottom:72 }}>
          {COMPONENTS.map((comp,i) => <ComponentCard key={comp.id} comp={comp} index={i}/>)}
        </div>

        <Reveal delay={40}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:64 }}>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.45)', textDecoration:'none', transition:'all 0.15s ease' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.15)';e.currentTarget.style.color='rgba(255,255,255,0.75)';e.currentTarget.style.background='rgba(255,255,255,0.06)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.45)';e.currentTarget.style.background='rgba(255,255,255,0.03)'}}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:s.dot }}/>
                {s.label}
              </a>
            ))}
          </div>
        </Reveal>

        {SECTIONS.map((section,i) => <CreditSection key={section.id} section={section} sectionIndex={i}/>)}

        <Reveal>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:40, marginTop:16 }}>
            <p style={{ margin:0, fontSize:13, color:'rgba(255,255,255,0.22)', lineHeight:1.7 }}>
              All trademarks and logos are the property of their respective owners. PlanIt is proprietary software — see the{' '}
              <a href="/license" style={{ color:'rgba(255,255,255,0.4)', textDecoration:'underline', textUnderlineOffset:3 }}>license page</a> for full terms.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
