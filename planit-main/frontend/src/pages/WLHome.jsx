/**
 * WLHome.jsx
 *
 * Branded landing page shown at / on a white-label domain.
 * Reads from wl.pages.home and wl.branding via context.
 *
 * Structure:
 *   - Glass nav (logo + company, Create event, Client login)
 *   - Hero (headline, subheadline, optional hero image, CTA)
 *   - Featured next event + events grid (live from /api/events/public/wl)
 *   - Contact strip + footer
 *
 * If the owner linked a homepage event (pages.home.tableServiceEventId) the
 * visitor is redirected straight to that event instead.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import { Calendar, MapPin, Users, Search, ArrowRight, Clock, Mail, Phone } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const fmtDay   = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime  = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const eventUrl = (e) => (e.isTableServiceMode ? `/e/${e.subdomain}/reserve` : `/e/${e.subdomain}`);

export default function WLHome() {
  const navigate = useNavigate();
  const { wl, resolved } = useWhiteLabel();

  const branding = wl?.branding || {};
  const pages    = wl?.pages    || {};
  const contact  = pages.contact || {};
  const home     = pages.home    || {};

  const primary = branding.primaryColor || '#2563eb';
  const accent  = branding.accentColor  || primary;
  const font    = branding.fontFamily   || 'Inter';
  const company = branding.companyName  || wl?.clientName || 'Welcome';
  const logo    = branding.logoUrl      || null;

  // Linked homepage event → redirect straight to it.
  const linkedEventId       = home.tableServiceEventId?.trim();
  const linkedEventKind     = wl?.linkedEventKind; // 'table_service' | 'standard' | null
  const linkedEventNotFound = resolved && !!linkedEventId && !linkedEventKind;

  useEffect(() => {
    if (!resolved || !linkedEventId || !linkedEventKind) return;
    navigate(linkedEventKind === 'table_service' ? `/e/${linkedEventId}/reserve` : `/e/${linkedEventId}`, { replace: true });
  }, [resolved, linkedEventId, linkedEventKind, navigate]);

  const [events, setEvents]   = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true); setFailed(false);
    fetch(`${API_URL}/events/public/wl?domain=${encodeURIComponent(window.location.hostname)}&limit=24`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setEvents(d.events || []))
      .catch(() => { setEvents([]); setFailed(true); })
      .finally(() => setLoading(false));
  }, [attempt]);

  // Upcoming first; drop events that ended more than a day ago.
  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return events
      .filter(e => !e.date || new Date(e.date).getTime() >= cutoff)
      .sort((a, b) => (new Date(a.date || 8.64e15)) - (new Date(b.date || 8.64e15)));
  }, [events]);

  const q = search.trim().toLowerCase();
  const filtered = upcoming.filter(e => !q || e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q));
  const featured = !q && filtered.length > 2 ? filtered[0] : null;
  const grid     = featured ? filtered.slice(1) : filtered;

  if (linkedEventId && !linkedEventNotFound) return null;

  const headline    = home.headline    || `Welcome to ${company}`;
  const subheadline = home.subheadline || 'Browse and book upcoming events.';
  const heroImg     = home.heroImageUrl || null;
  const ctaText     = home.ctaText     || 'Browse events';
  const showSearch  = home.showSearch  !== false;
  const hasContact  = contact.email || contact.phone || contact.address;

  return (
    <div className="wlh" style={{ '--p': primary, '--a': accent, fontFamily: `'${font}', system-ui, -apple-system, sans-serif` }}>
      <style>{css}</style>

      {/* Nav */}
      <header className="wlh-nav">
        <div className="wlh-wrap wlh-nav-in">
          {logo
            ? <img src={logo} alt={company} className="wlh-logo" />
            : <span className="wlh-mark"><Calendar size={16} color="#fff" /></span>}
          <span className="wlh-brand">{company}</span>
          <span style={{ flex: 1 }} />
          <button className="wlh-btn wlh-btn-solid wlh-sm" onClick={() => navigate('/?new=1')}>Create event</button>
          {wl?.portalEnabled && <a href="/dashboard" className="wlh-btn wlh-btn-ghost wlh-sm">Client login</a>}
        </div>
      </header>

      {/* Hero */}
      <section className={`wlh-hero ${heroImg ? 'has-img' : ''}`}>
        {heroImg && <><img src={heroImg} alt="" className="wlh-hero-img" /><div className="wlh-hero-shade" /></>}
        {!heroImg && <><div className="wlh-orb wlh-orb-1" /><div className="wlh-orb wlh-orb-2" /></>}
        <div className="wlh-wrap wlh-hero-in">
          <h1>{headline}</h1>
          <p>{subheadline}</p>
          <div className="wlh-hero-cta">
            <a href="#events" className="wlh-btn wlh-btn-solid wlh-lg">{ctaText} <ArrowRight size={16} /></a>
            {upcoming.length > 0 && <span className="wlh-count">{upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'}</span>}
          </div>
        </div>
      </section>

      {/* Events */}
      <main id="events" className="wlh-wrap wlh-main">
        <div className="wlh-bar">
          <h2>{pages.events?.headline || 'Upcoming events'}</h2>
          {showSearch && upcoming.length > 0 && (
            <label className="wlh-search">
              <Search size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events" />
            </label>
          )}
        </div>

        {loading && (
          <div className="wlh-grid">
            {[1, 2, 3].map(i => <div key={i} className="wlh-card wlh-skel"><div className="wlh-skel-img" /><div className="wlh-skel-l" /><div className="wlh-skel-l s" /></div>)}
          </div>
        )}

        {!loading && failed && (
          <div className="wlh-empty">
            <p>We couldn’t load events right now.</p>
            <button className="wlh-btn wlh-btn-ghost wlh-sm" onClick={() => setAttempt(n => n + 1)}>Try again</button>
          </div>
        )}

        {!loading && !failed && filtered.length === 0 && (
          <div className="wlh-empty">
            <span className="wlh-empty-ic"><Calendar size={26} /></span>
            <p>{q ? `No events match “${search}”.` : (pages.events?.emptyStateText || 'No upcoming events right now. Check back soon.')}</p>
          </div>
        )}

        {!loading && featured && (
          <article className="wlh-feature" onClick={() => navigate(eventUrl(featured))}>
            <div className="wlh-feature-img" style={featured.coverImage ? { backgroundImage: `url(${featured.coverImage})` } : undefined}>
              {!featured.coverImage && <Calendar size={44} />}
            </div>
            <div className="wlh-feature-body">
              <span className="wlh-pill">Next up</span>
              <h3>{featured.title}</h3>
              {featured.description && <p className="wlh-desc">{featured.description}</p>}
              <Meta e={featured} />
              <span className="wlh-btn wlh-btn-solid wlh-sm" style={{ alignSelf: 'flex-start' }}>
                {featured.isTableServiceMode ? 'Reserve a table' : 'View event'} <ArrowRight size={14} />
              </span>
            </div>
          </article>
        )}

        {!loading && grid.length > 0 && (
          <div className="wlh-grid">
            {grid.map(e => <Card key={e._id} e={e} onOpen={() => navigate(eventUrl(e))} />)}
          </div>
        )}
      </main>

      {hasContact && (
        <section className="wlh-contact">
          <div className="wlh-wrap wlh-contact-in">
            {contact.email   && <a href={`mailto:${contact.email}`}><Mail size={14} /> {contact.email}</a>}
            {contact.phone   && <a href={`tel:${contact.phone}`}><Phone size={14} /> {contact.phone}</a>}
            {contact.address && <span><MapPin size={14} /> {contact.address}</span>}
          </div>
        </section>
      )}

      <footer className="wlh-foot">
        <div className="wlh-wrap wlh-foot-in">
          <span>© {new Date().getFullYear()} {company}</span>
          {!branding.hidePoweredBy && <a href="https://planitapp.onrender.com" target="_blank" rel="noreferrer">Powered by PlanIt</a>}
        </div>
      </footer>
    </div>
  );
}

