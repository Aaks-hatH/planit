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

/* ── Data ── */
const SECTIONS = [
  {
    id: 'frontend-libs',
    label: 'Frontend Libraries',
    dot: '#a78bfa',
    items: [
      { name: 'React',                url: 'https://react.dev',                        note: 'UI framework' },
      { name: 'React DOM',            url: 'https://react.dev',                        note: 'DOM rendering' },
      { name: 'React Router DOM',     url: 'https://reactrouter.com',                  note: 'Client-side routing' },
      { name: 'Framer Motion',        url: 'https://www.framer.com/motion',             note: 'Animations' },
      { name: 'Three.js',             url: 'https://threejs.org',                       note: '3D rendering (star background)' },
      { name: '@react-three/fiber',   url: 'https://docs.pmnd.rs/react-three-fiber',   note: 'React renderer for Three.js' },
      { name: '@react-three/drei',    url: 'https://github.com/pmndrs/drei',            note: 'Three.js helpers' },
      { name: '@react-three/postprocessing', url: 'https://github.com/pmndrs/react-postprocessing', note: 'Post-processing effects' },
      { name: 'Socket.IO Client',     url: 'https://socket.io',                        note: 'Real-time communication' },
      { name: 'Axios',                url: 'https://axios-http.com',                   note: 'HTTP client' },
      { name: 'CryptoJS',             url: 'https://github.com/brix/crypto-js',        note: 'Client-side encryption' },
      { name: 'Lucide React',         url: 'https://lucide.dev',                       note: 'Icon library' },
      { name: 'date-fns',             url: 'https://date-fns.org',                     note: 'Date utilities' },
      { name: 'Luxon',                url: 'https://moment.github.io/luxon',           note: 'Date & time handling' },
      { name: 'React Hot Toast',      url: 'https://react-hot-toast.com',              note: 'Toast notifications' },
      { name: 'Zustand',              url: 'https://zustand-demo.pmnd.rs',             note: 'State management' },
      { name: 'html5-qrcode',         url: 'https://github.com/mebjas/html5-qrcode',  note: 'QR code scanner' },
      { name: 'clsx',                 url: 'https://github.com/lukeed/clsx',           note: 'Conditional class names' },
      { name: 'tailwind-merge',       url: 'https://github.com/dcastil/tailwind-merge', note: 'Tailwind class merging' },
    ],
  },
  {
    id: 'frontend-tooling',
    label: 'Frontend Tooling',
    dot: '#67e8f9',
    items: [
      { name: 'Vite',            url: 'https://vitejs.dev',                           note: 'Build tool' },
      { name: 'Tailwind CSS',    url: 'https://tailwindcss.com',                      note: 'CSS utility framework' },
      { name: 'PostCSS',         url: 'https://postcss.org',                          note: 'CSS processing' },
      { name: 'Autoprefixer',    url: 'https://github.com/postcss/autoprefixer',      note: 'CSS vendor prefixes' },
      { name: 'ESLint',          url: 'https://eslint.org',                           note: 'Code linting' },
      { name: 'vite-plugin-pwa', url: 'https://vite-pwa-org.netlify.app',             note: 'Progressive web app support' },
    ],
  },
  {
    id: 'backend-libs',
    label: 'Backend Libraries',
    dot: '#86efac',
    items: [
      { name: 'Express',                    url: 'https://expressjs.com',                            note: 'Web framework' },
      { name: 'Mongoose',                   url: 'https://mongoosejs.com',                           note: 'MongoDB ODM' },
      { name: 'Socket.IO',                  url: 'https://socket.io',                                note: 'Real-time server' },
      { name: 'bcryptjs',                   url: 'https://github.com/dcodeIO/bcrypt.js',             note: 'Password hashing' },
      { name: 'jsonwebtoken',               url: 'https://github.com/auth0/node-jsonwebtoken',       note: 'JWT authentication' },
      { name: 'Helmet',                     url: 'https://helmetjs.github.io',                       note: 'Security headers' },
      { name: 'express-rate-limit',         url: 'https://github.com/express-rate-limit/express-rate-limit', note: 'Rate limiting' },
      { name: 'express-mongo-sanitize',     url: 'https://github.com/fiznool/express-mongo-sanitize', note: 'NoSQL injection prevention' },
      { name: 'express-validator',          url: 'https://express-validator.github.io',              note: 'Input validation' },
      { name: 'Multer',                     url: 'https://github.com/expressjs/multer',              note: 'File upload handling' },
      { name: 'uuid',                       url: 'https://github.com/uuidjs/uuid',                   note: 'Unique ID generation' },
      { name: 'compression',                url: 'https://github.com/expressjs/compression',         note: 'Response compression' },
      { name: 'cookie-parser',              url: 'https://github.com/expressjs/cookie-parser',       note: 'Cookie handling' },
      { name: 'cors',                       url: 'https://github.com/expressjs/cors',                note: 'Cross-origin resource sharing' },
      { name: 'dotenv',                     url: 'https://github.com/motdotla/dotenv',               note: 'Environment variables' },
      { name: 'CryptoJS',                   url: 'https://github.com/brix/crypto-js',                note: 'Encryption' },
      { name: 'Stripe SDK',                 url: 'https://github.com/stripe/stripe-node',            note: 'Payment processing client' },
      { name: 'Cloudinary SDK',             url: 'https://cloudinary.com/documentation/node_integration', note: 'File storage client' },
      { name: 'node-cron',                  url: 'https://github.com/node-cron/node-cron',           note: 'Scheduled tasks' },
      { name: 'Axios',                      url: 'https://axios-http.com',                           note: 'HTTP client' },
      { name: 'qrcode',                     url: 'https://github.com/soldair/node-qrcode',           note: 'QR code generation' },
      { name: 'ioredis',                    url: 'https://github.com/redis/ioredis',                 note: 'Redis client' },
      { name: '@socket.io/redis-adapter',   url: 'https://github.com/socketio/socket.io-redis-adapter', note: 'Socket.IO Redis adapter' },
      { name: 'speakeasy',                  url: 'https://github.com/speakeasyjs/speakeasy',         note: 'TOTP / 2FA' },
      { name: 'http-proxy-middleware',      url: 'https://github.com/chimurai/http-proxy-middleware', note: 'Reverse proxy (router)' },
    ],
  },
  {
    id: 'external-services',
    label: 'External Services',
    dot: '#fbbf24',
    items: [
      { name: 'MongoDB Atlas',    url: 'https://www.mongodb.com/atlas',         note: 'Primary database' },
      { name: 'Redis',            url: 'https://redis.io',                      note: 'Caching, sessions & pub/sub' },
      { name: 'Cloudinary',       url: 'https://cloudinary.com',                note: 'File & image hosting' },
      { name: 'Stripe',           url: 'https://stripe.com',                    note: 'Payment processing' },
      { name: 'Brevo',            url: 'https://www.brevo.com',                 note: 'Transactional email' },
      { name: 'Mailjet',          url: 'https://www.mailjet.com',               note: 'Email fallback provider' },
      { name: 'Google OAuth / Gmail API', url: 'https://developers.google.com/gmail/api', note: 'RSVP email auth' },
      { name: 'AbuseIPDB',        url: 'https://www.abuseipdb.com',             note: 'IP reputation & fraud detection' },
      { name: 'ntfy.sh',          url: 'https://ntfy.sh',                       note: 'Push notifications (watchdog alerts)' },
      { name: 'Discord Webhooks', url: 'https://discord.com/developers/docs/resources/webhook', note: 'Alert routing' },
      { name: 'Render',           url: 'https://render.com',                    note: 'Cloud hosting' },
      { name: 'Google Fonts',     url: 'https://fonts.google.com',              note: 'Syne & DM Sans typefaces' },
    ],
  },
];

