import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Search, X, Plus,
  Edit3, Trash2, Save, Eye, Lock, BookOpen, Star, Share2, Check
} from 'lucide-react';

// ─── SEED POSTS ───────────────────────────────────────────────────────────────
const SEED_POSTS = [
  {
    id:'p1', slug:'how-to-plan-corporate-event', featured:true, heroColor:'#6366f1',
    title:"How to Plan a Corporate Event That People Actually Want to Attend",
    excerpt:"Corporate events have a reputation problem. Here's how to break the mold and run an event people genuinely remember.",
    category:'Event Planning', tags:['corporate','planning','tips'],
    author:'PlanIt Team', date:'2026-03-10', readTime:9,
    content:`## The Problem With Most Corporate Events\n\nMandatory fun. That's what employees whisper as they drag themselves to yet another off-site retreat. Corporate events often fail not because of budget, but because of planning failure.\n\nThe antidote is simple: **treat your event like a product launch, not a logistics exercise**.\n\n## Step 1: Define a Single Outcome\n\nBefore you book a venue or send a calendar invite, write one sentence: *What does success look like the day after this event?*\n\n- "Our cross-functional teams feel aligned on Q3 priorities."\n- "New hires feel genuinely welcomed into our culture."\n- "Attendees leave with three actionable takeaways they'll use Monday morning."\n\nEvery decision — venue, agenda, catering, activities — should serve that sentence.\n\n## Step 2: Use a Centralized Planning Workspace\n\nThe biggest waste in corporate event planning is duplicated effort across email threads, shared drives, and Slack channels nobody checks. A platform like PlanIt gives your entire planning team a single workspace with:\n\n- **Shared task lists** with assignees and deadlines\n- **Team chat** with file sharing — floor plans, run-of-show, catering orders all in one place\n- **Real-time polls** to nail down decisions without 47-email threads\n\n## Step 3: Design the Attendee Journey\n\nThink in experiences, not time slots:\n\n1. **Arrival moment** — What's the first thing people see?\n2. **First connection** — Intentional seating, conversation starters\n3. **Energy management** — Alternate high-focus sessions with social breaks\n4. **The memorable moment** — One wow moment people will talk about\n\n## Step 4: Check-In Without the Chaos\n\nNothing undermines event confidence like a 40-person queue at registration. QR check-in via PlanIt Enterprise Mode lets your staff check in attendees in under 3 seconds each while you watch real-time attendance dashboards.\n\n## Step 5: Close the Loop\n\nSend a follow-up within 24 hours: a summary of decisions made, resources shared, and next steps. Your PlanIt event chat is already the record — it's all there.\n\n---\n\nCorporate events that work aren't magic. They're methodical.`,
  },
  {
    id:'p2', slug:'restaurant-waitlist-management', featured:true, heroColor:'#f97316',
    title:"The Complete Guide to Restaurant Waitlist Management in 2026",
    excerpt:"Walk-in traffic is back — and it's brutal without the right system. Here's exactly how to manage your waitlist so guests stay happy and tables turn faster.",
    category:'Restaurant Management', tags:['restaurant','waitlist','operations'],
    author:'PlanIt Team', date:'2026-03-05', readTime:7,
    content:`## Why Waitlist Management Is a Competitive Edge\n\nA poorly managed waitlist costs real money. Studies consistently show 30-45% of waiting parties will leave if they don't receive a realistic wait quote within 5 minutes. That's revenue walking out the door.\n\n## The Three Sins of Bad Waitlist Management\n\n**Sin 1: The Mental Math Quote.** "About 20-25 minutes" guessed by a harried host is almost always wrong and destroys trust.\n\n**Sin 2: Shouting Names Across a Loud Room.** Calling out party names forces guests to hover anxiously near the host stand instead of relaxing at the bar.\n\n**Sin 3: No Transparency.** Guests who can't see where they are in line assume the worst.\n\n## How PlanIt Venue Solves All Three\n\nPlanIt's live wait board is a public-facing display that shows:\n\n- Party name and position in line\n- Estimated wait time calculated from actual table turn data\n- A real-time count of parties ahead\n\nWhen a table opens, you tap "Seat Next" — the party is notified, the wait board updates automatically, and your host is free to actually host.\n\n## Setting Accurate Wait Estimates\n\nThe key to accurate quotes is **historical turn time data**. PlanIt tracks how long each table size takes to turn on your floor, broken down by time of day and day of week. After 2-3 weeks, the system knows your 4-tops take 52 minutes on Friday nights vs. 38 minutes on Tuesdays.\n\n## The QR Reservation Flow\n\nFor high-demand nights, let guests reserve from your Instagram bio or website via PlanIt's QR reservation link. They enter their name, party size, and preferred time — you see it in your floor dashboard and can confirm or adjust.\n\n---\n\nWaitlist management done right turns a pain point into a differentiator.`,
  },
  {
    id:'p3', slug:'qr-checkin-event-guide', featured:false, heroColor:'#22c55e',
    title:"QR Code Check-In for Events: The Complete Setup Guide",
    excerpt:"Paper guest lists are an embarrassment in 2026. Here's how to set up professional QR check-in for any event size — in under 10 minutes.",
    category:'How-To Guides', tags:['check-in','QR code','how-to'],
    author:'PlanIt Team', date:'2026-02-28', readTime:5,
    content:`## Why QR Check-In Wins Every Time\n\nClipboards are slow. Spreadsheets on a laptop are clunky. Manually scrolling a list while 40 people queue behind them is a nightmare.\n\nQR check-in is faster, looks more professional, and gives you real-time data you can actually use.\n\n## What You Need\n\n- A PlanIt event set up in Enterprise Mode\n- Your guest list imported or entered\n- One device per check-in station (phone works fine)\n- 30 minutes of prep time\n\n## Step 1: Enable Enterprise Mode\n\nWhen creating your event in PlanIt, select **Enterprise Mode**. This unlocks personalized QR codes for each invited guest, the check-in dashboard, and attendance analytics.\n\n## Step 2: Add Your Guests\n\nIn your event's Guests panel, add each invited guest's name and email. PlanIt generates a unique QR code for each person automatically.\n\n**Pro tip:** Import a CSV if you have a large list — PlanIt accepts standard spreadsheet exports.\n\n## Step 3: Send the Invites\n\nUse PlanIt's built-in invite sender or copy the personalized QR links to send via your own email tool. Each invite contains:\n\n- Event details\n- The guest's personal QR code\n- A "View my invite" link\n\n## Step 4: Set Up Check-In Stations\n\nOpen the PlanIt check-in dashboard on each device. Scan speed is **under 3 seconds per guest** with a clear phone camera — no special hardware needed.\n\n## Step 5: Monitor in Real Time\n\nThe organizer dashboard shows % checked in, who arrived and when, and walk-in vs. pre-registered ratios.\n\n---\n\nThe setup time investment is minimal. The payoff — a smooth, professional check-in — is significant.`,
  },
  {
    id:'p4', slug:'wedding-planning-tools', featured:false, heroColor:'#ec4899',
    title:"The Only Wedding Planning Toolkit You Need (Without the Subscription Fee)",
    excerpt:"Wedding planning apps charge $30-60/month for features you can get free. Here's how to plan your entire wedding with PlanIt — budget, vendor chat, RSVP, seating, and more.",
    category:'Wedding Planning', tags:['wedding','free tools','planning'],
    author:'PlanIt Team', date:'2026-02-20', readTime:8,
    content:`## The Wedding App Racket\n\nYou get engaged. Immediately you're bombarded with ads for wedding planning apps at $29.99/month, $49/month, $79/month for "premium." Some charge separately for guest management, seating, and budgeting.\n\nHere's a better way.\n\n## What PlanIt Gives You, Free\n\nA PlanIt event space for your wedding is your complete planning hub — shared with your partner, your wedding planner, every vendor, your MOH, and your parents. No one needs to create an account. Zero dollars.\n\n### 1. Budget & Expense Tracking\n\nAdd every vendor quote and actual payment to the Expenses section. You see exactly where you are versus your total budget at all times. **Most couples discover 15-20% budget creep they never saw coming.** PlanIt makes it visible before it becomes a crisis.\n\n### 2. Vendor Communication Hub\n\nAdd every vendor to your event chat. No more miscommunication. Every conversation is in one place, searchable.\n\n### 3. RSVP Management\n\nGuests RSVP via your event's public link. No accounts needed — they enter their name and dietary requirements. You see your headcount update in real time.\n\n### 4. Seating Chart\n\nPlanIt's drag-and-drop seating tool lets you arrange tables and assign guests. When last-minute RSVPs arrive, you can update the chart in two minutes on your phone.\n\n### 5. Day-Of Check-In\n\nFor the ceremony or reception, use Enterprise Mode to check in guests as they arrive. Unexpected plus-ones? Added on the spot.\n\n---\n\nThe best wedding planning tool is the one every single person on your team will actually use.`,
  },
  {
    id:'p5', slug:'event-seating-chart-tips', featured:false, heroColor:'#a78bfa',
    title:"7 Seating Chart Mistakes That Ruin Events (and How to Avoid All of Them)",
    excerpt:"Seating is one of the highest-leverage decisions in event planning. Get it wrong and the entire atmosphere suffers. Get it right and people think the event was magical.",
    category:'Event Planning', tags:['seating','events','tips'],
    author:'PlanIt Team', date:'2026-02-14', readTime:6,
    content:`## Why Seating Is More Powerful Than You Think\n\nPlanners often treat seating as an administrative chore. But every experienced event coordinator knows: seating *is* the event. It determines who talks to whom and whether the energy in the room builds or dies.\n\n## Mistake 1: Alphabetical Seating\n\nAlphabetical order is for libraries, not events. Seating people based on the first letter of their last name guarantees strangers at every table with nothing in common.\n\n**Fix:** Seat by relationship, role, or interest cluster.\n\n## Mistake 2: Ignoring the Stage Sightline\n\nThe worst seat in the room always belongs to someone important. They spend the entire keynote craning their neck.\n\n**Fix:** Map your room and identify sightline dead zones *before* assigning seats.\n\n## Mistake 3: Splitting Plus-Ones From Their Partners\n\nNothing makes a plus-one feel like a burden faster than being seated at a different table from their partner.\n\n**Fix:** Always seat couples and plus-one pairs at the same table. Non-negotiable.\n\n## Mistake 4: Too Many Round Tables\n\nPast 8 people, a single round table splinters into 2-3 micro-conversations. Nobody talks to the person directly opposite them.\n\n**Fix:** For dinner events over 8-per-table, use rectangular tables where conversation flows more naturally.\n\n## Mistake 5: Freezing the Chart Too Early\n\nFinal RSVPs trickle in for days after the deadline. Keep your seating chart editable until 48 hours before the event.\n\n## Mistake 6: No Buffer Seats for VIPs\n\nVIP guests often arrive with last-minute additions. If the VIP table is packed to capacity, it's embarrassing.\n\n**Fix:** Leave one empty "reserved" seat at VIP tables.\n\n## Mistake 7: Forgetting Accessibility\n\nA guest in a wheelchair assigned to a chair in the middle of a tightly packed row is a failure of hospitality.\n\n**Fix:** When collecting RSVPs, ask about accessibility needs. Designate accessible seats first.\n\n---\n\nA great seating chart is invisible. Nobody compliments it — they just have a good time.`,
  },
  {
    id:'p6', slug:'free-event-planning-software-comparison', featured:true, heroColor:'#06b6d4',
    title:"Free Event Planning Software in 2026: An Honest Comparison",
    excerpt:"We tested every major free event planning tool and ranked them by what actually matters: ease of setup, guest management, team collaboration, and zero hidden paywalls.",
    category:'Resources', tags:['comparison','tools','free software'],
    author:'PlanIt Team', date:'2026-02-07', readTime:10,
    content:`## The Real Criteria for Evaluating Free Event Software\n\nMost "best of" lists rank tools by feature count or UI polish. Neither matters if the tool locks you out mid-event or requires every guest to create an account.\n\nWe evaluated tools on:\n- **True zero cost** — no credit card for core features\n- **Frictionless guest experience** — what does the guest need to do?\n- **Team collaboration** — can your whole team access without individual accounts?\n- **Scalability** — does it work for 10 guests and for 500?\n\n## PlanIt\n\n**Free forever.** No accounts for guests or team members. The workspace is shareable via link.\n\nStand-outs: real-time team chat, QR code check-in, seating charts, task management, expense tracking, live polls, and a full restaurant floor manager.\n\n**Best for:** Any event where team collaboration and guest management matter more than ticket sales.\n\n## Eventbrite (Free tier)\n\nGood for public ticket distribution. The free tier is limited to free-ticket events, and even then Eventbrite charges a service fee to ticket buyers.\n\n**Best for:** Public events that need broad discoverability and ticket distribution.\n\n## Google Workspace\n\nTechnically free and extremely flexible — but requires significant setup. There's no event-specific workflow.\n\n**Best for:** Teams already deep in Google Workspace who want to stay in one ecosystem.\n\n## Our Recommendation\n\nFor the majority of events — corporate gatherings, weddings, nonprofit galas, community events — **PlanIt's zero-cost model and zero-friction guest experience is the clear winner**.\n\nThe determining factor: **PlanIt doesn't require guests to do anything except enter their name**. No app download, no account creation, no email verification loop.\n\n---\n\nThe best tool is the one your whole team will actually use consistently.`,
  },
  {
    id:'p7', slug:'nonprofit-fundraiser-event-planning', featured:false, heroColor:'#f59e0b',
    title:"How to Run a Nonprofit Fundraiser That Actually Raises Funds",
    excerpt:"Gala season is brutal for nonprofit staff stretched thin. Here's the playbook for executing a high-impact fundraiser without burning out your team.",
    category:'Event Planning', tags:['nonprofit','fundraiser','gala'],
    author:'PlanIt Team', date:'2026-01-30', readTime:8,
    content:`## The Nonprofit Event Paradox\n\nFundraising events cost money to run. The margin between cost and revenue is determined almost entirely by planning quality.\n\n## Start With the Revenue Model\n\nBefore any logistics, map your revenue streams:\n- **Ticket sales** — fixed revenue, low risk, lower ceiling\n- **Table sponsorships** — high revenue, requires relationship sales\n- **Live auction** — variable, requires donated items\n- **Fund-a-Need (paddle raise)** — often the highest per-attendee revenue\n- **Matching gift campaigns** — can double revenue from a specific ask\n\nMost successful galas use at least three of these in combination.\n\n## Build Your Donor Experience, Not Your Event\n\nEvery element of the evening should reinforce the same emotional throughline: *why this cause matters and what the donor's gift will do*.\n\n- **Impact stories**, not statistics — one specific person's story moves more money than any pie chart\n- **Moments of pause** — don't fill every second with entertainment\n- **Visible gratitude** — sponsors and major donors should feel seen\n\n## The Logistics That Kill Galas\n\n**Check-in chaos** is the most common gala failure point. PlanIt's QR check-in handles 300 guests arriving in a 45-minute window without breaking a sweat.\n\n**Seating assignment errors** are the second killer. Build your seating chart in a live collaborative tool that your entire planning team can edit until 48 hours before.\n\n## The Ask: Timing and Framing\n\nBest practice: Fund-a-Need immediately after the main program presentation, before dinner is cleared. Energy is high, the emotional story is fresh.\n\n**A matching donor announcement before the ask can triple the response.**\n\n---\n\nThe difference between a $200K and a $400K gala is rarely the budget or the venue. It's the intentionality of the donor experience.`,
  },
  {
    id:'p8', slug:'team-event-planning-collaboration', featured:false, heroColor:'#8b5cf6',
    title:"How to Coordinate a Team Event When Everyone is Remote",
    excerpt:"Planning a team off-site across time zones and calendars is its own form of chaos. Here's the communication and coordination system that actually works.",
    category:'Team Collaboration', tags:['remote','team','collaboration'],
    author:'PlanIt Team', date:'2026-01-22', readTime:6,
    content:`## Remote Team Events: A Different Beast\n\nIn-person teams can coordinate an off-site over lunch. Remote teams are coordinating across three time zones, seven Slack workspaces, and a dozen personal calendar conflicts.\n\n## The Core Problem: Distributed Decision-Making\n\nRemote teams make decisions slowly because decisions require conversation, conversation requires scheduling, and scheduling is hard across continents.\n\nThe fix is an **async-first planning environment** — somewhere the team can see current plans, weigh in on decisions, and track what's been confirmed, without requiring a single Zoom call.\n\n## Setting Up Your PlanIt Event Space\n\nCreate your event space the moment you begin planning and share the link in your team Slack. From day one, it's the source of truth:\n\n- **Polls** for deciding dates, destination city, activity preferences\n- **Tasks** for action items with owners and deadlines\n- **Chat** for async discussion — decisions documented, not buried in DMs\n- **Files** for venue proposals, activity options, travel info, the final agenda\n\n## The Day-Of Coordination\n\nDuring the event itself, the PlanIt chat becomes your team's coordination channel. If the afternoon hike gets rained out and you need to find an alternative in 30 minutes — your entire planning team is right there.\n\n## Post-Event: Don't Let the Momentum Die\n\nThe week after a successful team off-site is the highest-energy moment of the quarter. Within 48 hours:\n- Share a photo album link in the event chat\n- Post the documented decisions from any strategy sessions\n- Send one follow-up message with the three things everyone agreed to do differently\n\n---\n\nRemote teams that get their off-sites right develop a level of cohesion that's hard to replicate any other way.`,
  },
  {
    id:'p9', slug:'event-budget-tracking-guide', featured:false, heroColor:'#10b981',
    title:"Event Budget Tracking: Why Most Planners Go Over and How to Stay Under",
    excerpt:"Budget overruns kill events and careers. Here's the expense tracking discipline that keeps professional event planners under budget, every time.",
    category:'Event Planning', tags:['budget','finance','tips'],
    author:'PlanIt Team', date:'2026-01-15', readTime:7,
    content:`## The Budget Myth\n\nMost event planners start with a budget. Very few end with it. The gap isn't usually one catastrophic overspend — it's a dozen "just this once" exceptions that compound.\n\n## The Three Budget Killers\n\n**1. The Anchor Problem**\nEarly vendor quotes become psychological anchors. When the actual invoice comes in 15% higher (service charges, gratuity, items not in the initial quote), planners approve it because "it's still close to the quote."\n\n**Fix:** Budget every vendor at 115% of their initial quote. Use the difference as your buffer.\n\n**2. The Hidden Categories**\nEvery event has categories that never appear in the initial budget: vendor meals, parking, printing costs, last-minute supplies, tips for venue staff. These typically total 8-12% of the budget.\n\n**Fix:** Create a dedicated "miscellaneous" line item at 10% of your total budget on day one.\n\n**3. The Scope Creep Accumulation**\n"Can we add a photo booth?" "Can we upgrade the centerpieces?" Each ask seems reasonable. Together, they're a budget catastrophe.\n\n**Fix:** Every scope addition must explicitly displace another budget item or receive formal approval.\n\n## Building a Living Budget\n\nStatic spreadsheets fail because they're not updated in real time. PlanIt's Expenses module tracks quotes vs. actuals side by side, shows your total committed spend at any moment, and flags categories approaching their limit.\n\n## The Vendor Confirmation Loop\n\n1. **Initial quote** — document immediately\n2. **Signed contract** — verify price matches quote\n3. **Invoice review** — check every line item before paying\n4. **Final reconciliation** — log actual amount paid\n\n---\n\nBudget discipline isn't about saying no to everything — it's about making every spend decision consciously.`,
  },
  {
    id:'p10', slug:'white-label-event-platform-guide', featured:false, heroColor:'#64748b',
    title:"White-Label Event Platforms: What They Are and When You Need One",
    excerpt:"Running events as a service? A white-label platform lets you offer professional event management software under your own brand. Here's how it works.",
    category:'Resources', tags:['white-label','business','platform'],
    author:'PlanIt Team', date:'2026-01-08', readTime:8,
    content:`## What Is a White-Label Event Platform?\n\nA white-label event platform is software you license and deploy under your own brand. Your clients see your company name, logo, and domain — not the underlying software provider.\n\nFor event management companies, hospitality groups, and venue operators, this means offering clients a professional branded experience without building the software yourself.\n\n## Who Needs White-Label?\n\n**Event management companies** can give clients *your* tool instead of pointing them to a third party — reinforcing your brand at every touchpoint.\n\n**Venue operators** with multiple locations can give each location its own branded booking experience while managing all locations from a single admin dashboard.\n\n**Wedding and event planners** can offer couples a branded planning portal that differentiates the service and increases perceived value.\n\n## What PlanIt White-Label Includes\n\nPlanIt's white-label tier gives partners:\n- Custom domain (yourbrand.com)\n- Custom logo and brand colors throughout the interface\n- Custom homepage content and hero section\n- Scoped event discovery (only your clients' events)\n- Feature flag control (enable/disable features per client)\n- A self-service client portal for branding updates\n\n## Questions to Ask Any White-Label Provider\n\n1. **What happens if I cancel?** — Do clients' events and data remain accessible?\n2. **Is the domain fully yours?** — SSL certificate, custom subdomain vs. full domain?\n3. **What's the setup timeline?** — Days vs. weeks matters\n4. **Can you control active features?** — You may not want all features for all clients\n5. **What support is included?** — Who handles technical issues?\n\n---\n\nThe right platform feels invisible to your clients — they think it's *yours*, which is exactly the point.`,
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

function loadPosts(){
  try{
    const raw=localStorage.getItem('planit_blog_custom');
    if(raw) return [...SEED_POSTS,...JSON.parse(raw)];
  }catch{}
  return [...SEED_POSTS];
}
function saveCustomPosts(all){
  const custom=all.filter(p=>!SEED_POSTS.find(s=>s.id===p.id));
  localStorage.setItem('planit_blog_custom',JSON.stringify(custom));
}
function loadEdits(){
  try{return JSON.parse(localStorage.getItem('planit_blog_edits')||'{}');}catch{return {};}
}
function saveEdits(edits){localStorage.setItem('planit_blog_edits',JSON.stringify(edits));}
function loadDeleted(){
  try{return JSON.parse(localStorage.getItem('planit_blog_deleted')||'[]');}catch{return [];}
}
function saveDeleted(ids){localStorage.setItem('planit_blog_deleted',JSON.stringify(ids));}

function mergedPosts(){
  const edits=loadEdits(), deleted=loadDeleted(), custom=[];
  try{const r=localStorage.getItem('planit_blog_custom');if(r)custom.push(...JSON.parse(r));}catch{}
  return [...SEED_POSTS,...custom]
    .filter(p=>!deleted.includes(p.id))
    .map(p=>edits[p.id]?{...p,...edits[p.id]}:p);
}

const BLOG_CSS=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
.bsyne{font-family:'Syne',sans-serif;}.bdm{font-family:'DM Sans',sans-serif;}.blora{font-family:'Lora',serif;}
@keyframes bfadeup{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}
@keyframes bshimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
@keyframes bspin{to{transform:rotate(360deg);}}
.bfadeup{animation:bfadeup 0.55s cubic-bezier(.22,1,.36,1) both;}
.bcard{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:transform .3s cubic-bezier(.22,1,.36,1),border-color .3s,box-shadow .3s;}
.bcard:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.11);box-shadow:0 24px 48px rgba(0,0,0,.5);}
.bcard-feat:hover{border-color:rgba(99,102,241,.3);box-shadow:0 30px 60px rgba(0,0,0,.5),0 0 40px rgba(99,102,241,.06);}
.bcms-input{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:.6rem 1rem;color:#e2e8f0;font-size:.875rem;width:100%;outline:none;font-family:'DM Sans',sans-serif;transition:border-color .2s;}
.bcms-input:focus{border-color:rgba(99,102,241,.5);}
.bcms-textarea{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:.75rem 1rem;color:#e2e8f0;font-size:.875rem;width:100%;outline:none;resize:vertical;line-height:1.7;transition:border-color .2s;}
.bcms-textarea:focus{border-color:rgba(99,102,241,.5);}
.bcms-select{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:.6rem 1rem;color:#e2e8f0;font-size:.875rem;width:100%;outline:none;cursor:pointer;}
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

function InjectCSS(){
  useEffect(()=>{
    const id='planit-blog-v2';
    if(!document.getElementById(id)){const s=document.createElement('style');s.id=id;s.textContent=BLOG_CSS;document.head.appendChild(s);}
    return()=>{const el=document.getElementById(id);if(el)el.remove();};
  },[]);
  return null;
}

function ReadingBar(){
  const [p,setP]=useState(0);
  useEffect(()=>{
    const fn=()=>{const t=document.documentElement.scrollHeight-window.innerHeight;setP(t>0?(window.scrollY/t)*100:0);};
    window.addEventListener('scroll',fn,{passive:true});return()=>window.removeEventListener('scroll',fn);
  },[]);
  return <div className="rprogress"><div className="rpbar" style={{width:`${p}%`}}/></div>;
}

function CatBadge({cat,sm}){
  const c=CAT_COLORS[cat]||{bg:'rgba(100,116,139,0.12)',text:'#94a3b8',border:'rgba(100,116,139,0.25)'};
  return <span style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`,padding:sm?'2px 8px':'4px 12px',borderRadius:999,fontSize:sm?10:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',display:'inline-block',whiteSpace:'nowrap'}}>{cat}</span>;
}

function Prose({content}){
  const lines=content.trim().split('\n');
  const els=[]; let list=[],inCode=false,codeLines=[],k=0;
  const flush=()=>{if(list.length){els.push(<ul key={'ul'+k++}>{list.map((it,i)=><li key={i} dangerouslySetInnerHTML={{__html:il(it)}}/>)}</ul>);list=[];}};
  const il=t=>t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>');
  for(const line of lines){
    if(line.startsWith('```')){if(!inCode){inCode=true;codeLines=[];}else{flush();els.push(<pre key={'pre'+k++} style={{background:'rgba(0,0,0,.4)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:'1.2rem 1.4rem',overflowX:'auto',margin:'1.5rem 0'}}><code style={{color:'#94a3b8',fontSize:'0.88rem',whiteSpace:'pre'}}>{codeLines.join('\n')}</code></pre>);inCode=false;}continue;}
    if(inCode){codeLines.push(line);continue;}
    if(line.startsWith('## ')){flush();els.push(<h2 key={'h2'+k++}>{line.slice(3)}</h2>);}
    else if(line.startsWith('### ')){flush();els.push(<h3 key={'h3'+k++}>{line.slice(4)}</h3>);}
    else if(line.startsWith('- ')||line.startsWith('* ')){list.push(line.slice(2));}
    else if(/^\d+\. /.test(line)){list.push(line.replace(/^\d+\. /,''));}
    else if(line.trim()==='---'){flush();els.push(<hr key={'hr'+k++}/>);}
    else if(line.trim()===''){flush();}
    else if(line.trim()){flush();els.push(<p key={'p'+k++} dangerouslySetInnerHTML={{__html:il(line)}}/>);}
  }
  flush();
  return <div className="bprose">{els}</div>;
}

