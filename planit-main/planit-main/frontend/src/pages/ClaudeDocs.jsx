import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bot, Zap, Shield, Key, Users, CheckCircle2,
  Megaphone, DollarSign, BarChart3, LayoutGrid, Clock,
  AlertTriangle, Info, ChevronDown, ChevronUp, ExternalLink,
  Copy, Check, Lock, RefreshCw, Plug, List, Star,
} from 'lucide-react';

/* ─── CONSTANTS ──────────────────────────────────────────────────────────────── */

const MCP_URL = 'https://planit-mcp.onrender.com/mcp';
const CONNECT_URL = `https://claude.ai/customize/connectors?modal=add-custom-connector&mcpName=PlanIt&mcpServerUrl=${MCP_URL}`;

/* ─── SMALL UI HELPERS ───────────────────────────────────────────────────────── */

function Callout({ variant = 'info', children }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    tip:     'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const icons = { info: Info, warning: AlertTriangle, tip: Star };
  const Icon = icons[variant];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border my-5 text-sm leading-relaxed ${styles[variant]}`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function CopyBox({ value, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 my-3">
      <code className="flex-1 text-xs text-neutral-700 font-mono break-all">{value}</code>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors flex-shrink-0"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4 mb-7">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white text-sm font-black flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900 mb-2">{title}</p>
        <div className="text-sm text-neutral-600 leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  );
}

function FAQ({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-2 mt-4">
      {items.map((item, i) => (
        <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-semibold text-neutral-800">{item.q}</span>
            {open === i
              ? <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            }
          </button>
          {open === i && (
            <div className="px-4 pb-4 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
              <p>{item.a}</p>
              {item.links && item.links.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                  {item.links.map((l, j) => (
                    <a
                      key={j}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors"
                    >
                      {l.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3 mb-5 mt-10">
      <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h2 className="text-lg font-black text-neutral-900">{children}</h2>
    </div>
  );
}

function ToolCard({ icon: Icon, name, description, examples }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-neutral-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-neutral-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-neutral-900">{name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-neutral-300 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-neutral-300 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-1.5">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Example prompts</p>
          {examples.map((ex, i) => (
            <div key={i} className="flex gap-2 text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2">
              <span className="text-neutral-300 flex-shrink-0">"</span>
              <span>{ex}</span>
              <span className="text-neutral-300 flex-shrink-0">"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── TOOL DEFINITIONS ───────────────────────────────────────────────────────── */

const TOOL_GROUPS = [
  {
    label: 'Event Management',
    icon: Zap,
    tools: [
      {
        icon: Zap,
        name: 'create_event',
        description: 'Create a brand new PlanIt event from scratch — no prior account needed.',
        examples: [
          'Create a birthday party event on July 4th at 7 PM EDT with a 50 guest limit',
          'Set up a corporate dinner called "Q3 Kickoff" at the Marriott on August 12th',
          'Make a new event and set the organizer password to mypassword123',
        ],
      },
      {
        icon: Info,
        name: 'get_event',
        description: 'Retrieve full event details including date, location, organizer info, and current stats.',
        examples: [
          'What are the details of my event?',
          'Show me the event info',
          'What is the current RSVP and check-in status?',
        ],
      },
      {
        icon: RefreshCw,
        name: 'update_event',
        description: 'Update the event title, description, date, time, location, timezone, or guest limit.',
        examples: [
          'Change the event location to "Grand Ballroom, Hilton NYC"',
          'Update the event date to September 15th at 6:30 PM',
          'Set the max guest limit to 200',
        ],
      },
      {
        icon: BarChart3,
        name: 'get_event_status',
        description: 'Live dashboard snapshot — guests invited, checked in, pending, tables, staff, and time until event.',
        examples: [
          'Give me a status summary of the event',
          'How many guests have checked in vs are still pending?',
          'How long until the event starts?',
        ],
      },
    ],
  },
  {
    label: 'Guest Management',
    icon: Users,
    tools: [
      {
        icon: Users,
        name: 'add_guest',
        description: 'Add a single guest to the event with name, email, phone, notes, and optional table assignment.',
        examples: [
          'Add Sarah Chen, sarah@example.com, table 4',
          'Add a guest named Marcus Williams with a note: VIP, front row seating',
          'Add John Smith, phone 555-0100, no table yet',
        ],
      },
      {
        icon: List,
        name: 'import_guests',
        description: 'Bulk-import multiple guests in one call — name, email, phone, and notes per guest.',
        examples: [
          'Add these 5 guests: [Alice, alice@x.com], [Bob, bob@x.com], [Carol, carol@x.com]',
          'Import a list of guests: names are Tom, Jerry, and Spike',
        ],
      },
      {
        icon: Users,
        name: 'get_guest_list',
        description: 'Retrieve the full guest list, optionally filtered by check-in status.',
        examples: [
          'Show me all guests',
          'List everyone who has checked in',
          'Who is still pending check-in?',
        ],
      },
      {
        icon: Users,
        name: 'find_guest',
        description: 'Search for a guest by name, email, or phone number.',
        examples: [
          'Find Sarah Chen',
          'Look up the guest with email bob@example.com',
          'Is James Rodriguez on the list?',
        ],
      },
      {
        icon: RefreshCw,
        name: 'update_guest',
        description: 'Update any field on an existing guest record.',
        examples: [
          'Update Sarah\'s table to Table 7',
          'Add a note to Marcus: arrived with +1',
          'Change Bob\'s email to newemail@example.com',
        ],
      },
      {
        icon: AlertTriangle,
        name: 'remove_guest',
        description: 'Permanently remove a guest from the event and invalidate their invite link.',
        examples: [
          'Remove Sarah Chen from the guest list',
          'Delete the guest with ID ...',
        ],
      },
      {
        icon: BarChart3,
        name: 'get_checkin_stats',
        description: 'Check-in summary: total invited, checked in, pending, percentage, and last arrival time.',
        examples: [
          'What are the check-in stats?',
          'What percentage of guests have arrived?',
          'When did the last guest check in?',
        ],
      },
    ],
  },
  {
    label: 'Seating',
    icon: LayoutGrid,
    tools: [
      {
        icon: LayoutGrid,
        name: 'create_table',
        description: 'Add a new table to the event seating map with a name, capacity, and shape.',
        examples: [
          'Create a round table called "Table 1" with 10 seats',
          'Add a rectangular VIP table with capacity 6',
          'Create 15 tables of 8 called Table 1 through Table 15',
        ],
      },
      {
        icon: LayoutGrid,
        name: 'get_tables',
        description: 'List all tables with their current guest assignments and occupancy counts.',
        examples: [
          'Show me all the tables',
          'Which tables still have empty seats?',
          'Who is assigned to Table 3?',
        ],
      },
      {
        icon: Users,
        name: 'assign_guest_to_table',
        description: 'Assign a specific guest to a specific table.',
        examples: [
          'Assign Sarah Chen to Table 4',
          'Put Marcus at the VIP table',
        ],
      },
      {
        icon: Users,
        name: 'remove_guest_from_table',
        description: 'Unassign a guest from their current table without removing them from the event.',
        examples: [
          'Remove Sarah from her table',
          'Unassign Marcus from the VIP table',
        ],
      },
      {
        icon: LayoutGrid,
        name: 'get_seating_map',
        description: 'Full seating map: all tables, their assigned guests, check-in status per guest, and unseated guests.',
        examples: [
          'Show me the full seating map',
          'Which guests are unseated?',
          'How many seats are filled across all tables?',
        ],
      },
      {
        icon: Star,
        name: 'suggest_seating',
        description: 'Generate a round-robin seating arrangement for all currently unseated guests.',
        examples: [
          'Suggest a seating arrangement for all remaining guests',
          'How would you seat the unassigned guests?',
        ],
      },
    ],
  },
  {
    label: 'Check-in',
    icon: CheckCircle2,
    tools: [
      {
        icon: CheckCircle2,
        name: 'get_checkin_feed',
        description: 'Live feed of the most recent check-ins — name, time, and admission method.',
        examples: [
          'Show me the last 20 check-ins',
          'Who just arrived?',
          'Give me a live arrival feed',
        ],
      },
      {
        icon: CheckCircle2,
        name: 'manual_checkin',
        description: 'Manually mark a guest as checked in without scanning their QR code.',
        examples: [
          'Check in Sarah Chen manually',
          'Mark Marcus Williams as arrived',
        ],
      },
      {
        icon: Key,
        name: 'override_checkin',
        description: 'Apply a manager override check-in with a required reason that is logged in the audit trail.',
        examples: [
          'Override check-in for Bob, reason: gate phone is dead',
          'Manager override for Carol, reason: QR expired, confirmed on guest list',
        ],
      },
      {
        icon: Shield,
        name: 'get_security_alerts',
        description: 'List all guests with blocked status or active security flags.',
        examples: [
          'Are there any security alerts?',
          'Which guests are blocked?',
          'Show me flagged entries',
        ],
      },
    ],
  },
  {
    label: 'Announcements',
    icon: Megaphone,
    tools: [
      {
        icon: Megaphone,
        name: 'send_announcement',
        description: 'Broadcast a message to all guests, all staff, or the whole event.',
        examples: [
          'Send an announcement: doors open in 10 minutes',
          'Tell staff: entrance is now at Gate B',
          'Announce to everyone: dinner service begins at 7:30 PM',
        ],
      },
      {
        icon: Megaphone,
        name: 'get_announcements',
        description: 'Retrieve all past announcements in reverse chronological order.',
        examples: [
          'Show me all announcements',
          'What was the last thing announced?',
        ],
      },
    ],
  },
  {
    label: 'RSVP',
    icon: CheckCircle2,
    tools: [
      {
        icon: CheckCircle2,
        name: 'get_rsvp_settings',
        description: 'View the current RSVP page configuration — cutoff, max guests, message, questions.',
        examples: [
          'What are the RSVP settings?',
          'Is RSVP open or closed?',
          'What is the RSVP deadline?',
        ],
      },
      {
        icon: RefreshCw,
        name: 'update_rsvp_settings',
        description: 'Change RSVP cutoff date, max guests, custom message, plus-one policy, or custom questions.',
        examples: [
          'Set the RSVP deadline to June 30th',
          'Close RSVP now',
          'Allow plus-ones on the RSVP page',
          'Add a custom RSVP question: Dietary restrictions?',
        ],
      },
      {
        icon: BarChart3,
        name: 'get_rsvp_responses',
        description: 'View confirmed, declined, and maybe RSVP responses.',
        examples: [
          'How many RSVPs have been confirmed?',
          'Show me who declined',
          'What is the current RSVP breakdown?',
        ],
      },
    ],
  },
  {
    label: 'Table Service',
    icon: LayoutGrid,
    tools: [
      {
        icon: Clock,
        name: 'get_waitlist',
        description: 'View the current walk-in waitlist with party names, sizes, and positions.',
        examples: [
          'Who is on the waitlist?',
          'How many parties are waiting?',
        ],
      },
      {
        icon: Clock,
        name: 'add_to_waitlist',
        description: 'Add a walk-in party to the waitlist with name, size, and optional phone number.',
        examples: [
          'Add the Johnson party, 4 people, to the waitlist',
          'Walk-in: Martinez, party of 2',
        ],
      },
      {
        icon: Clock,
        name: 'seat_from_waitlist',
        description: 'Seat a waiting party at a specific table and remove them from the waitlist.',
        examples: [
          'Seat the Johnson party at Table 7',
          'Move the first waitlist party to Table 3',
        ],
      },
      {
        icon: LayoutGrid,
        name: 'get_table_occupancy',
        description: 'Live floor status — every table with its current party, size, server, and status.',
        examples: [
          'What tables are available right now?',
          'Show me the full floor status',
          'Which tables are being cleaned?',
        ],
      },
      {
        icon: RefreshCw,
        name: 'update_table_status',
        description: 'Set a table to available, occupied, reserved, or cleaning.',
        examples: [
          'Mark Table 5 as cleaning',
          'Set Table 2 to available',
          'Table 8 is now occupied',
        ],
      },
    ],
  },
  {
    label: 'Budget, Tasks & Polls',
    icon: DollarSign,
    tools: [
      {
        icon: DollarSign,
        name: 'get_budget',
        description: 'View total budget, total spent, remaining amount, and a full expense breakdown by category.',
        examples: [
          'What is the current budget situation?',
          'How much have we spent on catering?',
          'Show me all expenses',
        ],
      },
      {
        icon: DollarSign,
        name: 'update_budget',
        description: 'Add an expense entry to the shared ledger with a category, amount, and optional notes.',
        examples: [
          'Add a catering expense of $2,400 with note: deposit paid',
          'Log $800 for AV equipment',
        ],
      },
      {
        icon: List,
        name: 'get_tasks',
        description: 'List all planning tasks, optionally filtered by pending or complete.',
        examples: [
          'Show me all tasks',
          'What tasks are still pending?',
          'What has been completed?',
        ],
      },
      {
        icon: List,
        name: 'add_task',
        description: 'Create a new planning task with a title, optional due date, and optional assignee.',
        examples: [
          'Add a task: confirm AV setup, due Friday',
          'Create a task for Tom: order floral centrepieces by June 20th',
        ],
      },
      {
        icon: CheckCircle2,
        name: 'complete_task',
        description: 'Mark a task as complete.',
        examples: [
          'Mark the AV setup task as done',
          'Complete task ID ...',
        ],
      },
      {
        icon: BarChart3,
        name: 'create_poll',
        description: 'Create a live poll with a question and at least 2 options for your event team.',
        examples: [
          'Create a poll: preferred menu? Options: steak, chicken, vegetarian',
          'Poll: event theme — gold & black, blue & white, or no theme?',
        ],
      },
      {
        icon: BarChart3,
        name: 'get_poll_results',
        description: 'Get results for a specific poll with vote counts and percentages.',
        examples: [
          'What are the results of the menu poll?',
          'Show me how the theme poll is going',
        ],
      },
    ],
  },
];

/* ─── FAQ DATA ───────────────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Do I need a PlanIt account to use the Claude integration?',
    a: 'No. PlanIt has no accounts. Claude can create a brand new event for you directly, or you can connect an existing event using its Event ID and organizer password. There is nothing to register or sign up for.',
  },
  {
    q: 'Do I need a paid Claude subscription?',
    a: 'You need a Claude.ai account. The free tier works, but Claude Pro gives you more messages per day and access to more capable models, which is helpful for complex event management tasks like seating 200 guests or managing a busy check-in.',
  },
  {
    q: 'How long does Claude\'s access to my event last?',
    a: 'The session expires automatically 7 days after your event date — the same time your event data is permanently deleted. You can also invalidate the current session at any time by asking Claude for a new connection link, which immediately revokes the previous one.',
  },
  {
    q: 'Is my event data secure when Claude accesses it?',
    a: 'Yes. Claude\'s session is scoped to exactly one event at a time using a signed JWT stored in Redis. It has no access to any other event or any part of PlanIt\'s database outside your event. All communication is HTTPS and the session token is validated on every request.',
  },
  {
    q: 'The connection link says "Invalid link" or "Connection failed" — what do I do?',
    a: 'The one-time link expires after 10 minutes and can only be used once. If it expired or was already used, go back to Claude and say "Give me a new connection link" to generate a fresh one.',
  },
  {
    q: 'Can more than one person use Claude with my event at the same time?',
    a: 'Only one active Claude session is supported per event at a time. Generating a new connection link immediately invalidates the previous session. If two people need simultaneous Claude access, they would need to take turns reconnecting.',
  },
  {
    q: 'Can Claude create events without me connecting first?',
    a: 'Yes — create_event is one of the few tools that works without a prior session. Just tell Claude to create an event and provide the details. Once created, Claude will return an Event ID you can use to connect for future management.',
  },
  {
    q: 'What is MCP?',
    a: 'MCP stands for Model Context Protocol — an open standard that lets AI assistants like Claude connect to external tools and data sources. PlanIt runs an MCP server at https://planit-mcp.onrender.com/mcp that Claude connects to, giving it the ability to read and write data in your event.',
    links: [
      { label: 'Anthropic: What is MCP?', href: 'https://claude.com/blog/what-is-model-context-protocol' },
    ],
  },
  {
    q: 'Why is the connector not in the official Claude connector directory?',
    a: 'PlanIt is working toward official listing. In the meantime you can install it as a custom connector using the MCP server URL. Custom connectors work identically to listed ones — you just install them manually rather than from the directory.',
    links: [
      { label: 'Anthropic: Custom connectors guide', href: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp' },
      { label: 'Anthropic: Connectors Directory submission', href: 'https://claude.com/docs/connectors/building/submission' },
    ],
  },
  {
    q: 'What happens if the MCP server is down?',
    a: 'If planit-mcp.onrender.com is unavailable, Claude will fail to connect and will tell you so. Check planitapp.onrender.com/status for live platform health. The MCP server is monitored by the same watchdog that covers the main backend.',
  },
];

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────────── */

export default function ClaudeDocs() {
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState(null);

  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <style>{`html { scroll-behavior: smooth; } body { background: #f8f8f6; }`}</style>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-neutral-300">|</span>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-bold text-neutral-900">Claude Integration Docs</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <a
              href="/help#claude-integration"
              className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              Help Center
            </a>
            <span className="text-neutral-200">·</span>
            <a
              href="/status"
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Status
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Hero ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full text-xs font-semibold text-neutral-300 mb-5">
            <Bot className="w-3.5 h-3.5" />
            PlanIt for Claude
          </div>
          <h1 className="text-4xl font-black text-neutral-900 mb-3 tracking-tight">
            Manage your event through Claude
          </h1>
          <p className="text-base text-neutral-500 max-w-xl mx-auto mb-8 leading-relaxed">
            PlanIt's Claude integration lets you create events, manage guests, run check-in, assign seating,
            send announcements, and more — all by having a conversation with Claude.
            No account required.
          </p>
          <a
            href={CONNECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white text-sm font-bold rounded-2xl hover:bg-neutral-700 transition-colors"
          >
            <Plug className="w-4 h-4" />
            Add PlanIt to Claude
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-12">
          {[
            { label: 'Getting started', href: '#setup' },
            { label: 'All tools', href: '#tools' },
            { label: 'Authentication', href: '#auth' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Anthropic docs', href: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp', external: true },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 transition-all text-center"
            >
              {link.label}
              {link.external && <ExternalLink className="w-3 h-3 opacity-50" />}
            </a>
          ))}
        </div>

        {/* ── Setup ── */}
        <section id="setup">
          <SectionHeading icon={Plug}>Getting started</SectionHeading>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8">
            <Step n={1} title="Add PlanIt to Claude">
              <p>
                The quickest way is the pre-filled link below — it opens the custom connector form with the name and MCP URL already filled in.
              </p>
              <a
                href={CONNECT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-900 underline underline-offset-2 mt-1"
              >
                Open pre-filled connector form
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="mt-3">
                Or add it manually. In Claude, go to <strong>Settings → Connectors → Add custom connector</strong> and enter:
              </p>
              <div className="mt-1 space-y-1.5">
                <div>
                  <p className="text-xs font-bold text-neutral-500 mb-1">Connector name</p>
                  <CopyBox value="PlanIt" />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-500 mb-1">Remote MCP server URL</p>
                  <CopyBox value={MCP_URL} />
                </div>
              </div>
              <p className="mt-2 text-neutral-500">Save. This installs the PlanIt tools in Claude. It does not connect a specific event yet.</p>
            </Step>

            <Step n={2} title='Tell Claude to connect your event'>
              <p>
                Open a new Claude conversation and say:
              </p>
              <div className="bg-neutral-50 rounded-xl px-4 py-3 mt-1 text-xs font-mono text-neutral-700 border border-neutral-200">
                "Connect my PlanIt event"
              </div>
              <p className="mt-2 text-neutral-500">
                Claude will call the PlanIt connector and return a one-time connection link.
                Click that link to open the PlanIt connect page.
              </p>
            </Step>

            <Step n={3} title="Enter your Event ID and Organizer Password">
              <p>
                On the connect page, enter two things:
              </p>
              <ul className="list-disc pl-4 mt-1 space-y-1 text-neutral-500">
                <li>
                  <strong className="text-neutral-700">Event ID</strong> — the slug in your event URL.
                  For <code className="text-xs bg-neutral-100 px-1 rounded">planitapp.onrender.com/e/summer-gala-2026</code>,
                  the Event ID is <code className="text-xs bg-neutral-100 px-1 rounded">summer-gala-2026</code>.
                </li>
                <li>
                  <strong className="text-neutral-700">Organizer Password</strong> — the account password you set when creating the event.
                </li>
              </ul>
              <p className="mt-2 text-neutral-500">Click Connect. Claude is now authorized for that event.</p>

              <Callout variant="warning">
                The connection link expires after <strong>10 minutes</strong> and can only be used once.
                If it expires, ask Claude for a new link: "Give me a new connection link."
              </Callout>
            </Step>

            <Step n={4} title="Start managing your event">
              <p>
                Return to Claude and ask for what you need. Start with a read-only check to confirm the connection is working:
              </p>
              <div className="bg-neutral-50 rounded-xl px-4 py-3 mt-1 text-xs font-mono text-neutral-700 border border-neutral-200">
                "Give me a status summary of my event"
              </div>
              <p className="mt-2 text-neutral-500">
                Then move to write actions like adding guests, sending announcements, or updating seating.
              </p>
            </Step>

            <Callout variant="tip">
              You can also ask Claude to <strong>create a brand new event</strong> without connecting first.
              Just say "Create a PlanIt event called [name] on [date]" and Claude will set one up and give you the Event ID.
            </Callout>
          </div>
        </section>

        {/* ── Authentication ── */}
        <section id="auth">
          <SectionHeading icon={Lock}>How authentication works</SectionHeading>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8 space-y-5">
            <p className="text-sm text-neutral-600 leading-relaxed">
              The PlanIt MCP uses a custom two-step token flow to issue Claude a scoped session,
              without needing OAuth or a full account system.
            </p>

            <div className="space-y-4">
              {[
                {
                  step: '1. Init',
                  detail: 'Claude calls POST /mcp/connect/init. PlanIt generates a one-time token (64 hex chars) stored in Redis with a 10-minute TTL and returns a connect URL.',
                },
                {
                  step: '2. Verify',
                  detail: 'You visit the connect URL, enter your Event ID and Organizer Password. PlanIt verifies the password against the bcrypt hash on the event, then burns the init token and issues a signed JWT scoped to that event.',
                },
                {
                  step: '3. Session',
                  detail: 'The JWT is stored in Redis under a session key. Claude passes the session ID on every subsequent request via the x-mcp-session-id header. PlanIt validates the JWT on each call.',
                },
                {
                  step: '4. Expiry',
                  detail: 'The session expires 7 days after the event date (or 30 days if no date is set, with a minimum of 1 hour). When it expires, Claude must reconnect.',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-20 flex-shrink-0">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{item.step}</span>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <Callout variant="info">
              All inter-service communication is HMAC-authenticated with replay protection.
              The MCP server verifies a shared secret on every inbound request before processing anything.
            </Callout>

            <div className="border border-neutral-100 rounded-xl p-4 bg-neutral-50">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Rate limits</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600">
                <div className="flex justify-between"><span>Init requests</span><span className="font-mono text-neutral-800">10 / IP / hour</span></div>
                <div className="flex justify-between"><span>Verify attempts per event</span><span className="font-mono text-neutral-800">3 / 15 min</span></div>
                <div className="flex justify-between"><span>Verify attempts per IP</span><span className="font-mono text-neutral-800">5 / 15 min</span></div>
                <div className="flex justify-between"><span>Action calls per session</span><span className="font-mono text-neutral-800">60 / min</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tools ── */}
        <section id="tools">
          <SectionHeading icon={Zap}>Available tools</SectionHeading>

          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            PlanIt exposes {TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0)} tools to Claude across{' '}
            {TOOL_GROUPS.length} categories. Click any tool to see example prompts.
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveGroup(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                activeGroup === null
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'
              }`}
            >
              All
            </button>
            {TOOL_GROUPS.map(g => (
              <button
                key={g.label}
                onClick={() => setActiveGroup(g.label === activeGroup ? null : g.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  activeGroup === g.label
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {TOOL_GROUPS
              .filter(g => activeGroup === null || g.label === activeGroup)
              .map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <group.icon className="w-4 h-4 text-neutral-400" />
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{group.label}</p>
                    <span className="text-xs text-neutral-300">({group.tools.length} tools)</span>
                  </div>
                  <div className="space-y-2">
                    {group.tools.map(tool => (
                      <ToolCard key={tool.name} {...tool} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* ── Example conversation ── */}
        <section id="examples" className="mt-12">
          <SectionHeading icon={Star}>Example conversation</SectionHeading>

          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-100 bg-neutral-50">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Sample session</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { role: 'user', text: 'Connect my PlanIt event' },
                { role: 'assistant', text: 'I\'ll connect to your PlanIt event now. Click the link below to authenticate — it expires in 10 minutes:\n\nhttps://planitapp.onrender.com/claude-connect?token=...' },
                { role: 'user', text: '[User completes the connect flow]\n\nHow many guests have been added and how many have checked in?' },
                { role: 'assistant', text: 'Your event "Summer Gala 2026" has 187 guests on the list. 94 have checked in so far — that\'s 50%. 93 are still pending.' },
                { role: 'user', text: 'Add Sarah Chen, sarah@example.com, assign her to Table 4' },
                { role: 'assistant', text: 'Done. Sarah Chen has been added to the guest list and assigned to Table 4. Her personal invite link is ready.' },
                { role: 'user', text: 'Send an announcement: doors open in 10 minutes, please make your way to the venue entrance' },
                { role: 'assistant', text: 'Announcement sent to all guests and staff: "Doors open in 10 minutes, please make your way to the venue entrance."' },
              ].map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'justify-end'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-neutral-900 text-white rounded-tr-sm'
                      : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-neutral-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Troubleshooting ── */}
        <section id="troubleshooting" className="mt-12">
          <SectionHeading icon={AlertTriangle}>Common issues</SectionHeading>

          <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
            {[
              {
                problem: 'Claude says the PlanIt connector is unavailable',
                fix: 'Confirm the custom connector is enabled in Claude settings. Go to Settings → Connectors and check that PlanIt is toggled on. If you just added it, refresh the page or start a new conversation.',
              },
              {
                problem: '"Connection failed. Please check your details and try again."',
                fix: 'This means the Event ID or Organizer Password was incorrect. Double-check that the Event ID matches the slug in your event URL exactly (lowercase, hyphens). The Organizer Password is the account password you set when creating the event.',
              },
              {
                problem: '"Invalid link" on the connect page',
                fix: 'The one-time link expired (10 minute limit) or was already used. Go back to Claude and say "Give me a new connection link."',
              },
              {
                problem: '"Session not authenticated" error in Claude',
                fix: 'Your session expired or was revoked. Ask Claude to connect again: "Connect my PlanIt event." This generates a new link and starts a fresh session.',
              },
              {
                problem: 'Claude cannot find a tool or says a feature is unavailable',
                fix: 'Confirm the connector is enabled and you are connected to the right event. Some tools (like seating tools) require that your event has a seating map created first. Try "Get my event details" to confirm the connection is live.',
              },
              {
                problem: 'The MCP server is not responding',
                fix: 'Check planitapp.onrender.com/status for live platform health. The MCP server may be cold-starting — give it 30–60 seconds and try again. If the issue persists, contact planit.userhelp@gmail.com.',
              },
            ].map((item, i) => (
              <div key={i} className="p-5">
                <p className="text-sm font-bold text-neutral-900 mb-1.5">{item.problem}</p>
                <p className="text-sm text-neutral-600 leading-relaxed">{item.fix}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mt-12">
          <SectionHeading icon={Info}>FAQ</SectionHeading>
          <FAQ items={FAQS} />
        </section>

        {/* ── Support footer ── */}
        <div className="mt-12 rounded-3xl bg-neutral-900 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-black text-white mb-1">Need help with the integration?</h3>
            <p className="text-sm text-neutral-400">
              Email us or visit the Help Center — we respond within 48 business hours.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <a
              href="/help#claude-integration"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/20 transition-colors"
            >
              Help Center
            </a>
            <a
              href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/20 transition-colors"
            >
              Anthropic Docs <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
            <a
              href="mailto:planit.userhelp@gmail.com"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 transition-colors"
            >
              Email Support
            </a>
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-8 flex flex-wrap gap-4 text-xs text-neutral-400 justify-center">
          <a href="/" className="hover:text-neutral-700 transition-colors">Home</a>
          <a href="/help" className="hover:text-neutral-700 transition-colors">Help Center</a>
          <a href="/privacy" className="hover:text-neutral-700 transition-colors">Privacy Policy</a>
          <a href="/status" className="hover:text-neutral-700 transition-colors">Status</a>
          <a href="mailto:planit.userhelp@gmail.com" className="hover:text-neutral-700 transition-colors">Contact</a>
        </div>
      </div>
    </div>
  );
}
