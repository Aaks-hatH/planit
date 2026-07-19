import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Search, X,
  BookOpen, Star, Share2, Check,
} from 'lucide-react';
import { blogAPI } from '../services/api';

// ─── 4 fallback seeds (shown only when the API is unreachable) ────────────────
const SEED_POSTS = [
  {
    _id: 'seed-p1', slug: 'how-to-plan-corporate-event', featured: true, heroColor: '#1d4ed8',
    title: 'How to Plan a Corporate Event That People Actually Want to Attend',
    excerpt: "Corporate events have a reputation problem. Here's how to break the mold and run one people genuinely remember.",
    category: 'Event Planning', tags: ['corporate', 'planning', 'tips'],
    author: 'PlanIt Team', publishDate: '2026-03-10', readTime: 9,
    content: `## The Problem With Most Corporate Events

Mandatory fun. That is what employees whisper as they drag themselves to yet another off-site retreat. Corporate events fail not because of budget, but because nobody defined what success looked like before the calendar invite went out.

The fix is simple: treat your event like a product launch, not a logistics exercise.

## Step 1: Define a Single Outcome

Before you book a venue, write one sentence. What does success look like the day after this event?

- "Our cross-functional teams feel aligned on Q3 priorities."
- "New hires feel genuinely welcomed into our culture."
- "Attendees leave with three things they will use on Monday morning."

Every decision — venue, agenda, catering, activities — should serve that sentence.

## Step 2: Centralize Your Planning

The biggest waste in corporate event planning is duplicated effort across email threads, shared drives, and Slack channels nobody checks. A shared planning workspace gives your team one place for task lists, files, and decisions. When something changes, everyone knows.

## Step 3: Design the Attendee Journey

Think in experiences, not time slots:

1. **Arrival moment** — What is the first thing people see and feel?
2. **First connection** — Intentional seating and conversation starters
3. **Energy management** — Alternate high-focus sessions with social breaks
4. **The memorable moment** — One thing people will still be talking about next week

## Step 4: Check-In Without the Queue

Nothing undermines event confidence like a 40-person line at registration. QR check-in lets your staff process attendees in under three seconds each while you watch real-time attendance numbers from anywhere in the room.

## Step 5: Close the Loop

Send a follow-up within 24 hours: decisions made, resources shared, next steps assigned. If your event chat is already the record, this takes ten minutes.

---

Corporate events that work are not magic. They are methodical.`,
  },
  {
    _id: 'seed-p2', slug: 'restaurant-waitlist-management', featured: true, heroColor: '#ea580c',
    title: 'The Complete Guide to Restaurant Waitlist Management in 2026',
    excerpt: "Walk-in traffic is back and it is brutal without the right system. Here is how to manage your waitlist so guests stay happy and tables turn faster.",
    category: 'Restaurant Management', tags: ['restaurant', 'waitlist', 'operations'],
    author: 'PlanIt Team', publishDate: '2026-03-05', readTime: 7,
    content: `## Why Waitlist Management Is a Competitive Edge

A poorly managed waitlist costs real money. Guests who do not receive a realistic wait time within a few minutes of arriving will often leave, particularly on busy Friday and Saturday nights when they have other options. That is revenue walking out the door before they ever sit down.

## The Three Habits That Kill Waitlists

**The guessed wait time.** "About 20 minutes" from a harried host is almost always wrong. It destroys trust the moment guests are still standing there 35 minutes later.

**Shouting names across a loud room.** It forces guests to hover anxiously near the host stand instead of relaxing at the bar or browsing the menu.

**No visibility into the queue.** Guests who cannot see where they are in line assume they have been forgotten.

## How a Live Wait Board Fixes All Three

A public-facing display showing party name, position in line, and an estimated wait calculated from actual table turn data solves every one of those problems. When a table opens, you tap to seat the next party, the board updates, and the host is free to actually host.

## Building Accurate Wait Estimates

Accurate quotes come from tracking real data, not guessing. After a few weeks of logging actual turn times by table size, day of week, and time of service, your estimates will be consistently close. Guests who get a wait time of 22 minutes and are seated in 24 minutes remember that. Guests who get "about 20 minutes" and wait 40 do not come back.

---

Waitlist management done right turns a frustrating experience into a differentiator.`,
  },
  {
    _id: 'seed-p3', slug: 'qr-checkin-event-guide', featured: false, heroColor: '#16a34a',
    title: 'QR Code Check-In for Events: The Complete Setup Guide',
    excerpt: "Paper guest lists are slow and embarrassing. Here is how to set up QR check-in for any event size in under 30 minutes.",
    category: 'How-To Guides', tags: ['check-in', 'QR code', 'how-to'],
    author: 'PlanIt Team', publishDate: '2026-02-28', readTime: 5,
    content: `## Why QR Check-In Wins Every Time

Clipboards are slow. Scrolling a spreadsheet while a queue builds behind the first guest is a nightmare for your staff and a bad first impression for everyone waiting.

QR check-in is faster, looks more professional, and gives you real-time attendance data you can actually use during the event.

## What You Need

- Your event set up with guest management enabled
- Your guest list imported or entered (CSV works for large lists)
- One phone or tablet per check-in station
- About 30 minutes of prep time

## Step 1: Build Your Guest List

Add each invited guest with their name and email. The system generates a unique QR code for each person automatically. For large events, import a CSV export from your existing spreadsheet.

## Step 2: Send the Invites

Each invite contains the guest's personal QR code. Send via your platform's built-in tool or copy the personalized links into your own email system.

## Step 3: Set Up Your Stations

Open the check-in dashboard on each device. A clear phone camera is all you need — no dedicated scanner hardware required. Scan speed is under three seconds per guest.

## Step 4: Monitor in Real Time

The organizer view shows percentage checked in, who arrived and when, and walk-ins versus pre-registered guests. Useful for knowing when your crowd has peaked and adjusting staffing accordingly.

## Handling Walk-Ins

Walk-ins are the one scenario QR systems can stumble on. The fix is a simple manual override: tap to add a walk-in by name and they are in the live attendance record instantly.

---

The setup investment is 30 minutes. The payoff is a smooth, professional first impression for every single guest.`,
  },
  {
    _id: 'seed-p4', slug: 'free-event-planning-software-comparison', featured: true, heroColor: '#0891b2',
    title: 'Free Event Planning Software in 2026: An Honest Comparison',
    excerpt: 'We looked at every major free event planning tool and ranked them on what actually matters: ease of setup, guest management, team collaboration, and no hidden costs.',
    category: 'Resources', tags: ['comparison', 'tools', 'free software'],
    author: 'PlanIt Team', publishDate: '2026-02-07', readTime: 10,
    content: `## What We Actually Evaluated

Most tool roundups rank by feature count or interface polish. Neither matters if the tool locks you out mid-event or forces every guest to create an account.

We evaluated tools on four criteria:

- **True zero cost** — no credit card required for core features
- **Frictionless guest experience** — what does a guest actually have to do?
- **Team collaboration** — can your whole team access without individual accounts?
- **Scalability** — does it work for 10 guests and for 500?

## PlanIt

Free with no account required for guests or team members. A planning workspace is shareable via link. Features on the free plan include real-time team chat, QR code check-in, drag-and-drop seating charts, task management with assignees, expense tracking, live polls, and a restaurant floor manager.

Best for events where collaboration and guest management matter more than public ticket sales.

## Eventbrite (Free tier)

Strong for public events that need discoverability. The free tier covers zero-cost ticket events, but Eventbrite charges service fees to ticket buyers even on free tiers, which adds friction for guests at paid events.

Best for public events where you want people to find you through Eventbrite's marketplace.

## Google Workspace

Technically free and extremely flexible, but you are building your own workflow from scratch using Docs, Sheets, and Calendar. There is no event-specific structure, no RSVP management, and no check-in tooling built in.

Best for teams already living in Google Workspace who have time to build a custom setup.

## Luma

Clean interface, good for community events. The free tier limits some automation features and guest capacity is lower than other options.

Best for recurring community meetups where the organizer wants a simple public page.

## Our Take

For most private events — corporate, social, nonprofit — PlanIt's free plan covers more ground than any other option without asking guests to do anything. For public events where discoverability matters, Eventbrite is the right call.

---

The best tool is the one your whole team will actually open.`,
  },
];

