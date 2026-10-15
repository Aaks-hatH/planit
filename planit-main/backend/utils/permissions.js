'use strict';

/*
 * utils/permissions.js  -  the ONE place roles, permissions and admin sections are defined.
 *
 * Everything else reads from here:
 *   - models/Employee.js builds its `permissions` schema from PERMISSION_KEYS, so a flag can never be
 *     "missing" from a stored account again.
 *   - routes/admin.js serves this as GET /admin/team/catalog, so the Team page renders every
 *     permission and role that exists (no hand-maintained list in the frontend to fall out of date).
 *   - GET /admin/me returns `sections` (computed by sectionsFor) so the sidebar only shows what the
 *     person's role allows. The server routes enforce the same flags, so hiding is never the only guard.
 */

// ── Permission groups ────────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  { id: 'dashboard', label: 'Dashboard & Events', perms: [
    { key: 'canViewDashboard', label: 'View Dashboard', desc: 'Platform stats and the recent-activity feed.' },
    { key: 'canViewEvents',    label: 'View Events',    desc: 'Browse every event, its guests, messages, files and spam review (read only).' },
    { key: 'canCreateEvents',  label: 'Create Events',  desc: 'Create events on behalf of organizers.' },
    { key: 'canEditEvents',    label: 'Edit Events',    desc: 'Edit events and act as an organizer inside any event.', risk: true },
    { key: 'canDeleteEvents',  label: 'Delete Events',  desc: 'Delete events, messages, polls, files and invites.', risk: true },
  ]},
  { id: 'users', label: 'Users', perms: [
    { key: 'canViewUserProfiles', label: 'View Users & Organizers', desc: 'Users, organizers and staff lists.' },
    { key: 'canManageUsers',      label: 'Manage Users',            desc: 'Remove participants from events, reset event passwords.' },
    { key: 'canBanUsers',         label: 'Ban Users',               desc: 'Ban or unban users.', risk: true },
  ]},
  { id: 'invites', label: 'Invites & Check-in', perms: [
    { key: 'canManageInvites', label: 'Manage Invites',  desc: 'Create and edit invites.' },
    { key: 'canCheckinGuests', label: 'Check-in Guests', desc: 'Check guests in at the door.' },
  ]},
  { id: 'planning', label: 'Polls, Seating & Files', perms: [
    { key: 'canManagePolls',   label: 'Manage Polls',   desc: '' },
    { key: 'canManageSeating', label: 'Manage Seating', desc: '' },
    { key: 'canManageFiles',   label: 'Manage Files',   desc: '' },
  ]},
  { id: 'data', label: 'Data & Analytics', perms: [
    { key: 'canViewAnalytics',  label: 'View Analytics',  desc: 'Analytics and Platform Analytics dashboards.' },
    { key: 'canViewFinancials', label: 'View Financials', desc: 'Payments, invoices and revenue.', risk: true },
    { key: 'canExportData',     label: 'Export Data',     desc: 'Data export and PII & Compliance lookups.', risk: true },
    { key: 'canRunCleanup',     label: 'Run Cleanup',     desc: 'Run the data cleanup job.', risk: true },
  ]},
  { id: 'tooling', label: 'Internal Tooling', perms: [
    { key: 'canViewLogs',   label: 'View Logs',        desc: 'Server and fleet logs.' },
    { key: 'canViewSystem', label: 'View System Info', desc: 'System health panel.' },
    { key: 'canAccessAPI',  label: 'API Access',       desc: '' },
  ]},
  { id: 'incidents', label: 'Incidents & Reports', perms: [
    { key: 'canManageIncidents',   label: 'Manage Incidents / Uptime', desc: 'Uptime page, incidents and user outage reports.' },
    { key: 'canManageBugReports',  label: 'Manage Bug Reports',        desc: 'Read and triage bug reports.' },
    { key: 'canSendNotifications', label: 'Send Notifications',        desc: '' },
  ]},
  { id: 'marketing', label: 'Marketing', perms: [
    { key: 'canViewMarketing', label: 'View Campaigns', desc: '' },
    { key: 'canSendMarketing', label: 'Send Campaigns', desc: 'Send or schedule outreach emails.', risk: true },
  ]},
  { id: 'security', label: 'Security', perms: [
    { key: 'canManageBlocklist',   label: 'Manage Blocklist & Bans', desc: 'Blocklist, banned IPs and the security console.', risk: true },
    { key: 'canViewSecurityLogs',  label: 'Audit & Security Logs',   desc: 'The audit trail of everything staff did.', risk: true },
    { key: 'canToggleMaintenance', label: 'Toggle Maintenance',      desc: 'Takes the live site down.', risk: true },
  ]},
  { id: 'content', label: 'Content', perms: [
    { key: 'canEditContent',    label: 'Edit Content (Blog CMS)', desc: '' },
    { key: 'canPublishContent', label: 'Publish Content',         desc: '' },
  ]},
  { id: 'whitelabel', label: 'White-label', perms: [
    { key: 'canManageWhiteLabel', label: 'White-label Settings', desc: 'Partners, leads and portals.' },
  ]},
  { id: 'team', label: 'Team', perms: [
    { key: 'canViewEmployees', label: 'View Team Directory', desc: 'See everyone on the team. Everyone can always see their own manager, reports and the org chart.' },
    { key: 'canAssignTasks',   label: 'Assign Tasks',       desc: 'Create, edit and delete tasks for anyone on the team, and see every task and every linked pull request. Everyone can always see and update their own tasks.' },
  ]},
  { id: 'hiring', label: 'Hiring', perms: [
    { key: 'canViewHiring',      label: 'View Hiring',      desc: 'Applications, listings and insights in Careers.' },
    { key: 'canManageHiring',    label: 'Manage Hiring',    desc: 'Change applicant status, open and close listings.' },
    { key: 'canViewCandidatePII', label: 'View Candidate Details', desc: 'Resumes and contact details.', risk: true },
  ]},
  { id: 'ads', label: 'Advertising', perms: [
    { key: 'canManageAds',  label: 'Manage Ads',   desc: '' },
    { key: 'canViewAdSpend', label: 'View Ad Spend', desc: '' },
  ]},
];

