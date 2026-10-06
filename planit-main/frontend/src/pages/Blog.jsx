import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, X, Share2, Check } from 'lucide-react';
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

// Small colored dot per category (text stays neutral so the page stays calm)
const CAT_COLORS = {
  'Event Planning':        '#3b6fd4',
  'Restaurant Management': '#e0762c',
  'How-To Guides':         '#3f9a5b',
  'Wedding Planning':      '#cf5f8d',
  'Team Collaboration':    '#7a63c9',
  'Resources':             '#2a9aa0',
};

const BLOG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.b-root, .b-root *, .b-root *::before, .b-root *::after { box-sizing: border-box; }
.b-root {
  --b-ink: #0f0f10; --b-body: #2c2c30; --b-muted: #6b6b72; --b-faint: #9a9aa1;
  --b-line: #ececee; --b-soft: #f6f6f7; --b-bg: #fff;
  min-height: 100vh; background: var(--b-bg); color: var(--b-ink);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.b-root a { color: inherit; text-decoration: none; }
.b-root button { font-family: inherit; }
.b-root :focus-visible { outline: 2px solid var(--b-ink); outline-offset: 3px; border-radius: 4px; }

/* progress */
.b-progress { position: fixed; inset: 0 0 auto; height: 3px; z-index: 9999; pointer-events: none; }
.b-bar { height: 100%; background: var(--b-ink); transition: width .08s linear; }
@keyframes b-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.b-up { animation: b-up .5s cubic-bezier(.22,1,.36,1) both; }

/* nav */
.b-nav { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.88); backdrop-filter: saturate(180%) blur(16px); -webkit-backdrop-filter: saturate(180%) blur(16px); border-bottom: 1px solid var(--b-line); }
.b-nav-inner { width: min(960px, 100%); height: 64px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.b-logo { font-size: 18px; font-weight: 700; letter-spacing: -.03em; white-space: nowrap; }
.b-logo span { color: var(--b-faint); font-weight: 500; }
.b-nav-link { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; padding: 8px 0; border: 0; background: none; color: var(--b-muted); font-size: 15px; font-weight: 500; cursor: pointer; transition: color .15s; }
.b-nav-link:hover { color: var(--b-ink); }
.b-nav-link svg { transition: transform .2s; }
.b-nav-link:hover svg { transform: translateX(3px); }
.b-nav-link.back:hover svg { transform: translateX(-3px); }
.b-nav-spacer { flex: 1; }

/* layout */
.b-shell { width: min(960px, 100%); margin: 0 auto; padding: 0 24px; }

/* hero */
.b-hero { padding: clamp(56px, 10vw, 104px) 0 clamp(32px, 5vw, 48px); }
.b-hero h1 { margin: 0; max-width: 11em; font-size: clamp(38px, 6.4vw, 68px); font-weight: 600; line-height: 1.03; letter-spacing: -.045em; }
.b-hero h1 span { color: var(--b-faint); }

/* filters */
.b-controls { display: flex; align-items: center; gap: 20px; border-bottom: 1px solid var(--b-line); }
.b-tabs { display: flex; align-items: center; gap: 26px; overflow-x: auto; scrollbar-width: none; flex: 1; min-width: 0; }
.b-tabs::-webkit-scrollbar { display: none; }
.b-tab { position: relative; padding: 14px 0; border: 0; background: none; color: var(--b-muted); font-size: 15px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: color .15s; }
.b-tab:hover { color: var(--b-ink); }
.b-tab.active { color: var(--b-ink); }
.b-tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--b-ink); }
.b-search-wrap { position: relative; flex: 0 0 auto; width: 150px; transition: width .2s; }
.b-search-wrap:focus-within { width: 220px; }
.b-search { width: 100%; padding: 9px 26px 9px 24px; border: 0; background: transparent; color: var(--b-ink); font: 400 15px 'Inter', sans-serif; outline: none; }
.b-search::placeholder { color: var(--b-faint); }
.b-search-icon { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--b-faint); pointer-events: none; }
.b-search-clear { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: grid; place-items: center; padding: 4px; border: 0; background: transparent; color: var(--b-muted); cursor: pointer; }
.b-count { min-height: 0; margin: 20px 0 0; color: var(--b-faint); font-size: 14px; }
.b-count:empty { display: none; }

