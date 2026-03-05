import axios from 'axios';

const API_URL      = import.meta.env.VITE_API_URL      || 'http://localhost:5000/api';
const WATCHDOG_URL = import.meta.env.VITE_WATCHDOG_URL || '';
const ROUTER_URL   = import.meta.env.VITE_ROUTER_URL   || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const isAdminRequest = config.url && config.url.includes('/admin');

  if (isAdminRequest) {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  } else {
    const token = localStorage.getItem('eventToken');
    if (token) {
      config.headers['x-event-token'] = token;
      config.headers.Authorization    = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAdminRequest = url.includes('/admin');
      const isCoreAdminAuth = isAdminRequest && !url.includes('/bug-reports');

      if (isCoreAdminAuth) {
        console.warn('Admin authentication failed, clearing admin token');
        localStorage.removeItem('adminToken');
        delete api.defaults.headers.common['Authorization'];
        window.dispatchEvent(new CustomEvent('planit:admin-logout'));
      } else if (!isAdminRequest) {
        // Only clear token and force re-login for non-check-in routes.
        // Check-in routes (verify-scan, verify-pin, checkin) handle 401s
        // themselves and show the DenyScreen — we must NOT clear the staff
        // token here or subsequent scans will break.
        const checkinPaths = ['/verify-scan/', '/verify-pin/', '/checkin/'];
        const isCheckinRoute = checkinPaths.some(p => url.includes(p));
        if (!isCheckinRoute) {
          localStorage.removeItem('eventToken');
          localStorage.removeItem('username');
          window.dispatchEvent(new CustomEvent('planit:event-logout'));
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Event API ────────────────────────────────────────────────────────────────
export const eventAPI = {
  create:         (data)              => api.post('/events', data),
  getBySubdomain: (subdomain)         => api.get(`/events/subdomain/${subdomain}`),
  getById:        (id)                => api.get(`/events/${id}`),
  getPublicInfo:  (id)                => api.get(`/events/public/${id}`),
  getParticipants:(id)                => api.get(`/events/participants/${id}`),
  verifyPassword: (id, data)          => api.post(`/events/verify-password/${id}`, data),
  join:           (id, data)          => api.post(`/events/join/${id}`, data),
  setPassword:    (id, data)          => api.post(`/events/set-password/${id}`, data),
  update:         (id, data)          => api.put(`/events/${id}`, data),
  delete:         (id)                => api.delete(`/events/${id}`),

  // RSVP
  rsvp:               (eventId, data)     => api.post(`/events/${eventId}/rsvp`, data),
  updateRsvpSettings: (eventId, settings) => api.patch(`/events/${eventId}/rsvp-settings`, settings),
  getRsvpSummary:     (eventId)           => api.get(`/events/${eventId}/rsvp-summary`),

  // Agenda
  getAgenda:       (eventId)          => api.get(`/events/${eventId}/agenda`),
  addAgendaItem:   (eventId, data)    => api.post(`/events/${eventId}/agenda`, data),
  deleteAgendaItem:(eventId, itemId)  => api.delete(`/events/${eventId}/agenda/${itemId}`),

  // Enterprise Check-in & Invites
  getInvites:      (eventId)               => api.get(`/events/${eventId}/invites`),
  createInvite:    (eventId, data)         => api.post(`/events/${eventId}/invites`, { guests: [data] }),
  updateInvite:    (eventId, inviteId, data) => api.put(`/events/${eventId}/invites/${inviteId}`, data),
  deleteInvite:    (eventId, inviteId)     => api.delete(`/events/${eventId}/invites/${inviteId}`),
  importGuestsCsv: (eventId, csv)          => api.post(`/events/${eventId}/invites/import-csv`, { csv }),
  getActivityLog:  (eventId)               => api.get(`/events/${eventId}/activity-log`),

  // Approval queue
  getApprovalQueue:   (eventId)           => api.get(`/events/${eventId}/approval-queue`),
  approveParticipant: (eventId, username) => api.post(`/events/${eventId}/approval-queue/${encodeURIComponent(username)}/approve`),
  rejectParticipant:  (eventId, username) => api.post(`/events/${eventId}/approval-queue/${encodeURIComponent(username)}/reject`),

  // Check-in process
  getCheckinCache: (eventId)                   => api.get(`/events/${eventId}/checkin-cache`),
  verifyScan:      (eventId, inviteCode)        => api.get(`/events/${eventId}/verify-scan/${inviteCode}`),
  verifyPin:       (eventId, inviteCode, pin)   => api.post(`/events/${eventId}/verify-pin/${inviteCode}`, { pin }),
  checkIn:         (eventId, inviteCode, data)  => api.post(`/events/${eventId}/checkin/${inviteCode}`, data),

  // Check-in stats & settings
  getCheckInStats:       (eventId)           => api.get(`/events/${eventId}/checkin-stats`),
  getCheckInSettings:    (eventId)           => api.get(`/events/${eventId}/checkin-settings`),
  updateCheckInSettings: (eventId, settings) => api.patch(`/events/${eventId}/checkin-settings`, settings),

  // Staff check-in accounts
  staffLogin:    (eventId, username, pin) => api.post(`/events/${eventId}/staff-login`, { username, pin }),
  getStaff:      (eventId)                => api.get(`/events/${eventId}/staff`),
  createStaff:   (eventId, data)          => api.post(`/events/${eventId}/staff`, data),
  deleteStaff:   (eventId, username)      => api.delete(`/events/${eventId}/staff/${username}`),
  updateStaffPin:(eventId, username, pin) => api.patch(`/events/${eventId}/staff/${username}/pin`, { pin }),

  // Override history
  getOverrideHistory: (eventId) => api.get(`/events/${eventId}/override-history`),

  // Waitlist
  joinWaitlist:  (eventId, data) => api.post(`/events/${eventId}/waitlist`, data),
  checkApprovalStatus: (eventId, username) => api.get(`/events/${eventId}/approval-status`, { params: { username } }),
  getWaitlist:   (eventId)       => api.get(`/events/${eventId}/waitlist`),
  leaveWaitlist: (eventId, name) => api.delete(`/events/${eventId}/waitlist/${encodeURIComponent(name)}`),

  // Clone / recurring
  clone: (eventId, data) => api.post(`/events/${eventId}/clone`, data),

  // Webhooks
  getWebhooks:   (eventId)              => api.get(`/events/${eventId}/webhooks`),
  createWebhook: (eventId, data)        => api.post(`/events/${eventId}/webhooks`, data),
  updateWebhook: (eventId, whId, data)  => api.patch(`/events/${eventId}/webhooks/${whId}`, data),
  deleteWebhook: (eventId, whId)        => api.delete(`/events/${eventId}/webhooks/${whId}`),

  // ── Seating map ────────────────────────────────────────────────────────────
  // GET  /events/:id/seating             — fetch map + per-table guest counts
  // PUT  /events/:id/seating             — save the full map (organizer only)
  // PATCH /events/:id/seating/guests     — bulk assign guests to tables
  // PATCH /events/:id/invites/:id/table  — assign one guest to a table
  getSeatingMap:    (eventId)                             => api.get(`/events/${eventId}/seating`),
  saveSeatingMap:   (eventId, payload)                    => api.put(`/events/${eventId}/seating`, payload),
  bulkAssignSeats:  (eventId, assignments)                => api.patch(`/events/${eventId}/seating/guests`, { assignments }),
  assignGuestTable: (eventId, inviteId, tableId, tableLabel) => api.patch(`/events/${eventId}/invites/${inviteId}/table`, { tableId, tableLabel }),

  // ── Table Service (Restaurant Mode) ───────────────────────────────────────
  getTableServiceFloor:     (eventId)                  => api.get(`/events/${eventId}/table-service/floor`),
  updateTableState:         (eventId, tableId, data)   => api.patch(`/events/${eventId}/table-service/table/${tableId}`, data),
  addToTableWaitlist:       (eventId, data)            => api.post(`/events/${eventId}/table-service/waitlist`, data),
  updateTableWaitlist:      (eventId, partyId, status) => api.patch(`/events/${eventId}/table-service/waitlist/${partyId}`, { status }),
  removeFromTableWaitlist:  (eventId, partyId)         => api.delete(`/events/${eventId}/table-service/waitlist/${partyId}`),
  createTableReservation:   (eventId, data)            => api.post(`/events/${eventId}/table-service/reservations`, data),
  updateTableReservation:   (eventId, resId, data)     => api.patch(`/events/${eventId}/table-service/reservations/${resId}`, data),
  verifyReservationQR:      (eventId, token)           => api.get(`/events/${eventId}/table-service/reservations/verify/${token}`),
  updateTableServiceSettings:(eventId, data)           => api.patch(`/events/${eventId}/table-service/settings`, data),
  updateReservationPageSettings: (eventId, data)       => api.patch(`/events/${eventId}/table-service/reservation-page-settings`, data),
  updateServers:                (eventId, servers)      => api.patch(`/events/${eventId}/table-service/settings`, { servers }),
  getFloorPublic:               (eventId)               => api.get(`/events/${eventId}/table-service/floor`),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────
export const chatAPI = {
  getMessages:    (eventId, params)              => api.get(`/chat/${eventId}/messages`, { params }),
  sendMessage:    (eventId, data)                => api.post(`/chat/${eventId}/messages`, data),
  editMessage:    (eventId, messageId, data)     => api.put(`/chat/${eventId}/messages/${messageId}`, data),
  deleteMessage:  (eventId, messageId, data)     => api.delete(`/chat/${eventId}/messages/${messageId}`, { data }),
  addReaction:    (eventId, messageId, data)     => api.post(`/chat/${eventId}/messages/${messageId}/reactions`, data),
  removeReaction: (eventId, messageId, data)     => api.delete(`/chat/${eventId}/messages/${messageId}/reactions`, { data }),
};

// ─── Poll API ─────────────────────────────────────────────────────────────────
export const pollAPI = {
  getAll:     (eventId)               => api.get(`/polls/${eventId}`),
  create:     (eventId, data)         => api.post(`/polls/${eventId}`, data),
  vote:       (eventId, pollId, data) => api.post(`/polls/${eventId}/polls/${pollId}/vote`, data),
  getResults: (eventId, pollId)       => api.get(`/polls/${eventId}/polls/${pollId}/results`),
  close:      (eventId, pollId, data) => api.post(`/polls/${eventId}/polls/${pollId}/close`, data),
  delete:     (eventId, pollId, data) => api.delete(`/polls/${eventId}/polls/${pollId}`, { data }),
};

// ─── File API ─────────────────────────────────────────────────────────────────
export const fileAPI = {
  upload:   (eventId, formData) => api.post(`/files/${eventId}/upload`, formData, {
    headers: { 'Content-Type': undefined },
  }),
  getAll:   (eventId)           => api.get(`/files/${eventId}`),
  download: (eventId, fileId)   => api.get(`/files/${eventId}/download/${fileId}`, { responseType: 'blob' }),
  delete:   (eventId, fileId, data) => api.delete(`/files/${eventId}/${fileId}`, { data }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────
export const adminAPI = {
  // Authentication
  login: (username, password) => api.post('/admin/login', { username, password }),

  // Dashboard & Statistics
  getStats:    ()       => api.get('/admin/stats'),
  getActivity: (params) => api.get('/admin/activity', { params }),

  // System Info
  getSystem: () => api.get('/admin/system'),

  // Live Logs
  getLogs:      (n = 'all') => api.get('/admin/logs', { params: { n } }),
  getFleetLogs: ()          => api.get('/admin/logs/fleet'),

  // Event Management
  getEvents:         (params)     => api.get('/admin/events', { params }),
  getEvent:          (id)         => api.get(`/admin/events/${id}`),
  getEventAccess:    (id)         => api.post(`/admin/events/${id}/access`),
  updateEvent:       (id, data)   => api.patch(`/admin/events/${id}`, data),
  updateEventStatus: (id, status) => api.patch(`/admin/events/${id}/status`, { status }),
  deleteEvent:       (id)         => api.delete(`/admin/events/${id}`),

  // Messages Management
  getMessages:        (eventId)              => api.get(`/admin/events/${eventId}/messages`),
  deleteMessage:      (eventId, messageId)   => api.delete(`/admin/events/${eventId}/messages/${messageId}`),
  bulkDeleteMessages: (eventId, messageIds)  => api.post(`/admin/events/${eventId}/messages/bulk-delete`, { messageIds }),

  // Participants Management
  getParticipants:          (eventId)            => api.get(`/admin/events/${eventId}/participants`),
  removeParticipant:        (eventId, username)  => api.delete(`/admin/events/${eventId}/participants/${username}`),
  resetParticipantPassword: (eventId, username)  => api.delete(`/admin/events/${eventId}/participants/${username}/password`),
  bulkRemoveParticipants:   (eventId, usernames) => api.post(`/admin/events/${eventId}/participants/bulk-remove`, { usernames }),

  // Polls Management
  getPolls:   (eventId)         => api.get(`/admin/events/${eventId}/polls`),
  deletePoll: (eventId, pollId) => api.delete(`/admin/events/${eventId}/polls/${pollId}`),

  // Files Management
  getFiles:   (eventId)         => api.get(`/admin/events/${eventId}/files`),
  deleteFile: (eventId, fileId) => api.delete(`/admin/events/${eventId}/files/${fileId}`),

  // Invites Management (Enterprise)
  getInvites:  (eventId)                     => api.get(`/admin/events/${eventId}/invites`),
  checkInGuest:(eventId, inviteCode, actual) => api.post(`/admin/events/${eventId}/invites/${inviteCode}/checkin`, { actualAttendees: actual }),
  deleteInvite:(eventId, inviteId)           => api.delete(`/admin/events/${eventId}/invites/${inviteId}`),

  // Search & Discovery
  search: (query) => api.get('/admin/search', { params: { q: query } }),

  // Data Export
  exportData:  (type, eventId) => api.get('/admin/export', { params: { type, eventId } }),
  exportStats: ()              => api.get('/admin/export/stats'),

  // Cleanup
  manualCleanup: () => api.post('/admin/cleanup'),

  // Organizers
  getOrganizers: () => api.get('/admin/organizers'),

  // All staff across every event
  getAllStaff: () => api.get('/admin/staff'),

  // All participants across every event (paginated)
  getAllParticipants: (params) => api.get('/admin/all-participants', { params }),

  // Employee CRUD
  getEmployees:   ()         => api.get('/admin/employees'),
  createEmployee: (data)     => api.post('/admin/employees', data),
  updateEmployee: (id, data) => api.patch(`/admin/employees/${id}`, data),
  deleteEmployee: (id)       => api.delete(`/admin/employees/${id}`),

  // Marketing emails
  getMarketingTemplates:  ()                     => api.get('/admin/marketing/templates'),
  getMarketingPreviewUrl: (templateId, ctaUrl) => {
    const params = new URLSearchParams();
    if (ctaUrl) params.set('ctaUrl', ctaUrl);
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) params.set('token', adminToken);
    const qs = params.toString();
    return `${API_URL}/admin/marketing/preview/${templateId}${qs ? `?${qs}` : ''}`;
  },
  sendMarketingCampaign:      (data)   => api.post('/admin/marketing/send', data),
  scheduleMarketingCampaign:  (data)   => api.post('/admin/marketing/schedule', data),
  getScheduledCampaigns:      ()       => api.get('/admin/marketing/scheduled'),
  cancelScheduledCampaign:    (id)     => api.delete(`/admin/marketing/schedule/${id}`),

  // Discovery
  getMarketingDiscoverUrl: (params) => {
    const adminToken = localStorage.getItem('adminToken');
    const p = new URLSearchParams({ ...params });
    if (adminToken) p.set('token', adminToken);
    return `${API_URL}/admin/marketing/discover?${p.toString()}`;
  },
  getContactedEmails:   ()             => api.get('/admin/marketing/contacted'),
  addContactedEmails:   (emails)       => api.post('/admin/marketing/contacted/add', { emails }),
  removeContactedEmail: (email)        => api.delete(`/admin/marketing/contacted/${encodeURIComponent(email)}`),

  // Command Center
  ccGetFleet:           ()                    => api.get('/admin/cc/fleet'),
  ccGetEmailPool:       ()                    => api.get('/admin/cc/email-pool'),
  ccGetDb:              ()                    => api.get('/admin/cc/db'),
  ccCommand:            (target, command, params) => api.post('/admin/cc/command', { target, command, params: params || {} }),
  ccGetPlatformMetrics: ()                    => api.get('/admin/cc/platform-metrics'),
  ccGetSecurityIntel:   ()                    => api.get('/admin/cc/security-intel'),
  ccGetWsStats:         ()                    => api.get('/admin/cc/ws-stats'),
  ccGetEventIntel:      ()                    => api.get('/admin/cc/event-intel'),
  ccGlobalSearch:       (q)                   => api.get('/admin/cc/global-search', { params: { q } }),
  ccBulkEvents:         (action, filter)      => api.post('/admin/cc/bulk-events', { action, filter }),
};

// ─── Task API ─────────────────────────────────────────────────────────────────
export const taskAPI = {
  getAll: (eventId)         => api.get(`/events/${eventId}/tasks`),
  create: (eventId, data)   => api.post(`/events/${eventId}/tasks`, data),
  toggle: (eventId, taskId) => api.patch(`/events/${eventId}/tasks/${taskId}/toggle`),
  delete: (eventId, taskId) => api.delete(`/events/${eventId}/tasks/${taskId}`),
};

// ─── Announcement API ─────────────────────────────────────────────────────────
export const announcementAPI = {
  getAll: (eventId)                 => api.get(`/events/${eventId}/announcements`),
  create: (eventId, data)           => api.post(`/events/${eventId}/announcements`, data),
  delete: (eventId, announcementId) => api.delete(`/events/${eventId}/announcements/${announcementId}`),
};

// ─── Expense API ──────────────────────────────────────────────────────────────
export const expenseAPI = {
  getAll:       (eventId)        => api.get(`/events/${eventId}/expenses`),
  create:       (eventId, data)  => api.post(`/events/${eventId}/expenses`, data),
  delete:       (eventId, expId) => api.delete(`/events/${eventId}/expenses/${expId}`),
  updateBudget: (eventId, budget)=> api.patch(`/events/${eventId}/budget`, { budget }),
};

// ─── Note API ─────────────────────────────────────────────────────────────────
export const noteAPI = {
  getAll: (eventId)               => api.get(`/events/${eventId}/notes`),
  create: (eventId, data)         => api.post(`/events/${eventId}/notes`, data),
  update: (eventId, noteId, data) => api.put(`/events/${eventId}/notes/${noteId}`, data),
  delete: (eventId, noteId)       => api.delete(`/events/${eventId}/notes/${noteId}`),
};

// ─── Analytics API ────────────────────────────────────────────────────────────
export const analyticsAPI = {
  get: (eventId) => api.get(`/events/${eventId}/analytics`),
};

// ─── Uptime API ───────────────────────────────────────────────────────────────
export const uptimeAPI = {
  // Public
  ping:         ()     => api.get('/uptime/ping'),
  getStatus:    ()     => api.get('/uptime/status'),
  submitReport: (data) => api.post('/uptime/report', data),

  // Admin
  getReports:        ()         => api.get('/uptime/admin/reports'),
  updateReport:      (id, data) => api.patch(`/uptime/admin/reports/${id}`, data),
  getIncidents:      ()         => api.get('/uptime/admin/incidents'),
  createIncident:    (data)     => api.post('/uptime/admin/incidents', data),
  addTimelineUpdate: (id, data) => api.post(`/uptime/admin/incidents/${id}/timeline`, data),
  updateIncident:    (id, data) => api.patch(`/uptime/admin/incidents/${id}`, data),
  deleteIncident:    (id)       => api.delete(`/uptime/admin/incidents/${id}`),
};

// ─── Watchdog API ─────────────────────────────────────────────────────────────
const watchdogAxios = WATCHDOG_URL
  ? axios.create({ baseURL: WATCHDOG_URL, timeout: 12000 })
  : null;

export const watchdogAPI = {
  getStatus: () => {
    if (!watchdogAxios) return Promise.resolve(null);
    return watchdogAxios.get('/watchdog/status');
  },
  ping: () => {
    if (!watchdogAxios) return Promise.resolve(null);
    return watchdogAxios.get('/watchdog/ping');
  },
  getUptimeHistory: () => {
    if (!watchdogAxios) return Promise.resolve(null);
    return watchdogAxios.get('/watchdog/uptime');
  },
};

// ─── Router API ───────────────────────────────────────────────────────────────
const MESH_SECRET = import.meta.env.VITE_MESH_SECRET || '';
const MESH_CALLER = 'AdminUI';

async function signMeshToken() {
  const timestamp = Date.now().toString();
  const payload   = `${timestamp}:${MESH_CALLER}`;
  const enc       = new TextEncoder();
  const key       = await crypto.subtle.importKey(
    'raw',
    enc.encode(MESH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hmac   = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}:${hmac}`;
}

const routerAxios = ROUTER_URL
  ? axios.create({ baseURL: ROUTER_URL, timeout: 10000 })
  : null;

if (routerAxios) {
  routerAxios.interceptors.request.use(async (config) => {
    const token = await signMeshToken();
    config.headers['X-Mesh-Token']   = token;
    config.headers['X-Mesh-Caller']  = MESH_CALLER;
    config.headers['X-Mesh-Version'] = '1';
    return config;
  });
}

export const routerAPI = {
  getHealth: () => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.get('/health');
  },
  getStatus: () => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.get('/mesh/status');
  },
  activateBoost: (opts) => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.post('/mesh/boost', opts);
  },
  cancelBoost: () => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.delete('/mesh/boost');
  },
  testEmail: (to) => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.post('/mesh/email/test', { to });
  },
  getEmailPool: () => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.get('/mesh/email/pool');
  },
  execCommand: (command, params) => {
    if (!routerAxios) return Promise.resolve(null);
    return routerAxios.post('/mesh/exec', { command, params: params || {} });
  },
};

// ─── Utility API ──────────────────────────────────────────────────────────────
export const utilityAPI = {
  downloadCalendar: (eventId, token) => {
    const url = `${API_URL}/events/${eventId}/calendar.ics`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event.ics';
    a.style.display = 'none';
    document.body.appendChild(a);
    fetch(url, { headers: { 'x-event-token': token } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      });
  },
  downloadParticipants: (eventId, token) => {
    const url = `${API_URL}/events/${eventId}/participants.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participants.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    fetch(url, { headers: { 'x-event-token': token } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      });
  },
  generateQRCode: (eventId) => `${API_URL}/events/${eventId}/qr.svg`,
};

// ─── Bug Report API ───────────────────────────────────────────────────────────
export const bugReportAPI = {
  submit: (data)     => api.post('/bug-reports', data),
  getAll: (params)   => api.get('/bug-reports/admin', { params }),
  update: (id, data) => api.patch(`/bug-reports/admin/${id}`, data),
  remove: (id)       => api.delete(`/bug-reports/admin/${id}`),
};

// ─── Discover API ─────────────────────────────────────────────────────────────
export const discoverAPI = {
  getPublicEvents: (params) => api.get('/events/public', { params }),
  uploadCover: (eventId, formData) => api.post(`/events/${eventId}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default api;
