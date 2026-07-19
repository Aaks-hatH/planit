// ─── PlanIt Service Categories ────────────────────────────────────────────────
// Shared between Status.jsx (public) and Admin.jsx (UptimePanel)
// Each service.key is matched against incident.affectedServices[]

export const SERVICE_CATEGORIES = [
  {
    id: 'main',
    label: 'Main Pages',
    icon: '',
    services: [
      { name: 'Homepage',           key: 'homepage'  },
      { name: 'About Page',         key: 'about'     },
      { name: 'Support Page',       key: 'support'   },
      { name: 'Wall of Supporters', key: 'wall'      },
      { name: 'Status Page',        key: 'status'    },
      { name: 'Terms of Service',   key: 'terms'     },
      { name: 'Privacy Policy',     key: 'privacy'   },
    ],
  },
  {
    id: 'planning',
    label: 'Planning & Events',
    icon: '',
    services: [
      { name: 'Event Creation',   key: 'event-creation'  },
      { name: 'Event Space',      key: 'event-space'     },
      { name: 'Tasks',            key: 'tasks'           },
      { name: 'Notes',            key: 'notes'           },
      { name: 'Expenses',         key: 'expenses'        },
      { name: 'Countdown Timer',  key: 'countdown'       },
      { name: 'Analytics',        key: 'analytics'       },
      { name: 'Announcements',    key: 'announcements'   },
      { name: 'Utilities',        key: 'utilities'       },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    icon: '',
    services: [
      { name: 'WebSocket Chat',  key: 'chat'     },
      { name: 'File Sharing',    key: 'storage'  },
      { name: 'Polls',           key: 'polls'    },
      { name: 'Guest Invites',   key: 'invites'  },
    ],
  },
  {
    id: 'checkins',
    label: 'Check-ins',
    icon: '',
    services: [
      { name: 'Standard Check-in',    key: 'checkin'             },
      { name: 'Enterprise Check-in',  key: 'enterprise-checkin'  },
      { name: 'Manager Override',     key: 'manager-override'    },
      { name: 'QR Code Check-in',     key: 'qr-checkin'          },
      { name: 'Guest Check-in',       key: 'guest-checkin'       },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    icon: '',
    services: [
      { name: 'Enterprise Features', key: 'enterprise'       },
      { name: 'Security Settings',   key: 'security'         },
      { name: 'Data Retention',      key: 'data-retention'   },
      { name: 'Manager Controls',    key: 'manager-controls' },
      { name: 'Organizer Login',     key: 'organizer-login'  },
    ],
  },
  {
    id: 'auth',
    label: 'Authentication',
    icon: '',
    services: [
      { name: 'Login & Sessions',   key: 'auth'       },
      { name: 'Token Validation',   key: 'tokens'     },
      { name: 'Anti-fraud System',  key: 'antifraud'  },
      { name: 'Rate Limiting',      key: 'rate-limit' },
    ],
  },
  {
    id: 'api',
    label: 'API & Infrastructure',
    icon: '',
    services: [
      { name: 'REST API',          key: 'api'       },
      { name: 'WebSocket Server',  key: 'websocket' },
      { name: 'Background Jobs',   key: 'jobs'      },
      { name: 'Response Signing',  key: 'signing'   },
    ],
  },
  {
    id: 'database',
    label: 'Database & Storage',
    icon: '',
    services: [
      { name: 'MongoDB Database', key: 'database'     },
      { name: 'Redis Cache',      key: 'redis'        },
      { name: 'File Storage',     key: 'file-storage' },
      { name: 'Media Processing', key: 'media'        },
      { name: 'Backup Systems',   key: 'backups'      },
    ],
  },
  {
    id: 'table-service',
    label: 'Table Service',
    icon: '',
    services: [
      { name: 'Table Management',    key: 'table-management'    },
      { name: 'Waitlist',            key: 'waitlist'            },
      { name: 'QR Reservations',     key: 'qr-reservations'    },
      { name: 'Floor Map',           key: 'floor-map'           },
      { name: 'Server Assignment',   key: 'server-assignment'   },
      { name: 'Public Wait Board',   key: 'wait-board'          },
      { name: 'Reservation System',  key: 'reservation-system'  },
      { name: 'Walk-in Management',  key: 'walkin-management'   },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications & Alerts',
    icon: '',
    services: [
      { name: 'Email Delivery',    key: 'email'        },
      { name: 'Push Notifications',key: 'push'         },
      { name: 'ntfy Alerts',       key: 'ntfy'         },
      { name: 'SMS / Webhooks',    key: 'webhooks'     },
    ],
  },
];

// Flat list for dropdowns and matching
export const ALL_SERVICES_FLAT = SERVICE_CATEGORIES.flatMap(cat =>
  cat.services.map(s => ({ ...s, category: cat.label, categoryId: cat.id }))
);