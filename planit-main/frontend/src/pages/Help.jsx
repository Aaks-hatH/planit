import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { bugReportAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ChevronRight, ChevronDown, X,
  Calendar, Users, MessageSquare, BarChart3, FileText,
  Lock, Shield, QrCode, CheckCircle2, Megaphone, DollarSign,
  StickyNote, Share2, Clock, AlertTriangle, Zap, Wifi, WifiOff,
  RefreshCw, Server, Database, Bell, Activity, Settings,
  Mail, ExternalLink, HelpCircle, BookOpen, Star, Info,
  UserCheck, Key, Link, Download, Upload, Trash2, Eye,
  TrendingUp, Ban, Phone, CheckSquare, List, Hash,
  LifeBuoy, Cpu, Globe, Filter, ChevronUp, ArrowRight,
  LogOut, Copy, Navigation, Timer, PieChart, ClipboardList, Send, CheckCircle, Loader,
  MapPin, Volume2, Radio, Mic, UtensilsCrossed, LayoutGrid, ShieldAlert
} from 'lucide-react';

/* ─── DATA ─────────────────────────────────────────────────────────────────── */

const ARTICLES = [
  // ── GETTING STARTED ───────────────────────────────────────────────────────
  {
    id: 'gs-create',
    category: 'Getting Started',
    title: 'How to create your first event',
    icon: Calendar,
    tags: ['create', 'event', 'new', 'start', 'setup', 'first'],
    content: [
      {
        type: 'intro',
        text: 'Creating an event in PlanIt takes less than two minutes and requires no account or email address. Follow these steps to get your workspace up and running.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Go to the home page', body: 'Navigate to planitapp.onrender.com. You\'ll see the event creation form in the hero section. If you\'re already on the page, click "Get Started" or scroll down to the "Create your event" form.' },
          { title: 'Enter your event title', body: 'Type the name of your event. As you type, PlanIt automatically generates a URL slug from your title — you\'ll see it update live in the preview below the title field. For example, "Summer Retreat 2026" becomes "summer-retreat-2026-ab3f".' },
          { title: 'Set the date, time, and timezone', body: 'Pick the date and time your event starts. PlanIt automatically detects and pre-selects your browser\'s timezone, but you can change it to any timezone from the dropdown. This ensures the countdown and all timestamps display correctly for everyone.' },
          { title: 'Add a location (optional)', body: 'Type the venue address or name. This appears on the guest invite page and powers the "Get Directions" button that opens Google Maps. Leave it blank if your event is virtual or the location isn\'t set yet.' },
          { title: 'Customise your event URL (optional)', body: 'The slug field auto-fills from your title. You can edit it to anything you like — something shorter and easier to share by voice. Once you type in this field manually, auto-generation from the title stops so your custom value is never overwritten. If your chosen slug is taken, PlanIt tells you before you submit.' },
          { title: 'Set your account password', body: 'This is required. It\'s your organizer identity credential — the password you\'ll need to claim organizer access from any new browser or device. Store it somewhere safe. It cannot be reset or recovered, because PlanIt has no email on file to send a reset link to.' },
          { title: 'Set an event password (optional)', body: 'This gates entry to the workspace for everyone — guests, team members, and organizers. Anyone navigating to the event URL must enter this password. Use it if your event is confidential. If left blank, anyone with the link can join.' },
          { title: 'Choose Standard or Enterprise mode', body: 'Standard mode is for team planning without a formal guest list. Enterprise mode adds the full guest management and QR check-in system. You cannot change the mode after creation, so choose deliberately.' },
          { title: 'Click "Create Event"', body: 'PlanIt creates your workspace and drops you straight in. Your event link is shown in the workspace header and in the Share tab. Copy it and send it to your team.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'Write down your account password before you share the event link. If you share the link with your team and later forget the password, you cannot reclaim organizer access. There is no password recovery flow.'
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The event URL follows the format planitapp.onrender.com/e/your-slug. If you didn\'t set a custom slug, the fallback is planitapp.onrender.com/event/[database-id].'
      }
    ]
  },
  {
    id: 'gs-join',
    category: 'Getting Started',
    title: 'Joining an event workspace',
    icon: Users,
    tags: ['join', 'enter', 'workspace', 'participant', 'link', 'access', 'password'],
    content: [
      {
        type: 'intro',
        text: 'To join an event workspace you need the event link from the organizer. If the event has a password, you\'ll need that too.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the event link', body: 'Click or paste the link the organizer shared with you. It looks like planitapp.onrender.com/e/event-name or planitapp.onrender.com/event/[id].' },
          { title: 'Enter the event password (if required)', body: 'If the organizer set an event password, you\'ll see a password prompt before you can enter. Enter the password they gave you. This is separate from the organizer account password.' },
          { title: 'Choose a display name', body: 'Pick a username that your team will recognise you by. This name appears in the chat, on tasks you create or complete, in polls, and in the people list.' },
          { title: 'You\'re in', body: 'You\'ll land directly in the workspace. The chat tab opens by default. Use the tab bar to navigate between Chat, Polls, Files, Agenda, People, Tasks, Bulletin, Budget, Notes, Share, and (if it\'s an Enterprise event and you\'re the organizer) Analytics.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'If you close your browser and come back later, you\'ll need to re-enter the event link and your display name. Your session is stored in your browser\'s localStorage — it doesn\'t follow you to a different browser or device.'
      }
    ]
  },
  {
    id: 'gs-modes',
    category: 'Getting Started',
    title: 'Standard vs Enterprise vs Table Service mode',
    icon: Zap,
    tags: ['standard', 'enterprise', 'table service', 'mode', 'difference', 'guest', 'checkin', 'qr', 'restaurant', 'floor'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt has three modes. The mode is chosen at creation and cannot be changed afterward.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'Standard Mode',
            color: 'neutral',
            desc: 'Full planning workspace for your team. No guest list, no check-in system.',
            features: [
              'Chat, Tasks, Polls, Notes, Announcements',
              'Expense tracking and budget management',
              'File sharing and countdown timer',
              'Share / utilities panel',
              'Agenda and people list',
            ],
            best: 'Team offsites, internal workshops, planning retreats, virtual meetups'
          },
          {
            label: 'Enterprise Mode',
            color: 'indigo',
            desc: 'Everything in Standard, plus a complete guest management and check-in system.',
            features: [
              'All Standard features',
              'Guest list with per-guest invite links and QR codes',
              'RSVP tracking and personal organizer notes per guest',
              'Real-time check-in dashboard with QR scanner',
              'Multi-layer anti-fraud middleware',
              'Manager override for guests without phones',
              'Attendance analytics and arrival timeline',
            ],
            best: 'Weddings, galas, corporate dinners, conferences, award ceremonies'
          },
          {
            label: 'Table Service Mode',
            color: 'orange',
            desc: 'A live floor management system for restaurants and venues. No planning workspace — just the floor.',
            features: [
              'Visual floor plan with live table status colours',
              'Walk-in waitlist with estimated wait times',
              'QR code reservations with configurable expiry',
              'Per-table party details, server assignment, notes',
              'Occupancy overview and turn time estimation',
              'Data never auto-deleted — persists indefinitely',
            ],
            best: 'Restaurants, private dining rooms, bars, hospitality venues'
          }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'You cannot switch modes after creation. Table Service mode opens a completely different interface at /e/your-venue/floor — there is no planning workspace. If you need both event planning and floor management for the same occasion, create two separate venues.'
      }
    ]
  },
  {
    id: 'gs-organizer',
    category: 'Getting Started',
    title: 'Claiming and using organizer access',
    icon: Key,
    tags: ['organizer', 'admin', 'login', 'password', 'claim', 'role', 'access'],
    content: [
      {
        type: 'intro',
        text: 'The organizer role gives you elevated permissions in your event: posting announcements, managing the guest list, configuring settings, and more. Here\'s how to claim and use it.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Find the organizer login button', body: 'In the event workspace header, look for the shield icon or "Organizer Login" button. On mobile it may be in the overflow menu.' },
          { title: 'Enter your account password', body: 'Type the account password you set when you created the event. This is the credential that proves you\'re the organizer.' },
          { title: 'You\'re now an organizer', body: 'Your workspace gains additional controls: you can post announcements, manage the guest list (Enterprise mode), access analytics, configure workspace settings, and see the waitlist.' },
          { title: 'Organizer status persists per session', body: 'Your organizer status is stored in your browser session. If you close the tab and return, you\'ll need to log in again with your account password.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'If you forget your account password, there is no recovery option. PlanIt stores no email address and has no reset flow. The only resolution is to contact support — but recovery is not guaranteed. Always store your password somewhere safe before sharing your event link.'
      }
    ]
  },

  // ── PLANNING TOOLS ────────────────────────────────────────────────────────
  {
    id: 'tool-chat',
    category: 'Planning Tools',
    title: 'Using team chat',
    icon: MessageSquare,
    tags: ['chat', 'message', 'team', 'typing', 'realtime', 'history', 'communication'],
    content: [
      {
        type: 'intro',
        text: 'The Chat tab is the real-time messaging channel for your planning team. Messages are delivered in milliseconds and stored persistently for the lifetime of the event.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Chat tab', body: 'It\'s the first tab in the workspace tab bar, labelled "Chat" with a message bubble icon.' },
          { title: 'Type and send a message', body: 'Click the message input at the bottom of the chat panel and type your message. Press Enter or click the send button to send. Messages appear immediately for everyone currently in the workspace.' },
          { title: 'See who\'s typing', body: 'When another team member is composing a message, a typing indicator appears at the bottom of the chat showing their username. It disappears when they send or stop typing.' },
          { title: 'Scroll through history', body: 'All messages since the event was created are loaded when you open the chat. Scroll up to read older messages. Team members joining late can scroll back to catch up on everything that was discussed.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The chat rate limiter allows up to 30 messages per minute. If you hit this limit, you\'ll see a brief error. It resets automatically after a minute.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can I delete messages?', a: 'Organizers can delete messages. Participants can only delete their own messages.' },
          { q: 'Are messages private?', a: 'No — the chat is shared with everyone in the workspace. There is no direct messaging or private channel system.' },
          { q: 'Do messages disappear when I leave?', a: 'No — messages persist in the database for the lifetime of the event (7 days after the event date). They load for everyone when they open the chat.' }
        ]
      }
    ]
  },
  {
    id: 'tool-tasks',
    category: 'Planning Tools',
    title: 'Managing tasks',
    icon: CheckCircle2,
    tags: ['tasks', 'todo', 'assign', 'priority', 'complete', 'due date', 'checklist'],
    content: [
      {
        type: 'intro',
        text: 'The Tasks tab is a shared to-do list for your entire planning team. Any participant can create, assign, prioritise, and complete tasks.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Tasks tab', body: 'Click the "Tasks" tab in the workspace tab bar (checkmark icon).' },
          { title: 'Create a new task', body: 'Click the "+" or "Add task" button. Fill in a title (required), description (optional), assignee name (optional), due date (optional), and priority level.' },
          { title: 'Set a priority', body: 'Choose High (red), Medium (amber), or Low (blue). High-priority tasks sort to the top of the list automatically. This order is maintained live for everyone in the workspace.' },
          { title: 'Complete a task', body: 'Click the circle icon to the left of any task to toggle it complete or incomplete. Completed tasks move to the bottom of the list with a strikethrough style. This update is broadcast live to all connected team members.' },
          { title: 'Delete a task', body: 'Click the trash icon on a task card to delete it. The task is removed from the database immediately and disappears from all connected sessions.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Tasks count, completion rate, and pending count are shown at the top of the task panel. These update live as tasks are created and completed.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can only the organizer create tasks?', a: 'No — any participant in the workspace can create, complete, and delete tasks.' },
          { q: 'What happens to overdue tasks?', a: 'Tasks whose due date has passed and that are not yet complete are highlighted with an amber indicator to draw attention to them.' },
          { q: 'Can I assign a task to someone not in the workspace?', a: 'Yes — the assignee field is free text. You can type anyone\'s name, even if they\'re not a workspace participant (e.g. external vendors).' }
        ]
      }
    ]
  },
  {
    id: 'tool-polls',
    category: 'Planning Tools',
    title: 'Creating and voting on polls',
    icon: BarChart3,
    tags: ['poll', 'vote', 'voting', 'decision', 'options', 'results', 'tally'],
    content: [
      {
        type: 'intro',
        text: 'The Polls tab lets your team make group decisions in real time. Anyone can create a poll, and votes update live for all connected participants.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Polls tab', body: 'Click the "Polls" tab in the workspace tab bar (bar chart icon).' },
          { title: 'Create a poll', body: 'Click "New Poll". Enter your question and between 2 and 10 options. Click "Create" to publish the poll to the workspace immediately.' },
          { title: 'Cast a vote', body: 'Click any option in an active poll to cast your vote. Your vote is attributed to your session username. You cannot vote twice on the same poll.' },
          { title: 'Watch live results', body: 'Vote counts update in real time on every participant\'s screen as votes come in. You can watch the results change live without refreshing.' },
          { title: 'Review past polls', body: 'All polls remain visible in the panel, most recent first, for the lifetime of the event.' }
        ]
      },
      {
        type: 'faq',
        items: [
          { q: 'Can I change my vote?', a: 'No — votes are final once cast. There is no vote-change mechanism.' },
          { q: 'Can I delete a poll?', a: 'Organizers can delete any poll. Participants cannot delete polls they didn\'t create.' },
          { q: 'How many options can a poll have?', a: 'Between 2 and 10 options.' }
        ]
      }
    ]
  },
  {
    id: 'tool-notes',
    category: 'Planning Tools',
    title: 'Using color-coded notes',
    icon: StickyNote,
    tags: ['notes', 'sticky', 'color', 'write', 'shared', 'scratchpad', 'cards'],
    content: [
      {
        type: 'intro',
        text: 'The Notes tab is a shared scratchpad for your team, styled as a grid of color-coded sticky notes. Unlike chat, notes are persistent, structured pieces of content designed to be revisited.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Notes tab', body: 'Click "Notes" in the workspace tab bar (sticky note icon).' },
          { title: 'Create a note', body: 'Click "Add Note". Enter a title and body text, then choose one of seven background colors: yellow, blue, red, green, purple, orange, or pink. Click Save.' },
          { title: 'Edit a note', body: 'Click the edit (pencil) icon on any note card. The creation form opens pre-filled with the current content. Save to update — the change broadcasts to all connected sessions.' },
          { title: 'Delete a note', body: 'Click the trash icon on a note card. A confirmation dialog appears before the note is permanently removed.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Your team can develop informal conventions around colors — for example: yellow for open decisions, green for confirmed items, red for blockers. PlanIt doesn\'t enforce any meaning on the colors, but consistency makes the notes board much easier to scan at a glance.'
      }
    ]
  },
  {
    id: 'tool-announcements',
    category: 'Planning Tools',
    title: 'Posting announcements',
    icon: Megaphone,
    tags: ['announcement', 'bulletin', 'broadcast', 'important', 'notify', 'organizer', 'post'],
    content: [
      {
        type: 'intro',
        text: 'The Bulletin tab is a one-way broadcast channel from the organizer to the rest of the team. Only organizers can post announcements, but all participants can read them.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Bulletin tab', body: 'Click "Bulletin" in the workspace tab bar (megaphone icon). You\'ll need to be logged in as an organizer to see the post button.' },
          { title: 'Post an announcement', body: 'Click "New Announcement". Type your message. Check the "Important" checkbox if this requires immediate attention from the team.' },
          { title: 'Mark as important', body: 'Important announcements are displayed with red-bordered alert styling in the list. Every connected team member receives a toast notification at the top of their screen regardless of which tab they\'re currently viewing.' },
          { title: 'View announcement history', body: 'All announcements stay in the panel after posting, sorted most-recent-first. Team members who were offline when an announcement was made will see it when they join the workspace.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Use announcements for information everyone needs to see and act on — venue changes, schedule shifts, emergency communications. Use the chat for discussion. Keeping the two channels separate ensures important messages don\'t get buried in conversation.'
      }
    ]
  },
  {
    id: 'tool-expenses',
    category: 'Planning Tools',
    title: 'Tracking expenses and budget',
    icon: DollarSign,
    tags: ['expense', 'budget', 'cost', 'money', 'track', 'finance', 'spend', 'category'],
    content: [
      {
        type: 'intro',
        text: 'The Budget tab is a shared ledger for logging costs as they\'re incurred and comparing total spending against a target budget.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Budget tab', body: 'Click "Budget" in the workspace tab bar (dollar sign icon).' },
          { title: 'Set a budget (organizer only)', body: 'Click "Set Budget" and enter the total amount you want to spend. Once set, the panel shows total spent vs budget and a remaining amount that turns red when you go over.' },
          { title: 'Log an expense', body: 'Click "Add Expense". Enter a title, amount, category (e.g. Venue, Catering, AV), who paid it, and any notes. Click Save. The entry appears immediately for all connected team members.' },
          { title: 'Review the breakdown', body: 'The category summary shows exactly where money is going without any extra configuration — it derives automatically from the category labels you use.' },
          { title: 'Delete an expense', body: 'Click the trash icon on any expense entry. The total and breakdown update live.' }
        ]
      },
      {
        type: 'faq',
        items: [
          { q: 'Can anyone log expenses or just the organizer?', a: 'Any participant in the workspace can log expenses. Only the organizer can set or change the budget.' },
          { q: 'Are amounts in USD?', a: 'The expense tracker stores amounts as numbers without enforcing a currency. Treat all amounts as whatever currency your event is budgeted in — it\'s a shared ledger, not a payment system.' }
        ]
      }
    ]
  },
  {
    id: 'tool-files',
    category: 'Planning Tools',
    title: 'Sharing files',
    icon: FileText,
    tags: ['file', 'upload', 'download', 'share', 'attachment', 'document', 'pdf', 'image'],
    content: [
      {
        type: 'intro',
        text: 'The Files tab lets your team upload and download documents, images, and other files directly inside the workspace — no external file sharing service required.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Files tab', body: 'Click "Files" in the workspace tab bar (document icon).' },
          { title: 'Upload a file', body: 'Click "Upload File" or drag and drop a file onto the panel. Files are stored on Cloudinary and become immediately downloadable by all participants.' },
          { title: 'Download a file', body: 'Click the download icon next to any file in the list. The file downloads directly to your device.' },
          { title: 'Delete a file', body: 'Click the trash icon next to a file. Deletion removes it from storage and from the file list for all connected sessions.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'Files are limited to 20 uploads per hour per IP address. All files are permanently deleted 7 days after the event date along with all other event data. Download anything you need to keep before that window closes.'
      }
    ]
  },
  {
    id: 'tool-countdown',
    category: 'Planning Tools',
    title: 'Countdown timer',
    icon: Timer,
    tags: ['countdown', 'timer', 'time', 'days', 'hours', 'minutes', 'live', 'clock'],
    content: [
      {
        type: 'intro',
        text: 'The workspace includes a live countdown clock that counts down to your event\'s date and time, updated every second.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Find the countdown', body: 'The countdown is visible in the event workspace header and as a card in the workspace area, showing days, hours, minutes, and seconds remaining.' },
          { title: 'Event goes live', body: 'When the current time passes the event\'s scheduled start, the countdown transitions automatically to a green "Event is Live!" state. No manual action needed — it updates on every connected session simultaneously.' },
          { title: 'Timezone accuracy', body: 'The countdown accounts for the timezone you set at event creation. Team members in different timezones all see the correct remaining time because the calculation uses the absolute UTC timestamp, not a local interpretation.' }
        ]
      }
    ]
  },
  {
    id: 'tool-agenda',
    category: 'Planning Tools',
    title: 'Managing the agenda',
    icon: List,
    tags: ['agenda', 'schedule', 'itinerary', 'timeline', 'session', 'slot'],
    content: [
      {
        type: 'intro',
        text: 'The Agenda tab lets you build a structured run-of-show for your event — individual time slots, sessions, or items with times and descriptions.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Agenda tab', body: 'Click "Agenda" in the workspace tab bar (clock icon).' },
          { title: 'Add an agenda item', body: 'Click "Add Item". Enter a title, start time, end time, and optional description or speaker name.' },
          { title: 'Reorder or edit items', body: 'Click the edit icon on any item to update it. Items are displayed in chronological order by start time.' },
          { title: 'Share the agenda', body: 'The agenda is visible to all workspace participants. Guests in Enterprise mode can also see a read-only version from their invite page.' }
        ]
      }
    ]
  },
  {
    id: 'tool-utilities',
    category: 'Planning Tools',
    title: 'Using the Share / utilities panel',
    icon: Share2,
    tags: ['share', 'utilities', 'qr code', 'calendar', 'export', 'link', 'copy', 'ics'],
    content: [
      {
        type: 'intro',
        text: 'The Share tab (also called the utilities panel) consolidates tools for sharing the event, exporting data, and accessing the check-in system from one place.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Copy the event link', body: 'The event URL is displayed in a read-only field. Click "Copy" to write it to your clipboard. The button briefly changes to a checkmark to confirm the copy worked.' },
          { title: 'Show the workspace QR code', body: 'Click "Show QR Code" to see a QR code encoding the event workspace URL. This is for getting team members into the workspace quickly by scanning — it\'s not the same as guest invite QR codes.' },
          { title: 'Export to calendar (.ics)', body: 'Click "Add to Calendar" to download an .ics file compatible with Apple Calendar, Google Calendar, Outlook, and any other app that accepts the iCalendar standard. The file includes the event title, date, time, location, and workspace URL.' },
          { title: 'Access the check-in dashboard', body: 'For Enterprise mode events, the Share panel includes a direct button to the check-in dashboard.' }
        ]
      }
    ]
  },

  // ── ENTERPRISE & CHECK-IN ─────────────────────────────────────────────────
  {
    id: 'ent-guests',
    category: 'Enterprise & Check-in',
    title: 'Adding guests and sending invites',
    icon: UserCheck,
    tags: ['guest', 'invite', 'add', 'enterprise', 'email', 'qr', 'link', 'rsvp'],
    content: [
      {
        type: 'intro',
        text: 'In Enterprise mode, the check-in dashboard lets you build a guest list with individual invite links and QR codes for each guest.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the check-in dashboard', body: 'Click "Check-in" in the workspace header, or use the button in the Share tab. You need to be logged in as organizer.' },
          { title: 'Add a guest', body: 'Click "Add Guest". Enter their name, email address, party size (adults and children tracked separately), table assignment, dietary notes, and an optional personal note. The personal note appears highlighted in amber on their invite page.' },
          { title: 'Copy and send the invite link', body: 'Each guest gets a unique, personal invite URL. Click the copy icon next to their name to copy it. Send it to them via email, WhatsApp, or any other method you prefer. PlanIt does not send invites automatically — you distribute them yourself.' },
          { title: 'Track RSVPs', body: 'The dashboard shows which guests have viewed their invite page. You can see RSVP status and filter the guest list accordingly.' },
          { title: 'Edit guest details', body: 'Click the edit icon on any guest record to update their name, party size, table, notes, or email at any time before the event.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Each invite link is unique and personal — it is tied to that one guest\'s record. Forwarding an invite link to someone else does not give them a new identity. The name and details on the invite page belong to the original guest.'
      }
    ]
  },
  {
    id: 'ent-checkin',
    category: 'Enterprise & Check-in',
    title: 'Running check-in on event day',
    icon: QrCode,
    tags: ['checkin', 'check-in', 'scan', 'qr', 'admit', 'deny', 'event day', 'door', 'entrance'],
    content: [
      {
        type: 'intro',
        text: 'The check-in screen is used by door staff to scan guest QR codes and admit or deny entry. It\'s designed for speed — the full scan-to-decision flow takes under 5 seconds.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the check-in dashboard on staff devices', body: 'Have every staff member open the check-in dashboard on their phone or tablet. They\'ll need the event link and the organizer password to access the dashboard.' },
          { title: 'Tap "Scan QR Code"', body: 'The camera opens. Point it at the guest\'s QR code on their phone or printed ticket. The scan validates instantly against the server.' },
          { title: 'Review the result screen', body: 'You\'ll see the guest\'s name, party size, table assignment, and any special notes from the organizer. Any anti-fraud warnings appear here too.' },
          { title: 'Tap Admit or Deny', body: 'Admit marks the guest as checked in, records the timestamp, and increments the live attendance counter visible to all staff and the organizer. Deny returns to the ready state without recording check-in.' },
          { title: 'Already admitted guests', body: 'If a QR code is scanned for a guest who is already admitted, the screen shows an "already checked in" state with the original admission timestamp. This catches duplicated or forwarded QR codes.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The attendance count on the dashboard is live — every staff device sees the same number in real time. The organizer can also monitor check-in progress remotely from any device.'
      }
    ]
  },
  {
    id: 'ent-antifraud',
    category: 'Enterprise & Check-in',
    title: 'Anti-fraud system explained',
    icon: Shield,
    tags: ['antifraud', 'fraud', 'security', 'trust score', 'block', 'suspicious', 'duplicate', 'fingerprint'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt\'s anti-fraud middleware runs automatically on every check-in attempt in Enterprise mode. Here\'s what each layer does and what you\'ll see as a staff member.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Duplicate detection', body: 'Compares each invite\'s fingerprint against all other invites in the event. If a matching fingerprint is found already checked in, the staff member sees a warning. With autoBlockDuplicates enabled, the check-in is refused automatically.' },
          { title: 'Reentrancy protection', body: 'Prevents two staff members from simultaneously processing the same QR code. The first scan gets an exclusive lock; the second receives a conflict response immediately. This prevents race conditions at busy entrances.' },
          { title: 'Suspicious pattern detection', body: 'Tracks rapid repeated scans of the same code (3+ scans within 10 seconds) and multiple device locations scanning the same code. Flags are displayed as warnings on the check-in result screen.' },
          { title: 'Trust score', body: 'Each invite has a trust score starting at 100. Security events (duplicates, rapid scans, multiple devices) reduce the score. Organizers can configure a minimum score threshold; invites below it can be auto-blocked or flagged for review.' },
          { title: 'Time window enforcement', body: 'By default, check-in accepts scans in a window from 2 hours before the event to 30 minutes after it starts. Scans outside this window are refused with a message explaining when the window opens or closed.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Anti-fraud warnings do NOT automatically block admission unless the specific auto-block setting is enabled. The warning gives the staff member information to make a judgment call — you always retain the final decision.'
      }
    ]
  },
  {
    id: 'ent-override',
    category: 'Enterprise & Check-in',
    title: 'Manager override: checking in guests without a QR code',
    icon: Key,
    tags: ['override', 'manager', 'manual', 'no phone', 'no qr', 'lost', 'battery', 'search'],
    content: [
      {
        type: 'intro',
        text: 'When a guest arrives without their QR code — dead battery, no signal, lost the email — the manager override lets you check them in manually by searching the guest list.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Find the override option', body: 'On the check-in dashboard, look for the "Manager Override" or "Manual Check-in" button.' },
          { title: 'Enter the organizer password', body: 'The override requires authentication with the event\'s account (organizer) password. This prevents staff from bypassing the QR system without authorization.' },
          { title: 'Search for the guest', body: 'Type the guest\'s name in the search field. The matching records appear. Select the correct guest.' },
          { title: 'Confirm the override', body: 'Tap Admit. The check-in is recorded with a "manual override" flag and the staff member\'s attribution, identical to a QR scan but traceable as a manual entry.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Override check-ins appear in the audit log with a manual override flag. They count identically toward attendance and are fully traceable.'
      }
    ]
  },

  // ── SECURITY & PASSWORDS ──────────────────────────────────────────────────
  {
    id: 'sec-passwords',
    category: 'Security & Passwords',
    title: 'Understanding the two-password system',
    icon: Lock,
    tags: ['password', 'account password', 'event password', 'security', 'credentials', 'two passwords'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt uses two completely separate passwords that serve different purposes. Confusing them is the most common source of access problems.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'Account Password',
            color: 'neutral',
            desc: 'Your organizer identity credential.',
            features: [
              'Required when creating the event',
              'Proves you are the organizer',
              'Needed to claim organizer role from any new browser/device',
              'Needed for manager override in Enterprise mode',
              'Cannot be reset or recovered',
              'Hashed with bcrypt — not stored in readable form',
            ],
            best: 'Store this somewhere you can always access it — a password manager, a note, anywhere secure.'
          },
          {
            label: 'Event Password',
            color: 'neutral',
            desc: 'Optional gate to the workspace for everyone.',
            features: [
              'Optional — set at event creation',
              'Required by all visitors before entering the workspace',
              'Share with your entire planning team',
              'Cannot be changed after creation',
              'Hashed and stored separately from account password',
            ],
            best: 'Use this when your event is confidential and you don\'t want anyone who finds the link to enter the workspace.'
          }
        ]
      }
    ]
  },
  {
    id: 'sec-jwt',
    category: 'Security & Passwords',
    title: 'Sessions, tokens, and device access',
    icon: Shield,
    tags: ['session', 'jwt', 'token', 'browser', 'device', 'logout', 'localStorage'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt uses JWTs (JSON Web Tokens) stored in your browser\'s localStorage to manage your session. Understanding how this works prevents confusion when switching devices.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Your session is browser-local', body: 'When you authenticate, the server issues a signed JWT that lives in your browser\'s localStorage. It\'s tied to that specific browser on that specific device.' },
          { title: 'Switching devices', body: 'Opening the event link on a different device or browser starts a fresh session. You\'ll need to enter your display name and any event password again. Organizers need to re-enter their account password to reclaim organizer status.' },
          { title: 'Clearing browser data', body: 'Clearing localStorage or browser history removes your session token. The next visit to the event link starts fresh.' },
          { title: 'Logging out', body: 'Click the logout icon (door with arrow) in the workspace header to manually clear your session and return to the home page.' }
        ]
      }
    ]
  },

  // ── DATA & PRIVACY ────────────────────────────────────────────────────────
  {
    id: 'data-retention',
    category: 'Data & Privacy',
    title: 'Data retention: the 7-day deletion policy',
    icon: Trash2,
    tags: ['delete', 'deletion', 'data', 'retention', '7 days', 'export', 'backup', 'cleanup', 'table service'],
    content: [
      {
        type: 'intro',
        text: 'All event data is permanently deleted 7 days after the event\'s scheduled date. This policy applies to Standard and Enterprise events. Table Service venues are permanently exempt.'
      },
      {
        type: 'steps',
        items: [
          { title: 'What gets deleted', body: 'The event record, all messages, tasks, polls, notes, announcements, expenses, files, participant records, guest invitation records, check-in logs, and analytics data. Everything. Permanently.' },
          { title: 'When the deletion warning appears', body: 'As your event approaches the 7-day deletion window, a persistent amber warning banner appears at the top of every workspace page showing days remaining.' },
          { title: 'How to export before deletion', body: 'Use the Share tab: download the .ics calendar file, export the participant list, save any files from the Files tab. For analytics, take screenshots or note the key numbers before they\'re gone.' },
          { title: 'Early deletion', body: 'If you want your event data deleted before 7 days, email planit.userhelp@gmail.com with your event link. We\'ll process it manually.' },
          { title: 'Table Service mode exception', body: 'Venues created in Table Service mode are never auto-deleted. The cleanup job skips them entirely. Your floor layout, reservation history, table states, and settings persist until you choose to delete the venue yourself. This is intentional — a restaurant cannot have its floor plan wiped on a schedule.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'There is NO recovery after deletion. The data is gone permanently. If you need records beyond 7 days, download or export them before the deletion date. This does NOT apply to Table Service venues, which are never automatically deleted.'
      }
    ]
  },
  {
    id: 'data-noAccount',
    category: 'Data & Privacy',
    title: 'No-account model: what it means for you',
    icon: Eye,
    tags: ['no account', 'privacy', 'anonymous', 'register', 'email', 'identity'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt requires no email address, no registration, and no account. This is deliberate — but it comes with tradeoffs you should understand.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'The benefits',
            color: 'neutral',
            desc: 'Why no account works in your favour:',
            features: [
              'Start planning in under 2 minutes with no setup friction',
              'No personal data tied to your identity on PlanIt\'s servers',
              'No email address to protect or worry about',
              'No profile page, no tracking across events',
            ],
            best: ''
          },
          {
            label: 'The tradeoffs',
            color: 'neutral',
            desc: 'What you give up without an account:',
            features: [
              'No password reset — if you forget, it\'s gone',
              'Sessions don\'t sync across devices',
              'No persistent history after 7 days',
              'The event link is effectively the key — protect it',
            ],
            best: ''
          }
        ]
      }
    ]
  },

  // ── ERRORS & TROUBLESHOOTING ──────────────────────────────────────────────
  {
    id: 'err-loading',
    category: 'Errors & Troubleshooting',
    title: 'Event won\'t load / blank workspace',
    icon: AlertTriangle,
    tags: ['loading', 'blank', 'not loading', 'spinner', 'stuck', 'white screen', 'error loading'],
    content: [
      {
        type: 'intro',
        text: 'If the workspace is stuck on a loading spinner or you see a blank screen, work through these steps in order.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Hard refresh the page', body: 'Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to force a full reload bypassing cache. Wait 10–15 seconds for the backend to respond, especially if the server was recently restarted.' },
          { title: 'Check the status page', body: 'Go to planitapp.onrender.com/status to see if there\'s a known incident or outage. If a backend is marked as degraded or down, that\'s why the workspace isn\'t loading.' },
          { title: 'Wait for cold-start', body: 'PlanIt runs on Render\'s free tier. Servers spin down after 15 minutes of inactivity and take 30–60 seconds to cold-start. If the first load is slow, wait a minute and try again.' },
          { title: 'Check your event link', body: 'Make sure the URL is correct. An incorrect slug or event ID will show a "not found" error. The correct format is planitapp.onrender.com/e/your-slug or planitapp.onrender.com/event/[id].' },
          { title: 'Try a different browser', body: 'If the issue persists on one browser, try Chrome, Firefox, or Safari. Clear localStorage on your current browser (DevTools → Application → Local Storage → Clear).' },
          { title: 'Still broken?', body: 'Email planit.userhelp@gmail.com with your event link, the browser you\'re using, and a screenshot of any error messages. We\'ll investigate.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Cold-start delays (30–60 second loading on first visit) are expected when the server has been idle. This is a known limitation of the free-tier hosting. Once the server is warm, subsequent loads are fast.'
      }
    ]
  },
  {
    id: 'err-realtime',
    category: 'Errors & Troubleshooting',
    title: 'Real-time features not working (chat not updating, votes not showing)',
    icon: WifiOff,
    tags: ['realtime', 'websocket', 'socket', 'not updating', 'disconnected', 'offline', 'amber dot', 'connection'],
    content: [
      {
        type: 'intro',
        text: 'If chat messages, vote tallies, or task updates are not appearing in real time, the WebSocket connection may have dropped.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Check the connection dot in the header', body: 'Look at the small dot next to the event title in the workspace header. Green = connected and live. Amber = disconnected. If it\'s amber, the real-time connection is down.' },
          { title: 'Wait for automatic reconnect', body: 'Socket.IO will attempt to reconnect automatically. Give it 10–20 seconds. When it reconnects, the dot turns green and any missed updates load from the database.' },
          { title: 'Check your internet connection', body: 'If your device has lost network access, the socket will stay disconnected. Reconnect to WiFi or mobile data and the socket should re-establish.' },
          { title: 'Refresh the page', body: 'If the dot stays amber for more than a minute, do a normal page refresh (F5 or Ctrl+R). The socket re-establishes on load.' },
          { title: 'Check for a server incident', body: 'Visit planitapp.onrender.com/status. If the backend is degraded, real-time features may be unavailable until the service recovers.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'No updates are lost during a disconnection. When the socket reconnects, the workspace reloads data from the database, so you\'ll see everything that happened while you were offline.'
      }
    ]
  },
  {
    id: 'err-password',
    category: 'Errors & Troubleshooting',
    title: 'Forgot organizer password / can\'t claim organizer role',
    icon: Key,
    tags: ['forgot password', 'lost password', 'organizer', 'can\'t login', 'locked out', 'reset', 'recover'],
    content: [
      {
        type: 'intro',
        text: 'There is no automated password reset in PlanIt because no email address is collected. If you\'ve lost your organizer password, here\'s what you can and cannot do.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Check everywhere you might have saved it', body: 'Password managers, browser-saved passwords, notes apps, messages to yourself, email drafts. The password was set during event creation — did you write it somewhere?' },
          { title: 'Try common variations', body: 'Check for capitalisation differences, spaces, or symbols you might have typed slightly differently. The login form allows unlimited attempts before rate limiting kicks in (20 failed attempts per 15 minutes).' },
          { title: 'Contact support', body: 'Email planit.userhelp@gmail.com with your event link, your name, and any details that confirm you created the event (e.g. the event title, date, approximate creation time). We may be able to provide limited assistance, but password recovery is not guaranteed.' },
          { title: 'Create a new event', body: 'If recovery isn\'t possible, the practical solution for a future event is to create a new one and store the password properly this time. Use a password manager.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'This is not a bug — it is an intentional design tradeoff of the no-account model. The same system that requires no email for signup means there\'s no email to send a reset link to. Please store your organizer password before sharing the event link.'
      }
    ]
  },
  {
    id: 'err-checkin',
    category: 'Errors & Troubleshooting',
    title: 'QR code not scanning / check-in errors',
    icon: QrCode,
    tags: ['qr code', 'scan', 'not scanning', 'checkin error', 'invalid', 'camera', 'check-in not working'],
    content: [
      {
        type: 'intro',
        text: 'If the check-in scanner isn\'t reading QR codes or showing errors, work through these steps.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Check camera permissions', body: 'The scanner requires camera access. If the browser is blocked from accessing the camera, you\'ll see a blank scanner. Go to your browser\'s site settings and allow camera access for planitapp.onrender.com.' },
          { title: 'Increase screen brightness on the guest\'s phone', body: 'QR codes scan best at maximum brightness. Ask the guest to turn up their screen brightness before scanning.' },
          { title: 'Use the fullscreen QR view', body: 'On the guest\'s invite page, tapping the QR code expands it to fill the entire screen. Scan from the fullscreen view — it\'s higher contrast and easier to read.' },
          { title: '"Already checked in" message', body: 'This means the QR code was already scanned and admitted earlier. Verify the guest\'s identity manually. If it\'s the same person (e.g. they left and came back), use the manager override to mark them re-admitted.' },
          { title: '"Invalid code" or "not found"', body: 'The invite code doesn\'t match any record in the event. This can happen if the guest is scanning from a different event\'s invite or if the invite was created after the check-in window opened. Check the event link and invite code manually.' },
          { title: 'Server error during scan', body: 'If the scan returns a 500 or connection error, check the status page. If the backend is having issues, you may need to switch to manual check-in via the manager override until the service recovers.' }
        ]
      }
    ]
  },
  {
    id: 'err-files',
    category: 'Errors & Troubleshooting',
    title: 'File upload failing',
    icon: Upload,
    tags: ['upload', 'file upload', 'error', 'failed', 'too large', 'limit', 'file type'],
    content: [
      {
        type: 'intro',
        text: 'If file uploads are failing, check these common causes.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Check the file size', body: 'Individual files have a size limit. If your file is very large (typically over 10MB depending on Cloudinary settings), the upload will fail. Try compressing the file first.' },
          { title: 'Check the rate limit', body: 'Uploads are limited to 20 per hour per IP. If your team has uploaded many files in the past hour, you may have hit this limit. Wait until the hour resets.' },
          { title: 'Check your connection', body: 'Large file uploads can fail on slow or unstable connections. Try uploading on a stronger network connection.' },
          { title: 'Try a different file type', body: 'Standard document, image, and PDF types are supported. Executables (.exe, .app) and certain archive types may be blocked. If a specific file type fails consistently, contact support.' }
        ]
      }
    ]
  },
  {
    id: 'err-service-crash',
    category: 'Errors & Troubleshooting',
    title: 'What to do when a service crashes or goes down',
    icon: Server,
    tags: ['crash', 'down', 'outage', 'service', 'unavailable', '503', '502', 'server error', 'backend', 'not responding'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt runs on a distributed infrastructure — a router, multiple backend servers, and a watchdog monitoring service. If something crashes, here\'s exactly what happens and what you should do.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Check the status page first', body: 'Go to planitapp.onrender.com/status. This is the first thing to check. If a server is down, you\'ll see an active incident. The page updates automatically — you don\'t need to refresh.' },
          { title: 'Understand what a backend crash means', body: 'PlanIt runs multiple backend instances behind a load-balancing router. If one backend goes down, the router detects it via circuit breaker (within 3 failed pings) and stops sending traffic to it. Requests are automatically rerouted to healthy backends. You may notice a brief blip, but service should continue.' },
          { title: 'If the router itself is unreachable', body: 'This is more serious. If the router is down, no requests can reach any backend. The workspace will fail to load entirely. Check the status page (it\'s served from a different infrastructure layer) and wait. The watchdog detects this within 3 minutes and creates an incident.' },
          { title: 'If you see a 502 or 503 error', body: 'A 502 (Bad Gateway) or 503 (Service Unavailable) means the router can\'t reach a healthy backend. This typically resolves within 1–5 minutes as the failed instance restarts or is removed from rotation. Refresh the page after a minute.' },
          { title: 'Cold-start after a crash', body: 'After a backend restarts, it goes through a 90-second cold-start window where the router deprioritises it. You may see slightly slower responses for the first 2 minutes after recovery.' },
          { title: 'Report the issue', body: 'If an outage isn\'t reflected on the status page within 5 minutes, submit a report at planitapp.onrender.com/status (use the "Report an issue" button) or email planit.userhelp@gmail.com. Reports from multiple users trigger automatic incident creation.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The watchdog service monitors every server every 60 seconds. When a failure is detected, it fires an urgent push notification to the platform operator and creates an incident on the status page automatically. You don\'t need to do anything — the system detects and reports itself.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Will I lose my event data during a crash?', a: 'No. All event data is stored in MongoDB Atlas, which is separate from the application servers. A backend crash doesn\'t affect the database. When the server comes back up, all data is exactly as you left it.' },
          { q: 'What if the crash happens during check-in at my event?', a: 'Check-in data written before the crash is safe in the database. For new check-ins during the outage, switch to manager override mode — search guests by name manually and use the override to admit them. All manual overrides are recorded when the server recovers.' },
          { q: 'How long do outages typically last?', a: 'Most incidents resolve within 5–10 minutes through automatic restart and rerouting. Longer outages are rare and are tracked on the status page with regular updates.' }
        ]
      }
    ]
  },
  {
    id: 'err-rate-limit',
    category: 'Errors & Troubleshooting',
    title: 'Rate limit errors (429 Too Many Requests)',
    icon: Ban,
    tags: ['rate limit', '429', 'too many requests', 'blocked', 'slow down', 'throttle'],
    content: [
      {
        type: 'intro',
        text: 'A 429 error means you\'ve sent too many requests in a short period. PlanIt applies rate limits to protect the service.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Wait and retry', body: 'Most rate limits reset within 1–15 minutes. Stop what you\'re doing, wait a few minutes, and try again. The response will include a Retry-After header if your browser is showing the raw error.' },
          { title: 'Identify which limit you hit', body: 'Authentication attempts: 20 failures per 15 minutes. Chat messages: 30 per minute. File uploads: 20 per hour. Event creation: 10 per hour. General API: 10,000 per 15 minutes (very hard to hit normally).' },
          { title: 'Check for automation or bots', body: 'If you\'re seeing 429 errors unexpectedly, check if any browser extensions, scripts, or tools are making automated requests to PlanIt on your behalf.' }
        ]
      }
    ]
  },
  {
    id: 'err-cold-start',
    category: 'Errors & Troubleshooting',
    title: 'Slow initial loading (cold start)',
    icon: Cpu,
    tags: ['slow', 'loading', 'cold start', 'spin down', 'render', 'wait', '30 seconds', '60 seconds'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt\'s backend servers may spin down after 15 minutes of inactivity and take 30–60 seconds to restart on the first request after being idle. We do use Uptimerobot and our own services to prevent this.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Recognise a cold-start', body: 'The page loads the frontend (fast) but all API calls time out or hang. The workspace shows a loading spinner that doesn\'t resolve for 30–60 seconds, then suddenly everything loads.' },
          { title: 'Just wait', body: 'This is expected behaviour. Wait up to 60 seconds. The server will wake up and your workspace will load. There\'s nothing wrong.' },
          { title: 'Warm up the server before your event', body: 'On event day, open your workspace about 5 minutes before guests start arriving. This warms the server so check-in doesn\'t experience cold-start delays at the door.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Tip for event day: open the workspace 5–10 minutes early to wake the server. Once warm, it stays fast for the duration of activity.'
      }
    ]
  },

  // ── STATUS PAGE ───────────────────────────────────────────────────────────
  {
    id: 'status-page',
    category: 'Status & Monitoring',
    title: 'How to use the status page',
    icon: Activity,
    tags: ['status', 'uptime', 'incident', 'monitoring', 'operational', 'history', 'report'],
    content: [
      {
        type: 'intro',
        text: 'The PlanIt status page at planitapp.onrender.com/status gives real-time visibility into platform health. Here\'s how to read it.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Overall status indicator', body: 'The banner at the top shows one of three states: All Systems Operational (green), Degraded Performance (amber), or Service Outage (red). This reflects the current state across all monitored services.' },
          { title: 'Service history bars', body: 'Each service shows a row of bars representing the past 15 days of uptime. Green = ≥99% uptime. Amber = 80–99%. Red = significant outage. Grey = no monitoring data for that day.' },
          { title: 'Active incidents', body: 'Any ongoing incident appears below the status banner with its severity, affected service, and a real-time timeline of updates as the issue is investigated and resolved.' },
          { title: 'Resolved incidents', body: 'The 10 most recently resolved incidents from the past 7 days are listed, each with their full update timeline and total downtime duration.' },
          { title: 'Submit a report', body: 'If you\'re experiencing an issue not shown on the status page, click "Report an Issue". Fill in what you\'re seeing, which service seems affected, and your email if you want a follow-up. Three or more reports on the same service within 10 minutes triggers automatic incident creation.' }
        ]
      }
    ]
  },
  {
    id: 'status-alerts',
    category: 'Status & Monitoring',
    title: 'Getting notified about outages',
    icon: Bell,
    tags: ['notification', 'alert', 'ntfy', 'outage', 'push', 'subscribe', 'monitor'],
    content: [
      {
        type: 'intro',
        text: 'The PlanIt status page is your primary source for outage information. Here\'s how the automated alert system works and how you can stay informed.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Bookmark the status page', body: 'planitapp.onrender.com/status — check this first whenever something seems wrong. It updates in real time, so a refresh will always show the latest state.' },
          { title: 'Submit an issue report', body: 'If you\'re experiencing a problem and there\'s no active incident on the status page, submit a report. If others are experiencing the same thing, an incident will be created automatically and you\'ll be part of the record.' },
          { title: 'How the automated detection works', body: 'The watchdog service pings every backend server every 60 seconds. Three consecutive failures trigger an incident automatically and fire an urgent alert to the operator. You don\'t need to report outages for them to be detected — the system catches them independently.' }
        ]
      }
    ]
  },

  // ── ACCOUNT & SETTINGS ────────────────────────────────────────────────────
  {
    id: 'acct-settings',
    category: 'Settings & Customisation',
    title: 'Workspace settings (organizer)',
    icon: Settings,
    tags: ['settings', 'configure', 'organizer', 'toggle', 'chat', 'polls', 'features', 'disable'],
    content: [
      {
        type: 'intro',
        text: 'As an organizer, you can configure which features are available in the workspace and set various event-level options.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open workspace settings', body: 'In the workspace header, click the settings icon (sliders or gear). You must be logged in as organizer to see this.' },
          { title: 'Toggle features on or off', body: 'You can disable Chat, Polls, and File Sharing from settings. Disabling a feature removes its tab from the workspace for all participants.' },
          { title: 'Enterprise check-in settings', body: 'In Enterprise mode, you can configure anti-fraud settings: which middleware layers are active, minimum trust score thresholds, time window for check-in, capacity limits, and whether auto-blocking is enabled.' },
          { title: 'Save settings', body: 'Settings are saved to the database and take effect immediately for all connected sessions.' }
        ]
      }
    ]
  },

  // ── CONTACT & SUPPORT ─────────────────────────────────────────────────────
  {
    id: 'support-contact',
    category: 'Contact & Support',
    title: 'How to contact support',
    icon: Mail,
    tags: ['contact', 'support', 'email', 'help', 'report', 'issue', 'feedback'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt support is operated by the developer directly. Here are the ways to get help.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Use the support form', body: 'Go to planitapp.onrender.com/status and fill in the report issue form. Select the category that best describes your issue, describe the problem in detail, and include your event link if relevant.' },
          { title: 'Email directly', body: 'Email planit.userhelp@gmail.com. Include: your event link, what you were trying to do, what happened instead, the browser and device you\'re using, and any error messages or screenshots.' },
          { title: 'Response time', body: 'Support aims to respond within 48 business hours. Complex technical issues may take longer.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'PlanIt is built and operated by one person. Support responses are thorough but not instantaneous. For urgent event-day issues, the status page is your fastest resource — it\'s automated and doesn\'t require a human to update.'
      }
    ]
  },

];

