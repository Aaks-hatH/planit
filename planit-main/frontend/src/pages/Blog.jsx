import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Search, X,
  BookOpen, Star, Share2, Check,
} from 'lucide-react';
import { blogAPI } from '../services/api';

const SEED_POSTS = [
  {
    _id:'seed-p1', slug:'how-to-plan-corporate-event', featured:true, heroColor:'#6366f1',
    title:'How to Plan a Corporate Event That People Actually Want to Attend',
    excerpt:"Corporate events have a reputation problem. Here's how to break the mold and run an event people genuinely remember.",
    category:'Event Planning', tags:['corporate','planning','tips'],
    author:'PlanIt Team', publishDate:'2026-03-10', readTime:9,
    content:`## The Problem With Most Corporate Events\n\nMandatory fun. That's what employees whisper as they drag themselves to yet another off-site retreat. Corporate events often fail not because of budget, but because of planning failure.\n\nThe antidote is simple: **treat your event like a product launch, not a logistics exercise**.\n\n## Step 1: Define a Single Outcome\n\nBefore you book a venue or send a calendar invite, write one sentence: *What does success look like the day after this event?*\n\n- "Our cross-functional teams feel aligned on Q3 priorities."\n- "New hires feel genuinely welcomed into our culture."\n- "Attendees leave with three actionable takeaways they'll use Monday morning."\n\nEvery decision — venue, agenda, catering, activities — should serve that sentence.\n\n## Step 2: Use a Centralized Planning Workspace\n\nThe biggest waste in corporate event planning is duplicated effort across email threads, shared drives, and Slack channels nobody checks. A platform like PlanIt gives your entire planning team a single workspace with:\n\n- **Shared task lists** with assignees and deadlines\n- **Team chat** with file sharing — floor plans, run-of-show, catering orders all in one place\n- **Real-time polls** to nail down decisions without 47-email threads\n\n## Step 3: Design the Attendee Journey\n\n1. **Arrival moment** — What's the first thing people see?\n2. **First connection** — Intentional seating, conversation starters\n3. **Energy management** — Alternate high-focus sessions with social breaks\n4. **The memorable moment** — One wow moment people will talk about\n\n## Step 4: Check-In Without the Chaos\n\nNothing undermines event confidence like a 40-person queue at registration. QR check-in via PlanIt Enterprise Mode lets your staff check in attendees in under 3 seconds each while you watch real-time attendance dashboards.\n\n## Step 5: Close the Loop\n\nSend a follow-up within 24 hours: a summary of decisions made, resources shared, and next steps.\n\n---\n\nCorporate events that work aren't magic. They're methodical.`,
  },
  {
    _id:'seed-p2', slug:'restaurant-waitlist-management', featured:true, heroColor:'#f97316',
    title:'The Complete Guide to Restaurant Waitlist Management in 2026',
    excerpt:"Walk-in traffic is back — and it's brutal without the right system. Here's exactly how to manage your waitlist so guests stay happy and tables turn faster.",
    category:'Restaurant Management', tags:['restaurant','waitlist','operations'],
    author:'PlanIt Team', publishDate:'2026-03-05', readTime:7,
    content:`## Why Waitlist Management Is a Competitive Edge\n\nA poorly managed waitlist costs real money. Studies consistently show 30–45% of waiting parties will leave if they don't receive a realistic wait quote within 5 minutes.\n\n## The Three Sins of Bad Waitlist Management\n\n**Sin 1: The Mental Math Quote.** Guessed wait times are almost always wrong and destroy trust.\n\n**Sin 2: Shouting Names Across a Loud Room.** Forces guests to hover anxiously near the host stand.\n\n**Sin 3: No Transparency.** Guests who can't see where they are in line assume the worst.\n\n## How PlanIt Venue Solves All Three\n\nPlanIt's live wait board shows party name, position in line, and estimated wait time calculated from actual table turn data. When a table opens, you tap "Seat Next" — the party is notified, the board updates, and your host is free to actually host.\n\n---\n\nWaitlist management done right turns a pain point into a differentiator.`,
  },
  {
    _id:'seed-p3', slug:'qr-checkin-event-guide', featured:false, heroColor:'#22c55e',
    title:'QR Code Check-In for Events: The Complete Setup Guide',
    excerpt:"Paper guest lists are an embarrassment in 2026. Here's how to set up professional QR check-in for any event size — in under 10 minutes.",
    category:'How-To Guides', tags:['check-in','QR code','how-to'],
    author:'PlanIt Team', publishDate:'2026-02-28', readTime:5,
    content:`## Why QR Check-In Wins Every Time\n\nClipboards are slow. Spreadsheets on a laptop are clunky. QR check-in is faster, looks more professional, and gives you real-time data you can actually use.\n\n## What You Need\n\n- A PlanIt event set up in Enterprise Mode\n- Your guest list imported or entered\n- One device per check-in station (phone works fine)\n\n## Step 1: Enable Enterprise Mode\n\nWhen creating your event in PlanIt, select **Enterprise Mode**. This unlocks personalized QR codes for each invited guest.\n\n## Step 2: Send the Invites\n\nEach invite contains the guest's personal QR code and a view link. Scan speed is under 3 seconds per guest — no special hardware needed.\n\n---\n\nThe setup time investment is minimal. The payoff — a smooth, professional check-in — is significant.`,
  },
  {
    _id:'seed-p4', slug:'free-event-planning-software-comparison', featured:true, heroColor:'#06b6d4',
    title:'Free Event Planning Software in 2026: An Honest Comparison',
    excerpt:'We tested every major free event planning tool and ranked them by what actually matters: ease of setup, guest management, team collaboration, and zero hidden paywalls.',
    category:'Resources', tags:['comparison','tools','free software'],
    author:'PlanIt Team', publishDate:'2026-02-07', readTime:10,
    content:`## The Real Criteria\n\nMost "best of" lists rank tools by feature count or UI polish. Neither matters if the tool locks you out mid-event or requires every guest to create an account.\n\nWe evaluated tools on:\n- **True zero cost** — no credit card for core features\n- **Frictionless guest experience** — what does the guest need to do?\n- **Team collaboration** — can your whole team access without individual accounts?\n- **Scalability** — does it work for 10 guests and for 500?\n\n## PlanIt\n\n**Free forever.** No accounts for guests or team members. The workspace is shareable via link. Stand-outs: real-time team chat, QR code check-in, seating charts, task management, expense tracking, live polls, and a full restaurant floor manager.\n\n---\n\nThe best tool is the one your whole team will actually use consistently.`,
  },
];

