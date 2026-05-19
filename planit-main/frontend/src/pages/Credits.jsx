import { useEffect, useRef, useState } from 'react';
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

/* ── Logo source helpers ──
   si(slug)    → Simple Icons CDN  (brand-colored SVG, great for dev tools)
   cb(domain)  → Clearbit Logo API (full-color PNG, great for company logos)
   gh(user)    → GitHub avatar     (fallback for GitHub-only projects)
*/
const si = slug   => `https://cdn.simpleicons.org/${slug}`;
const cb = domain => `https://logo.clearbit.com/${domain}`;
const gh = user   => `https://avatars.githubusercontent.com/${user}?s=64`;

/* ── Data ── */
const SECTIONS = [
  {
    id: 'frontend-libs',
    label: 'Frontend Libraries',
    dot: '#a78bfa',
    items: [
      { name: 'React',                       url: 'https://react.dev',                                         note: 'UI framework',                        logo: si('react') },
      { name: 'React DOM',                   url: 'https://react.dev',                                         note: 'DOM rendering',                       logo: si('react') },
      { name: 'React Router DOM',            url: 'https://reactrouter.com',                                   note: 'Client-side routing',                 logo: si('reactrouter') },
      { name: 'Framer Motion',               url: 'https://www.framer.com/motion',                             note: 'Animations',                          logo: si('framer') },
      { name: 'Three.js',                    url: 'https://threejs.org',                                       note: '3D rendering (star background)',       logo: si('threedotjs') },
      { name: '@react-three/fiber',          url: 'https://docs.pmnd.rs/react-three-fiber',                   note: 'React renderer for Three.js',         logo: gh('pmndrs') },
      { name: '@react-three/drei',           url: 'https://github.com/pmndrs/drei',                           note: 'Three.js helpers',                    logo: gh('pmndrs') },
      { name: '@react-three/postprocessing', url: 'https://github.com/pmndrs/react-postprocessing',           note: 'Post-processing effects',             logo: gh('pmndrs') },
      { name: 'Socket.IO Client',            url: 'https://socket.io',                                         note: 'Real-time communication',             logo: si('socketdotio') },
      { name: 'Axios',                       url: 'https://axios-http.com',                                    note: 'HTTP client',                         logo: cb('axios-http.com') },
      { name: 'CryptoJS',                    url: 'https://github.com/brix/crypto-js',                         note: 'Client-side encryption',              logo: gh('brix') },
      { name: 'Lucide React',                url: 'https://lucide.dev',                                        note: 'Icon library',                        logo: cb('lucide.dev') },
      { name: 'date-fns',                    url: 'https://date-fns.org',                                      note: 'Date utilities',                      logo: cb('date-fns.org') },
      { name: 'Luxon',                       url: 'https://moment.github.io/luxon',                            note: 'Date & time handling',                logo: gh('moment') },
      { name: 'React Hot Toast',             url: 'https://react-hot-toast.com',                               note: 'Toast notifications',                 logo: cb('react-hot-toast.com') },
      { name: 'Zustand',                     url: 'https://zustand-demo.pmnd.rs',                              note: 'State management',                    logo: gh('pmndrs') },
      { name: 'html5-qrcode',                url: 'https://github.com/mebjas/html5-qrcode',                   note: 'QR code scanner',                     logo: gh('mebjas') },
      { name: 'clsx',                        url: 'https://github.com/lukeed/clsx',                           note: 'Conditional class names',             logo: gh('lukeed') },
      { name: 'tailwind-merge',              url: 'https://github.com/dcastil/tailwind-merge',                note: 'Tailwind class merging',              logo: si('tailwindcss') },
    ],
  },
  {
    id: 'frontend-tooling',
    label: 'Frontend Tooling',
    dot: '#67e8f9',
    items: [
      { name: 'Vite',            url: 'https://vitejs.dev',                           note: 'Build tool',                  logo: si('vite') },
      { name: 'Tailwind CSS',    url: 'https://tailwindcss.com',                      note: 'CSS utility framework',       logo: si('tailwindcss') },
      { name: 'PostCSS',         url: 'https://postcss.org',                          note: 'CSS processing',              logo: si('postcss') },
      { name: 'Autoprefixer',    url: 'https://github.com/postcss/autoprefixer',      note: 'CSS vendor prefixes',         logo: gh('postcss') },
      { name: 'ESLint',          url: 'https://eslint.org',                           note: 'Code linting',                logo: si('eslint') },
      { name: 'vite-plugin-pwa', url: 'https://vite-pwa-org.netlify.app',             note: 'Progressive web app support', logo: si('vite') },
    ],
  },
  {
    id: 'backend-libs',
    label: 'Backend Libraries',
    dot: '#86efac',
    items: [
      { name: 'Express',                   url: 'https://expressjs.com',                                     note: 'Web framework',                   logo: si('express') },
      { name: 'Mongoose',                  url: 'https://mongoosejs.com',                                    note: 'MongoDB ODM',                     logo: cb('mongoosejs.com') },
      { name: 'Socket.IO',                 url: 'https://socket.io',                                         note: 'Real-time server',                logo: si('socketdotio') },
      { name: 'bcryptjs',                  url: 'https://github.com/dcodeIO/bcrypt.js',                      note: 'Password hashing',                logo: gh('dcodeIO') },
      { name: 'jsonwebtoken',              url: 'https://github.com/auth0/node-jsonwebtoken',                note: 'JWT authentication',              logo: cb('auth0.com') },
      { name: 'Helmet',                    url: 'https://helmetjs.github.io',                                note: 'Security headers',                logo: gh('helmetjs') },
      { name: 'express-rate-limit',        url: 'https://github.com/express-rate-limit/express-rate-limit', note: 'Rate limiting',                   logo: gh('express-rate-limit') },
      { name: 'express-mongo-sanitize',    url: 'https://github.com/fiznool/express-mongo-sanitize',        note: 'NoSQL injection prevention',      logo: gh('fiznool') },
      { name: 'express-validator',         url: 'https://express-validator.github.io',                       note: 'Input validation',                logo: gh('express-validator') },
      { name: 'Multer',                    url: 'https://github.com/expressjs/multer',                       note: 'File upload handling',            logo: gh('expressjs') },
      { name: 'uuid',                      url: 'https://github.com/uuidjs/uuid',                            note: 'Unique ID generation',            logo: gh('uuidjs') },
      { name: 'compression',               url: 'https://github.com/expressjs/compression',                  note: 'Response compression',            logo: gh('expressjs') },
      { name: 'cookie-parser',             url: 'https://github.com/expressjs/cookie-parser',                note: 'Cookie handling',                 logo: gh('expressjs') },
      { name: 'cors',                      url: 'https://github.com/expressjs/cors',                         note: 'Cross-origin resource sharing',   logo: gh('expressjs') },
      { name: 'dotenv',                    url: 'https://github.com/motdotla/dotenv',                        note: 'Environment variables',           logo: gh('motdotla') },
      { name: 'CryptoJS',                  url: 'https://github.com/brix/crypto-js',                         note: 'Encryption',                      logo: gh('brix') },
      { name: 'Stripe SDK',                url: 'https://github.com/stripe/stripe-node',                     note: 'Payment processing client',       logo: si('stripe') },
      { name: 'Cloudinary SDK',            url: 'https://cloudinary.com/documentation/node_integration',    note: 'File storage client',             logo: cb('cloudinary.com') },
      { name: 'node-cron',                 url: 'https://github.com/node-cron/node-cron',                    note: 'Scheduled tasks',                 logo: gh('node-cron') },
      { name: 'Axios',                     url: 'https://axios-http.com',                                    note: 'HTTP client',                     logo: cb('axios-http.com') },
      { name: 'qrcode',                    url: 'https://github.com/soldair/node-qrcode',                    note: 'QR code generation',              logo: gh('soldair') },
      { name: 'ioredis',                   url: 'https://github.com/redis/ioredis',                          note: 'Redis client',                    logo: si('redis') },
      { name: '@socket.io/redis-adapter',  url: 'https://github.com/socketio/socket.io-redis-adapter',      note: 'Socket.IO Redis adapter',         logo: si('socketdotio') },
      { name: 'speakeasy',                 url: 'https://github.com/speakeasyjs/speakeasy',                  note: 'TOTP / 2FA',                      logo: gh('speakeasyjs') },
      { name: 'http-proxy-middleware',     url: 'https://github.com/chimurai/http-proxy-middleware',         note: 'Reverse proxy (router)',          logo: gh('chimurai') },
    ],
  },
  {
    id: 'external-services',
    label: 'External Services',
    dot: '#fbbf24',
    items: [
      { name: 'MongoDB Atlas',            url: 'https://www.mongodb.com/atlas',                              note: 'Primary database',                    logo: si('mongodb') },
      { name: 'Redis',                    url: 'https://redis.io',                                           note: 'Caching, sessions & pub/sub',         logo: si('redis') },
      { name: 'Cloudinary',               url: 'https://cloudinary.com',                                     note: 'File & image hosting',                logo: cb('cloudinary.com') },
      { name: 'Stripe',                   url: 'https://stripe.com',                                         note: 'Payment processing',                  logo: si('stripe') },
      { name: 'Brevo',                    url: 'https://www.brevo.com',                                       note: 'Transactional email',                 logo: cb('brevo.com') },
      { name: 'Mailjet',                  url: 'https://www.mailjet.com',                                     note: 'Email fallback provider',             logo: cb('mailjet.com') },
      { name: 'Google OAuth / Gmail API', url: 'https://developers.google.com/gmail/api',                    note: 'RSVP email auth',                     logo: si('google') },
      { name: 'AbuseIPDB',                url: 'https://www.abuseipdb.com',                                  note: 'IP reputation & fraud detection',     logo: cb('abuseipdb.com') },
      { name: 'ntfy.sh',                  url: 'https://ntfy.sh',                                            note: 'Push notifications (watchdog alerts)',logo: cb('ntfy.sh') },
      { name: 'Discord Webhooks',         url: 'https://discord.com/developers/docs/resources/webhook',      note: 'Alert routing',                       logo: si('discord') },
      { name: 'Render',                   url: 'https://render.com',                                         note: 'Cloud hosting',                       logo: cb('render.com') },
      { name: 'Google Fonts',             url: 'https://fonts.google.com',                                   note: 'Syne & DM Sans typefaces',            logo: si('googlefonts') },
    ],
  },
];

