import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Search, X,
  BookOpen, Star, Share2, Check,
} from 'lucide-react';
import { blogAPI } from '../services/api';

// ─── Seed posts (displayed immediately while API loads, replaced when API responds) ──
// These are kept so the blog is never blank on first load / cold-start.
// Once real posts exist in the DB the seeds are superseded.
const SEED_POSTS = [
  {
    _id:'seed-p1', slug:'how-to-plan-corporate-event', featured:true, heroColor:'#6366f1',
    title:"How to Plan a Corporate Event That People Actually Want to Attend",
    excerpt:"Corporate events have a reputation problem. Here's how to break the mold and run an event people genuinely remember.",
    category:'Event Planning', tags:['corporate','planning','tips'],
    author:'PlanIt Team', publishDate:'2026-03-10', readTime:9,
    content:`## The Problem With Most Corporate Events\n\nMandatory fun. That's what employees whisper as they drag themselves to yet another off-site retreat. Corporate events often fail not because of budget, but because of planning failure.\n\nThe antidote is simple: **treat your event like a product launch, not a logistics exercise**.\n\n## Step 1: Define a Single Outcome\n\nBefore you book a venue or send a calendar invite, write one sentence: *What does success look like the day after this event?*\n\n- "Our cross-functional teams feel aligned on Q3 priorities."\n- "New hires feel genuinely welcomed into our culture."\n- "Attendees leave with three actionable takeaways they'll use Monday morning."\n\nEvery decision — venue, agenda, catering, activities — should serve that sentence.\n\n## Step 2: Use a Centralized Planning Workspace\n\nThe biggest waste in corporate event planning is duplicated effort across email threads, shared drives, and Slack channels nobody checks. A platform like PlanIt gives your entire planning team a single workspace with:\n\n- **Shared task lists** with assignees and deadlines\n- **Team chat** with file sharing — floor plans, run-of-show, catering orders all in one place\n- **Real-time polls** to nail down decisions without 47-email threads\n\n## Step 3: Design the Attendee Journey\n\nThink in experiences, not time slots:\n\n1. **Arrival moment** — What's the first thing people see?\n2. **First connection** — Intentional seating, conversation starters\n3. **Energy management** — Alternate high-focus sessions with social breaks\n4. **The memorable moment** — One wow moment people will talk about\n\n## Step 4: Check-In Without the Chaos\n\nNothing undermines event confidence like a 40-person queue at registration. QR check-in via PlanIt Enterprise Mode lets your staff check in attendees in under 3 seconds each while you watch real-time attendance dashboards.\n\n## Step 5: Close the Loop\n\nSend a follow-up within 24 hours: a summary of decisions made, resources shared, and next steps.\n\n---\n\nCorporate events that work aren't magic. They're methodical.`,
  },
  {
    _id:'seed-p2', slug:'restaurant-waitlist-management', featured:true, heroColor:'#f97316',
    title:"The Complete Guide to Restaurant Waitlist Management in 2026",
    excerpt:"Walk-in traffic is back — and it's brutal without the right system. Here's exactly how to manage your waitlist so guests stay happy and tables turn faster.",
    category:'Restaurant Management', tags:['restaurant','waitlist','operations'],
    author:'PlanIt Team', publishDate:'2026-03-05', readTime:7,
    content:`## Why Waitlist Management Is a Competitive Edge\n\nA poorly managed waitlist costs real money. Studies consistently show 30-45% of waiting parties will leave if they don't receive a realistic wait quote within 5 minutes.\n\n## The Three Sins of Bad Waitlist Management\n\n**Sin 1: The Mental Math Quote.** "About 20-25 minutes" guessed by a harried host is almost always wrong.\n\n**Sin 2: Shouting Names Across a Loud Room.** Forces guests to hover anxiously near the host stand.\n\n**Sin 3: No Transparency.** Guests who can't see where they are in line assume the worst.\n\n## How PlanIt Venue Solves All Three\n\nPlanIt's live wait board shows party name, position in line, and estimated wait time calculated from actual table turn data.\n\n---\n\nWaitlist management done right turns a pain point into a differentiator.`,
  },
  {
    _id:'seed-p3', slug:'qr-checkin-event-guide', featured:false, heroColor:'#22c55e',
    title:"QR Code Check-In for Events: The Complete Setup Guide",
    excerpt:"Paper guest lists are an embarrassment in 2026. Here's how to set up professional QR check-in for any event size — in under 10 minutes.",
    category:'How-To Guides', tags:['check-in','QR code','how-to'],
    author:'PlanIt Team', publishDate:'2026-02-28', readTime:5,
    content:`## Why QR Check-In Wins Every Time\n\nClipboards are slow. Spreadsheets on a laptop are clunky.\n\n## What You Need\n\n- A PlanIt event set up in Enterprise Mode\n- Your guest list imported or entered\n- One device per check-in station\n\n## Step 1: Enable Enterprise Mode\n\nWhen creating your event in PlanIt, select **Enterprise Mode**.\n\n---\n\nThe setup time investment is minimal. The payoff — a smooth, professional check-in — is significant.`,
  },
  {
    _id:'seed-p4', slug:'free-event-planning-software-comparison', featured:true, heroColor:'#06b6d4',
    title:"Free Event Planning Software in 2026: An Honest Comparison",
    excerpt:"We tested every major free event planning tool and ranked them by what actually matters: ease of setup, guest management, team collaboration, and zero hidden paywalls.",
    category:'Resources', tags:['comparison','tools','free software'],
    author:'PlanIt Team', publishDate:'2026-02-07', readTime:10,
    content:`## The Real Criteria for Evaluating Free Event Software\n\nMost "best of" lists rank tools by feature count or UI polish. Neither matters if the tool locks you out mid-event.\n\n## PlanIt\n\n**Free forever.** No accounts for guests or team members. The workspace is shareable via link.\n\n---\n\nThe best tool is the one your whole team will actually use consistently.`,
  },
];