// ─── ADMIN CMS ────────────────────────────────────────────────────────────────
const EMPTY={id:'',slug:'',title:'',excerpt:'',category:'Event Planning',tags:'',author:'PlanIt Team',date:new Date().toISOString().slice(0,10),readTime:5,featured:false,heroColor:'#6366f1',content:''};

function AdminCMS({allPosts,onClose,onRefresh}){
  const [view,setView]=useState('list');
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [delConfirm,setDelConfirm]=useState(null);
  const [saved,setSaved]=useState(false);
  const upd=k=>e=>setForm(f=>({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
  const openEdit=p=>{setEditId(p.id);setForm({...p,tags:Array.isArray(p.tags)?p.tags.join(', '):p.tags||''});setView('edit');};
  const openNew=()=>{setEditId(null);setForm({...EMPTY,id:'p-'+Date.now()});setView('new');};
  const handleSave=()=>{
    const post={...form,tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean),slug:form.slug||form.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),readTime:+form.readTime||5};
    if(editId){
      const edits=loadEdits();edits[editId]=post;saveEdits(edits);
    } else {
      const custom=[];try{const r=localStorage.getItem('planit_blog_custom');if(r)custom.push(...JSON.parse(r));}catch{}
      custom.push(post);localStorage.setItem('planit_blog_custom',JSON.stringify(custom));
    }
    setSaved(true);setTimeout(()=>{setSaved(false);setView('list');onRefresh();},1000);
  };
  const handleDelete=id=>{
    const del=loadDeleted();del.push(id);saveDeleted(del);
    const edits=loadEdits();delete edits[id];saveEdits(edits);
    setDelConfirm(null);onRefresh();
  };

  return(
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.94)',backdropFilter:'blur(20px)',display:'flex',flexDirection:'column',overflowY:'auto'}}>
      {/* CMS Header */}
      <div style={{position:'sticky',top:0,zIndex:10,background:'rgba(5,5,12,0.98)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between',backdropFilter:'blur(20px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {view!=='list'&&<button onClick={()=>setView('list')} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><ArrowLeft style={{width:13,height:13}}/></button>}
          <div style={{width:30,height:30,borderRadius:8,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.28)',display:'flex',alignItems:'center',justifyContent:'center'}}><Edit3 style={{width:13,height:13,color:'#818cf8'}}/></div>
          <span className="bsyne" style={{fontSize:14,fontWeight:800,color:'#fff',letterSpacing:'-.02em'}}>Blog CMS{view!=='list'?' — '+(view==='new'?'New Post':'Edit Post'):''}</span>
          <span style={{fontSize:11,color:'#4b5563',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase'}}>{allPosts.length} posts</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {view!=='list'&&<button onClick={handleSave} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:8,background:saved?'rgba(34,197,94,0.15)':'rgba(99,102,241,0.12)',border:`1px solid ${saved?'rgba(34,197,94,.4)':'rgba(99,102,241,.35)'}`,color:saved?'#86efac':'#a5b4fc',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all .2s'}}>{saved?<><Check style={{width:13,height:13}}/>Saved!</>:<><Save style={{width:13,height:13}}/>Save Post</>}</button>}
          {view==='list'&&<button onClick={openNew} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:8,background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.28)',color:'#a5b4fc',fontSize:13,fontWeight:700,cursor:'pointer'}}><Plus style={{width:13,height:13}}/>New Post</button>}
          <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X style={{width:13,height:13}}/></button>
        </div>
      </div>

      <div style={{flex:1,padding:'24px',maxWidth:980,margin:'0 auto',width:'100%'}}>
        {/* LIST */}
        {view==='list'&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <p style={{color:'#4b5563',fontSize:13,marginBottom:12,fontFamily:'DM Sans,sans-serif'}}>Create, edit, or delete blog posts. Changes are saved to your browser and persist across sessions.</p>
            {allPosts.map(post=>(
              <div key={post.id} style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,borderRadius:8,background:post.heroColor+'20',border:`1px solid ${post.heroColor}40`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><BookOpen style={{width:14,height:14,color:post.heroColor}}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                    <span style={{color:'#e2e8f0',fontSize:13,fontWeight:700,fontFamily:'DM Sans,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:360}}>{post.title}</span>
                    {post.featured&&<span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.22)',color:'#fbbf24',textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>Featured</span>}
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}><CatBadge cat={post.category} sm/><span style={{color:'#4b5563',fontSize:12}}>{post.date}</span><span style={{color:'#4b5563',fontSize:12}}>{post.readTime}m read</span></div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>openEdit(post)} style={{padding:'5px 12px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#9ca3af',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}><Edit3 style={{width:11,height:11}}/>Edit</button>
                  {delConfirm===post.id
                    ?<div style={{display:'flex',gap:4}}>
                        <button onClick={()=>handleDelete(post.id)} style={{padding:'5px 10px',borderRadius:8,background:'rgba(239,68,68,0.13)',border:'1px solid rgba(239,68,68,0.28)',color:'#fca5a5',fontSize:12,fontWeight:700,cursor:'pointer'}}>Delete</button>
                        <button onClick={()=>setDelConfirm(null)} style={{padding:'5px 10px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280',fontSize:12,cursor:'pointer'}}>Cancel</button>
                      </div>
                    :<button onClick={()=>setDelConfirm(post.id)} style={{width:30,height:30,borderRadius:8,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.14)',color:'#f87171',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 style={{width:12,height:12}}/></button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EDIT / NEW */}
        {(view==='edit'||view==='new')&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:22,alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:5}}>Post Title *</label><input className="bcms-input" value={form.title} onChange={upd('title')} placeholder="An attention-grabbing headline..." style={{fontSize:14,fontWeight:600,fontFamily:'Syne,sans-serif'}}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:5}}>URL Slug</label><input className="bcms-input" value={form.slug} onChange={upd('slug')} placeholder="auto-generated-from-title" style={{fontFamily:'monospace',fontSize:13,color:'#818cf8'}}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:5}}>Excerpt</label><textarea className="bcms-textarea" rows={3} value={form.excerpt} onChange={upd('excerpt')} placeholder="A compelling summary that makes readers want to click..."/></div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:5}}>Content <span style={{fontWeight:400,fontSize:10,color:'#374151',textTransform:'none',letterSpacing:0}}>— ## h2 · **bold** · *italic* · `code` · - list · --- divider</span></label>
                <textarea className="bcms-textarea" rows={26} value={form.content} onChange={upd('content')} placeholder="## First Section&#10;&#10;Write your content here...&#10;&#10;## Another Section&#10;&#10;More content..." style={{fontFamily:'monospace',fontSize:12.5,lineHeight:1.65}}/>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,position:'sticky',top:74}}>
              <div style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:16}}>
                <h3 className="bsyne" style={{fontSize:13,fontWeight:800,color:'#e2e8f0',marginBottom:13}}>Post Settings</h3>
                <div style={{display:'flex',flexDirection:'column',gap:11}}>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Category</label><select className="bcms-select" value={form.category} onChange={upd('category')}>{CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Tags (comma-separated)</label><input className="bcms-input" value={form.tags} onChange={upd('tags')} placeholder="planning, tips, events"/></div>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Author</label><input className="bcms-input" value={form.author} onChange={upd('author')}/></div>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Publish Date</label><input className="bcms-input" type="date" value={form.date} onChange={upd('date')}/></div>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Read Time (min)</label><input className="bcms-input" type="number" min="1" max="60" value={form.readTime} onChange={upd('readTime')}/></div>
                  <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Accent Color</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="color" value={form.heroColor} onChange={upd('heroColor')} style={{width:34,height:34,borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'none',cursor:'pointer',padding:2}}/>
                      <input className="bcms-input" value={form.heroColor} onChange={upd('heroColor')} style={{fontFamily:'monospace',fontSize:12}}/>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',background:'rgba(251,191,36,0.05)',border:'1px solid rgba(251,191,36,0.1)',borderRadius:8,cursor:'pointer'}} onClick={()=>setForm(f=>({...f,featured:!f.featured}))}>
                    <div style={{width:34,height:18,borderRadius:9,background:form.featured?'rgba(251,191,36,0.35)':'rgba(255,255,255,0.06)',border:`1px solid ${form.featured?'rgba(251,191,36,0.55)':'rgba(255,255,255,0.1)'}`,position:'relative',transition:'all .2s',flexShrink:0}}>
                      <div style={{position:'absolute',top:2,left:form.featured?16:2,width:12,height:12,borderRadius:6,background:form.featured?'#fbbf24':'#4b5563',transition:'all .2s'}}/>
                    </div>
                    <span style={{fontSize:12,fontWeight:600,color:form.featured?'#fbbf24':'#6b7280'}}>Featured Post</span>
                  </div>
                </div>
              </div>
              <button onClick={handleSave} style={{width:'100%',padding:'11px',borderRadius:10,background:saved?'rgba(34,197,94,0.13)':'rgba(99,102,241,0.12)',border:`1px solid ${saved?'rgba(34,197,94,.38)':'rgba(99,102,241,.35)'}`,color:saved?'#86efac':'#a5b4fc',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'DM Sans,sans-serif',transition:'all .2s'}}>
                {saved?<><Check style={{width:14,height:14}}/>Saved!</>:<><Save style={{width:14,height:14}}/>Save & Publish</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ARTICLE VIEW ─────────────────────────────────────────────────────────────
function ArticleView({post,allPosts,onBack}){
  const related=allPosts.filter(p=>p.id!==post.id&&p.category===post.category).slice(0,3);
  const [copied,setCopied]=useState(false);
  useEffect(()=>{window.scrollTo({top:0});document.title=`${post.title} — PlanIt Blog`;return()=>{document.title='PlanIt Blog';};},[ post.id]);
  const share=()=>{navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  return(
    <div style={{minHeight:'100vh',background:'#050508',color:'#fff'}} className="bdm">
      <ReadingBar/>
      <header style={{position:'sticky',top:0,zIndex:50,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(5,5,12,0.96)',backdropFilter:'blur(24px)'}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 24px',height:54,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:7,background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:13,fontWeight:600,padding:'5px 10px',borderRadius:8}}><ArrowLeft style={{width:13,height:13}}/>Back to Blog</button>
          <div style={{display:'flex',gap:8}}>
            <a href="/" style={{display:'flex',alignItems:'center',gap:5,padding:'5px 13px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:'#9ca3af',fontSize:12,fontWeight:600,textDecoration:'none'}}>PlanIt Home</a>
            <button onClick={share} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 13px',borderRadius:8,background:copied?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.04)',border:`1px solid ${copied?'rgba(34,197,94,0.28)':'rgba(255,255,255,0.07)'}`,color:copied?'#86efac':'#9ca3af',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .2s'}}>{copied?<><Check style={{width:11,height:11}}/>Copied</>:<><Share2 style={{width:11,height:11}}/>Share</>}</button>
          </div>
        </div>
      </header>
      <div style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:`linear-gradient(135deg,${post.heroColor}08 0%,transparent 60%)`,padding:'58px 24px 44px'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}><CatBadge cat={post.category}/>{post.featured&&<span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,background:'rgba(251,191,36,0.09)',border:'1px solid rgba(251,191,36,0.2)',color:'#fbbf24',textTransform:'uppercase',letterSpacing:'.07em'}}>Featured</span>}</div>
          <h1 className="bsyne bfadeup" style={{fontSize:'clamp(1.7rem,4.5vw,2.9rem)',fontWeight:800,color:'#fff',lineHeight:1.1,letterSpacing:'-.03em',marginBottom:18,animationDelay:'.05s'}}>{post.title}</h1>
          <p className="blora bfadeup" style={{fontSize:'1.05rem',color:'#94a3b8',lineHeight:1.7,marginBottom:24,animationDelay:'.14s'}}>{post.excerpt}</p>
          <div className="bfadeup" style={{display:'flex',alignItems:'center',gap:18,animationDelay:'.22s'}}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:`${post.heroColor}22`,border:`1px solid ${post.heroColor}38`,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:10,fontWeight:800,color:post.heroColor}}>{post.author[0]}</span></div>
              <span style={{fontSize:13,color:'#9ca3af',fontWeight:500}}>{post.author}</span>
            </div>
            <span style={{width:3,height:3,borderRadius:'50%',background:'#374151',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'#6b7280',display:'flex',alignItems:'center',gap:4}}><Calendar style={{width:11,height:11}}/>{new Date(post.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
            <span style={{width:3,height:3,borderRadius:'50%',background:'#374151',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'#6b7280',display:'flex',alignItems:'center',gap:4}}><Clock style={{width:11,height:11}}/>{post.readTime} min read</span>
          </div>
        </div>
      </div>
      <div style={{maxWidth:760,margin:'0 auto',padding:'52px 24px 80px'}}><Prose content={post.content}/>
        {post.tags?.length>0&&<div style={{marginTop:44,paddingTop:28,borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',flexWrap:'wrap',gap:7,alignItems:'center'}}><Tag style={{width:12,height:12,color:'#4b5563'}}/>{(Array.isArray(post.tags)?post.tags:String(post.tags).split(',').map(t=>t.trim())).map(tag=><span key={tag} style={{fontSize:12,color:'#6b7280',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',padding:'3px 9px',borderRadius:6,fontWeight:500}}>#{tag}</span>)}</div>}
        <div style={{marginTop:52,padding:'32px 36px',borderRadius:18,background:'rgba(99,102,241,0.05)',border:'1px solid rgba(99,102,241,0.14)',textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:8}}>📅</div>
          <h3 className="bsyne" style={{fontSize:18,fontWeight:800,color:'#fff',marginBottom:7}}>Ready to plan your event?</h3>
          <p style={{color:'#6b7280',fontSize:13,lineHeight:1.65,marginBottom:18,maxWidth:400,margin:'0 auto 18px',fontFamily:'Lora,serif'}}>PlanIt gives you team chat, RSVP, QR check-in, seating charts, and budget tracking — free forever, no account needed.</p>
          <a href="/" style={{display:'inline-flex',alignItems:'center',gap:7,padding:'11px 22px',borderRadius:11,background:'#fff',color:'#111',fontSize:13,fontWeight:700,textDecoration:'none'}}>Get Started Free <ArrowRight style={{width:13,height:13}}/></a>
        </div>
      </div>
      {related.length>0&&<div style={{borderTop:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.01)',padding:'48px 24px'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <h2 className="bsyne" style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:20,letterSpacing:'-.02em'}}>More from {post.category}</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            {related.map(p=><button key={p.id} onClick={()=>onBack(p)} style={{textAlign:'left',background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .25s',width:'100%'}}>
              <CatBadge cat={p.category} sm/>
              <p className="bsyne" style={{color:'#e2e8f0',fontSize:14,fontWeight:700,marginTop:9,marginBottom:6,lineHeight:1.3}}>{p.title}</p>
              <span style={{fontSize:11,color:'#6b7280'}}>{p.readTime} min read</span>
            </button>)}
          </div>
        </div>
      </div>}
    </div>
  );
}

// ─── BLOG INDEX ───────────────────────────────────────────────────────────────
function BlogIndex({posts,onRead,onAdmin}){
  const [cat,setCat]=useState('All');
  const [q,setQ]=useState('');
  const [page,setPage]=useState(1);
  const PER=6;
  const featured=posts.filter(p=>p.featured);
  const filtered=posts.filter(p=>{
    const mc=cat==='All'||p.category===cat;
    const ql=q.toLowerCase();
    const ms=!ql||p.title.toLowerCase().includes(ql)||p.excerpt.toLowerCase().includes(ql)||(Array.isArray(p.tags)?p.tags:[]).some(t=>t.toLowerCase().includes(ql));
    return mc&&ms;
  });
  const rest=filtered.filter(p=>!p.featured||cat!=='All'||q);
  const pages=Math.ceil(rest.length/PER);
  const paged=rest.slice((page-1)*PER,page*PER);
  useEffect(()=>{setPage(1);},[cat,q]);

  return(
    <div style={{minHeight:'100vh',background:'#050508',color:'#fff'}} className="bdm">
      <ReadingBar/>
      <header style={{position:'sticky',top:0,zIndex:50,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(5,5,12,0.96)',backdropFilter:'blur(24px)'}}>
        <div style={{maxWidth:1120,margin:'0 auto',padding:'0 24px',height:54,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
              <div style={{width:26,height:26,borderRadius:7,background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.23)',display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar style={{width:12,height:12,color:'#818cf8'}}/></div>
              <span className="bsyne" style={{fontSize:14,fontWeight:800,color:'#fff',letterSpacing:'-.02em'}}>PlanIt</span>
            </a>
            <span style={{color:'#1f2937',fontSize:15}}>/</span>
            <span className="bsyne" style={{fontSize:13,fontWeight:700,color:'#6b7280'}}>Blog</span>
          </div>
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            <a href="/discover" style={{padding:'5px 11px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#9ca3af',fontSize:12,fontWeight:600,textDecoration:'none'}}>Discover</a>
            <a href="/help" style={{padding:'5px 11px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#9ca3af',fontSize:12,fontWeight:600,textDecoration:'none'}}>Help</a>
            <a href="/" style={{padding:'5px 14px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#e2e8f0',fontSize:12,fontWeight:700,textDecoration:'none'}}>Get Started →</a>
            <button onClick={onAdmin} title="Admin" style={{width:28,height:28,borderRadius:7,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#2d3748',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Lock style={{width:11,height:11}}/></button>
          </div>
        </div>
      </header>

      <div style={{padding:'68px 24px 52px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'radial-gradient(ellipse 80% 60% at 50% 0%,rgba(99,102,241,0.06) 0%,transparent 60%)'}}>
        <div style={{maxWidth:660,margin:'0 auto',textAlign:'center'}}>
          <div className="bfadeup" style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 13px',borderRadius:999,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.18)',marginBottom:22}}>
            <BookOpen style={{width:11,height:11,color:'#818cf8'}}/><span style={{fontSize:10,fontWeight:700,color:'#818cf8',textTransform:'uppercase',letterSpacing:'.1em'}}>PlanIt Blog & Guides</span>
          </div>
          <h1 className="bsyne bfadeup" style={{fontSize:'clamp(1.9rem,5.5vw,3.2rem)',fontWeight:800,color:'#fff',lineHeight:1.06,letterSpacing:'-.04em',marginBottom:16,animationDelay:'.08s'}}>
            Plan smarter.<br/>
            <span style={{background:'linear-gradient(90deg,#818cf8 0%,#c4b5fd 50%,#818cf8 100%)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',animation:'bshimmer 4s linear infinite'}}>Execute flawlessly.</span>
          </h1>
          <p className="bfadeup blora" style={{fontSize:'1rem',color:'#6b7280',lineHeight:1.7,marginBottom:28,animationDelay:'.17s'}}>Guides, how-tos, and strategies for event planners, restaurant operators, and hospitality professionals.</p>
          <div className="bfadeup" style={{position:'relative',maxWidth:420,margin:'0 auto',animationDelay:'.25s'}}>
            <Search style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',width:14,height:14,color:'#4b5563',pointerEvents:'none'}}/>
            <input className="bsearch" placeholder="Search articles..." value={q} onChange={e=>setQ(e.target.value)}/>
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#6b7280',cursor:'pointer'}}><X style={{width:13,height:13}}/></button>}
          </div>
        </div>
      </div>

      <div style={{borderBottom:'1px solid rgba(255,255,255,0.04)',padding:'0 24px'}}>
        <div style={{maxWidth:1120,margin:'0 auto',height:48,display:'flex',alignItems:'center',gap:24}}>
          {[{n:posts.length+'+',l:'Articles'},{n:'6',l:'Categories'},{n:'Weekly',l:'Updates'},{n:'Free',l:'Forever'}].map(s=>(
            <div key={s.l} style={{display:'flex',alignItems:'center',gap:6}}><span className="bsyne" style={{fontSize:13,fontWeight:800,color:'#6366f1'}}>{s.n}</span><span style={{fontSize:11,color:'#374151',fontWeight:600}}>{s.l}</span></div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1120,margin:'0 auto',padding:'44px 24px 80px'}}>
        {!q&&cat==='All'&&featured.length>0&&(
          <div style={{marginBottom:56}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:22}}><Star style={{width:13,height:13,color:'#fbbf24'}}/><span className="bsyne" style={{fontSize:11,fontWeight:800,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.12em'}}>Featured</span></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
              {featured.map((post,i)=>(
                <button key={post.id} className="bcard bcard-feat" onClick={()=>onRead(post)} style={{textAlign:'left',borderRadius:18,padding:'26px 26px 22px',cursor:'pointer',display:'flex',flexDirection:'column',minHeight:250,position:'relative',overflow:'hidden',animationDelay:`${i*.06}s`}}>
                  <div style={{position:'absolute',top:-35,right:-35,width:130,height:130,borderRadius:'50%',background:`radial-gradient(circle,${post.heroColor}15 0%,transparent 70%)`,pointerEvents:'none'}}/>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${post.heroColor}55,transparent)`}}/>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}><CatBadge cat={post.category} sm/><span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(251,191,36,0.09)',border:'1px solid rgba(251,191,36,0.2)',color:'#fbbf24',textTransform:'uppercase',letterSpacing:'.06em'}}>Featured</span></div>
                  <h2 className="bsyne" style={{fontSize:17,fontWeight:800,color:'#fff',lineHeight:1.25,marginBottom:9,letterSpacing:'-.02em',flex:1}}>{post.title}</h2>
                  <p style={{fontSize:12.5,color:'#6b7280',lineHeight:1.6,marginBottom:16,fontFamily:'Lora,serif',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{post.excerpt}</p>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',gap:10}}><span style={{fontSize:11,color:'#4b5563',display:'flex',alignItems:'center',gap:3}}><Calendar style={{width:10,height:10}}/>{new Date(post.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><span style={{fontSize:11,color:'#4b5563',display:'flex',alignItems:'center',gap:3}}><Clock style={{width:10,height:10}}/>{post.readTime}m</span></div>
                    <span style={{fontSize:11,color:post.heroColor,fontWeight:700,display:'flex',alignItems:'center',gap:3}}>Read <ArrowRight style={{width:10,height:10}}/></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:32}}>
          {CATEGORIES.map(c=>(
            <button key={c} onClick={()=>setCat(c)} style={{padding:'6px 14px',borderRadius:999,fontSize:11.5,fontWeight:700,border:`1px solid ${cat===c?'rgba(99,102,241,.38)':'rgba(255,255,255,0.07)'}`,background:cat===c?'rgba(99,102,241,0.12)':'rgba(255,255,255,0.03)',color:cat===c?'#a5b4fc':'#6b7280',cursor:'pointer',transition:'all .2s'}}>{c}</button>
          ))}
          <span style={{marginLeft:'auto',fontSize:11,color:'#374151',display:'flex',alignItems:'center'}}>{filtered.length} article{filtered.length!==1?'s':''}</span>
        </div>

        {paged.length>0?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:14,marginBottom:44}}>
            {paged.map((post,i)=>(
              <button key={post.id} className="bcard" onClick={()=>onRead(post)} style={{textAlign:'left',borderRadius:16,padding:'20px 20px 16px',cursor:'pointer',display:'flex',flexDirection:'column',animationDelay:`${i*.04}s`}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
                  <div style={{width:26,height:26,borderRadius:6,background:post.heroColor+'18',border:`1px solid ${post.heroColor}28`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><div style={{width:7,height:7,borderRadius:'50%',background:post.heroColor}}/></div>
                  <CatBadge cat={post.category} sm/>
                </div>
                <h3 className="bsyne" style={{fontSize:15,fontWeight:800,color:'#e2e8f0',lineHeight:1.25,marginBottom:9,letterSpacing:'-.02em',flex:1}}>{post.title}</h3>
                <p style={{fontSize:12.5,color:'#6b7280',lineHeight:1.6,marginBottom:14,fontFamily:'Lora,serif',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{post.excerpt}</p>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'}}>
                  <div style={{display:'flex',gap:9}}><span style={{fontSize:11,color:'#374151',display:'flex',alignItems:'center',gap:3}}><Calendar style={{width:10,height:10}}/>{new Date(post.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><span style={{fontSize:11,color:'#374151',display:'flex',alignItems:'center',gap:3}}><Clock style={{width:10,height:10}}/>{post.readTime}m</span></div>
                  <span style={{fontSize:11,color:'#4b5563',fontWeight:600}}>Read →</span>
                </div>
              </button>
            ))}
          </div>
        ):(
          <div style={{textAlign:'center',padding:'70px 0'}}>
            <div style={{fontSize:36,marginBottom:14}}>🔍</div>
            <h3 className="bsyne" style={{fontSize:17,fontWeight:800,color:'#374151',marginBottom:7}}>No articles found</h3>
            <p style={{color:'#4b5563',fontSize:13}}>Try a different search or category</p>
            <button onClick={()=>{setQ('');setCat('All');}} style={{marginTop:14,padding:'7px 18px',borderRadius:9,background:'rgba(99,102,241,0.09)',border:'1px solid rgba(99,102,241,0.22)',color:'#818cf8',fontSize:12,fontWeight:600,cursor:'pointer'}}>Clear filters</button>
          </div>
        )}

        {pages>1&&<div style={{display:'flex',justifyContent:'center',gap:7,marginBottom:56}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'7px 15px',borderRadius:9,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:page===1?'#374151':'#9ca3af',cursor:page===1?'default':'pointer',fontSize:12,fontWeight:600}}>← Prev</button>
          {Array.from({length:pages},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setPage(n)} style={{width:34,height:34,borderRadius:9,background:page===n?'rgba(99,102,241,0.13)':'rgba(255,255,255,0.03)',border:`1px solid ${page===n?'rgba(99,102,241,.38)':'rgba(255,255,255,0.06)'}`,color:page===n?'#a5b4fc':'#6b7280',cursor:'pointer',fontSize:12,fontWeight:700}}>{n}</button>)}
          <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages} style={{padding:'7px 15px',borderRadius:9,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:page===pages?'#374151':'#9ca3af',cursor:page===pages?'default':'pointer',fontSize:12,fontWeight:600}}>Next →</button>
        </div>}

        <div style={{padding:'44px 36px',borderRadius:18,background:'linear-gradient(135deg,rgba(99,102,241,0.07) 0%,rgba(139,92,246,0.04) 100%)',border:'1px solid rgba(99,102,241,0.13)',textAlign:'center'}}>
          <div style={{fontSize:26,marginBottom:10}}>✦</div>
          <h2 className="bsyne" style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:7,letterSpacing:'-.02em'}}>Start planning with PlanIt</h2>
          <p style={{color:'#6b7280',fontSize:13,lineHeight:1.7,maxWidth:420,margin:'0 auto 24px',fontFamily:'Lora,serif'}}>Everything in this blog is powered by PlanIt — free event management, restaurant floor tools, team chat, QR check-in. No account needed.</p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <a href="/" style={{display:'inline-flex',alignItems:'center',gap:7,padding:'11px 22px',borderRadius:11,background:'#fff',color:'#111',fontSize:13,fontWeight:700,textDecoration:'none'}}><Calendar style={{width:13,height:13}}/>Plan an Event Free</a>
            <a href="/discover" style={{display:'inline-flex',alignItems:'center',gap:7,padding:'11px 22px',borderRadius:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#e2e8f0',fontSize:13,fontWeight:700,textDecoration:'none'}}>Discover Events →</a>
          </div>
        </div>
      </div>

      <footer style={{borderTop:'1px solid rgba(255,255,255,0.05)',padding:'28px 24px',background:'rgba(0,0,0,0.3)'}}>
        <div style={{maxWidth:1120,margin:'0 auto',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><span className="bsyne" style={{fontSize:13,fontWeight:800,color:'#374151'}}>PlanIt</span><span style={{color:'#1f2937',fontSize:12}}>Blog & Guides</span></div>
          <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
            {[['Home','/'],['Discover','/discover'],['Help','/help'],['Status','/status'],['About','/about'],['Blog','/blog'],['Terms','/terms'],['Privacy','/privacy']].map(([l,h])=>(
              <a key={l} href={h} style={{fontSize:12,color:'#374151',textDecoration:'none'}}>{l}</a>
            ))}
          </div>
          <span style={{fontSize:11,color:'#1f2937'}}>© 2026 PlanIt · By Aakshat Hariharan</span>
        </div>
      </footer>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Blog(){
  const {slug}=useParams();
  const navigate=useNavigate();
  const [posts,setPosts]=useState(()=>mergedPosts());
  const [active,setActive]=useState(null);
  const [adminOpen,setAdminOpen]=useState(false);
  const [authed,setAuthed]=useState(false);
  const [pass,setPass]=useState('');
  const [passErr,setPassErr]=useState(false);
  const refresh=()=>setPosts(mergedPosts());

  useEffect(()=>{
    if(slug){const found=posts.find(p=>p.slug===slug);if(found)setActive(found);}
    else setActive(null);
  },[slug]);

  const read=p=>{setActive(p);navigate('/blog/'+p.slug);window.scrollTo({top:0});};
  const back=nextPost=>{
    if(nextPost&&nextPost.slug){read(nextPost);return;}
    setActive(null);navigate('/blog');window.scrollTo({top:0});
  };

  const tryAuth=()=>{
    if(pass==='planit-admin'||pass==='admin'){setAuthed(true);setPassErr(false);}
    else{setPassErr(true);setTimeout(()=>setPassErr(false),2000);}
  };

  return(
    <>
      <InjectCSS/>
      {adminOpen&&!authed&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'rgba(8,8,20,0.98)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:18,padding:'32px 36px',width:340,textAlign:'center'}}>
            <div style={{width:44,height:44,borderRadius:13,background:'rgba(99,102,241,0.09)',border:'1px solid rgba(99,102,241,0.22)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}><Lock style={{width:18,height:18,color:'#818cf8'}}/></div>
            <h2 className="bsyne" style={{fontSize:17,fontWeight:800,color:'#fff',marginBottom:5}}>Blog Admin</h2>
            <p style={{fontSize:12.5,color:'#6b7280',marginBottom:22,lineHeight:1.6}}>Enter the admin password to manage blog posts.</p>
            <input type="password" className="bcms-input" placeholder="Admin password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryAuth()} style={{marginBottom:10,textAlign:'center',letterSpacing:'.08em',borderColor:passErr?'rgba(239,68,68,0.5)':undefined}} autoFocus/>
            {passErr&&<p style={{fontSize:12,color:'#f87171',marginBottom:9}}>Incorrect password</p>}
            <div style={{display:'flex',gap:7}}>
              <button onClick={()=>{setAdminOpen(false);setPass('');}} style={{flex:1,padding:'9px',borderRadius:9,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#6b7280',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>Cancel</button>
              <button onClick={tryAuth} style={{flex:1,padding:'9px',borderRadius:9,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.32)',color:'#a5b4fc',fontSize:12.5,fontWeight:700,cursor:'pointer'}}>Enter</button>
            </div>
            <p style={{marginTop:14,fontSize:11,color:'#2d3748'}}>Default: planit-admin</p>
          </div>
        </div>
      )}
      {adminOpen&&authed&&(
        <AdminCMS allPosts={posts} onClose={()=>{setAdminOpen(false);setAuthed(false);setPass('');refresh();}} onRefresh={refresh}/>
      )}
      {active
        ?<ArticleView post={active} allPosts={posts} onBack={back}/>
        :<BlogIndex posts={posts} onRead={read} onAdmin={()=>setAdminOpen(true)}/>
      }
    </>
  );
}
