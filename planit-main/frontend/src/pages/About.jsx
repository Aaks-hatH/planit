import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Moon, Star, Zap, Shield, QrCode, Users, MessageSquare,
  BarChart3, FileText, ListChecks, Clock, CheckCircle2, TrendingUp,
  Lock, Eye, Link, Palette, Layers, ArrowLeft, Heart, Coffee,
  Sparkles, Timer, Globe, Download, Navigation, CalendarPlus, Info,
  Megaphone, StickyNote, AlertTriangle, Database, Share2, Activity,
  Fingerprint, Ban, Wifi, WifiOff, RefreshCw, Package, Bell,
  UserX, Cpu, ChevronRight, Hash, Trash2, Key, Server, Gauge,
  ClipboardList, DollarSign, PieChart, UserCheck, Search, Filter,
  ToggleLeft, ShieldAlert, ShieldCheck, Radio, Landmark, Map, UploadCloud, Edit2
} from 'lucide-react';
import { motion } from 'framer-motion';

function Section({ id, children, className = '' }) {
  return (
    <section id={id} className={`py-16 border-b border-neutral-200 ${className}`}>
      <div className="max-w-3xl mx-auto px-6">
        {children}
      </div>
    </section>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-neutral-600" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900">{title}</h2>
      </div>
      {subtitle && <p className="text-neutral-500 leading-relaxed text-base pl-[52px]">{subtitle}</p>}
    </div>
  );
}