const CATEGORIES = ['All', 'Event Planning', 'Restaurant Management', 'How-To Guides', 'Wedding Planning', 'Team Collaboration', 'Resources'];

const CAT_COLORS = {
  'Event Planning':        { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  'Restaurant Management': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  'How-To Guides':         { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  'Wedding Planning':      { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8', dot: '#ec4899' },
  'Team Collaboration':    { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6' },
  'Resources':             { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', dot: '#06b6d4' },
};

// ─── CSS — light editorial / news-page aesthetic ──────────────────────────────
const BLOG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
*, *::before, *::after { box-sizing: border-box; }

.b-root { font-family: 'DM Sans', sans-serif; background: #f9f8f5; color: #1c1917; }

.b-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9999; background: #e7e5e4; pointer-events: none; }
.b-bar { height: 100%; background: #1d4ed8; transition: width .08s linear; }

@keyframes b-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.b-up { animation: b-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }

.b-nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid #1c1917;
}
.b-nav-inner {
  max-width: 1200px; margin: 0 auto;
  padding: 0 24px; height: 54px;
  display: flex; align-items: center; justify-content: space-between;
}
.b-logo {
  font-family: 'Playfair Display', serif;
  font-size: 22px; font-weight: 800;
  color: #1c1917; text-decoration: none; letter-spacing: -0.02em;
}
.b-logo span { color: #1d4ed8; }

.b-card {
  background: #fff; border: 1px solid #e7e5e4; border-radius: 3px;
  cursor: pointer; text-align: left;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.b-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-color: #c8c5c2; }

.b-search {
  background: #fff; border: 1px solid #d6d3d1; border-radius: 3px;
  padding: 0.5rem 1rem 0.5rem 2.2rem;
  color: #1c1917; font-size: 0.875rem; font-family: 'DM Sans', sans-serif;
  width: 100%; outline: none; transition: border-color 0.18s;
}
.b-search:focus { border-color: #1d4ed8; }
.b-search::placeholder { color: #a8a29e; }

.b-pill {
  padding: 4px 13px; border-radius: 2px; font-size: 11px; font-weight: 700;
  font-family: 'DM Sans', sans-serif; letter-spacing: 0.05em; cursor: pointer;
  transition: all 0.14s; border: 1px solid #e7e5e4;
  background: #fff; color: #78716c; text-transform: uppercase; white-space: nowrap;
}
.b-pill:hover { background: #f5f4f2; color: #44403c; }
.b-pill.active { background: #1c1917; border-color: #1c1917; color: #fff; }

.b-section-label {
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 800;
  letter-spacing: 0.12em; text-transform: uppercase; color: #78716c;
  padding-bottom: 7px; border-bottom: 2px solid #1c1917;
  display: inline-block; margin-bottom: 20px;
}

.b-prose h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem; font-weight: 700; color: #1c1917;
  margin: 2.8rem 0 0.7rem; line-height: 1.25; letter-spacing: -0.01em;
}
.b-prose h3 {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.05rem; font-weight: 700; color: #292524;
  margin: 2rem 0 0.5rem; line-height: 1.4;
}
.b-prose p {
  font-family: 'Lora', serif;
  font-size: 1.075rem; line-height: 1.9; color: #3a3530; margin: 0 0 1.5rem;
}
.b-prose strong { color: #1c1917; font-weight: 700; }
.b-prose em { font-style: italic; }
.b-prose ul, .b-prose ol { margin: 0.4rem 0 1.5rem 1.5rem; }
.b-prose li {
  font-family: 'Lora', serif; font-size: 1.075rem;
  line-height: 1.8; color: #3a3530; margin-bottom: 0.45rem;
}
.b-prose li::marker { color: #1d4ed8; }
.b-prose code {
  background: #f1f5f9; border: 1px solid #e2e8f0; padding: 0.1em 0.38em;
  border-radius: 3px; font-size: 0.86em; color: #1d4ed8;
  font-family: 'SF Mono','Fira Code',monospace;
}
.b-prose hr { border: none; border-top: 1px solid #e7e5e4; margin: 3rem 0; }

@media (max-width: 860px) {
  .b-article-layout { grid-template-columns: 1fr !important; }
  .b-sidebar { display: none !important; }
  .b-nav-links { display: none !important; }
  .b-cta-strip { grid-template-columns: 1fr !important; }
}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-blog-v5';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = BLOG_CSS;
      document.head.appendChild(s);
    }
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
  return null;
}

function ReadingBar() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => {
      const t = document.documentElement.scrollHeight - window.innerHeight;
      setP(t > 0 ? (window.scrollY / t) * 100 : 0);
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return <div className="b-progress"><div className="b-bar" style={{ width: `${p}%` }} /></div>;
}

function CatBadge({ cat, sm }) {
  const c = CAT_COLORS[cat] || { bg: '#f5f4f2', text: '#78716c', border: '#e7e5e4', dot: '#a8a29e' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: sm ? '2px 8px' : '3px 10px', borderRadius: 2,
      fontSize: sm ? 10 : 11, fontWeight: 700,
      fontFamily: "'DM Sans', sans-serif",
      letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: sm ? 4 : 5, height: sm ? 4 : 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {cat}
    </span>
  );
}

function Prose({ content }) {
  const lines = (content || '').trim().split('\n');
  const els = []; let list = [], listType = 'ul', inCode = false, codeLines = [], k = 0;
  const il = t => t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  const flush = () => {
    if (!list.length) return;
    const Tag = listType;
    els.push(<Tag key={`l${k++}`}>{list.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: il(it) }} />)}</Tag>);
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        flush();
        els.push(<pre key={`pre${k++}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1rem 1.2rem', overflowX: 'auto', margin: '1.5rem 0' }}><code style={{ color: '#334155', fontSize: '0.875rem', whiteSpace: 'pre', fontFamily: "'SF Mono','Fira Code',monospace" }}>{codeLines.join('\n')}</code></pre>);
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.startsWith('## '))       { flush(); els.push(<h2 key={`h${k++}`}>{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { flush(); els.push(<h3 key={`h${k++}`}>{line.slice(4)}</h3>); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { listType = 'ul'; list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line))   { listType = 'ol'; list.push(line.replace(/^\d+\. /, '')); }
    else if (line.trim() === '---')  { flush(); els.push(<hr key={`hr${k++}`} />); }
    else if (line.trim() === '')     { flush(); }
    else if (line.trim())            { flush(); els.push(<p key={`p${k++}`} dangerouslySetInnerHTML={{ __html: il(line) }} />); }
  }
  flush();
  return <div className="b-prose">{els}</div>;
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function setMeta(name, content) {
  const isOg = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  const attr = isOg ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content || '');
}
function removeMeta(name) {
  const isOg = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  const el = document.querySelector(`meta[${isOg ? 'property' : 'name'}="${name}"]`);
  if (el) el.remove();
}
const META_TAGS = ['description','og:title','og:description','og:url','og:type','og:site_name','twitter:card','twitter:title','twitter:description','article:published_time','article:author','article:section'];

// ─── Article view ──────────────────────────────────────────────────────────────
function ArticleView({ post, allPosts, onBack }) {
  const related = allPosts.filter(p => p._id !== post._id && p.category === post.category).slice(0, 3);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const base = 'https://planitapp.onrender.com';
    const url = `${base}/blog/${post.slug}`;
    document.title = `${post.title} — PlanIt`;
    setMeta('description', post.excerpt || '');
    setMeta('og:title', post.title);
    setMeta('og:description', post.excerpt || '');
    setMeta('og:url', url);
    setMeta('og:type', 'article');
    setMeta('og:site_name', 'PlanIt Blog');
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', post.title);
    setMeta('twitter:description', post.excerpt || '');
    setMeta('article:published_time', post.publishDate || '');
    setMeta('article:author', post.author || 'PlanIt Team');
    setMeta('article:section', post.category || 'Event Planning');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', url);
    return () => {
      document.title = 'PlanIt Blog';
      META_TAGS.forEach(removeMeta);
      const c = document.querySelector('link[rel="canonical"]'); if (c) c.remove();
    };
  }, [post._id]);

  const share = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="b-root" style={{ minHeight: '100vh' }}>
      <ReadingBar />

      {/* Nav */}
      <header className="b-nav">
        <div className="b-nav-inner">
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#78716c', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 0' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1c1917'}
            onMouseLeave={e => e.currentTarget.style.color = '#78716c'}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} /> All Articles
          </button>
          <a href="/" className="b-logo">Plan<span>It</span></a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={share} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 3, background: copied ? '#f0fdf4' : '#fff', border: `1px solid ${copied ? '#bbf7d0' : '#e7e5e4'}`, color: copied ? '#15803d' : '#78716c', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
              {copied ? <><Check style={{ width: 11, height: 11 }} /> Copied</> : <><Share2 style={{ width: 11, height: 11 }} /> Share</>}
            </button>
            <a href="/" style={{ padding: '5px 14px', borderRadius: 3, background: '#1c1917', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Get Started</a>
          </div>
        </div>
      </header>

      {/* Article hero */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e7e5e4', padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="b-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <CatBadge cat={post.category} />
            {post.featured && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 2, background: '#fefce8', border: '1px solid #fde68a', color: '#92400e', textTransform: 'uppercase', letterSpacing: '.07em' }}>Featured</span>}
          </div>
          <h1 className="b-up" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.65rem, 3.2vw, 2.35rem)', fontWeight: 800, color: '#1c1917', lineHeight: 1.18, letterSpacing: '-0.025em', marginBottom: 16, animationDelay: '.05s' }}>
            {post.title}
          </h1>
          <p className="b-up" style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', color: '#57534e', lineHeight: 1.75, marginBottom: 24, animationDelay: '.1s' }}>
            {post.excerpt}
          </p>
          <div className="b-up" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', paddingTop: 18, borderTop: '1px solid #e7e5e4', animationDelay: '.15s' }}>
            <span style={{ fontSize: 13, color: '#44403c', fontWeight: 600 }}>{post.author}</span>
            <span style={{ width: 1, height: 12, background: '#e7e5e4', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: '#78716c', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar style={{ width: 12, height: 12 }} />{fmtDate(post.publishDate || post.date)}
            </span>
            <span style={{ fontSize: 13, color: '#78716c', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock style={{ width: 12, height: 12 }} />{post.readTime} min read
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 80px' }}>
        <div className="b-article-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,680px) 200px', gap: 52, paddingTop: 48, alignItems: 'start', justifyContent: 'center' }}>
          <article>
            <Prose content={post.content || ''} />
            {post.tags?.length > 0 && (
              <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e7e5e4', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Tag style={{ width: 12, height: 12, color: '#a8a29e', flexShrink: 0 }} />
                {(Array.isArray(post.tags) ? post.tags : String(post.tags).split(',').map(t => t.trim())).map(tag => (
                  <span key={tag} style={{ fontSize: 12, color: '#78716c', background: '#f5f4f2', border: '1px solid #e7e5e4', padding: '3px 10px', borderRadius: 2, fontWeight: 500 }}>#{tag}</span>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="b-sidebar" style={{ position: 'sticky', top: 68 }}>
            <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 3, padding: '20px 18px', marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#78716c', marginBottom: 10, borderBottom: '1px solid #e7e5e4', paddingBottom: 8 }}>Plan Your Next Event</p>
              <p style={{ fontSize: 13, color: '#57534e', lineHeight: 1.65, marginBottom: 14 }}>Team chat, QR check-in, seating charts, RSVP management, and expense tracking. Free, no account needed.</p>
              <a href="/" style={{ display: 'block', textAlign: 'center', padding: '9px 14px', borderRadius: 3, background: '#1c1917', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Get Started Free
              </a>
            </div>
            {related.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#78716c', marginBottom: 12, borderBottom: '1px solid #e7e5e4', paddingBottom: 7 }}>More in {post.category}</p>
                {related.map(p => (
                  <button key={p._id} onClick={() => onBack(p)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #f5f4f2', display: 'block' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '.65'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <p style={{ fontSize: 13, color: '#1c1917', fontWeight: 600, lineHeight: 1.4, marginBottom: 3 }}>{p.title}</p>
                    <span style={{ fontSize: 11, color: '#a8a29e' }}>{p.readTime} min read</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '2px solid #1c1917', padding: '24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: '#1c1917' }}>PlanIt <span style={{ color: '#1d4ed8' }}>Blog</span></span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Privacy', '/privacy']].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12, color: '#78716c', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#a8a29e' }}>© 2026 PlanIt · By Aakshat Hariharan</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Blog index ────────────────────────────────────────────────────────────────
function BlogIndex({ posts, loading, onRead }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const PER = 9;

  const featured = posts.filter(p => p.featured);
  const filtered = posts.filter(p => {
    const mc = cat === 'All' || p.category === cat;
    const ql = q.toLowerCase();
    const ms = !ql || p.title.toLowerCase().includes(ql) || p.excerpt.toLowerCase().includes(ql)
      || (Array.isArray(p.tags) ? p.tags : []).some(t => t.toLowerCase().includes(ql));
    return mc && ms;
  });
  const rest = filtered.filter(p => !p.featured || cat !== 'All' || q);
  const pages = Math.ceil(rest.length / PER);
  const paged = rest.slice((page - 1) * PER, page * PER);
  useEffect(() => { setPage(1); }, [cat, q]);

  return (
    <div className="b-root" style={{ minHeight: '100vh' }}>
      <ReadingBar />

      {/* Masthead nav */}
      <header className="b-nav">
        <div className="b-nav-inner">
          <a href="/" className="b-logo">Plan<span>It</span></a>
          {/* Section links — desktop only */}
          <div className="b-nav-links" style={{ display: 'flex', gap: 22 }}>
            {CATEGORIES.slice(1, 5).map(c => (
              <button key={c} onClick={() => setCat(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: cat === c ? 700 : 500, color: cat === c ? '#1c1917' : '#78716c', paddingBottom: 2, borderBottom: cat === c ? '2px solid #1d4ed8' : '2px solid transparent', transition: 'all .15s' }}>{c}</button>
            ))}
          </div>
          <a href="/" style={{ padding: '6px 16px', borderRadius: 3, background: '#1c1917', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Get Started</a>
        </div>
      </header>

      {/* Filter + search bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e7e5e4' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 6, height: 44, overflowX: 'auto' }}>
          {CATEGORIES.map(c => (
            <button key={c} className={`b-pill${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <div style={{ marginLeft: 'auto', flexShrink: 0, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#a8a29e', pointerEvents: 'none' }} />
            <input className="b-search" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 190, paddingLeft: '1.9rem' }} />
            {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer', padding: 2 }}><X style={{ width: 12, height: 12 }} /></button>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: 32, paddingBottom: 14, borderBottom: '2px solid #1c1917' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 5 }}>
            {cat === 'All' ? 'PlanIt Blog & Guides' : cat}
          </h1>
          <p style={{ fontSize: 13, color: '#78716c' }}>
            {loading ? 'Loading...' : `${filtered.length} article${filtered.length !== 1 ? 's' : ''} for event planners, restaurant operators, and hospitality teams`}
          </p>
        </div>

        {/* Featured — big editorial layout */}
        {!q && cat === 'All' && featured.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <span className="b-section-label">Featured</span>
            <div style={{ display: 'grid', gridTemplateColumns: featured.length > 1 ? '1.4fr 1fr' : '1fr', gap: 0, border: '1px solid #e7e5e4', background: '#e7e5e4' }}>
              {featured.slice(0, 2).map((post, i) => (
                <button key={post._id} className="b-card" onClick={() => onRead(post)}
                  style={{ padding: i === 0 ? 32 : 24, display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', borderRight: i === 0 && featured.length > 1 ? '1px solid #e7e5e4' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <CatBadge cat={post.category} sm />
                  </div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: i === 0 ? 'clamp(1.25rem,2.2vw,1.7rem)' : '1.15rem', fontWeight: 800, color: '#1c1917', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 12, flex: 1 }}>{post.title}</h2>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 14, color: '#57534e', lineHeight: 1.7, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: i === 0 ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#a8a29e' }}>{post.author} · {post.readTime} min</span>
                    <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>Read →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Article grid */}
        {paged.length > 0 ? (
          <>
            {!q && cat === 'All' && <span className="b-section-label">Latest</span>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 0, background: '#e7e5e4', border: '1px solid #e7e5e4', marginBottom: 40 }}>
              {paged.map(post => (
                <button key={post._id} className="b-card" onClick={() => onRead(post)}
                  style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none' }}>
                  <CatBadge cat={post.category} sm />
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: '#1c1917', lineHeight: 1.3, margin: '10px 0 8px', flex: 1 }}>{post.title}</h3>
                  <p style={{ fontSize: 13, color: '#78716c', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <span style={{ fontSize: 11, color: '#a8a29e' }}>{fmtDate(post.publishDate)} · {post.readTime} min</span>
                    <span style={{ fontSize: 11, color: '#78716c', fontWeight: 700 }}>Read →</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 15, color: '#78716c', fontWeight: 600, marginBottom: 12 }}>No articles found</p>
            <button onClick={() => { setQ(''); setCat('All'); }} style={{ padding: '7px 18px', borderRadius: 3, background: '#1c1917', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none' }}>Clear filters</button>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 48 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '7px 16px', borderRadius: 3, background: '#fff', border: '1px solid #e7e5e4', color: page === 1 ? '#d6d3d1' : '#44403c', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>← Prev</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} style={{ width: 34, height: 34, borderRadius: 3, background: page === n ? '#1c1917' : '#fff', border: '1px solid #e7e5e4', color: page === n ? '#fff' : '#44403c', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '7px 16px', borderRadius: 3, background: '#fff', border: '1px solid #e7e5e4', color: page === pages ? '#d6d3d1' : '#44403c', cursor: page === pages ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>Next →</button>
          </div>
        )}

        {/* CTA strip */}
        <div className="b-cta-strip" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center', padding: '28px 32px', background: '#fff', border: '2px solid #1c1917', borderRadius: 3 }}>
          <div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 800, color: '#1c1917', marginBottom: 5 }}>Start planning with PlanIt</p>
            <p style={{ color: '#78716c', fontSize: 13, lineHeight: 1.65 }}>Free event management, restaurant tools, team chat, and QR check-in. No account needed.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a href="/" style={{ padding: '10px 20px', borderRadius: 3, background: '#1c1917', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Plan an Event Free</a>
            <a href="/discover" style={{ padding: '10px 20px', borderRadius: 3, background: '#fff', border: '1px solid #e7e5e4', color: '#44403c', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Discover Events</a>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '2px solid #1c1917', padding: '24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: '#1c1917' }}>PlanIt <span style={{ color: '#1d4ed8' }}>Blog</span></span>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Status', '/status'], ['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12, color: '#78716c', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#a8a29e' }}>© 2026 PlanIt · By Aakshat Hariharan</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function Blog() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(SEED_POSTS);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await blogAPI.list({ limit: 50 });
      if (data?.posts?.length > 0) setPosts(data.posts);
    } catch { /* keep seeds */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (slug) {
      const found = posts.find(p => p.slug === slug);
      if (found) { setActive(found); return; }
      blogAPI.getBySlug(slug)
        .then(({ data }) => { if (data?.post) setActive(data.post); })
        .catch(() => navigate('/blog', { replace: true }));
    } else { setActive(null); }
  }, [slug, posts, navigate]);

  const read = p => { setActive(p); navigate('/blog/' + p.slug); window.scrollTo({ top: 0 }); };
  const back = next => {
    if (next?.slug) { read(next); return; }
    setActive(null); navigate('/blog'); window.scrollTo({ top: 0 });
  };

  return (
    <>
      <InjectCSS />
      {active
        ? <ArticleView post={active} allPosts={posts} onBack={back} />
        : <BlogIndex posts={posts} loading={loading} onRead={read} />
      }
    </>
  );
}