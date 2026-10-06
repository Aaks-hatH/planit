import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Tag, Search, X, BookOpen, Share2, Check } from 'lucide-react';
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
  'Event Planning':        { bg: '#eef3ff', text: '#3458a5', border: '#d9e4ff', dot: '#5278ca' },
  'Restaurant Management': { bg: '#fff3e9', text: '#9a542a', border: '#f7dfca', dot: '#d4864e' },
  'How-To Guides':         { bg: '#edf5ef', text: '#426a4e', border: '#d7e8da', dot: '#6b9874' },
  'Wedding Planning':      { bg: '#f8eef2', text: '#96556f', border: '#f0dce5', dot: '#ba7894' },
  'Team Collaboration':    { bg: '#f1eff9', text: '#65598f', border: '#e2def2', dot: '#887bb8' },
  'Resources':             { bg: '#eaf4f4', text: '#3f7073', border: '#d4e9e9', dot: '#5c999b' },
};

const BLOG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
.b-root, .b-root *, .b-root *::before, .b-root *::after { box-sizing: border-box; }
.b-root {
  --b-ink: #20241f; --b-muted: #777d76; --b-line: #e6e8e2;
  --b-paper: #fafaf7; --b-white: #fff; --b-accent: #315f91;
  min-height: 100vh; background: var(--b-paper); color: var(--b-ink);
  font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
}
.b-root a { color: inherit; }
.b-progress { position: fixed; inset: 0 0 auto; height: 2px; z-index: 9999; pointer-events: none; background: transparent; }
.b-bar { height: 100%; background: #6583a6; transition: width .08s linear; }
@keyframes b-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.b-up { animation: b-up .42s cubic-bezier(.22,1,.36,1) both; }
.b-nav { position: sticky; top: 0; z-index: 50; background: rgba(250,250,247,.94); backdrop-filter: blur(14px); border-bottom: 1px solid var(--b-line); }
.b-nav-inner { width: min(1120px, 100%); margin: 0 auto; padding: 0 28px; min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.b-logo { font-family: 'Instrument Serif', Georgia, serif; font-size: 25px; line-height: 1; color: var(--b-ink); text-decoration: none; letter-spacing: -.035em; white-space: nowrap; }
.b-logo span { color: #4776a5; }
.b-nav-links { display: flex; align-items: center; gap: 25px; }
.b-nav-link { padding: 8px 0; background: none; border: 0; color: #69716a; cursor: pointer; font: 500 12px 'DM Sans', sans-serif; transition: color .16s; }
.b-nav-link:hover, .b-nav-link.active { color: var(--b-ink); }
.b-nav-link.active { box-shadow: inset 0 -1px #4776a5; }
.b-nav-cta { text-decoration: none; border: 1px solid #dfe3de; border-radius: 999px; padding: 8px 14px; color: #3f5147 !important; background: #fff; font-size: 11px; font-weight: 600; transition: border-color .16s, background .16s; white-space: nowrap; }
.b-nav-cta:hover { background: #f2f5f1; border-color: #cdd7ce; }
.b-shell { width: min(1120px, 100%); margin: 0 auto; padding: 0 28px; }
.b-controls { border-bottom: 1px solid var(--b-line); background: rgba(255,255,255,.55); }
.b-controls-inner { width: min(1120px, 100%); min-height: 58px; margin: 0 auto; padding: 8px 28px; display: flex; align-items: center; gap: 7px; overflow-x: auto; scrollbar-width: none; }
.b-controls-inner::-webkit-scrollbar { display: none; }
.b-pill { padding: 7px 12px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: #737b73; font: 500 11px 'DM Sans', sans-serif; cursor: pointer; transition: all .16s; white-space: nowrap; }
.b-pill:hover { color: var(--b-ink); background: #f0f1eb; }
.b-pill.active { background: #e9eee9; border-color: #dde5dd; color: #334b3c; }
.b-search-wrap { margin-left: auto; flex: 0 0 190px; position: relative; }
.b-search { width: 100%; padding: 8px 30px 8px 30px; border: 1px solid #e5e7e1; border-radius: 999px; background: #fff; color: var(--b-ink); font: 400 11px 'DM Sans', sans-serif; outline: none; transition: border-color .16s, box-shadow .16s; }
.b-search:focus { border-color: #a9bdcf; box-shadow: 0 0 0 3px rgba(71,118,165,.09); }
.b-search::placeholder { color: #9ba199; }
.b-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: #929991; pointer-events: none; }
.b-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; padding: 2px; color: #778078; border: 0; background: transparent; cursor: pointer; }
.b-intro { padding: 46px 0 28px; display: flex; justify-content: space-between; align-items: end; gap: 24px; }
.b-eyebrow { margin: 0 0 10px; color: #7e8980; font: 700 9px 'DM Sans', sans-serif; letter-spacing: .17em; text-transform: uppercase; }
.b-intro h1 { max-width: 650px; margin: 0; font: 400 clamp(34px, 5vw, 55px)/.98 'Instrument Serif', Georgia, serif; letter-spacing: -.035em; }
.b-intro h1 em { color: #58789a; font-weight: 400; }
.b-intro-note { max-width: 205px; margin: 0 0 3px; color: #858b83; font-size: 11px; line-height: 1.65; }
.b-count { padding: 13px 0 8px; margin-bottom: 15px; border-top: 1px solid var(--b-line); color: #8a9089; font-size: 10px; }
.b-count strong { color: #4f5950; font-weight: 600; }
.b-section-heading { display: flex; align-items: center; gap: 11px; margin: 0 0 14px; color: #7d867e; font: 700 9px 'DM Sans', sans-serif; letter-spacing: .14em; text-transform: uppercase; }
.b-section-heading::after { content: ''; height: 1px; flex: 1; background: var(--b-line); }
.b-featured { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(250px, .85fr); min-height: 265px; margin-bottom: 42px; overflow: hidden; border: 1px solid var(--b-line); border-radius: 9px; background: #fff; box-shadow: 0 8px 24px rgba(33,44,35,.035); }
.b-feature-copy { padding: clamp(24px,4vw,42px); display: flex; flex-direction: column; align-items: flex-start; }
.b-feature-top { display: flex; align-items: center; gap: 8px; margin-bottom: 17px; }
.b-feature-title { max-width: 580px; margin: 0 0 11px; font: 400 clamp(27px,3.6vw,41px)/1.04 'Instrument Serif', Georgia, serif; letter-spacing: -.025em; }
.b-feature-excerpt { max-width: 480px; margin: 0 0 18px; color: #737a72; font-size: 12px; line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.b-feature-meta { margin-top: auto; display: flex; align-items: center; gap: 11px; color: #878e86; font-size: 10px; }
.b-byline { color: #505a51; font-weight: 600; }
.b-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: #bac0b9; }
.b-read-link { margin-left: 7px; display: inline-flex; align-items: center; gap: 5px; color: #456f97; font-size: 10px; font-weight: 600; }
.b-feature-art { position: relative; min-height: 220px; display: grid; place-items: center; overflow: hidden; background: linear-gradient(145deg, color-mix(in srgb, var(--feature-color, #5278ca) 13%, #f6f8f4), #eef1eb 82%); }
.b-feature-art::before, .b-feature-art::after { content: ''; position: absolute; border: 1px solid color-mix(in srgb, var(--feature-color, #5278ca) 18%, transparent); border-radius: 50%; }
.b-feature-art::before { width: 260px; height: 260px; }
.b-feature-art::after { width: 188px; height: 188px; }
.b-art-mark { position: relative; z-index: 1; width: 72px; height: 72px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.8); border-radius: 50%; background: rgba(255,255,255,.62); color: var(--feature-color, #5278ca); box-shadow: 0 10px 36px rgba(40,55,42,.07); }
.b-art-caption { position: absolute; right: 17px; bottom: 14px; color: #818980; font: 600 8px 'DM Sans', sans-serif; letter-spacing: .16em; text-transform: uppercase; }
.b-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border: 1px solid; border-radius: 999px; font: 600 9px 'DM Sans', sans-serif; letter-spacing: .025em; white-space: nowrap; }
.b-badge-dot { width: 5px; height: 5px; border-radius: 50%; flex: 0 0 auto; }
.b-featured-flag { padding: 4px 7px; color: #7d7651; background: #f8f6e9; border: 1px solid #ece8cd; border-radius: 999px; font: 600 8px 'DM Sans', sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.b-latest { padding-bottom: 50px; }
.b-post-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 11px; }
.b-post-card { width: 100%; min-height: 177px; padding: 18px 18px 15px; display: flex; flex-direction: column; align-items: flex-start; border: 1px solid var(--b-line); border-radius: 8px; background: rgba(255,255,255,.82); cursor: pointer; text-align: left; transition: transform .18s, box-shadow .18s, border-color .18s; }
.b-post-card:hover { transform: translateY(-2px); border-color: #d3dcd3; box-shadow: 0 9px 23px rgba(36,53,40,.055); }
.b-post-card h3 { width: 100%; margin: 12px 0 7px; font: 400 21px/1.12 'Instrument Serif', Georgia, serif; letter-spacing: -.015em; }
.b-post-excerpt { margin: 0 0 14px; color: #7b827b; font-size: 10px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.b-post-meta { width: 100%; margin-top: auto; display: flex; align-items: center; gap: 7px; color: #969c94; font-size: 9px; }
.b-post-meta .b-read-link { margin-left: auto; }
.b-pagination { display: flex; justify-content: center; align-items: center; gap: 5px; margin: 27px 0 48px; }
.b-page-btn { min-width: 31px; height: 31px; padding: 0 10px; border: 1px solid var(--b-line); border-radius: 999px; background: #fff; color: #707971; font: 500 10px 'DM Sans', sans-serif; cursor: pointer; }
.b-page-btn:disabled { color: #bec3bc; cursor: default; }
.b-page-btn.current { color: #fff; border-color: #496b57; background: #496b57; }
.b-empty { padding: 52px 16px; text-align: center; border: 1px dashed #dfe3dc; border-radius: 9px; color: #747d74; font-size: 12px; }
.b-empty button { margin-top: 11px; padding: 7px 13px; border: 1px solid var(--b-line); border-radius: 999px; background: #fff; color: #4d5c50; font: 600 10px 'DM Sans', sans-serif; cursor: pointer; }
.b-cta-strip { margin: 0 0 52px; padding: 21px 23px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid #dfe5dc; border-radius: 9px; background: #f1f4ee; }
.b-cta-copy h2 { margin: 0 0 4px; font: 400 23px/1.1 'Instrument Serif', Georgia, serif; }
.b-cta-copy p { margin: 0; color: #788178; font-size: 10px; }
.b-cta-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.b-cta-button { padding: 9px 13px; border: 1px solid #476652; border-radius: 999px; background: #496b57; color: #fff !important; font-size: 10px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background .15s; }
.b-cta-button:hover { background: #3c5a48; }
.b-cta-button.secondary { color: #4d6151 !important; background: #fff; border-color: #d9e0d7; }
.b-cta-button.secondary:hover { background: #f7f9f5; }
.b-footer { border-top: 1px solid var(--b-line); background: rgba(255,255,255,.52); }
.b-footer-inner { width: min(1120px, 100%); margin: 0 auto; padding: 21px 28px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 13px; }
.b-footer-brand { font: 400 20px 'Instrument Serif', Georgia, serif; }
.b-footer-links { display: flex; flex-wrap: wrap; gap: 17px; }
.b-footer-links a { color: #7e867e; font-size: 9px; text-decoration: none; }
.b-footer-links a:hover { color: #334a3a; }
.b-copyright { color: #a0a59e; font-size: 9px; }
.b-article-head { padding: 40px 28px 31px; border-bottom: 1px solid var(--b-line); background: #fff; }
.b-article-head-inner { max-width: 760px; margin: 0 auto; }
.b-article-title { margin: 15px 0 12px; font: 400 clamp(36px,5vw,56px)/.99 'Instrument Serif', Georgia, serif; letter-spacing: -.035em; }
.b-article-dek { max-width: 640px; margin: 0; color: #737a72; font-size: 13px; line-height: 1.75; }
.b-article-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 11px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #eceee9; color: #818980; font-size: 10px; }
.b-article-actions { margin-left: auto; }
.b-back-button, .b-share-button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 0; border: 0; background: none; color: #6f7970; font: 500 10px 'DM Sans', sans-serif; text-decoration: none; cursor: pointer; }
.b-back-button:hover, .b-share-button:hover { color: #2e4637; }
.b-article-layout { width: min(940px, 100%); margin: 0 auto; padding: 37px 28px 70px; display: grid; grid-template-columns: minmax(0,680px) 190px; gap: 46px; align-items: start; justify-content: center; }
.b-prose h2 { margin: 2.25rem 0 .65rem; color: #262d27; font: 400 29px/1.12 'Instrument Serif', Georgia, serif; letter-spacing: -.015em; }
.b-prose h3 { margin: 1.7rem 0 .45rem; color: #354137; font: 600 15px/1.4 'DM Sans', sans-serif; }
.b-prose p, .b-prose li { color: #505950; font: 400 14px/1.85 'DM Sans', sans-serif; }
.b-prose p { margin: 0 0 1.2rem; }
.b-prose ul, .b-prose ol { margin: .3rem 0 1.35rem 1.25rem; padding-left: .25rem; }
.b-prose li { margin-bottom: .42rem; padding-left: .2rem; }
.b-prose li::marker { color: #698571; }
.b-prose strong { color: #29372d; font-weight: 700; }
.b-prose em { font-style: italic; }
.b-prose code { padding: .1em .35em; border: 1px solid #e4e9e1; border-radius: 4px; background: #f3f5f1; color: #45624d; font: .88em ui-monospace, monospace; }
.b-prose pre { margin: 1.4rem 0; padding: 15px 17px; overflow-x: auto; border: 1px solid #e5e9e2; border-radius: 8px; background: #f5f7f3; }
.b-prose pre code { border: 0; background: transparent; color: #435347; font-size: 12px; white-space: pre; }
.b-prose hr { margin: 2.3rem 0; border: 0; border-top: 1px solid var(--b-line); }
.b-tag-row { margin-top: 32px; padding-top: 17px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; border-top: 1px solid var(--b-line); }
.b-tag { padding: 5px 9px; border: 1px solid #e4e8e1; border-radius: 999px; background: #fff; color: #737b73; font-size: 9px; }
.b-sidebar { position: sticky; top: 85px; }
.b-side-card { padding: 16px; border: 1px solid var(--b-line); border-radius: 8px; background: #fff; }
.b-side-card + .b-side-card { margin-top: 13px; }
.b-side-kicker { margin: 0 0 8px; color: #818a80; font: 700 8px 'DM Sans', sans-serif; letter-spacing: .13em; text-transform: uppercase; }
.b-side-title { margin: 0 0 7px; color: #344238; font: 400 21px/1.06 'Instrument Serif', Georgia, serif; }
.b-side-text { margin: 0 0 12px; color: #7c847b; font-size: 10px; line-height: 1.65; }
.b-side-cta { display: inline-block; color: #42664f !important; font-size: 10px; font-weight: 600; text-decoration: none; }
.b-related-link { display: block; width: 100%; padding: 9px 0; border: 0; border-bottom: 1px solid #eff0ec; background: none; color: #344037; font: 400 14px/1.15 'Instrument Serif', Georgia, serif; text-align: left; cursor: pointer; }
.b-related-link:last-child { border-bottom: 0; padding-bottom: 0; }
.b-related-link small { display: block; margin-top: 4px; color: #999f97; font: 400 9px 'DM Sans', sans-serif; }
@media (max-width: 880px) {
  .b-nav-links { gap: 15px; }
  .b-nav-links .b-nav-link:nth-child(n+4) { display: none; }
  .b-article-layout { grid-template-columns: minmax(0, 680px); }
  .b-sidebar { position: static; display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
  .b-side-card + .b-side-card { margin-top: 0; }
}
@media (max-width: 680px) {
  .b-nav-inner { min-height: 58px; padding: 0 18px; gap: 12px; }
  .b-nav-links { display: none; }
  .b-logo { font-size: 23px; }
  .b-shell { padding: 0 18px; }
  .b-controls-inner { padding: 8px 18px; min-height: 53px; }
  .b-search-wrap { flex-basis: 145px; }
  .b-intro { padding: 34px 0 21px; display: block; }
  .b-intro h1 { max-width: 500px; font-size: clamp(36px,11vw,49px); }
  .b-intro-note { display: none; }
  .b-count { margin-bottom: 12px; }
  .b-featured { grid-template-columns: 1fr; }
  .b-feature-copy { padding: 23px; min-height: 237px; }
  .b-feature-art { min-height: 140px; grid-row: 1; }
  .b-feature-art::before { width: 184px; height: 184px; }
  .b-feature-art::after { width: 130px; height: 130px; }
  .b-art-mark { width: 55px; height: 55px; }
  .b-feature-title { font-size: 32px; }
  .b-post-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
  .b-post-card { min-height: 165px; padding: 14px 13px 12px; }
  .b-post-card h3 { font-size: 19px; }
  .b-post-excerpt { font-size: 9px; }
  .b-cta-strip { align-items: flex-start; flex-direction: column; padding: 18px; }
  .b-cta-copy h2 { font-size: 22px; }
  .b-footer-inner { padding: 19px 18px; }
  .b-article-head { padding: 29px 18px 24px; }
  .b-article-title { font-size: clamp(36px,10vw,48px); }
  .b-article-layout { padding: 27px 18px 53px; }
  .b-prose p, .b-prose li { font-size: 13px; }
}
@media (max-width: 420px) {
  .b-post-grid { grid-template-columns: 1fr; }
  .b-post-card { min-height: 145px; }
  .b-sidebar { grid-template-columns: 1fr; }
  .b-share-button { font-size: 0; gap: 0; }
  .b-share-button svg { width: 15px; height: 15px; }
}
@media (prefers-reduced-motion: reduce) {
  .b-root *, .b-root *::before, .b-root *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-blog-v6';
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

function CatBadge({ cat }) {
  const color = CAT_COLORS[cat] || { bg: '#f1f3ef', text: '#667066', border: '#e3e8e1', dot: '#879187' };
  return <span className="b-badge" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
    <span className="b-badge-dot" style={{ background: color.dot }} />{cat || 'Notes'}
  </span>;
}

function MetaLine({ post, feature = false }) {
  return <div className={feature ? 'b-feature-meta' : 'b-post-meta'}>
    {post.author && <span className="b-byline">{post.author}</span>}
    {post.author && <span className="b-meta-dot" />}
    <span>{fmtDate(post.publishDate || post.date)}</span>
    <span className="b-meta-dot" />
    <span>{post.readTime || 5} min read</span>
    {feature && <span className="b-read-link">Read story <ArrowRight size={12} /></span>}
  </div>;
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
    <a href="/blog" className="b-footer-brand" style={{ textDecoration: 'none' }}>Plan<span style={{ color: '#4776a5' }}>It</span> Journal</a>
    <div className="b-footer-links">{children}</div>
    <span className="b-copyright">© 2026 PlanIt · By Aakshat Hariharan</span>
  </div></footer>;
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
      <button className="b-back-button" onClick={() => onBack()}><ArrowLeft size={14} /> All stories</button>
      <a href="/blog" className="b-logo">Plan<span>It</span> Journal</a>
      <a href="/" className="b-nav-cta">Explore PlanIt <ArrowRight size={12} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></a>
    </div></header>

    <section className="b-article-head"><div className="b-article-head-inner">
      <div className="b-up" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CatBadge cat={post.category} />
        {post.featured && <span className="b-featured-flag">Editor’s pick</span>}
      </div>
      <h1 className="b-article-title b-up" style={{ animationDelay: '.04s' }}>{post.title}</h1>
      {post.excerpt && <p className="b-article-dek b-up" style={{ animationDelay: '.08s' }}>{post.excerpt}</p>}
      <div className="b-article-meta b-up" style={{ animationDelay: '.12s' }}>
        {post.author && <span className="b-byline">{post.author}</span>}
        <span className="b-meta-dot" /><span>{fmtDate(post.publishDate || post.date)}</span>
        <span className="b-meta-dot" /><span><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{post.readTime || 5} min read</span>
        <button className="b-share-button b-article-actions" onClick={share} aria-label={copied ? 'Link copied' : 'Copy article link'}>
          {copied ? <><Check size={13} /> Copied</> : <><Share2 size={13} /> Share</>}
        </button>
      </div>
    </div></section>

    <main className="b-article-layout">
      <article>
        <Prose content={post.content || ''} />
        {tags.length > 0 && <div className="b-tag-row"><Tag size={13} color="#8c958b" />{tags.map(tag => <span className="b-tag" key={tag}>#{tag}</span>)}</div>}
      </article>
      <aside className="b-sidebar">
        <div className="b-side-card">
          <p className="b-side-kicker">Make room for a good gathering</p>
          <h2 className="b-side-title">Plan the details. Enjoy the moment.</h2>
          <p className="b-side-text">Simple tools for guest lists, schedules, check-in, and everything in between.</p>
          <a className="b-side-cta" href="/">Explore PlanIt <ArrowRight size={11} style={{ verticalAlign: 'middle' }} /></a>
        </div>
        {related.length > 0 && <div className="b-side-card">
          <p className="b-side-kicker">More in {post.category}</p>
          {related.map(item => <button className="b-related-link" key={item._id} onClick={() => onBack(item)}>{item.title}<small>{item.readTime || 5} min read</small></button>)}
        </div>}
      </aside>
    </main>

    <PostFooter>{[['Home', '/'], ['Discover', '/discover'], ['Help', '/help'], ['Privacy', '/privacy']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}</PostFooter>
  </div>;
}

function StoryCard({ post, onRead }) {
  return <button className="b-post-card" onClick={() => onRead(post)}>
    <CatBadge cat={post.category} />
    <h3>{post.title}</h3>
    {post.excerpt && <p className="b-post-excerpt">{post.excerpt}</p>}
    <MetaLine post={post} />
  </button>;
}

function BlogIndex({ posts, loading, onRead }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 9;
  const categories = [...new Set([...CATEGORIES.slice(1), ...posts.map(post => post.category).filter(Boolean)])];
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

  return <div className="b-root">
    <ReadingBar />
    <header className="b-nav"><div className="b-nav-inner">
      <a href="/blog" className="b-logo">Plan<span>It</span> Journal</a>
      <nav className="b-nav-links" aria-label="Featured topics">
        {categories.slice(0, 3).map(item => <button key={item} className={`b-nav-link${category === item ? ' active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>
      <a href="/" className="b-nav-cta">Plan with PlanIt <ArrowRight size={12} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></a>
    </div></header>

    <div className="b-controls"><div className="b-controls-inner" aria-label="Filter stories by category">
      <button className={`b-pill${category === 'All' ? ' active' : ''}`} onClick={() => setCategory('All')} aria-pressed={category === 'All'}>All stories</button>
      {categories.map(item => <button key={item} className={`b-pill${category === item ? ' active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
      <div className="b-search-wrap">
        <Search className="b-search-icon" aria-hidden="true" />
        <input className="b-search" aria-label="Search stories" placeholder="Search stories" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button className="b-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
      </div>
    </div></div>

    <main className="b-shell">
      <section className="b-intro">
        <div><p className="b-eyebrow">Notes on bringing people together</p>
          <h1>{category === 'All' ? <>Good plans make<br /><em>good gatherings.</em></> : <>{category}<br /><em>ideas & field notes.</em></>}</h1>
        </div>
        <p className="b-intro-note">Practical inspiration for thoughtful events, welcoming spaces, and the people who make them happen.</p>
      </section>
      <div className="b-count" aria-live="polite">{loading ? 'Finding the latest stories…' : <><strong>{filtered.length}</strong> {filtered.length === 1 ? 'story' : 'stories'}{category !== 'All' ? ` in ${category}` : ' in the journal'}</>}</div>

      {showFeature && featuredPost && <section aria-label="Featured story">
        <p className="b-section-heading">Featured story</p>
        <button className="b-featured" onClick={() => onRead(featuredPost)} style={{ width: '100%', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
          <div className="b-feature-copy">
            <div className="b-feature-top"><CatBadge cat={featuredPost.category} /><span className="b-featured-flag">Editor’s pick</span></div>
            <h2 className="b-feature-title">{featuredPost.title}</h2>
            {featuredPost.excerpt && <p className="b-feature-excerpt">{featuredPost.excerpt}</p>}
            <MetaLine post={featuredPost} feature />
          </div>
          <div className="b-feature-art" aria-hidden="true" style={{ '--feature-color': featuredPost.heroColor || '#5278ca' }}>
            <div className="b-art-mark"><BookOpen size={26} strokeWidth={1.35} /></div>
            <span className="b-art-caption">PlanIt journal · {String(featuredPost.category || 'Stories').toUpperCase()}</span>
          </div>
        </button>
      </section>}

      <section className="b-latest" aria-label="Latest stories">
        <p className="b-section-heading">{showFeature ? 'More to explore' : 'Stories'}</p>
        {visibleStories.length > 0 ? <div className="b-post-grid">{visibleStories.map(post => <StoryCard key={post._id} post={post} onRead={onRead} />)}</div> : filtered.length === 0 ? <div className="b-empty">No stories match that search.<br /><button onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button></div> : !showFeature && visibleStories.length === 0 ? <div className="b-empty">No stories on this page.</div> : null}
        {pageCount > 1 && <nav className="b-pagination" aria-label="Story pages">
          <button className="b-page-btn" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} className={`b-page-btn${page === number ? ' current' : ''}`} onClick={() => setPage(number)} aria-current={page === number ? 'page' : undefined}>{number}</button>)}
          <button className="b-page-btn" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next</button>
        </nav>}
      </section>

      <aside className="b-cta-strip">
        <div className="b-cta-copy"><h2>Make your next gathering a good one.</h2><p>One calm place to organize the details and bring everyone together.</p></div>
        <div className="b-cta-actions"><a href="/" className="b-cta-button">Explore PlanIt</a><a href="/discover" className="b-cta-button secondary">Discover events</a></div>
      </aside>
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
