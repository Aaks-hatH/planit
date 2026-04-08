/**
 * WLHome.jsx
 *
 * Branded landing page shown at / on a white-label domain.
 * Reads from wl.pages.home and wl.branding via context.
 * Falls back to sensible defaults if fields aren't set.
 *
 * Structure:
 *   - Nav bar (logo + company name + dashboard link)
 *   - Hero (headline, subheadline, hero image, CTA button)
 *   - Events grid (live from /api/events/public/discover for this domain)
 *   - Contact bar (email / phone / address from pages.contact)
 *   - Minimal footer
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import { Calendar, MapPin, Users, Search, ArrowRight, Clock, ChevronRight } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function WLHome() {
  const navigate = useNavigate();
  const { wl } = useWhiteLabel();

  const branding  = wl?.branding  || {};
  const pages     = wl?.pages     || {};
  const features  = wl?.features  || {};
  const contact   = pages.contact || {};
  const home      = pages.home    || {};

  const primary  = branding.primaryColor || '#2563eb';
  const accent   = branding.accentColor  || primary;
  const font     = branding.fontFamily   || 'Inter';
  const company  = branding.companyName  || wl?.clientName || 'Welcome';
  const logo     = branding.logoUrl      || null;

  // If the owner linked a table service event, redirect the home page straight
  // to that event's floor/reservation view instead of showing the events grid.
  const linkedEventId = home.tableServiceEventId?.trim();
  useEffect(() => {
    if (linkedEventId) {
      navigate(`/e/${linkedEventId}/reserve`, { replace: true });
    }
  }, [linkedEventId]);

  // Don't render the rest while redirecting
  if (linkedEventId) return null;

  const headline    = home.headline    || `Welcome to ${company}`;
  const subheadline = home.subheadline || 'Browse and book upcoming events.';
  const heroImg     = home.heroImageUrl || null;
  const ctaText     = home.ctaText     || 'Browse events';
  const showSearch  = home.showSearch  !== false;

  const [events, setEvents]   = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch public events scoped to this WL domain
    fetch(`${API_URL}/events/public/wl?domain=${encodeURIComponent(window.location.hostname)}&limit=12`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(e =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  );

  const isEmpty = !loading && filtered.length === 0;

  return (
    <div style={{ minHeight: '100vh', fontFamily: `'${font}', system-ui, sans-serif`, background: '#fafafa', color: '#111' }}>

      {/* Nav */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
          {logo
            ? <img src={logo} alt={company} style={{ height: 32, objectFit: 'contain' }} />
            : <div style={{ width: 32, height: 32, borderRadius: 8, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={16} color="#fff" />
              </div>
          }
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111', letterSpacing: '-0.02em' }}>{company}</span>
          <div style={{ flex: 1 }} />
          {wl?.portalEnabled && (
            <a href="/dashboard"
              style={{ fontSize: '0.8rem', fontWeight: 600, color: primary, textDecoration: 'none', padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${primary}33`, transition: 'background 0.15s' }}
              onMouseEnter={e => e.target.style.background = `${primary}10`}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              Client login
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section style={{
        position: 'relative',
        background: heroImg ? 'transparent' : `linear-gradient(135deg, ${primary}15 0%, ${accent}08 100%)`,
        borderBottom: '1px solid #e5e5e5',
        overflow: 'hidden',
      }}>
        {heroImg && (
          <>
            <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          </>
        )}
        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '72px 24px 64px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: '1rem',
            color: heroImg ? '#fff' : '#111',
          }}>
            {headline}
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: heroImg ? 'rgba(255,255,255,0.85)' : '#555',
            maxWidth: 540,
            margin: '0 auto 2rem',
            lineHeight: 1.6,
          }}>
            {subheadline}
          </p>
          <a href="#events"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 12,
              background: primary, color: '#fff',
              fontWeight: 700, fontSize: '0.95rem',
              textDecoration: 'none',
              boxShadow: `0 4px 20px ${primary}55`,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}>
            {ctaText} <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Events section */}
      <main id="events" style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {pages.events?.headline || 'Upcoming events'}
          </h2>
          {showSearch && (
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events..."
                style={{
                  paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
                  borderRadius: 10, border: '1.5px solid #e5e5e5', fontSize: '0.875rem',
                  outline: 'none', background: '#fff', width: 220,
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = primary}
                onBlur={e => e.target.style.borderColor = '#e5e5e5'}
              />
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden', animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ height: 160, background: '#f5f5f5' }} />
                <div style={{ padding: 20 }}>
                  <div style={{ height: 18, background: '#f0f0f0', borderRadius: 6, marginBottom: 10, width: '70%' }} />
                  <div style={{ height: 14, background: '#f0f0f0', borderRadius: 6, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '72px 24px', color: '#999' }}>
            <Calendar size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9rem' }}>
              {pages.events?.emptyStateText || 'No upcoming events right now. Check back soon.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filtered.map(event => (
              <EventCard key={event._id} event={event} primary={primary} accent={accent} navigate={navigate} />
            ))}
          </div>
        )}
      </main>

      {/* Contact bar */}
      {(contact.email || contact.phone || contact.address) && (
        <section style={{ background: '#fff', borderTop: '1px solid #e5e5e5', padding: '28px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', fontSize: '0.875rem', color: '#555' }}>
            {contact.email && (
              <a href={`mailto:${contact.email}`} style={{ color: primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} style={{ color: primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />
                {contact.phone}
              </a>
            )}
            {contact.address && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} style={{ color: primary, flexShrink: 0 }} />
                {contact.address}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ background: '#fff', borderTop: '1px solid #e5e5e5', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: '#bbb' }}>{company}</span>
          {!branding.hidePoweredBy && (
            <a href="https://planitapp.onrender.com" target="_blank" rel="noreferrer"
              style={{ fontSize: '0.75rem', color: '#ccc', textDecoration: 'none' }}>
              Powered by PlanIt
            </a>
          )}
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}

function EventCard({ event, primary, accent, navigate }) {
  const daysUntil = event.date ? Math.ceil((new Date(event.date) - Date.now()) / 86400000) : null;
  const isSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
  const isPast = daysUntil !== null && daysUntil < 0;

  return (
    <div
      onClick={() => navigate(`/e/${event.subdomain}`)}
      style={{
        background: '#fff', borderRadius: 16,
        border: '1.5px solid #e5e5e5',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${primary}20`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
    >
      {/* Image or color block */}
      <div style={{ height: 140, background: `linear-gradient(135deg, ${primary}22, ${accent}15)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {event.coverImage
          ? <img src={event.coverImage} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <Calendar size={32} style={{ color: primary, opacity: 0.4 }} />
        }
        {isSoon && (
          <span style={{ position: 'absolute', top: 10, right: 10, background: primary, color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d away`}
          </span>
        )}
        {isPast && (
          <span style={{ position: 'absolute', top: 10, right: 10, background: '#6b7280', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
            Past
          </span>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, letterSpacing: '-0.01em', color: '#111', lineHeight: 1.3 }}>
          {event.title}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#777', fontSize: '0.8rem' }}>
          {event.date && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} style={{ color: primary, flexShrink: 0 }} />
              {fmtDate(event.date)} · {fmtTime(event.date)}
            </span>
          )}
          {event.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} style={{ color: primary, flexShrink: 0 }} />
              {event.location}
            </span>
          )}
          {event.maxParticipants > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={12} style={{ color: primary, flexShrink: 0 }} />
              {event.participantCount || 0} / {event.maxParticipants} spots
            </span>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: primary }}>
            View details
          </span>
          <ChevronRight size={14} style={{ color: primary }} />
        </div>
      </div>
    </div>
  );
}