const CATEGORIES = ['All','Event Planning','Restaurant Management','How-To Guides','Wedding Planning','Team Collaboration','Resources'];
const CAT_COLORS = {
  'Event Planning':        {bg:'rgba(99,102,241,0.12)',  text:'#a5b4fc', border:'rgba(99,102,241,0.25)'},
  'Restaurant Management': {bg:'rgba(249,115,22,0.12)',  text:'#fdba74', border:'rgba(249,115,22,0.25)'},
  'How-To Guides':         {bg:'rgba(34,197,94,0.12)',   text:'#86efac', border:'rgba(34,197,94,0.25)'},
  'Wedding Planning':      {bg:'rgba(236,72,153,0.12)',  text:'#f9a8d4', border:'rgba(236,72,153,0.25)'},
  'Team Collaboration':    {bg:'rgba(139,92,246,0.12)',  text:'#c4b5fd', border:'rgba(139,92,246,0.25)'},
  'Resources':             {bg:'rgba(6,182,212,0.12)',   text:'#67e8f9', border:'rgba(6,182,212,0.25)'},
};

// ─── Styles injected once ─────────────────────────────────────────────────────
const BLOG_CSS=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
.bsyne{font-family:'Syne',sans-serif;}.bdm{font-family:'DM Sans',sans-serif;}.blora{font-family:'Lora',serif;}
@keyframes bfadeup{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}
@keyframes bshimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
.bfadeup{animation:bfadeup 0.55s cubic-bezier(.22,1,.36,1) both;}
.bcard{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:transform .3s cubic-bezier(.22,1,.36,1),border-color .3s,box-shadow .3s;}
.bcard:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.11);box-shadow:0 24px 48px rgba(0,0,0,.5);}
.bcard-feat:hover{border-color:rgba(99,102,241,.3);box-shadow:0 30px 60px rgba(0,0,0,.5),0 0 40px rgba(99,102,241,.06);}
.bsearch{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:.65rem 1rem .65rem 2.5rem;color:#fff;font-size:.875rem;width:100%;outline:none;transition:border-color .2s,background .2s;}
.bsearch:focus{border-color:rgba(99,102,241,.4);background:rgba(255,255,255,.05);}
.bsearch::placeholder{color:#4b5563;}
.rprogress{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(255,255,255,.04);z-index:100;}
.rpbar{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa);transition:width .1s linear;box-shadow:0 0 8px rgba(99,102,241,.6);}
.bprose h2{font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;color:#fff;margin:2.4rem 0 .9rem;letter-spacing:-.02em;line-height:1.2;}
.bprose h3{font-family:'Syne',sans-serif;font-size:1.15rem;font-weight:700;color:#e2e8f0;margin:1.8rem 0 .65rem;}
.bprose p{font-family:'Lora',serif;font-size:1.05rem;line-height:1.85;color:#94a3b8;margin:0 0 1.4rem;}
.bprose strong{color:#e2e8f0;font-weight:700;}
.bprose em{font-style:italic;color:#cbd5e1;}
.bprose ul,.bprose ol{margin:1rem 0 1.4rem 1.5rem;}
.bprose li{font-family:'Lora',serif;font-size:1.05rem;line-height:1.8;color:#94a3b8;margin-bottom:.45rem;}
.bprose li::marker{color:#6366f1;}
.bprose code{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.2);padding:.12em .42em;border-radius:4px;font-size:.87em;color:#a5b4fc;}
.bprose hr{border:none;border-top:1px solid rgba(255,255,255,.07);margin:2.8rem 0;}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-blog-v3';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = BLOG_CSS;
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
  return <div className="rprogress"><div className="rpbar" style={{ width: `${p}%` }} /></div>;
}

function CatBadge({ cat, sm }) {
  const c = CAT_COLORS[cat] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.25)' };
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: sm ? '2px 8px' : '4px 12px', borderRadius: 999,
      fontSize: sm ? 10 : 11, fontWeight: 700, letterSpacing: '.07em',
      textTransform: 'uppercase', display: 'inline-block', whiteSpace: 'nowrap',
    }}>{cat}</span>
  );
}

// ─── Markdown renderer (no dangerouslySetInnerHTML on user content) ────────────
function Prose({ content }) {
  const lines = content.trim().split('\n');
  const els = []; let list = [], inCode = false, codeLines = [], k = 0;
  const flush = () => {
    if (list.length) {
      els.push(<ul key={'ul' + k++}>{list.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: il(it) }} />)}</ul>);
      list = [];
    }
  };
  // inline: only bold / italic / code — no raw HTML passthrough from user content
  const il = t => t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        flush();
        els.push(
          <pre key={'pre' + k++} style={{ background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '1.2rem 1.4rem', overflowX: 'auto', margin: '1.5rem 0' }}>
            <code style={{ color: '#94a3b8', fontSize: '0.88rem', whiteSpace: 'pre' }}>{codeLines.join('\n')}</code>
          </pre>
        );
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.startsWith('## '))      { flush(); els.push(<h2 key={'h2' + k++}>{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')){ flush(); els.push(<h3 key={'h3' + k++}>{line.slice(4)}</h3>); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line))   { list.push(line.replace(/^\d+\. /, '')); }
    else if (line.trim() === '---')   { flush(); els.push(<hr key={'hr' + k++} />); }
    else if (line.trim() === '')      { flush(); }
    else if (line.trim())             { flush(); els.push(<p key={'p' + k++} dangerouslySetInnerHTML={{ __html: il(line) }} />); }
  }
  flush();
  return <div className="bprose">{els}</div>;
}

// ─── Article view ─────────────────────────────────────────────────────────────
function ArticleView({ post, allPosts, onBack }) {
  const related = allPosts.filter(p => p._id !== post._id && p.category === post.category).slice(0, 3);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${post.title} — PlanIt Blog`;
    return () => { document.title = 'PlanIt Blog'; };
  }, [post._id]);

  const share = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const dateStr = post.publishDate || post.date || '';

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff' }} className="bdm">
      <ReadingBar />
      <header style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.96)', backdropFilter: 'blur(24px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '5px 10px', borderRadius: 8 }}>
            <ArrowLeft style={{ width: 13, height: 13 }} />Back to Blog
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>PlanIt Home</a>
            <button onClick={share} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 8, background: copied ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.07)'}`, color: copied ? '#86efac' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
              {copied ? <><Check style={{ width: 11, height: 11 }} />Copied</> : <><Share2 style={{ width: 11, height: 11 }} />Share</>}
            </button>
          </div>
        </div>
      </header>

      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: `linear-gradient(135deg,${post.heroColor}08 0%,transparent 60%)`, padding: '58px 24px 44px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <CatBadge cat={post.category} />
            {post.featured && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(251,191,36,0.09)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.07em' }}>Featured</span>}
          </div>
          <h1 className="bsyne bfadeup" style={{ fontSize: 'clamp(1.7rem,4.5vw,2.9rem)', fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 18, animationDelay: '.05s' }}>{post.title}</h1>
          <p className="blora bfadeup" style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: 24, animationDelay: '.14s' }}>{post.excerpt}</p>
          <div className="bfadeup" style={{ display: 'flex', alignItems: 'center', gap: 18, animationDelay: '.22s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${post.heroColor}22`, border: `1px solid ${post.heroColor}38`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: post.heroColor }}>{(post.author || 'P')[0]}</span>
              </div>
              <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{post.author}</span>
            </div>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar style={{ width: 11, height: 11 }} />
              {dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock style={{ width: 11, height: 11 }} />{post.readTime} min read
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px 80px' }}>
        <Prose content={post.content || ''} />
        {post.tags?.length > 0 && (
          <div style={{ marginTop: 44, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <Tag style={{ width: 12, height: 12, color: '#4b5563' }} />
            {(Array.isArray(post.tags) ? post.tags : String(post.tags).split(',').map(t => t.trim())).map(tag => (
              <span key={tag} style={{ fontSize: 12, color: '#6b7280', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '3px 9px', borderRadius: 6, fontWeight: 500 }}>#{tag}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 52, padding: '32px 36px', borderRadius: 18, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.14)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
          <h3 className="bsyne" style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 7 }}>Ready to plan your event?</h3>
          <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.65, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px', fontFamily: 'Lora,serif' }}>PlanIt gives you team chat, RSVP, QR check-in, seating charts, and budget tracking — free forever, no account needed.</p>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 11, background: '#fff', color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Get Started Free <ArrowRight style={{ width: 13, height: 13 }} /></a>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', padding: '48px 24px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <h2 className="bsyne" style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-.02em' }}>More from {post.category}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              {related.map(p => (
                <button key={p._id} onClick={() => onBack(p)} style={{ textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all .25s', width: '100%' }}>
                  <CatBadge cat={p.category} sm />
                  <p className="bsyne" style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginTop: 9, marginBottom: 6, lineHeight: 1.3 }}>{p.title}</p>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{p.readTime} min read</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Blog index ───────────────────────────────────────────────────────────────
function BlogIndex({ posts, loading, onRead }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const PER = 6;

  const featured = posts.filter(p => p.featured);
  const filtered = posts.filter(p => {
    const mc = cat === 'All' || p.category === cat;
    const ql = q.toLowerCase();
    const ms = !ql || p.title.toLowerCase().includes(ql) || p.excerpt.toLowerCase().includes(ql) || (Array.isArray(p.tags) ? p.tags : []).some(t => t.toLowerCase().includes(ql));
    return mc && ms;
  });
  const rest = filtered.filter(p => !p.featured || cat !== 'All' || q);
  const pages = Math.ceil(rest.length / PER);
  const paged = rest.slice((page - 1) * PER, page * PER);

  useEffect(() => { setPage(1); }, [cat, q]);

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff' }} className="bdm">
      <ReadingBar />
      <header style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.96)', backdropFilter: 'blur(24px)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.23)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar style={{ width: 12, height: 12, color: '#818cf8' }} />
              </div>
              <span className="bsyne" style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>PlanIt</span>
            </a>
            <span style={{ color: '#1f2937', fontSize: 15 }}>/</span>
            <span className="bsyne" style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Blog</span>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <a href="/discover" style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Discover</a>
            <a href="/help" style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Help</a>
            <a href="/" style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Get Started →</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ padding: '68px 24px 52px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'radial-gradient(ellipse 80% 60% at 50% 0%,rgba(99,102,241,0.06) 0%,transparent 60%)' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
          <div className="bfadeup" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 999, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', marginBottom: 22 }}>
            <BookOpen style={{ width: 11, height: 11, color: '#818cf8' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.1em' }}>PlanIt Blog & Guides</span>
          </div>
          <h1 className="bsyne bfadeup" style={{ fontSize: 'clamp(1.9rem,5.5vw,3.2rem)', fontWeight: 800, color: '#fff', lineHeight: 1.06, letterSpacing: '-.04em', marginBottom: 16, animationDelay: '.08s' }}>
            Plan smarter.<br />
            <span style={{ background: 'linear-gradient(90deg,#818cf8 0%,#c4b5fd 50%,#818cf8 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'bshimmer 4s linear infinite' }}>Execute flawlessly.</span>
          </h1>
          <p className="bfadeup blora" style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.7, marginBottom: 28, animationDelay: '.17s' }}>Guides, how-tos, and strategies for event planners, restaurant operators, and hospitality professionals.</p>
          <div className="bfadeup" style={{ position: 'relative', maxWidth: 420, margin: '0 auto', animationDelay: '.25s' }}>
            <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#4b5563', pointerEvents: 'none' }} />
            <input className="bsearch" placeholder="Search articles..." value={q} onChange={e => setQ(e.target.value)} />
            {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X style={{ width: 13, height: 13 }} /></button>}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', height: 48, display: 'flex', alignItems: 'center', gap: 24 }}>
          {[{ n: posts.length + '+', l: 'Articles' }, { n: '6', l: 'Categories' }, { n: 'Weekly', l: 'Updates' }, { n: 'Free', l: 'Forever' }].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="bsyne" style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>{s.n}</span>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{s.l}</span>
            </div>
          ))}
          {loading && <span style={{ fontSize: 11, color: '#374151', marginLeft: 'auto' }}>Loading…</span>}
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px 80px' }}>
        {/* Featured */}
        {!q && cat === 'All' && featured.length > 0 && (
          <div style={{ marginBottom: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              <Star style={{ width: 13, height: 13, color: '#fbbf24' }} />
              <span className="bsyne" style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.12em' }}>Featured</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
              {featured.map((post, i) => (
                <button key={post._id} className="bcard bcard-feat" onClick={() => onRead(post)} style={{ textAlign: 'left', borderRadius: 18, padding: '26px 26px 22px', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 250, position: 'relative', overflow: 'hidden', animationDelay: `${i * .06}s` }}>
                  <div style={{ position: 'absolute', top: -35, right: -35, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(circle,${post.heroColor}15 0%,transparent 70%)`, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${post.heroColor}55,transparent)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                    <CatBadge cat={post.category} sm />
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.09)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.06em' }}>Featured</span>
                  </div>
                  <h2 className="bsyne" style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 9, letterSpacing: '-.02em', flex: 1 }}>{post.title}</h2>
                  <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.6, marginBottom: 16, fontFamily: 'Lora,serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar style={{ width: 10, height: 10 }} />{post.publishDate || post.date || ''}</span>
                      <span style={{ fontSize: 11, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 3 }}><Clock style={{ width: 10, height: 10 }} />{post.readTime}m</span>
                    </div>
                    <span style={{ fontSize: 11, color: post.heroColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>Read <ArrowRight style={{ width: 10, height: 10 }} /></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 32 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, border: `1px solid ${cat === c ? 'rgba(99,102,241,.38)' : 'rgba(255,255,255,0.07)'}`, background: cat === c ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', color: cat === c ? '#a5b4fc' : '#6b7280', cursor: 'pointer', transition: 'all .2s' }}>{c}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center' }}>{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Grid */}
        {paged.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14, marginBottom: 44 }}>
            {paged.map((post, i) => (
              <button key={post._id} className="bcard" onClick={() => onRead(post)} style={{ textAlign: 'left', borderRadius: 16, padding: '20px 20px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', animationDelay: `${i * .04}s` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: post.heroColor + '18', border: `1px solid ${post.heroColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: post.heroColor }} />
                  </div>
                  <CatBadge cat={post.category} sm />
                </div>
                <h3 className="bsyne" style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.25, marginBottom: 9, letterSpacing: '-.02em', flex: 1 }}>{post.title}</h3>
                <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.6, marginBottom: 14, fontFamily: 'Lora,serif', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <span style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar style={{ width: 10, height: 10 }} />{post.publishDate || post.date || ''}</span>
                    <span style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 3 }}><Clock style={{ width: 10, height: 10 }} />{post.readTime}m</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600 }}>Read →</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '70px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
            <h3 className="bsyne" style={{ fontSize: 17, fontWeight: 800, color: '#374151', marginBottom: 7 }}>No articles found</h3>
            <p style={{ color: '#4b5563', fontSize: 13 }}>Try a different search or category</p>
            <button onClick={() => { setQ(''); setCat('All'); }} style={{ marginTop: 14, padding: '7px 18px', borderRadius: 9, background: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear filters</button>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 56 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '7px 15px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: page === 1 ? '#374151' : '#9ca3af', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>← Prev</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} style={{ width: 34, height: 34, borderRadius: 9, background: page === n ? 'rgba(99,102,241,0.13)' : 'rgba(255,255,255,0.03)', border: `1px solid ${page === n ? 'rgba(99,102,241,.38)' : 'rgba(255,255,255,0.06)'}`, color: page === n ? '#a5b4fc' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '7px 15px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: page === pages ? '#374151' : '#9ca3af', cursor: page === pages ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>Next →</button>
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '44px 36px', borderRadius: 18, background: 'linear-gradient(135deg,rgba(99,102,241,0.07) 0%,rgba(139,92,246,0.04) 100%)', border: '1px solid rgba(99,102,241,0.13)', textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>✦</div>
          <h2 className="bsyne" style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 7, letterSpacing: '-.02em' }}>Start planning with PlanIt</h2>
          <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7, maxWidth: 420, margin: '0 auto 24px', fontFamily: 'Lora,serif' }}>Everything in this blog is powered by PlanIt — free event management, restaurant floor tools, team chat, QR check-in. No account needed.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 11, background: '#fff', color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}><Calendar style={{ width: 13, height: 13 }} />Plan an Event Free</a>
            <a href="/discover" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Discover Events →</a>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 24px', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="bsyne" style={{ fontSize: 13, fontWeight: 800, color: '#374151' }}>PlanIt</span>
            <span style={{ color: '#1f2937', fontSize: 12 }}>Blog & Guides</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Status', '/status'], ['About', '/about'], ['Blog', '/blog'], ['Terms', '/terms'], ['Privacy', '/privacy']].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12, color: '#374151', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#1f2937' }}>© 2026 PlanIt · By Aakshat Hariharan</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Blog() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(SEED_POSTS);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  // Fetch posts from the API; fall back silently to seed posts on error
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await blogAPI.list({ limit: 50 });
      if (data?.posts?.length > 0) {
        setPosts(data.posts);
      }
      // If API returns 0 posts (DB is fresh), keep showing seed posts
    } catch {
      // Network / server error — keep seed posts, don't crash
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Resolve slug from URL
  useEffect(() => {
    if (slug) {
      const found = posts.find(p => p.slug === slug);
      if (found) { setActive(found); return; }
      // If not found in current posts list, try fetching directly (e.g. deep link on load)
      blogAPI.getBySlug(slug)
        .then(({ data }) => { if (data?.post) setActive(data.post); })
        .catch(() => { navigate('/blog', { replace: true }); });
    } else {
      setActive(null);
    }
  }, [slug, posts, navigate]);

  const read = p => {
    setActive(p);
    navigate('/blog/' + p.slug);
    window.scrollTo({ top: 0 });
  };

  const back = nextPost => {
    if (nextPost?.slug) { read(nextPost); return; }
    setActive(null);
    navigate('/blog');
    window.scrollTo({ top: 0 });
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
