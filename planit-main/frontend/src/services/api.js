import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Check if this is an admin request first
  const isAdminRequest = config.url && config.url.includes('/admin');
  
  if (isAdminRequest) {
    // For admin requests, ONLY use admin token
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  } else {
    // For regular event requests, use event token
    const token = localStorage.getItem('eventToken');
    if (token) {
      config.headers['x-event-token'] = token;
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAdminRequest = error.config?.url?.includes('/admin');
      
      if (isAdminRequest) {
        console.warn('Admin authentication failed, clearing admin token');
        localStorage.removeItem('adminToken');
        // Fire a custom event — React components listen for this and call
        // navigate('/admin') themselves, avoiding a full-page reload loop.
        window.dispatchEvent(new CustomEvent('planit:admin-logout'));
      } else {
        localStorage.removeItem('eventToken');
        localStorage.removeItem('username');
        window.dispatchEvent(new CustomEvent('planit:event-logout'));
      }
    }
    return Promise.reject(error);
  }
);

export const eventAPI = {
  create: (data) => api.post('/events', data),
  getBySubdomain: (subdomain) => api.get(`/events/subdomain/${subdomain}`),
  getById: (id) => api.get(`/events/${id}`),
  getPublicInfo: (id) => api.get(`/events/public/${id}`),
  getParticipants: (id) => api.get(`/events/participants/${id}`),
  verifyPassword: (id, data) => api.post(`/events/verify-password/${id}`, data),
  join: (id, data) => api.post(`/events/join/${id}`, data),
  setPassword: (id, data) => api.post(`/events/set-password/${id}`, data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  
  // RSVP
  rsvp: (eventId, data) => api.post(`/events/${eventId}/rsvp`, data),
  
  // Agenda
  getAgenda: (eventId) => api.get(`/events/${eventId}/agenda`),
  addAgendaItem: (eventId, data) => api.post(`/events/${eventId}/agenda`, data),
  deleteAgendaItem: (eventId, itemId) => api.delete(`/events/${eventId}/agenda/${itemId}`),
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ENTERPRISE CHECK-IN & INVITES
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Invites Management
  getInvites: (eventId) => api.get(`/events/${eventId}/invites`),
  createInvite: (eventId, data) => {
    // Backend expects { guests: [...] } format
    const payload = {
      guests: [data] // Wrap single guest in array
    };
    return api.post(`/events/${eventId}/invites`, payload);
  },
  updateInvite: (eventId, inviteId, data) => {
    // Note: Backend doesn't have update route, so we'll need to add it
    // For now, return a rejected promise with clear message
    return Promise.reject(new Error('Update invite endpoint not yet implemented on backend'));
  },
  deleteInvite: (eventId, inviteId) => api.delete(`/events/${eventId}/invites/${inviteId}`),
  
  // Check-in Process
  verifyScan: (eventId, inviteCode) => api.get(`/events/${eventId}/verify-scan/${inviteCode}`),
  verifyPin: (eventId, inviteCode, pin) => api.post(`/events/${eventId}/verify-pin/${inviteCode}`, { pin }),
  checkIn: (eventId, inviteCode, data) => api.post(`/events/${eventId}/checkin/${inviteCode}`, data),
  
  // Check-in Stats & Settings
  getCheckInStats: (eventId) => api.get(`/events/${eventId}/checkin-stats`),
  getCheckInSettings: (eventId) => api.get(`/events/${eventId}/checkin-settings`),
  updateCheckInSettings: (eventId, settings) => api.patch(`/events/${eventId}/checkin-settings`, settings),
};

export const chatAPI = {
  getMessages: (eventId, params) => api.get(`/chat/${eventId}/messages`, { params }),
  sendMessage: (eventId, data) => api.post(`/chat/${eventId}/messages`, data),
  editMessage: (eventId, messageId, data) => api.put(`/chat/${eventId}/messages/${messageId}`, data),
  deleteMessage: (eventId, messageId, data) => api.delete(`/chat/${eventId}/messages/${messageId}`, { data }),
  addReaction: (eventId, messageId, data) => api.post(`/chat/${eventId}/messages/${messageId}/reactions`, data),
  removeReaction: (eventId, messageId, data) => api.delete(`/chat/${eventId}/messages/${messageId}/reactions`, { data }),
};

export const pollAPI = {
  getAll: (eventId) => api.get(`/polls/${eventId}`),
  create: (eventId, data) => api.post(`/polls/${eventId}`, data),
  vote: (eventId, pollId, data) => api.post(`/polls/${eventId}/polls/${pollId}/vote`, data),
  getResults: (eventId, pollId) => api.get(`/polls/${eventId}/polls/${pollId}/results`),
  close: (eventId, pollId, data) => api.post(`/polls/${eventId}/polls/${pollId}/close`, data),
  delete: (eventId, pollId, data) => api.delete(`/polls/${eventId}/polls/${pollId}`, { data }),
};

export const fileAPI = {
  upload: (eventId, formData) => api.post(`/files/${eventId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: (eventId) => api.get(`/files/${eventId}`),
  download: (eventId, fileId) => api.get(`/files/${eventId}/download/${fileId}`, { responseType: 'blob' }),
  delete: (eventId, fileId, data) => api.delete(`/files/${eventId}/${fileId}`, { data }),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED ADMIN API - FULL CONTROL CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

export const adminAPI = {
  // ─── Authentication ─────────────────────────────────────────────────────
  login: (username, password) => api.post('/admin/login', { username, password }),
  
  // ─── Dashboard & Statistics ─────────────────────────────────────────────
  getStats: () => api.get('/admin/stats'),
  getActivity: (params) => api.get('/admin/activity', { params }),
  
  // ─── Event Management ───────────────────────────────────────────────────
  getEvents: (params) => api.get('/admin/events', { params }),
  getEvent: (id) => api.get(`/admin/events/${id}`),
  getEventAccess: (id) => api.post(`/admin/events/${id}/access`),
  updateEvent: (id, data) => api.patch(`/admin/events/${id}`, data),
  updateEventStatus: (id, status) => api.patch(`/admin/events/${id}/status`, { status }),
  deleteEvent: (id) => api.delete(`/admin/events/${id}`),
  
  // ─── Messages Management ────────────────────────────────────────────────
  getMessages: (eventId) => api.get(`/admin/events/${eventId}/messages`),
  deleteMessage: (eventId, messageId) => api.delete(`/admin/events/${eventId}/messages/${messageId}`),
  bulkDeleteMessages: (eventId, messageIds) => api.post(`/admin/events/${eventId}/messages/bulk-delete`, { messageIds }),
  
  // ─── Participants Management ────────────────────────────────────────────
  getParticipants: (eventId) => api.get(`/admin/events/${eventId}/participants`),
  removeParticipant: (eventId, username) => api.delete(`/admin/events/${eventId}/participants/${username}`),
  resetParticipantPassword: (eventId, username) => api.delete(`/admin/events/${eventId}/participants/${username}/password`),
  bulkRemoveParticipants: (eventId, usernames) => api.post(`/admin/events/${eventId}/participants/bulk-remove`, { usernames }),
  
  // ─── Polls Management ───────────────────────────────────────────────────
  getPolls: (eventId) => api.get(`/admin/events/${eventId}/polls`),
  deletePoll: (eventId, pollId) => api.delete(`/admin/events/${eventId}/polls/${pollId}`),
  
  // ─── Files Management ───────────────────────────────────────────────────
  getFiles: (eventId) => api.get(`/admin/events/${eventId}/files`),
  deleteFile: (eventId, fileId) => api.delete(`/admin/events/${eventId}/files/${fileId}`),
  
  // ─── Invites Management (Enterprise) ────────────────────────────────────
  getInvites: (eventId) => api.get(`/admin/events/${eventId}/invites`),
  checkInGuest: (eventId, inviteCode, actualAttendees) => 
    api.post(`/admin/events/${eventId}/invites/${inviteCode}/checkin`, { actualAttendees }),
  deleteInvite: (eventId, inviteId) => api.delete(`/admin/events/${eventId}/invites/${inviteId}`),
  
  // ─── Search & Discovery ─────────────────────────────────────────────────
  search: (query) => api.get('/admin/search', { params: { q: query } }),
  
  // ─── Data Export ────────────────────────────────────────────────────────
  exportData: (type, eventId) => api.get('/admin/export', { 
    params: { type, eventId } 
  }),
  exportStats: () => api.get('/admin/export/stats'),

  // Manual cleanup
  manualCleanup: () => api.post('/admin/cleanup'),
};

// Tasks
export const taskAPI = {
  getAll: (eventId) => api.get(`/events/${eventId}/tasks`),
  create: (eventId, data) => api.post(`/events/${eventId}/tasks`, data),
  toggle: (eventId, taskId) => api.patch(`/events/${eventId}/tasks/${taskId}/toggle`),
  delete: (eventId, taskId) => api.delete(`/events/${eventId}/tasks/${taskId}`)
};

// Announcements
export const announcementAPI = {
  getAll: (eventId) => api.get(`/events/${eventId}/announcements`),
  create: (eventId, data) => api.post(`/events/${eventId}/announcements`, data),
  delete: (eventId, announcementId) => api.delete(`/events/${eventId}/announcements/${announcementId}`)
};

// Expenses
export const expenseAPI = {
  getAll: (eventId) => api.get(`/events/${eventId}/expenses`),
  create: (eventId, data) => api.post(`/events/${eventId}/expenses`, data),
  delete: (eventId, expenseId) => api.delete(`/events/${eventId}/expenses/${expenseId}`),
  updateBudget: (eventId, budget) => api.patch(`/events/${eventId}/budget`, { budget })
};

// Notes
export const noteAPI = {
  getAll: (eventId) => api.get(`/events/${eventId}/notes`),
  create: (eventId, data) => api.post(`/events/${eventId}/notes`, data),
  update: (eventId, noteId, data) => api.put(`/events/${eventId}/notes/${noteId}`, data),
  delete: (eventId, noteId) => api.delete(`/events/${eventId}/notes/${noteId}`)
};

// Analytics
export const analyticsAPI = {
  get: (eventId) => api.get(`/events/${eventId}/analytics`)
};

// Utilities
export const utilityAPI = {
  downloadCalendar: (eventId, token) => {
    const url = `${API_URL}/events/${eventId}/calendar.ics`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event.ics';
    a.style.display = 'none';
    document.body.appendChild(a);
    fetch(url, {
      headers: { 'x-event-token': token }
    }).then(res => res.blob()).then(blob => {
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
    fetch(url, {
      headers: { 'x-event-token': token }
    }).then(res => res.blob()).then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.click();
      URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    });
  },
  generateQRCode: (url) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  }
};

export default api;
