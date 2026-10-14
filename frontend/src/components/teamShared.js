// Small helpers shared by the Team page, the add-person wizard, the org chart and Careers.

export const SECTION_LABEL = {
  dashboard: 'Dashboard', events: 'Events', users: 'Users', organizers: 'Organizers', staff: 'Staff', employees: 'Team',
  'audit-logs': 'Audit Logs', fleet: 'Fleet', marketing: 'Marketing', analytics: 'Analytics', 'platform-analytics': 'Platform Analytics',
  compliance: 'PII & Compliance', security: 'Security', blocklist: 'Blocklist', 'banned-ips': 'Banned IPs', reports: 'Reports',
  uptime: 'Uptime', system: 'System', 'command-center': 'Command', whitelabel: 'White Label', payments: 'Payments',
  careers: 'Careers & Org chart', blog: 'Blog CMS', account: 'My Account',
};

// Literal class strings so Tailwind keeps them.
export const TONE = {
  purple: 'bg-purple-100 text-purple-800', blue: 'bg-blue-100 text-blue-800', teal: 'bg-teal-100 text-teal-800',
  amber: 'bg-amber-100 text-amber-800', indigo: 'bg-indigo-100 text-indigo-800', cyan: 'bg-cyan-100 text-cyan-800',
  pink: 'bg-pink-100 text-pink-800', violet: 'bg-violet-100 text-violet-800', emerald: 'bg-emerald-100 text-emerald-800',
  sky: 'bg-sky-100 text-sky-800', slate: 'bg-neutral-100 text-neutral-700', orange: 'bg-orange-100 text-orange-800',
};
export const TONE_BAR = {
  purple: 'bg-purple-500', blue: 'bg-blue-500', teal: 'bg-teal-500', amber: 'bg-amber-500', indigo: 'bg-indigo-500', cyan: 'bg-cyan-500',
  pink: 'bg-pink-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', sky: 'bg-sky-500', slate: 'bg-neutral-400', orange: 'bg-orange-500',
};

export const roleOf = (catalog, id) => (catalog?.roles || []).find((r) => r.id === id) || null;
export const roleLabel = (catalog, id) => roleOf(catalog, id)?.label || String(id || '').replace(/_/g, ' ');

// Which admin pages a person with this role + permission set can open (mirrors utils/permissions.js sectionsFor).
export function sectionsFrom(catalog, perms, role) {
  if (!catalog) return [];
  const sup = role === 'super_admin';
  const demo = role === 'demo';
  return catalog.sections.filter((s) => {
    if (s.always) return true;
    if (sup) return true;
    if (demo || s.super) return false;
    return (s.any || []).some((k) => perms?.[k] === true);
  }).map((s) => s.id);
}

export const when = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never');
export const ago = (d) => {
  if (!d) return 'never';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
export const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';

export const FIELD = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10';
