/**
 * Navigation map for the public PlanIt site. One definition feeds the floating
 * nav, the mobile sheet and the footer so the three can never drift apart.
 * Every `to` is a real route in App.jsx. `/?start=events|venue|rsvp` opens the
 * matching creation branch on the homepage.
 *
 * Top bar = what a first-time visitor needs: the product, Discover, Blog, and a
 * short Resources menu. Everything else (About, Careers, Support, Credits,
 * legal) lives in the footer only.
 */
import {
  Calendar, UtensilsCrossed, CheckSquare, Bot, Palette, BookOpen, LifeBuoy,
  Compass, Activity, PenLine, Building2, QrCode, ScrollText,
} from 'lucide-react';

export const PRODUCT = [
  { to: '/?start=events',  icon: Calendar,        title: 'PlanIt Events',    desc: 'Guest list, seating, team chat, tasks and check-in.' },
  { to: '/?start=venue',   icon: UtensilsCrossed, title: 'PlanIt Venue',     desc: 'Live floor map, waitlist, server and kitchen views.' },
  { to: '/?start=rsvp',    icon: CheckSquare,     title: 'RSVP pages',       desc: 'A shareable RSVP page, no workspace required.' },
  { to: '/white-label',    icon: Palette,         title: 'White label',      desc: 'Your brand, your domain, the full platform.' },
  { to: '/claude-connect', icon: Bot,             title: 'Claude connector', desc: 'Run your event from a Claude conversation.' },
];

export const RESOURCES = [
  { to: '/help',     icon: LifeBuoy, title: 'Help Center',   desc: 'Articles, how-tos and troubleshooting.' },
  { to: '/mcp-docs', icon: BookOpen, title: 'Documentation', desc: 'Connector and integration guide.' },
  { to: '/status',   icon: Activity, title: 'System status', desc: 'Live uptime and incident history.' },
];

/** Plain top-level links, shown between the menus. */
export const TOP_LINKS = [
  { to: '/discover', icon: Compass, title: 'Discover' },
  { to: '/blog',     icon: PenLine, title: 'Blog' },
];

export const FOOTER_COLUMNS = [
  { heading: 'Product',   links: [
      { to: '/?start=events', label: 'PlanIt Events' }, { to: '/?start=venue', label: 'PlanIt Venue' },
      { to: '/?start=rsvp', label: 'RSVP pages' }, { to: '/white-label', label: 'White label' },
      { to: '/claude-connect', label: 'Claude connector' }, { to: '/discover', label: 'Discover events' } ] },
  { heading: 'Resources', links: [
      { to: '/help', label: 'Help Center' }, { to: '/mcp-docs', label: 'Documentation' }, { to: '/blog', label: 'Blog' },
      { to: '/demo/invite', label: 'Invitation demo' }, { to: '/demo/rsvp', label: 'RSVP demo' },
      { to: '/status', label: 'System status' } ] },
  { heading: 'Company',   links: [
      { to: '/about', label: 'About' }, { to: '/careers', label: 'Careers' }, { to: '/support', label: 'Support PlanIt' },
      { to: '/support/wall', label: 'Wall of Supporters' }, { to: '/credits', label: 'Credits' } ] },
];

export const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms' }, { to: '/privacy', label: 'Privacy' }, { to: '/license', label: 'License' },
];

export const ICONS = { Building2, QrCode, ScrollText };