const CATEGORIES = ['All','Event Planning','Restaurant Management','How-To Guides','Wedding Planning','Team Collaboration','Resources'];

const CAT_COLORS = {
  'Event Planning':        { bg:'rgba(99,102,241,0.10)',  text:'#a5b4fc', border:'rgba(99,102,241,0.22)', dot:'#6366f1' },
  'Restaurant Management': { bg:'rgba(249,115,22,0.10)',  text:'#fdba74', border:'rgba(249,115,22,0.22)', dot:'#f97316' },
  'How-To Guides':         { bg:'rgba(34,197,94,0.10)',   text:'#86efac', border:'rgba(34,197,94,0.22)',  dot:'#22c55e' },
  'Wedding Planning':      { bg:'rgba(236,72,153,0.10)',  text:'#f9a8d4', border:'rgba(236,72,153,0.22)', dot:'#ec4899' },
  'Team Collaboration':    { bg:'rgba(139,92,246,0.10)',  text:'#c4b5fd', border:'rgba(139,92,246,0.22)', dot:'#8b5cf6' },
  'Resources':             { bg:'rgba(6,182,212,0.10)',   text:'#67e8f9', border:'rgba(6,182,212,0.22)',  dot:'#06b6d4' },
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
// Single DM Sans base for all UI. Syne for headings. Lora only inside article prose.
// No inline fontFamily on any non-prose element — all text consistent by default.
const BLOG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
*, *::before, *::after { box-sizing: border-box; }
.b-root { font-family: 'DM Sans', sans-serif; background: #06060e; color: #f1f5f9; }
.b-syne { font-family: 'Syne', sans-serif; }

.b-progress { position:fixed; top:0; left:0; right:0; height:2px; z-index:9999; background:rgba(255,255,255,0.04); pointer-events:none; }
.b-bar { height:100%; background:linear-gradient(90deg,#6366f1,#818cf8); box-shadow:0 0 10px rgba(99,102,241,0.45); transition:width .08s linear; }

@keyframes b-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.b-up { animation: b-up 0.48s cubic-bezier(0.22,1,0.36,1) both; }

@keyframes b-shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
.b-shimmer {
  background: linear-gradient(90deg, #818cf8 0%, #c4b5fd 45%, #818cf8 100%);
  background-size: 200% auto;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; animation: b-shimmer 5s linear infinite;
}

.b-card {
  background: rgba(255,255,255,0.027); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px; cursor: pointer; text-align: left;
  transition: transform 0.26s cubic-bezier(0.22,1,0.36,1), border-color 0.26s, box-shadow 0.26s;
}
.b-card:hover { transform:translateY(-3px); border-color:rgba(255,255,255,0.12); box-shadow:0 20px 48px rgba(0,0,0,0.55); }

.b-search {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 0.6rem 1rem 0.6rem 2.4rem;
  color: #f1f5f9; font-size: 0.875rem; font-family: 'DM Sans', sans-serif;
  width: 100%; outline: none; transition: border-color 0.2s, background 0.2s;
}
.b-search:focus { border-color: rgba(99,102,241,0.45); background: rgba(255,255,255,0.06); }
.b-search::placeholder { color: #475569; }

.b-pill {
  padding: 5px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
  font-family: 'DM Sans', sans-serif; letter-spacing: 0.01em; cursor: pointer;
  transition: all 0.18s; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: #64748b;
}
.b-pill:hover { color: #cbd5e1; border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.055); }
.b-pill.active { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.13); color: #a5b4fc; }

/* Prose — Lora body, DM Sans heads. Editorial, readable, not blocky. */
.b-prose h2 {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 2.8rem 0 0.65rem;
  letter-spacing: -0.01em;
  line-height: 1.35;
  padding-top: 0.25rem;
}
.b-prose h3 {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.025rem;
  font-weight: 600;
  color: #cbd5e1;
  margin: 2rem 0 0.5rem;
  line-height: 1.4;
}
.b-prose p {
  font-family: 'Lora', serif;
  font-size: 1.0625rem;
  line-height: 1.95;
  color: #b0bec5;
  margin: 0 0 1.6rem;
}
.b-prose strong { color: #e2e8f0; font-weight: 700; }
.b-prose em { font-style: italic; color: #e2e8f0; }
.b-prose ul, .b-prose ol { margin: 0.5rem 0 1.6rem 1.4rem; }
.b-prose li {
  font-family: 'Lora', serif;
  font-size: 1.0625rem;
  line-height: 1.85;
  color: #b0bec5;
  margin-bottom: 0.5rem;
}
.b-prose li::marker { color: #6366f1; }
.b-prose code {
  background: rgba(99,102,241,0.11); border: 1px solid rgba(99,102,241,0.2);
  padding: 0.1em 0.38em; border-radius: 4px; font-size: 0.86em;
  color: #a5b4fc; font-family: 'SF Mono','Fira Code',monospace;
}
.b-prose hr {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 3rem 0;
}

@media (max-width: 768px) {
  .b-article-layout { grid-template-columns: 1fr !important; }
  .b-sidebar { display: none !important; }
  .b-hero-grid { grid-template-columns: 1fr !important; }
  .b-cta-grid { grid-template-columns: 1fr !important; }
  .b-cta-btns { flex-direction: column !important; }
}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-blog-v4';
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
  return <div className="b-progress"><div className="b-bar" style={{ width:`${p}%` }} /></div>;
}

function CatBadge({ cat, sm }) {
  const c = CAT_COLORS[cat] || { bg:'rgba(100,116,139,0.10)', text:'#94a3b8', border:'rgba(100,116,139,0.22)', dot:'#64748b' };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: sm ? 4 : 5,
      background:c.bg, color:c.text, border:`1px solid ${c.border}`,
      padding: sm ? '2px 8px' : '3px 11px',
      borderRadius:999, fontSize: sm ? 10 : 11, fontWeight:700,
      fontFamily:"'DM Sans', sans-serif",
      letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap',
    }}>
      <span style={{ width: sm ? 4 : 5, height: sm ? 4 : 5, borderRadius:'50%', background:c.dot, flexShrink:0 }} />
      {cat}
    </span>
  );
}

// Safe markdown renderer — inline HTML escaped, no raw passthrough
function Prose({ content }) {
  const lines = (content || '').trim().split('\n');
  const els = []; let list = [], listType = 'ul', inCode = false, codeLines = [], k = 0;
  const il = t => t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
  const flush = () => {
    if (!list.length) return;
    const Tag = listType;
    els.push(<Tag key={`l${k++}`}>{list.map((it,i) => <li key={i} dangerouslySetInnerHTML={{__html:il(it)}}/>)}</Tag>);
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        flush();
        els.push(<pre key={`pre${k++}`} style={{background:'rgba(0,0,0,0.45)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'1.1rem 1.3rem',overflowX:'auto',margin:'1.5rem 0'}}><code style={{color:'#94a3b8',fontSize:'0.875rem',whiteSpace:'pre',fontFamily:"'SF Mono','Fira Code',monospace"}}>{codeLines.join('\n')}</code></pre>);
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.startsWith('## '))       { flush(); els.push(<h2 key={`h${k++}`}>{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { flush(); els.push(<h3 key={`h${k++}`}>{line.slice(4)}</h3>); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { listType='ul'; list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line))    { listType='ol'; list.push(line.replace(/^\d+\. /,'')); }
    else if (line.trim()==='---')     { flush(); els.push(<hr key={`hr${k++}`}/>); }
    else if (line.trim()==='')        { flush(); }
    else if (line.trim())             { flush(); els.push(<p key={`p${k++}`} dangerouslySetInnerHTML={{__html:il(line)}}/>); }
  }
  flush();
  return <div className="b-prose">{els}</div>;
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }); }
  catch { return d; }
}

// ─── Meta tag helper ──────────────────────────────────────────────────────────
// Creates or updates a <meta> tag. Used for SEO and Open Graph on article pages.
function setMeta(name, content) {
  const isOg = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  const attr = isOg ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

function removeMeta(name) {
  const isOg = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  const attr = isOg ? 'property' : 'name';
  const el = document.querySelector(`meta[${attr}="${name}"]`);
  if (el) el.remove();
}

const META_TAGS = [
  'description',
  'og:title', 'og:description', 'og:url', 'og:type', 'og:site_name',
  'twitter:card', 'twitter:title', 'twitter:description',
  'article:published_time', 'article:author', 'article:section',
];

// ─── Article view ─────────────────────────────────────────────────────────────
function ArticleView({ post, allPosts, onBack }) {
  const related = allPosts.filter(p => p._id !== post._id && p.category === post.category).slice(0, 3);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });

    const base = 'https://planitapp.onrender.com';
    const url  = `${base}/blog/${post.slug}`;

    document.title = `${post.title} — PlanIt Blog`;

    // Standard SEO
    setMeta('description',           post.excerpt || '');

    // Open Graph — controls how the link looks when shared on LinkedIn, Slack, iMessage, etc.
    setMeta('og:title',              post.title);
    setMeta('og:description',        post.excerpt || '');
    setMeta('og:url',                url);
    setMeta('og:type',               'article');
    setMeta('og:site_name',          'PlanIt Blog');

    // Twitter / X card
    setMeta('twitter:card',          'summary');
    setMeta('twitter:title',         post.title);
    setMeta('twitter:description',   post.excerpt || '');

    // Article-specific structured data (used by Google News, Discover)
    setMeta('article:published_time', post.publishDate || '');
    setMeta('article:author',         post.author || 'PlanIt Team');
    setMeta('article:section',        post.category || 'Event Planning');

    // Canonical link — tells Google the definitive URL for this content
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);

    return () => {
      document.title = 'PlanIt Blog';
      META_TAGS.forEach(removeMeta);
      const c = document.querySelector('link[rel="canonical"]');
      if (c) c.remove();
    };
  }, [post._id]);

  const share = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const accent = post.heroColor || '#6366f1';

  return (
    <div className="b-root" style={{ minHeight:'100vh' }}>
      <ReadingBar />

      {/* Nav */}
      <header style={{ position:'sticky', top:0, zIndex:50, background:'rgba(6,6,14,0.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:1140, margin:'0 auto', padding:'0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:13, fontWeight:600, padding:'6px 10px', borderRadius:8, transition:'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color='#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.color='#64748b'}
          >
            <ArrowLeft style={{ width:13, height:13 }} /> Back to Blog
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <a href="/" style={{ padding:'5px 12px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#64748b', fontSize:12, fontWeight:600, textDecoration:'none' }}>PlanIt Home</a>
            <button onClick={share} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, background: copied ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${copied ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.08)'}`, color: copied ? '#86efac' : '#64748b', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .18s' }}>
              {copied ? <><Check style={{width:11,height:11}}/>Copied</> : <><Share2 style={{width:11,height:11}}/>Share</>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero — constrained 720px, editorial */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'48px 24px 40px' }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <div className="b-up" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <CatBadge cat={post.category} />
            {post.featured && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'rgba(251,191,36,0.09)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24', textTransform:'uppercase', letterSpacing:'.06em' }}>Featured</span>}
          </div>
          <h1 className="b-syne b-up" style={{ fontSize:'clamp(1.45rem,2.8vw,1.95rem)', fontWeight:700, color:'#f1f5f9', lineHeight:1.22, letterSpacing:'-0.02em', marginBottom:14, animationDelay:'.06s' }}>
            {post.title}
          </h1>
          <p className="b-up" style={{ fontSize:'1.0625rem', color:'#64748b', lineHeight:1.7, marginBottom:22, fontWeight:400, animationDelay:'.12s' }}>
            {post.excerpt}
          </p>
          <div className="b-up" style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.07)', animationDelay:'.18s' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:`${accent}1e`, border:`1px solid ${accent}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:800, color:accent }}>{(post.author||'P')[0]}</span>
              </div>
              <span style={{ fontSize:13, color:'#64748b', fontWeight:500 }}>{post.author}</span>
            </div>
            <span style={{ width:1, height:12, background:'rgba(255,255,255,0.08)', display:'inline-block' }} />
            <span style={{ fontSize:13, color:'#475569', display:'flex', alignItems:'center', gap:4 }}>
              <Calendar style={{ width:11, height:11 }} />{fmtDate(post.publishDate || post.date)}
            </span>
            <span style={{ fontSize:13, color:'#475569', display:'flex', alignItems:'center', gap:4 }}>
              <Clock style={{ width:11, height:11 }} />{post.readTime} min read
            </span>
          </div>
        </div>
      </div>

      {/* Body: wide wrapper, narrow prose + sidebar */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 24px 80px' }}>
        <div className="b-article-layout" style={{ display:'grid', gridTemplateColumns:'minmax(0,680px) 220px', gap:56, paddingTop:48, alignItems:'start', justifyContent:'center' }}>
          <article>
            <Prose content={post.content || ''} />
            {post.tags?.length > 0 && (
              <div style={{ marginTop:44, paddingTop:22, borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', flexWrap:'wrap', gap:7, alignItems:'center' }}>
                <Tag style={{ width:12, height:12, color:'#334155', flexShrink:0 }} />
                {(Array.isArray(post.tags) ? post.tags : String(post.tags).split(',').map(t=>t.trim())).map(tag => (
                  <span key={tag} style={{ fontSize:12, color:'#475569', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', padding:'3px 10px', borderRadius:6, fontWeight:500 }}>#{tag}</span>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="b-sidebar" style={{ position:'sticky', top:68 }}>
            <div style={{ borderRadius:14, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', padding:'20px 18px', marginBottom:16 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.22)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <Calendar style={{ width:14, height:14, color:'#818cf8' }} />
              </div>
              <h3 className="b-syne" style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', marginBottom:6 }}>Ready to plan?</h3>
              <p style={{ fontSize:12.5, color:'#475569', lineHeight:1.65, marginBottom:14 }}>PlanIt gives you team chat, RSVP, QR check-in, seating charts, and budget tracking — free forever.</p>
              <a href="/" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, background:'#fff', color:'#0f0f17', fontSize:12.5, fontWeight:700, textDecoration:'none' }}>
                Get Started Free <ArrowRight style={{ width:11, height:11 }} />
              </a>
            </div>

            {related.length > 0 && (
              <div>
                <p className="b-syne" style={{ fontSize:10, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>More in this category</p>
                {related.map(p => (
                  <button key={p._id} onClick={() => onBack(p)} style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'8px 10px', borderRadius:9, transition:'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}
                  >
                    <p style={{ fontSize:12.5, color:'#94a3b8', fontWeight:500, lineHeight:1.45, marginBottom:3 }}>{p.title}</p>
                    <span style={{ fontSize:11, color:'#334155' }}>{p.readTime} min read</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Blog index ───────────────────────────────────────────────────────────────
function BlogIndex({ posts, loading, onRead }) {
  const [cat, setCat] = useState('All');
  const [q, setQ]     = useState('');
  const [page, setPage] = useState(1);
  const PER = 9;

  const featured = posts.filter(p => p.featured);
  const filtered  = posts.filter(p => {
    const mc = cat === 'All' || p.category === cat;
    const ql = q.toLowerCase();
    const ms = !ql || p.title.toLowerCase().includes(ql) || p.excerpt.toLowerCase().includes(ql)
      || (Array.isArray(p.tags) ? p.tags : []).some(t => t.toLowerCase().includes(ql));
    return mc && ms;
  });
  const rest  = filtered.filter(p => !p.featured || cat !== 'All' || q);
  const pages = Math.ceil(rest.length / PER);
  const paged = rest.slice((page - 1) * PER, page * PER);
  useEffect(() => { setPage(1); }, [cat, q]);

  return (
    <div className="b-root" style={{ minHeight:'100vh' }}>
      <ReadingBar />

      {/* Nav */}
      <header style={{ position:'sticky', top:0, zIndex:50, background:'rgba(6,6,14,0.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Calendar style={{ width:13, height:13, color:'#818cf8' }} />
              </div>
              <span className="b-syne" style={{ fontSize:15, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.02em' }}>PlanIt</span>
            </a>
            <span style={{ color:'#1e293b', fontSize:18, lineHeight:1 }}>/</span>
            <span className="b-syne" style={{ fontSize:13, fontWeight:700, color:'#334155' }}>Blog</span>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {[['Discover','/discover'],['Help','/help']].map(([l,h]) => (
              <a key={l} href={h} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', color:'#475569', fontSize:12, fontWeight:600, textDecoration:'none' }}>{l}</a>
            ))}
            <a href="/" style={{ padding:'5px 14px', borderRadius:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.22)', color:'#a5b4fc', fontSize:12, fontWeight:700, textDecoration:'none' }}>Get Started</a>
          </div>
        </div>
      </header>

      {/* Hero — wide two-col */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'radial-gradient(ellipse 90% 70% at 15% 0%, rgba(99,102,241,0.07) 0%, transparent 60%)', padding:'72px 32px 60px' }}>
        <div className="b-hero-grid" style={{ maxWidth:1280, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 360px', gap:56, alignItems:'center' }}>
          <div>
            <div className="b-up" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 12px', borderRadius:999, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.18)', marginBottom:20 }}>
              <BookOpen style={{ width:10, height:10, color:'#818cf8' }} />
              <span style={{ fontSize:10, fontWeight:700, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em' }}>PlanIt Blog & Guides</span>
            </div>
            <h1 className="b-syne b-up" style={{ fontSize:'clamp(2rem,4.5vw,3.25rem)', fontWeight:800, color:'#f8fafc', lineHeight:1.08, letterSpacing:'-0.04em', marginBottom:18, animationDelay:'.07s' }}>
              Plan smarter.<br />
              <span className="b-shimmer">Execute flawlessly.</span>
            </h1>
            <p className="b-up" style={{ fontSize:'1rem', color:'#64748b', lineHeight:1.75, maxWidth:520, animationDelay:'.14s' }}>
              Guides, strategies, and how-tos for event planners, restaurant operators, and hospitality teams.
            </p>
          </div>
          <div className="b-up" style={{ animationDelay:'.2s' }}>
            <div style={{ position:'relative', marginBottom:20 }}>
              <Search style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'#475569', pointerEvents:'none' }} />
              <input className="b-search" placeholder="Search articles..." value={q} onChange={e => setQ(e.target.value)} />
              {q && <button onClick={() => setQ('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#475569', cursor:'pointer', padding:2 }}><X style={{ width:13, height:13 }} /></button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
              {[{n:`${posts.length}+`,l:'Articles'},{n:'6',l:'Topics'},{n:'Weekly',l:'Updates'},{n:'Free',l:'Forever'}].map((s,i) => (
                <div key={s.l} style={{ padding:'12px 6px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRight: i<3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div className="b-syne" style={{ fontSize:14, fontWeight:800, color:'#818cf8', marginBottom:2 }}>{s.n}</div>
                  <div style={{ fontSize:9.5, fontWeight:600, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'48px 32px 80px' }}>

        {/* Featured */}
        {!q && cat === 'All' && featured.length > 0 && (
          <div style={{ marginBottom:56 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
              <Star style={{ width:12, height:12, color:'#fbbf24' }} />
              <span className="b-syne" style={{ fontSize:10, fontWeight:800, color:'#334155', textTransform:'uppercase', letterSpacing:'0.12em' }}>Featured</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14 }}>
              {featured.map((post, i) => (
                <button key={post._id} className="b-card" onClick={() => onRead(post)} style={{ padding:'24px', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', animationDelay:`${i*.05}s` }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${post.heroColor}55, transparent)` }} />
                  <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle,${post.heroColor}10 0%,transparent 70%)`, pointerEvents:'none' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                    <CatBadge cat={post.category} sm />
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.18)', color:'#fbbf24', textTransform:'uppercase', letterSpacing:'.06em' }}>Featured</span>
                  </div>
                  <h2 className="b-syne" style={{ fontSize:16, fontWeight:800, color:'#f1f5f9', lineHeight:1.3, marginBottom:10, letterSpacing:'-0.02em', flex:1 }}>{post.title}</h2>
                  <p style={{ fontSize:13, color:'#64748b', lineHeight:1.65, marginBottom:16, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{post.excerpt}</p>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', gap:14 }}>
                      <span style={{ fontSize:11, color:'#334155', display:'flex', alignItems:'center', gap:4 }}><Calendar style={{width:10,height:10}}/>{post.publishDate||''}</span>
                      <span style={{ fontSize:11, color:'#334155', display:'flex', alignItems:'center', gap:4 }}><Clock style={{width:10,height:10}}/>{post.readTime}m</span>
                    </div>
                    <span style={{ fontSize:11, color:post.heroColor, fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>Read <ArrowRight style={{width:10,height:10}}/></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, marginBottom:26 }}>
          {CATEGORIES.map(c => (
            <button key={c} className={`b-pill${cat===c?' active':''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:12, color:'#334155' }}>
            {loading ? 'Loading…' : `${filtered.length} article${filtered.length!==1?'s':''}`}
          </span>
        </div>

        {/* Grid */}
        {paged.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14, marginBottom:40 }}>
            {paged.map(post => (
              <button key={post._id} className="b-card" onClick={() => onRead(post)} style={{ padding:'20px', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:13 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:post.heroColor||'#6366f1', flexShrink:0 }} />
                  <CatBadge cat={post.category} sm />
                </div>
                <h3 className="b-syne" style={{ fontSize:14, fontWeight:800, color:'#e2e8f0', lineHeight:1.3, marginBottom:8, letterSpacing:'-0.02em', flex:1 }}>{post.title}</h3>
                <p style={{ fontSize:13, color:'#64748b', lineHeight:1.65, marginBottom:14, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{post.excerpt}</p>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
                  <div style={{ display:'flex', gap:12 }}>
                    <span style={{ fontSize:11, color:'#334155', display:'flex', alignItems:'center', gap:3 }}><Calendar style={{width:10,height:10}}/>{post.publishDate||''}</span>
                    <span style={{ fontSize:11, color:'#334155', display:'flex', alignItems:'center', gap:3 }}><Clock style={{width:10,height:10}}/>{post.readTime}m</span>
                  </div>
                  <span style={{ fontSize:11, color:'#334155', fontWeight:600 }}>Read →</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'64px 0' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Search style={{ width:16, height:16, color:'#475569' }} />
            </div>
            <h3 className="b-syne" style={{ fontSize:16, fontWeight:800, color:'#334155', marginBottom:6 }}>No articles found</h3>
            <p style={{ color:'#334155', fontSize:13 }}>Try a different search term or category</p>
            <button onClick={() => { setQ(''); setCat('All'); }} style={{ marginTop:16, padding:'7px 18px', borderRadius:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.22)', color:'#818cf8', fontSize:12, fontWeight:600, cursor:'pointer' }}>Clear filters</button>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:56 }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:'7px 14px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', color:page===1?'#1e293b':'#94a3b8', cursor:page===1?'default':'pointer', fontSize:12, fontWeight:600 }}>← Prev</button>
            {Array.from({length:pages},(_,i)=>i+1).map(n => (
              <button key={n} onClick={() => setPage(n)} style={{ width:34, height:34, borderRadius:8, background:page===n?'rgba(99,102,241,0.13)':'rgba(255,255,255,0.03)', border:`1px solid ${page===n?'rgba(99,102,241,0.38)':'rgba(255,255,255,0.06)'}`, color:page===n?'#a5b4fc':'#475569', cursor:'pointer', fontSize:12, fontWeight:700 }}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page===pages} style={{ padding:'7px 14px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', color:page===pages?'#1e293b':'#94a3b8', cursor:page===pages?'default':'pointer', fontSize:12, fontWeight:600 }}>Next →</button>
          </div>
        )}

        {/* CTA — horizontal strip */}
        <div className="b-cta-grid" style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:32, alignItems:'center', padding:'36px 40px', borderRadius:16, background:'linear-gradient(135deg,rgba(99,102,241,0.07) 0%,rgba(139,92,246,0.04) 100%)', border:'1px solid rgba(99,102,241,0.14)' }}>
          <div>
            <h2 className="b-syne" style={{ fontSize:18, fontWeight:800, color:'#f1f5f9', marginBottom:6, letterSpacing:'-0.02em' }}>Start planning with PlanIt</h2>
            <p style={{ color:'#64748b', fontSize:13.5, lineHeight:1.65, margin:0 }}>
              Free event management, restaurant floor tools, team chat, QR check-in. No account needed.
            </p>
          </div>
          <div className="b-cta-btns" style={{ display:'flex', gap:10, flexShrink:0 }}>
            <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 20px', borderRadius:9, background:'#fff', color:'#0f0f17', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
              <Calendar style={{width:13,height:13}}/> Plan an Event Free
            </a>
            <a href="/discover" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 20px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#e2e8f0', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
              Discover Events →
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'24px 32px', background:'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="b-syne" style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>PlanIt</span>
            <span style={{ color:'#1e293b', fontSize:12 }}>Blog & Guides</span>
          </div>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
            {[['Home','/'],['Discover','/discover'],['Help','/help'],['Status','/status'],['About','/about'],['Terms','/terms'],['Privacy','/privacy']].map(([l,h]) => (
              <a key={l} href={h} style={{ fontSize:12, color:'#1e293b', textDecoration:'none', transition:'color .15s' }}
                onMouseEnter={e => e.target.style.color='#64748b'}
                onMouseLeave={e => e.target.style.color='#1e293b'}
              >{l}</a>
            ))}
          </div>
          <span style={{ fontSize:11, color:'#1e293b' }}>© 2026 PlanIt · By Aakshat Hariharan</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Blog() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const [posts, setPosts]   = useState(SEED_POSTS);
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