/* ── Logo with graceful fallback ──
   Tries to load the provided src. On error, renders a colored initial box
   derived from a hash of the name so each fallback has a unique hue.
*/
function Logo({ src, name }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const initial = (name || '?')[0].toUpperCase();
  const hue = [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: status === 'ok' ? 'rgba(255,255,255,0.07)' : `hsl(${hue},32%,20%)`,
      border: '1px solid rgba(255,255,255,0.08)',
      transition: 'background 0.2s',
    }}>
      {status !== 'error' && (
        <img
          src={src}
          alt={name}
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
          style={{
            width: 19, height: 19, objectFit: 'contain',
            display: status === 'ok' ? 'block' : 'none',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
          }}
        />
      )}
      {status !== 'ok' && (
        <span style={{ fontSize: 12, fontWeight: 800, color: `hsl(${hue},55%,68%)`, lineHeight: 1, fontFamily: 'inherit' }}>
          {initial}
        </span>
      )}
    </div>
  );
}

/* ── Card ── */
function CreditCard({ name, url, note, logo }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', borderRadius: 10,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.055)'}`,
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        textDecoration: 'none',
        transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.14s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer', minWidth: 0,
      }}
    >
      <Logo src={logo} name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{
            fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em',
            color: hovered ? '#fff' : 'rgba(255,255,255,0.82)',
            transition: 'color 0.18s ease',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {name}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke={hovered ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'}
            strokeWidth="2" strokeLinecap="round"
            style={{ flexShrink: 0, transition: 'stroke 0.18s ease' }}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.32)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {note}
        </p>
      </div>
    </a>
  );
}

/* ── Section ── */
function CreditSection({ section, sectionIndex }) {
  return (
    <div id={section.id} style={{ scrollMarginTop: 80 }}>
      <Reveal delay={sectionIndex * 60}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.dot, boxShadow: `0 0 10px ${section.dot}`, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            {section.label}
          </h2>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums' }}>
            {section.items.length}
          </span>
        </div>
      </Reveal>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 8, marginBottom: 52 }}>
        {section.items.map((item, i) => (
          <Reveal key={item.name} delay={sectionIndex * 35 + i * 15}>
            <CreditCard {...item} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function Credits() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const totalCount = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#05050f', color: 'white', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Grid texture */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
        <defs>
          <pattern id="cg" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(255,255,255,0.018)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cg)" />
      </svg>

      {/* Top ambient glow */}
      <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Sticky nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(5,5,15,0.92)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 clamp(16px, 5vw, 48px)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500, transition: 'color 0.2s', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            PlanIt
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
            {totalCount} dependencies
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px) 96px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 72 }}>
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Open Acknowledgements</span>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(2rem, 6vw, 3.2rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff' }}>
              Credits
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 560 }}>
              PlanIt is built on the shoulders of great open source libraries and reliable external services. Every dependency listed here plays a direct role in making the platform work.
            </p>
          </Reveal>
        </div>

        {/* Quick-jump pills */}
        <Reveal delay={140}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 64 }}>
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
                {s.label}
              </a>
            ))}
          </div>
        </Reveal>

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <CreditSection key={section.id} section={section} sectionIndex={i} />
        ))}

        {/* Footer note */}
        <Reveal>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 40, marginTop: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
              All trademarks and logos are the property of their respective owners. PlanIt is proprietary software — see the{' '}
              <a href="/license" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline', textUnderlineOffset: 3 }}>license page</a> for terms.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}