const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key));
const emptyPermissions = () => Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
const allPermissions   = () => Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));

// ── Roles ────────────────────────────────────────────────────────────────────
// `perms` is the starting point applied when someone is created with the role (or when the role is
// changed with "apply role defaults"). Individual flags can still be customised afterwards.
const ADMIN_EXCLUDED = ['canToggleMaintenance', 'canRunCleanup', 'canAccessAPI', 'canViewCandidatePII'];
const ROLES = [
  { id: 'super_admin', label: 'Super admin', tone: 'purple', super: true,
    desc: 'Everything. Bypasses every permission check and manages the team.', perms: PERMISSION_KEYS },
  { id: 'admin', label: 'Admin', tone: 'blue',
    desc: 'Runs day-to-day operations. Everything except the most destructive switches.',
    perms: PERMISSION_KEYS.filter((k) => !ADMIN_EXCLUDED.includes(k)) },
  { id: 'support', label: 'Support', tone: 'teal',
    desc: 'Helps organizers and guests. Sees events and users, handles invites, check-in and incidents.',
    perms: ['canViewDashboard', 'canViewEvents', 'canViewUserProfiles', 'canManageInvites', 'canCheckinGuests', 'canManageIncidents', 'canManageBugReports', 'canSendNotifications'] },
  { id: 'moderator', label: 'Moderator', tone: 'amber',
    desc: 'Keeps the platform clean. Users, bans, blocklist and security logs.',
    perms: ['canViewDashboard', 'canViewEvents', 'canViewUserProfiles', 'canManageUsers', 'canBanUsers', 'canManageBlocklist', 'canViewSecurityLogs', 'canManageIncidents', 'canManageBugReports'] },
  { id: 'analyst', label: 'Analyst', tone: 'indigo',
    desc: 'Read-only insight into analytics, finance, marketing and system health.',
    perms: ['canViewDashboard', 'canViewEvents', 'canViewAnalytics', 'canViewFinancials', 'canExportData', 'canViewMarketing', 'canViewLogs', 'canViewSystem'] },
  { id: 'developer', label: 'Developer', tone: 'cyan',
    desc: 'Works on the code. Logs, system, bug reports and incidents.',
    perms: ['canViewDashboard', 'canViewEvents', 'canViewLogs', 'canViewSystem', 'canAccessAPI', 'canManageBugReports', 'canManageIncidents', 'canViewAnalytics'] },
  { id: 'marketing', label: 'Marketing', tone: 'pink',
    desc: 'Campaigns, content and advertising.',
    perms: ['canViewDashboard', 'canViewMarketing', 'canSendMarketing', 'canViewAnalytics', 'canEditContent', 'canPublishContent', 'canManageAds', 'canViewAdSpend'] },
  { id: 'recruiter', label: 'Recruiter', tone: 'violet',
    desc: 'Runs hiring. Applications, listings and candidate details.',
    perms: ['canViewHiring', 'canManageHiring', 'canViewCandidatePII'] },
  { id: 'finance', label: 'Finance', tone: 'emerald',
    desc: 'Payments, revenue and ad spend.',
    perms: ['canViewDashboard', 'canViewFinancials', 'canViewAnalytics', 'canExportData', 'canViewAdSpend'] },
  { id: 'content_editor', label: 'Content editor', tone: 'sky',
    desc: 'Writes and publishes blog content.',
    perms: ['canEditContent', 'canPublishContent', 'canManageFiles', 'canViewAnalytics'] },
  { id: 'volunteer', label: 'Volunteer', tone: 'slate',
    desc: 'Starting role for new people. Sees the org chart, their manager and reports, and their own account. Nothing else until you grant it.',
    perms: [] },
  { id: 'demo', label: 'Demo (sandbox)', tone: 'orange', demo: true,
    desc: 'Read-only sandbox for demos. All writes are simulated.', perms: [] },
];
const ROLE_IDS = ROLES.map((r) => r.id);
const roleById = (id) => ROLES.find((r) => r.id === id) || null;
const presetFor = (roleId) => {
  const r = roleById(roleId);
  const p = emptyPermissions();
  if (r) for (const k of r.perms) if (k in p) p[k] = true;
  return p;
};