const CATEGORIES = [
  { label: 'All Articles',          icon: BookOpen,        id: 'all' },
  { label: 'Getting Started',       icon: Star,            id: 'Getting Started' },
  { label: 'Planning Tools',        icon: Calendar,        id: 'Planning Tools' },
  { label: 'Enterprise & Check-in', icon: UserCheck,       id: 'Enterprise & Check-in' },
  { label: 'Table Service',         icon: UtensilsCrossed, id: 'Table Service' },
  { label: 'Security & Passwords',  icon: Shield,          id: 'Security & Passwords' },
  { label: 'Data & Privacy',        icon: Database,        id: 'Data & Privacy' },
  { label: 'Errors & Troubleshooting', icon: AlertTriangle, id: 'Errors & Troubleshooting' },
  { label: 'Status & Monitoring',   icon: Activity,        id: 'Status & Monitoring' },
  { label: 'Settings & Customisation', icon: Settings,     id: 'Settings & Customisation' },
  { label: 'Contact & Support',     icon: LifeBuoy,        id: 'Contact & Support' },
];


const ARTICLES_EXTRA = [
  // ── MORE PLANNING TOOLS ────────────────────────────────────────────────
  {
    id: 'tool-people',
    category: 'Planning Tools',
    title: 'The People tab: seeing who\'s in your workspace',
    icon: Users,
    tags: ['people', 'participants', 'online', 'who\'s here', 'team', 'list', 'presence'],
    content: [
      { type: 'intro', text: 'The People tab shows everyone who has joined the workspace, with real-time presence indicators showing who is currently active.' },
      { type: 'steps', items: [
        { title: 'Open the People tab', body: 'Click "People" in the workspace tab bar. The badge shows total participant count.' },
        { title: 'See online vs offline status', body: 'Participants currently active show a green online indicator next to their name. Those who joined previously but are not currently connected show as offline.' },
        { title: 'Online count in the header', body: 'A live count of connected users with a pulsing green dot appears in the workspace header at all times — visible from any tab.' },
        { title: 'Organizer badge', body: 'The event organizer is marked with a crown or shield badge in the people list, confirming at a glance who holds organizer privileges.' },
      ]},
      { type: 'faq', items: [
        { q: 'Can I remove someone from the workspace?', a: 'There is no kick or ban mechanism. If someone should not be in your workspace, change the event password — existing sessions will be rejected when they next reconnect.' },
        { q: 'Does People show Enterprise guests?', a: 'No. People shows workspace participants (your planning team). Guest check-in data is managed in the check-in dashboard.' },
      ]},
    ],
  },
  {
    id: 'tool-waitlist',
    category: 'Planning Tools',
    title: 'Managing the waitlist',
    icon: ClipboardList,
    tags: ['waitlist', 'waiting list', 'join request', 'approve', 'pending', 'capacity'],
    content: [
      { type: 'intro', text: 'The waitlist lets people express interest in joining your event without immediately entering the workspace. Organizers review and approve each request.' },
      { type: 'steps', items: [
        { title: 'Access the waitlist', body: 'In the workspace header, click the clipboard/list icon. A red badge shows how many requests are pending. This button is only visible to organizers.' },
        { title: 'How people join', body: 'When someone navigates to your event URL and is blocked from entry, they see an option to join the waitlist with their name and an optional note.' },
        { title: 'Review requests', body: 'The waitlist panel lists everyone waiting with their submission time and note. Review each entry before deciding.' },
        { title: 'Approve or decline', body: 'Approve to grant immediate workspace access. Decline to remove them from the list. Approved users are let in instantly without needing to re-enter any information.' },
      ]},
      { type: 'callout', variant: 'info', text: 'The waitlist badge updates in real time. When a new request comes in, the count increments on your screen without any refresh required.' },
    ],
  },

  // ── ENTERPRISE EXTRAS ──────────────────────────────────────────────────
  {
    id: 'ent-guest-page',
    category: 'Enterprise & Check-in',
    title: 'The guest invite page: what guests see',
    icon: Eye,
    tags: ['guest', 'invite page', 'what guests see', 'rsvp', 'qr code', 'personal invite', 'guest experience'],
    content: [
      { type: 'intro', text: 'When a guest opens their personal invite link, they land on a dedicated page tailored to them. Here is exactly what they see.' },
      { type: 'steps', items: [
        { title: 'Personalised greeting', body: 'The page displays a personalised welcome with the guest\'s name, the event details (title, date, time, location), and any personal note the organizer added — highlighted in amber.' },
        { title: 'Their unique QR code', body: 'A large QR code is displayed below the event details. Tapping it expands it to fullscreen for easier scanning at the door.' },
        { title: 'Party and table info', body: 'Party size, table assignment, and dietary notes are shown so the guest can confirm their details are correct.' },
        { title: 'Add to calendar', body: 'A button downloads an .ics file compatible with Apple Calendar, Google Calendar, and Outlook.' },
        { title: 'Get directions', body: 'If a location was set, a button opens the address in Google Maps.' },
        { title: 'Download QR code', body: 'Guests can save their QR code as an image to their camera roll — useful for venues with poor signal.' },
      ]},
      { type: 'callout', variant: 'warning', text: 'Each invite link is personal and unique. Guests should not forward their link to others. Two people presenting the same QR code will trigger the anti-fraud duplicate detection.' },
    ],
  },
  {
    id: 'ent-analytics',
    category: 'Enterprise & Check-in',
    title: 'Using the analytics dashboard',
    icon: PieChart,
    tags: ['analytics', 'attendance', 'stats', 'data', 'enterprise', 'arrival', 'timeline', 'breakdown'],
    content: [
      { type: 'intro', text: 'Enterprise mode includes a real-time analytics panel visible only to organizers. It updates live throughout check-in and shows attendance patterns at a glance.' },
      { type: 'steps', items: [
        { title: 'Open the Analytics tab', body: 'Click "Analytics" in the workspace tab bar. This tab only appears for organizers in Enterprise mode.' },
        { title: 'Overview numbers', body: 'The top row shows: total guests invited, total admitted, total denied, and current attendance percentage. These update live.' },
        { title: 'Arrival timeline', body: 'A chronological chart shows when guests arrived throughout the event window — useful for understanding peak arrival times and crowd flow.' },
        { title: 'Table breakdown', body: 'Per-table occupancy shows how many guests at each table have checked in vs total assigned.' },
        { title: 'Override tracking', body: 'Separate counts for QR scan admissions vs manager override admissions give visibility into how often the fallback was needed.' },
        { title: 'Export reminder', body: 'Download or note analytics data before the 7-day deletion window. There is no automatic export.' },
      ]},
    ],
  },
  {
    id: 'ent-capacity',
    category: 'Enterprise & Check-in',
    title: 'Setting and enforcing venue capacity',
    icon: Users,
    tags: ['capacity', 'limit', 'max', 'venue', 'full', 'sold out', 'over capacity'],
    content: [
      { type: 'intro', text: 'Enterprise mode supports a maximum capacity limit. When the venue is full, the system stops admitting automatically.' },
      { type: 'steps', items: [
        { title: 'Set capacity in check-in settings', body: 'In the check-in dashboard settings panel (organizer only), enter the venue maximum occupancy number.' },
        { title: 'Automatic enforcement', body: 'Once admitted count reaches the maximum, the scanner shows a "Venue at capacity" state and blocks new admissions. Staff see a clear visual indicator on every device.' },
        { title: 'Override if needed', body: 'The organizer can temporarily override the capacity limit through the manager override flow, authenticated by account password, for VIPs or special cases.' },
        { title: 'Live counter', body: 'The current admitted count vs maximum is shown at the top of the check-in dashboard at all times, visible to all staff.' },
      ]},
    ],
  },

  {
    id: 'ent-offline',
    category: 'Enterprise & Check-in',
    title: 'Offline check-in: scanning without internet',
    icon: WifiOff,
    tags: ['offline', 'no internet', 'no signal', 'cache', 'queue', 'sync', 'venue signal', 'offline mode', 'pending', 'conflict'],
    content: [
      {
        type: 'intro',
        text: 'The check-in scanner works even when your venue has no internet signal. PlanIt caches the entire guest list to your device when the page loads, and queues every scan locally until connectivity returns — then syncs everything automatically. No action required from staff.'
      },
      {
        type: 'steps',
        items: [
          { title: 'How the cache is built', body: 'When the check-in page loads on a device that is online, PlanIt silently downloads the full guest list and stores it in your browser\'s IndexedDB — a local database that survives page refreshes and stays available even with no signal. Once built, a "Cache ready" indicator shows how many guests are stored and when it was last updated. The cache refreshes automatically whenever connectivity is available.' },
          { title: 'Scanning while offline', body: 'If your device loses signal mid-event, the scanner detects the disconnection and switches to offline mode automatically — no toggle or setting required. Every QR scan looks up the guest in the local cache instead of hitting the server. Admits are recorded locally and added to a sync queue. The guest name, party size, table assignment, and organizer notes all display correctly from cache.' },
          { title: 'The pending sync counter', body: 'While offline, a yellow "Pending: N" badge appears on the check-in dashboard showing how many admissions are queued and waiting to sync with the server. Each number is a real guest who was admitted locally but not yet confirmed server-side. This count is shown on every staff device.' },
          { title: 'Returning online', body: 'When connectivity returns, the queue flushes automatically in chronological order — no button to press. Each queued check-in is replayed against the server\'s full security checks. The pending counter counts down to zero as each sync completes.' },
          { title: 'Conflict flags', body: 'If two staff members on separate offline devices both admitted the same guest — possible when multiple entrances simultaneously lose signal — the server detects the duplicate when flushing. The second admission is flagged as a conflict and surfaced to the organizer as a yellow conflict card, rather than silently accepted or rejected. The card shows the guest name and both scan timestamps so you can investigate.' },
          { title: 'Server always wins', body: 'Offline admission is optimistic — a best-effort local decision. When the queue flushes, every queued check-in goes through the full server-side security suite: duplicate detection, trust score, capacity limits, time window enforcement, and block checks. If the server rejects an offline admission (e.g. a ticket that was blocked after the cache was built), that rejection is surfaced as a conflict flag. The guest is marked as requiring review.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'The offline cache is built when the check-in page first loads online. If you open the check-in page for the first time while already offline, the cache will be empty and scanning will fail. Always load the check-in dashboard before entering a low-signal area.'
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Event day tip: open the check-in page on every staff device while on venue WiFi at least 5 minutes before doors open. This builds the cache and warms the server simultaneously. Even if signal drops completely inside the venue, every device can scan the full guest list without interruption.'
      },
      {
        type: 'faq',
        items: [
          { q: 'How old can the cache be before it\'s a problem?', a: 'The check-in UI shows the cache build time. If you added new guests after loading the page, those guests won\'t be in the local cache — they\'ll appear as "not found" when scanned offline. For large events, reload the check-in page after making final guest list changes, while still online.' },
          { q: 'Can two staff devices both go offline at the same time?', a: 'Yes, and each device maintains its own independent queue. Both will admit guests locally and sync independently when online returns. The server detects any overlap between the two queues and flags conflicts for review.' },
          { q: 'What happens if connectivity never returns during the event?', a: 'All check-ins remain in the sync queue until the device reconnects — even after the event is over. When the device next connects to the internet (on another network, at home, etc.) the queue flushes. If you need the check-in log immediately after the event, ensure at least one device connects before it goes out of range.' },
          { q: 'Does the offline cache include guests added after the page loaded?', a: 'No. The cache is a snapshot taken at page load time. Guests added to the list after the cache was built will not be found by the offline scanner. For guests who arrive and are not in the cache, use manager override — it contacts the server directly, so requires connectivity.' },
        ]
      }
    ],
  },

  // ── MORE ERRORS ────────────────────────────────────────────────────────
  {
    id: 'err-notfound',
    category: 'Errors & Troubleshooting',
    title: '"Event not found" or 404 error',
    icon: AlertTriangle,
    tags: ['not found', '404', 'event not found', 'wrong link', 'deleted', 'expired', 'invalid url'],
    content: [
      { type: 'intro', text: 'An "Event not found" error means the workspace could not be located. Here are the most common causes.' },
      { type: 'steps', items: [
        { title: 'Check the URL carefully', body: 'Paste the event link fresh into your browser address bar. A single typo in the slug or ID causes a 404. Correct formats: planitapp.onrender.com/e/your-slug or planitapp.onrender.com/event/[id].' },
        { title: 'The event may have been deleted', body: 'All events are permanently deleted 7 days after the event date. If the event ended more than 7 days ago, it no longer exists and cannot be recovered.' },
        { title: 'Wrong link version', body: 'There are two URL formats (slug and database ID). Both work, but confirm you have the one the organizer shared. Both resolve to the same workspace.' },
        { title: 'Ask the organizer', body: 'If the event is still active, ask the organizer to copy the link directly from their workspace Share tab and send it again.' },
      ]},
      { type: 'callout', variant: 'info', text: 'If the event date has not yet passed and you are getting a 404, the link is almost certainly incorrect. The event itself is still alive — you just have the wrong URL.' },
    ],
  },
  {
    id: 'err-database',
    category: 'Errors & Troubleshooting',
    title: 'Data not saving or database errors',
    icon: Database,
    tags: ['database', 'save failed', 'not saving', 'mongodb', 'data lost', 'error saving', 'write failed'],
    content: [
      { type: 'intro', text: 'If actions like creating tasks, posting messages, or saving notes are failing or showing errors, a database connectivity issue may be the cause.' },
      { type: 'steps', items: [
        { title: 'Look at the toast error', body: 'PlanIt shows red toast notifications when a server operation fails. Note the exact message before it disappears.' },
        { title: 'Check the status page', body: 'Visit planitapp.onrender.com/status. A database incident means all write operations are failing platform-wide — waiting is the only fix until resolved.' },
        { title: 'Retry after 30–60 seconds', body: 'Database connectivity issues are often transient. Wait a moment and try the action again.' },
        { title: 'Refresh the page', body: 'A full refresh re-establishes all connections. If the database recovered, actions should succeed after reload.' },
      ]},
      { type: 'callout', variant: 'warning', text: 'Write failures mean the action was NOT saved. If you typed a long note and it failed, copy the text before refreshing so you do not lose your work.' },
    ],
  },
  {
    id: 'err-permissions',
    category: 'Errors & Troubleshooting',
    title: 'Permission denied / "Organizers only" error',
    icon: Lock,
    tags: ['permission', 'forbidden', '403', 'not allowed', 'unauthorized', 'organizer only', 'access denied'],
    content: [
      { type: 'intro', text: 'A permission error means you are trying to do something that requires organizer privileges, but you are not currently authenticated as an organizer.' },
      { type: 'steps', items: [
        { title: 'What requires organizer access', body: 'Posting announcements, deleting other participants\' messages, accessing check-in, configuring settings, managing the guest list, and viewing analytics all require organizer login.' },
        { title: 'Log in as organizer', body: 'Click the shield or lock icon in the workspace header. Enter the account password set when the event was created.' },
        { title: 'Session may have expired', body: 'JWT tokens expire after a set duration. If you were organizer but now see permission errors, log out and log back in.' },
        { title: 'Don\'t have the password?', body: 'Ask the event creator. There is no bypass or recovery without the account password.' },
      ]},
    ],
  },
  {
    id: 'err-mobile',
    category: 'Errors & Troubleshooting',
    title: 'Issues on mobile devices',
    icon: Phone,
    tags: ['mobile', 'phone', 'tablet', 'ios', 'android', 'safari', 'chrome mobile', 'responsive', 'touch'],
    content: [
      { type: 'intro', text: 'PlanIt works on mobile browsers. If something is wrong on your phone, here are the common causes and fixes.' },
      { type: 'steps', items: [
        { title: 'Use a modern browser', body: 'Chrome for Android and Safari on iOS 14+ are fully supported. Avoid in-app browsers (Instagram, Facebook) — they restrict camera and storage access. Open the link in your device\'s default browser.' },
        { title: 'Camera not opening for QR scanner', body: 'iOS: Settings → Safari → Camera → Allow. Android: Chrome Site Settings → allow camera for planitapp.onrender.com.' },
        { title: 'Keyboard hides the message input', body: 'Scroll down slightly after the keyboard appears. The input stays accessible — it may just be hidden behind the keyboard on first open.' },
        { title: 'Tab bar cut off on small screens', body: 'The workspace tab bar scrolls horizontally. Swipe left on the tab bar to reveal tabs that are off-screen.' },
        { title: 'Add to Home Screen', body: 'In Safari or Chrome, use "Add to Home Screen" to install PlanIt as a PWA. This gives it an app icon and removes the browser address bar for a cleaner experience.' },
      ]},
    ],
  },
  {
    id: 'err-event-password',
    category: 'Errors & Troubleshooting',
    title: 'Can\'t enter event — wrong password',
    icon: Lock,
    tags: ['event password', 'wrong password', 'can\'t enter', 'locked out', 'access denied', 'incorrect password'],
    content: [
      { type: 'intro', text: 'If the event password prompt is not accepting your input, here is what to check.' },
      { type: 'steps', items: [
        { title: 'Confirm you have the right password', body: 'Ask the organizer to resend or confirm the event password. Remember: the event password (for entry) and the organizer account password (for elevated access inside) are two separate passwords.' },
        { title: 'Check for typos', body: 'Passwords are case-sensitive. Check for accidental capitals, trailing spaces, or auto-corrected characters on mobile.' },
        { title: 'Rate limit on failed attempts', body: 'After 20 failed attempts in 15 minutes, the rate limiter blocks further tries from your IP. Wait 15 minutes and retry.' },
        { title: 'Only the organizer can help', body: 'If the correct password genuinely is not working and the organizer confirms you are using the right one, contact support at planit.userhelp@gmail.com with your event link.' },
      ]},
      { type: 'callout', variant: 'info', text: 'The event password and the organizer account password are completely separate. The event password gates entry for everyone. The organizer password grants elevated permissions inside.' },
    ],
  },

  // ── ONBOARDING & TIPS ─────────────────────────────────────────────────
  {
    id: 'gs-onboarding',
    category: 'Getting Started',
    title: 'First-time tips and onboarding walkthrough',
    icon: Star,
    tags: ['onboarding', 'tour', 'first time', 'new', 'tips', 'walkthrough', 'tutorial'],
    content: [
      { type: 'intro', text: 'When you create a new event and enter the workspace for the first time, PlanIt shows an onboarding walkthrough that highlights the key areas.' },
      { type: 'steps', items: [
        { title: 'Tour triggers automatically', body: 'If you enter via the event creation flow (URL has ?new=1), the onboarding walkthrough begins automatically, highlighting each main area in sequence.' },
        { title: 'Step through at your own pace', body: 'Click Next to advance. The tour covers the tab bar, organizer controls, and the Share panel.' },
        { title: 'Skip anytime', body: 'Click Skip or Dismiss to close the tour at any point. This Help Center has full documentation for every feature.' },
        { title: 'Tour ends at the Share panel', body: 'The onboarding ends by prompting you to copy and distribute the event link — the natural first action after creating an event.' },
      ]},
      { type: 'callout', variant: 'info', text: 'The tour only appears once on first entry. If you close it early, use this Help Center for guidance.' },
    ],
  },
  {
    id: 'gs-custom-link',
    category: 'Getting Started',
    title: 'Custom event URLs and slugs',
    icon: Link,
    tags: ['slug', 'custom url', 'link', 'event url', 'custom link', 'vanity url'],
    content: [
      { type: 'intro', text: 'Every event has a shareable URL. You can customise the slug at event creation to make it shorter and easier to share verbally.' },
      { type: 'steps', items: [
        { title: 'Auto-generated slug', body: 'By default, the slug comes from your title — spaces become hyphens, special characters are removed, and a short random suffix is added. Example: "Gala Night 2026" → gala-night-2026-a7f3.' },
        { title: 'Custom slug', body: 'Edit the "Event URL" field in the creation form. Use lowercase letters, numbers, and hyphens only. Example: winter-gala.' },
        { title: 'Uniqueness check', body: 'When you finish typing the slug, PlanIt immediately checks if it is taken. A red error appears if it is — choose something different.' },
        { title: 'Slug is permanent', body: 'The slug cannot be changed after creation. Choose carefully.' },
        { title: 'Fallback URL always works', body: 'Every event also has a permanent fallback URL: planitapp.onrender.com/event/[database-id]. This works regardless of any slug.' },
      ]},
    ],
  },
  {
    id: 'tips-eventday',
    category: 'Getting Started',
    title: 'Event day checklist',
    icon: CheckSquare,
    tags: ['event day', 'checklist', 'best practice', 'tips', 'preparation', 'day of', 'advice'],
    content: [
      { type: 'intro', text: 'Follow this checklist before your guests arrive to make sure event day goes smoothly.' },
      { type: 'steps', items: [
        { title: '5–10 min before: warm the server', body: 'Open your workspace at least 5 minutes before the event starts. PlanIt servers may cold-start after inactivity. Loading early ensures the server is warm and fast when check-in begins.' },
        { title: 'Verify staff devices are connected', body: 'Every staff member should open the check-in dashboard on their device and confirm the green online indicator. Fix connectivity issues before guests arrive.' },
        { title: 'Test the QR scanner', body: 'Have one staff member scan a test guest QR code. Confirm camera permissions are working and the scan resolves correctly.' },
        { title: 'Check the status page', body: 'Visit planitapp.onrender.com/status right before opening. Confirm all services are operational. If degraded, plan to use manager override as a backup.' },
        { title: 'Assign override credentials', body: 'At least one trusted staff member should have the organizer account password for manager override cases.' },
        { title: 'Keep the workspace link accessible', body: 'Bookmark the workspace tab so team members can check announcements and chat without hunting for the link.' },
        { title: 'Export data after the event', body: 'Within 7 days after the event, download everything you need: calendar file, guest list, analytics screenshots. Set a calendar reminder if needed.' },
      ]},
      { type: 'callout', variant: 'warning', text: 'The single most common event-day issue is cold-start latency. Opening the workspace 5 minutes early eliminates it entirely.' },
    ],
  },
  {
    id: 'tips-large-events',
    category: 'Enterprise & Check-in',
    title: 'Tips for large events (100+ guests)',
    icon: TrendingUp,
    tags: ['large', 'big event', 'many guests', 'scale', 'hundreds', 'tips', 'performance', 'multi staff'],
    content: [
      { type: 'intro', text: 'Running check-in for a large event needs a bit more planning. Here are best practices for events with 100 or more guests.' },
      { type: 'steps', items: [
        { title: 'Assign multiple check-in staff', body: 'Multiple staff can scan simultaneously from different devices. All admissions are consolidated in real time. Plan for 1 staff per ~50 expected peak arrivals per hour.' },
        { title: 'Brief staff on override', body: 'Some guests will have no QR code. Every staff member should know the override flow before doors open. Do a quick practice run.' },
        { title: 'Set venue capacity in advance', body: 'Configure the capacity limit in check-in settings before the event. This prevents over-admission automatically.' },
        { title: 'Use table assignments', body: 'Assign table numbers to all guests beforehand so staff can direct each guest immediately on admission.' },
        { title: 'Warm all devices simultaneously', body: 'Have every staff device load the check-in dashboard at least 5 minutes before doors open.' },
        { title: 'Use Bulletin for live updates', body: 'The Announcements / Bulletin tab lets you broadcast last-minute changes to all staff devices simultaneously.' },
      ]},
    ],
  },

  // ── SETTINGS & CUSTOMISATION EXTRAS ──────────────────────────────────
  {
    id: 'acct-delete',
    category: 'Settings & Customisation',
    title: 'Requesting early event deletion',
    icon: Trash2,
    tags: ['delete', 'early deletion', 'remove', 'close event', 'shut down', 'cancel event'],
    content: [
      { type: 'intro', text: 'Events are automatically deleted 7 days after the event date. If you need yours deleted before that, contact support.' },
      { type: 'steps', items: [
        { title: 'Confirm you want permanent deletion', body: 'Early deletion is completely irreversible. All messages, files, tasks, notes, guest records, and check-in logs will be gone permanently.' },
        { title: 'Email support', body: 'Email planit.userhelp@gmail.com with subject "Early Deletion Request". Include your event link and event name.' },
        { title: 'Processing time', body: 'Deletion requests are processed within 48 business hours. You will receive a confirmation reply once complete.' },
      ]},
      { type: 'callout', variant: 'warning', text: 'Export everything you need to keep before submitting a deletion request. It cannot be undone.' },
    ],
  },
  {
    id: 'acct-share-event',
    category: 'Settings & Customisation',
    title: 'All the ways to share your event',
    icon: Share2,
    tags: ['share', 'link', 'send', 'invite', 'distribute', 'qr code', 'copy link'],
    content: [
      { type: 'intro', text: 'There are several ways to share your PlanIt workspace with your planning team. Here is the full set of options.' },
      { type: 'steps', items: [
        { title: 'Copy from the header', body: 'In the workspace header, click the copy icon. The link is copied to clipboard with a brief checkmark confirmation.' },
        { title: 'Copy from the Share tab', body: 'Open the Share / Utilities tab. The event URL is in a read-only field with a dedicated Copy button.' },
        { title: 'Workspace QR code', body: 'In the Share tab, click "Show QR Code" to display a scannable QR code for the workspace URL. Good for projecting on a screen or printing.' },
        { title: 'Download the QR code', body: 'The QR code modal has a Download button that saves an SVG. Include it in invitations or printed materials.' },
        { title: 'Enterprise: guest links are separate', body: 'Guest invite links and the workspace URL are different. The workspace URL is for your planning team. Guest invite links live in the check-in dashboard.' },
      ]},
    ],
  },

  // ── WALKIE-TALKIE & SEATING MAP ────────────────────────────────────────
  {
    id: 'ent-walkie',
    category: 'Enterprise & Check-in',
    title: 'Walkie-talkie PTT: real-time voice for staff',
    icon: Volume2,
    tags: ['walkie talkie', 'ptt', 'push to talk', 'voice', 'radio', 'comms', 'staff', 'broadcast', 'audio'],
    content: [
      {
        type: 'intro',
        text: 'The walkie-talkie feature lets check-in staff broadcast voice to the entire team with a single button — no app switching, no phone call, no leaving the check-in screen.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Find the PTT button', body: 'A floating push-to-talk button appears in the bottom corner of the check-in dashboard for all authenticated staff and organizers. It is only visible after logging in — guests and unauthenticated visitors cannot see or use it.' },
          { title: 'Hold to transmit', body: 'Press and hold the PTT button to start broadcasting your voice. A recording indicator appears on your screen and a "transmitting" badge appears on all other staff devices showing your username.' },
          { title: 'Release to stop', body: 'Release the button to end your transmission. Audio stops immediately. The next staff member can transmit right after — there is no talk-lock or delay.' },
          { title: 'Receiving audio', body: 'When another staff member is transmitting, audio plays automatically on your device through the speaker or earpiece. No button press or confirmation required — it works like a real radio.' },
          { title: 'Speaker identification', body: 'Every transmission is labeled with the sender\'s username. You always know who is speaking without asking.' },
          { title: 'Grant microphone permission', body: 'On first use, your browser will ask permission to access the microphone. Click Allow. If you accidentally denied it, go to your browser\'s site settings for planitapp.onrender.com and enable the microphone.' },
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The walkie-talkie uses the same Socket.IO connection as check-in events — no extra setup or pairing needed. It works over venue WiFi, mobile data, or a hotspot.',
      },
      {
        type: 'faq',
        items: [
          { q: 'Can guests hear the walkie-talkie?', a: 'No. The PTT channel is only accessible to authenticated staff and organizers. Unauthenticated sessions cannot access it.' },
          { q: 'What if two people transmit at the same time?', a: 'Audio from both transmitters plays on all receiving devices simultaneously. Unlike a physical radio there is no collision lock — if two people hold PTT at once, both voices play at the same time. Coordinate verbally as you would on any radio channel.' },
          { q: 'Does it work when the internet is slow?', a: 'Audio quality degrades gracefully on slow connections — the stream continues at lower quality rather than dropping entirely. On very poor connections there may be noticeable audio artifacts, but the transmission still goes through.' },
        ],
      },
    ],
  },
  {
    id: 'ent-seating',
    category: 'Enterprise & Check-in',
    title: 'Seating map: designing your floor plan and assigning tables',
    icon: MapPin,
    tags: ['seating', 'seating map', 'table', 'seat', 'floor plan', 'assign', 'table assignment', 'layout', 'map', 'canvas'],
    content: [
      {
        type: 'intro',
        text: 'The seating map lets you design a visual layout of your venue, assign guests to tables, and monitor real-time fill status during check-in — all from the check-in dashboard.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the seating map editor', body: 'In the check-in dashboard header, click the purple "Seating" button. It only appears once a seating map has been enabled. If you don\'t see it, open the map editor and create your first table — saving it activates the button.' },
          { title: 'Create tables on the canvas', body: 'In editor mode (organizer only), drag table objects from the palette onto the canvas. Each table gets a unique label (e.g. "Table 1", "VIP Table"). You can drag tables to reposition them and use the corner handles to resize.' },
          { title: 'Label and save your layout', body: 'Give each table a clear label — guests will see this label on their invite page and on the admission screen. When the layout looks right, click Save. The layout is broadcast to all connected staff devices immediately.' },
          { title: 'Assign guests to tables', body: 'With the map open in editor mode, you can drag guest names from the assignment panel onto tables on the canvas. Each assignment is saved instantly. You can also assign a table when adding or editing a guest record from the main guest list.' },
          { title: 'View table fill status during check-in', body: 'Staff can open the seating map in display mode at any time. Each table shows a live count of how many assigned guests have checked in vs total assigned. Tables that are nearly full show an amber indicator; full tables show green.' },
          { title: 'Show a guest their table after check-in', body: 'When a guest is admitted, if they have a table assignment, the admission success screen shows their table name and a "Show on Map" button. Tap it to open the map with their table highlighted — use this to point the guest in the right direction immediately.' },
          { title: 'Find a table from the guest list', body: 'For any checked-in guest with a table assignment, a small "Show table" shortcut appears in their guest list row. Click it to open the map focused on their table.' },
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Table assignments are visible on the guest\'s admit screen and boarding pass review. Staff can direct every guest to their seat at the moment of admission — no separate seating chart needed.',
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'The seating map is optional. If you don\'t create one, nothing changes — the Seating button won\'t appear and no features are affected.',
      },
      {
        type: 'faq',
        items: [
          { q: 'Can staff edit the seating map, or only organizers?', a: 'Only organizers can edit the canvas layout and assign guests. Staff see a read-only display view with live fill indicators.' },
          { q: 'Does the map update live if I move tables while the event is running?', a: 'Yes. Any change an organizer saves is broadcast to all staff devices instantly via the seating_map_updated event.' },
          { q: 'Can a guest be assigned to more than one table?', a: 'No. Each guest has one table assignment. Assigning them to a new table replaces the previous one.' },
          { q: 'What if I assigned a guest to a table before they checked in?', a: 'Their table name appears on the boarding pass review screen as soon as their QR code is scanned — even before pressing Admit.' },
        ],
      },
    ],
  },

  // ── CONTACT EXTRAS ────────────────────────────────────────────────────
  {
    id: 'support-bug',
    category: 'Contact & Support',
    title: 'Reporting a bug',
    icon: AlertTriangle,
    tags: ['bug', 'report', 'broken', 'issue', 'defect', 'something wrong', 'not working'],
    content: [
      { type: 'intro', text: 'Found something broken? Here is how to report it so it gets fixed fast.' },
      { type: 'steps', items: [
        { title: 'Reproduce it', body: 'Try to trigger the bug a second time. Note the exact steps, what you expected, and what actually happened.' },
        { title: 'Collect info', body: 'Browser and version, device type, event link (if relevant), any error messages, and approximate time of the issue.' },
        { title: 'Email ASAP', body: 'Email planit.userhelp@gmail.com with subject "Bug Report: [description]". Screenshots or screen recordings are extremely helpful.' },
        { title: 'Platform-wide bugs', body: 'Also submit a report on the status page at planitapp.onrender.com/status so the automated system can track severity.' },
      ]},
      { type: 'callout', variant: 'info', text: 'Screenshots are extremely helpful. Even a brief screen recording saves significant diagnosis time. Please include one if possible.' },
    ],
  },
  {
    id: 'support-feature',
    category: 'Contact & Support',
    title: 'Suggesting a feature',
    icon: Star,
    tags: ['feature request', 'suggestion', 'idea', 'improvement', 'feedback', 'enhance', 'request'],
    content: [
      { type: 'intro', text: 'PlanIt is actively developed. Feature requests from real users directly shape what gets built next.' },
      { type: 'steps', items: [
        { title: 'Use the support form', body: 'Go to planitapp.onrender.com/support and select "Feature Request". Describe the feature, how you would use it, and why the current platform does not satisfy the need.' },
        { title: 'Email with specifics', body: 'Email planit.userhelp@gmail.com with subject "Feature Request: [name]". Include: the problem you are trying to solve, the type of events you run, and how critical this is to your workflow.' },
        { title: 'Be specific about your use case', body: 'Specific, actionable requests get prioritised fastest. For example: "I need to export the guest list as CSV before the 7-day deletion" is immediately understandable and buildable.' },
      ]},
    ],
  },

  // ── TABLE SERVICE MODE ────────────────────────────────────────────────────
  {
    id: 'ts-overview',
    category: 'Table Service',
    title: 'Getting started with Table Service mode',
    icon: UtensilsCrossed,
    tags: ['table service', 'restaurant', 'floor', 'venue', 'setup', 'getting started', 'create'],
    content: [
      { type: 'intro', text: 'Table Service mode is a dedicated floor management system for restaurants and venues. It creates a completely different interface from the standard event workspace — focused entirely on your live floor plan.' },
      { type: 'steps', items: [
        { title: 'Create a Table Service venue', body: 'On the home page, open the event creation form and select "Table Service" as the mode. Give your venue a name — this appears in the dashboard header. Fill in your email and a password as normal. The date field is not required.' },
        { title: 'Open the floor dashboard', body: 'After creation you are redirected to /e/your-venue/floor. This is your main working screen. Bookmark it — this is the URL your staff will use every service.' },
        { title: 'Set up your floor layout', body: 'Click "Edit Layout" in the header. The seating map editor opens. Drag tables from the palette onto the canvas to match your physical layout. Set each table\'s label and capacity. Save when done.' },
        { title: 'Configure settings', body: 'Click the gear icon to open Settings. Set your average dining duration, cleaning buffer, operating hours, and QR expiry window. These values drive the wait time estimates shown to staff.' },
        { title: 'Start managing tables', body: 'Click any table on the floor map to open its management panel. Use the status buttons to mark it occupied, cleaning, or available. Add party name and size when seating a group.' },
      ]},
      { type: 'callout', variant: 'info', text: 'Table Service data is never auto-deleted. Your floor layout and settings persist indefinitely — set up the layout once and it will be there every service.' },
    ],
  },
  {
    id: 'ts-floor',
    category: 'Table Service',
    title: 'Managing your live floor plan',
    icon: LayoutGrid,
    tags: ['floor plan', 'table status', 'occupied', 'available', 'cleaning', 'reserved', 'table management'],
    content: [
      { type: 'intro', text: 'The floor map is the central screen of Table Service mode. Every table shows its live status colour, party details, and estimated time remaining.' },
      { type: 'steps', items: [
        { title: 'Read the status colours', body: 'Green = available. Red = occupied. Amber = reserved. Violet = cleaning. Grey = unavailable. Each table shows its label, current party size vs. capacity, and — when occupied — a countdown badge showing estimated time remaining.' },
        { title: 'Select a table', body: 'Click any table on the floor map to open its management panel below the map. The selected table gets a white ring so you can see which one you are editing.' },
        { title: 'Seat a party', body: 'In the table panel, enter the party name and size, then click "Seat Party". The table turns red immediately on every connected device. The seating timestamp is recorded for time tracking.' },
        { title: 'Release a table', body: 'Click "Mark Cleaning" to enter the cleaning queue (violet). Click "Mark Available" once clean. This clears the party details and resets the occupancy timer.' },
        { title: 'Pan and zoom', body: 'Drag the empty canvas to pan. Use the +/− buttons at the bottom-right to zoom, or scroll with the mouse wheel. The percentage button resets to 100%.' },
      ]},
      { type: 'faq', items: [
        { q: 'Do table changes sync to other devices instantly?', a: 'Yes. Every status change emits a Socket.IO event to all connected sessions. A second device on the floor sees the update within under a second — no refresh needed.' },
        { q: 'What is the time remaining countdown?', a: 'When a table is marked occupied, the system records the timestamp. The countdown is: avgDiningMinutes − minutes elapsed. When it hits zero the badge turns red and shows OVER. This is an estimate — you control when the table is actually released.' },
        { q: 'Can I mark a table unavailable?', a: 'Yes. Use it for tables that are closed, broken, or reserved for private use.' },
      ]},
    ],
  },
  {
    id: 'ts-waitlist',
    category: 'Table Service',
    title: 'Walk-in waitlist and estimated wait times',
    icon: Clock,
    tags: ['waitlist', 'wait time', 'walk-in', 'queue', 'estimate', 'party', 'notify'],
    content: [
      { type: 'intro', text: 'The waitlist panel queues walk-in parties and shows an estimated wait time based on your floor\'s current occupancy and your configured dining duration.' },
      { type: 'steps', items: [
        { title: 'Add a party', body: 'In the right sidebar, click the Waitlist tab then "Add party". Enter party name and size. Phone is optional. Click "Add to list".' },
        { title: 'Read the wait estimate', body: 'Below each entry you\'ll see: "Table available now" (green), "Est. wait ~12 min" (amber), or "No suitable table" if no table with enough capacity exists. Estimates update live as tables turn.' },
        { title: 'Notify the party', body: 'Click the bell icon to mark them notified. Their entry gains a "Notified" badge — useful when calling them verbally or by phone.' },
        { title: 'Seat or remove', body: 'Click the checkmark to mark them seated and remove them from the active list. Click X to remove a party that left or no longer needs a table.' },
      ]},
      { type: 'callout', variant: 'info', text: 'The wait estimate finds tables with capacity ≥ party size, calculates remaining time on each occupied one, and shows the minimum plus your cleaning buffer. It is an average-based estimate — actual turn times will vary.' },
    ],
  },
  {
    id: 'ts-reservations',
    category: 'Table Service',
    title: 'Reservations and QR codes',
    icon: QrCode,
    tags: ['reservation', 'booking', 'qr code', 'scan', 'token', 'expiry', 'check in'],
    content: [
      { type: 'intro', text: 'Each reservation generates a signed QR token with a configurable expiry window. Staff scan the QR at the door to confirm and seat the party.' },
      { type: 'steps', items: [
        { title: 'Create a reservation', body: 'In the Reservations tab, click "New". Enter party name, size, date and time, and optional phone/email. Click "Create + QR". A reservation record and a signed QR token are generated immediately.' },
        { title: 'Show the QR to the guest', body: 'Click the QR icon on any reservation row to open the QR modal. Show the screen to the guest to photograph, or note the reservation for a printed QR workflow.' },
        { title: 'Seat at arrival', body: 'When the guest arrives, open the QR modal and click "Seat Now". The reservation is marked seated and removed from the active list.' },
        { title: 'Handle no-shows', body: 'Click the X on a reservation to cancel it, or use the QR modal\'s "No Show" button.' },
        { title: 'Understanding QR expiry', body: 'Each token expires a configurable number of minutes after the reservation time (default 45). A guest presenting an expired QR sees "QR code has expired". Adjust the expiry window in Settings to match your workflow.' },
      ]},
      { type: 'faq', items: [
        { q: 'Can the same QR be used twice?', a: 'No. Once a reservation is marked seated, any further scan returns "This party is already seated." The server checks reservation status on every scan.' },
        { q: 'Can I assign a reservation to a specific table?', a: 'Yes — specify a table ID when creating or editing a reservation. This is informational and does not automatically change the table\'s live status.' },
      ]},
    ],
  },
  {
    id: 'ts-settings',
    category: 'Table Service',
    title: 'Configuring Table Service settings',
    icon: Settings,
    tags: ['settings', 'config', 'dining time', 'buffer', 'hours', 'qr expiry', 'restaurant settings'],
    content: [
      { type: 'intro', text: 'The settings panel controls the timing parameters that drive wait time estimates and QR expiry. Accurate settings make the wait time estimator significantly more useful for your staff.' },
      { type: 'steps', items: [
        { title: 'Average dining time (minutes)', body: 'The most important setting. Typical time a party occupies a table from seating to leaving. Default 75. Adjust to match your actual service — a casual café might be 45 minutes, fine dining might be 120. This directly drives the countdown on occupied tables and the waitlist estimates.' },
        { title: 'Cleaning buffer (minutes)', body: 'Time to clean and reset a table after guests leave. Added on top of remaining time when calculating waitlist estimates. Default 10.' },
        { title: 'Reservation duration (minutes)', body: 'How long a reservation slot holds the table. Default 90.' },
        { title: 'QR code expiry (minutes after reservation time)', body: 'How long a reservation QR remains valid after the scheduled time. For example, 45 means a 7:00 PM reservation QR is valid until 7:45 PM. Default 45.' },
        { title: 'Operating hours', body: 'Sets your open and close times, displayed in the Overview panel.' },
        { title: 'Welcome message', body: 'Optional staff note displayed in the Overview tab — useful for tonight\'s specials or shift reminders.' },
      ]},
    ],
  },

  // ── PLANNING TOOLS: NOTES ─────────────────────────────────────────────
  {
    id: 'tool-notes',
    category: 'Planning Tools',
    title: 'Using color-coded notes',
    icon: StickyNote,
    tags: ['notes', 'sticky notes', 'color', 'colour', 'pin', 'grid', 'brainstorm', 'ideas'],
    content: [
      {
        type: 'intro',
        text: 'The Notes tab gives your team a shared sticky-note board for capturing ideas, reminders, and reference information. Notes are color-coded, freely positioned in a grid, and synchronized live to every connected session.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Notes tab', body: 'Click "Notes" in the workspace tab bar (sticky note icon). You\'ll see the shared note board, with any existing notes already displayed.' },
          { title: 'Create a new note', body: 'Click the "+" button or "New Note" to open the note editor. Type a title (optional) and body text. Pick a color from the palette — six colors are available: yellow, pink, blue, green, purple, and orange.' },
          { title: 'Save and publish', body: 'Click Save. Your note appears on the board immediately and is pushed to every other connected session in real time via the notes_updated socket event.' },
          { title: 'Edit an existing note', body: 'Click the pencil icon on any note to open the editor with the existing content pre-filled. Save your changes — the update is broadcast live to all sessions.' },
          { title: 'Delete a note', body: 'Click the trash icon on any note card. The note is removed from the database and from all connected sessions instantly. Deletion is permanent.' },
          { title: 'Scroll and browse', body: 'Notes are arranged in a responsive grid. Scroll down to see all notes if there are many. The most recently created notes appear first.' },
        ]
      },
      {
        type: 'faq',
        items: [
          { q: 'Can only the organizer create notes?', a: 'No — any participant in the workspace can create, edit, and delete notes. There is no permission restriction on the Notes tab.' },
          { q: 'Is there a character limit per note?', a: 'The body field accepts up to 1000 characters. The title field accepts up to 100.' },
          { q: 'Do notes persist after I close the browser?', a: 'Yes — notes are saved to the database and load fresh every time the Notes tab is opened.' },
          { q: 'Can I search notes?', a: 'There is no in-panel note search. Use your browser\'s Ctrl+F / Cmd+F to search visible text on the page.' },
        ]
      }
    ]
  },

  // ── PLANNING TOOLS: ANNOUNCEMENTS ─────────────────────────────────────
  {
    id: 'tool-announcements',
    category: 'Planning Tools',
    title: 'Posting and managing announcements',
    icon: Megaphone,
    tags: ['announcements', 'bulletin', 'broadcast', 'important', 'notify', 'organizer message', 'team update'],
    content: [
      {
        type: 'intro',
        text: 'Announcements are a one-way broadcast channel from the organizer to the entire team. Unlike chat, they are not buried in conversation — they live in their own tab and trigger a toast notification on every connected device.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Announcements tab', body: 'Click "Announcements" or "Bulletin" in the workspace tab bar (megaphone icon). This tab is visible to all participants but only organizers can post.' },
          { title: 'Write an announcement', body: 'Click "New Announcement". Type your message. For time-sensitive information — a venue change, a schedule shift, an emergency update — toggle the "Mark as Important" flag.' },
          { title: 'Post the announcement', body: 'Click Post. The announcement is saved to the database and a toast notification is pushed to every currently connected participant, even those on different tabs in the workspace.' },
          { title: 'Important flag styling', body: 'Announcements marked Important display with a distinct red-bordered alert styling that makes them visually prominent in the panel. Use sparingly so the flag retains its impact.' },
          { title: 'Delete an announcement', body: 'Organizers can delete any announcement from the panel. Deleted announcements are removed from all sessions immediately.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The toast notification fires even if the participant is on the Chat or Tasks tab — they don\'t need to have Announcements open to be alerted. This makes announcements the most reliable way to guarantee your team sees critical information.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can participants reply to announcements?', a: 'No — announcements are one-way. If you want a discussion, post in chat and reference the announcement.' },
          { q: 'Do late-arriving team members see old announcements?', a: 'Yes — all announcements are stored and load when a new participant opens the tab. No one misses an announcement just because they joined late.' },
          { q: 'Is there a character limit?', a: 'Announcements support up to 2000 characters.' },
        ]
      }
    ]
  },

  // ── PLANNING TOOLS: EXPENSES ──────────────────────────────────────────
  {
    id: 'tool-expenses',
    category: 'Planning Tools',
    title: 'Tracking expenses and managing the budget',
    icon: DollarSign,
    tags: ['expenses', 'budget', 'cost', 'spending', 'money', 'ledger', 'finance', 'paid by', 'category'],
    content: [
      {
        type: 'intro',
        text: 'The expense panel is a shared real-time ledger for logging event costs as they are incurred. It tracks individual line items, assigns them to categories and payers, and compares total spending against a configurable budget — all in the same workspace as your planning.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Expenses tab', body: 'Click the "$" or "Budget" tab in the workspace tab bar.' },
          { title: 'Set a budget', body: 'If you\'re the organizer, click "Set Budget" and enter the total event budget. A running total appears at the top of the panel: total spent vs. budget, with a remaining amount that turns red when spending exceeds the budget.' },
          { title: 'Log an expense', body: 'Click "Add Expense". Fill in: title (required), amount (required), category (e.g. venue, catering, AV, staffing, marketing), "paid by" (who covered the cost), and optional notes. Submit to add it to the shared ledger.' },
          { title: 'See the category breakdown', body: 'Expenses are grouped by category automatically. The category breakdown view shows you at a glance where the money is going — no extra configuration needed.' },
          { title: 'Delete an expense', body: 'Click the trash icon on any line item to remove it. The total updates instantly for all connected sessions.' },
          { title: 'Live synchronization', body: 'Every expense addition, deletion, and budget update is broadcast to all connected sessions via the expenses_updated socket event. No refresh needed.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The "paid by" field is free text — type anyone\'s name, including external vendors or people not in the workspace. This is useful for tracking reimbursements after the event.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can I change the budget after setting it?', a: 'Yes — the organizer can update the budget amount at any time. The comparison updates immediately.' },
          { q: 'Can participants add expenses, or only the organizer?', a: 'Any participant can log expenses. Only the organizer can set or change the overall budget.' },
          { q: 'Is there a limit to the number of expense entries?', a: 'No hard limit per event.' },
          { q: 'Can I export the expense list?', a: 'There is no one-click CSV export at present. Take a screenshot or manually copy the data before the 7-day deletion window. This is a requested feature — email planit.userhelp@gmail.com if it\'s important to your workflow.' },
        ]
      }
    ]
  },

  // ── PLANNING TOOLS: FILES ─────────────────────────────────────────────
  {
    id: 'tool-files',
    category: 'Planning Tools',
    title: 'Uploading and sharing files',
    icon: FileText,
    tags: ['files', 'upload', 'share', 'documents', 'images', 'pdf', 'attach', 'cloudinary', 'download'],
    content: [
      {
        type: 'intro',
        text: 'The Files tab lets your team attach documents, images, PDFs, and other files directly inside the workspace. No external file sharing service required — everything lives alongside your chat, tasks, and notes.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Files tab', body: 'Click "Files" in the workspace tab bar (document icon).' },
          { title: 'Upload a file', body: 'Click "Upload" or drag a file into the upload area. Files are sent to Cloudinary (PlanIt\'s cloud storage provider) and associated with your event. Once uploaded, the file appears in the panel for all participants immediately.' },
          { title: 'Download a file', body: 'Click any file in the panel to download it. Images show a preview inline. PDFs and other documents open or download depending on your browser settings.' },
          { title: 'Delete a file', body: 'Click the trash icon on a file entry to remove it. Deletion removes the file from Cloudinary and from all connected sessions.' },
          { title: 'Supported file types', body: 'Any file type can be uploaded — documents (PDF, DOCX, XLSX), images (JPG, PNG, GIF), spreadsheets, and more. File size limits depend on Cloudinary\'s plan limits.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'All files are permanently deleted with the event, 7 days after the event date. Download everything you need to keep before the deletion window closes. The workspace shows a warning banner as the deadline approaches.'
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'File uploads are rate-limited at 20 per hour per IP. This is generous for any real planning scenario but prevents the system from being used as a general-purpose file host.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can I upload multiple files at once?', a: 'Files must be uploaded one at a time through the standard upload interface.' },
          { q: 'Is there a per-file size limit?', a: 'PlanIt uses Cloudinary for file storage. The practical limit per file is determined by Cloudinary\'s upload limits on the plan in use — typically up to 100MB per file.' },
          { q: 'Can participants download all files at once?', a: 'There is no bulk download. Download files individually from the panel.' },
        ]
      }
    ]
  },

  // ── PLANNING TOOLS: COUNTDOWN ─────────────────────────────────────────
  {
    id: 'tool-countdown',
    category: 'Planning Tools',
    title: 'The countdown timer',
    icon: Clock,
    tags: ['countdown', 'timer', 'days', 'hours', 'minutes', 'seconds', 'event date', 'live'],
    content: [
      {
        type: 'intro',
        text: 'The countdown timer is always visible in the workspace, counting down days, hours, minutes, and seconds to your event\'s scheduled start. When the clock hits zero, it switches to a live "Event is Running" state automatically.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Where to find it', body: 'The countdown is displayed as a prominent card in the workspace, visible from the main dashboard view. Days, hours, minutes, and seconds are shown in large monospaced digits that don\'t shift as numbers change.' },
          { title: 'Timezone accuracy', body: 'The countdown uses the event\'s absolute UTC timestamp, not a local date string. A team member in a different timezone than the event location will still see the correct remaining time.' },
          { title: 'When the event starts', body: 'Once the current time passes the event\'s start time, the countdown transitions to a green "Event is Live!" state displaying the event start date and time. This happens automatically on every connected session — no refresh needed.' },
          { title: 'After the event', body: 'The workspace remains accessible for 7 days after the event date. The countdown panel no longer displays a future timer once the event has passed.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The countdown runs on a 1-second JavaScript interval that is cleaned up when you navigate away, preventing memory leaks. It introduces no perceptible CPU overhead even on low-powered devices.'
      }
    ]
  },

  // ── PLANNING TOOLS: SHARE & UTILITIES ────────────────────────────────
  {
    id: 'tool-share',
    category: 'Planning Tools',
    title: 'The Share tab: export, calendar, and workspace QR',
    icon: Share2,
    tags: ['share', 'export', 'calendar', 'ics', 'qr code', 'utilities', 'download', 'add to calendar', 'participant list'],
    content: [
      {
        type: 'intro',
        text: 'The Share tab is your utility panel for distributing the event link, exporting data, and connecting your event to external calendars.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Copy the event URL', body: 'The event\'s shareable URL is shown in a read-only field with a dedicated Copy button. This is the link to send to your planning team.' },
          { title: 'Workspace QR code', body: 'Click "Show QR Code" to display a QR code for your workspace URL. Good for projecting on a screen, printing on physical invitations, or sharing on a slide deck.' },
          { title: 'Download the QR code', body: 'The QR modal includes a Download button that saves the code as an SVG file — high resolution, scalable to any print size.' },
          { title: 'Download the .ics calendar file', body: 'Click "Download .ics" or "Add to Calendar". This generates a standard iCalendar file with your event title, date, time, timezone, and location. It imports into Google Calendar, Apple Calendar, Outlook, and any other calendar app that supports the .ics format.' },
          { title: 'Export participant list', body: 'The Share tab (for organizers) includes a way to download the current participant list before deletion. Useful if you need a record of who was in the workspace.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The .ics download is one of the most useful features for handoff between PlanIt and personal calendars. After sharing the workspace link with your team, also share the .ics so everyone can add the event to their personal calendar with one click.'
      }
    ]
  },

  // ── PLANNING TOOLS: AGENDA ────────────────────────────────────────────
  {
    id: 'tool-agenda',
    category: 'Planning Tools',
    title: 'Viewing the event agenda',
    icon: List,
    tags: ['agenda', 'schedule', 'timeline', 'itinerary', 'order', 'program'],
    content: [
      {
        type: 'intro',
        text: 'The Agenda tab shows an at-a-glance summary of key event details — the event name, date, time, timezone, location, and countdown. It serves as the reference view for the event\'s core information.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Agenda tab', body: 'Click "Agenda" in the workspace tab bar (list or calendar icon).' },
          { title: 'What is shown', body: 'The event title, scheduled date and time, timezone, location (with a "Get Directions" link that opens Google Maps if a location was set), and the live countdown.' },
          { title: 'Get Directions', body: 'If the organizer entered a venue address or location name when creating the event, a "Get Directions" button appears that opens Google Maps with the venue pre-filled.' },
          { title: 'Organizer visibility', body: 'For organizers, the Agenda tab may also surface quick-access links to key features like the check-in dashboard or analytics.' },
        ]
      }
    ]
  },

  // ── ENTERPRISE: ANTI-FRAUD SYSTEM ─────────────────────────────────────
  {
    id: 'ent-antifraud',
    category: 'Enterprise & Check-in',
    title: 'How the anti-fraud check-in system works',
    icon: Shield,
    tags: ['anti-fraud', 'fraud', 'security', 'trust score', 'middleware', 'duplicate', 'block', 'replay', 'check-in security'],
    content: [
      {
        type: 'intro',
        text: 'Every QR scan in Enterprise mode passes through a multi-layer anti-fraud pipeline before admission is granted. This prevents duplicate admissions, ticket sharing, replayed tokens, and other check-in exploits.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Layer 1: Duplicate detection', body: 'The first check is whether the invite code has already been admitted. If the same QR is scanned a second time, admission is denied with an "Already checked in" response, regardless of who is presenting it.' },
          { title: 'Layer 2: Time window enforcement', body: 'Each check-in has a configurable valid window (e.g. 2 hours before the event to 2 hours after). Scans outside this window are rejected. This prevents guests from scanning their invite the day before and arriving without scanning again.' },
          { title: 'Layer 3: Trust score calculation', body: 'A trust score is computed for each scan based on a combination of signals: invite creation time relative to event date, RSVP status, whether the invite was generated normally or in bulk, and scan timing. Low trust scores flag the admission for review or auto-block depending on settings.' },
          { title: 'Layer 4: Capacity enforcement', body: 'If a venue capacity limit is set and the admitted count has reached it, further admissions are blocked automatically, even for valid QR codes.' },
          { title: 'Layer 5: Block list', body: 'Specific invite codes or guest records can be manually blocked by the organizer. Blocked invites are rejected at the scanner with a denial response.' },
          { title: 'Configuring the layers', body: 'Each middleware layer can be toggled on or off in the check-in settings panel (organizer only). You can also set the minimum trust score threshold and the check-in time window to match your event\'s needs.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'All check-in decisions — admit, deny, and block — are recorded in the audit log with a timestamp, the staff member\'s attribution (QR scan vs. manual override), and the trust score at time of scan. This full audit trail is visible in the check-in dashboard.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can guests share their QR code with someone else?', a: 'The first person to scan an invite code is admitted. Any subsequent scan of the same code is denied. This prevents ticket sharing — though it does not identify which person physically holds the device.' },
          { q: 'What is the default trust score threshold?', a: 'The default threshold is 60 out of 100. Scans below this score are flagged for manual review unless auto-blocking is enabled, in which case they are denied automatically.' },
          { q: 'Can I turn off the anti-fraud system?', a: 'You can disable individual layers in the settings panel. Disabling all layers means admissions rely solely on code validity — no duplicate or time window checks.' },
        ]
      }
    ]
  },

  // ── ENTERPRISE: ADDING & MANAGING GUESTS ──────────────────────────────
  {
    id: 'ent-managing-guests',
    category: 'Enterprise & Check-in',
    title: 'Adding guests and managing the guest list',
    icon: UserCheck,
    tags: ['guest list', 'add guest', 'invite', 'manage', 'edit guest', 'rsvp', 'notes', 'bulk', 'table assignment'],
    content: [
      {
        type: 'intro',
        text: 'In Enterprise mode, the organizer manages a formal guest list. Each guest gets a unique invite link with a personal QR code. Here\'s how to build and manage the list.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the check-in dashboard', body: 'Log in as organizer. The check-in dashboard is accessible from the workspace header (shield or check-in icon). This is where the guest list lives.' },
          { title: 'Add a guest manually', body: 'Click "Add Guest". Fill in the guest\'s name (required), party size (how many people this invite covers), table assignment (optional), RSVP status, and a personal organizer note (optional, shown on their invite page in amber).' },
          { title: 'Each guest gets a unique invite link', body: 'Once created, each guest record generates a unique invite URL of the format /invite/[invite-code]. Share this directly with the guest — it is their personal check-in credential.' },
          { title: 'Edit a guest record', body: 'Click the edit icon on any guest row to update their details — name, party size, table, RSVP status, or personal note. Changes are saved immediately.' },
          { title: 'Block a guest', body: 'If a guest should not be admitted (cancelled RSVP, security issue), use the block toggle on their record. Their QR code will scan as denied at the door.' },
          { title: 'Delete a guest', body: 'Deleting a guest record permanently removes it and invalidates their invite link. The QR code will show "Not found" if scanned.' },
          { title: 'Search and filter the list', body: 'The guest list has a search bar (search by name) and filters for RSVP status, check-in status, and table assignment. Useful for large lists at events with 100+ guests.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The personal organizer note you add to a guest record appears highlighted in amber on their invite page. Use it for information specific to that guest: their meal preference, VIP designation, parking instructions, or seating directions.'
      },
      {
        type: 'faq',
        items: [
          { q: 'Can guests add themselves to the list?', a: 'No — only organizers can create guest records. The guest list is managed entirely by the organizer.' },
          { q: 'Is there a bulk import option?', a: 'There is no CSV import at present. Guests must be added individually. Bulk import is a commonly requested feature — email planit.userhelp@gmail.com if this is important to your workflow.' },
          { q: 'What does RSVP status do?', a: 'RSVP status (Confirmed, Pending, Declined) is informational — it is visible on the guest record and affects the trust score calculation, but does not automatically block or allow admission. Declining an RSVP does not invalidate the QR code unless you also toggle the block flag.' },
        ]
      }
    ]
  },

  // ── SECURITY: RESPONSE SIGNING ────────────────────────────────────────
  {
    id: 'sec-response-signing',
    category: 'Security & Passwords',
    title: 'Cryptographic response signing and API security',
    icon: Key,
    tags: ['response signing', 'hmac', 'cryptographic', 'api security', 'signature', 'tamper', 'integrity', 'signed'],
    content: [
      {
        type: 'intro',
        text: 'Every API response from PlanIt\'s backend is cryptographically signed with an HMAC signature. This ensures that responses haven\'t been tampered with in transit and that they came from an authentic PlanIt backend.'
      },
      {
        type: 'steps',
        items: [
          { title: 'What is response signing?', body: 'Each HTTP response includes a custom header containing an HMAC-SHA256 signature computed over the response body and a timestamp, using a secret key known only to PlanIt\'s servers. The frontend verifies this signature before trusting the data.' },
          { title: 'Replay protection', body: 'The timestamp embedded in each signature has a validity window. A response that is replayed after this window expires fails signature verification, preventing replay attacks.' },
          { title: 'Internal service authentication', body: 'Communication between PlanIt\'s internal services (the main backend, the load balancer, the watchdog) is also HMAC-authenticated. Services include a signed header on every inter-service request; requests without a valid signature are rejected before any processing occurs.' },
          { title: 'What this means for you', body: 'You don\'t need to do anything differently. The signing and verification happens automatically in the background. What it guarantees: the data you see in the workspace came from PlanIt\'s authentic backend, not a man-in-the-middle.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Response signing is not the same as TLS/HTTPS — that encrypts the connection. Response signing is an additional integrity check on top of HTTPS that verifies the authenticity of the data payload even if the connection itself were somehow compromised.'
      }
    ]
  },

  // ── SECURITY: HOW PASSWORDS ARE STORED ───────────────────────────────
  {
    id: 'sec-storage',
    category: 'Security & Passwords',
    title: 'How PlanIt stores and protects your passwords',
    icon: Database,
    tags: ['password storage', 'bcrypt', 'hash', 'security', 'stored', 'encrypted', 'hashed'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt never stores passwords in readable form. Both the account (organizer) password and the event password are hashed using bcrypt before being written to the database.'
      },
      {
        type: 'steps',
        items: [
          { title: 'bcrypt hashing', body: 'When you set a password, PlanIt runs it through bcrypt — a deliberately slow, salted hashing algorithm designed to make brute-force cracking computationally expensive. The hash (not the password) is stored in MongoDB.' },
          { title: 'No plaintext, anywhere', body: 'Not in the database, not in logs, not in error messages. Even if someone obtained a full database dump, they would only have bcrypt hashes — not usable passwords.' },
          { title: 'Verification without storage', body: 'When you enter your password, bcrypt re-runs the hash computation and compares the result to the stored hash. If they match, you\'re authenticated. The password itself never needs to be stored or decrypted.' },
          { title: 'Why no password recovery?', body: 'The no-recovery design is a direct consequence of hashing. PlanIt cannot tell you your password because it doesn\'t know it — only you do. There is no "forgot password" flow because there is no email address on file and nothing to send.' },
          { title: 'Separate hashes', body: 'The account password and event password are hashed and stored as completely separate fields. Knowing one does not help you derive the other.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'The flip side of secure hashing: there is truly no recovery. If you lose your password, neither you nor PlanIt support can retrieve it. Use a password manager.'
      }
    ]
  },

  // ── DATA: INFRASTRUCTURE ──────────────────────────────────────────────
  {
    id: 'data-infrastructure',
    category: 'Data & Privacy',
    title: 'PlanIt\'s infrastructure: how it all fits together',
    icon: Server,
    tags: ['infrastructure', 'backend', 'architecture', 'load balancer', 'multi-backend', 'render', 'scaling', 'router'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt runs as a distributed system across multiple services. Understanding the architecture helps explain why cold starts happen, how auto-scaling works, and why the status page covers several services separately.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'API Backend Fleet',
            color: 'neutral',
            desc: 'Multiple Node.js/Express backend instances, each running Socket.IO for real-time communication.',
            features: [
              'Handles all API requests, authentication, and WebSocket connections',
              'Multiple instances run simultaneously to share load',
              'Each instance connects to the same shared MongoDB database',
              'Hosted on Render\'s cloud platform',
              'May experience cold-start delays after 15 min of inactivity',
            ],
            best: ''
          },
          {
            label: 'Load Balancer / Router',
            color: 'neutral',
            desc: 'A dedicated routing service that distributes incoming requests across the backend fleet.',
            features: [
              'Performs health checks on every backend instance',
              'Routes requests away from unhealthy instances automatically',
              'Enables zero-downtime deployments and backend restarts',
              'Runs as a separate service — listed separately on the status page',
              'Retries failed requests transparently before returning an error',
            ],
            best: ''
          },
          {
            label: 'Watchdog Monitor',
            color: 'neutral',
            desc: 'An independent monitoring process that observes the entire fleet.',
            features: [
              'Pings every backend instance every 60 seconds',
              'Three consecutive failures trigger an automatic incident',
              'Fires urgent alerts to the operator via ntfy push notifications',
              'Completely independent — continues monitoring even if a backend is down',
              'Powers the automated incident creation on the status page',
            ],
            best: ''
          }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'All services are hosted on Render\'s free or starter tier, which means cold-start delays are an expected characteristic of the platform. The system compensates with health checks and automatic rerouting, but the first request after a long idle period may be slow. Always warm the server before your event.'
      }
    ]
  },

  // ── DATA: WATCHDOG MONITORING ─────────────────────────────────────────
  {
    id: 'data-watchdog',
    category: 'Data & Privacy',
    title: 'How the watchdog monitors platform health',
    icon: Activity,
    tags: ['watchdog', 'monitoring', 'health', 'uptime', 'alerts', 'detection', 'automatic', 'ping'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt runs a dedicated watchdog service that continuously monitors every backend instance. It detects outages faster than any user report and triggers incident creation automatically — even in the middle of the night.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Heartbeat pings every 60 seconds', body: 'The watchdog sends a health check request to every backend instance on a 60-second cycle. Each ping checks that the server responds with an expected status within a timeout window.' },
          { title: 'Three strikes trigger an incident', body: 'If a backend fails three consecutive health checks (3 minutes of non-response), the watchdog creates an incident on the status page automatically and fires an urgent push notification to the operator via ntfy. This happens without any human intervention.' },
          { title: 'Recovery detection', body: 'When a failed backend starts responding again, the watchdog detects the recovery and updates the incident status to "Monitoring" automatically. If the service stays healthy for a recovery window, the incident is resolved.' },
          { title: 'Independent operation', body: 'The watchdog is a completely separate service from the backends it monitors. A backend being down does not affect the watchdog\'s ability to detect and report the outage.' },
          { title: 'What this means for event day', body: 'If something goes wrong while you\'re running an event, the watchdog will detect it and create an incident on the status page within minutes — often before any user has time to notice and report it. Check the status page first whenever something feels wrong.' },
        ]
      }
    ]
  },

  // ── DATA: REAL-TIME ARCHITECTURE ──────────────────────────────────────
  {
    id: 'data-realtime',
    category: 'Data & Privacy',
    title: 'How real-time updates work (Socket.IO)',
    icon: Wifi,
    tags: ['real-time', 'websocket', 'socket.io', 'live', 'broadcast', 'room', 'event-driven', 'sync'],
    content: [
      {
        type: 'intro',
        text: 'Every live update in PlanIt — chat messages, task completions, vote tallies, note changes, check-in admissions — is powered by Socket.IO WebSocket connections. Here\'s how the real-time layer works.'
      },
      {
        type: 'steps',
        items: [
          { title: 'One persistent connection per session', body: 'When you open a workspace, your browser establishes a persistent WebSocket connection to a backend instance. This connection stays open for the duration of your session, allowing instant two-way communication without polling.' },
          { title: 'Event rooms', body: 'Each event has its own Socket.IO room identified by the event ID. When something changes in your event, the backend emits an event to that room, and every connected session in the room receives it simultaneously.' },
          { title: 'What triggers a broadcast', body: 'Any write operation — a new message, a task completion, a poll vote, a new note, an expense entry, a check-in admission — emits a corresponding socket event to the event room. Every connected browser receives the event and updates its local state.' },
          { title: 'Reconnection handling', body: 'If the WebSocket connection drops (network blip, server restart), Socket.IO attempts to reconnect automatically. On successful reconnect, the workspace re-fetches current state from the database so any events missed during the disconnection are caught up.' },
          { title: 'The connection indicator', body: 'The small dot in the workspace header shows your real-time connection status: green (connected), amber (disconnected or reconnecting). When amber, changes you make are still saved to the database — they just won\'t appear live on other devices until the connection restores.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Socket.IO falls back to HTTP long-polling if WebSocket is blocked by a corporate firewall or network proxy. This means real-time features work even in restrictive network environments — they may just be slightly less immediate than a true WebSocket connection.'
      }
    ]
  },

  // ── DATA: RATE LIMITING OVERVIEW ──────────────────────────────────────
  {
    id: 'data-ratelimiting',
    category: 'Data & Privacy',
    title: 'Rate limiting: protecting the platform',
    icon: Ban,
    tags: ['rate limiting', 'throttle', '429', 'api limits', 'protection', 'abuse prevention', 'too many requests'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt applies layered rate limits to protect the platform from abuse, automated attacks, and runaway clients. Here is a reference for every rate limit in the system.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'Authentication',
            color: 'neutral',
            desc: 'Limits on login and organizer auth attempts:',
            features: [
              '20 failed authentication attempts per IP per 15 minutes',
              'After 20 failures, further attempts from that IP are blocked for 15 min',
              'Successful authentications do not count toward the limit',
              'Separate limits for event password entry vs organizer login',
            ],
            best: 'If locked out, wait 15 minutes before retrying.'
          },
          {
            label: 'Chat & Content',
            color: 'neutral',
            desc: 'Limits on chat and content creation:',
            features: [
              '30 chat messages per user per minute',
              '20 file uploads per IP per hour',
              '50 task creates per IP per hour',
              '50 poll creates per IP per hour',
            ],
            best: 'These limits are far above any normal usage pattern.'
          },
          {
            label: 'Event Creation & API',
            color: 'neutral',
            desc: 'Limits on event and API usage:',
            features: [
              '10 new events per IP per hour',
              '10,000 general API requests per IP per 15 minutes',
              'Check-in scans: 100 per minute per event',
            ],
            best: 'The 10,000 general API limit is very hard to hit through normal browser usage.'
          }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'All rate limits return a 429 status code when exceeded. The response includes a Retry-After value indicating when the limit resets. Rate limits reset on a rolling window — you don\'t need to wait until the top of the hour.'
      }
    ]
  },

  // ── DATA: LICENSE & PERMITTED USE ─────────────────────────────────────
  {
    id: 'data-license',
    category: 'Data & Privacy',
    title: 'License and permitted use',
    icon: Eye,
    tags: ['license', 'usage', 'permitted', 'allowed', 'terms', 'commercial', 'source code', 'open source'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt is a proprietary application built and operated by Aakshat Hariharan. The source code is not open source. Here is what is and is not permitted when using PlanIt.'
      },
      {
        type: 'compare',
        items: [
          {
            label: 'Permitted',
            color: 'neutral',
            desc: 'You are free to:',
            features: [
              'Use PlanIt to plan personal and professional events',
              'Use PlanIt for commercial events (conferences, galas, corporate dinners)',
              'Use PlanIt in Table Service mode for your restaurant or venue',
              'Share the workspace link with your team, guests, and vendors',
              'Export and retain any data you generate',
            ],
            best: ''
          },
          {
            label: 'Not Permitted',
            color: 'neutral',
            desc: 'The following are not permitted:',
            features: [
              'Reselling or white-labeling PlanIt as your own product',
              'Reverse-engineering or scraping the application code',
              'Automated bot usage or scraping workspace data',
              'Using PlanIt for illegal purposes or storing illegal content',
              'Attempting to circumvent rate limits or security controls',
            ],
            best: ''
          }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Questions about commercial use or enterprise licensing beyond what the platform currently offers? Email planit.userhelp@gmail.com.'
      }
    ]
  },

  // ── ABOUT PLANIT: WHY NO ACCOUNT ──────────────────────────────────────
  {
    id: 'about-philosophy',
    category: 'Getting Started',
    title: 'The PlanIt philosophy: why no account and no email',
    icon: Star,
    tags: ['philosophy', 'no account', 'why', 'design decision', 'privacy', 'anonymous', 'friction', 'fast setup'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt was designed around a single constraint: zero setup friction. No account. No email. No registration flow. You should be planning in under two minutes. Here\'s the thinking behind that decision and what it means in practice.'
      },
      {
        type: 'steps',
        items: [
          { title: 'The problem with accounts', body: 'Most event tools start by asking you to register — email, password, email verification, profile setup. For a tool you might only use twice a year, that barrier kills momentum. By the time you\'re verified, you\'ve already switched to a group chat.' },
          { title: 'What "no account" actually means', body: 'PlanIt stores no email addresses, no personal profiles, and no persistent identity. Your organizer identity is your account password — a single credential that proves you created the event. That\'s the entire identity model.' },
          { title: 'The link is the key', body: 'Your event workspace is accessed by URL. Whoever has the link can join (subject to the event password if set). The organizer proves their identity with the account password. Everyone else just needs a display name.' },
          { title: 'The tradeoff', body: 'No account means no recovery. If you lose the organizer password, it\'s gone — there\'s no email to send a reset link to. If you lose the event link, you need to ask whoever shared it with you. These tradeoffs are intentional: they are the cost of the privacy and speed that the no-account model provides.' },
          { title: 'Why this works for events', body: 'Events are time-bounded. You plan for a few weeks, run the event, and then it\'s over. The kind of persistent account management that makes sense for a year-round project tool is overkill for a 3-week planning sprint. PlanIt optimizes for exactly this lifecycle.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'PlanIt was originally built to solve a real problem: planning an event across group chats, email threads, shared spreadsheets, and scattered note apps is genuinely exhausting. A single shared workspace that requires no setup was the solution. That origin shapes every design decision.'
      }
    ]
  },

  // ── ABOUT PLANIT: THE CREATOR ─────────────────────────────────────────
  {
    id: 'about-creator',
    category: 'Contact & Support',
    title: 'About PlanIt and the person who built it',
    icon: Info,
    tags: ['about', 'creator', 'developer', 'who made this', 'built by', 'one person', 'self-taught', 'aakshat', 'background'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt is built and operated by one person — Aakshat Hariharan, a self-taught developer based in New Jersey. This page has the full background on who built it and why.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Why it was built', body: 'PlanIt started as a solution to a specific frustration: organising an event across group chats, email threads, shared spreadsheets, and scattered note apps is genuinely exhausting. Every tool either did too little or required too much setup. PlanIt was the solution — a single workspace where the entire event lives, with no account required.' },
          { title: 'What it became', body: 'What started as a simple planning tool grew into a full-stack distributed system: a multi-backend fleet with auto-scaling, a dedicated load-balancing router, a separate watchdog monitoring service, mesh authentication between services, a real-time check-in platform with multi-layer anti-fraud middleware, and a public status page that updates itself. None of that was in the original plan.' },
          { title: 'The background', body: 'No computer science degree. No bootcamp. Self-taught, building through projects. The work extends into cybersecurity — pentesting, security analysis, and vulnerability research. That background informs how PlanIt is built: rate limiting is layered, passwords are hashed correctly, API responses are cryptographically signed, and internal service communication is HMAC-authenticated with replay protection.' },
          { title: 'The tech stack', body: 'React + Vite + Tailwind CSS on the frontend. Node.js + Express + Socket.IO on the backend. MongoDB for the database. Redis for caching. Cloudinary for file storage. JWT for authentication. All hosted on Render.' },
          { title: 'Contact and about page', body: 'The full About page is at planitapp.onrender.com/about — it covers every feature in depth along with technical details. GitHub: github.com/Aaks-hatH. Email: hariharanaakshat@gmail.com. Personal site: aaks-hath.pages.dev.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Support is operated by the same person who built it. That means responses are thorough and genuinely engaged — but not instantaneous. Expect a reply within 48 business hours.'
      }
    ]
  },

  // ── ABOUT PLANIT: DESIGN ──────────────────────────────────────────────
  {
    id: 'about-design',
    category: 'Getting Started',
    title: 'PlanIt\'s design: dark backgrounds, stars, and the color system',
    icon: Globe,
    tags: ['design', 'dark background', 'stars', 'shooting stars', 'colors', 'ui', 'style', 'theme', 'aesthetic'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt uses a deliberate visual language. The dark landing page, animated star background, and consistent color-per-page system are all intentional design decisions. Here\'s the reasoning behind each one.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Why the dark background on the landing page', body: 'The dark background communicates gravity and polish — it signals that this is a professional tool, not a lightweight prototype. The contrast between the dark hero and the bright white workspace creates a clear visual transition from "choosing a tool" to "actively using it". Dark also makes the star animation visible in a way that a light background never could.' },
          { title: 'The star background', body: 'The landing page has a canvas-based animated star field: ~100 static stars, ~30 twinkling stars that pulse in opacity, and occasional shooting stars — bright streaks that drift across the canvas on a random schedule. The animation runs at a capped frame rate to minimise CPU and battery usage. Stars are recalculated on window resize so the canvas always fills the full viewport.' },
          { title: 'The page color system', body: 'Different pages in PlanIt use different neutral background tones to help orient users. The landing page is near-black (#0a0a0a). The workspace uses a warm off-white (#f8f8f6). The About page uses the same off-white. The Help center uses a light gray. These subtle differences help users immediately recognise which "mode" of the product they are in.' },
          { title: 'Workspace UI philosophy', body: 'Inside the workspace, the design is intentionally neutral — black, white, and grays. Color is reserved for meaning: red for high priority, amber for warnings, green for connected/live, blue for informational callouts. When color appears, it means something.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'The full design rationale is documented on the About page at planitapp.onrender.com/about — the "Why the dark background", "Stars and shooting stars", and "Page color system" sections cover this in complete depth.'
      }
    ]
  },

  // ── ERRORS: SOCKET DISCONNECT DURING CHECK-IN ─────────────────────────
  {
    id: 'err-checkin-disconnect',
    category: 'Errors & Troubleshooting',
    title: 'Check-in scanner disconnected during the event',
    icon: WifiOff,
    tags: ['check-in disconnected', 'scanner offline', 'offline checkin', 'no signal', 'venue wifi', 'lost connection', 'event day emergency'],
    content: [
      {
        type: 'intro',
        text: 'If the check-in scanner loses its connection during the event, PlanIt\'s offline mode activates automatically. No panic — scans continue working from the local cache. Here\'s exactly what to do.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Confirm offline mode has activated', body: 'The connection indicator in the check-in dashboard turns amber. A yellow "Offline mode — scans queued" banner may appear. The scanner continues to work — it\'s now reading from the locally cached guest list.' },
          { title: 'Continue scanning normally', body: 'Keep scanning. Every admission is recorded locally and queued. The guest name, party size, table assignment, and organizer notes all display correctly from cache. Guests are admitted as normal.' },
          { title: 'Watch the pending counter', body: 'A "Pending: N" badge shows how many admissions are queued. This number grows as you scan. Do not worry about it — it will sync when connectivity returns.' },
          { title: 'For guests not in the cache', body: 'If a guest\'s QR code shows "not found" during offline mode, they may have been added to the guest list after the cache was built. Use manager override — enter their name manually. Override checks the server when it can, or queues the entry.' },
          { title: 'When connectivity returns', body: 'The queue flushes automatically. The pending counter counts down to zero. The connection indicator turns green. Check the audit log for any conflict flags — these need manual review.' },
          { title: 'If connectivity never returns', body: 'The sync queue persists until the device reconnects to the internet. Even if the device leaves the venue, it will flush the queue the next time it connects to any network. For immediate post-event records, ensure at least one device reconnects before going fully offline.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'The offline cache is built when the check-in page first loads. If you open the check-in page for the first time while already offline, there is no cache and scanning will fail entirely. Always load the check-in dashboard while on WiFi before entering a low-signal area.'
      }
    ]
  },

  // ── ERRORS: ICS / CALENDAR EXPORT ISSUE ──────────────────────────────
  {
    id: 'err-ics',
    category: 'Errors & Troubleshooting',
    title: 'Calendar file (.ics) not importing correctly',
    icon: Calendar,
    tags: ['ics', 'calendar', 'import', 'google calendar', 'outlook', 'apple calendar', 'not working', 'export'],
    content: [
      {
        type: 'intro',
        text: 'If the downloaded .ics file isn\'t importing into your calendar app correctly, here\'s how to fix it.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Double-check the file downloaded completely', body: 'The file should be named something like planit-event.ics and be a few KB in size. If it\'s 0 bytes or the download seemed to fail, try downloading again.' },
          { title: 'Google Calendar', body: 'Go to calendar.google.com. Click the gear → Settings → Import & Export → Import. Select the .ics file. Choose which calendar to add it to. Click Import.' },
          { title: 'Apple Calendar (Mac)', body: 'Double-click the .ics file in Finder. Calendar opens and asks which calendar to add the event to. Click Add.' },
          { title: 'Apple Calendar (iOS)', body: 'Open the .ics file from Files or your email. A prompt appears asking to add the event to your calendar. Tap Add All.' },
          { title: 'Outlook', body: 'Open Outlook, go to File → Open & Export → Import/Export → Import an iCalendar (.ics) file. Browse to the downloaded file and confirm.' },
          { title: 'Timezone appears wrong', body: 'The .ics file includes the event\'s timezone (set at event creation). If the event time appears offset in your calendar app, check that your calendar app\'s timezone settings match your local timezone.' },
        ]
      }
    ]
  },

  // ── SETTINGS: ANTI-FRAUD CONFIGURATION ───────────────────────────────
  {
    id: 'acct-antifraud-config',
    category: 'Settings & Customisation',
    title: 'Configuring check-in security settings (Enterprise)',
    icon: ShieldAlert,
    tags: ['check-in settings', 'security settings', 'anti-fraud', 'trust score', 'auto block', 'capacity', 'time window', 'middleware'],
    content: [
      {
        type: 'intro',
        text: 'Enterprise mode\'s check-in security settings let you fine-tune how strict the anti-fraud system is. Here\'s a complete reference for every configurable parameter.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open check-in settings', body: 'Log in as organizer. In the check-in dashboard, click the settings icon (gear). The security settings panel opens.' },
          { title: 'Time window', body: 'Set how many hours before and after the event start time check-in QRs are valid. Default is 2 hours before to 2 hours after. Tighten this for high-security events. Widen it if guests may arrive very early or if you\'re running a multi-hour check-in window.' },
          { title: 'Minimum trust score', body: 'Set the threshold below which admissions are flagged or auto-blocked. Default: 60. A score of 0–100 is calculated per scan. Setting this higher increases security; setting it lower or to 0 effectively disables score-based blocking.' },
          { title: 'Auto-blocking', body: 'When enabled, scans below the minimum trust score are automatically denied without showing on a manual review queue. When disabled, low-score scans are flagged for the organizer to review but are not auto-denied.' },
          { title: 'Venue capacity limit', body: 'Enter the maximum number of people the venue can hold. Once the admitted count reaches this number, further admissions are blocked. Leave blank for no capacity enforcement.' },
          { title: 'Enable/disable individual middleware layers', body: 'Each layer (duplicate check, time window, trust score, capacity) can be toggled independently. For low-security events you may want to disable the trust score layer to avoid false positives. For high-security events, keep all layers active.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'Changes to check-in settings take effect immediately for all active scanning sessions. If you change the time window or minimum trust score mid-event, ongoing check-in behavior changes instantly. Test your settings before doors open.'
      }
    ]
  },

  // ── PLANNING TOOLS: PEOPLE / PRESENCE ────────────────────────────────
  {
    id: 'tool-presence',
    category: 'Planning Tools',
    title: 'Real-time presence: who\'s currently online',
    icon: Users,
    tags: ['presence', 'online', 'connected', 'active', 'who\'s here', 'live count', 'header', 'status'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt shows live presence information across the workspace — you can always see who is currently connected without opening the People tab.'
      },
      {
        type: 'steps',
        items: [
          { title: 'The live count in the header', body: 'The workspace header shows a pulsing green dot and a number — the count of currently connected participants. It updates in real time as people join and leave. This count is visible from any tab in the workspace.' },
          { title: 'People tab for the full list', body: 'Open the People tab for a complete list of every participant who has joined since the workspace was created. Green indicators mark those currently active.' },
          { title: 'Offline participants', body: 'Participants who joined previously but closed their browser show as offline in the People list. Their messages, tasks, and contributions remain — only their live connection status has changed.' },
          { title: 'Organizer identification', body: 'The organizer is visually distinct in the People list — marked with a shield or crown badge.' },
          { title: 'Typing indicators', body: 'In the Chat tab, when someone is composing a message, a typing indicator appears below the chat showing their username. This disappears when they send or stop typing.' },
        ]
      }
    ]
  },

  // ── CONTACT: WHAT TO INCLUDE IN A REPORT ─────────────────────────────
  {
    id: 'support-best-report',
    category: 'Contact & Support',
    title: 'Writing an effective bug report',
    icon: ClipboardList,
    tags: ['bug report', 'what to include', 'how to report', 'effective', 'useful', 'details', 'reproduce'],
    content: [
      {
        type: 'intro',
        text: 'A good bug report gets a fast, accurate fix. A vague one takes multiple back-and-forth emails before even understanding the problem. Here\'s exactly what to include.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Your event link', body: 'Include the full URL of your event workspace (e.g. planitapp.onrender.com/e/your-slug). This lets us look up the server-side logs for your specific event.' },
          { title: 'Exact steps to reproduce', body: 'Describe every step: "I opened the Tasks tab, clicked Add Task, filled in the title, clicked Save, and then saw the spinner hang indefinitely." The more specific, the faster the diagnosis.' },
          { title: 'What you expected', body: 'Tell us what should have happened. "The task should have appeared in the list."' },
          { title: 'What actually happened', body: 'Tell us what did happen. "The spinner ran for 30 seconds, then I got a red toast saying \'Server error\', and the task didn\'t appear."' },
          { title: 'Browser and device', body: 'Include: browser name and version (e.g. Chrome 124, Safari 17), device type (desktop, iOS phone, Android tablet), and OS version if relevant.' },
          { title: 'Approximate time', body: 'Include the date and approximate time the issue occurred. This helps narrow down which log entries to look at.' },
          { title: 'Screenshot or screen recording', body: 'Attach a screenshot of any error message. A 15-second screen recording of the issue saves more diagnosis time than a paragraph of description.' },
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Send to planit.userhelp@gmail.com with subject "Bug Report: [short description]". Screenshots and recordings go a long way. The more detail you include, the faster the turnaround.'
      }
    ]
  },

  // ── TABLE SERVICE: OVERVIEW PANEL ─────────────────────────────────────
  {
    id: 'ts-overview-panel',
    category: 'Table Service',
    title: 'The Table Service overview panel',
    icon: LayoutGrid,
    tags: ['overview', 'table service', 'summary', 'occupancy', 'statistics', 'dashboard'],
    content: [
      {
        type: 'intro',
        text: 'The Overview panel in Table Service mode gives a high-level summary of your venue\'s current state — occupancy stats, operating hours, and any notes for tonight\'s service.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Overview tab', body: 'Click "Overview" in the right sidebar of the Table Service dashboard. It is the first tab in the sidebar.' },
          { title: 'Occupancy breakdown', body: 'The panel shows counts for each table state: how many tables are available, occupied, reserved, cleaning, and unavailable. Total capacity (sum of all table capacities) and currently seated guests are shown.' },
          { title: 'Operating hours', body: 'Your configured open and close times are displayed. If the current time is within operating hours, a green "Open" indicator shows. Outside hours, it shows "Closed".' },
          { title: 'Welcome message', body: 'If you set a welcome message in Settings, it appears at the top of the Overview tab. Use it for tonight\'s specials, shift-specific notes, or reminders for staff.' },
          { title: 'Turn time estimation', body: 'Based on current occupancy and your configured average dining duration, the panel shows an estimated number of tables expected to turn in the next 30 minutes. Useful for waitlist management and staffing decisions.' },
        ]
      }
    ]
  },

  // ── ENTERPRISE: ANALYTICS DEEP DIVE ───────────────────────────────────
  {
    id: 'ent-analytics-deep',
    category: 'Enterprise & Check-in',
    title: 'Reading the analytics dashboard: every metric explained',
    icon: BarChart3,
    tags: ['analytics', 'metrics', 'attendance', 'admitted', 'denied', 'arrival time', 'table fill', 'override count'],
    content: [
      {
        type: 'intro',
        text: 'The Enterprise analytics dashboard updates live throughout check-in and gives a complete picture of attendance. Here is what every number and chart means.'
      },
      {
        type: 'steps',
        items: [
          { title: 'Total invited', body: 'The total number of guest records on the list — everyone who was sent an invite, regardless of whether they RSVP\'d or checked in.' },
          { title: 'Total admitted', body: 'The count of guests who successfully checked in through either QR scan or manager override. This is the "attendance" number.' },
          { title: 'Total denied', body: 'Guests who attempted to check in but were rejected by the anti-fraud system (duplicate scan, outside time window, low trust score, capacity limit, or block list).' },
          { title: 'Attendance percentage', body: 'Admitted ÷ Total invited × 100. Updates live.' },
          { title: 'Arrival timeline', body: 'A chronological chart showing when guests were admitted over the event window. Each bar represents a 15-minute interval. This shows you when the peak arrival wave was, useful for planning staffing at future events.' },
          { title: 'Table fill breakdown', body: 'For events with table assignments, a per-table bar shows checked-in guests vs. total assigned. Tables that are fully filled show in green; partially filled in amber; unfilled in gray.' },
          { title: 'QR vs override split', body: 'A count of how many admissions came from QR scans versus manager overrides. A high override count suggests guests had trouble accessing their QR codes — useful feedback for future communication.' },
          { title: 'Trust score distribution', body: 'A histogram of trust scores across all check-in attempts. Most admissions should cluster in the 80–100 range. A long tail toward 0 may indicate unusual scanning patterns worth investigating.' },
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'All analytics data is deleted permanently 7 days after the event date. Take screenshots or note the key figures before the deletion window. There is no export button — manual capture is the current method.'
      }
    ]
  },
];
ARTICLES.push(...ARTICLES_EXTRA);

