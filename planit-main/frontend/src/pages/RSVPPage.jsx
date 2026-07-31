/**
 * frontend/src/pages/RSVPPage.jsx
 *
 * Public, guest-facing RSVP page. Rewritten around the shared
 * RSVPPageRenderer (Part 3) — this file now only handles the page-level
 * gating states that existed before section-based blocks were a concept:
 * loading, not-found, password gate, RSVPs-closed, and the post-submit
 * confirmation screen. Everything about what's actually on the page (hero,
 * about, agenda, the form, etc.) is section data rendered by
 * RSVPPageRenderer — identical code path to the builder's preview pane.
 *
 * Deliberately does NOT import dnd-kit, or anything from
 * RSVPPageBuilder.jsx — this is the file the bundle-size requirement in
 * RSVPPageRenderer.jsx's header is about; verify with the real bundler
 * before calling Part 3 done.
 */
import { useState, useEffect, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, X, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';
import RSVPPageRenderer from '../components/RSVPPageRenderer';
import { FONTS, getBgStyle } from '../components/rsvpBlocks/theme';

// Code-split: only guests who actually submit ever need this screen, and it's
// the only thing in this file that pulled in luxon + the canvas share-card
// generator (~270kb combined) — see RSVPConfirmationScreen.jsx's header.
const RSVPConfirmationScreen = lazy(() => import('./RSVPConfirmationScreen'));

/* ─── Password gate — page-level, not a section block ────────────────────── */
function PasswordGate({ eventId, accent, bgStyle, fontStyle, onUnlocked }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const fonts = FONTS[fontStyle] || FONTS.modern;

  const submit = async (e) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true); setErr('');
    try {
      await rsvpAPI.verifyPassword(eventId, pw.trim());
      sessionStorage.setItem(`rsvp_pw_${eventId}`, pw.trim());
      onUnlocked(pw.trim());
    } catch {
      setErr('Incorrect password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={getBgStyle(bgStyle, accent)}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <Lock style={{ color: accent }} className="w-7 h-7" />
          </div>
          <h2 className={`text-xl mb-2 ${fonts.heading}`}>This RSVP is password-protected</h2>
          <p className="text-sm opacity-50">Enter the password to view and RSVP to this event.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter password"
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', borderColor: err ? '#ef4444' : 'rgba(255,255,255,0.12)', color: 'inherit' }} autoFocus />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold transition-all" style={{ background: accent, color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function RSVPPage() {
  const { slug } = useParams();

  const [pageData, setPageData] = useState(null);
  const [config, setConfig] = useState(null);
  const [coverUrlsById, setCoverUrlsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pwUnlocked, setPwUnlocked] = useState(false);
  const [unlockedPw, setUnlockedPw] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => { loadPage(); }, [slug]);

  const loadPage = async () => {
    try {
      const res = await rsvpAPI.getPage(slug);
      setPageData(res.data);
      // Public config + resolved cover URL travel together on the same
      // response so guests never see a flash of missing sections; the
      // backend attaches both (see GET /rsvp/:idOrSlug/page).
      setConfig(res.data.rsvpPageConfig || { accentColor: '#6366f1', sections: [] });
      setCoverUrlsById(res.data.coverUrlsById || {});
      if (res.data.requiresPassword) {
        const cached = sessionStorage.getItem(`rsvp_pw_${res.data.eventId}`);
        if (cached) { setPwUnlocked(true); setUnlockedPw(cached); }
      }
    } catch {
      setError('Event not found or RSVP is not available.');
    } finally { setLoading(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}><div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" /></div>;
  }
  if (error || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12', color: '#fff' }}>
        <div className="text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm opacity-50">{error || 'RSVP page not found.'}</p>
          <a href="/" className="text-xs underline opacity-30">Return home</a>
        </div>
      </div>
    );
  }

  const { rsvpPage, eventId } = pageData;
  const accent = config?.accentColor || rsvpPage.accentColor || '#6366f1';
  const bgStyleKey = rsvpPage.backgroundStyle || 'dark';
  const fontStyle = rsvpPage.fontStyle || 'modern';
  const fonts = FONTS[fontStyle] || FONTS.modern;
  const bg = getBgStyle(bgStyleKey, accent);

  if (rsvpPage.accessMode === 'password' && !pwUnlocked) {
    return <PasswordGate eventId={eventId} accent={accent} bgStyle={bgStyleKey} fontStyle={fontStyle} onUnlocked={(pw) => { setPwUnlocked(true); setUnlockedPw(pw); }} />;
  }

  if (!rsvpPage.enabled || rsvpPage.accessMode === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bg}>
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <X style={{ color: accent }} className="w-6 h-6" />
          </div>
          <h2 className={`text-xl ${fonts.heading}`}>RSVPs are closed</h2>
          <p className="text-sm opacity-50">This event is no longer accepting RSVPs.</p>
        </div>
      </div>
    );
  }

  if (submitResult) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={bg}><div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" /></div>}>
        <RSVPConfirmationScreen data={submitResult} rsvpPage={rsvpPage} event={pageData} accent={accent} bgStyle={bgStyleKey} fontStyle={fontStyle} />
      </Suspense>
    );
  }

  return (
    <>
      {rsvpPage.backgroundImageUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: `url(${rsvpPage.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', opacity: 0.15, pointerEvents: 'none' }} />
      )}
      {rsvpPage.bannerEnabled && rsvpPage.bannerText && (
        <div className="sticky top-0 z-20 text-center text-xs font-semibold py-2.5 px-4" style={{ background: rsvpPage.bannerColor, color: '#000' }}>{rsvpPage.bannerText}</div>
      )}
      <RSVPPageRenderer
        config={config}
        pageData={pageData}
        slug={slug}
        unlockedPw={unlockedPw}
        backgroundStyle={bgStyleKey}
        fontStyle={fontStyle}
        coverUrlsById={coverUrlsById}
        onSubmitted={(result) => { toast.dismiss(); setSubmitResult(result); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    </>
  );
}
