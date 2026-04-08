# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Important: Proprietary Software

**PlanIt is proprietary, not open-source.** The repository is published for transparency only.

- Self-hosting, forking, modifying, or redistributing the code is **not permitted**
- Use only through the official hosted service at planitapp.onrender.com
- See `planit-main/planit-main/LICENSE` for full license terms

---

## Project Structure

```
planit-main/
└── planit-main/
    ├── backend/     # Node.js 24.x Express API server
    ├── frontend/    # React 18 + Vite SPA
    ├── router/      # Node.js 20.x sticky load balancer
    ├── watchdog/    # Node.js 20.x uptime monitoring service
    └── docs/        # Static documentation (Netlify)
```

## Commands

### Backend
```bash
cd planit-main/planit-main/backend
npm install          # Install dependencies
npm start            # Run production server
npm run dev          # Run with nodemon (development)
npx eslint . --ext .js           # Lint
npx eslint . --ext .js --fix     # Auto-fix lint issues
```

### Frontend
```bash
cd planit-main/planit-main/frontend
npm install          # Install dependencies
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint
```

### Router
```bash
cd planit-main/planit-main/router
npm install
npm start
npm run dev
```

### Watchdog
```bash
cd planit-main/planit-main/watchdog
npm install
npm start
npm run dev
```

## High-Level Architecture

**Backend** (`server.js`):
- Express API with Socket.IO for real-time features
- MongoDB via Mongoose (18+ models: Event, Employee, Invite, WhiteLabel, etc.)
- Redis adapter for Socket.IO mesh networking
- Middleware stack: auth, security (helmet), rate limiting, tarpit, mesh sync, antifraud
- Background jobs: cleanup scheduler (7-day data retention), blog seeder
- WebSocket sockets: chat, walkie-talkie (WebRTC push-to-talk)

**Frontend**:
- React 18 SPA with Vite, PWA support (offline-first for check-in)
- Zustand for state management
- Three.js for 3D graphics (StarBackground, visual effects)
- Key features: QR check-in, drag-and-drop seating, walkie-talkie, analytics

**Router**:
- Sticky load balancer for multiple backend instances
- Routes Socket.IO traffic correctly to maintain WebSocket affinity

**Watchdog**:
- External monitoring service for uptime and mesh health checks

## Key Patterns

- **7-day data retention**: All event data auto-deleted 7 days after event date
- **Mesh networking**: Multiple backend instances sync via Redis adapter
- **License key verification**: White-label licensing for enterprise customers
- **Offline-first PWA**: Check-in works offline, syncs on reconnect

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Dependency audit
- Secret scanning (gitleaks)
- Backend ESLint
- Frontend ESLint
- PR size check (max 800 lines)

CODEOWNERS requires approval for all PRs.

## Dependencies

**Backend**: Express, Mongoose, Socket.IO, Redis (ioredis), bcryptjs, jsonwebtoken, helmet, express-rate-limit, Stripe, Cloudinary, node-cron, qrcode, speakeasy (2FA)

**Frontend**: React 18, React Router, Framer Motion, Three.js (@react-three/fiber), Socket.IO client, Zustand, Tailwind CSS, html5-qrcode
