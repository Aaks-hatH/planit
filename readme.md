# PlanIt

**Professional event management. Free to use.**

PlanIt is a hosted event management platform for organisers who need professional check-in, guest management, seating, and real-time staff tools without subscription fees or enterprise overhead.

---

## Using PlanIt

PlanIt is available at **[planitapp.onrender.com](https://planitapp.onrender.com)**.

Create an organiser account, set up an event, add guests, and share invite links. No configuration, no server setup, no deployment required.

Full documentation is available at the docs site.

---

## What PlanIt does

**For organisers**
- Create and manage events with a full guest list
- Add guests individually or via CSV bulk import
- Assign seating with a drag-and-drop visual map
- Set security levels and anti-fraud rules
- View real-time check-in statistics and activity logs

**For check-in staff**
- PIN-based staff login — no organiser access required
- QR code scanning via device camera
- Boarding-pass review before admitting guests
- Offline mode with automatic sync on reconnect
- Walkie-talkie (WebRTC push-to-talk) for team communication

**For guests**
- Personal invite link with QR code — no account required
- Mobile wallet card view (`/card/CODE`)
- Print-ready name badge (`/badge/CODE`)
- Direct QR image embed URL (`/qr/CODE`)

---

## Licence

**PlanIt is proprietary freeware.**

This repository is published for transparency. It is **not open-source software**.

The following are **not permitted**:

- Self-hosting or operating your own instance of PlanIt
- Forking, modifying, or redistributing the source code
- Using PlanIt's codebase as the basis for another product
- Removing or altering copyright notices

The software is free to use through the official hosted service at [planitapp.onrender.com](https://planitapp.onrender.com). No fee is charged for use of the hosted service.

For the full licence terms, see [LICENSE](./planit-main/LICENSE).

---

## Technology

PlanIt is built with:

- **Backend:** Node.js, Express, MongoDB, Redis, Socket.IO
- **Frontend:** React, Vite, Tailwind CSS
- **Real-time:** WebSocket mesh for check-in sync and walkie-talkie
- **QR:** `qrcode` library, `html5-qrcode` for scanning
- **Deployment:** Render (backend + frontend), Netlify (docs)

This information is provided for transparency. It does not constitute permission to reproduce the architecture or implementation.

---

## Reporting issues

Use the support form at [planitapp.onrender.com/help](https://planitapp.onrender.com/help) to report bugs or request help.

Do not open GitHub issues for support requests. Issues in this repository are for tracking acknowledged defects only.

---

## Data and privacy

PlanIt stores the minimum data necessary to operate. All event data is automatically deleted seven days after the event date. See the [Privacy Policy](https://planitapp.onrender.com/privacy) for full details.

---

&copy; PlanIt. All rights reserved.