// ── Admin sections (sidebar) ─────────────────────────────────────────────────
// always: every signed-in person.  super: super admin only.  any: needs at least one of these flags.
const SECTIONS = [
  { id: 'dashboard',          any: ['canViewDashboard'] },
  { id: 'events',             any: ['canViewEvents'] },
  { id: 'users',              any: ['canViewUserProfiles'] },
  { id: 'organizers',         any: ['canViewUserProfiles'] },
  { id: 'staff',              any: ['canViewUserProfiles'] },
  { id: 'employees',          always: true },                         // Team: "My team" for everyone, directory by flag
  { id: 'audit-logs',         any: ['canViewSecurityLogs'] },
  { id: 'fleet',              super: true },
  { id: 'marketing',          any: ['canViewMarketing', 'canSendMarketing'] },
  { id: 'analytics',          any: ['canViewAnalytics'] },
  { id: 'platform-analytics', any: ['canViewAnalytics'] },
  { id: 'compliance',         any: ['canExportData'] },
  { id: 'security',           any: ['canManageBlocklist', 'canViewSecurityLogs'] },
  { id: 'blocklist',          any: ['canManageBlocklist'] },
  { id: 'banned-ips',         any: ['canManageBlocklist'] },
  { id: 'reports',            any: ['canManageBugReports'] },
  { id: 'uptime',             any: ['canManageIncidents'] },
  { id: 'system',             any: ['canViewSystem'] },
  { id: 'command-center',     super: true },
  { id: 'whitelabel',         any: ['canManageWhiteLabel'] },
  { id: 'payments',           any: ['canViewFinancials'] },
  { id: 'careers',            always: true },                         // org chart for everyone; hiring tabs by flag
  { id: 'blog',               any: ['canEditContent', 'canPublishContent'] },
  { id: 'account',            always: true },
];

const isSuperAdmin = (admin) => !!admin && ((!admin.isEmployee && admin.isAdmin === true) || admin.role === 'super_admin');
const hasPerm = (admin, perm) => isSuperAdmin(admin) || (!!admin && !admin.isDemo && admin.permissions?.[perm] === true);

function sectionsFor(admin) {
  if (!admin) return [];
  const sup = isSuperAdmin(admin);
  return SECTIONS.filter((s) => {
    if (s.always) return true;
    if (sup) return true;
    if (admin.isDemo) return false;
    if (s.super) return false;
    return (s.any || []).some((k) => admin.permissions?.[k] === true);
  }).map((s) => s.id);
}

const publicCatalog = () => ({
  groups: PERMISSION_GROUPS,
  roles: ROLES.map((r) => ({ id: r.id, label: r.label, tone: r.tone, desc: r.desc, super: !!r.super, demo: !!r.demo, perms: r.perms })),
  sections: SECTIONS,
  keys: PERMISSION_KEYS,
});

module.exports = {
  PERMISSION_GROUPS, PERMISSION_KEYS, ROLES, ROLE_IDS, SECTIONS,
  roleById, presetFor, emptyPermissions, allPermissions,
  isSuperAdmin, hasPerm, sectionsFor, publicCatalog,
};