function FeatureRow({ icon: Icon, title, description }) {
  return (
    <div className="flex gap-4 py-5 border-b border-neutral-100 last:border-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-neutral-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-neutral-900 mb-1">{title}</p>
        <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Callout({ children, accent = false }) {
  return (
    <div className={`my-6 p-5 rounded-2xl border text-sm leading-relaxed ${accent ? 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}>
      {children}
    </div>
  );
}

function SubHeading({ children }) {
  return (
    <h3 className="text-base font-bold text-neutral-800 mt-8 mb-3">{children}</h3>
  );
}

function Badge({ children, color = 'neutral' }) {
  const colors = {
    neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[color]}`}>
      {children}
    </span>
  );
}

function TechDetail({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-neutral-100 last:border-0">
      <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider pt-0.5 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-neutral-600 leading-relaxed">{value}</span>
    </div>
  );
}

export default function About() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('why-dark');

  useEffect(() => {
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const navGroups = [
    {
      label: 'Design',
      items: [
        { href: '#why-dark',       label: 'Why the dark background'       },
        { href: '#stars',          label: 'Stars and shooting stars'       },
        { href: '#page-colors',    label: 'Page color system'              },
      ]
    },
    {
      label: 'Getting Started',
      items: [
        { href: '#creating',       label: 'Creating an event'              },
        { href: '#event-link',     label: 'Custom event links'             },
        { href: '#event-modes',    label: 'Standard vs Enterprise mode'    },
      ]
    },
    {
      label: 'Planning Tools',
      items: [
        { href: '#planning-tools', label: 'Planning tools overview'        },
        { href: '#chat',           label: 'Team chat'                      },
        { href: '#tasks',          label: 'Task management'                },
        { href: '#polls',          label: 'Polls and voting'               },
        { href: '#notes',          label: 'Color-coded notes'              },
        { href: '#announcements',  label: 'Announcements'                  },
        { href: '#expenses',       label: 'Expense tracking'               },
        { href: '#files',          label: 'Files and sharing'              },
        { href: '#countdown',      label: 'Countdown timer'                },
        { href: '#utilities',      label: 'Utilities and export'           },
      ]
    },
    {
      label: 'Enterprise & Check-in',
      items: [
        { href: '#enterprise',     label: 'Enterprise mode'                },
        { href: '#guest-invite',   label: 'Guest invite page'              },
        { href: '#checkin',        label: 'Admit and deny check-in'        },
        { href: '#antifraud',      label: 'Anti-fraud system'              },
        { href: '#manager-override', label: 'Manager override'             },
      ]
    },
    {
      label: 'Security & Data',
      items: [
        { href: '#security',       label: 'Passwords and security'         },
        { href: '#ratelimiting',   label: 'Rate limiting'                  },
        { href: '#realtime',       label: 'Real-time features'             },
        { href: '#analytics',      label: 'Analytics'                      },
        { href: '#data-retention', label: 'Data retention'                 },
      ]
    },
    {
      label: 'Details',
      items: [
        { href: '#little-things',  label: 'The little things'              },
      ]
    },
  ];

  const allNavItems = navGroups.flatMap(g => g.items);

  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <style>{`
        html { scroll-behavior: smooth; }
        body { background: #f8f8f6; }
      `}</style>

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-neutral-300">|</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-bold text-neutral-900">About PlanIt</span>
            </div>
          </div>
          <a href="/" className="text-sm font-bold text-neutral-900 hover:text-neutral-600 transition-colors">
            planitapp.onrender
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 flex gap-16">

        {/* Sidebar */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <div className="sticky top-24">
            {navGroups.map(group => (
              <div key={group.label} className="mb-5">
                <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-2">{group.label}</p>
                <nav className="space-y-0.5">
                  {group.items.map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`block text-sm py-1.5 leading-snug transition-colors ${
                        activeSection === item.href.slice(1)
                          ? 'text-neutral-900 font-semibold'
                          : 'text-neutral-400 hover:text-neutral-700'
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full text-xs font-semibold text-neutral-300 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Every feature, explained in full
            </div>
            <h1 className="text-4xl font-black text-neutral-900 mb-4 leading-tight">
              About PlanIt
            </h1>
            <p className="text-lg text-neutral-500 leading-relaxed max-w-xl">
              This page is a complete reference for every design decision, every feature, every security layer, and every small detail in PlanIt. Nothing is here by accident, and nothing is left unexplained.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge color="neutral">React + Vite frontend</Badge>
              <Badge color="neutral">Node.js + Express backend</Badge>
              <Badge color="neutral">Socket.IO real-time</Badge>
              <Badge color="neutral">MongoDB data layer</Badge>
              <Badge color="emerald">No account required</Badge>
            </div>
          </motion.div>

          {/* ─── WHY DARK ─────────────────────────────────────────── */}
          <Section id="why-dark">
            <SectionTitle
              icon={Moon}
              title="Why the dark background"
              subtitle="The home page and the guest invite page are intentionally black, while every other page in PlanIt uses a standard white background. There is a specific, considered reason for this."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Think about the moment a guest receives an invite to a live event: a wedding ceremony, a corporate presentation, a school performance, a concert, or any other occasion taking place in a dim or darkened room. They open their phone to check the time, confirm their QR code, or show their invite to a staff member at the door. If that screen blazes with a white or brightly lit background, it lights up the entire space around them. It blinds the person standing next to them. It pulls attention away from the stage, the speaker, or the moment being shared.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The guest invite page is the one PlanIt page most likely to be opened in exactly that kind of environment. Keeping it dark means that when someone checks their phone at your event, the screen stays dim and unobtrusive. Nobody gets distracted. Nobody gets accidentally blinded. The room stays in its intended atmosphere, and the guest's interaction with their invite is quiet and invisible to those around them.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The home page follows the same principle because it is the page organizers most often have open on a device near the stage or at a check-in table during the event itself. The organizer might be managing arrivals, glancing at the screen between guests, or monitoring the check-in dashboard from a laptop set up just off-stage. A consistently dark surface in those moments is simply more considerate to the people in the room.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              There is also a secondary, aesthetic reason. Dark backgrounds in event software carry a sense of occasion. They feel professional, polished, and intentional in a way that plain white often does not. When a guest opens their invite page and sees a dark, well-designed screen with their name prominently displayed and a QR code ready to scan, it elevates the perception of the event itself. The visual treatment of the invite is part of the guest experience, not just a utility screen.
            </p>
            <Callout accent>
              Every other page in PlanIt — the event workspace, the admin panel, support, terms, privacy, the about page you are reading now — uses a light background because those pages are used in normal, well-lit environments where readability and sustained focus are the priorities. The dark/light split is deliberate and precisely scoped to the two pages where dark actually serves the user better.
            </Callout>
          </Section>

          {/* ─── STARS ─────────────────────────────────────────────── */}
          <Section id="stars">
            <SectionTitle
              icon={Star}
              title="Stars and shooting stars"
              subtitle="The animated background on the home page and the guest invite page is a live field of stars with occasional shooting stars passing through the sky. Every element of this animation was designed intentionally."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              The name of this app is PlanIt. Say the two words quickly together and they sound like "planet." That one phonetic detail is the entire conceptual foundation of the background. The dark sky, the stars, the shooting stars — they turn the surface of the app into a night sky, and the name of the app into the world you are planning on. It is a simple, quiet visual pun that rewards anyone who notices it without demanding attention from those who do not.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The stars themselves are not uniform. Each star is individually assigned a random brightness level, a random base position across the canvas, and its own independent twinkle rhythm. The twinkle effect works by slowly oscillating each star's opacity value over time. No two stars share the same oscillation speed, so the field looks organic rather than mechanical — like actually looking at a real sky rather than a looping screensaver pattern. The number of stars rendered is calibrated to feel full without being cluttered: dense enough to feel immersive, sparse enough that the dark background still reads as sky.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              Shooting stars appear at irregular, randomized intervals. This irregularity is important. A shooting star that appears on a fixed loop — every three seconds, every ten seconds — quickly becomes something the eye learns to predict and ignore. A shooting star that appears unpredictably, after what feels like a genuinely random wait, still feels like a small surprise each time. Each shooting star travels at a natural downward diagonal angle across the canvas, slightly brighter at the head and fading through a long, tapered tail before disappearing. The head-to-tail brightness gradient was tuned through iteration to look as close as possible to a real meteor trail without requiring any heavy rendering work.
            </p>
            <SubHeading>Performance decisions</SubHeading>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The animation runs on a standard HTML canvas element. There is no WebGL, no Three.js, no post-processing pipeline, no particle system library, and no heavy graphics dependency of any kind. This was a deliberate and strongly considered performance decision.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              An earlier version of the background used a full 3D rendering pipeline with WebGL shaders and post-processing glow effects. It was visually impressive when it worked, but it came with real costs: it consumed significant GPU resources on modern hardware and caused noticeable frame rate drops on mid-range and budget phones, which represent a significant portion of the audience for a guest invite page. It added several hundred kilobytes to the initial load bundle. It required GPU context initialization on page load, adding a visible flash or delay before the background appeared. And it was brittle — some browsers and operating systems throttle or disable WebGL in certain conditions, meaning a non-trivial percentage of guests would have seen a blank screen or a fallback.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The canvas 2D approach achieves the same atmospheric result at a tiny fraction of the computational cost. A 2D canvas with simple circle drawing and linear interpolation for the shooting star trail is something every browser on every device handles trivially. The visual difference between the two approaches, when both are rendered at native device resolution on a real screen, is effectively imperceptible to a human eye.
            </p>
            <Callout>
              When no shooting star is active, the animation loop drops to a slow idle tick that only redraws the canvas roughly every 60 milliseconds and only updates star opacity by fractional amounts each frame. This means the background is nearly idle for the majority of the time it is displayed and has no meaningful impact on battery life, CPU usage, or device thermals. The animation is designed to be ambient infrastructure, not a centerpiece that competes for resources with the content it frames.
            </Callout>
          </Section>

          {/* ─── PAGE COLORS ────────────────────────────────────────── */}
          <Section id="page-colors">
            <SectionTitle
              icon={Palette}
              title="Page color system"
              subtitle="PlanIt uses two distinct visual modes depending on where you are in the app, with a deliberately narrow accent palette that communicates state without requiring the user to learn a key."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              The color system was designed around a single principle: every color used in the interface should carry meaning, and that meaning should be consistent throughout the entire app. Colors are not applied for decoration. Each one is tied to a specific semantic purpose, and once you learn what a color means in one part of PlanIt, it means the same thing everywhere.
            </p>
            <FeatureRow
              icon={Moon}
              title="Dark pages: Home and Guest Invite"
              description="Near-black backgrounds (#06060c on the home page, #040407 on the invite page) with white text, subtle neutral borders, and muted accent colors. These two pages are the ones most likely to be viewed in a dark or dim environment, so their background is dark by default rather than requiring a dark mode toggle."
            />
            <FeatureRow
              icon={Layers}
              title="Light pages: everywhere else"
              description="Standard white or very light off-white backgrounds (#f8f8f6 on this page, pure white in the event workspace) with dark text. These pages are designed for sustained reading and editing in normal ambient light. The slight warm tint of #f8f8f6 on the about and information pages reduces the harshness of pure white without appearing yellow."
            />
            <FeatureRow
              icon={Eye}
              title="Emerald green: confirmed and active states"
              description="Emerald green (#10b981 and its tint variants) is used exclusively for positive confirmation and active status throughout PlanIt. You will see it on the 'Admitted' badge after a successful check-in, on the live indicator dot in the event workspace header, in RSVP confirmation messages, on task completion checkmarks, on the 'Event is Live' countdown state, and on the 'checked in' status in the guest list. It is never used decoratively."
            />
            <FeatureRow
              icon={Zap}
              title="Amber yellow: notices and warnings"
              description="Amber yellow is reserved exclusively for warnings, special notices, and information that needs elevated attention without implying something is wrong. You will see it on the reminder to keep your QR code private on the invite page, on personal notes added by the organizer to a guest invitation, on the medium-priority task badge, on the data retention deletion warning banner, and on the 'important' flag for announcements."
            />
            <FeatureRow
              icon={AlertTriangle}
              title="Red: errors and blocked states"
              description="Red is used only for errors, failures, denied states, and high-severity security flags. Denied check-ins, blocked invites, failed API requests, high-priority tasks, and rate limit errors all use red. It is never used in neutral or informational contexts."
            />
            <FeatureRow
              icon={Layers}
              title="Blue and indigo: enterprise features"
              description="The enterprise check-in dashboard, the enterprise utilities card, and enterprise-specific UI elements use a blue-to-indigo gradient. This creates a visual distinction between planning workspace features (neutral grays) and guest management features (blue), helping organizers understand which mode they are operating in at a glance."
            />
          </Section>

          {/* ─── CREATING ───────────────────────────────────────────── */}
          <Section id="creating">
            <SectionTitle
              icon={Calendar}
              title="Creating an event"
              subtitle="Getting started requires no account, no payment, no email address, and no setup beyond filling in a short form. The entire creation process is designed to be completed in under two minutes."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              The event creation form is the only onboarding step in PlanIt. There is no account registration, no email verification, no subscription flow, and no profile setup. You fill in the form, you click create, and you are inside your event workspace. That is all.
            </p>
            <FeatureRow
              icon={FileText}
              title="Event title"
              description="The name of your event. This appears in the workspace header, in the guest invite page, in the add-to-calendar link, and in the deletion warning banner. It does not need to be formal — it is for internal reference as much as it is for guests to see."
            />
            <FeatureRow
              icon={Globe}
              title="Date, time, and timezone"
              description="The event date and time are stored relative to the timezone you select at creation. PlanIt detects your browser's timezone and pre-selects it automatically, but you can change it to any IANA timezone from the dropdown. All time displays in the workspace are shown in the event's timezone, and the countdown timer accounts for the offset correctly regardless of where in the world a viewer's browser is located."
            />
            <FeatureRow
              icon={Map}
              title="Location"
              description="An optional text field for the event venue or address. If provided, this appears on the guest invite page and is used to populate the 'Get Directions' link that opens Google Maps pointed at that location. It is also included in the add-to-calendar link as the event location field."
            />
            <FeatureRow
              icon={Link}
              title="Custom event URL (subdomain/slug)"
              description="As you type your event title, PlanIt automatically generates a clean URL slug from the title words. For example, 'Summer Retreat 2026' becomes 'summer-retreat-2026-ab3f', where the last four characters are randomly generated to guarantee uniqueness across all events on the platform. You can edit the slug field manually; once you do, the auto-suggestion stops updating so your custom value is never overwritten."
            />
            <FeatureRow
              icon={Lock}
              title="Account password (required)"
              description="This password is required. It is tied to your identity as the event organizer. When you or a team member with organizer access tries to open the event from a new browser or device, this password is what confirms their identity. Without it, the event link alone is not sufficient to claim organizer access. Store this password somewhere accessible — it currently cannot be reset or changed after the event is created."
            />
            <FeatureRow
              icon={Shield}
              title="Event password (optional)"
              description="This password is optional and serves a completely different purpose from the account password. If set, it gates entry to the entire event workspace for everyone: guests, team members, and organizers alike. Anyone navigating to the event URL must enter this password before they can see anything. Use it when the event is confidential and you want to prevent people who received the link secondhand from entering the workspace."
            />
            <Callout accent>
              Both passwords are set at creation time and cannot be changed after the event is created. Choose them deliberately. The account password should be something you can remember or store securely. The event password should be something you are willing to share with your entire planning team if you set one. If you forget the account password, there is currently no recovery mechanism — this is an intentional tradeoff that keeps the system simple and avoids requiring email addresses.
            </Callout>
          </Section>

          {/* ─── EVENT LINK ─────────────────────────────────────────── */}
          <Section id="event-link">
            <SectionTitle
              icon={Link}
              title="Custom event links"
              subtitle="Every event in PlanIt gets a clean, human-readable URL that you control. The URL system is designed so that the link you share with your team actually looks like something, rather than a random string of database identifiers."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              When you enter an event title on the creation form, PlanIt automatically suggests a URL slug derived from the title. The suggestion algorithm lowercases the title, replaces spaces with hyphens, strips special characters, and appends a four-character random suffix to guarantee that no two events will ever produce the same slug. The result is a URL that is both recognizable and unique.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              You can override the auto-generated slug with anything you prefer. The moment you type in the slug field manually, the auto-suggestion from the title field stops updating, so your custom value is locked in. If the slug you choose is already in use by another event, PlanIt detects the conflict before you submit the form and offers an alternative.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              There are two URL formats depending on whether a slug was set. If a slug was set, the event is accessible at <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">planitapp.onrender.com/e/your-slug</code>. If no slug was set (or the slug was cleared), the fallback format is <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">planitapp.onrender.com/event/[mongodb-id]</code>, which uses the raw database document ID. The slug-based format is always preferred because it is shareable by voice, easy to type on a phone, and immediately identifiable in a browser tab or bookmark.
            </p>
            <Callout>
              The event link is what your planning team uses to enter the workspace. It is not the same as the guest invite link — guests each get their own individual URL tied to their personal invite record. The event workspace link should only be shared with people you want to have access to the planning tools.
            </Callout>
          </Section>

          {/* ─── EVENT MODES ─────────────────────────────────────────── */}
          <Section id="event-modes">
            <SectionTitle
              icon={ToggleLeft}
              title="Standard vs Enterprise mode"
              subtitle="PlanIt offers two event modes that serve different kinds of events. The mode is chosen at creation time and determines which features are available inside the workspace."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              The mode distinction exists because not every event needs a guest list and a check-in system, and including those features for events that do not need them would clutter the workspace and complicate the experience. By choosing at creation time, you get a workspace tailored exactly to what your event requires.
            </p>
            <FeatureRow
              icon={Users}
              title="Standard mode"
              description="Standard mode is designed for internal team planning. You get the full collaboration workspace: chat, tasks, polls, notes, announcements, expenses, file sharing, countdown, and analytics. There is no guest list and no check-in system. Standard mode is appropriate for planning retreats, team offsites, internal conferences, workshops, meetups, and any event where the primary users of PlanIt are the organizers themselves rather than external guests."
            />
            <FeatureRow
              icon={Zap}
              title="Enterprise mode"
              description="Enterprise mode adds the complete guest management and check-in system on top of everything in Standard mode. You can build a guest list with individual invite links and QR codes, manage RSVPs, run a real-time check-in dashboard on event day, and review post-event attendance analytics. Enterprise mode is appropriate for weddings, galas, corporate dinners, conferences with ticketed attendance, award ceremonies, and any occasion where the guest experience and entry management are central concerns."
            />
            <Callout>
              The mode cannot be changed after the event is created. If you choose Standard mode and later realize you need the guest management features, you would need to create a new event in Enterprise mode. This is a deliberate limitation that keeps the data model clean — adding a guest list to an event that was created without one would require migrating or discarding existing workspace data.
            </Callout>
          </Section>

          {/* ─── PLANNING TOOLS OVERVIEW ─────────────────────────────── */}
          <Section id="planning-tools">
            <SectionTitle
              icon={ListChecks}
              title="Planning tools overview"
              subtitle="The event workspace gives your team access to a suite of interconnected tools designed to handle every stage of event planning, from early brainstorming through post-event review."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              All planning tools are accessible from the tabbed navigation within the event workspace. Each tab opens a different tool panel while keeping the event header and connection status visible at all times. Tools that have real-time updates (chat, tasks, polls, notes, announcements, expenses) receive live data pushed from the server via a persistent WebSocket connection, so changes made by one team member appear immediately for everyone else without any manual refreshing.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The planning tool suite includes: real-time team chat, task management with priority and assignment, polls and voting, color-coded notes, organizer announcements, expense tracking with budget management, file sharing, a live countdown timer, analytics and reporting, and a utilities panel for sharing and exporting event data. Each tool is described in detail in the sections that follow.
            </p>
            <Callout>
              There is no limit on the number of participants who can join the planning workspace. You can have your full organizing committee, every vendor contact, venue staff, volunteer coordinators, and any other collaborator in the workspace at the same time. PlanIt does not impose seat limits, per-user pricing, or participant caps.
            </Callout>
          </Section>

          {/* ─── CHAT ────────────────────────────────────────────────── */}
          <Section id="chat">
            <SectionTitle
              icon={MessageSquare}
              title="Team chat"
              subtitle="The chat panel is a real-time messaging channel shared between everyone in the event workspace. It is the primary communication layer for the planning team."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Messages are delivered over the WebSocket connection established when a user joins the workspace. When you send a message, it travels to the server, is stored in the database, broadcast to every other connected session in the same event room, and appears in their chat panel within milliseconds — no polling, no page refresh, no delay perceptible to human attention.
            </p>
            <FeatureRow
              icon={Activity}
              title="Typing indicators"
              description="When a team member starts composing a message, a typing indicator appears at the bottom of the chat for all other connected participants. The indicator shows the username of whoever is typing. It disappears automatically when the message is sent or when the user has stopped typing for a few seconds. This removes the uncertainty of not knowing whether someone is about to respond."
            />
            <FeatureRow
              icon={Clock}
              title="Persistent message history"
              description="All messages are stored in the database and loaded when a participant joins the workspace. Team members who join late, or who were absent during an earlier planning session, can scroll back through the complete message history to catch up on what was discussed. The history is not paginated — all messages load at once."
            />
            <FeatureRow
              icon={Users}
              title="Username identification"
              description="Every message is attributed to the username that the participant entered when joining the event. Usernames are not account-level identifiers — they are session-level labels that help the team tell each other apart in the chat. There is no avatar or profile system, just the username and the message text."
            />
            <FeatureRow
              icon={Radio}
              title="Real-time broadcast"
              description="Messages are broadcast to all connected sessions in the event room simultaneously using Socket.IO's room system. Each event has its own isolated room, so messages from one event never appear in another. The chat rate limiter on the server allows up to 30 messages per minute per IP before throttling, which is sufficient for any realistic planning conversation."
            />
          </Section>

          {/* ─── TASKS ───────────────────────────────────────────────── */}
          <Section id="tasks">
            <SectionTitle
              icon={ListChecks}
              title="Task management"
              subtitle="The task panel is a shared to-do list for the entire planning team. Tasks can be created, assigned, prioritized, and completed by any participant in the workspace."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              When you create a task, you fill in a title, an optional description, an optional assignment to a named team member, an optional due date, and a priority level. Tasks are stored in the database and pushed to all connected sessions via the <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">tasks_updated</code> socket event whenever any task is created, completed, or deleted.
            </p>
            <FeatureRow
              icon={AlertTriangle}
              title="Priority system: high, medium, low"
              description="Every task carries a priority level that controls both its visual treatment and its sort position in the list. High-priority tasks appear with a red badge and are sorted to the top of the incomplete section. Medium-priority tasks carry an amber badge and sort in the middle. Low-priority tasks have a blue badge and sort last among incomplete items. This means the most urgent work is always visible at the top without any manual reordering."
            />
            <FeatureRow
              icon={CheckCircle2}
              title="Toggle completion"
              description="Clicking the circle icon next to a task marks it complete or incomplete. Completed tasks are moved to the bottom of the list with a strikethrough style. Any participant in the workspace can toggle any task, regardless of who created or was assigned it. Completion state is broadcast live to all connected sessions."
            />
            <FeatureRow
              icon={Users}
              title="Assignment"
              description="Tasks can be assigned to a named person by typing their name in the 'assigned to' field when creating the task. The assigned name is displayed on the task card. This is a free-text field, not tied to the participant system, so you can assign tasks to people who may not be in the workspace (external vendors, contacts, etc.)."
            />
            <FeatureRow
              icon={Clock}
              title="Due dates"
              description="Tasks can carry an optional due date. If set, the due date is displayed on the task card with a calendar icon. Overdue tasks — those whose due date has passed and are not yet complete — are highlighted with an amber alert indicator to draw attention to them."
            />
            <FeatureRow
              icon={BarChart3}
              title="Task statistics"
              description="The top of the task panel shows three numbers: total tasks, completed tasks, and pending tasks. These counters update in real time as tasks are created and completed. They give the team an at-a-glance progress summary without needing to scroll through the full list."
            />
          </Section>

          {/* ─── POLLS ───────────────────────────────────────────────── */}
          <Section id="polls">
            <SectionTitle
              icon={BarChart3}
              title="Polls and voting"
              subtitle="The polls panel lets the team create multiple-choice questions and vote on them in real time. It is designed for the frequent group decisions that arise during event planning."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Any participant in the workspace can create a poll — it is not restricted to the organizer. This is by design: polls often arise from conversation, and the person raising the question should be able to create the poll immediately without having to ask someone with elevated access to do it for them.
            </p>
            <FeatureRow
              icon={Hash}
              title="Two to ten options"
              description="Each poll can have between 2 and 10 options. The minimum of 2 enforces the structure of a choice; having a single option would just be a statement. The maximum of 10 keeps polls focused and avoids overwhelming the team with too many choices for a single decision."
            />
            <FeatureRow
              icon={Activity}
              title="Live vote tallies"
              description="Vote counts update in real time as team members cast their votes. The server broadcasts a poll update event to all connected sessions the moment a vote is recorded. You can watch the results change live without refreshing the page, which is useful when discussing options in a call or a meeting room while voting together."
            />
            <FeatureRow
              icon={Users}
              title="Per-user vote tracking"
              description="Votes are associated with the username of the voter. This prevents the same session from voting multiple times. The system does not use cookies or fingerprinting for vote deduplication — it uses the username stored in the JWT token issued when the user joined the workspace."
            />
            <FeatureRow
              icon={ClipboardList}
              title="Poll history"
              description="All polls are stored in the database and listed in the polls panel, most recent first. Closed decisions are visible for reference even after the vote is complete. Poll results persist for the lifetime of the event and are included in the engagement analytics summary."
            />
          </Section>

          {/* ─── NOTES ───────────────────────────────────────────────── */}
          <Section id="notes">
            <SectionTitle
              icon={StickyNote}
              title="Color-coded notes"
              subtitle="The notes panel is a shared scratchpad for the team, styled as a collection of color-coded sticky notes. Unlike the chat, notes are persistent, structured pieces of content meant to be revisited rather than scrolled past."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Each note has a title, a body content field, and a color. Notes are displayed as cards in a grid layout. Because every note has its own color, the team can develop informal conventions around what different colors mean for their event: yellow for decisions, blue for vendor contacts, green for confirmed items, red for open questions. The color assignment is entirely up to the person creating the note — PlanIt provides seven distinct color choices but does not enforce any meaning on them.
            </p>
            <FeatureRow
              icon={Palette}
              title="Seven color options"
              description="The available note colors are yellow (#fef3c7), blue (#dbeafe), red (#fecaca), green (#d1fae5), purple (#e9d5ff), orange (#fed7aa), and pink (#fbcfe8). These are all soft, desaturated pastels that are easy on the eyes for extended reading, distinct enough to be clearly differentiated in a grid, and light enough to remain readable with dark text overlaid on them."
            />
            <FeatureRow
              icon={Edit2}
              title="In-place editing"
              description="Any note can be edited after creation. Clicking the edit icon on a note opens the creation form pre-filled with the note's current title, content, and color. Saving the edit replaces the note content and broadcasts the updated note list to all connected sessions. The edit is not versioned — only the current content is stored."
            />
            <FeatureRow
              icon={Trash2}
              title="Note deletion"
              description="Notes can be deleted by any team member, not just the person who created them. Deletion is confirmed with a browser dialog before proceeding. Deleting a note removes it from the database permanently and broadcasts the updated list to all connected sessions immediately."
            />
            <FeatureRow
              icon={Radio}
              title="Live synchronization"
              description="Note create, update, and delete events are all broadcast via the notes_updated socket event to every connected session in the event room. If one team member creates a note while another is looking at the notes panel, the new note appears in the other person's grid without any refresh."
            />
          </Section>

          {/* ─── ANNOUNCEMENTS ───────────────────────────────────────── */}
          <Section id="announcements">
            <SectionTitle
              icon={Megaphone}
              title="Announcements"
              subtitle="The announcements panel gives the event organizer a dedicated broadcast channel for important team-wide messages that need to be seen by everyone, not scrolled past in a chat."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Unlike the team chat, where messages from different people intermingle and context requires scrolling, announcements are a one-way broadcast from the organizer to the rest of the team. Only participants with organizer access can create announcements. All participants can read them.
            </p>
            <FeatureRow
              icon={Bell}
              title="Real-time notification toast"
              description="When the organizer posts a new announcement, every currently connected team member receives a toast notification at the top of their screen with the text 'New announcement' and a megaphone icon. This happens even if the person is currently looking at a different tab in the workspace (chat, tasks, etc.). The notification pulls their attention to the announcements panel without requiring them to have it open."
            />
            <FeatureRow
              icon={AlertTriangle}
              title="Important flag"
              description="When creating an announcement, the organizer can mark it as 'important'. Important announcements are displayed with a distinct red-bordered alert styling that makes them visually prominent in the list. Use this flag for time-sensitive information: last-minute venue changes, schedule shifts, emergency communications, or anything that requires immediate attention from the team."
            />
            <FeatureRow
              icon={ClipboardList}
              title="Persistent broadcast history"
              description="All announcements remain in the panel after posting. Team members who were offline when an announcement was made will see it when they join the workspace. The list is sorted most-recent-first. There is no expiry or auto-deletion of announcements within the event's lifetime."
            />
            <Callout>
              Announcements are intentionally separate from the chat to prevent important operational messages from being buried in conversation. If you need to tell your entire team something that they all need to know and act on, use an announcement. If you need to discuss something or share context, use the chat.
            </Callout>
          </Section>

          {/* ─── EXPENSES ────────────────────────────────────────────── */}
          <Section id="expenses">
            <SectionTitle
              icon={DollarSign}
              title="Expense tracking"
              subtitle="The expense panel is a shared ledger for logging event costs as they are incurred. It tracks individual line items, assigns them to categories and payers, and compares total spending against a configurable budget."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Event budgets are notoriously difficult to manage when costs are tracked across multiple people's spreadsheets, email threads, and WhatsApp messages. The expense panel centralizes all cost recording in the same workspace where the planning is happening, so the financial picture is always visible alongside the work.
            </p>
            <FeatureRow
              icon={DollarSign}
              title="Line item logging"
              description="Each expense entry has a title, an amount, a category, a 'paid by' field for tracking who covered the cost, and optional notes. All fields except title and amount are optional. The entry appears in the expense list immediately after submission and is broadcast to all connected sessions."
            />
            <FeatureRow
              icon={Landmark}
              title="Budget setting and tracking"
              description="The organizer can set a total budget for the event. Once set, the expense panel displays a running comparison: total spent versus total budget, with a remaining amount that turns red when spending exceeds the budget. The budget can be updated at any time by the organizer as financial plans evolve."
            />
            <FeatureRow
              icon={PieChart}
              title="Category breakdown"
              description="Expenses are grouped by category in the summary view. If you categorize your expenses consistently (venue, catering, AV, staffing, marketing, etc.), the category breakdown gives you a clear picture of where the money is going without any extra configuration. The breakdown is derived automatically from the category labels you enter on each expense."
            />
            <FeatureRow
              icon={Radio}
              title="Live synchronization"
              description="Expense create and delete events, as well as budget updates, are broadcast to all connected sessions via the expenses_updated socket event. If a team member logs an expense while the financial lead is reviewing the expense panel on a separate device, the new line item appears immediately without any refresh."
            />
          </Section>

          {/* ─── FILES ───────────────────────────────────────────────── */}
          <Section id="files">
            <SectionTitle
              icon={FileText}
              title="Files and sharing"
              subtitle="The file panel lets the team attach documents, images, and other files directly inside the event workspace. No external file sharing service is required."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Event planning generates a predictable range of file types: venue contracts, floor plans in PDF form, run-of-show spreadsheets, design assets for printed signage, catering menus, speaker bios, budget documents, accommodation lists, and logistical briefings. Without a central place for these files, they end up scattered across email attachments, shared drives, and messaging apps — and the question of "where is the current version of X?" becomes a recurring friction point during planning.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The file panel solves this by keeping all event-related files in the same place as the chat, tasks, and notes. When a team member uploads a file, it is stored against the event and becomes immediately visible and downloadable by all participants. There is no limit on the number of files, no folder hierarchy to navigate, and no permission system within the workspace — if you are in the event, you can access all files.
            </p>
            <FeatureRow
              icon={UploadCloud}
              title="Upload limiter"
              description="File uploads are rate-limited at the server level: no more than 20 uploads per hour per IP address. This prevents the file storage from being abused as a general-purpose file host while being generous enough for any real event planning scenario. The limit resets on a rolling hourly window."
            />
            <Callout>
              All files, along with all other event data, are permanently deleted seven days after the event date as part of the automated data retention cleanup. This keeps the system clean and ensures that guest data, vendor contracts, and personal details are not stored indefinitely. If you need to keep any files beyond that window, download them before the deletion date. The workspace shows a deletion warning banner when the event is approaching the seven-day mark.
            </Callout>
          </Section>

          {/* ─── COUNTDOWN ───────────────────────────────────────────── */}
          <Section id="countdown">
            <SectionTitle
              icon={Timer}
              title="Countdown timer"
              subtitle="The event workspace includes a live countdown clock that counts down to the event date and time, updated every second."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              The countdown is displayed in the event workspace as a prominent card showing days, hours, minutes, and seconds remaining until the event. The values are calculated client-side from the difference between the current browser time and the stored event date, accounting for the event's timezone. Each digit is displayed in a monospaced tabular number format so the layout does not shift as numbers change.
            </p>
            <FeatureRow
              icon={CheckCircle2}
              title="Live state: event is running"
              description="When the current time passes the event's scheduled start, the countdown card transitions from showing the remaining time to showing a green 'Event is Live!' state with the event's start datetime. This transition happens automatically on every connected session simultaneously. There is no need to manually switch modes or reload the page — the component detects the threshold crossing on its regular one-second tick."
            />
            <FeatureRow
              icon={Globe}
              title="Timezone accuracy"
              description="The countdown accounts for the timezone offset set at event creation. A team member in a different timezone from the event location will still see the correct remaining time because the calculation uses the event's absolute UTC timestamp rather than a local interpretation of the date string."
            />
            <FeatureRow
              icon={Cpu}
              title="Efficient tick implementation"
              description="The countdown runs on a JavaScript setInterval with a 1000ms interval. The interval is created in a useEffect hook and cleaned up on component unmount, preventing memory leaks when the workspace tab is switched. The calculation is pure arithmetic — no date libraries required — and is fast enough that the timer introduces no perceptible CPU overhead."
            />
          </Section>

          {/* ─── UTILITIES ───────────────────────────────────────────── */}
          <Section id="utilities">
            <SectionTitle
              icon={Share2}
              title="Utilities and export"
              subtitle="The utilities panel consolidates tools for sharing the event, exporting data, and accessing the enterprise check-in system from one place."
            />
            <FeatureRow
              icon={Link}
              title="Event link copy"
              description="The panel displays the full event URL in a read-only input field with a copy button. Clicking the button writes the URL to the clipboard and briefly changes the button label to a confirmation state. On mobile devices and browsers that support the Web Share API, a native share sheet is offered instead, which allows sharing the link directly via Messages, Mail, WhatsApp, or any other app on the device."
            />
            <FeatureRow
              icon={QrCode}
              title="Event workspace QR code"
              description="A QR code encoding the event workspace URL is displayed in the utilities panel and can be expanded to fill the screen. This is the QR code for the workspace itself, not for individual guest invites — it is useful for quickly bringing new team members into the workspace by scanning rather than typing the URL. It can also be displayed on a screen at the beginning of a planning meeting so everyone joins at once."
            />
            <FeatureRow
              icon={Download}
              title="Calendar export (.ics)"
              description="The event can be exported as an .ics calendar file that is compatible with Apple Calendar, Google Calendar, Outlook, and any other calendar application that accepts the iCalendar standard. The exported file includes the event title, date, time, duration, location, and a reference back to the event workspace URL."
            />
            <FeatureRow
              icon={Users}
              title="Participant list export"
              description="Organizers can download a structured export of the participant list — the team members who have joined the workspace — as a downloadable file. This is useful for headcount records, access logs, and post-event documentation."
            />
            <FeatureRow
              icon={UserCheck}
              title="Enterprise check-in shortcut"
              description="For Enterprise mode events, the utilities panel displays a prominent card with a direct button to the check-in dashboard. The card also summarizes what the check-in system can do (add guests with group sizes, send personalized invite links, scan QR codes, view real-time attendance) as a quick reminder for staff who may be unfamiliar with the system."
            />
          </Section>

          {/* ─── ENTERPRISE ──────────────────────────────────────────── */}
          <Section id="enterprise">
            <SectionTitle
              icon={Zap}
              title="Enterprise mode"
              subtitle="Enterprise mode is designed for events with a formal guest list: weddings, conferences, galas, corporate dinners, and any occasion where each attendee is individually invited, identified at the entrance, and tracked throughout the event."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              When an event is created in Enterprise mode, the planning workspace is identical to Standard mode, but the check-in dashboard becomes available. From the check-in dashboard, the organizer manages the complete lifecycle of every guest invitation: creation, distribution, RSVP tracking, and day-of check-in.
            </p>
            <FeatureRow
              icon={Users}
              title="Guest record creation"
              description="Each guest is added individually. The guest record includes their name, email address, party size (split into adult and child counts, which are tracked separately), table or seating assignment, any dietary notes, and a personal note from the organizer. This note is the only field that appears on the guest's invite page highlighted in amber — it is the message the organizer specifically wants that guest to read."
            />
            <FeatureRow
              icon={Link}
              title="Per-guest unique invite links"
              description="When a guest record is created, PlanIt generates a cryptographically unique invite code and appends it to a guest-specific URL. This is not a shared link. It is a URL that exists solely for that one guest, contains their personal details, and is tied to their record in the database. If someone forwards their link to an uninvited person, that person cannot use it to gain entry under a different identity — the QR code and invite code are bound to the original guest name."
            />
            <FeatureRow
              icon={QrCode}
              title="QR codes"
              description="Each invite page displays a QR code generated from the guest's unique invite URL. On event day, staff at the entrance use the check-in dashboard to scan the code using their device's camera. The system validates the code, retrieves the guest record, and presents the guest's name, party size, table assignment, and any special notes to the staff member for confirmation."
            />
            <FeatureRow
              icon={TrendingUp}
              title="Real-time attendance tracking"
              description="The check-in dashboard shows a live attendance count that increments with every admitted guest. The count is visible across all devices connected to the dashboard simultaneously — an organizer monitoring remotely sees the same live number as the staff scanning at the door. The dashboard also shows a timeline graph of arrivals by time, a table-by-table fill status, and a breakdown of admitted versus not-yet-arrived guests."
            />
            <FeatureRow
              icon={Clock}
              title="Check-in timestamps"
              description="Every check-in records the precise datetime at which the guest was admitted. This timestamp is stored on the invite record and is used by the analytics system to plot the arrival timeline. After the event, the organizer can review exactly when each guest arrived and identify patterns in the arrival distribution."
            />
          </Section>

          {/* ─── GUEST INVITE PAGE ───────────────────────────────────── */}
          <Section id="guest-invite">
            <SectionTitle
              icon={QrCode}
              title="Guest invite page"
              subtitle="The guest invite page is what each guest sees when they open their personal invite link. It is designed to feel like a proper event ticket rather than a generic web form, and every element of it is optimized for the context in which it will be viewed."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              The guest's name appears prominently at the top of the page, personalizing the experience immediately. Below the name is the event information block: event title, date and time in the event's timezone, location, and the organizer's name. Further down is the QR code entry pass, styled as a physical ticket stub with decorative perforations along the top edge. Below the QR code are the utility actions: fullscreen view, download, add to calendar, and get directions.
            </p>
            <FeatureRow
              icon={QrCode}
              title="Fullscreen QR view"
              description="Tapping the QR code expands it to fill the entire screen. The fullscreen view has a white background behind the code to maximize contrast for scanning — even devices with display calibration issues or screen protectors that reduce brightness will produce a scannable code. Tapping anywhere on the fullscreen view closes it and returns to the invite page. This feature is specifically designed for staff scanning in low-light or high-ambient-noise conditions where pulling out the code quickly matters."
            />
            <FeatureRow
              icon={Download}
              title="Download QR code as PNG"
              description="Guests can download their QR code as a PNG image file directly to their device. This allows them to save it to their camera roll for offline access, print it out and bring a physical copy, or embed it in a screenshot that they can store in a note. On event day, guests who are having browser or signal issues can still show their saved QR code image for scanning."
            />
            <FeatureRow
              icon={CalendarPlus}
              title="Add to calendar"
              description="A single tap opens Google Calendar in a new tab with the event details pre-filled: the event title, full date and time, duration (defaulting to two hours if no end time was specified), location, and a description that includes the guest's personal invite URL for easy re-access. The guest does not need to type anything — they just confirm the calendar entry and save it."
            />
            <FeatureRow
              icon={Navigation}
              title="Get directions"
              description="If the event has a location set, a 'Get Directions' button appears below the event details. Tapping it opens Google Maps in a new tab or the native maps application on mobile, navigating to the event address. This is a direct deep-link to Google Maps' directions mode, not a search — it navigates to the address rather than searching for it, which is more reliable for addresses that might not appear prominently in search results."
            />
            <FeatureRow
              icon={Info}
              title="Organizer personal note"
              description="If the organizer added a personal note to this specific guest's invitation (for example: 'Your gift has been arranged' or 'Please use the side entrance on Elm Street' or 'You are seated at Table 4 near the window'), that note is displayed in an amber-highlighted section that is visually distinct from the rest of the page. The amber color draws the eye and ensures the guest reads the note without the organizer needing to follow up separately."
            />
            <FeatureRow
              icon={Moon}
              title="Dark screen for dark rooms"
              description="As explained in the design section, the guest invite page uses a dark background because guests are likely to open it during the event itself, in dim or dark conditions. The QR code display area itself uses a white background regardless of page theme, ensuring maximum contrast for reliable scanning even in low-light environments. The rest of the page stays dark to minimize screen glare and light bleed."
            />
          </Section>

          {/* ─── CHECK-IN ────────────────────────────────────────────── */}
          <Section id="checkin">
            <SectionTitle
              icon={CheckCircle2}
              title="Admit and deny check-in"
              subtitle="The check-in screen is the interface staff use when a guest presents their QR code at the entrance on event day. It is designed for speed, clarity, and confidence under real event conditions."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              The check-in flow begins when a staff member scans a QR code using the camera on their device. The scan triggers a validation request to the server, which looks up the invite code, retrieves the guest record, and returns the result — all within a fraction of a second on a normal network connection. The result screen is designed to be read at a glance: the guest's name is large and prominent, the party size and table assignment are displayed immediately below, and the two action buttons — Admit and Deny — are visually distinct and large enough to tap confidently on a phone screen held in one hand.
            </p>
            <FeatureRow
              icon={CheckCircle2}
              title="Admit"
              description="Pressing Admit sends a check-in confirmation to the server. The server marks the invite record as checked in, records the exact admission timestamp, increments the live attendance counter, and broadcasts the updated count to all dashboard sessions. The check-in screen returns to a ready state for the next scan within about two seconds. The whole process — scan, review, admit — is designed to take under five seconds per guest."
            />
            <FeatureRow
              icon={Ban}
              title="Deny"
              description="Pressing Deny does not mark the guest as checked in and does not record an admission. The screen returns to ready state. Deny is provided for situations where a guest presents a QR code that belongs to someone else, where there is a dispute about identity, or where entry needs to be refused for any other reason. It has no automated consequence for the guest record beyond not admitting them — it does not flag or block the invite automatically."
            />
            <FeatureRow
              icon={AlertTriangle}
              title="Already admitted state"
              description="If a QR code is scanned for a guest who has already been admitted, the screen shows a distinct 'already checked in' state rather than the normal admit/deny screen. The original admission time is displayed. This prevents the same QR code from being used twice by two different people — even if the code was forwarded or shared, the second presenter will be flagged immediately."
            />
            <FeatureRow
              icon={ShieldAlert}
              title="Security warnings on screen"
              description="If the anti-fraud middleware detects suspicious conditions during a scan (rapid repeated scanning, multiple IP addresses, duplicate fingerprints, low trust score), a warning message is shown to the staff member on the result screen alongside the admit/deny buttons. The warning does not automatically block entry — it gives the staff member the information to make a judgment call."
            />
          </Section>

          {/* ─── ANTI-FRAUD ──────────────────────────────────────────── */}
          <Section id="antifraud">
            <SectionTitle
              icon={ShieldCheck}
              title="Anti-fraud system"
              subtitle="PlanIt includes a multi-layer anti-fraud middleware suite that runs server-side on every check-in attempt in Enterprise mode. It is designed to detect and respond to the most common fraud vectors at live events without creating friction for legitimate guests."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              The anti-fraud system is a configurable pipeline of middleware functions that execute sequentially before a check-in is confirmed. Each middleware layer is independently toggleable through the event's check-in security settings, giving organizers granular control over which protections are active without needing to disable the entire system.
            </p>
            <FeatureRow
              icon={Fingerprint}
              title="Duplicate detection"
              description="The duplicate detection layer generates a fingerprint for each invite based on guest name and other identifying fields. Before confirming a check-in, it checks whether any other invite in the same event shares that fingerprint. If it finds another invite that is already checked in with the same fingerprint, it can either block the new check-in automatically (if autoBlockDuplicates is enabled) or pass a high-severity warning to the staff member's screen for manual review. This catches situations where the same person has been added to the guest list twice under slightly different name variations, or where they obtained multiple invite codes."
            />
            <FeatureRow
              icon={Lock}
              title="Reentrancy protection (concurrent check-in lock)"
              description="The reentrancy protection layer prevents two staff members from simultaneously processing the same QR code. When a scan validation begins, the layer acquires an exclusive lock on the invite record tied to the staff member's session ID. If a second scan request arrives for the same invite while the lock is held, the second request receives a 409 Conflict response immediately. The lock is automatically released when the first request's response is sent, whether the check-in was confirmed, denied, or errored."
            />
            <FeatureRow
              icon={Activity}
              title="Suspicious pattern detection"
              description="This layer tracks scan attempt patterns over time. It detects rapid repeated scanning of the same code within a configurable time window (defaulting to 10 seconds and 3 scans) and flags it as suspicious. It also tracks the number of unique IP addresses and device fingerprints that have attempted to scan a given code — if the same code has been scanned from three or more different locations, it raises a medium-severity warning. All suspicious patterns are logged as security flags on the invite record."
            />
            <FeatureRow
              icon={ShieldAlert}
              title="Trust score system"
              description="Each invite accumulates a trust score based on its scan history. A clean invite with no suspicious activity has a score of 100. The score is reduced by security flags: duplicate fingerprint matches, rapid scans, multiple device detections, and failed PIN attempts all carry negative weights. Organizers can configure a minimum trust score threshold; invites falling below the threshold can be automatically blocked or flagged for manual review."
            />
            <FeatureRow
              icon={Ban}
              title="Block enforcement and emergency lockdown"
              description="Individual invites can be blocked manually by the organizer, either permanently or until a specified time. When a blocked invite is scanned, the check-in is refused with a clear reason displayed to the staff member. Organizers can also activate an emergency lockdown for the entire event, which suspends all check-ins immediately across all staff devices. The lockdown reason is displayed on every scan attempt until it is lifted."
            />
            <FeatureRow
              icon={Timer}
              title="Time window enforcement"
              description="Check-in can be configured to only accept scans within a time window relative to the event start. The default window opens two hours before the event and closes thirty minutes after it starts. Scans attempted before the window opens or after it closes are refused with an informative message showing when the window will open or when it closed. This prevents premature check-ins and post-event QR code abuse."
            />
            <FeatureRow
              icon={Users}
              title="Capacity enforcement"
              description="If a maximum attendee capacity is configured, the system counts admitted attendees (summing the actual group sizes of all checked-in invites) before each new check-in. When the venue reaches capacity, further check-ins are refused with a 'venue at capacity' message. The capacity count is based on actual admitted people, not the number of invite records — a group of four counts as four against capacity, not one."
            />
            <FeatureRow
              icon={Database}
              title="Audit logging"
              description="When detailed audit logging is enabled, every scan attempt is logged with the timestamp, the staff member's username, the IP address (if IP logging is permitted), and the device user agent. This creates a complete, tamper-resistant record of every interaction with every invite code for the lifetime of the event. The audit log is useful for post-event security reviews and dispute resolution."
            />
          </Section>

          {/* ─── MANAGER OVERRIDE ────────────────────────────────────── */}
          <Section id="manager-override">
            <SectionTitle
              icon={Key}
              title="Manager override"
              subtitle="The manager override system allows an authorized staff member to manually check in a guest without a QR code. It is designed for situations where the normal QR scan flow is not possible."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Guests occasionally arrive without a working phone, with a dead battery, without a signal to load their invite page, or having genuinely lost the email containing their invite link. In these cases, the normal QR scan flow is not available, and without an alternative, the guest would be unable to check in at all.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The manager override flow allows a staff member to search the guest list by name, find the correct guest record, and manually confirm their check-in. To prevent abuse, the override requires the staff member to authenticate with the event's organizer (account) password before the search is available. Without knowing the organizer password, no one can use the override feature.
            </p>
            <Callout accent>
              Manual overrides are logged on the invite record with the same timestamp and staff attribution as a normal QR check-in. They are included in the attendance analytics and appear in the audit log with a flag indicating the check-in method was manual rather than QR scan. This means overrides are fully traceable and cannot be used to quietly admit guests without a record.
            </Callout>
            <p className="text-sm text-neutral-500 leading-relaxed mt-4">
              The manager override is also available for invites that have been flagged or blocked by the anti-fraud system. If the system automatically blocked a guest due to a duplicate detection or low trust score, the override allows an organizer who has reviewed the situation to manually clear the block and admit the guest. The override action is separately logged as a security event on the invite record.
            </p>
          </Section>

          {/* ─── SECURITY ────────────────────────────────────────────── */}
          <Section id="security">
            <SectionTitle
              icon={Shield}
              title="Passwords and security"
              subtitle="PlanIt uses two distinct password layers with two different purposes, plus several additional security measures at the API and infrastructure level."
            />
            <FeatureRow
              icon={Lock}
              title="Account password"
              description="The account password is the organizer's identity credential. It is required to claim the organizer role in the workspace from any new browser session or device. The password is hashed before storage using bcrypt with a salt round configuration appropriate for interactive authentication. It is never stored in plaintext, never returned in API responses, and never appears in server logs."
            />
            <FeatureRow
              icon={Shield}
              title="Event password (optional)"
              description="The event password gates entry to the event workspace for all visitors. If set, it acts as a shared secret between the organizer and everyone they want in the workspace. It is hashed and stored separately from the account password. Participants who enter the correct event password receive a signed JWT token that grants access to the workspace for the duration of their session."
            />
            <FeatureRow
              icon={Key}
              title="JWT token authentication"
              description="Access to the event workspace is managed via JSON Web Tokens (JWT). When a participant successfully authenticates, the server issues a signed token containing the event ID, the participant's username, their role (organizer or participant), and an expiration timestamp. This token is stored in localStorage on the client and sent as a Bearer token on every API request. The server validates the signature and expiration on every protected route."
            />
            <FeatureRow
              icon={Eye}
              title="Password reveal toggles"
              description="Every password field in PlanIt — on the event creation form, the organizer login form, and the admin panel — includes a toggle button to reveal or hide the typed text. The toggle uses an eye icon that switches to an eye-off icon when the field is in reveal mode. This is a small accessibility and usability feature that prevents the frustration of typing a long password incorrectly with no way to verify it."
            />
            <FeatureRow
              icon={QrCode}
              title="Per-guest QR code uniqueness"
              description="In Enterprise mode, each guest's invite code is a randomly generated alphanumeric string that is unique within the event. The code is generated server-side at invite creation time and stored hashed. Scanning a valid code only confirms the specific guest it was issued to — there is no way to predict or construct a valid invite code without having it generated by the server for a real guest record."
            />
          </Section>

          {/* ─── RATE LIMITING ───────────────────────────────────────── */}
          <Section id="ratelimiting">
            <SectionTitle
              icon={Gauge}
              title="Rate limiting"
              subtitle="PlanIt's API server applies multiple layers of rate limiting to prevent abuse, protect against brute-force attacks, and ensure service availability for all users."
            />
            <p className="text-neutral-500 leading-relaxed mb-6">
              Rate limits are enforced at the server level using express-rate-limit middleware. Each limit is scoped to a specific endpoint category, uses a rolling time window, and returns a standardized 429 response with a Retry-After header when exceeded. Limits are keyed by IP address using the x-forwarded-for header where available.
            </p>
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <TechDetail label="General API" value="Up to 10,000 requests per 15-minute window per IP. This is intentionally generous — it covers all general workspace API calls (loading tasks, polls, notes, etc.) without being restrictive for normal use." />
              <TechDetail label="Authentication" value="Up to 20 failed authentication attempts per 15 minutes per IP. Successful attempts are not counted against the limit. After 20 failures, the IP is blocked from further attempts for the remainder of the window. This is the primary protection against password brute-force attacks on event access." />
              <TechDetail label="Event creation" value="Up to 10 new events per hour per IP. This prevents the platform from being used to create large numbers of throwaway events programmatically." />
              <TechDetail label="File uploads" value="Up to 20 file uploads per hour per IP. Resets on a rolling hourly window. This prevents the file storage from being abused as a general-purpose file hosting service." />
              <TechDetail label="Chat messages" value="Up to 30 messages per minute per IP per event. The rate limit key combines the IP address with the event ID, so the limit applies per-event rather than globally — being active in a fast-moving chat on one event does not throttle your ability to chat in another." />
              <TechDetail label="Health checks" value="Health check requests to /health are excluded from all rate limits to allow monitoring services to poll the server status continuously without consuming rate limit budget." />
            </div>
          </Section>

          {/* ─── REALTIME ────────────────────────────────────────────── */}
          <Section id="realtime">
            <SectionTitle
              icon={Zap}
              title="Real-time features"
              subtitle="A persistent WebSocket connection underlies the collaborative experience in the event workspace. Several features depend on it directly, and the workspace includes connection status awareness so participants always know whether their session is live."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              The real-time system is built on Socket.IO, which establishes a WebSocket connection when a participant joins the workspace and falls back to long polling if WebSockets are unavailable in the environment. The connection is maintained for the entire session and automatically attempts to reconnect if it drops.
            </p>
            <FeatureRow
              icon={MessageSquare}
              title="Chat"
              description="Messages are broadcast over the socket connection in real time. There is no polling, no HTTP fetch on a timer. New messages arrive the moment the server receives and broadcasts them, typically within tens of milliseconds on a normal network."
            />
            <FeatureRow
              icon={BarChart3}
              title="Polls"
              description="Vote tallies are broadcast to all connected sessions when a vote is cast. The result changes live on everyone's screen as votes come in. Poll creation is also broadcast, so team members see new polls appear without refreshing."
            />
            <FeatureRow
              icon={ListChecks}
              title="Tasks"
              description="Task creation, completion, and deletion events are broadcast to all sessions. If a team member marks a task complete on their phone, the checkmark appears for everyone watching the task list on their laptops simultaneously."
            />
            <FeatureRow
              icon={StickyNote}
              title="Notes"
              description="Note create, edit, and delete events are broadcast. Changes to the shared notes board are visible across all sessions in real time."
            />
            <FeatureRow
              icon={Megaphone}
              title="Announcements"
              description="New announcements trigger an immediate toast notification on all connected sessions, regardless of which workspace tab they are currently viewing."
            />
            <FeatureRow
              icon={DollarSign}
              title="Expenses"
              description="New expenses and budget updates are broadcast to all sessions. The running total and category breakdown update live."
            />
            <FeatureRow
              icon={TrendingUp}
              title="Check-in attendance"
              description="In Enterprise mode, every admitted check-in is broadcast to all sessions connected to the check-in dashboard. Organizers on separate devices see the attendance count increment in real time."
            />
            <FeatureRow
              icon={WifiOff}
              title="Disconnection handling"
              description="If the socket connection drops (due to network loss, server restart, or browser backgrounding), Socket.IO automatically attempts to reconnect. The workspace header shows a connection indicator that turns from green to amber when the connection is lost and back to green when it is restored. Any events that occurred while disconnected are loaded from the database on reconnect to ensure no updates are missed."
            />
          </Section>

          {/* ─── ANALYTICS ───────────────────────────────────────────── */}
          <Section id="analytics">
            <SectionTitle
              icon={BarChart3}
              title="Analytics"
              subtitle="The analytics panel provides two distinct views depending on whether the event is in Standard or Enterprise mode. In both cases, analytics are derived from the live event data and reflect the current state of the workspace."
            />
            <SubHeading>Enterprise check-in analytics</SubHeading>
            <p className="text-neutral-500 leading-relaxed mb-4">
              For Enterprise mode events, the analytics panel contains a rich attendance dashboard. This view shows the total number of guests added to the event, the total number who have checked in, the percentage check-in rate, and a time-series graph of arrivals plotted against time. The arrival graph makes it easy to see when the peak arrival window was, identify any sudden drop-off in check-ins, and compare the arrival curve against the planned event start time.
            </p>
            <FeatureRow
              icon={Users}
              title="Guest summary statistics"
              description="Total guests added, total adults and children (tracked separately if entered at invite creation), total group sizes, and total admitted count. These numbers give an instant picture of the event's scope and current fill rate."
            />
            <FeatureRow
              icon={TrendingUp}
              title="Arrival timeline chart"
              description="A bar or line chart plotting the number of check-ins per time interval from the event start. The time intervals are automatically sized based on the total check-in window so the chart is always readable regardless of whether check-ins occurred over 20 minutes or three hours."
            />
            <FeatureRow
              icon={Landmark}
              title="Table-by-table status"
              description="For events where table assignments were used, the analytics view shows a breakdown of admitted guests per table. This helps front-of-house staff understand which tables are filling up and communicate seating status to catering without doing manual counts."
            />
            <SubHeading>Standard engagement analytics</SubHeading>
            <p className="text-neutral-500 leading-relaxed mb-4">
              For Standard mode events, the analytics panel summarizes workspace activity across all planning tools. This view is less about attendance and more about collaboration health — it answers the question of how actively and effectively the team is using the workspace.
            </p>
            <FeatureRow
              icon={MessageSquare}
              title="Chat activity"
              description="Total messages sent across the entire planning period. Broken down by participant if usernames are available."
            />
            <FeatureRow
              icon={ListChecks}
              title="Task completion rate"
              description="Total tasks created versus total tasks completed. A completion rate close to 100% at event time suggests the planning was well-managed. A low completion rate is a useful signal for post-event retrospectives."
            />
            <FeatureRow
              icon={FileText}
              title="Files and polls"
              description="Count of files shared and polls created. These numbers, viewed in context of the planning timeline, help teams understand how much collaborative decision-making and asset sharing happened through the workspace versus informally."
            />
            <FeatureRow
              icon={Clock}
              title="Last activity timestamp"
              description="The analytics panel shows the datetime of the most recent activity in the workspace. This is useful for quickly assessing whether a planning workspace is still actively used or has been idle for an extended period."
            />
          </Section>

          {/* ─── DATA RETENTION ──────────────────────────────────────── */}
          <Section id="data-retention">
            <SectionTitle
              icon={Database}
              title="Data retention"
              subtitle="All event data in PlanIt is subject to an automatic seven-day deletion policy that runs from the event's scheduled date. This policy is not optional and applies to every event on the platform."
            />
            <p className="text-neutral-500 leading-relaxed mb-4">
              Seven days after an event's scheduled date, a background cleanup job permanently deletes all data associated with that event from the database. This includes the event record itself, all messages, tasks, polls, notes, announcements, expenses, files, participants, and invite records. The deletion is irreversible.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The policy exists for several interconnected reasons. Event planning data has a clearly defined useful lifetime — it is relevant before and during the event, and becomes unnecessary or actively undesirable to retain afterward, particularly when it includes guest personal information (names, email addresses, dietary notes, party compositions). Keeping data indefinitely would expose guests and organizers to unnecessary privacy risk without providing any benefit.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-4">
              The seven-day grace period is intentional. It gives organizers time to download any files, export the participant list, review the analytics, or complete any post-event administrative work before the data is gone. Seven days is generous enough for nearly any use case while still ensuring that data does not accumulate indefinitely on the platform.
            </p>
            <FeatureRow
              icon={AlertTriangle}
              title="Deletion warning banner"
              description="When an event is within a configurable number of days of its deletion date, the event workspace displays a persistent warning banner at the top of every page. The banner shows the number of days remaining and a clear explanation of what will be deleted. It is styled in amber to draw attention without being alarming."
            />
            <FeatureRow
              icon={RefreshCw}
              title="Automated cleanup job"
              description="The deletion is executed by a scheduled background job running on the server. The job queries for events whose date is more than seven days in the past and deletes their associated data in a specific order that respects database relationships: messages, then polls, then files, then participants, then invites, then the event record itself."
            />
            <Callout accent>
              There is no way to recover deleted event data once the cleanup job has run. If you need to keep records of your event — files, guest lists, chat logs, expense reports — download or export them before the deletion date. The workspace provides download options in the utilities panel for exactly this purpose.
            </Callout>
          </Section>

          {/* ─── LITTLE THINGS ───────────────────────────────────────── */}
          <Section id="little-things">
            <SectionTitle
              icon={Sparkles}
              title="The little things"
              subtitle="A complete catalog of the small details that are easy to miss but contribute meaningfully to how the app feels. Each one was built deliberately."
            />
            <FeatureRow
              icon={Zap}
              title="Live status dot in the header"
              description="The green pulsing dot in the event workspace header next to the event title has no functional purpose. It signals at a glance that the real-time connection is active and the workspace is live. The pulse animation is a slow, gentle ring expansion using a CSS scale and opacity keyframe — subtle enough to read as ambient status information rather than a notification demanding attention. When the connection drops, the dot switches to amber."
            />
            <FeatureRow
              icon={Star}
              title="Animated counters on the home page"
              description="The statistics in the hero section of the home page — events planned, teams organized, success rate — count up from zero to their target values when they scroll into the viewport for the first time. The count animation uses a requestAnimationFrame loop with an easing function so the numbers accelerate at the start and decelerate as they approach the target, which feels more natural than a linear count. The animation fires once per page load; scrolling back up and down again does not replay it."
            />
            <FeatureRow
              icon={Layers}
              title="Scroll reveal animations"
              description="Feature sections, cards, and content blocks on the home page and this page fade and slide upward into view as you scroll down. The animations are powered by Framer Motion's whileInView feature combined with a once: true flag that ensures the reveal plays exactly once. Elements that have already been revealed stay in their final position rather than hiding and re-animating when scrolled back into view."
            />
            <FeatureRow
              icon={Palette}
              title="Shimmer text on the hero heading"
              description="The words 'Effortless' and 'by design' in the main heading on the home page use a shimmer animation where a lighter highlight sweeps slowly across the text from left to right. The two words use different animation durations and start delays so they feel independent rather than synchronized. The shimmer is a CSS background-clip: text technique with a linear gradient background-image animated via a custom keyframe."
            />
            <FeatureRow
              icon={Calendar}
              title="Live slug preview on the creation form"
              description="As you type the event title, the URL preview below the title field updates in real time to show what your event URL will look like. The preview is formatted as the full URL including the domain, making it easy to see exactly what you will be sharing. Once you edit the slug field manually, the auto-update from the title field stops so your customization is never overwritten."
            />
            <FeatureRow
              icon={CheckCircle2}
              title="Copy button confirmation state"
              description="Every 'copy to clipboard' button in PlanIt — the event link copy, the invite link copy, the QR code URL copy — temporarily changes both its label and its icon after a successful copy. The label changes from 'Copy' to 'Copied' and the icon switches from a clipboard to a checkmark. The confirmation lasts two seconds before reverting. You never need to wonder if the copy operation actually worked."
            />
            <FeatureRow
              icon={QrCode}
              title="QR code ticket stub styling"
              description="The QR code card on the guest invite page includes a decorative row of small circles running along its top edge, evocative of the perforated tear-off stub on a physical ticket. This is a purely cosmetic detail with no functional purpose — it is there because it makes the invite page feel more like a real ticket and less like a data display screen. Guests who notice it tend to find it charming; guests who do not notice it still benefit from the elevated aesthetic."
            />
            <FeatureRow
              icon={Eye}
              title="Password reveal toggles everywhere"
              description="Every single password input field across the entire app — the event creation form, the organizer login form, the admin panel — uses the same eye icon button pattern to toggle between visible and hidden text. The icon state (open eye / crossed-out eye) is consistent. The behavior is consistent. Nothing about password fields surprises you once you have used one."
            />
            <FeatureRow
              icon={Navigation}
              title="Active sidebar section tracking"
              description="On this about page, the left sidebar tracks which section you are currently reading and highlights the corresponding nav link in dark bold text. The tracking is implemented using the IntersectionObserver API with a root margin that triggers the active state when a section is roughly in the center third of the viewport. Only one section is highlighted at a time — reading down the page produces a smooth advancement through the nav links."
            />
            <FeatureRow
              icon={RefreshCw}
              title="Optimistic UI on task toggles"
              description="When you toggle a task's completion state, the UI responds immediately without waiting for the server to confirm the change. If the server request fails, the UI reverts and shows an error toast. This optimistic pattern means the app feels fast and responsive even on a slow connection, while still being accurate if something goes wrong."
            />
            <FeatureRow
              icon={Coffee}
              title="Made with coffee, not love"
              description="The footer reads 'Made with coffee, not love.' The heart icon that appears in the footers of approximately every other web application ever built is replaced with a coffee cup. It is a small, honest joke that acknowledges how software actually gets made. Only people who scroll to the very bottom of the home page ever see it, which makes it feel like a reward for reading rather than a marketing statement."
            />
          </Section>

          {/* Footer */}
          <div className="pt-12 pb-8 flex items-center justify-between border-t border-neutral-200 mt-4">
            <p className="text-sm text-neutral-400">© 2026 PlanIt. All rights reserved.</p>
            <a href="/" className="text-sm font-bold text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to PlanIt
            </a>
          </div>

        </main>
      </div>
    </div>
  );
}