/* ── Card component ── */
function CreditCard({ name, url, note, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.055)'}`,
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        textDecoration: 'none',
        transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: hovered ? '#fff' : 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em', transition: 'color 0.2s ease' }}>
          {name}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: 'stroke 0.2s ease' }}>
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{note}</p>
    </a>
  );
}

/* ── Section component ── */
function CreditSection({ section, sectionIndex }) {
  const totalItems = section.items.length;
  return (
    <div id={section.id} style={{ scrollMarginTop: 80 }}>
      <Reveal delay={sectionIndex * 60}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.dot, boxShadow: `0 0 10px ${section.dot}`, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            {section.label}
          </h2>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums' }}>
            {totalItems}
          </span>
        </div>
      </Reveal>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginBottom: 48 }}>
        {section.items.map((item, i) => (
          <Reveal key={item.name} delay={sectionIndex * 40 + i * 18}>
            <CreditCard {...item} index={i} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ── */
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
      {/* ── Subtle grid ── */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
        <defs>
          <pattern id="cg" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(255,255,255,0.018)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cg)" />
      </svg>

      {/* ── Top gradient blob ── */}
      <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Nav bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(5,5,15,0.92)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 clamp(16px, 5vw, 48px)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

      {/* ── Page content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px) 96px' }}>

        {/* ── Hero ── */}
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

        {/* ── Quick-jump nav ── */}
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

        {/* ── Sections ── */}
        {SECTIONS.map((section, i) => (
          <CreditSection key={section.id} section={section} sectionIndex={i} />
        ))}

        {/* ── Footer note ── */}
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