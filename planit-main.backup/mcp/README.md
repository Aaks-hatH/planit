# PlanIt MCP Server

Claude can create and manage your entire PlanIt event through conversation. Plan it, build the guest list, set up seating, monitor check-ins, send announcements, and coordinate staff — all by talking to Claude.

This is a **hosted remote MCP server** — there's nothing to install. Claude connects to it over the internet, the same way it connects to any other remote tool.

---

## What you can do

- **Create events** — name, date, time, passwords, guest capacity, automatic mode selection, and one-time recovery code delivery
- **Manage guests** — add individually, bulk import, search, update, remove
- **Seating** — create tables, assign guests, get the full seating map
- **Check-in** — live stats, recent activity, manual check-in, manager overrides
- **Announcements** — push messages to guests, staff, or everyone instantly
- **RSVP** — configure your RSVP page, view responses
- **Table service** — waitlist, walk-ins, live occupancy, table status
- **Tasks & budget** — track planning tasks, log expenses
- **Polls** — create polls for guests, see results in real-time
- **Security** — view alerts, handle flagged check-ins

---

## Connecting via Claude

1. Open [Claude.ai](https://claude.ai) and start a new conversation
2. Click the **Connect** button on the PlanIt site, which links to:
   ```
   https://claude.ai/add-mcp?url=https://mcp.planitapp.onrender.com
   ```
3. PlanIt tools will appear in Claude automatically
4. Say something like _"I want to manage my PlanIt event"_ — Claude will guide you through connecting

---

## How the event connection works

When you ask Claude to connect to an existing event, it generates a one-time link (valid for 10 minutes, single-use). You open the link, enter your **Event ID** and **Organiser Password**, and the backend verifies your credentials and issues Claude a scoped session token. Claude then has full organiser access to that event — and only that event — until the event's 7-day post-event window expires.

When Claude creates a brand-new event with `create_event`, no prior connection is required. The backend creates the event, creates the organiser participant, mints the same scoped MCP session for the current Claude conversation, and returns the event URL plus a one-time organiser recovery code. Claude must show that recovery code to the organiser immediately and explain that it can reset the Organiser Password at `https://planitapp.onrender.com/forgot-password` by entering the event link/Event ID, organiser display name, recovery code, and a new password. The recovery code is shown once, stored only as a hash, and cannot be retrieved later.

**Important:**
- The connection is scoped to one event at a time
- Only one Claude session can be connected to an event at a time
- You can reconnect at any time by asking Claude for a new connection link
- Claude's access expires automatically with your event data (7 days after the event date)

---

## Event modes Claude can choose

Claude should infer the mode from the organiser's goals rather than asking technical setup questions first:

- **Regular event**: parties, weddings, meetups, conferences, private gatherings, and other standard events.
- **Enterprise event**: larger operations that need stronger check-in flow, staff coordination, security monitoring, high guest capacity, or stricter entry controls.
- **Table service event**: restaurants, hospitality venues, reservation/waitlist workflows, live occupancy, walk-ins, and table status management.

The MCP `create_event` tool accepts `isEnterpriseMode`, `isTableServiceMode`, and optional `staffPassword` so Claude can create the right kind of event from the organiser's stated needs.

---

## Example prompts

```
"Create an event called Summer Gala on July 12th for 150 guests"
"Add Sarah Jones to the guest list, email sarah@example.com"
"Create 15 round tables of 10 and set them up in the seating map"
"How many people have checked in so far?"
"Send an announcement to all staff that doors open in 10 minutes"
"What tasks are still incomplete?"
"Add John Smith as a walk-in, party of 3"
"Give me a summary of tonight's event"
"When does my data get deleted?"
"Set the RSVP deadline to June 30th"
"Which guests haven't checked in yet?"
"Move table 4 to cleaning status"
"Show me the seating map"
"Create a poll: which meal option did guests prefer?"
"What's our current budget situation?"
"Are there any security alerts tonight?"
"Check if Emma Thompson is on the guest list"
```

---

## Privacy

- Claude's access is scoped to **one event only** — it cannot see other events
- The session token expires automatically when the event's 7-day post-event window ends
- You can reconnect at any time, which immediately invalidates the previous session
- The MCP server has no knowledge of PlanIt's internal database structure, routes, or models — all tool calls proxy through a single `/mcp/action` endpoint on the backend

---

## Developer documentation

### Running locally

```bash
cd mcp
npm install
cp .env.example .env
# Fill in MCP_SERVER_SECRET and PLANIT_API_URL in .env
node server.js
```

The server starts an Express app with the SSE transport on `PORT` (default `3100`).

### Environment variables

| Variable | Description |
|---|---|
| `PLANIT_API_URL` | URL of the PlanIt backend (default: `https://planitapp.onrender.com`) |
| `MCP_SERVER_SECRET` | Shared secret between MCP server and backend — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | Redis connection URL, used for session tracking |
| `PORT` | Port for the SSE server (Render sets this automatically) |

**Backend env vars to add:**

```
MCP_SERVER_SECRET=<same value as above>
MCP_JWT_SECRET=<generate separately with the same command>
```

### Adding new tools

1. Create or edit a file in `mcp/tools/`
2. Export an array of tool objects, each with `name`, `description`, `inputSchema`, and an async `execute(params, sessionId)` function
3. Add the tool name to the `switch` statement in `backend/routes/mcp.js` with a handler that operates on the Mongoose models directly
4. Import and spread the new tool file in `mcp/tools/index.js`

### How it works

`transport/sse.js` runs an Express server listening on `PORT`. Each `GET /sse` connection creates a new session (`auth/session.js`) and opens an MCP server instance over SSE. Tool calls arrive via `POST /messages` with the session ID in the `Mcp-Session-Id` header, get routed to the matching session's MCP server, and execute through `client/api.js`, which proxies to the single `POST /mcp/action` endpoint on the PlanIt backend.

### Deploying to Render

1. Create a new Web Service pointing at the `mcp/` directory
2. Set build command: `npm install`
3. Set start command: `node server.js`
4. Set environment variables:
   - `PLANIT_API_URL=https://planitapp.onrender.com`
   - `MCP_SERVER_SECRET=<your secret>`
   - `REDIS_URL=<your redis url>`
   - `PORT` is set automatically by Render

### Registering the backend route

Add this one line to `backend/server.js` where other routes are registered:

```js
app.use('/mcp', require('./routes/mcp'));
```

### Registering the frontend page

Add this import and route to `frontend/src/App.jsx`:

```jsx
// At the top with other lazy imports:
const ClaudeConnect = lazy(() => import('./pages/ClaudeConnect'));

// Inside <Routes>:
<Route path="/claude-connect" element={<ClaudeConnect />} />
```