const POPULAR = ['gs-create', 'err-service-crash', 'err-loading', 'err-password', 'ent-checkin', 'data-retention', 'ts-overview', 'ts-waitlist'];

/* ─── SUB-COMPONENTS ────────────────────────────────────────────────────────── */

function StepBlock({ items }) {
  return (
    <ol className="space-y-4 mt-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-black flex items-center justify-center mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-900 mb-1">{item.title}</p>
            <p className="text-sm text-neutral-600 leading-relaxed">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CalloutBlock({ variant, text }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    danger:  'bg-red-50 border-red-200 text-red-800',
  };
  const icons = {
    warning: AlertTriangle,
    info:    Info,
    danger:  Ban,
  };
  const Icon = icons[variant] || Info;
  return (
    <div className={`flex gap-3 p-4 rounded-xl border my-4 text-sm leading-relaxed ${styles[variant] || styles.info}`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function CompareBlock({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      {items.map((item, i) => (
        <div key={i} className="border border-neutral-200 rounded-2xl p-5">
          <p className="text-sm font-black text-neutral-900 mb-1">{item.label}</p>
          <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{item.desc}</p>
          <ul className="space-y-1.5">
            {item.features.map((f, j) => (
              <li key={j} className="flex items-start gap-2 text-xs text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          {item.best && (
            <p className="mt-3 text-xs text-neutral-400 italic">Best for: {item.best}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function FAQBlock({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Frequently Asked Questions</p>
      {items.map((item, i) => (
        <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-semibold text-neutral-800">{item.q}</span>
            {open === i ? <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />}
          </button>
          {open === i && (
            <div className="px-4 pb-4 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ArticleContent({ article }) {
  return (
    <div className="space-y-2">
      {article.content.map((block, i) => {
        if (block.type === 'intro')   return <p key={i} className="text-sm text-neutral-600 leading-relaxed">{block.text}</p>;
        if (block.type === 'steps')   return <StepBlock key={i} items={block.items} />;
        if (block.type === 'callout') return <CalloutBlock key={i} variant={block.variant} text={block.text} />;
        if (block.type === 'compare') return <CompareBlock key={i} items={block.items} />;
        if (block.type === 'faq')     return <FAQBlock key={i} items={block.items} />;
        return null;
      })}
    </div>
  );
}

function ArticleCard({ article, onClick, isNew }) {
  const Icon = article.icon;
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:bg-white hover:shadow-sm transition-all group bg-white"
    >
      <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-900 transition-colors">
        <Icon className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-neutral-900 leading-snug">{article.title}</p>
          {isNew && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">NEW</span>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">{article.category}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-700 flex-shrink-0 mt-1 transition-colors" />
    </button>
  );
}


/* ─── BUG REPORT MODAL ───────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: 'bug',      label: ' Bug — Something is broken' },
  { value: 'error',    label: ' Error I see an error message' },
  { value: 'checkin',  label: ' Check-in, QR / entry issue' },
  { value: 'account',  label: ' Account, Password / access issue' },
  { value: 'feature',  label: ' Feature Request' },
  { value: 'other',    label: ' Other' },
];

const SEVERITY_OPTIONS = [
  { value: 'low',      label: ' Low, Minor inconvenience' },
  { value: 'medium',   label: ' Medium, Something important isn\'t working' },
  { value: 'high',     label: ' High, Majorly blocking my event' },
  { value: 'critical', label: ' Critical, Event day emergency' },
];

function BugReportModal({ open, onClose }) {
  const EMPTY = { name: '', email: '', category: 'bug', severity: 'medium', summary: '', description: '', eventLink: '', browser: '' };
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
    if (!form.summary || form.summary.length < 5) e.summary = 'At least 5 characters';
    if (!form.description || form.description.length < 10) e.description = 'At least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Auto-detect browser if field left empty
      const browser = form.browser || navigator.userAgent.slice(0, 120);
      await bugReportAPI.submit({ ...form, browser });
      setDone(true);
    } catch (err) {
      const msg = err?.response?.data?.errors?.[0]?.msg
               || err?.response?.data?.error
               || 'Failed to submit. Please try emailing planit.userhelp@gmail.com directly.';
      setErrors({ _global: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    setErrors({});
    setDone(false);
    setLoading(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-neutral-900">Report an Issue</h2>
              <p className="text-xs text-neutral-400">We'll email you when it's fixed</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-2">Report received!</h3>
            <p className="text-sm text-neutral-500 mb-1">We'll look into this and email you at</p>
            <p className="text-sm font-bold text-neutral-900 mb-6">{form.email}</p>
            <p className="text-xs text-neutral-400 mb-6">
              For urgent event-day issues also check{' '}
              <a href="/status" className="underline font-medium">planitapp.onrender.com/status</a>
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errors._global && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {errors._global}
              </div>
            )}

            {/* Name + Email row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Your name</label>
                <input
                  value={form.name} onChange={set('name')}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email" value={form.email} onChange={set('email')}
                  placeholder="you@example.com"
                  className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors ${errors.email ? 'border-red-400' : 'border-neutral-200'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Category + Severity row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Category</label>
                <select
                  value={form.category} onChange={set('category')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-900 bg-white transition-colors"
                >
                  {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Severity</label>
                <select
                  value={form.severity} onChange={set('severity')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-900 bg-white transition-colors"
                >
                  {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Summary <span className="text-red-500">*</span></label>
              <input
                value={form.summary} onChange={set('summary')}
                placeholder="One line description of the problem"
                maxLength={150}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors ${errors.summary ? 'border-red-400' : 'border-neutral-200'}`}
              />
              {errors.summary && <p className="text-xs text-red-500 mt-1">{errors.summary}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                What happened? <span className="text-red-500">*</span>
                <span className="font-normal text-neutral-400 ml-1">(steps to reproduce, what you expected vs what occurred)</span>
              </label>
              <textarea
                value={form.description} onChange={set('description')}
                rows={4}
                maxLength={2000}
                placeholder="1. I clicked... 2. I expected... 3. Instead I saw..."
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-none ${errors.description ? 'border-red-400' : 'border-neutral-200'}`}
              />
              <div className="flex justify-between">
                {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                <p className="text-xs text-neutral-300 ml-auto">{form.description.length}/2000</p>
              </div>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Event link <span className="text-neutral-400 font-normal">(optional)</span></label>
                <input
                  value={form.eventLink} onChange={set('eventLink')}
                  placeholder="planitapp.onrender.com/e/..."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Browser / device <span className="text-neutral-400 font-normal">(optional)</span></label>
                <input
                  value={form.browser} onChange={set('browser')}
                  placeholder="e.g. Chrome on iPhone"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">
                We'll email you at <strong>{form.email || 'your address'}</strong> when resolved.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Sending…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


/* ─── MAIN PAGE ─────────────────────────────────────────────────────────────── */

export default function Help() {
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeArticle, setActiveArticle] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef(null);
  const articleRef = useRef(null);

  const filtered = useMemo(() => {
    let base = ARTICLES;
    if (activeCategory !== 'all') base = base.filter(a => a.category === activeCategory);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.tags.some(t => t.includes(q)) ||
      a.content.some(block => {
        if (block.type === 'intro') return block.text.toLowerCase().includes(q);
        if (block.type === 'steps') return block.items.some(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q));
        return false;
      })
    );
  }, [query, activeCategory]);

  const popularArticles = ARTICLES.filter(a => POPULAR.includes(a.id));
  const currentArticle = activeArticle ? ARTICLES.find(a => a.id === activeArticle) : null;
  const ArticleIcon = currentArticle?.icon || BookOpen;

  useEffect(() => {
    if (activeArticle && articleRef.current) {
      articleRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeArticle]);

  function openArticle(id) {
    setActiveArticle(id);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
    <BugReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <style>{`html { scroll-behavior: smooth; } body { background: #f8f8f6; }`}</style>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (currentArticle) { setActiveArticle(null); } else { navigate('/'); } }}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {currentArticle ? 'Help Center' : 'Back'}
            </button>
            <span className="text-neutral-300">|</span>
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-bold text-neutral-900">PlanIt Help Center</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <a href="/status" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Status
            </a>
            <span className="text-neutral-200">·</span>
            <button onClick={() => setReportOpen(true)} className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors">Report an Issue</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Article view ── */}
        {currentArticle ? (
          <div className="flex gap-8">
            {/* Back / related sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 space-y-4">
                <button
                  onClick={() => setActiveArticle(null)}
                  className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All articles
                </button>
                <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-2">In this category</p>
                <nav className="space-y-0.5">
                  {ARTICLES.filter(a => a.category === currentArticle.category).map(a => (
                    <button
                      key={a.id}
                      onClick={() => openArticle(a.id)}
                      className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${a.id === activeArticle ? 'bg-neutral-900 text-white font-semibold' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'}`}
                    >
                      {a.title}
                    </button>
                  ))}
                </nav>
                <div className="mt-6 p-4 bg-white border border-neutral-200 rounded-2xl">
                  <p className="text-xs font-bold text-neutral-900 mb-1">Still stuck?</p>
                  <p className="text-xs text-neutral-500 mb-3">Our support team is here to help.</p>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 hover:underline"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Report an Issue
                  </button>
                </div>
              </div>
            </aside>

            {/* Article body */}
            <main className="flex-1 min-w-0" ref={articleRef}>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-xs text-neutral-400 mb-6">
                <button onClick={() => setActiveArticle(null)} className="hover:text-neutral-700 transition-colors">Help Center</button>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => { setActiveArticle(null); setActiveCategory(currentArticle.category); }} className="hover:text-neutral-700 transition-colors">{currentArticle.category}</button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-neutral-600 font-medium truncate">{currentArticle.title}</span>
              </nav>

              <div className="bg-white rounded-2xl border border-neutral-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <ArticleIcon className="w-5 h-5 text-neutral-700" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 font-medium">{currentArticle.category}</p>
                    <h1 className="text-xl font-black text-neutral-900 leading-tight">{currentArticle.title}</h1>
                  </div>
                </div>

                <ArticleContent article={currentArticle} />

                {/* Footer */}
                <div className="mt-10 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">Was this article helpful?</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      If not, email us at{' '}
                      <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-700 underline underline-offset-2 font-medium">planit.userhelp@gmail.com</a>
                    </p>
                  </div>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-700 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Report an Issue
                  </button>
                </div>
              </div>

              {/* Related articles */}
              <div className="mt-6">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Related articles</p>
                <div className="space-y-2">
                  {ARTICLES
                    .filter(a => a.id !== currentArticle.id && (a.category === currentArticle.category || a.tags.some(t => currentArticle.tags.includes(t))))
                    .slice(0, 4)
                    .map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} isNew={['ent-walkie','ent-seating'].includes(a.id)} />)
                  }
                </div>
              </div>
            </main>
          </div>
        ) : (
          /* ── Home view ── */
          <>
            {/* Hero + search */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full text-xs font-semibold text-neutral-300 mb-5">
                <LifeBuoy className="w-3.5 h-3.5" />
                Help Center
              </div>
              <h1 className="text-4xl font-black text-neutral-900 mb-3">How can we help?</h1>
              <p className="text-base text-neutral-500 mb-8 max-w-lg mx-auto">
                Search for a feature, an error message, or anything you need help with.
              </p>

              {/* Search bar */}
              <div className="relative max-w-xl mx-auto mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActiveCategory('all'); }}
                  placeholder="Search — e.g. 'reset password', 'QR code', 'seating map'..."
                  className="w-full pl-11 pr-10 py-3.5 bg-white border-2 border-neutral-200 focus:border-neutral-900 rounded-2xl text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors shadow-sm"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick topic chips */}
              {!query && (
                <div className="flex flex-wrap justify-center gap-2">
                  {['getting started', 'check-in', 'forgot password', 'service crash', 'QR code', 'seating map', 'walkie-talkie', 'data deletion', 'cold start'].map(t => (
                    <button
                      key={t}
                      onClick={() => setQuery(t)}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-all shadow-sm"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search results */}
            {query && (
              <div className="mb-10">
                <p className="text-sm text-neutral-500 mb-4">
                  {filtered.length === 0
                    ? `No results for "${query}" — try different keywords or`
                    : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`
                  }
                  {filtered.length === 0 && (
                    <button onClick={() => setReportOpen(true)} className="ml-1 text-neutral-900 font-semibold underline underline-offset-2">submit a report</button>
                  )}
                </p>
                <div className="space-y-2">
                  {filtered.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} isNew={['ent-walkie','ent-seating'].includes(a.id)} />)}
                </div>
              </div>
            )}

            {!query && (
              <>
                {/* Popular articles */}
                <div className="mb-12">
                  <h2 className="text-lg font-black text-neutral-900 mb-4">Popular articles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {popularArticles.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} isNew={['ent-walkie','ent-seating'].includes(a.id)} />)}
                  </div>
                </div>

                <div className="flex gap-8">
                  {/* Category sidebar */}
                  <aside className="hidden lg:block w-52 flex-shrink-0">
                    <div className="sticky top-24">
                      <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-3">Browse by topic</p>
                      <nav className="space-y-0.5">
                        {CATEGORIES.map(cat => {
                          const CatIcon = cat.icon;
                          const count = cat.id === 'all' ? ARTICLES.length : ARTICLES.filter(a => a.category === cat.id).length;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setActiveCategory(cat.id)}
                              className={`w-full flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-lg transition-colors ${activeCategory === cat.id ? 'bg-neutral-900 text-white font-semibold' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'}`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <CatIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate text-xs">{cat.label}</span>
                              </span>
                              <span className={`text-xs flex-shrink-0 ${activeCategory === cat.id ? 'text-neutral-300' : 'text-neutral-300'}`}>{count}</span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </aside>

                  {/* Article list */}
                  <main className="flex-1 min-w-0">
                    {/* Mobile category scroll */}
                    <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${activeCategory === cat.id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                      if (activeCategory !== 'all' && activeCategory !== cat.id) return null;
                      const catArticles = ARTICLES.filter(a => a.category === cat.id);
                      if (catArticles.length === 0) return null;
                      const CatIcon = cat.icon;
                      return (
                        <div key={cat.id} className="mb-10">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                              <CatIcon className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="text-base font-black text-neutral-900">{cat.label}</h2>
                            <span className="text-xs text-neutral-400 font-medium">{catArticles.length} articles</span>
                          </div>
                          <div className="space-y-2">
                            {catArticles.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} isNew={['ent-walkie','ent-seating'].includes(a.id)} />)}
                          </div>
                        </div>
                      );
                    })}
                  </main>
                </div>

                {/* Contact banner */}
                <div className="mt-12 rounded-3xl bg-neutral-900 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-black text-white mb-1">Didn't find what you need?</h3>
                    <p className="text-sm text-neutral-400">
                      Describe your issue and we'll get back to you within 48 business hours.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                    <button
                      onClick={() => setReportOpen(true)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Report an Issue
                    </button>
                    <a
                      href="mailto:planit.userhelp@gmail.com"
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-800 text-white text-sm font-bold rounded-xl hover:bg-neutral-700 border border-neutral-700 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      planit.userhelp@gmail.com
                    </a>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}
