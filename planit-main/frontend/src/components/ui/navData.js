/**
 * Navigation map for the public PlanIt site. One definition feeds the floating
 * nav, the mobile sheet and the footer so the three can never drift apart.
 * Every `to` is a real route in App.jsx. `/?start=events|venue|rsvp` opens the
 * matching creation branch on the homepage.
 */
import {
  Calendar, UtensilsCrossed, CheckSquare, Bot, Palette, BookOpen, LifeBuoy,
  Compass, Activity, Briefcase, Heart, PenLine, Building2, QrCode, Ticket, ScrollText,
} from 'lucide-react';

export const PRODUCT = [
  { to: '/?start=events', icon: Calendar,        title: 'PlanIt Events',  desc: 'Guest list, seating, team chat, tasks and check-in.' },
  { to: '/?start=venue',  icon: UtensilsCrossed, title: 'PlanIt Venue',   desc: 'Live floor map, waitlist, server and kitchen views.' },
  { to: '/?start=rsvp',   icon: CheckSquare,     title: 'RSVP pages',     desc: 'A shareable RSVP page, no workspace required.' },
  { to: '/claude-connect', icon: Bot,            title: 'Claude connector', desc: 'Run your event from a Claude conversation.' },
];

export const SOLUTIONS = [
  { to: '/?start=events', icon: Ticket,          title: 'Events and conferences', desc: 'QR check-in, enterprise rosters, offline door sync.' },
  { to: '/?start=venue',  icon: UtensilsCrossed, title: 'Restaurants and venues', desc: 'Table service, reservations, live wait board.' },
  { to: '/white-label',   icon: Palette,         title: 'White label',            desc: 'Your brand, your domain, the full platform.' },
  { to: '/discover',      icon: Compass,         title: 'Discover events',        desc: 'Browse public events and venues near you.' },
];

export const RESOURCES = [
  { to: '/blog',     icon: PenLine,  title: 'Blog',            desc: 'Guides and ideas for planners.' },
  { to: '/help',     icon: LifeBuoy, title: 'Help Center',     desc: 'Articles, how-tos and troubleshooting.' },
  { to: '/mcp-docs', icon: BookOpen, title: 'Documentation',   desc: 'Connector and integration guide.' },
  { to: '/status',   icon: Activity, title: 'System status',   desc: 'Live uptime and incident history.' },
  { to: '/careers',  icon: Briefcase, title: 'Careers',        desc: 'Volunteer roles on the PlanIt team.' },
  { to: '/support',  icon: Heart,    title: 'Support PlanIt',  desc: 'Keep PlanIt free for everyone.' },
];

export const FOOTER_COLUMNS = [
  { heading: 'Product',   links: [
      { to: '/?start=events', label: 'PlanIt Events' }, { to: '/?start=venue', label: 'PlanIt Venue' },
      { to: '/?start=rsvp', label: 'RSVP pages' }, { to: '/claude-connect', label: 'Claude connector' },
      { to: '/demo/invite', label: 'Invitation demo' }, { to: '/demo/rsvp', label: 'RSVP demo' } ] },
  { heading: 'Solutions', links: [
      { to: '/white-label', label: 'White label' }, { to: '/discover', label: 'Discover events' },
      { to: '/?start=venue', label: 'Restaurants and venues' }, { to: '/?start=events', label: 'Events and conferences' } ] },
  { heading: 'Resources', links: [
      { to: '/blog', label: 'Blog' }, { to: '/help', label: 'Help Center' }, { to: '/mcp-docs', label: 'Documentation' },
      { to: '/status', label: 'System status' }, { to: '/support/wall', label: 'Wall of Supporters' } ] },
  { heading: 'Company',   links: [
      { to: '/about', label: 'About' }, { to: '/careers', label: 'Careers' }, { to: '/support', label: 'Support PlanIt' },
      { to: '/credits', label: 'Credits' } ] },
];

export const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms' }, { to: '/privacy', label: 'Privacy' }, { to: '/license', label: 'License' },
];

export const ICONS = { Building2, QrCode, ScrollText };
