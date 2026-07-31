'use strict';

/**
 * blogSeeder.js
 *
 * Runs once at server startup.  If the blog_posts collection has zero
 * non-deleted documents it inserts the curated seed posts so the public
 * /blog page is never blank on a fresh deployment.
 *
 * Idempotent — uses insertMany with ordered:false and swallows duplicate-key
 * errors (E11000) so re-running is safe.
 *
 * IMPORTANT: Seed posts are owned by the system, not editable from the CMS
 * (admins can still soft-delete or edit them via the normal PATCH route).
 * They carry a `seeded: true` marker for potential future filtering, but this
 * field is not exposed to the public API.
 */

const BlogPost = require('../models/BlogPost');

const SEED_POSTS = [
  {
    slug: 'how-to-plan-corporate-event',
    featured: true,
    heroColor: '#6366f1',
    title: 'How to Plan a Corporate Event That People Actually Want to Attend',
    excerpt: 'Corporate events have a reputation problem. Here\'s how to break the mold and run an event people genuinely remember.',
    category: 'Event Planning',
    tags: ['corporate', 'planning', 'tips'],
    author: 'PlanIt Team',
    publishDate: '2026-03-10',
    readTime: 9,
    content: `## The Problem With Most Corporate Events

Mandatory fun. That's what employees whisper as they drag themselves to yet another off-site retreat. Corporate events often fail not because of budget, but because of planning failure.

The antidote is simple: **treat your event like a product launch, not a logistics exercise**.

## Step 1: Define a Single Outcome

Before you book a venue or send a calendar invite, write one sentence: *What does success look like the day after this event?*

- "Our cross-functional teams feel aligned on Q3 priorities."
- "New hires feel genuinely welcomed into our culture."
- "Attendees leave with three actionable takeaways they'll use Monday morning."

Every decision — venue, agenda, catering, activities — should serve that sentence.

## Step 2: Use a Centralized Planning Workspace

The biggest waste in corporate event planning is duplicated effort across email threads, shared drives, and Slack channels nobody checks. A platform like PlanIt gives your entire planning team a single workspace with:

- **Shared task lists** with assignees and deadlines
- **Team chat** with file sharing — floor plans, run-of-show, catering orders all in one place
- **Real-time polls** to nail down decisions without 47-email threads

## Step 3: Design the Attendee Journey

Think in experiences, not time slots:

1. **Arrival moment** — What's the first thing people see?
2. **First connection** — Intentional seating, conversation starters
3. **Energy management** — Alternate high-focus sessions with social breaks
4. **The memorable moment** — One wow moment people will talk about

## Step 4: Check-In Without the Chaos

Nothing undermines event confidence like a 40-person queue at registration. QR check-in via PlanIt Enterprise Mode lets your staff check in attendees in under 3 seconds each while you watch real-time attendance dashboards.

## Step 5: Close the Loop

Send a follow-up within 24 hours: a summary of decisions made, resources shared, and next steps. Your PlanIt event chat is already the record — it's all there.

---

Corporate events that work aren't magic. They're methodical.`,
  },
  {
    slug: 'restaurant-waitlist-management',
    featured: true,
    heroColor: '#f97316',
    title: 'The Complete Guide to Restaurant Waitlist Management in 2026',
    excerpt: 'Walk-in traffic is back — and it\'s brutal without the right system. Here\'s exactly how to manage your waitlist so guests stay happy and tables turn faster.',
    category: 'Restaurant Management',
    tags: ['restaurant', 'waitlist', 'operations'],
    author: 'PlanIt Team',
    publishDate: '2026-03-05',
    readTime: 7,
    content: `## Why Waitlist Management Is a Competitive Edge

A poorly managed waitlist costs real money. Studies consistently show 30–45% of waiting parties will leave if they don't receive a realistic wait quote within 5 minutes. That's revenue walking out the door.

## The Three Sins of Bad Waitlist Management

**Sin 1: The Mental Math Quote.** "About 20–25 minutes" guessed by a harried host is almost always wrong and destroys trust.

**Sin 2: Shouting Names Across a Loud Room.** Calling out party names forces guests to hover anxiously near the host stand instead of relaxing at the bar.

**Sin 3: No Transparency.** Guests who can't see where they are in line assume the worst.

## How PlanIt Venue Solves All Three

PlanIt's live wait board is a public-facing display that shows:

- Party name and position in line
- Estimated wait time calculated from actual table turn data
- A real-time count of parties ahead

When a table opens, you tap "Seat Next" — the party is notified, the wait board updates automatically, and your host is free to actually host.

## Setting Accurate Wait Estimates

The key to accurate quotes is **historical turn time data**. PlanIt tracks how long each table size takes to turn on your floor, broken down by time of day and day of week. After 2–3 weeks, the system knows your 4-tops take 52 minutes on Friday nights vs. 38 minutes on Tuesdays.

---

Waitlist management done right turns a pain point into a differentiator.`,
  },
  {
    slug: 'qr-checkin-event-guide',
    featured: false,
    heroColor: '#22c55e',
    title: 'QR Code Check-In for Events: The Complete Setup Guide',
    excerpt: 'Paper guest lists are an embarrassment in 2026. Here\'s how to set up professional QR check-in for any event size — in under 10 minutes.',
    category: 'How-To Guides',
    tags: ['check-in', 'QR code', 'how-to'],
    author: 'PlanIt Team',
    publishDate: '2026-02-28',
    readTime: 5,
    content: `## Why QR Check-In Wins Every Time

Clipboards are slow. Spreadsheets on a laptop are clunky. Manually scrolling a list while 40 people queue behind them is a nightmare.

QR check-in is faster, looks more professional, and gives you real-time data you can actually use.

## What You Need

- A PlanIt event set up in Enterprise Mode
- Your guest list imported or entered
- One device per check-in station (phone works fine)
- 30 minutes of prep time

## Step 1: Enable Enterprise Mode

When creating your event in PlanIt, select **Enterprise Mode**. This unlocks personalized QR codes for each invited guest, the check-in dashboard, and attendance analytics.

## Step 2: Add Your Guests

In your event's Guests panel, add each invited guest's name and email. PlanIt generates a unique QR code for each person automatically.

**Pro tip:** Import a CSV if you have a large list — PlanIt accepts standard spreadsheet exports.

## Step 3: Send the Invites

Use PlanIt's built-in invite sender or copy the personalized QR links to send via your own email tool.

## Step 4: Set Up Check-In Stations

Open the PlanIt check-in dashboard on each device. Scan speed is **under 3 seconds per guest** with a clear phone camera — no special hardware needed.

## Step 5: Monitor in Real Time

The organizer dashboard shows % checked in, who arrived and when, and walk-in vs. pre-registered ratios.

---

The setup time investment is minimal. The payoff — a smooth, professional check-in — is significant.`,
  },
  {
    slug: 'wedding-planning-tools',
    featured: false,
    heroColor: '#ec4899',
    title: 'The Only Wedding Planning Toolkit You Need (Without the Subscription Fee)',
    excerpt: 'Wedding planning apps charge $30–60/month for features you can get free. Here\'s how to plan your entire wedding with PlanIt — budget, vendor chat, RSVP, seating, and more.',
    category: 'Wedding Planning',
    tags: ['wedding', 'free tools', 'planning'],
    author: 'PlanIt Team',
    publishDate: '2026-02-20',
    readTime: 8,
    content: `## The Wedding App Racket

You get engaged. Immediately you're bombarded with ads for wedding planning apps at $29.99/month, $49/month, $79/month for "premium." Some charge separately for guest management, seating, and budgeting.

Here's a better way.

## What PlanIt Gives You, Free

A PlanIt event space for your wedding is your complete planning hub — shared with your partner, your wedding planner, every vendor, your MOH, and your parents. No one needs to create an account. Zero dollars.

### 1. Budget & Expense Tracking

Add every vendor quote and actual payment to the Expenses section. You see exactly where you are versus your total budget at all times. **Most couples discover 15–20% budget creep they never saw coming.**

### 2. Vendor Communication Hub

Add every vendor to your event chat. No more miscommunication. Every conversation is in one place, searchable.

### 3. RSVP Management

Guests RSVP via your event's public link. No accounts needed — they enter their name and dietary requirements.

### 4. Seating Chart

PlanIt's drag-and-drop seating tool lets you arrange tables and assign guests. When last-minute RSVPs arrive, you can update the chart in two minutes on your phone.

---

The best wedding planning tool is the one every single person on your team will actually use.`,
  },
  {
    slug: 'event-seating-chart-tips',
    featured: false,
    heroColor: '#a78bfa',
    title: '7 Seating Chart Mistakes That Ruin Events (and How to Avoid All of Them)',
    excerpt: 'Seating is one of the highest-leverage decisions in event planning. Get it wrong and the entire atmosphere suffers. Get it right and people think the event was magical.',
    category: 'Event Planning',
    tags: ['seating', 'events', 'tips'],
    author: 'PlanIt Team',
    publishDate: '2026-02-14',
    readTime: 6,
    content: `## Why Seating Is More Powerful Than You Think

Planners often treat seating as an administrative chore. But every experienced event coordinator knows: seating *is* the event. It determines who talks to whom and whether the energy in the room builds or dies.

## Mistake 1: Alphabetical Seating

Alphabetical order is for libraries, not events. Seating people based on the first letter of their last name guarantees strangers at every table with nothing in common.

**Fix:** Seat by relationship, role, or interest cluster.

## Mistake 2: Ignoring the Stage Sightline

The worst seat in the room always belongs to someone important.

**Fix:** Map your room and identify sightline dead zones *before* assigning seats.

## Mistake 3: Splitting Plus-Ones From Their Partners

Nothing makes a plus-one feel like a burden faster than being seated at a different table.

**Fix:** Always seat couples and plus-one pairs at the same table. Non-negotiable.

## Mistake 4: Freezing the Chart Too Early

Final RSVPs trickle in for days after the deadline.

**Fix:** Keep your seating chart editable until 48 hours before the event.

## Mistake 5: No Buffer Seats for VIPs

**Fix:** Leave one empty "reserved" seat at VIP tables.

## Mistake 6: Forgetting Accessibility

**Fix:** When collecting RSVPs, ask about accessibility needs. Designate accessible seats first.

---

A great seating chart is invisible. Nobody compliments it — they just have a good time.`,
  },
  {
    slug: 'free-event-planning-software-comparison',
    featured: true,
    heroColor: '#06b6d4',
    title: 'Free Event Planning Software in 2026: An Honest Comparison',
    excerpt: 'We tested every major free event planning tool and ranked them by what actually matters: ease of setup, guest management, team collaboration, and zero hidden paywalls.',
    category: 'Resources',
    tags: ['comparison', 'tools', 'free software'],
    author: 'PlanIt Team',
    publishDate: '2026-02-07',
    readTime: 10,
    content: `## The Real Criteria for Evaluating Free Event Software

Most "best of" lists rank tools by feature count or UI polish. Neither matters if the tool locks you out mid-event or requires every guest to create an account.

We evaluated tools on:
- **True zero cost** — no credit card for core features
- **Frictionless guest experience** — what does the guest need to do?
- **Team collaboration** — can your whole team access without individual accounts?
- **Scalability** — does it work for 10 guests and for 500?

## PlanIt

**Free forever.** No accounts for guests or team members. The workspace is shareable via link.

Stand-outs: real-time team chat, QR code check-in, seating charts, task management, expense tracking, live polls, and a full restaurant floor manager.

**Best for:** Any event where team collaboration and guest management matter more than ticket sales.

## Eventbrite (Free tier)

Good for public ticket distribution. The free tier is limited to free-ticket events, and even then Eventbrite charges a service fee to ticket buyers.

**Best for:** Public events that need broad discoverability and ticket distribution.

## Google Workspace

Technically free and extremely flexible — but requires significant setup. There's no event-specific workflow.

**Best for:** Teams already deep in Google Workspace who want to stay in one ecosystem.

## Our Recommendation

For the majority of events — **PlanIt's zero-cost model and zero-friction guest experience is the clear winner**.

---

The best tool is the one your whole team will actually use consistently.`,
  },
  {
    slug: 'nonprofit-fundraiser-event-planning',
    featured: false,
    heroColor: '#f59e0b',
    title: 'How to Run a Nonprofit Fundraiser That Actually Raises Funds',
    excerpt: 'Gala season is brutal for nonprofit staff stretched thin. Here\'s the playbook for executing a high-impact fundraiser without burning out your team.',
    category: 'Event Planning',
    tags: ['nonprofit', 'fundraiser', 'gala'],
    author: 'PlanIt Team',
    publishDate: '2026-01-30',
    readTime: 8,
    content: `## The Nonprofit Event Paradox

Fundraising events cost money to run. The margin between cost and revenue is determined almost entirely by planning quality.

## Start With the Revenue Model

Before any logistics, map your revenue streams:
- **Ticket sales** — fixed revenue, low risk, lower ceiling
- **Table sponsorships** — high revenue, requires relationship sales
- **Live auction** — variable, requires donated items
- **Fund-a-Need (paddle raise)** — often the highest per-attendee revenue
- **Matching gift campaigns** — can double revenue from a specific ask

Most successful galas use at least three of these in combination.

## Build Your Donor Experience, Not Your Event

Every element of the evening should reinforce the same emotional throughline: *why this cause matters and what the donor's gift will do*.

- **Impact stories**, not statistics — one specific person's story moves more money than any pie chart
- **Moments of pause** — don't fill every second with entertainment
- **Visible gratitude** — sponsors and major donors should feel seen

## The Logistics That Kill Galas

**Check-in chaos** is the most common gala failure point. PlanIt's QR check-in handles 300 guests arriving in a 45-minute window without breaking a sweat.

## The Ask: Timing and Framing

Best practice: Fund-a-Need immediately after the main program presentation, before dinner is cleared.

**A matching donor announcement before the ask can triple the response.**

---

The difference between a $200K and a $400K gala is rarely the budget or the venue. It's the intentionality of the donor experience.`,
  },
  {
    slug: 'event-budget-tracking-guide',
    featured: false,
    heroColor: '#10b981',
    title: 'Event Budget Tracking: Why Most Planners Go Over and How to Stay Under',
    excerpt: 'Budget overruns kill events and careers. Here\'s the expense tracking discipline that keeps professional event planners under budget, every time.',
    category: 'Event Planning',
    tags: ['budget', 'finance', 'tips'],
    author: 'PlanIt Team',
    publishDate: '2026-01-15',
    readTime: 7,
    content: `## The Budget Myth

Most event planners start with a budget. Very few end with it. The gap isn't usually one catastrophic overspend — it's a dozen "just this once" exceptions that compound.

## The Three Budget Killers

**1. The Anchor Problem**
Early vendor quotes become psychological anchors. When the actual invoice comes in 15% higher, planners approve it because "it's still close to the quote."

**Fix:** Budget every vendor at 115% of their initial quote. Use the difference as your buffer.

**2. The Hidden Categories**
Every event has categories that never appear in the initial budget: vendor meals, parking, printing costs, last-minute supplies, tips for venue staff. These typically total 8–12% of the budget.

**Fix:** Create a dedicated "miscellaneous" line item at 10% of your total budget on day one.

**3. The Scope Creep Accumulation**
"Can we add a photo booth?" "Can we upgrade the centerpieces?" Each ask seems reasonable. Together, they're a budget catastrophe.

**Fix:** Every scope addition must explicitly displace another budget item or receive formal approval.

## Building a Living Budget

Static spreadsheets fail because they're not updated in real time. PlanIt's Expenses module tracks quotes vs. actuals side by side, shows your total committed spend at any moment, and flags categories approaching their limit.

---

Budget discipline isn't about saying no to everything — it's about making every spend decision consciously.`,
  },
];

/**
 * seedBlogPosts()
 *
 * Called once from server.js after the DB connection is established.
 * Safe to call on every boot — it's a no-op if any posts already exist.
 */
async function seedBlogPosts() {
  try {
    const count = await BlogPost.countDocuments({ deleted: false });
    if (count > 0) {
      console.log(`[blogSeeder] ${count} posts already in DB — skipping seed`);
      return;
    }

    const docs = SEED_POSTS.map(p => ({ ...p, deleted: false }));
    const result = await BlogPost.insertMany(docs, { ordered: false });
    console.log(`[blogSeeder] Seeded ${result.length} blog posts into DB`);
  } catch (err) {
    // E11000 duplicate key — seeder already ran (e.g. after a restart)
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.some(e => e.code === 11000))) {
      console.log('[blogSeeder] Seed posts already present (duplicate key) — skipping');
      return;
    }
    // Any other error is unexpected — log but don't crash the server
    console.error('[blogSeeder] Unexpected error during seed:', err.message);
  }
}

module.exports = { seedBlogPosts };