/* small bits */
.b-cat { display: inline-flex; align-items: center; gap: 8px; color: var(--b-muted); font-size: 13px; font-weight: 600; letter-spacing: .01em; }
.b-cat-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.b-meta { display: flex; flex-wrap: wrap; align-items: center; color: var(--b-faint); font-size: 14px; }
.b-meta span + span::before { content: '\\00b7'; margin: 0 9px; color: #c9c9ce; }
.b-meta .b-byline { color: var(--b-body); font-weight: 500; }

/* featured */
.b-featured { --accent: #3b6fd4; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; min-height: 340px; margin: 32px 0 8px; padding: clamp(26px, 5vw, 52px); border-radius: 24px; background: color-mix(in srgb, var(--accent) 8%, #fff); transition: background .25s, transform .25s; }
.b-featured:hover { background: color-mix(in srgb, var(--accent) 13%, #fff); }
.b-feature-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.b-feature-flag { color: var(--accent); font-size: 13px; font-weight: 600; }
.b-feature-title { max-width: 17em; margin: 0 0 16px; font-size: clamp(30px, 4.6vw, 52px); font-weight: 600; line-height: 1.06; letter-spacing: -.04em; }
.b-feature-excerpt { max-width: 34em; margin: 0 0 24px; color: var(--b-muted); font-size: 18px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* feed */
.b-feed { margin-top: 24px; }
.b-row { display: grid; grid-template-columns: minmax(0, 1fr) 40px; align-items: center; gap: 24px; padding: 30px 0; border-top: 1px solid var(--b-line); }
.b-row:first-child { border-top: 0; }
.b-row-title { margin: 12px 0 8px; font-size: clamp(21px, 2.6vw, 27px); font-weight: 600; line-height: 1.2; letter-spacing: -.028em; transition: color .15s; }
.b-row-excerpt { margin: 0 0 14px; color: var(--b-muted); font-size: 16px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.b-row-arrow { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--b-line); color: var(--b-ink); opacity: 0; transform: translateX(-6px); transition: opacity .2s, transform .2s, background .2s, color .2s; }
.b-row:hover .b-row-arrow { opacity: 1; transform: none; }
.b-row:hover .b-row-arrow { background: var(--b-ink); color: #fff; border-color: var(--b-ink); }

/* pagination */
.b-pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin: 16px 0 72px; }
.b-page-btn { min-width: 40px; height: 40px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--b-muted); font-size: 15px; font-weight: 500; cursor: pointer; transition: background .15s, color .15s; }
.b-page-btn:hover:not(:disabled) { background: var(--b-soft); color: var(--b-ink); }
.b-page-btn:disabled { color: #cfcfd4; cursor: default; }
.b-page-btn.current { background: var(--b-ink); color: #fff; }
.b-empty { padding: 72px 16px; text-align: center; color: var(--b-muted); font-size: 16px; }
.b-empty button { display: block; margin: 16px auto 0; padding: 10px 18px; border: 1px solid var(--b-line); border-radius: 999px; background: #fff; color: var(--b-ink); font-size: 14px; font-weight: 600; cursor: pointer; }

/* CTA */
.b-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 24px 0 80px; padding: clamp(28px, 4vw, 44px); border-radius: 24px; background: var(--b-ink); color: #fff; }
.b-cta h2 { margin: 0; max-width: 14em; font-size: clamp(24px, 3vw, 32px); font-weight: 600; line-height: 1.12; letter-spacing: -.035em; }
.b-cta-actions { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.b-cta-button { padding: 13px 22px; border-radius: 999px; background: #fff; color: var(--b-ink) !important; font-size: 15px; font-weight: 600; white-space: nowrap; transition: transform .15s; }
.b-cta-button:hover { transform: translateY(-1px); }
.b-cta-link { color: rgba(255,255,255,.7) !important; font-size: 15px; font-weight: 500; white-space: nowrap; }
.b-cta-link:hover { color: #fff !important; }

/* footer */
.b-footer { border-top: 1px solid var(--b-line); }
.b-footer-inner { width: min(960px, 100%); margin: 0 auto; padding: 32px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 28px; font-size: 14px; }
.b-footer-brand { font-weight: 700; letter-spacing: -.02em; }
.b-footer-links { display: flex; flex-wrap: wrap; gap: 8px 22px; }
.b-footer-links a { color: var(--b-muted); }
.b-footer-links a:hover { color: var(--b-ink); }
.b-copyright { color: var(--b-faint); }

/* article */
.b-article-head { --accent: #3b6fd4; width: min(720px, 100%); margin: 0 auto; padding: clamp(48px, 8vw, 88px) 24px 40px; }
.b-accent-bar { width: 36px; height: 4px; margin-bottom: 28px; border-radius: 4px; background: var(--accent); }
.b-article-flag { margin-left: 14px; color: var(--accent); font-size: 13px; font-weight: 600; }
.b-article-title { margin: 20px 0 20px; font-size: clamp(34px, 5.6vw, 56px); font-weight: 600; line-height: 1.06; letter-spacing: -.042em; }
.b-article-dek { margin: 0; color: var(--b-muted); font-size: clamp(18px, 2.2vw, 21px); line-height: 1.55; }
.b-article-meta { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--b-line); }
.b-share-button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border: 1px solid var(--b-line); border-radius: 999px; background: #fff; color: var(--b-ink); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; }
.b-share-button:hover { background: var(--b-soft); }
.b-article-body { width: min(720px, 100%); margin: 0 auto; padding: 8px 24px 24px; }
.b-prose h2 { margin: 2.6rem 0 .8rem; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -.03em; color: var(--b-ink); }
.b-prose h3 { margin: 2rem 0 .5rem; font-size: 20px; font-weight: 600; line-height: 1.35; letter-spacing: -.02em; color: var(--b-ink); }
.b-prose p, .b-prose li { color: var(--b-body); font-size: 18px; line-height: 1.75; }
.b-prose p { margin: 0 0 1.35rem; }
.b-prose ul, .b-prose ol { margin: 0 0 1.5rem; padding-left: 1.4rem; }
.b-prose li { margin-bottom: .55rem; padding-left: .25rem; }
.b-prose li::marker { color: var(--b-faint); }
.b-prose strong { color: var(--b-ink); font-weight: 600; }
.b-prose code { padding: .12em .4em; border-radius: 6px; background: var(--b-soft); font: .88em ui-monospace, SFMono-Regular, Menlo, monospace; }
.b-prose pre { margin: 1.6rem 0; padding: 18px 20px; overflow-x: auto; border-radius: 14px; background: var(--b-soft); }
.b-prose pre code { padding: 0; background: transparent; font-size: 14px; white-space: pre; }
.b-prose hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--b-line); }
.b-tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 40px; }
.b-tag { padding: 7px 14px; border-radius: 999px; background: var(--b-soft); color: var(--b-muted); font-size: 14px; font-weight: 500; }
.b-more { width: min(720px, 100%); margin: 56px auto 0; padding: 0 24px; }
.b-more-title { margin: 0 0 4px; color: var(--b-faint); font-size: 14px; font-weight: 600; }
.b-more .b-row { padding: 24px 0; }
.b-more .b-row-title { margin: 0 0 6px; font-size: 22px; }
.b-more .b-cta { margin-top: 48px; }

@media (max-width: 680px) {
  .b-nav-inner, .b-shell, .b-footer-inner { padding-left: 20px; padding-right: 20px; }
  .b-nav-inner { height: 58px; }
  .b-controls { gap: 12px; }
  .b-tabs { gap: 20px; }
  .b-search-wrap, .b-search-wrap:focus-within { width: 110px; }
  .b-featured { min-height: 300px; border-radius: 20px; }
  .b-row { grid-template-columns: 1fr; padding: 24px 0; }
  .b-row-arrow { display: none; }
  .b-row-excerpt { display: none; }
  .b-row-title { margin-bottom: 10px; }
  .b-cta { flex-direction: column; align-items: flex-start; border-radius: 20px; }
  .b-article-head, .b-article-body, .b-more { padding-left: 20px; padding-right: 20px; }
  .b-prose p, .b-prose li { font-size: 17px; }
  .b-prose h2 { font-size: 25px; }
}
@media (max-width: 520px) {
  .b-logo-center { display: none; }
}
@media (max-width: 420px) {
  .b-share-button { font-size: 0; gap: 0; padding: 10px; }
  .b-share-button svg { width: 16px; height: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .b-root *, .b-root *::before, .b-root *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-blog-v7';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = BLOG_CSS;
      document.head.appendChild(style);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);
  return null;
}

function ReadingBar() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return <div className="b-progress"><div className="b-bar" style={{ width: `${progress}%` }} /></div>;
}

function CatLabel({ cat }) {
  return <span className="b-cat">
    <span className="b-cat-dot" style={{ background: CAT_COLORS[cat] || '#9a9aa1' }} />{cat || 'Notes'}
  </span>;
}

function MetaLine({ post, withAuthor = false }) {
  const parts = [
    withAuthor && post.author ? { text: post.author, cls: 'b-byline' } : null,
    { text: fmtDate(post.publishDate || post.date) },
    { text: `${post.readTime || 5} min read` },
  ].filter(part => part && part.text);
  return <div className="b-meta">{parts.map((part, i) => <span key={i} className={part.cls}>{part.text}</span>)}</div>;
}

// Real links (crawlable, open-in-new-tab works) that still navigate in-app on a normal click
function postLink(post, onRead) {
  return {
    href: `/blog/${post.slug}`,
    onClick: event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      onRead(post);
    },
  };
}

function Prose({ content }) {
  const lines = (content || '').trim().split('\n');
  const elements = [];
  let list = [], listType = 'ul', inCode = false, codeLines = [], key = 0;
  const inline = text => text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  const flush = () => {
    if (!list.length) return;
    const List = listType;
    elements.push(<List key={`list-${key++}`}>{list.map((item, index) => <li key={index} dangerouslySetInnerHTML={{ __html: inline(item) }} />)}</List>);
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        flush();
        elements.push(<pre key={`code-${key++}`}><code>{codeLines.join('\n')}</code></pre>);
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.startsWith('## ')) { flush(); elements.push(<h2 key={`h2-${key++}`}>{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { flush(); elements.push(<h3 key={`h3-${key++}`}>{line.slice(4)}</h3>); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { if (listType !== 'ul') flush(); listType = 'ul'; list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line)) { if (listType !== 'ol') flush(); listType = 'ol'; list.push(line.replace(/^\d+\. /, '')); }
    else if (line.trim() === '---') { flush(); elements.push(<hr key={`hr-${key++}`} />); }
    else if (line.trim() === '') flush();
    else { flush(); elements.push(<p key={`p-${key++}`} dangerouslySetInnerHTML={{ __html: inline(line) }} />); }
  }
  flush();
  return <div className="b-prose">{elements}</div>;
}

function fmtDate(date) {
  if (!date) return '';
  try { return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return date; }
}

function setMeta(name, content) {
  const isProperty = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content || '');
}
function removeMeta(name) {
  const isProperty = name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:');
  document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${name}"]`)?.remove();
}
const META_TAGS = ['description', 'og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description', 'article:published_time', 'article:author', 'article:section'];

function PostFooter({ children }) {
  return <footer className="b-footer"><div className="b-footer-inner">
    <a href="/blog" className="b-footer-brand">PlanIt Journal</a>
    <div className="b-footer-links">{children}</div>
    <span className="b-copyright">© 2026 PlanIt · By Aakshat Hariharan</span>
  </div></footer>;
}

function CtaBand() {
  return <aside className="b-cta">
    <h2>Plan the details. Enjoy the moment.</h2>
    <div className="b-cta-actions">
      <a href="/" className="b-cta-button">Explore PlanIt</a>
      <a href="/discover" className="b-cta-link">Discover events</a>
    </div>
  </aside>;
}

function ArticleView({ post, allPosts, onBack }) {
  const related = allPosts.filter(item => item._id !== post._id && item.category === post.category).slice(0, 3);
  const [copied, setCopied] = useState(false);
  const tags = Array.isArray(post.tags) ? post.tags : (typeof post.tags === 'string' ? post.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []);

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
    setMeta('og:site_name', 'PlanIt Journal');
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', post.title);
    setMeta('twitter:description', post.excerpt || '');
    setMeta('article:published_time', post.publishDate || '');
    setMeta('article:author', post.author || 'PlanIt Team');
    setMeta('article:section', post.category || 'Event Planning');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;
    return () => {
      document.title = 'PlanIt Journal';
      META_TAGS.forEach(removeMeta);
      document.querySelector('link[rel="canonical"]')?.remove();
    };
  }, [post._id, post.author, post.category, post.excerpt, post.publishDate, post.slug, post.title]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  return <div className="b-root">
    <ReadingBar />
    <header className="b-nav"><div className="b-nav-inner">
      <button className="b-nav-link back" onClick={() => onBack()}><ArrowLeft size={16} /> All stories</button>
      <a href="/blog" className="b-logo b-logo-center">PlanIt<span> Journal</span></a>
      <a href="/" className="b-nav-link">Explore PlanIt <ArrowRight size={16} /></a>
    </div></header>

    <section className="b-article-head" style={{ '--accent': post.heroColor || '#3b6fd4' }}>
      <div className="b-accent-bar b-up" />
      <div className="b-up">
        <CatLabel cat={post.category} />
        {post.featured && <span className="b-article-flag">Editor’s pick</span>}
      </div>
      <h1 className="b-article-title b-up" style={{ animationDelay: '.04s' }}>{post.title}</h1>
      {post.excerpt && <p className="b-article-dek b-up" style={{ animationDelay: '.08s' }}>{post.excerpt}</p>}
      <div className="b-article-meta b-up" style={{ animationDelay: '.12s' }}>
        <MetaLine post={post} withAuthor />
        <button className="b-share-button" onClick={share} aria-label={copied ? 'Link copied' : 'Copy article link'}>
          {copied ? <><Check size={15} /> Copied</> : <><Share2 size={15} /> Share</>}
        </button>
      </div>
    </section>

    <main>
      <article className="b-article-body">
        <Prose content={post.content || ''} />
        {tags.length > 0 && <div className="b-tag-row">{tags.map(tag => <span className="b-tag" key={tag}>#{tag}</span>)}</div>}
      </article>

      <section className="b-more" aria-label="More stories">
        {related.length > 0 && <>
          <p className="b-more-title">More in {post.category}</p>
          {related.map(item => <a key={item._id} className="b-row" {...postLink(item, onBack)}>
            <div>
              <h3 className="b-row-title">{item.title}</h3>
              <MetaLine post={item} />
            </div>
            <span className="b-row-arrow"><ArrowRight size={18} /></span>
          </a>)}
        </>}
        <CtaBand />
      </section>
    </main>

    <PostFooter>{[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Privacy', '/privacy']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}</PostFooter>
  </div>;
}

function BlogIndex({ posts, loading, onRead }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 9;
  // Only show filters that actually have posts (known order first, then any new CMS categories)
  const used = new Set(posts.map(post => post.category).filter(Boolean));
  const categories = [...CATEGORIES.slice(1).filter(item => used.has(item)), ...[...used].filter(item => !CATEGORIES.includes(item))];
  const featuredPost = posts.find(post => post.featured) || posts[0];
  const showFeature = Boolean(featuredPost && category === 'All' && !query.trim());
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = posts.filter(post => {
    const categoryMatch = category === 'All' || post.category === category;
    const tags = Array.isArray(post.tags) ? post.tags : (typeof post.tags === 'string' ? post.tags.split(',') : []);
    const searchMatch = !normalizedQuery || [post.title, post.excerpt, post.author, post.category, ...tags]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(normalizedQuery));
    return categoryMatch && searchMatch;
  });
  const stories = filtered.filter(post => !showFeature || post._id !== featuredPost?._id);
  const pageCount = Math.ceil(stories.length / perPage);
  const visibleStories = stories.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [category, query]);

  const filtering = category !== 'All' || normalizedQuery;
  const countText = loading
    ? 'Loading…'
    : filtering ? `${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}${category !== 'All' ? ` in ${category}` : ''}` : '';

  return <div className="b-root">
    <header className="b-nav"><div className="b-nav-inner">
      <a href="/blog" className="b-logo">PlanIt<span> Journal</span></a>
      <a href="/" className="b-nav-link">Plan with PlanIt <ArrowRight size={16} /></a>
    </div></header>

    <main className="b-shell">
      <section className="b-hero">
        <h1 className="b-up">{category === 'All' ? <>Good plans make <span>good gatherings.</span></> : <>{category}</>}</h1>
      </section>

      <div className="b-controls">
        <div className="b-tabs" role="group" aria-label="Filter stories by category">
          <button className={`b-tab${category === 'All' ? ' active' : ''}`} onClick={() => setCategory('All')} aria-pressed={category === 'All'}>All</button>
          {categories.map(item => <button key={item} className={`b-tab${category === item ? ' active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
        </div>
        <div className="b-search-wrap">
          <Search className="b-search-icon" aria-hidden="true" />
          <input className="b-search" aria-label="Search stories" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} />
          {query && <button className="b-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
        </div>
      </div>
      <p className="b-count" aria-live="polite">{countText}</p>

      {showFeature && featuredPost && <a className="b-featured" aria-label={`Featured story: ${featuredPost.title}`}
        style={{ '--accent': featuredPost.heroColor || '#3b6fd4' }} {...postLink(featuredPost, onRead)}>
        <div className="b-feature-top"><CatLabel cat={featuredPost.category} /><span className="b-feature-flag">Editor’s pick</span></div>
        <div>
          <h2 className="b-feature-title">{featuredPost.title}</h2>
          {featuredPost.excerpt && <p className="b-feature-excerpt">{featuredPost.excerpt}</p>}
          <MetaLine post={featuredPost} withAuthor />
        </div>
      </a>}

      <section className="b-feed" aria-label="Stories">
        {visibleStories.length > 0
          ? visibleStories.map(post => <a key={post._id} className="b-row" {...postLink(post, onRead)}>
              <div>
                <CatLabel cat={post.category} />
                <h3 className="b-row-title">{post.title}</h3>
                {post.excerpt && <p className="b-row-excerpt">{post.excerpt}</p>}
                <MetaLine post={post} />
              </div>
              <span className="b-row-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </a>)
          : filtered.length === 0
            ? <div className="b-empty">No stories match that search.<button onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button></div>
            : !showFeature ? <div className="b-empty">No stories on this page.</div> : null}
      </section>

      {pageCount > 1 && <nav className="b-pagination" aria-label="Story pages">
        <button className="b-page-btn" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} className={`b-page-btn${page === number ? ' current' : ''}`} onClick={() => setPage(number)} aria-current={page === number ? 'page' : undefined}>{number}</button>)}
        <button className="b-page-btn" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next</button>
      </nav>}

      <CtaBand />
    </main>

    <PostFooter>{[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Status', '/status'], ['Privacy', '/privacy'], ['Terms', '/terms']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}</PostFooter>
  </div>;
}

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
    } catch { /* retain fallback articles when the CMS is unavailable */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => {
    if (!slug) { setActive(null); return; }
    const found = posts.find(post => post.slug === slug);
    if (found) { setActive(found); return; }
    blogAPI.getBySlug(slug)
      .then(({ data }) => { if (data?.post) setActive(data.post); else navigate('/blog', { replace: true }); })
      .catch(() => navigate('/blog', { replace: true }));
  }, [slug, posts, navigate]);

  const read = post => { setActive(post); navigate(`/blog/${post.slug}`); window.scrollTo({ top: 0 }); };
  const back = next => {
    if (next?.slug) { read(next); return; }
    setActive(null); navigate('/blog'); window.scrollTo({ top: 0 });
  };

  return <>
    <InjectCSS />
    {active ? <ArticleView post={active} allPosts={posts} onBack={back} /> : <BlogIndex posts={posts} loading={loading} onRead={read} />}
  </>;
}
