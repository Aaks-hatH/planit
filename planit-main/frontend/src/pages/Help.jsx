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
  LogOut, Copy, Navigation, Timer, PieChart, ClipboardList, Send, CheckCircle, Loader
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
    title: 'Standard mode vs Enterprise mode',
    icon: Zap,
    tags: ['standard', 'enterprise', 'mode', 'difference', 'guest', 'checkin', 'qr'],
    content: [
      {
        type: 'intro',
        text: 'PlanIt has two event modes. The mode is chosen at creation and cannot be changed afterward.'
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
          }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'You cannot switch modes after the event is created. If you chose Standard and realise you need the guest management system, you\'ll need to create a new event in Enterprise mode.'
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
    tags: ['delete', 'deletion', 'data', 'retention', '7 days', 'export', 'backup', 'cleanup'],
    content: [
      {
        type: 'intro',
        text: 'All event data is permanently deleted 7 days after the event\'s scheduled date. This policy applies to every event, without exception.'
      },
      {
        type: 'steps',
        items: [
          { title: 'What gets deleted', body: 'The event record, all messages, tasks, polls, notes, announcements, expenses, files, participant records, guest invitation records, check-in logs, and analytics data. Everything. Permanently.' },
          { title: 'When the deletion warning appears', body: 'As your event approaches the 7-day deletion window, a persistent amber warning banner appears at the top of every workspace page showing days remaining.' },
          { title: 'How to export before deletion', body: 'Use the Share tab: download the .ics calendar file, export the participant list, save any files from the Files tab. For analytics, take screenshots or note the key numbers before they\'re gone.' },
          { title: 'Early deletion', body: 'If you want your event data deleted before 7 days, email planit.userhelp@gmail.com with your event link. We\'ll process it manually.' }
        ]
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'There is NO recovery after deletion. The data is gone permanently. If you need records beyond 7 days, download or export them before the deletion date.'
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
          { title: 'Check Render', body: 'PlanIt runs on Render\'s web services. Check the Render Status page to see if Render is down, Or Check If the first load is slow, wait a minute and try again.' },
          { title: 'Check your event link', body: 'Make sure the URL is correct. An incorrect slug or event ID will show a "not found" error. The correct format is planitapp.onrender.com/e/your-slug or planitapp.onrender.com/event/[id].' },
          { title: 'Try a different browser', body: 'If the issue persists on one browser, try Chrome, Firefox, or Safari. Clear localStorage on your current browser (DevTools → Application → Local Storage → Clear).' },
          { title: 'Still broken?', body: 'Email planit.userhelp@gmail.com with your event link, the browser you\'re using, and a screenshot of any error messages. We\'ll investigate.' }
        ]
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Cold-start delays (30–60 second loading on first visit) are expected when the server has been idle. Our servers are kept warm at all times.'
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
        text: 'PlanIt\'s backend servers spin down after 15 minutes of inactivity (a Render free-tier limitation) and take 30–60 seconds to restart on the first request after being idle.'
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
  { label: 'All Articles',          icon: BookOpen,     id: 'all' },
  { label: 'Getting Started',       icon: Star,         id: 'Getting Started' },
  { label: 'Planning Tools',        icon: Calendar,     id: 'Planning Tools' },
  { label: 'Enterprise & Check-in', icon: UserCheck,    id: 'Enterprise & Check-in' },
  { label: 'Security & Passwords',  icon: Shield,       id: 'Security & Passwords' },
  { label: 'Data & Privacy',        icon: Database,     id: 'Data & Privacy' },
  { label: 'Errors & Troubleshooting', icon: AlertTriangle, id: 'Errors & Troubleshooting' },
  { label: 'Status & Monitoring',   icon: Activity,     id: 'Status & Monitoring' },
  { label: 'Settings & Customisation', icon: Settings,  id: 'Settings & Customisation' },
  { label: 'Contact & Support',     icon: LifeBuoy,     id: 'Contact & Support' },
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
];
ARTICLES.push(...ARTICLES_EXTRA);

const POPULAR = ['gs-create', 'err-service-crash', 'err-loading', 'err-password', 'ent-checkin', 'data-retention'];

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

function ArticleCard({ article, onClick }) {
  const Icon = article.icon;
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all group"
    >
      <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-200 transition-colors">
        <Icon className="w-4 h-4 text-neutral-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 leading-snug">{article.title}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{article.category}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 flex-shrink-0 mt-1 transition-colors" />
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
                    .map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} />)
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
                  placeholder="Search — e.g. 'reset password', 'QR code', 'service crash'..."
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
                  {['getting started', 'check-in', 'forgot password', 'service crash', 'QR code', 'data deletion', 'cold start'].map(t => (
                    <button
                      key={t}
                      onClick={() => setQuery(t)}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-all"
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
                  {filtered.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} />)}
                </div>
              </div>
            )}

            {!query && (
              <>
                {/* Popular articles */}
                <div className="mb-12">
                  <h2 className="text-lg font-black text-neutral-900 mb-4">Popular articles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {popularArticles.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} />)}
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
                            {catArticles.map(a => <ArticleCard key={a.id} article={a} onClick={() => openArticle(a.id)} />)}
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