function Meta({ e }) {
  return (
    <div className="wlh-meta">
      {e.date && <span><Clock size={13} /> {fmtDay(e.date)} · {fmtTime(e.date)}</span>}
      {e.location && <span><MapPin size={13} /> {e.location}</span>}
      {e.maxParticipants > 0 && !e.isTableServiceMode && <span><Users size={13} /> {e.participantCount || 0} / {e.maxParticipants} spots</span>}
    </div>
  );
}

function Card({ e, onOpen }) {
  const days = e.date ? Math.ceil((new Date(e.date) - Date.now()) / 86400000) : null;
  const badge = days === null ? null : days < 0 ? 'Happening now' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days <= 7 ? `In ${days} days` : null;
  return (
    <article className="wlh-card" onClick={onOpen} tabIndex={0} onKeyDown={ev => ev.key === 'Enter' && onOpen()}>
      <div className="wlh-card-img" style={e.coverImage ? { backgroundImage: `url(${e.coverImage})` } : undefined}>
        {!e.coverImage && <Calendar size={30} />}
        {badge && <span className="wlh-badge">{badge}</span>}
      </div>
      <div className="wlh-card-body">
        <h3>{e.title}</h3>
        <Meta e={e} />
        <span className="wlh-link">{e.isTableServiceMode ? 'Reserve a table' : 'View details'} <ArrowRight size={14} /></span>
      </div>
    </article>
  );
}

