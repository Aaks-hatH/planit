export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
export const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'localhost:5173';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_UPLOAD = 5;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_POLL_OPTIONS = 10;
export const MIN_POLL_OPTIONS = 2;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'application/zip'
];

export const EVENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const USER_ROLES = {
  ORGANIZER: 'organizer',
  PARTICIPANT: 'participant'
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  SYSTEM: 'system',
  FILE: 'file'
};

export const POLL_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed'
};