const css = `
.wlh{min-height:100dvh;background:#f7f7f9;color:#111827;-webkit-font-smoothing:antialiased}
.wlh *{box-sizing:border-box}
.wlh h1,.wlh h2,.wlh h3,.wlh p{margin:0}
.wlh-wrap{max-width:1120px;margin:0 auto;padding:0 24px}

.wlh-nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid rgba(0,0,0,.06)}
.wlh-nav-in{height:64px;display:flex;align-items:center;gap:12px}
.wlh-logo{height:32px;max-width:160px;object-fit:contain}
.wlh-mark{width:32px;height:32px;border-radius:9px;background:var(--p);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wlh-brand{font-weight:700;font-size:1rem;letter-spacing:-.02em}

.wlh-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:600;border:0;cursor:pointer;text-decoration:none;border-radius:11px;transition:transform .15s,box-shadow .15s,background .15s}
.wlh-sm{font-size:.82rem;padding:9px 15px}
.wlh-lg{font-size:.98rem;padding:14px 26px;border-radius:13px}
.wlh-btn-solid{background:var(--p);color:#fff;box-shadow:0 4px 14px color-mix(in srgb,var(--p) 35%,transparent)}
.wlh-btn-solid:hover{transform:translateY(-1px);box-shadow:0 8px 22px color-mix(in srgb,var(--p) 40%,transparent)}
.wlh-btn-ghost{background:transparent;color:var(--p);border:1.5px solid color-mix(in srgb,var(--p) 28%,transparent)}
.wlh-btn-ghost:hover{background:color-mix(in srgb,var(--p) 8%,transparent)}

.wlh-hero{position:relative;overflow:hidden;background:#fff;border-bottom:1px solid rgba(0,0,0,.06)}
.wlh-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.wlh-hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.62))}
.wlh-orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.28;pointer-events:none}
.wlh-orb-1{width:420px;height:420px;background:var(--p);top:-160px;left:-80px}
.wlh-orb-2{width:360px;height:360px;background:var(--a);bottom:-180px;right:-60px}
.wlh-hero-in{position:relative;padding:92px 24px 84px;text-align:center}
.wlh-hero h1{font-size:clamp(2.1rem,5.4vw,3.6rem);font-weight:800;letter-spacing:-.045em;line-height:1.05;max-width:820px;margin:0 auto 18px}
.wlh-hero p{font-size:clamp(1rem,2vw,1.2rem);color:#4b5563;line-height:1.6;max-width:560px;margin:0 auto 32px}
.wlh-hero.has-img h1{color:#fff}.wlh-hero.has-img p{color:rgba(255,255,255,.88)}
.wlh-hero-cta{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}
.wlh-count{font-size:.85rem;font-weight:600;color:#6b7280;background:rgba(255,255,255,.75);padding:7px 13px;border-radius:999px;border:1px solid rgba(0,0,0,.06)}

.wlh-main{padding-top:52px;padding-bottom:64px;scroll-margin-top:64px}
.wlh-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:26px}
.wlh-bar h2{font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
.wlh-search{position:relative;display:flex;align-items:center}
.wlh-search svg{position:absolute;left:13px;color:#9ca3af}
.wlh-search input{font:inherit;font-size:.88rem;width:240px;max-width:100%;padding:10px 14px 10px 37px;border-radius:11px;border:1.5px solid #e5e7eb;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}
.wlh-search input:focus{border-color:var(--p);box-shadow:0 0 0 4px color-mix(in srgb,var(--p) 14%,transparent)}

.wlh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px}
.wlh-card{background:#fff;border-radius:18px;border:1px solid #ececf0;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .18s,box-shadow .18s,border-color .18s;outline:none}
.wlh-card:hover,.wlh-card:focus-visible{transform:translateY(-3px);box-shadow:0 14px 34px rgba(17,24,39,.09);border-color:color-mix(in srgb,var(--p) 35%,#ececf0)}
.wlh-card-img,.wlh-feature-img{position:relative;background:linear-gradient(135deg,color-mix(in srgb,var(--p) 18%,#fff),color-mix(in srgb,var(--a) 10%,#fff)) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--p)}
.wlh-card-img{height:160px}
.wlh-card-img svg,.wlh-feature-img svg{opacity:.45}
.wlh-badge{position:absolute;top:12px;left:12px;background:#fff;color:var(--p);font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.wlh-card-body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:12px;flex:1}
.wlh-card h3{font-size:1.02rem;font-weight:700;letter-spacing:-.015em;line-height:1.3}
.wlh-meta{display:flex;flex-direction:column;gap:6px;font-size:.82rem;color:#6b7280}
.wlh-meta span{display:flex;align-items:center;gap:7px}
.wlh-meta svg{color:var(--p);flex-shrink:0}
.wlh-link{margin-top:auto;display:inline-flex;align-items:center;gap:6px;font-size:.84rem;font-weight:700;color:var(--p)}
.wlh-card:hover .wlh-link svg{transform:translateX(3px)}.wlh-link svg{transition:transform .15s}

.wlh-feature{display:grid;grid-template-columns:1.1fr 1fr;background:#fff;border:1px solid #ececf0;border-radius:22px;overflow:hidden;cursor:pointer;margin-bottom:26px;transition:box-shadow .18s,transform .18s}
.wlh-feature:hover{box-shadow:0 18px 44px rgba(17,24,39,.1);transform:translateY(-2px)}
.wlh-feature-img{min-height:300px}
.wlh-feature-body{padding:34px 34px 36px;display:flex;flex-direction:column;gap:14px;justify-content:center}
.wlh-feature h3{font-size:1.65rem;font-weight:800;letter-spacing:-.035em;line-height:1.15}
.wlh-desc{color:#4b5563;line-height:1.6;font-size:.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.wlh-pill{align-self:flex-start;background:color-mix(in srgb,var(--p) 12%,#fff);color:var(--p);font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:5px 11px;border-radius:999px}
@media(max-width:760px){.wlh-feature{grid-template-columns:1fr}.wlh-feature-img{min-height:190px}.wlh-feature-body{padding:24px}.wlh-hero-in{padding:64px 20px 58px}.wlh-wrap{padding:0 18px}.wlh-search input{width:100%}.wlh-search{width:100%}}

.wlh-empty{text-align:center;padding:72px 20px;color:#6b7280;display:flex;flex-direction:column;align-items:center;gap:14px;background:#fff;border:1px dashed #d9d9e0;border-radius:20px}
.wlh-empty-ic{width:56px;height:56px;border-radius:16px;background:color-mix(in srgb,var(--p) 10%,#fff);color:var(--p);display:flex;align-items:center;justify-content:center}

.wlh-skel{pointer-events:none;padding-bottom:20px}
.wlh-skel-img{height:160px;background:#f0f0f3;margin-bottom:18px}
.wlh-skel-l{height:14px;background:#f0f0f3;border-radius:6px;margin:0 20px 10px;width:70%}.wlh-skel-l.s{width:45%}
.wlh-skel>*{animation:wlhp 1.4s ease-in-out infinite}
@keyframes wlhp{0%,100%{opacity:1}50%{opacity:.5}}

.wlh-contact{background:#fff;border-top:1px solid #ececf0}
.wlh-contact-in{display:flex;flex-wrap:wrap;gap:12px 30px;justify-content:center;padding-top:26px;padding-bottom:26px;font-size:.88rem;color:#4b5563}
.wlh-contact-in a,.wlh-contact-in span{display:inline-flex;align-items:center;gap:7px;color:inherit;text-decoration:none}
.wlh-contact-in a:hover{color:var(--p)}.wlh-contact-in svg{color:var(--p)}
.wlh-foot{background:#fff;border-top:1px solid #ececf0}
.wlh-foot-in{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:20px;padding-bottom:20px;font-size:.78rem;color:#9ca3af}
.wlh-foot-in a{color:#9ca3af;text-decoration:none}.wlh-foot-in a:hover{color:#6b7280}
`;
