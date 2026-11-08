import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock, ArrowRight, ArrowUpRight,
  Eye, EyeOff, Zap, ListChecks, AlertCircle, UtensilsCrossed, QrCode, Bot, CheckSquare,
  CornerDownRight, Menu, X, Layers, MapPin, Clock, CheckCircle2, Share2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getUserTimezone, localDateTimeToUTC, getTimezoneOptions, detectTimezone } from '../utils/timezoneUtils';
import { validateEmail } from '../utils/validators';
import { eventAPI } from '../services/api';
import { trackFeature, flushTracker } from '../services/tracker';
import { trackGAEvent } from '../services/analytics';
import RecoveryCodeModal from '../components/RecoveryCodeModal';
import TurnstileWidget from '../components/TurnstileWidget';
import { useWhiteLabel } from '../context/WhiteLabelContext';

/*
================================================================================
================================================================================
================================================================================

                     PLANIT PLATFORM — MASTER LICENSE AGREEMENT
                    CONSOLIDATED INTELLECTUAL PROPERTY DECLARATION

================================================================================
================================================================================
================================================================================

                           PlanIt Platform License — Version 2.0
                                     March 2026

              Copyright (c) 2026 Aakshat Hariharan. All Rights Reserved.

                          planit.userhelp@gmail.com
                        https://planitapp.onrender.com

================================================================================
================================================================================

                       IMPORTANT — READ BEFORE PROCEEDING

================================================================================
================================================================================

This Master License Agreement ("Master Agreement") is the single authoritative
legal instrument governing all intellectual property rights in and to the PlanIt
platform, a proprietary event management and white-label SaaS platform created,
owned, and operated solely by Aakshat Hariharan ("Author").

The PlanIt platform is not a single application. It is a multi-service
distributed system comprising four distinct software components, each of which
is separately developed, separately deployed, and separately owned by the Author.
This Master Agreement consolidates the four individual component license
agreements into a single document and establishes the overarching legal framework
that governs all of them.

This document serves three purposes:

   FIRST:   It explains in plain terms what each component of the PlanIt platform
            is, what it does, and why it is protected.

   SECOND:  It sets out the overarching licensing terms that apply across all
            components of the platform as a unified whole.

   THIRD:   It reproduces in full each individual component license agreement,
            so that the complete legal terms for every part of the platform
            are accessible in a single place.

BY ACCESSING THE REPOSITORY CONTAINING ANY COMPONENT OF THE PLANIT PLATFORM,
VIEWING ANY SOURCE CODE FILE, CLONING OR FORKING THE REPOSITORY, RUNNING ANY
COMPONENT LOCALLY, OR USING THE HOSTED SERVICE AT PLANITAPP.ONRENDER.COM, YOU
AGREE TO BE LEGALLY BOUND BY THIS MASTER AGREEMENT AND BY EACH INDIVIDUAL
COMPONENT LICENSE THAT APPLIES TO THE PORTION OF THE SOFTWARE YOU ARE ACCESSING.

IF YOU DO NOT AGREE TO THESE TERMS, IMMEDIATELY CEASE ALL INTERACTION WITH THE
PLANIT PLATFORM IN ANY FORM.

================================================================================
================================================================================

                  PART ONE: THE PLANIT PLATFORM — AN OVERVIEW
          (Understanding What You Are Licensing Before Reading the Terms)

================================================================================
================================================================================

The purpose of this section is to give You context. A software license is
meaningless without understanding what is being licensed and why. The following
describes each component of the PlanIt platform, what it does, and what makes
it proprietary — before the formal legal terms begin.

────────────────────────────────────────────────────────────────────────────────
COMPONENT A: THE FRONTEND APPLICATION
────────────────────────────────────────────────────────────────────────────────

The PlanIt Frontend Application is the client-side web application that users
interact with directly. It is built with React and Vite and is served as a
single-page application at planitapp.onrender.com. It encompasses:

  THE PUBLIC-FACING EXPERIENCE: The PlanIt homepage (event creation form, venue
  mode, branch selector), the event discovery page, and all publicly accessible
  marketing and informational pages.

  THE EVENT MANAGEMENT INTERFACE: The EventSpace — the rich, real-time event
  dashboard through which organizers manage attendees, run chat, conduct polls,
  share files, manage seating charts, track budgets, post announcements, and
  view analytics.

  THE ADMIN PANEL: A password-protected multi-section administrative interface
  through which the Author manages all events, white-label clients, billing,
  employees, incident reporting, system settings, and security monitoring across
  the entire platform.

  THE WHITE-LABEL CLIENT PORTAL: A self-service portal (/dashboard) accessible
  on white-label custom domains, allowing paying white-label clients to customize
  their platform's branding, page content, feature flags, and security settings.

  THE WHITE-LABEL THEMING SYSTEM: A dynamic CSS variable injection architecture
  that transforms the application's visual identity at runtime based on a white-
  label client's branding configuration (colors, fonts, logo, company name),
  allowing a single React application to serve hundreds of differently-branded
  instances.

  THE WHITE-LABEL HOME PAGE (WLHome): A branded landing page served at the root
  URL of white-label custom domains, showing the client's own hero content, event
  discovery feed scoped to their tenant, and contact information — without any
  PlanIt branding where the client has configured hidePoweredBy.

  THE RESERVATION SYSTEM: The ReservePage and associated flows through which
  guests discover, reserve, and receive confirmation for event spots, with
  white-label customizable messaging throughout.

  ADDITIONAL FLOWS: Public ticket pages, waitlist signup, organizer login,
  table service interfaces for venue mode, check-in kiosks, QR-code-based
  guest invite flows, invitation badge and card generators, and support flows.

  THE DESIGN SYSTEM: A complete, proprietary visual language — dark-mode first,
  built on a near-black (#080810) base, with blue-to-indigo gradients, ambient
  radial glow orbs as decorative backgrounds, glassmorphism card treatments, and
  a distinctive micro-interaction vocabulary — that constitutes protectable trade
  dress and a commercial differentiator for the Author.

  THE WHITE-LABEL CONTEXT: A React context provider (WhiteLabelContext) that
  wraps the entire application, performing domain detection, branding resolution
  via the /api/whitelabel/resolve endpoint, cryptographic heartbeat verification
  via /api/whitelabel/heartbeat, and periodic re-enforcement — all at application
  startup and continuously while the app is running — to enforce white-label
  licensing terms in the browser without requiring any user action.

What makes the Frontend Application proprietary:

  The Frontend Application is the product of an enormous amount of creative
  design and engineering work. Its value lies not just in the code, but in
  the decisions: which components to build, how they interact, what the user
  experience flows feel like, how the white-label system works architecturally,
  and what the visual design language communicates. Taken as a whole, the
  Frontend Application constitutes both a copyrighted work and protectable
  trade dress. Individual components, when extracted, still carry the Author's
  copyright and may not be used without permission.

────────────────────────────────────────────────────────────────────────────────
COMPONENT B: THE BACKEND APPLICATION
────────────────────────────────────────────────────────────────────────────────

The PlanIt Backend Application is the server-side engine of the platform,
built on Node.js and Express.js and deployed as a fleet of five identical
instances (named Maverick, Goose, Iceman, Slider, and Viper). It encompasses:

  THE EVENT MANAGEMENT ENGINE: All API endpoints for creating, reading,
  updating, and deleting events; managing participants; handling RSVP flows;
  processing file uploads to Cloudinary; managing real-time chat via Socket.IO;
  conducting polls; and executing all other event-related business operations.

  THE AUTHENTICATION AND AUTHORIZATION SYSTEM: JWT-based authentication with
  per-role authorization (organizer, staff, guest, admin), bcrypt password
  hashing, secure token generation, and the admin credential verification
  system.

  THE WHITE-LABEL MANAGEMENT API: All endpoints for creating, managing,
  suspending, renewing, and configuring white-label client accounts, including
  the /resolve endpoint (which identifies a custom domain and returns its
  branding configuration) and the /heartbeat endpoint (which verifies that a
  white-label license is currently valid and active).

  THE CRYPTOGRAPHIC LICENSE KEY SYSTEM: A proprietary HMAC-SHA256-based license
  key generation and verification system with the format
  WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}. This system allows the
  backend to issue tamper-evident license keys to white-label clients and to
  verify their authenticity without a database lookup. The key format, hash
  algorithm, domain hash derivation, expiry encoding, and HMAC construction are
  all proprietary inventions of the Author.

  THE WHITE-LABEL CLIENT PORTAL API: Authenticated endpoints (/api/wl-portal/*)
  for white-label clients to log in to their self-service portal, update their
  branding configuration, customize page content, toggle feature flags, change
  their portal password, and review their login audit log.

  THE SECURITY MIDDLEWARE LAYER (trafficGuard): A comprehensive request
  inspection and traffic management middleware that provides: IP-based rate
  limiting; suspicious request pattern detection; automated attack mitigation;
  honeypot endpoint detection; bot signature identification; and integration
  with the platform's security monitoring system.

  THE EMAIL SERVICE: Integration with Brevo (primary) and Mailjet (fallback)
  for transactional email delivery, including event confirmation emails,
  participant join notifications, organizer alerts, and white-label billing
  communications.

  THE MAINTENANCE SYSTEM: A distributed maintenance mode implementation that
  coordinates across the Router Service and all Backend instances to enforce
  platform-wide maintenance windows, with carefully engineered exemptions that
  keep white-label client sites, uptime monitoring, and UptimeRobot health
  checks functioning even during PlanIt maintenance.

  THE DATA MODELS: A comprehensive set of Mongoose schemas defining the Event,
  WhiteLabel, WLLead, EventParticipant, Incident, and MaintenanceSchedule
  entities, with carefully designed indexes, validation rules, and field-level
  access controls.

  THE REAL-TIME LAYER: Socket.IO integration providing room-based event
  broadcasting, live participant state synchronization, real-time chat delivery,
  table service order notifications, and organizer announcements.

What makes the Backend Application proprietary:

  The Backend Application's value lies in three things: (1) the completeness
  and correctness of its data models, which encode all the Author's thinking
  about what an event management platform needs to track and how; (2) the
  security architecture, particularly the trafficGuard middleware and the
  white-label license enforcement system; and (3) the Cryptographic License
  Key System, which is a novel invention that enables offline-verifiable,
  tamper-evident license enforcement at scale. None of these may be copied,
  adapted, or used as a reference implementation without the Author's permission.

────────────────────────────────────────────────────────────────────────────────
COMPONENT C: THE ROUTER SERVICE
────────────────────────────────────────────────────────────────────────────────

The PlanIt Router Service is the intelligent HTTP traffic orchestration layer
deployed at planit-router.onrender.com. It sits between the public internet
and the Backend Fleet, and is responsible for:

  INTELLIGENT LOAD DISTRIBUTION: Routing incoming HTTP requests to the most
  appropriate backend instance using a proprietary scoring algorithm that
  factors in: real-time health status; consecutive alive/dead transitions;
  request history; and configured backend weights — not simple round-robin.

  HEALTH-AWARE ORCHESTRATION: Continuously polling all backend instances,
  maintaining their alive/dead state, and dynamically removing unhealthy
  instances from the routing pool without dropping in-flight requests.

  ADAPTIVE SCALING: A boost mode system that temporarily expands the active
  backend count during high-traffic periods, with configurable thresholds,
  duration, and reversion logic.

  MAINTENANCE COORDINATION: A distributed maintenance enforcement system that
  returns appropriate 503 responses during maintenance windows, with a carefully
  engineered list of exemptions that keep critical paths (white-label resolution,
  uptime monitoring, UptimeRobot health checks) accessible at all times.

  CORS MANAGEMENT: Dynamic CORS header injection that allows the Router to
  serve the PlanIt frontend, all white-label custom domains, and authorized
  development origins, pulling the current list of white-label domains from
  the Backend Fleet periodically.

  MESH AUTHENTICATION: An HMAC-based mutual authentication protocol for all
  inter-service communication (between the Router and the Backend Fleet),
  preventing unauthorized services from calling internal mesh endpoints.

  RESPONSE CACHING: A short-TTL response cache for frequently-requested
  read-only API endpoints, reducing Backend Fleet load for common data fetches.

  WEBSOCKET PROXYING: Pass-through of WebSocket upgrade requests and Socket.IO
  long-polling connections to the appropriate backend instance with sticky
  session behavior.

What makes the Router Service proprietary:

  The Router Service's value is entirely in its Routing Intelligence — the
  specific algorithm by which it selects backend instances. This is not publicly
  known and is not reproducible from first principles without the Author's
  specific engineering decisions. It also contains the Mesh Protocol, which
  is a custom security protocol designed specifically for the PlanIt platform.
  Both constitute trade secrets in addition to copyrighted works.

────────────────────────────────────────────────────────────────────────────────
COMPONENT D: THE WATCHDOG SERVICE
────────────────────────────────────────────────────────────────────────────────

The PlanIt Watchdog Service is an autonomous infrastructure monitoring daemon
that operates independently of all other platform components. It is responsible
for:

  REAL-TIME HEALTH MONITORING: Continuously polling the PlanIt Router Service,
  Backend Fleet instances, and all other monitored infrastructure components
  at configurable intervals, interpreting their health responses, and maintaining
  a live operational status picture.

  INCIDENT LIFECYCLE MANAGEMENT: Detecting incidents (service degradations or
  outages) based on consecutive health check failures, creating incident records,
  tracking their progression through open/investigating/resolved states, and
  auto-resolving incidents when services recover.

  ALERT ROUTING AND DELIVERY: Sending real-time push notifications via ntfy.sh
  and Discord webhooks when incidents are detected, when severity changes, and
  when incidents resolve — with alert deduplication and suppression logic to
  prevent notification flooding.

  UPTIME HISTORY AGGREGATION: Computing and storing rolling uptime percentages
  for all monitored services, providing historical availability data to the
  public PlanIt status page at planitapp.onrender.com/status.

  STATUS PAGE DATA API: Providing the /watchdog/status endpoint (mesh-
  authenticated) and the /api/uptime/status endpoint (public) through which
  the frontend status page retrieves current platform health information.

  AUTO-PROMOTION OF SCHEDULED MAINTENANCE: Polling for upcoming maintenance
  windows defined in the database and automatically promoting them to active
  maintenance mode at the correct time, coordinating across all Router and
  Backend instances.

What makes the Watchdog Service proprietary:

  The Watchdog Service's value lies in its Monitoring Intelligence — the
  specific configuration of polling intervals, failure thresholds, incident
  severity rules, alert routing logic, and uptime aggregation methodology
  that the Author has developed through operational experience running the
  PlanIt platform. These are not publicly known, are not derivable from
  generic monitoring best practices, and constitute trade secrets.

================================================================================
================================================================================

            PART TWO: OVERARCHING TERMS APPLICABLE TO ALL COMPONENTS

================================================================================
================================================================================

The following terms apply to the PlanIt platform as a unified whole, in
addition to the individual component license terms set out in Parts Three
through Six below.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 1 — UNIFIED OWNERSHIP DECLARATION
────────────────────────────────────────────────────────────────────────────────

M-1.1  The Author is the sole and exclusive owner of all intellectual property
       rights in and to the PlanIt platform as a whole and in each individual
       component thereof, including all copyrights, trade secrets, trade dress,
       and any other proprietary rights recognized under applicable law.

M-1.2  The PlanIt platform, considered as a whole, constitutes a collective
       work under copyright law in addition to the individual copyrights
       subsisting in each component. The Author owns the copyright in the
       collective work in addition to the component copyrights.

M-1.3  The architectural decisions that govern how the four components interact
       — the CORS scheme, the mesh authentication protocol, the white-label
       domain flow from frontend resolution through backend heartbeat to Router-
       level CORS registration, the maintenance exemption hierarchy — together
       constitute a proprietary system design that is itself a trade secret and
       copyrighted work of the Author, separate from and in addition to the
       individual component copyrights.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 2 — SCOPE OF THE MASTER AGREEMENT
────────────────────────────────────────────────────────────────────────────────

M-2.1  This Master Agreement governs any and all access to and use of the
       PlanIt platform, regardless of which component or components You interact
       with.

M-2.2  Where a more specific individual component license agreement addresses
       a particular topic (e.g., the Cryptographic License System in the Backend
       License, or the Routing Intelligence in the Router License), that
       specific provision takes precedence over any general provision in this
       Master Agreement with respect to that specific topic.

M-2.3  Interaction with any single component of the PlanIt platform (e.g.,
       reading only the Router source code) subjects You to the Master Agreement
       AND to the individual license agreement for that component.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 3 — UNIFIED GRANT OF LIMITED LICENSE
────────────────────────────────────────────────────────────────────────────────

M-3.1  Subject to Your full and continuous compliance with this Master
       Agreement and all applicable individual component license agreements,
       the Author grants You a limited, personal, non-exclusive, non-
       transferable, non-sublicensable, revocable license to:

       (a)  View the source code of any component of the PlanIt platform
            solely for personal, non-commercial educational and reference
            purposes; and

       (b)  Access and use the Hosted Service as an end-user for its intended
            purpose of event planning and event management, subject to the
            Terms of Service at planitapp.onrender.com.

M-3.2  White-label clients with executed white-label agreements hold additional
       rights as specified in those agreements only.

M-3.3  All rights not expressly granted are reserved by the Author.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 4 — UNIFIED RESTRICTIONS
────────────────────────────────────────────────────────────────────────────────

M-4.1  Across the entire PlanIt platform, without explicit prior written
       permission from the Author, You must NOT:

       (a)  Deploy any component of the platform on any infrastructure;
       (b)  Copy, clone, or reproduce any component in any form;
       (c)  Distribute any component to any third party;
       (d)  Create any Derivative Work from any component;
       (e)  Use any component for any Commercial Use;
       (f)  Reverse engineer any security or enforcement mechanism;
       (g)  Use any component's source code in any ML training dataset;
       (h)  Remove any copyright notice or proprietary marking.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 5 — NO OPEN SOURCE
────────────────────────────────────────────────────────────────────────────────

M-5.1  The PlanIt platform is NOT open source software. No component of the
       platform is released under any open-source license, including but not
       limited to the MIT License, Apache 2.0, GNU GPL, GNU LGPL, BSD licenses,
       Creative Commons licenses, or any other license that would permit
       copying, modification, or redistribution.

M-5.2  The presence of this source code in a publicly accessible repository
       does not, under any interpretation, constitute: (a) an open-source
       release; (b) a public domain dedication; (c) an implied license of any
       kind; (d) a waiver of any copyright or other proprietary right; or
       (e) consent to any use beyond viewing for educational reference.

M-5.3  The Author has chosen to make this source code publicly visible solely
       to demonstrate technical capability and for reference purposes. This
       choice is made expressly without waiving any intellectual property right.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 6 — UNIFIED DISCLAIMERS AND LIMITATIONS
────────────────────────────────────────────────────────────────────────────────

M-6.1  THE ENTIRE PLANIT PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF
       ANY KIND, EXPRESS OR IMPLIED. THE AUTHOR DISCLAIMS ALL WARRANTIES
       TO THE MAXIMUM EXTENT PERMITTED BY LAW.

M-6.2  THE AUTHOR'S TOTAL LIABILITY UNDER THIS MASTER AGREEMENT AND ALL
       INDIVIDUAL COMPONENT LICENSES COMBINED SHALL NOT EXCEED USD $100.00.

M-6.3  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL,
       INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM ANY COMPONENT OF
       THE PLATFORM.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 7 — GOVERNING LAW AND DISPUTE RESOLUTION
────────────────────────────────────────────────────────────────────────────────

M-7.1  This Master Agreement and all individual component license agreements
       shall be governed by the laws of the jurisdiction in which the Author
       resides, without regard to conflict of law principles.

M-7.2  Any dispute arising under this Master Agreement that cannot be resolved
       by direct negotiation between the parties shall be submitted to binding
       arbitration under rules mutually agreed by the parties, except that the
       Author shall always be entitled to seek emergency injunctive relief from
       any court of competent jurisdiction without first submitting to
       arbitration.

M-7.3  Each party irrevocably waives any objection to the venue or personal
       jurisdiction of courts in the Author's jurisdiction for any proceeding
       that escapes arbitration.

────────────────────────────────────────────────────────────────────────────────
MASTER SECTION 8 — CONTACT AND PERMISSIONS
────────────────────────────────────────────────────────────────────────────────

M-8.1  All requests for permissions beyond those granted in this Master
       Agreement — including commercial license inquiries, white-label
       partnership inquiries, academic use requests, and security vulnerability
       reports — must be directed to:

                    Email: planit.userhelp@gmail.com
                    Web:   https://planitapp.onrender.com (Support page)

M-8.2  Permission requests must be made in writing, must identify the
       requestor and their intended use in detail, and will be evaluated
       at the Author's sole discretion. Permission is never implied, deemed,
       or constructively granted.

================================================================================
================================================================================

             PART THREE: PLANIT FRONTEND APPLICATION LICENSE (FULL TEXT)

================================================================================
================================================================================

The following is the complete, unabridged text of the PlanIt Frontend
Application License Agreement, which governs all access to and use of the
PlanIt client-side React application. This component license is set out in
full below and is also available as the file LICENSE-FRONTEND in the root
of the frontend repository directory.

This license covers every .jsx, .tsx, .css, .html, .json, and .js file in
the /frontend/src/ directory and its subdirectories, the Vite configuration,
the PWA configuration, all design assets, and the complete Visual Design System
of the PlanIt platform.

────────────────────────────────────────────────────────────────────────────────

================================================================================
================================================================================

              PLANIT FRONTEND APPLICATION — PROPRIETARY SOFTWARE LICENSE
                         EXCLUSIVE RIGHTS RESERVED

================================================================================
================================================================================

                     PlanIt Frontend Interface License Agreement
                              Version 2.0 — January 2026

              Copyright (c) 2026 Aakshat Hariharan. All Rights Reserved.

                          planit.userhelp@gmail.com
                        https://planitapp.onrender.com

================================================================================
                            PREAMBLE AND LEGAL NOTICE
================================================================================

IMPORTANT — READ THIS ENTIRE AGREEMENT CAREFULLY BEFORE ACCESSING, VIEWING,
DOWNLOADING, CLONING, FORKING, INSPECTING, COMPILING, EXECUTING, OR OTHERWISE
INTERACTING WITH THE PLANIT FRONTEND APPLICATION OR ANY PORTION THEREOF.

This License Agreement ("Agreement") is a binding legal contract between You
and Aakshat Hariharan ("Author") governing all access to and use of the PlanIt
frontend application, its source code, compiled assets, design system, visual
components, and all related materials. This Agreement takes effect at the
earliest moment You interact with this software in any form — including the
act of reading this source code.

The public availability of this source code on a version control platform does
NOT constitute an open-source release, a public domain dedication, an implied
license, or consent to use, copy, fork, adapt, or build upon this work for any
purpose beyond the narrow rights expressly granted in Section 2.

================================================================================
SECTION 1 — DEFINITIONS
================================================================================

1.1   "Frontend Application" or "Software" means the PlanIt client-side web
      application in its entirety, encompassing all React component source files,
      all context providers and consumer hooks, all service modules and API client
      files, all UI components, design tokens, Tailwind CSS configuration, custom
      CSS stylesheets, animation definitions, the Vite build configuration, PWA
      manifest, public/ directory assets, the complete Visual Design System,
      the white-label theming architecture, and all documentation and code
      comments.

1.2   "Author" means Aakshat Hariharan, the sole designer, architect, developer,
      and intellectual property owner of the Frontend Application.

1.3   "You" or "Licensee" means any individual, developer, designer, engineer,
      researcher, student, company, organization, or other legal or natural
      person that accesses, views, reads, downloads, clones, compiles, executes,
      deploys, or otherwise interacts with the Frontend Application.

1.4   "Hosted Service" means the production deployment at planitapp.onrender.com
      and all associated white-label custom domains.

1.5   "Visual Design System" means the complete proprietary visual language
      including dark color palette, gradient definitions, glassmorphism
      treatments, ambient glow patterns, typography hierarchy, micro-interaction
      patterns, icon usage conventions, and overall aesthetic system.

1.6   "Derivative Work" means any work derived from, copying, adapting, or
      substantially similar to the Frontend Application in code, design,
      architecture, or user experience.

1.7   "Commercial Use" means any use in connection with any revenue-generating
      activity.

1.8   "Deploy" means to serve, host, publish, or make operational the Frontend
      Application on any infrastructure.

1.9   "Distribute" means to share, transfer, publish, or make available the
      Frontend Application to any third party.

================================================================================
SECTION 2 — GRANT OF LIMITED LICENSE
================================================================================

2.1   The Author grants You a limited, personal, non-exclusive, non-transferable,
      non-sublicensable, revocable license to: (a) view the source code for
      personal educational reference; and (b) access and use the Hosted Service
      as an end-user.

2.2   White-label clients with executed agreements hold additional rights per
      those agreements only.

2.3   All rights not expressly granted are reserved by the Author.

2.4   The Author may revoke this license at any time without notice.

================================================================================
SECTION 3 — RESTRICTIONS ON USE
================================================================================

3.1   Without prior explicit written permission from the Author, You will NOT:

      (a)  Copy, clone, mirror, or reproduce the Frontend Application;
      (b)  Deploy the Frontend Application on any infrastructure;
      (c)  Distribute the Frontend Application to any third party;
      (d)  Modify or create any Derivative Work;
      (e)  Reverse engineer any compiled or minified portion;
      (f)  Use the Visual Design System for any other product's design;
      (g)  Use any portion for Commercial Use;
      (h)  Remove any copyright notices, license notices, or attributions;
      (i)  Use "PlanIt" or "Aakshat Hariharan" without written consent;
      (j)  Use automated tools to extract source code or content at scale;
      (k)  Use source code in ML training datasets or code generation models;
      (l)  Frame or embed the Hosted Service to misrepresent its origin;
      (m)  Circumvent any technical enforcement mechanism.

3.2   Restrictions apply to the whole and to every individual component,
      file, function, style, and design choice within the Frontend Application.

================================================================================
SECTION 4 — INTELLECTUAL PROPERTY OWNERSHIP
================================================================================

4.1   The Frontend Application and all constituent elements are the sole and
      exclusive property of the Author.

4.2   The Visual Design System constitutes protectable trade dress and
      confidential trade secret information.

4.3   The white-label theming architecture, including the WhiteLabelContext,
      heartbeat verification, and CSS variable injection, constitutes a
      proprietary technical system and trade secret.

4.4   Any feedback or input You provide is assigned to the Author in full
      without compensation.

4.5   Third-party open-source dependency copyrights remain with their respective
      owners. The Author's rights extend to original creative expression in
      how those dependencies are assembled and used.

================================================================================
SECTIONS 5–11 — CONFIDENTIALITY, WARRANTIES, LIABILITY, INDEMNIFICATION,
TERMINATION, ENFORCEMENT, GENERAL PROVISIONS
================================================================================

5.1   You agree to treat the source code, design decisions, component
      architecture, and all non-public aspects as strictly confidential.

5.2   You agree not to disclose any Confidential Information to any third party.

6.1   THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.

6.2   THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.

7.1   IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
      SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

7.2   THE AUTHOR'S TOTAL LIABILITY SHALL NOT EXCEED USD $100.00.

8.1   You agree to indemnify and hold harmless the Author from any claims
      arising from Your breach of this Agreement.

9.1   This Agreement is effective from first access and continues until
      terminated. Breach results in immediate termination without notice.

9.3   Upon termination, You must cease all use and permanently delete all copies.

10.1  The Author is entitled to seek injunctive relief without bond for any
      unauthorized use.

11.1  Governing Law: jurisdiction of the Author's residence.
11.2  Entire Agreement: supersedes all prior agreements.
11.3  Severability: invalid provisions severed, remainder continues.
11.5  No assignment without Author's written consent.
11.7  Contact: planit.userhelp@gmail.com

================================================================================

                  Copyright (c) 2026 Aakshat Hariharan.
                         All Rights Reserved.

================================================================================

────────────────────────────────────────────────────────────────────────────────

               [END OF PLANIT FRONTEND APPLICATION LICENSE — PART THREE]

================================================================================
================================================================================

              PART FOUR: PLANIT BACKEND APPLICATION LICENSE (FULL TEXT)

================================================================================
================================================================================

The following is the complete, unabridged text of the PlanIt Backend Application
License Agreement, which governs all access to and use of the PlanIt server-side
Node.js/Express application. This component license is set out in full below
and is also available as the file LICENSE-BACKEND in the backend repository.

This license covers every .js file in the /backend/ directory and its
subdirectories, including all route handlers, data models, middleware, service
modules, configuration files, and the proprietary Cryptographic License
Key System.

────────────────────────────────────────────────────────────────────────────────

================================================================================
================================================================================

               PLANIT BACKEND APPLICATION — PROPRIETARY SOFTWARE LICENSE
                          EXCLUSIVE RIGHTS RESERVED

================================================================================
================================================================================

                      PlanIt Backend Services License Agreement
                              Version 2.0 — January 2026

              Copyright (c) 2026 Aakshat Hariharan. All Rights Reserved.

                          planit.userhelp@gmail.com
                        https://planitapp.onrender.com

================================================================================
                            PREAMBLE AND LEGAL NOTICE
================================================================================

IMPORTANT — READ THIS ENTIRE AGREEMENT BEFORE ACCESSING, READING, CLONING,
EXECUTING, DEPLOYING, OR INTERACTING WITH THE PLANIT BACKEND APPLICATION OR
ANY PART OF ITS INFRASTRUCTURE.

The PlanIt Backend Application is the server-side engine powering all data
persistence, business logic, authentication, authorization, real-time
communication, external integrations, and API services for the PlanIt platform.

================================================================================
SECTION 1 — DEFINITIONS
================================================================================

1.1   "Backend Application" or "Software" means the PlanIt server-side
      application in its entirety, including the main Express.js server, all
      route handlers (/routes/), all Mongoose data models (/models/), all
      middleware (/middleware/), all service modules (/services/), the
      Cryptographic License Key System, the white-label resolution and heartbeat
      enforcement system, the Socket.IO real-time layer, all configuration
      files, and all documentation and comments.

1.2   "Author" means Aakshat Hariharan, the sole architect, developer, and
      intellectual property owner of the Backend Application.

1.3   "You" means any individual or entity interacting with the Backend
      Application in any way.

1.4   "Cryptographic License System" means the HMAC-SHA256-based license key
      generation and verification system, including the key format, algorithm,
      domain hash function, expiry encoding, and HMAC construction.

1.5   "Data Models" means all Mongoose schema definitions and associated
      business logic, constituting trade secrets of the Author.

1.6   "Derivative Work" means any work derived from, reimplementing, or
      substantially similar to the Backend Application.

1.7   "Deploy" means to execute, run, or host the Backend Application on any
      computing infrastructure.

1.8   "Commercial Use" means any use in connection with commercial activity.

================================================================================
SECTION 2 — GRANT OF LIMITED LICENSE
================================================================================

2.1   The Author grants You a limited, personal, non-exclusive, non-transferable,
      non-sublicensable, revocable license to: (a) view the source code for
      personal educational reference; and (b) access the API Surface through
      the official frontend only, or as explicitly authorized in writing.

2.2   No right to Deploy, modify, distribute, or commercially exploit the
      Backend Application is granted.

2.3   All rights not expressly granted are reserved.

================================================================================
SECTION 3 — RESTRICTIONS ON USE
================================================================================

3.1   Without prior explicit written permission, You must NOT:

      (a)  Deploy, execute, or host the Backend Application;
      (b)  Copy, clone, or reproduce the Backend Application;
      (c)  Distribute the Backend Application to any third party;
      (d)  Modify or create any Derivative Work, including reimplementing
           the Data Models or Cryptographic License System;
      (e)  Reverse engineer the Cryptographic License System;
      (f)  Access the API Surface through any means other than the official
           frontend, except as explicitly authorized;
      (g)  Conduct Penetration Testing or vulnerability assessment;
      (h)  Access, extract, or aggregate any user data;
      (i)  Use source code in ML training datasets;
      (j)  Circumvent any security mechanism;
      (k)  Use Data Models as basis for competing platform;
      (l)  Use for Commercial Use without written license.

3.2   Unauthorized direct API access constitutes a breach of this Agreement.

3.3   Security vulnerability reports must be submitted to
      planit.userhelp@gmail.com without public disclosure.

================================================================================
SECTION 4 — CRYPTOGRAPHIC LICENSE SYSTEM
================================================================================

4.1   The Cryptographic License System is the Author's proprietary invention
      and most sensitive trade secret.

4.2   Any attempt to reverse engineer, bypass, spoof, or circumvent it
      constitutes trade secret misappropriation and potential criminal liability.

4.3   The WL_LICENSE_SECRET and all related secrets are inaccessible to You
      under any circumstance.

================================================================================
SECTION 5 — DATA AND PRIVACY
================================================================================

5.1   Unauthorized access to the Backend Application or its databases constitutes
      a serious privacy violation and may trigger breach notification obligations
      under applicable data protection law.

================================================================================
SECTION 6 — INTELLECTUAL PROPERTY
================================================================================

6.1   The Backend Application and all components are the sole property of the
      Author. All copyrights and trade secrets belong exclusively to the Author.

================================================================================
SECTIONS 7–11 — CONFIDENTIALITY, WARRANTIES, LIABILITY, INDEMNIFICATION,
TERMINATION, ENFORCEMENT, GENERAL PROVISIONS
================================================================================

The Backend Application is provided "AS IS" without warranty. The Author's
liability is limited to USD $100.00. You agree to indemnify the Author for
any breach. The Author may terminate this Agreement immediately upon breach.
Injunctive relief is available to the Author without bond. Governing law is
the jurisdiction of the Author's residence.

11.8  Export Compliance: You agree to comply with all applicable export
      control laws.

11.9  Security Obligations: You agree not to use knowledge from this source
      code to harm the Author, the platform, its users, or any third party.

================================================================================

                  Copyright (c) 2026 Aakshat Hariharan.
                         All Rights Reserved.

================================================================================

────────────────────────────────────────────────────────────────────────────────

                [END OF PLANIT BACKEND APPLICATION LICENSE — PART FOUR]

================================================================================
================================================================================

                PART FIVE: PLANIT ROUTER SERVICE LICENSE (FULL TEXT)

================================================================================
================================================================================

The following is the complete, unabridged text of the PlanIt Router Service
License Agreement, which governs all access to and use of the PlanIt intelligent
HTTP traffic orchestration layer. This component license is also available as
LICENSE-ROUTER in the router repository directory.

This license covers every source file in the /router/ directory, the entire
Routing Intelligence, the Mesh Protocol implementation, and all configuration
and operational tooling associated with the Router Service.

────────────────────────────────────────────────────────────────────────────────

================================================================================
================================================================================

                PLANIT ROUTER SERVICE — PROPRIETARY SOFTWARE LICENSE
                          EXCLUSIVE RIGHTS RESERVED

================================================================================
================================================================================

                     PlanIt Router Infrastructure License Agreement
                              Version 2.0 — January 2026

              Copyright (c) 2026 Aakshat Hariharan. All Rights Reserved.

                          planit.userhelp@gmail.com
                        https://planitapp.onrender.com

================================================================================
                            PREAMBLE AND LEGAL NOTICE
================================================================================

The Router Service embodies proprietary algorithms for adaptive backend
selection, health-aware load distribution, maintenance-safe traffic management,
mesh-authenticated inter-service communication, and white-label-aware routing
that represent significant engineering investment and constitute trade secrets.

================================================================================
SECTION 1 — DEFINITIONS
================================================================================

1.1   "Router Service" or "Software" means the PlanIt HTTP routing and
      orchestration layer in its entirety, including all backend selection
      algorithms, health-check polling logic, maintenance intercept middleware,
      CORS management system, mesh authentication protocol, response caching
      layer, rate limiting configuration, health check aggregation, deploy hook
      configuration, backend fleet registry, WebSocket proxying configuration,
      and all documentation and comments.

1.2   "Author" means Aakshat Hariharan, the sole architect and owner.

1.3   "You" means any individual or entity interacting with the Router Service.

1.4   "Routing Intelligence" means the proprietary scoring algorithm, health
      heuristics, boost mode logic, and all decision-making code — constituting
      trade secrets of the Author.

1.5   "Mesh Protocol" means the HMAC-based inter-service authentication system.

1.6   "Derivative Work" means any work derived from or reimplementing any
      portion of the Router Service.

1.7   "Deploy" means to execute or host the Router Service on any infrastructure.

1.8   "Commercial Use" means any use in connection with commercial activity.

================================================================================
SECTION 2 — GRANT OF LIMITED LICENSE
================================================================================

2.1   The Author grants You a limited, personal, non-exclusive, non-transferable,
      non-sublicensable, revocable license to view the source code for personal
      educational reference only.

2.2   No deployment, modification, distribution, or commercial exploitation right
      is granted.

2.3   All rights not expressly granted are reserved.

================================================================================
SECTION 3 — RESTRICTIONS ON USE
================================================================================

3.1   Without prior written permission, You must NOT:

      (a)  Deploy or host the Router Service;
      (b)  Copy or reproduce the Router Service;
      (c)  Distribute the Router Service;
      (d)  Modify or create any Derivative Work, including reimplementing
           the Routing Intelligence;
      (e)  Benchmark or reverse engineer the Routing Intelligence for building
           a competing system;
      (f)  Disclose Confidential Information to any third party;
      (g)  Probe or stress-test the Hosted Infrastructure;
      (h)  Forge or bypass Mesh Protocol authentication;
      (i)  Use source code in ML training datasets;
      (j)  Remove copyright notices;
      (k)  Use for Commercial Use without a written license.

3.2   The Routing Intelligence is classified as Confidential Information and
      a trade secret. Any attempt to extract or commercialize it constitutes
      trade secret misappropriation.

================================================================================
SECTION 4 — ROUTING INTELLIGENCE AS TRADE SECRET
================================================================================

4.1   The Routing Intelligence constitutes a proprietary system developed
      through substantial engineering investment. The specific combination of
      health-check scoring weights, backend alive-state hysteresis logic,
      boost mode thresholds, and maintenance exemption categorization are not
      publicly known and provide the Author with a competitive advantage.

4.2   Your obligation to maintain the confidentiality of the Routing Intelligence
      survives termination of this Agreement indefinitely.

================================================================================
SECTIONS 5–11 — CONFIDENTIALITY, WARRANTIES, LIABILITY, INDEMNIFICATION,
TERMINATION, ENFORCEMENT, GENERAL PROVISIONS
================================================================================

The Router Service is provided "AS IS" without warranty. The Author's liability
is limited to USD $100.00. You agree to indemnify the Author for any breach.
The Author may terminate this Agreement immediately upon breach. Injunctive
relief is available to the Author without bond. Governing law is the
jurisdiction of the Author's residence.

11.8  Infrastructure Integrity: You agree not to take any action that could
      degrade, disrupt, or damage the Hosted Infrastructure or Backend Fleet.

================================================================================

                  Copyright (c) 2026 Aakshat Hariharan.
                         All Rights Reserved.

================================================================================

────────────────────────────────────────────────────────────────────────────────

                 [END OF PLANIT ROUTER SERVICE LICENSE — PART FIVE]

================================================================================
================================================================================

               PART SIX: PLANIT WATCHDOG SERVICE LICENSE (FULL TEXT)

================================================================================
================================================================================

The following is the complete, unabridged text of the PlanIt Watchdog Service
License Agreement, which governs all access to and use of the PlanIt autonomous
infrastructure monitoring daemon. This component license is also available as
LICENSE-WATCHDOG in the watchdog repository directory.

This license covers every source file in the /watchdog/ directory (or pulse/
directory if applicable), the Monitoring Intelligence, alert routing logic,
uptime aggregation system, and all configuration and operational data generated
by the Watchdog Service.

────────────────────────────────────────────────────────────────────────────────

================================================================================
================================================================================

               PLANIT WATCHDOG SERVICE — PROPRIETARY SOFTWARE LICENSE
                          EXCLUSIVE RIGHTS RESERVED

================================================================================
================================================================================

                    PlanIt Watchdog Monitoring License Agreement
                              Version 2.0 — January 2026

              Copyright (c) 2026 Aakshat Hariharan. All Rights Reserved.

                          planit.userhelp@gmail.com
                        https://planitapp.onrender.com

================================================================================
                            PREAMBLE AND LEGAL NOTICE
================================================================================

The Watchdog Service contains proprietary incident detection heuristics, alert
suppression logic, uptime aggregation algorithms, and integration-specific
configurations that constitute trade secrets and copyrighted works of the Author.

================================================================================
SECTION 1 — DEFINITIONS
================================================================================

1.1   "Watchdog Service" or "Software" means the PlanIt autonomous monitoring
      daemon in its entirety, including all health-check polling logic, incident
      lifecycle management, alert routing and deduplication system, uptime
      history aggregation, status page data API, mesh-authenticated endpoints,
      auto-promotion of scheduled maintenance, and all configuration, operational
      documentation, and comments.

1.2   "Author" means Aakshat Hariharan, the sole designer and owner.

1.3   "You" means any individual or entity interacting with the Watchdog Service.

1.4   "Monitoring Intelligence" means the proprietary heuristics, thresholds,
      timing parameters, and decision logic governing incident detection,
      severity classification, alert routing, and uptime aggregation —
      constituting trade secrets of the Author.

1.5   "Operational Data" means uptime records, incident logs, and alert histories
      generated during operation, owned exclusively by the Author.

1.6   "Derivative Work" means any monitoring tool derived from the Watchdog.

1.7   "Deploy" means to execute or host the Watchdog Service.

1.8   "Commercial Use" means any use in connection with commercial activity.

================================================================================
SECTION 2 — GRANT OF LIMITED LICENSE
================================================================================

2.1   The Author grants You a limited, personal, non-exclusive, non-transferable,
      non-sublicensable, revocable license to view the source code for personal
      educational reference only.

2.2   No deployment, modification, distribution, or commercial exploitation right
      is granted.

2.3   All rights not expressly granted are reserved.

================================================================================
SECTION 3 — RESTRICTIONS ON USE
================================================================================

3.1   Without prior written permission, You must NOT:

      (a)  Deploy or operate the Watchdog Service;
      (b)  Copy or reproduce the Watchdog Service;
      (c)  Distribute the Watchdog Service;
      (d)  Modify or create any Derivative Work, including adapting the
           Monitoring Intelligence for any other monitoring system;
      (e)  Disclose Monitoring Intelligence to any third party;
      (f)  Access status API endpoints except through the official status page;
      (g)  Interfere with, disable, or circumvent the Watchdog Service;
      (h)  Use source code in ML training datasets;
      (i)  Remove copyright notices;
      (j)  Access, export, or aggregate Operational Data;
      (k)  Use for Commercial Use without a written license.

================================================================================
SECTION 4 — MONITORING INTELLIGENCE AS TRADE SECRET
================================================================================

4.1   The Monitoring Intelligence — polling intervals, failure thresholds,
      incident severity rules, alert suppression cooldowns, uptime aggregation
      methodology — constitutes trade secrets developed through operational
      experience. Your confidentiality obligation survives termination
      indefinitely.

================================================================================
SECTIONS 5–11 — CONFIDENTIALITY, WARRANTIES, LIABILITY, INDEMNIFICATION,
TERMINATION, ENFORCEMENT, GENERAL PROVISIONS
================================================================================

The Watchdog Service is provided "AS IS" without warranty. The Author's
liability is limited to USD $100.00. You agree to indemnify the Author for
any breach. The Author may terminate this Agreement immediately upon breach.
Injunctive relief is available to the Author without bond. Governing law is
the jurisdiction of the Author's residence.

11.8  Monitoring Integrity: You agree not to generate false health signals,
      suppress legitimate alerts, or corrupt monitoring data.

11.9  Alert System: You agree not to flood or abuse the ntfy.sh or Discord
      alert channels used by the Watchdog Service.

================================================================================

                  Copyright (c) 2026 Aakshat Hariharan.
                         All Rights Reserved.

================================================================================

────────────────────────────────────────────────────────────────────────────────

               [END OF PLANIT WATCHDOG SERVICE LICENSE — PART SIX]

================================================================================
================================================================================

                   PART SEVEN: CONSOLIDATED CLOSING PROVISIONS

================================================================================
================================================================================

This Master Agreement, together with the four individual component license
agreements reproduced in Parts Three through Six above, constitutes the complete
and exclusive statement of the intellectual property rights and licensing terms
governing the PlanIt platform and all of its components.

────────────────────────────────────────────────────────────────────────────────
CONSOLIDATED OWNERSHIP STATEMENT
────────────────────────────────────────────────────────────────────────────────

Every line of source code, every design decision, every data model, every
algorithm, every configuration file, every comment, and every architectural
choice across all four components of the PlanIt platform is the original creative
work and exclusive property of Aakshat Hariharan. No co-author, contributor,
employer, client, or third party holds any ownership interest in any portion
of the PlanIt platform. The Author created this platform independently, owns
it outright, and licenses it exclusively on the terms set out above.

────────────────────────────────────────────────────────────────────────────────
SUMMARY OF WHAT IS AND IS NOT PERMITTED
────────────────────────────────────────────────────────────────────────────────

For the avoidance of doubt and as a convenience summary only (this summary
does not supersede or limit the full terms above):

  PERMITTED WITHOUT PERMISSION:
  ✓  Reading this source code for personal educational reference
  ✓  Using the Hosted Service at planitapp.onrender.com as an end-user
  ✓  Discussing the platform publicly in factual, non-misleading terms
  ✓  Reporting security vulnerabilities responsibly to the Author

  NOT PERMITTED WITHOUT WRITTEN PERMISSION:
  ✗  Deploying any component of the platform on any infrastructure
  ✗  Copying, cloning, or forking any component
  ✗  Distributing any component to any third party
  ✗  Creating any Derivative Work from any component
  ✗  Using any component for Commercial Use
  ✗  Removing copyright notices or "Powered by PlanIt" attributions
  ✗  Using the PlanIt name or logo without consent
  ✗  Reverse engineering any security or cryptographic mechanism
  ✗  Using source code in ML or AI training datasets
  ✗  Conducting penetration testing of the Hosted Service

────────────────────────────────────────────────────────────────────────────────
VIOLATION REPORTING
────────────────────────────────────────────────────────────────────────────────

If You become aware of any violation of this Master Agreement or any individual
component license — including unauthorized forks, deployments, or distributions
of any PlanIt component — please report it to:

                    Email: planit.userhelp@gmail.com
                    Subject: License Violation Report

The Author takes intellectual property violations seriously and will pursue all
available legal remedies against unauthorized uses of the PlanIt platform.

────────────────────────────────────────────────────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────────────────────────────────────────────────────

By accessing any component of the PlanIt platform, You acknowledge that:

  (1)  You have read this Master Agreement in its entirety;
  (2)  You understand its terms;
  (3)  You agree to be legally bound by all of its provisions;
  (4)  You have the legal capacity and authority to enter into this Agreement;
  (5)  If You are accessing on behalf of an organization, You have authority
       to bind that organization to these terms; and
  (6)  You acknowledge that this Agreement is enforceable against You.

================================================================================
================================================================================

                   Copyright (c) 2026 Aakshat Hariharan.
                          All Rights Reserved.

            The PlanIt platform is proprietary software. All four
          components — Frontend, Backend, Router, and Watchdog — are
          protected by copyright law and trade secret law. Unauthorized
          use, copying, deployment, or distribution of any component
              is strictly prohibited and will be vigorously enforced.

                      https://planitapp.onrender.com
                     planit.userhelp@gmail.com

================================================================================
================================================================================
*/

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap');
.pi{--ac:#2236ff;--hl:#ffe14d;--ink:#0d0e1c;--lav:#eceeff;--bg:#fff;--sf:#fff;--mu:#5a5d70;--ln:#d9dbe8;--ok:#0c8a5b;--pk:#ff7ac6;--mn:#6ff0c0;--er:#d12f2f;--acs:#fff6c2;
background:var(--bg);color:var(--ink);font:400 16px/1.6 'Hanken Grotesk',system-ui,sans-serif;min-height:100vh;overflow-x:clip;-webkit-font-smoothing:antialiased}
.pi *{box-sizing:border-box}.pi a{color:inherit;text-decoration:none}.pi button{font:inherit;color:inherit;cursor:pointer}
.pi h1,.pi h2,.pi h3,.pi .ph{font-family:Unbounded,'Hanken Grotesk',sans-serif;font-weight:700;letter-spacing:-.035em;line-height:1.04;margin:0}
.pi :focus-visible{outline:3px solid var(--hl);outline-offset:2px}.pi svg{flex-shrink:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 28px}
.nav{position:sticky;top:0;z-index:40;background:var(--ac);color:#fff}
.nav .wrap{display:flex;align-items:center;height:68px;gap:32px}
.brand{display:flex;align-items:center;gap:11px;font:700 21px Unbounded,sans-serif;letter-spacing:-.04em}
.mark{width:30px;height:30px;border-radius:8px;background:var(--ink);color:#fff;display:grid;place-items:center;font:700 15px Unbounded,sans-serif;overflow:hidden}.mark img{width:22px;height:22px;object-fit:contain}
.links{display:flex;gap:28px;margin-left:auto;align-items:center;font-size:15px;font-weight:500}
.links a:not(.btn){opacity:.8;transition:opacity .15s}.links a:not(.btn):hover{opacity:1}
.burger{display:none;margin-left:auto;background:none;border:0;padding:8px;color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:2px solid var(--ink);background:#fff;color:var(--ink);border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;transition:transform .12s,box-shadow .12s}
.pi .btn,.pi .sm-btn,.pi .lnk{font-weight:700}
.pi .btn,.pi .sm-btn,.pi .lnk,.pi .path,.pi .oth,.pi .back{color:var(--ink)}.pi .btn.dk{color:#fff}
.btn.pri{background:var(--hl);box-shadow:4px 4px 0 var(--ink)}.btn.dk{background:var(--ink);color:#fff;box-shadow:4px 4px 0 var(--ac)}
.btn.pri:hover,.btn.dk:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}.btn.dk:hover{box-shadow:2px 2px 0 var(--ac)}
.btn:not(.pri):not(.dk):hover{background:var(--ink);color:#fff}
.btn.sm{padding:8px 14px;font-size:14px;box-shadow:3px 3px 0 var(--ink)}.btn:disabled{opacity:.55;cursor:not-allowed}.btn.wide{width:100%;padding:16px 20px;font-size:16px}
.nav .btn.sm{border-color:#fff;box-shadow:3px 3px 0 var(--ink)}
.lnk{background:none;border:0;padding:0 0 2px;font-weight:700;border-bottom:2px solid var(--ac);color:var(--ink)}.lnk:hover{background:var(--hl)}
.hero{position:relative;background:var(--ac) radial-gradient(rgba(255,255,255,.22) 1.6px,transparent 1.6px) 0 0/28px 28px;color:#fff;padding:72px 0 0;overflow:hidden}.hero-g{position:relative;z-index:1}
.hero-g{display:grid;grid-template-columns:1.1fr .9fr;gap:72px;align-items:center}
.hero h1{font-size:clamp(2.5rem,5vw,4.5rem);font-weight:800;letter-spacing:-.045em;line-height:1}
.hero h1 em{font-style:normal;color:var(--hl)}
.lead{font-size:19px;color:rgba(255,255,255,.85);max-width:27em;margin:28px 0 36px}
.find{display:flex;gap:12px;max-width:440px;border-bottom:2px solid #fff}
.find input{flex:1;min-width:0;border:0;background:none;padding:11px 0;font:inherit;color:#fff;outline:none}.find input::placeholder{color:rgba(255,255,255,.7)}
.find button{border:0;background:none;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px}
.find.shake{animation:shk .4s}@keyframes shk{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
.facts{list-style:none;margin:80px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid rgba(255,255,255,.35)}
.facts li{padding:24px 24px 28px 0;color:rgba(255,255,255,.8);font-size:15px}.facts li+li{padding-left:28px;border-left:2px solid rgba(255,255,255,.35)}
.facts b{display:block;color:#fff;font:700 18px Unbounded,sans-serif;letter-spacing:-.03em;margin-bottom:4px}
.hero-img{width:100%;aspect-ratio:21/9;object-fit:cover;margin-top:56px;border-radius:10px;border:2px solid var(--ink)}
.panel{position:relative;background:#fff;color:var(--ink);border-radius:12px;padding:34px 32px 30px;box-shadow:10px 10px 0 var(--ink);scroll-margin-top:96px}
.stick{position:absolute;top:-30px;right:-18px;width:92px;height:92px;border-radius:50%;background:var(--hl);border:2px solid var(--ink);display:grid;place-items:center;text-align:center;font:800 12px/1.15 Unbounded,sans-serif;letter-spacing:-.02em;transform:rotate(10deg);z-index:2}
.pi .ph{font-size:28px;margin-bottom:22px;font-weight:800}
.panel label.l{display:block;font-size:13.5px;font-weight:600;margin-bottom:6px}
.perf{position:relative;margin:26px -32px;border-top:2px dashed #b9bcd0}
.perf::before,.perf::after{content:'';position:absolute;top:-13px;width:26px;height:26px;border-radius:50%;background:var(--ac)}.perf::before{left:-13px}.perf::after{right:-13px}
.choose{margin:0 0 20px;display:grid;gap:8px}
.ch{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:#fff;border:2px solid var(--ln);border-radius:8px;padding:11px 14px;transition:border-color .12s}
.ch:hover{border-color:var(--ink)}.ch .dot{width:18px;height:18px;border-radius:50%;border:2px solid #9a9db3;margin-top:3px;display:grid;place-items:center}
.ch.on{background:var(--acs);border-color:var(--ink)}.ch.on .dot{border-color:var(--ink);background:var(--ink)}.ch.on .dot::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--hl)}
.ch b{display:block;font-weight:700;line-height:1.3}.ch small{color:var(--mu);font-size:13.5px}
.panel .sub2{color:var(--mu);font-size:13.5px;margin:14px 0 0;text-align:center}
.belt{background:var(--hl);color:var(--ink);border-block:2px solid var(--ink);overflow:hidden;white-space:nowrap;margin-top:0}
.belt div{display:inline-flex;animation:belt 38s linear infinite;padding:14px 0}.belt span{font:700 15px Unbounded,sans-serif;letter-spacing:-.02em;display:inline-flex;align-items:center}.belt span::after{content:'';width:10px;height:10px;background:var(--ink);transform:rotate(45deg);margin:0 28px}
@keyframes belt{to{transform:translateX(-50%)}}
.sec{padding:104px 0}.sec.lav{background:var(--lav);border-top:2px solid var(--ink)}.sec.yel{background:var(--hl);border-top:2px solid var(--ink)}
.sh{display:grid;grid-template-columns:1.1fr .9fr;gap:72px;align-items:end;margin-bottom:60px}
.sh h2,.cl h2{font-size:clamp(1.9rem,3.7vw,3.2rem);font-weight:800;letter-spacing:-.045em;line-height:1.02}.sh p{margin:0;color:var(--mu);font-size:18px;max-width:28em}
.cols{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.col{padding:26px 22px 24px;border:2px solid var(--ink);border-radius:12px;display:flex;flex-direction:column;gap:14px;background:#fff;box-shadow:6px 6px 0 var(--ink)}
.col .ico{width:44px;height:44px;border-radius:10px;background:var(--ac);color:#fff;display:grid;place-items:center;border:2px solid var(--ink)}
.col:nth-child(2) .ico{background:var(--hl);color:var(--ink)}.col:nth-child(3) .ico{background:var(--ink)}.col:nth-child(4) .ico{background:var(--ok)}
.col h3{font-size:24px;font-weight:800}.col p{margin:0;color:var(--mu);font-size:15px}
.incl{list-style:none;margin:4px 0 10px;padding:0;display:grid;gap:8px;font-size:14.5px}.incl li{display:flex;gap:9px}.incl svg{color:var(--ok);margin-top:4px}
.col .lnk{align-self:flex-start;margin-top:auto}
.feats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.feat{padding:24px;background:#fff;border:2px solid var(--ink);border-radius:12px}.feat svg{color:var(--ac);margin-bottom:18px}.feat h3{font-size:19px;font-weight:700;margin-bottom:8px}.feat p{margin:0;color:var(--mu);font-size:15px}
.cl{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center}.cl .sub{font-size:18px;margin:22px 0 32px;max-width:27em}
.say{list-style:none;margin:0;padding:0;display:grid;gap:14px}.say li{padding:18px 22px;background:#fff;border:2px solid var(--ink);border-radius:12px;font:500 18px/1.3 Unbounded,sans-serif;letter-spacing:-.03em;box-shadow:5px 5px 0 var(--ink)}
.say li:nth-child(even){margin-left:36px;background:var(--ac);color:#fff}
.cta{display:flex;gap:14px;flex-wrap:wrap}
.note{display:flex;gap:10px;align-items:flex-start;margin-top:20px;padding:12px 14px;border-radius:8px;background:#ffe9e7;color:#8f2722;font-size:13.5px;border:2px solid #f0b4b0}
.done{display:grid;gap:14px}.done h3{font-size:28px;font-weight:800}
.link{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid var(--ln);border-radius:8px;background:#f7f8fd}
.link small{width:52px;color:var(--mu);font-weight:600}.link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.sm-btn{border:2px solid var(--ink);background:var(--hl);color:var(--ink);border-radius:6px;padding:5px 11px;font-size:13px;font-weight:700;display:inline-flex;gap:6px;align-items:center}
.foot{background:var(--ink);color:#fff;padding:72px 0 36px}
.foot .wrap>div{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px}.foot h4{margin:0 0 14px;font-size:14px;font-weight:700;color:var(--hl)}
.foot ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;font-size:14.5px;color:rgba(255,255,255,.65)}.foot li a:hover{color:#fff}
.foot .fine{margin-top:56px;padding-top:20px;border-top:1px solid rgba(255,255,255,.18);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13.5px;color:rgba(255,255,255,.55)}
.foot p{color:rgba(255,255,255,.65)!important}
.inp{width:100%;padding:12px 14px;border:2px solid var(--ink);border-radius:8px;background:#fff;font:inherit;color:inherit;outline:none;transition:box-shadow .15s}
.inp:focus{box-shadow:0 0 0 3px var(--ac)}.inp.bad{border-color:var(--er)}
.err{display:flex;gap:6px;align-items:center;color:var(--er);font-size:13px;margin-top:6px;font-weight:500}
.ov{position:fixed;inset:0;z-index:100;background:rgba(34,54,255,.94);display:flex;padding:20px;overflow:auto;animation:fi .25s}@keyframes fi{from{opacity:0}}
.wz{width:100%;max-width:540px;margin:auto;background:#fff;color:var(--ink);border:2px solid var(--ink);border-radius:14px;padding:clamp(24px,5vw,42px);position:relative;box-shadow:10px 10px 0 var(--ink)}
.x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:8px;border:2px solid var(--ink);background:var(--hl);font-size:20px;line-height:1;font-weight:700}
.seg{display:flex;gap:22px;border-bottom:2px solid var(--ln);margin-bottom:28px;flex-wrap:wrap;padding-right:40px}
.seg button{border:0;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;padding:8px 0;font-size:14.5px;font-weight:600;color:var(--mu)}.seg button.on{color:var(--ink);border-color:var(--ac)}
.prog{display:flex;gap:4px;align-items:center;margin-bottom:30px}.prog i{height:6px;flex:1;background:var(--ln);border-radius:3px}.prog i.on{background:var(--ac)}.prog span{font-size:12.5px;color:var(--mu);margin-left:10px;white-space:nowrap;font-weight:500}
.step{animation:sl .3s}@keyframes sl{from{opacity:0;transform:translateY(8px)}}
.step h3{font-size:clamp(1.5rem,3.6vw,2rem);font-weight:800;margin-bottom:10px}.step>p{color:var(--mu);margin:0 0 24px}
.fld{display:grid;gap:14px}.fld label{display:block;font-size:13.5px;font-weight:600;margin-bottom:6px}.fld label small{color:var(--mu);font-weight:400}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.opt{padding:14px;border:2px solid var(--ln);border-radius:8px;background:#fff;text-align:left;transition:border-color .12s}.opt:hover{border-color:var(--ink)}.opt b{display:block;font-weight:700}.opt span{font-size:13px;color:var(--mu)}
.opt.on{border-color:var(--ink);background:var(--acs);box-shadow:3px 3px 0 var(--ink)}.opt ul{margin:8px 0 0;padding-left:16px;font-size:13px;color:var(--mu)}
.nv{display:flex;gap:12px;margin-top:30px}.nv .btn.pri{flex:1}
.slug{display:flex;align-items:center;padding:9px 12px;border-radius:8px;background:#f4f5fb;border:2px solid var(--ln);font-size:13.5px;color:var(--mu)}.slug input{flex:1;border:0;background:none;font:inherit;color:var(--ink);outline:none}
.chk{display:flex;gap:10px;font-size:13.5px;color:var(--mu);line-height:1.45;cursor:pointer}.chk input{margin-top:3px;accent-color:var(--ac);width:16px;height:16px}.chk a{color:var(--ac);text-decoration:underline}
.banner{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:8px;background:var(--acs);border:2px solid var(--ink);margin-bottom:20px;font-size:14px}.banner span{flex:1}
.pw{position:relative}.pw button{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:none;padding:6px;color:var(--mu)}
.spin{width:16px;height:16px;border:2px solid rgba(13,14,28,.25);border-top-color:var(--ink);border-radius:50%;animation:sp .7s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.menu{display:none}
.mdl{position:fixed;inset:0;z-index:110;background:rgba(13,14,28,.6);display:grid;place-items:center;padding:20px}.mdl .card{background:#fff;color:var(--ink);border:2px solid var(--ink);border-radius:14px;box-shadow:8px 8px 0 var(--ink)}
@media(max-width:1020px){.cols{grid-template-columns:1fr 1fr}}
@media(max-width:960px){.hero-g,.cl,.sh{grid-template-columns:minmax(0,1fr);gap:44px}.hero-g>*,.cl>*{min-width:0}.feats{grid-template-columns:1fr 1fr}.foot .wrap>div{grid-template-columns:1fr 1fr}.links{display:none}.burger{display:block}.menu{display:grid;gap:4px;padding:8px 28px 22px;background:var(--ac);color:#fff}.menu a{padding:10px 0}.sec{padding:72px 0}.sh{margin-bottom:40px}.panel{margin-top:16px}}
@media(max-width:600px){.feats,.cols{grid-template-columns:1fr}.facts{grid-template-columns:1fr}.facts li+li{padding-left:0;border-left:0;border-top:2px solid rgba(255,255,255,.35)}.hero{padding-top:44px}.panel{padding:28px 22px}.perf{margin:22px -22px}.say li:nth-child(even){margin-left:0}.stick{right:-6px}}
@media(prefers-reduced-motion:reduce){.pi *{animation-duration:.001ms!important;transition-duration:.001ms!important}}

.eye{display:inline-block;border:2px solid var(--ink);background:var(--hl);color:var(--ink);padding:4px 10px;font:700 11.5px Unbounded,sans-serif;letter-spacing:.02em;text-transform:uppercase;transform:rotate(-2deg);margin-bottom:18px;box-shadow:3px 3px 0 var(--ink)}
.hero h1 em{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 4 Q6 0 12 4 T24 4' fill='none' stroke='%23ff7ac6' stroke-width='3'/%3E%3C/svg%3E") repeat-x 0 100%;padding-bottom:.2em}
.deco{position:absolute;pointer-events:none;z-index:0}.d1{left:calc(50% - 70px);top:44px}.d2{left:28px;top:26px}
.float{animation:flt 5s ease-in-out infinite}@keyframes flt{50%{transform:translateY(-10px) rotate(4deg)}}
.spin-slow{animation:spn 24s linear infinite}@keyframes spn{to{transform:rotate(360deg)}}
.stick{animation:wob 5s ease-in-out infinite}@keyframes wob{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-4deg) scale(1.05)}}
.ch .mini{display:grid;gap:5px;margin-top:10px;font-size:13px;color:var(--ink)}.ch .mini span{display:block}.ch .mini span::before{content:'';display:inline-block;width:6px;height:6px;background:var(--ac);margin-right:9px;transform:rotate(45deg);vertical-align:1px}
.perf::before,.perf::after{background:var(--ac)}
.uses{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.use{padding:22px 20px 24px;min-height:150px;border:2px solid var(--ink);border-radius:12px;box-shadow:5px 5px 0 var(--ink);display:flex;flex-direction:column;justify-content:space-between;gap:16px;transition:transform .15s,box-shadow .15s}
.use:hover{transform:translate(-3px,-3px) rotate(-.8deg);box-shadow:9px 9px 0 var(--ink)}
.use b{font:800 20px/1.1 Unbounded,sans-serif;letter-spacing:-.04em}.use span{font-size:14px;color:rgba(13,14,28,.75)}
.u0{background:var(--hl)}.u1{background:var(--pk)}.u2{background:var(--mn)}.u3{background:var(--lav)}
.sec.ink{background:var(--ink);color:#fff;border-top:2px solid var(--ink)}.sec.ink .sh p{color:rgba(255,255,255,.72)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.stp{border-top:2px solid rgba(255,255,255,.28);padding-top:22px}.stp i{display:block;font:800 clamp(3.2rem,6vw,5rem)/1 Unbounded,sans-serif;letter-spacing:-.06em;color:var(--hl);font-style:normal;margin-bottom:18px}
.stp:nth-child(2) i{color:var(--pk)}.stp:nth-child(3) i{color:var(--mn)}.stp h3{font-size:22px;font-weight:800;margin-bottom:10px}.stp p{margin:0;color:rgba(255,255,255,.72);max-width:24em}
.feat{box-shadow:5px 5px 0 var(--ink);transition:transform .15s,box-shadow .15s}.feat:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--ink)}
.feat.w2{grid-column:span 2}
.feat.c-ac{background:var(--ac);color:#fff}.feat.c-ac p{color:rgba(255,255,255,.85)}.feat.c-ac svg{color:var(--hl)}
.feat.c-hl{background:var(--hl)}.feat.c-hl p{color:#3b3a30}.feat.c-hl svg{color:var(--ink)}
.feat.c-pk{background:var(--pk)}.feat.c-pk p{color:#4a1f38}.feat.c-pk svg{color:var(--ink)}
.feat.c-ink{background:var(--ink);color:#fff}.feat.c-ink p{color:rgba(255,255,255,.72)}.feat.c-ink svg{color:var(--mn)}
.feat.w2 h3{font-size:24px}
.col{transition:transform .15s,box-shadow .15s}.col:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--ink)}
.sec.pk{background:var(--pk);border-top:2px solid var(--ink);padding:72px 0}.sec.ac{background:var(--ac) radial-gradient(rgba(255,255,255,.22) 1.6px,transparent 1.6px) 0 0/28px 28px;color:#fff;border-top:2px solid var(--ink)}
.wlb{display:flex;justify-content:space-between;align-items:center;gap:40px;flex-wrap:wrap}.wlb h2{font-size:clamp(1.7rem,3.2vw,2.6rem);font-weight:800;letter-spacing:-.045em;max-width:16em;margin-bottom:12px}.wlb p{margin:0;font-size:18px;max-width:30em}
.sec.ac .sh p{color:rgba(255,255,255,.85)}.sec.ac .sh{margin-bottom:48px}
.faq{display:grid;gap:16px;max-width:860px}
.faq details{background:#fff;border:2px solid var(--ink);border-radius:12px;box-shadow:5px 5px 0 var(--ink)}
.faq summary{list-style:none;cursor:pointer;padding:20px 24px;font:700 16px Unbounded,sans-serif;letter-spacing:-.03em;display:flex;justify-content:space-between;gap:20px}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:'+';font-size:24px;line-height:1;transition:transform .2s;color:var(--ac)}
.faq details[open] summary::after{transform:rotate(45deg)}.faq details p{margin:0;padding:0 24px 22px;color:var(--mu);max-width:44em}
.cr{display:grid;grid-template-columns:1.1fr .9fr;gap:72px;align-items:start}
.mtabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:34px}
.mt{display:inline-flex;gap:8px;align-items:center;border:2px solid #fff;color:#fff;background:transparent;padding:10px 16px;border-radius:8px;font-weight:700;transition:transform .12s}
.mt:hover{background:rgba(255,255,255,.14)}.mt.on{background:var(--hl);color:var(--ink);border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}
.pi .crh{font-size:clamp(1.3rem,2.4vw,1.8rem);font-weight:800;letter-spacing:-.045em;margin-bottom:14px}.crp{color:rgba(255,255,255,.88);font-size:18px;margin:0 0 26px;max-width:30em}
.sec.ac .incl{color:#fff}.sec.ac .incl svg{color:var(--hl)}.incl.two{grid-template-columns:1fr 1fr;gap:12px 24px}
.sec.ac .panel{color:var(--ink)}
.wmeta{margin:0 0 22px;padding:10px 14px;background:var(--acs);border:2px solid var(--ink);border-radius:8px;font-size:13.5px}
@media(max-width:1020px){.uses{grid-template-columns:repeat(2,1fr)}.facts{grid-template-columns:1fr 1fr}.facts li:nth-child(3){padding-left:0;border-left:0}}
@media(max-width:960px){.steps,.cr{grid-template-columns:minmax(0,1fr);gap:40px}.cr>*{min-width:0}.incl.two{grid-template-columns:1fr}.d1{display:none}}
@media(max-width:600px){.uses,.feats{grid-template-columns:1fr}.feat.w2{grid-column:auto}.facts{grid-template-columns:1fr}.facts li:nth-child(n+2){padding-left:0;border-left:0;border-top:2px solid rgba(255,255,255,.35)}}

.sec.br{border-top:2px solid var(--ink)}.br-events{background:var(--lav)}.br-rsvp{background:var(--mn)}.br-venue{background:var(--hl)}
.back{display:inline-flex;gap:8px;align-items:center;border:2px solid var(--ink);background:#fff;border-radius:8px;padding:7px 14px;font-weight:700;font-size:14px;margin-bottom:40px;box-shadow:3px 3px 0 var(--ink)}.back:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.br-h{display:grid;grid-template-columns:1.2fr .8fr;gap:64px;align-items:end;margin-bottom:76px}
.br-h h2{font-size:clamp(2.2rem,4.8vw,4.1rem);font-weight:800;letter-spacing:-.045em;line-height:1.02}.br-h h2 .hl{background:linear-gradient(transparent 60%,var(--pk) 60%)}
.br-p{font-size:19px;margin:0 0 26px;max-width:28em}.br-note{font-size:14px;font-weight:600}.br-h .cta{align-items:center}
.sh2{margin-bottom:26px}.sh2 h3{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;letter-spacing:-.04em}
.callouts{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
.callout{padding:28px;border:2px solid var(--ink);border-radius:12px;background:var(--ac);color:#fff;box-shadow:5px 5px 0 var(--ink);display:flex;flex-direction:column;align-items:flex-start;gap:12px}.callout.alt{background:#fff;color:var(--ink)}
.callout b{font:800 22px Unbounded,sans-serif;letter-spacing:-.04em}.callout p{margin:0 0 8px;max-width:32em;opacity:.9}.callout .btn.pri{border-color:var(--ink)}
.vs{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.vcard{position:relative;padding:28px;background:#fff;border:2px solid var(--ink);border-radius:12px;box-shadow:5px 5px 0 var(--ink)}.vcard.on{background:var(--hl)}
.vcard b{display:flex;gap:8px;align-items:center;font:800 19px Unbounded,sans-serif;letter-spacing:-.04em}.vcard small{display:block;color:var(--mu);margin:4px 0 18px}.vcard.on small{color:#4d4a2a}
.vcard dl{margin:0}.vcard dl div{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-top:2px solid rgba(13,14,28,.14)}.vcard dt{color:var(--mu);font-size:14px}.vcard.on dt{color:#4d4a2a}.vcard dd{margin:0;font-weight:600;text-align:right;font-size:14.5px}
.tagl{position:absolute;top:-2px;right:-2px;background:var(--ink);color:var(--hl);font:700 11px Unbounded,sans-serif;text-transform:uppercase;padding:5px 10px;border-radius:0 10px 0 8px}
@media(max-width:960px){.br-h{grid-template-columns:minmax(0,1fr);gap:28px;margin-bottom:48px}.callouts,.vs{grid-template-columns:1fr}}

/* ── Four-type clarity: path cards, compare table, demos ── */
.pi .t-lav{background:var(--lav)}.pi .t-pk{background:var(--pk)}.pi .t-mn{background:var(--mn)}.pi .t-hl{background:var(--hl)}
.ch .chi{width:34px;height:34px;border-radius:8px;border:2px solid var(--ink);display:grid;place-items:center;color:var(--ink);flex-shrink:0}
.ch .dot{margin-left:auto;flex-shrink:0}
.paths{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.path{position:relative;display:flex;flex-direction:column;gap:14px;padding:26px 22px 22px;border:2px solid var(--ink);border-radius:12px;box-shadow:6px 6px 0 var(--ink);color:var(--ink);transition:transform .15s,box-shadow .15s}
.path:hover{transform:translate(-3px,-3px);box-shadow:10px 10px 0 var(--ink)}
.path .pn{position:absolute;top:18px;right:20px;font:800 12px Unbounded,sans-serif;opacity:.55}
.path .ptag{align-self:flex-start;display:inline-flex;gap:7px;align-items:center;background:#fff;border:2px solid var(--ink);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700;box-shadow:2px 2px 0 var(--ink)}
.path h3{font-size:clamp(1.25rem,1.7vw,1.5rem);font-weight:800;letter-spacing:-.04em;line-height:1.08}
.path p{margin:0;font-size:15px;color:rgba(13,14,28,.78)}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.chips li{font-size:12.5px;font-weight:600;padding:3px 10px;border:2px solid var(--ink);border-radius:999px;background:rgba(255,255,255,.65)}
.path .pgo{margin-top:auto;display:inline-flex;gap:8px;align-items:center;font-weight:700;border-top:2px solid var(--ink);padding-top:14px}
.path:hover .pgo svg{transform:translateX(4px)}.path .pgo svg{transition:transform .15s}
.cmpw{overflow-x:auto;padding:0 8px 12px 0;margin-top:0}
.cmp{min-width:900px;border:2px solid var(--ink);border-radius:12px;background:#fff;box-shadow:6px 6px 0 var(--ink);overflow:hidden}
.cmp-h,.cmp-r{display:grid;grid-template-columns:150px repeat(4,1fr)}
.cmp-h>*{border-bottom:2px solid var(--ink)}.cmp-h>span{background:var(--lav)}
.cmp-h button{display:flex;gap:8px;align-items:center;justify-content:center;padding:14px 10px;border:0;border-left:2px solid var(--ink);font:800 15px Unbounded,sans-serif;letter-spacing:-.03em;color:var(--ink)}
.cmp-h button:hover{filter:brightness(.95)}
.cmp-r>*{padding:14px 16px;font-size:14.5px;border-top:2px solid rgba(13,14,28,.14)}.cmp-r:first-of-type>*{border-top:0}
.cmp-r>b{background:var(--lav);font:700 11.5px Unbounded,sans-serif;text-transform:uppercase;letter-spacing:.02em;display:flex;align-items:center}
.cmp-r>span{border-left:2px solid rgba(13,14,28,.14)}
.sshow{display:grid;gap:84px}
.srow{display:grid;grid-template-columns:.8fr 1.2fr;gap:56px;align-items:center}.srow.rev{grid-template-columns:1.2fr .8fr}.srow.rev>:first-child{order:2}.srow>*{min-width:0}
.srow h3,.bdemo h3{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;letter-spacing:-.04em;margin:0 0 12px}
.srow p,.bdemo p{font-size:17px;color:var(--mu);margin:0 0 18px;max-width:26em}
.br .bdemo p{color:rgba(13,14,28,.78)}
.bdemo{display:grid;grid-template-columns:.8fr 1.2fr;gap:56px;align-items:center;margin-top:76px}.bdemo>*{min-width:0}
.bdemo .dl{display:flex;gap:18px;flex-wrap:wrap}
.dev{border:2px solid var(--ink);border-radius:14px;background:#fff;box-shadow:8px 8px 0 var(--ink);overflow:hidden;position:relative;min-width:0;color:var(--ink)}
.dev-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;background:var(--lav);border-bottom:2px solid var(--ink)}
.dev-bar i{width:10px;height:10px;border-radius:50%;border:2px solid var(--ink);background:#fff}.dev-bar i:nth-child(1){background:var(--pk)}.dev-bar i:nth-child(2){background:var(--hl)}.dev-bar i:nth-child(3){background:var(--mn)}
.dev-bar span{margin-left:10px;flex:1;max-width:280px;background:#fff;border:2px solid var(--ink);border-radius:6px;padding:1px 10px;font-size:12px;font-weight:600;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dev.phone{max-width:300px;margin:0 auto;border-radius:34px;padding:12px;background:var(--ink)}.dev.phone .scr{border-radius:24px;overflow:hidden;background:#fff}
.rm-cover{height:170px;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;background:radial-gradient(circle at 18% 20%,var(--pk) 0,transparent 46%),radial-gradient(circle at 88% 14%,var(--hl) 0,transparent 42%),var(--ac);color:#fff;border-bottom:2px solid var(--ink)}
.rm-cover span{display:inline-block;font:700 10px Unbounded,sans-serif;text-transform:uppercase;letter-spacing:.04em;background:var(--hl);color:var(--ink);border:2px solid var(--ink);padding:2px 8px;margin-bottom:8px;transform:rotate(-2deg)}
.rm-cover b{display:block;font:800 21px/1.05 Unbounded,sans-serif;letter-spacing:-.04em}
.rm-body{padding:16px;display:grid;gap:10px}.rm-meta{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--mu);font-weight:500}
.rm-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.rm-o{padding:9px 4px;border:2px solid var(--ln);border-radius:8px;background:#fff;font-size:12px;font-weight:700}.rm-o:hover{border-color:var(--ink)}
.rm-o.on{border-color:var(--ink)}.rm-o.on.yes{background:var(--mn)}.rm-o.on.maybe{background:var(--hl)}.rm-o.on.no{background:var(--pk)}
.rm-foot{display:flex;justify-content:space-between;align-items:center;border-top:2px dashed var(--ln);padding-top:10px;font-size:13px;color:var(--mu)}.rm-foot b{color:var(--ink);font:800 15px Unbounded,sans-serif}
.em{display:grid;grid-template-columns:1.6fr 1fr;min-height:330px}
.em-chat{border-right:2px solid var(--ink);display:flex;flex-direction:column;min-width:0}
.em-hd{padding:10px 14px;border-bottom:2px solid var(--ln);font-weight:700;font-size:13px;display:flex;gap:8px;align-items:center}
.em-msgs{flex:1;padding:14px;display:flex;flex-direction:column;gap:10px}
.ebub{align-self:flex-start;max-width:82%;padding:8px 12px;border:2px solid var(--ink);border-radius:12px 12px 12px 2px;background:#fff;font-size:13px;line-height:1.35}
.ebub.me{align-self:flex-end;background:var(--ac);color:#fff;border-radius:12px 12px 2px 12px}
.ebub small{display:block;font-weight:700;color:var(--ac);font-size:11px;margin-bottom:2px}
.ebub.typ{display:flex;gap:4px;padding:10px 12px}.ebub.typ i{width:6px;height:6px;border-radius:50%;background:var(--mu);animation:bnc 1s infinite}.ebub.typ i:nth-child(2){animation-delay:.15s}.ebub.typ i:nth-child(3){animation-delay:.3s}
@keyframes bnc{50%{transform:translateY(-4px)}}
.em-tasks{padding:14px;display:grid;gap:10px;align-content:start;background:var(--lav)}.em-tasks h6{margin:0 0 2px;font:700 12px Unbounded,sans-serif;display:flex;gap:7px;align-items:center}
.etk{display:flex;gap:9px;align-items:flex-start;background:none;border:0;padding:0;text-align:left;font-size:13px;font-weight:500}
.etk i{width:17px;height:17px;border:2px solid var(--ink);border-radius:4px;background:#fff;display:grid;place-items:center;margin-top:1px;flex-shrink:0}
.etk.done i{background:var(--ok);color:#fff}.etk.done span{text-decoration:line-through;color:var(--mu)}
.dm{position:relative;background:#fff;color:var(--ink)}
.dm-top{padding:16px 18px 0}.dm-hd{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:14px}
.dpill{display:inline-flex;gap:7px;align-items:center;border:2px solid var(--ink);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;background:var(--mn);margin-bottom:8px}
.dpill i{width:7px;height:7px;border-radius:50%;background:var(--ok);animation:pls 1.4s infinite}@keyframes pls{50%{opacity:.3}}
.dm-hd h4{margin:0;font:800 16px Unbounded,sans-serif;letter-spacing:-.03em}.dm-hd small{color:var(--mu);font-size:13px}
.dring{position:relative;width:56px;height:56px;flex-shrink:0}.dring svg{transform:rotate(-90deg)}.dring b{position:absolute;inset:0;display:grid;place-items:center;font:800 12px Unbounded,sans-serif}
.dm-tabs{display:flex;gap:4px;border-bottom:2px solid var(--ink);flex-wrap:wrap}
.dm-tabs button{border:2px solid transparent;border-bottom:0;background:none;padding:8px 14px;font-weight:700;font-size:13.5px;text-transform:capitalize;border-radius:8px 8px 0 0;margin-bottom:-2px;display:flex;gap:6px;align-items:center;color:var(--mu)}
.dm-tabs button.on{background:var(--hl);border-color:var(--ink);color:var(--ink)}
.dm-tabs b{background:var(--er);color:#fff;border-radius:999px;font-size:10px;min-width:16px;height:16px;display:grid;place-items:center;padding:0 4px}
.dm-body{padding:14px;min-height:300px;max-height:380px;overflow-y:auto;background:var(--lav)}
.dg{display:flex;gap:12px;align-items:center;padding:10px 12px;border:2px solid var(--ink);border-radius:10px;background:#fff;margin-bottom:8px}
.dg.in{background:#d6f7e8}.dg.bl{background:#ffe1de}.dg.fl{background:var(--acs)}.dg.ck{background:#f0f1fa}
.dgi{width:42px;height:42px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;border:2px solid var(--ink);background:#fff;overflow:hidden}
.dg.in .dgi{background:var(--ok);color:#fff}.dg.bl .dgi{background:var(--er);color:#fff}.dg.fl .dgi{background:var(--hl);font:800 10px Unbounded,sans-serif}
.dgm{flex:1;min-width:0}.dgm p{margin:2px 0 0;font-size:12.5px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dgm strong{font-size:14.5px;margin-right:6px}
.rl{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border:1.5px solid var(--ink);border-radius:999px;background:var(--lav);margin-right:4px}
.rl.vip{background:var(--hl)}.rl.speaker{background:var(--mn)}.rl.sponsor{background:var(--pk)}.rl.bad{background:var(--er);color:#fff}
.dgb{border:2px solid var(--ink);border-radius:8px;background:var(--hl);font-weight:700;font-size:13px;padding:6px 12px;box-shadow:2px 2px 0 var(--ink);flex-shrink:0}
.dgb:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}.dgb.dn{background:#fff;box-shadow:none}.dgb.bad{background:var(--er);color:#fff}
.dsim{margin-top:12px;padding:12px;border:2px dashed var(--ink);border-radius:10px;background:#fff}.dsim p{margin:0 0 8px;font-size:13px;color:var(--mu);font-weight:600}.dsim div{display:flex;gap:8px;flex-wrap:wrap}
.dstats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.dstat{background:#fff;border:2px solid var(--ink);border-radius:10px;padding:10px;text-align:center}.dstat b{display:block;font:800 22px Unbounded,sans-serif}.dstat small{color:var(--mu);font-size:12px}
.dm h5{margin:14px 0 8px;font:700 11px Unbounded,sans-serif;text-transform:uppercase;letter-spacing:.04em;color:var(--mu)}
.dprot{display:flex;gap:10px;padding:9px 12px;background:#fff;border:2px solid var(--ln);border-radius:8px;margin-bottom:6px}.dprot b{display:block;font-size:13px}.dprot span{color:var(--mu);font-size:12.5px}.dprot i{font-style:normal;color:var(--ok);font-weight:800}
.dlg{display:flex;gap:9px;padding:9px 12px;border:2px solid var(--ink);border-radius:8px;margin-bottom:6px;font-size:13px;background:#fff}
.dlg.ok{background:#d6f7e8}.dlg.high{background:var(--acs)}.dlg.critical{background:#ffe1de}.dlg.medium{background:#e0e6ff}.dlg small{display:block;color:var(--mu);font-size:11.5px}
.dbar{height:10px;border:2px solid var(--ink);border-radius:6px;background:#fff;overflow:hidden}.dbar i{display:block;height:100%;background:var(--ok);transition:width .6s}.dbar i.part{background:var(--hl)}
.dm-ov{position:absolute;inset:0;z-index:5;background:rgba(13,14,28,.82);display:grid;place-items:center;padding:16px}
.dm-card{background:#fff;border:2px solid var(--ink);border-radius:12px;box-shadow:6px 6px 0 var(--hl);padding:20px;width:100%;max-width:320px}
.dm-card p{margin:0 0 12px}
.vd{display:grid;grid-template-columns:1.3fr 1fr;color:var(--ink);background:#fff}
.vd-floor{padding:16px;background:var(--lav);border-right:2px solid var(--ink)}
.vd-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px}
.vd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.vtb{border:2px solid var(--ink);border-radius:12px;background:#fff;padding:10px 6px;min-height:84px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:700}
.vtb small{font-weight:500;color:var(--mu);font-size:12px}.vtb.free{background:var(--mn)}.vtb.seated{background:var(--pk)}.vtb.reserved{background:var(--hl)}.vtb.round{border-radius:50%}
.vd-side{padding:16px;display:flex;flex-direction:column;gap:8px}.vd-side h5{margin:0}
.vwt{display:flex;justify-content:space-between;gap:10px;border:2px solid var(--ink);border-radius:8px;padding:8px 12px;font-size:13.5px;background:#fff}.vwt small{color:var(--mu)}
.vd-msg{font-size:13px;color:var(--mu);min-height:40px;margin:0}
.vlegend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mu);margin-top:12px}.vlegend i{display:inline-block;width:11px;height:11px;border:2px solid var(--ink);border-radius:3px;margin-right:5px;vertical-align:-2px}
.br-enterprise{background:var(--pk)}.br-enterprise .br-h h2 .hl{background:linear-gradient(transparent 60%,var(--hl) 60%)}
.oths{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.oth{display:flex;flex-direction:column;gap:6px;padding:18px;border:2px solid var(--ink);border-radius:12px;box-shadow:4px 4px 0 var(--ink);color:var(--ink);transition:transform .15s,box-shadow .15s}
.oth:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--ink)}
.oth span{display:flex;gap:7px;align-items:center;font-size:13px;font-weight:700}.oth b{font:800 16px/1.15 Unbounded,sans-serif;letter-spacing:-.03em}.oth em{font-style:normal;font-size:14px;color:rgba(13,14,28,.75)}
@media(max-width:1020px){.paths{grid-template-columns:1fr 1fr}}
@media(max-width:960px){.srow,.srow.rev,.bdemo{grid-template-columns:minmax(0,1fr);gap:32px}.srow.rev>:first-child{order:0}.oths{grid-template-columns:1fr}.sshow{gap:64px}}
@media(max-width:600px){.paths{grid-template-columns:1fr}.em{grid-template-columns:1fr}.em-chat{border-right:0;border-bottom:2px solid var(--ink)}.vd{grid-template-columns:1fr}.vd-floor{border-right:0;border-bottom:2px solid var(--ink)}.dm-body{padding:10px}.dm-top{padding:14px 12px 0}.dgb{padding:6px 9px}}
`;

function InjectCSS() {
  useEffect(() => {
    const id = 'planit-home-styles';
    let s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; s.textContent = CSS; document.head.appendChild(s); }
    return () => { document.getElementById(id)?.remove(); };
  }, []);
  return null;
}

// Bump when the Terms / Privacy Policy change in a way that needs fresh consent.
const LEGAL_VERSION = '2026-10-03';
const LEGAL_CHECKS = [
  { key: 'agreeTerms', error: 'You need to agree to the Terms of Service and Privacy Policy.',
    label: <>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</> },
  { key: 'agreeResponsible', error: 'Please confirm you are responsible for your event.',
    label: 'I am responsible for my event and everything posted to it. I will not use PlanIt for anything illegal, harassing, deceptive, or spammy, and I understand PlanIt can remove events that break the rules.' },
  { key: 'agreeGuestData', error: 'Please confirm you will handle guest data responsibly.',
    label: 'I have the right to collect my guests\u2019 information (names, emails, RSVPs, check-ins) and will only use it to run this event.' },
  { key: 'agreeAge', error: 'You must be at least 13 to create an event.', label: 'I am at least 13 years old.' },
];

const EVENT_TYPES = [
  ['wedding', 'Wedding', 'Ceremony, reception, the works'], ['birthday', 'Birthday', 'Milestone or casual celebration'],
  ['conference', 'Conference', 'Speakers, sessions, networking'], ['corporate', 'Corporate', 'Retreat, offsite, team event'],
  ['festival', 'Festival', 'Multi-stage, outdoor, crowd'], ['other', 'Other', 'Something totally unique'],
];
const VENUE_TYPES = [
  ['restaurant', 'Restaurant', 'Full-service dining floor'], ['cafe', 'Cafe', 'Counter service and tables'],
  ['bar', 'Bar / Pub', 'Drinks-led with seating'], ['popup', 'Pop-up', 'Temporary or market stall'],
  ['hotel', 'Hotel dining', 'In-house restaurant or lounge'], ['other', 'Other venue', 'Something different entirely'],
];

const MODES = [
  { id: 'standard', tab: 'Events', tone: 'lav', short: 'Team workspace: chat, tasks, polls, RSVP', icon: Calendar, title: 'Planning an event?', blurb: 'Weddings, conferences, retreats, galas. Chat, tasks, polls, RSVP and check-in in one workspace.',
    launch: 'Create your event', sub: 'Build your planning workspace in under 60 seconds. No credit card required.', cta: 'Start building',
    incl: ['Private event space with a custom URL', 'Unlimited team members', 'Real-time chat with file sharing', 'Task lists and deadlines', 'Polls and voting', 'RSVP management', 'Budgets and expense splitting', 'QR check-in for large events'] },
  { id: 'enterprise', tab: 'Enterprise', tone: 'pk', short: 'Ticketed nights: personal QR and door security', icon: Zap, title: 'Running a big, ticketed night?', blurb: 'A personal QR invite for every guest, a live check-in dashboard and fraud checks at the door.',
    launch: 'Launch an enterprise event', sub: 'Personalized QR invites, a check-in dashboard and live analytics for large events.', cta: 'Set up enterprise event',
    incl: ['Personalized QR invite per guest', 'Real-time check-in dashboard', 'Group sizes and table assignments', 'Trust scoring and manager override', 'Duplicate and forgery detection', 'Everything in Standard'] },
  { id: 'rsvp', tab: 'RSVP', tone: 'mn', short: 'Just a guest list and an RSVP page', icon: CheckSquare, title: 'Just need RSVPs?', blurb: 'A clean, section-based RSVP page and a guest list. Live in under a minute.',
    launch: 'Create your RSVP page', sub: 'A guest list and a good-looking RSVP page. No seating charts, no floor management.', cta: 'Start building',
    incl: ['Drag-and-drop RSVP page builder', '16-block library: hero, agenda, FAQ, gallery', 'Auto-generated cover graphic', 'The same guest list as every PlanIt event', 'Simple check-in', 'Views and response analytics'] },
  { id: 'table-service', tab: 'Venue', tone: 'hl', short: 'Restaurant floor: tables, waitlist, reservations', icon: UtensilsCrossed, title: 'Running a restaurant floor?', blurb: 'Live floor map, walk-in waitlist, QR reservations and one-tap seating. Your data never expires.',
    launch: 'Launch your venue', sub: 'Set up your floor plan and start managing tables in under 60 seconds.', cta: 'Set up your venue',
    incl: ['Visual floor plan editor', 'Live table states', 'Walk-in waitlist with wait estimates', 'QR reservations with expiry windows', 'Per-venue timing and hours', 'Instant sync across staff devices', 'Floor plan never auto-deleted'] },
];

/* The four "start here" cards. Same copy the old home used for Events / RSVP / Venue, plus Enterprise. */
const PATHS = [
  { id: 'standard', branch: 'events', name: 'Events', tone: 'lav', icon: Calendar, tag: 'PlanIt Events', h: ['Planning an event?', 'Start here.'],
    p: 'Weddings, conferences, corporate retreats, galas. The full planning workspace: chat, tasks, RSVP, QR check-in, all in one place.',
    cta: 'Get started free', who: ['Weddings', 'Conferences', 'Retreats', 'Galas'] },
  { id: 'enterprise', branch: 'enterprise', name: 'Enterprise', tone: 'pk', icon: Zap, tag: 'PlanIt Enterprise', h: ['Running a big,', 'ticketed night?'],
    p: 'A personal QR invite for every guest, a live check-in dashboard and fraud checks at the door. Built for 50+ attendees.',
    cta: 'See how the door works', who: ['Ticketed', '50+ guests', 'Access control'] },
  { id: 'rsvp', branch: 'rsvp', name: 'RSVP', tone: 'mn', icon: CheckSquare, tag: 'RSVP Event', h: ['Just need RSVPs?', 'Skip the rest.'],
    p: 'A beautiful, section-based RSVP page and guest list. No seating charts, no floor management, live in under a minute.',
    cta: 'Create an RSVP page', who: ['Parties', 'Meetups', 'Small gatherings'] },
  { id: 'table-service', branch: 'venue', name: 'Venue', tone: 'hl', icon: UtensilsCrossed, tag: 'PlanIt Venue', h: ['Running a restaurant', 'or venue floor?'],
    p: 'Live floor map, walk-in waitlist, QR reservations, one-tap seating. Everything front-of-house needs, every service.',
    cta: 'Set up your venue', who: ['Restaurants', 'Cafes', 'Bars and pubs'] },
];
const COMPARE = [
  ['Best for', ['Weddings, conferences, retreats, galas', 'Large, ticketed or access-controlled events (50+)', 'Parties, meetups, simple gatherings', 'Restaurants, cafes, bars and pop-ups']],
  ['Core tools', ['Team chat, tasks, polls, budgets, RSVP', 'Everything in Events, plus personal QR invites', 'Drag-and-drop RSVP page and a guest list', 'Floor map, walk-in waitlist, QR reservations']],
  ['At the door', ['QR check-in', 'Live check-in dashboard with fraud checks', 'Simple check-in', 'Public wait board and one-tap seating']],
  ['Pick it if', ['You have a team to coordinate', 'You need to control who gets in', 'The guest list is the whole job', 'You run a floor every night']],
  ['Skip it if', ['You only need a guest list (use RSVP)', 'Your event is open or team-only (use Events)', 'You need seating charts, floor management or ticketing', 'You are planning a one-off event']],
  ['Your data', ['Auto-deleted 7 days after the event', 'Auto-deleted 7 days after the event', 'Auto-deleted 7 days after the event', 'Floor plan and history never expire']],
];
const BRANCH_MODE = { events: 'standard', enterprise: 'enterprise', rsvp: 'rsvp', venue: 'table-service' };

const FEATURES = [
  [QrCode, 'QR check-in', 'A personal QR for every guest. Scan at the door, watch attendance update live.', 'w2 c-ac'],
  [Shield, 'Fraud-aware door', 'Duplicate detection, trust scoring and manager override built in.', 'c-hl'],
  [MessageSquare, 'Team chat', 'Typing indicators, history and instant delivery for your planning channel.', ''],
  [ListChecks, 'Shared tasks', 'Assign, prioritize and track every action item from one view.', ''],
  [BarChart3, 'Live polls', 'Vote on venues, menus and dates. Results update on every screen.', ''],
  [Users, 'Unlimited team', 'No per-seat pricing. Every organizer, vendor and volunteer is free.', 'w2 c-pk'],
  [FileText, 'File sharing', 'Floor plans, contracts and schedules attached to the workspace.', ''],
  [UtensilsCrossed, 'Floor manager', 'For restaurants: floor map, walk-in waitlist and live table status.', ''],
  [Bot, 'Claude co-pilot', 'Manage guests, announcements and check-ins by just asking.', 'w2 c-ink'],
];
const USES = [...EVENT_TYPES.filter((t) => t[0] !== 'other'), ...VENUE_TYPES.slice(0, 3)];
const STEPS = [
  ['Name it', 'Pick a mode and give it a name. Your private space and link are ready in under a minute.'],
  ['Bring your team', 'Share the link. Organizers, vendors and volunteers are unlimited, and guests need no account.'],
  ['Run the day', 'Chat, tasks, polls, RSVPs and door check-in, live in one workspace.'],
];
const FAQ = [
  ['Which type should I pick?', 'Events if you are coordinating a team. Enterprise if you are running a large ticketed night and need door security. RSVP if the guest list is the whole job. Venue if you run a restaurant floor.'],
  ['Is PlanIt really free?', 'Yes. Free forever, with no credit card and no per-seat pricing. Your team is unlimited.'],
  ['Do my guests need accounts?', 'No. Guests join by name with a personal QR, and RSVP pages open on any phone with no app and no account.'],
  ['Can I switch between Standard and Enterprise later?', 'No. The mode is chosen when you create the event and cannot be changed afterwards. Pick Enterprise for large, ticketed or access-controlled events with 50+ attendees.'],
  ['How long is my data kept?', 'Event data is auto-deleted 7 days after the event. For restaurants, your floor plan and history never expire.'],
  ['Can I run my event from Claude?', 'Yes. Add PlanIt to Claude as a connector, then ask it to add guests, send announcements and check attendance.'],
];

const branchOf = (id) => ({ rsvp: 'rsvp', 'table-service': 'venue', enterprise: 'enterprise' }[id] || 'events');
const BRANCHES = {
  enterprise: {
    eyebrow: 'For ticketed nights and big guest lists', h: ['Run the door.', 'Catch the fakes.'],
    p: 'Enterprise is Events with a locked-down front gate: a personal QR invite for every guest, a live check-in dashboard and fraud checks at the door. Built for 50+ attendees.',
    cta: 'Launch an enterprise event', note: 'Mode is locked once created', incTitle: 'Control who gets in.',
    items: [
      [QrCode, 'Personal QR invites', 'Every guest gets their own QR code. No shared links at the door.'],
      [BarChart3, 'Live check-in dashboard', 'Watch attendance update in real time as guests arrive.'],
      [Users, 'Groups and tables', 'Party sizes and table assignments sit on every invite.'],
      [Shield, 'Trust scoring', 'Low-trust scans get flagged for manual review, with a manager PIN override.'],
      [AlertCircle, 'Duplicate and forgery detection', 'The same identity on two invites, or a code not in the registry, gets stopped.'],
      [Layers, 'Everything in Events', 'Team chat, tasks, polls, budgets and the full planning workspace.'],
    ],
  },
  events: {
    eyebrow: 'For event teams who actually have a lot going on', h: ['Everything your team needs.', 'Nothing you don\u2019t.'],
    p: 'From 6 months out to the final wrap-up. PlanIt Events is the workspace for the whole team: organizers, vendors, volunteers, everyone.',
    cta: 'Start planning free', note: 'No credit card · No account needed', incTitle: 'Every tool. One workspace.',
    items: [
      [MessageSquare, 'Real-time team chat', 'Typing indicators, reactions, threads. Your team stays in sync.'],
      [ListChecks, 'Task management', 'Assign tasks, set deadlines, track completion down to the wire.'],
      [BarChart3, 'Polls & voting', 'Vote on venues, dates, menus. Live results instantly.'],
      [FileText, 'File sharing', 'Contracts, floor plans, schedules, all in one place.'],
      [Users, 'Unlimited team', 'No caps. Every organizer, vendor, and volunteer included.'],
      [QrCode, 'QR check-in', 'Professional guest check-in with real-time attendance.'],
      [Bot, 'Claude AI co-pilot', 'Manage your whole event by talking to Claude. Add guests, check-ins, announcements, all conversationally.'],
    ],
  },
  rsvp: {
    eyebrow: 'For when the guest list is the whole job', h: ['A gorgeous RSVP page.', 'Nothing else to configure.'],
    p: 'Drag-and-drop a real page: hero, agenda, photos, FAQ, whatever the event needs. Then share one link. No seating charts, no floor management, no ticketing. Just RSVPs, done beautifully.',
    cta: 'Create an RSVP page', note: 'Live in under a minute', incTitle: 'Live in under a minute.',
    items: [
      [Layers, 'Section-based builder', 'Drag, drop, and reorder from a 16-block library: hero, agenda, FAQ, sponsors, and more.'],
      [Zap, 'Auto-generated cover', 'Pick a template and accent color; your event\u2019s cover graphic builds itself, no design work.'],
      [Users, 'Guest list + check-in', 'The same guest list and simple check-in as every PlanIt event, without the extra setup.'],
    ],
  },
  venue: {
    eyebrow: 'For restaurants that run a real floor every night', h: ['Run your floor.', 'Know your wait.', 'Seat every table.'],
    p: 'Live table states. Walk-in waitlist with a public wait board guests scan at the door. One-tap seating. Your floor data never expires.',
    cta: 'Set up your venue', note: 'Free · Data never expires', incTitle: 'Your whole floor, in one screen.',
    items: [
      [Layers, 'Visual floor editor', 'Drag tables to match your exact layout. Zones, shapes, labels.'],
      [Users, 'Walk-in waitlist', 'Add parties instantly. Estimated wait times update as tables clear.'],
      [QrCode, 'Public wait board', 'Guests scan the door QR, see the queue, and join from their phone.'],
      [MapPin, 'Live sync', 'Every status update hits all staff screens in real time.'],
      [CheckCircle2, 'One-tap seat next', 'Auto-picks the tightest-fit table and seats the next waiting party.'],
      [Clock, 'Data never expires', 'Your floor plan and history persist forever. No cleanup, no resets.'],
    ],
  },
};

function Burst({ className, color, size = 110 }) {
  const pts = Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI) / 12, r = i % 2 ? 36 : 50; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' ');
  return <svg className={`deco ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><polygon points={pts} fill={color} stroke="#0d0e1c" strokeWidth="2.5" strokeLinejoin="round" /></svg>;
}
const Squiggle = ({ className }) => (
  <svg className={`deco ${className}`} width="96" height="26" viewBox="0 0 84 24" fill="none" aria-hidden="true"><path d="M2 12 Q12 0 22 12 T42 12 T62 12 T82 12" stroke="#6ff0c0" strokeWidth="5" strokeLinecap="round" /></svg>
);

const slugify = (t) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
const makeSubdomain = (t) => { const s = slugify(t); return s ? `${s}-${Math.random().toString(36).substring(2, 6)}` : ''; };
const sanitize = (s) => (s || '').trim().replace(/\s+/g, ' ');

/* The existing PlanIt mark (same artwork as /planit-icon.svg) */
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="PlanIt">
      <rect width="32" height="32" rx="8" fill="#111111" />
      <rect x="6" y="9" width="20" height="16" rx="2.5" fill="white" />
      <rect x="6" y="9" width="20" height="6" rx="2.5" fill="#111111" />
      <rect x="6" y="12" width="20" height="3" fill="#111111" />
      <rect x="11" y="7" width="2.5" height="5" rx="1.25" fill="white" />
      <rect x="18.5" y="7" width="2.5" height="5" rx="1.25" fill="white" />
      <path d="M12 18.5l2.8 2.8 5.2-5.2" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Live demos (ported from the old home, restyled) ───────────────────── */
function DeviceFrame({ variant = 'browser', url = '/e/summer-rooftop', children }) {
  if (variant === 'phone') return <div className="dev phone"><div className="scr">{children}</div></div>;
  return <div className={`dev ${variant}`}><div className="dev-bar"><i /><i /><i /><span>{url}</span></div>{children}</div>;
}

function RSVPMockup() {
  const [status, setStatus] = useState(null);
  const [count, setCount] = useState(84);
  const pick = (key) => {
    setCount((c) => (key === status ? c : key === 'yes' ? c + 1 : status === 'yes' ? c - 1 : c));
    setStatus(key);
  };
  return (
    <div>
      <div className="rm-cover"><span>You&apos;re invited</span><b>Summer Rooftop<br />Social</b></div>
      <div className="rm-body">
        <div className="rm-meta"><Calendar size={14} /> Sat, Aug 16 · 7:00 PM</div>
        <div className="rm-meta"><MapPin size={14} /> The Hendrick Rooftop</div>
        <div className="rm-opts">{[['yes', 'Attending'], ['maybe', 'Maybe'], ['no', 'Can\u2019t go']].map(([k, l]) => (
          <button key={k} type="button" className={`rm-o ${k}${status === k ? ' on' : ''}`} onClick={() => pick(k)}>{l}</button>))}</div>
        <div className="rm-foot"><span>Going</span><b>{count} guests</b></div>
      </div>
    </div>
  );
}

function EventSpaceMockup() {
  const [messages, setMessages] = useState([
    { id: 1, user: 'Maya', text: 'Can we push the sound check to 4pm?', me: false },
    { id: 2, user: 'You', text: 'Works for me. Updating the run of show now.', me: true },
  ]);
  const [typing, setTyping] = useState(false);
  const [tasks, setTasks] = useState([
    { label: 'Confirm catering headcount', done: true }, { label: 'Print name badges', done: true },
    { label: 'Brief volunteer team', done: false }, { label: 'Load in AV equipment', done: false },
  ]);
  useEffect(() => {
    const t1 = setTimeout(() => setTyping(true), 1400);
    const t2 = setTimeout(() => { setTyping(false); setMessages((m) => [...m, { id: 3, user: 'Jordan', text: 'Floor plan is finalized.', me: false }]); }, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="em">
      <div className="em-chat">
        <div className="em-hd"><MessageSquare size={15} /># general</div>
        <div className="em-msgs">
          {messages.map((m) => <div key={m.id} className={`ebub${m.me ? ' me' : ''}`}>{!m.me && <small>{m.user}</small>}{m.text}</div>)}
          {typing && <div className="ebub typ"><i /><i /><i /></div>}
        </div>
      </div>
      <div className="em-tasks">
        <h6><ListChecks size={15} /> Tasks</h6>
        {tasks.map((t, i) => (
          <button key={t.label} type="button" className={`etk${t.done ? ' done' : ''}`} onClick={() => setTasks((a) => a.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>
            <i>{t.done && <Check size={11} strokeWidth={3} />}</i><span>{t.label}</span></button>))}
      </div>
    </div>
  );
}

const DEMO_GUESTS = [
  { id: 1, name: 'Sarah Johnson', group: 4, table: 12, code: 'SJ4A-X9', role: 'VIP', status: 'normal' },
  { id: 2, name: 'Marcus Rivera', group: 2, table: 5, code: 'MR2B-K3', role: 'Speaker', status: 'normal' },
  { id: 3, name: 'Priya Sharma', group: 1, table: 8, code: 'PS1C-M7', role: 'Attendee', status: 'normal' },
  { id: 4, name: 'Tom & Lisa Chen', group: 2, table: 3, code: 'TC2D-R1', role: 'Sponsor', status: 'normal' },
  { id: 5, name: 'Dev Patel', group: 6, table: 15, code: 'DP6E-N5', role: 'Attendee', status: 'blocked', blockReason: 'Duplicate identity: another invite with the same email already checked in' },
  { id: 6, name: 'Amara Okafor', group: 1, table: 7, code: 'AO1F-Q2', role: 'Attendee', status: 'flagged', flagReason: 'Low trust score: 42/100, scanned from 3 different devices' },
];

function QRPattern({ code, size = 36 }) {
  const cells = 8, hash = code.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: `repeat(${cells}, 1fr)`, gap: 1, padding: 2, background: '#fff' }}>
      {Array.from({ length: cells * cells }, (_, i) => <div key={i} style={{ background: ((hash * (i + 13) * 1103515245 + 12345) & 0x7fffffff) % 3 !== 0 ? '#0d0e1c' : '#fff' }} />)}
    </div>
  );
}

function EnterpriseDemo() {
  const fresh = () => DEMO_GUESTS.map((g) => ({ ...g, checkedIn: false, checking: false, checkedAt: null, scanCount: 0 }));
  const [tab, setTab] = useState('guests');
  const [guests, setGuests] = useState(fresh);
  const [scanning, setScanning] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [securityLog, setSecurityLog] = useState([]);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overridePin, setOverridePin] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const checkedInCount = guests.filter((g) => g.checkedIn).length;
  const totalGuests = guests.reduce((s, g) => s + g.group, 0);
  const checkedInPeople = guests.filter((g) => g.checkedIn).reduce((s, g) => s + g.group, 0);
  const pct = Math.round((checkedInPeople / totalGuests) * 100);
  const addLog = (entry) => setSecurityLog((prev) => [{ ...entry, id: Date.now() + Math.random(), ts: new Date() }, ...prev].slice(0, 20));

  const handleCheckIn = (guest) => {
    if (scanning) return;
    if (guest.checkedIn) { addLog({ type: 'duplicate', severity: 'high', msg: `Duplicate scan: ${guest.name} already checked in at ${guest.checkedAt?.toLocaleTimeString()}` }); return; }
    if (guest.status === 'blocked') { addLog({ type: 'blocked', severity: 'critical', msg: `BLOCKED: ${guest.name}, ${guest.blockReason}` }); setOverrideTarget(guest); return; }
    if (guest.status === 'flagged') { addLog({ type: 'flagged', severity: 'high', msg: `WARNING: ${guest.name}, ${guest.flagReason}` }); setOverrideTarget(guest); return; }
    setScanning(guest.id);
    setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, checking: true, scanCount: g.scanCount + 1 } : g)));
    setTimeout(() => {
      const now = new Date();
      setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, checkedIn: true, checking: false, checkedAt: now } : g)));
      setLastChecked(guest.id); setScanning(null);
      addLog({ type: 'success', severity: 'ok', msg: `Checked in: ${guest.name}, party of ${guest.group}, table ${guest.table}` });
      setTimeout(() => setLastChecked(null), 2500);
    }, 900);
  };
  const handleOverride = () => {
    if (overridePin !== '1234') { setOverrideError('Wrong PIN. Try 1234 for this demo.'); return; }
    setOverrideError(''); setOverrideSuccess(true);
    const target = overrideTarget;
    setTimeout(() => {
      const now = new Date();
      setGuests((prev) => prev.map((g) => (g.id === target.id ? { ...g, checkedIn: true, checking: false, checkedAt: now, status: 'normal' } : g)));
      addLog({ type: 'override', severity: 'medium', msg: `Manager override approved: ${target.name} manually checked in` });
      setOverrideTarget(null); setOverridePin(''); setOverrideSuccess(false);
    }, 1000);
  };
  const simulateUnauthorized = () => {
    if (simulating) return;
    setSimulating(true);
    const code = ['XX99-ZZ', 'FAKE-001', 'HACK-123'][Math.floor(Math.random() * 3)];
    addLog({ type: 'unauthorized', severity: 'critical', msg: `UNAUTHORIZED: Code "${code}" not found, possible forged ticket` });
    setTimeout(() => { addLog({ type: 'ratelimit', severity: 'medium', msg: 'Rate limit triggered: IP blocked for 60s after 3 failed attempts' }); setSimulating(false); }, 1200);
    if (tab !== 'security') setTab('security');
  };
  const handleReset = () => {
    setGuests(fresh()); setSecurityLog([]); setLastChecked(null); setScanning(null); setOverrideTarget(null); setOverridePin(''); setOverrideError('');
  };
  const alerts = securityLog.filter((l) => l.severity === 'critical' || l.severity === 'high').length;
  const circ = 2 * Math.PI * 22;

  return (
    <div className="dm">
      {overrideTarget && (
        <div className="dm-ov">
          {!overrideSuccess ? (
            <div className="dm-card">
              <span className={`rl ${overrideTarget.status === 'blocked' ? 'bad' : 'vip'}`}>{overrideTarget.status === 'blocked' ? 'Guest blocked' : 'Guest flagged'}</span>
              <p style={{ fontWeight: 700, margin: '10px 0 2px' }}>{overrideTarget.name}</p>
              <p style={{ fontSize: 13, color: 'var(--mu)' }}>{overrideTarget.blockReason || overrideTarget.flagReason}</p>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }} htmlFor="ov-pin">Manager PIN required to override</label>
              <input id="ov-pin" className="inp" type="password" maxLength={4} autoFocus value={overridePin} placeholder="Enter PIN (hint: 1234)"
                style={{ textAlign: 'center', letterSpacing: '.3em' }} onChange={(e) => { setOverridePin(e.target.value); setOverrideError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleOverride()} />
              {overrideError && <div className="err"><AlertCircle size={13} />{overrideError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn sm" style={{ flex: 1 }} onClick={() => { setOverrideTarget(null); setOverridePin(''); setOverrideError(''); }}>Cancel</button>
                <button className="btn pri sm" style={{ flex: 1 }} onClick={handleOverride}>Override</button>
              </div>
            </div>
          ) : (
            <div className="dm-card" style={{ textAlign: 'center' }}><CheckCircle2 size={36} style={{ color: 'var(--ok)' }} /><p style={{ fontWeight: 700, margin: '8px 0 0' }}>Override approved</p></div>
          )}
        </div>
      )}
      <div className="dm-top">
        <div className="dm-hd">
          <div><span className="dpill"><i />Live check-in demo</span><h4>Tech Summit</h4><small>{DEMO_GUESTS.length} invites · {totalGuests} guests</small></div>
          <div className="dring">
            <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="none" stroke="#d9dbe8" strokeWidth="6" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#0c8a5b" strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s' }} /></svg>
            <b>{pct}%</b>
          </div>
        </div>
        <div className="dm-tabs" role="tablist">
          {['guests', 'security', 'analytics'].map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}{t === 'security' && alerts > 0 && <b>{alerts}</b>}</button>))}
        </div>
      </div>

      {tab === 'guests' && (
        <div className="dm-body">
          {guests.map((g) => {
            const bl = g.status === 'blocked' && !g.checkedIn, fl = g.status === 'flagged' && !g.checkedIn;
            return (
              <div key={g.id} className={`dg${g.checkedIn ? ' in' : g.checking ? ' ck' : bl ? ' bl' : fl ? ' fl' : ''}`}>
                <div className="dgi">{g.checking ? <div className="spin" /> : g.checkedIn ? <Check size={22} strokeWidth={3} /> : bl ? <Shield size={20} /> : fl ? 'FLAG' : <QRPattern code={g.code} />}</div>
                <div className="dgm">
                  <div><strong>{g.name}</strong><span className={`rl ${g.role.toLowerCase()}`}>{g.role}</span>{bl && <span className="rl bad">BLOCKED</span>}{fl && <span className="rl vip">FLAGGED</span>}</div>
                  <p>{g.checkedIn ? `Checked in · Party of ${g.group} · Table ${g.table}` : bl ? g.blockReason : fl ? g.flagReason : `Party of ${g.group} · Table ${g.table}`}</p>
                </div>
                {lastChecked === g.id && <b style={{ color: 'var(--ok)', fontSize: 13 }}>In!</b>}
                <button className={`dgb${g.checkedIn ? ' dn' : bl ? ' bad' : ''}`} disabled={!!scanning || g.checkedIn} onClick={() => handleCheckIn(g)}>
                  {g.checkedIn ? 'Done' : scanning === g.id ? '…' : bl ? 'Blocked' : fl ? 'Review' : 'Scan'}</button>
              </div>
            );
          })}
          <div className="dsim"><p>Simulate a security scenario:</p>
            <div><button className="btn sm" onClick={simulateUnauthorized} disabled={simulating}>{simulating ? 'Scanning…' : 'Try a forged ticket'}</button>
              {(checkedInCount > 0 || securityLog.length > 0) && <button className="btn sm" onClick={handleReset}>Reset</button>}</div></div>
        </div>
      )}

      {tab === 'security' && (
        <div className="dm-body">
          <div className="dstats">{[['Blocked', guests.filter((g) => g.status === 'blocked' && !g.checkedIn).length], ['Flagged', guests.filter((g) => g.status === 'flagged' && !g.checkedIn).length], ['Alerts', securityLog.filter((l) => l.severity !== 'ok').length]].map(([l, n]) => (
            <div className="dstat" key={l}><b>{n}</b><small>{l}</small></div>))}</div>
          <h5>Active protections</h5>
          {[['Duplicate detection', 'Flags the same identity across multiple invites'], ['Rate limiting', '3 failed scans, then a 60s IP lockout'], ['Trust scoring', 'Flags low-trust guests for manual review'], ['Manager override', 'PIN-protected override for blocked guests'], ['QR forgery detection', 'Rejects codes that are not in the guest registry']].map(([t, d]) => (
            <div className="dprot" key={t}><i>✓</i><div><b>{t}</b><span>{d}</span></div></div>))}
          <h5>Security log</h5>
          {securityLog.length === 0 ? <p style={{ fontSize: 13, color: 'var(--mu)', margin: 0 }}>No events yet. Go to Guests and scan a blocked or flagged guest, or try a forged ticket.</p>
            : securityLog.map((l) => <div key={l.id} className={`dlg ${l.severity}`}><div><b style={{ fontSize: 13 }}>{l.msg}</b><small>{l.ts.toLocaleTimeString()}</small></div></div>)}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="dm-body">
          <div className="dstats">{[['Arrived', checkedInPeople], ['Pending', totalGuests - checkedInPeople], ['Invites in', checkedInCount]].map(([l, n]) => <div className="dstat" key={l}><b>{n}</b><small>{l}</small></div>)}</div>
          <h5>Guest breakdown</h5>
          {guests.map((g) => (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{g.name}</span><span style={{ color: 'var(--mu)' }}>{g.checkedIn ? g.group : 0}/{g.group}</span></div>
              <div className="dbar"><i className={g.checking ? 'part' : ''} style={{ width: g.checkedIn ? '100%' : g.checking ? '45%' : '0%' }} /></div>
            </div>))}
          {checkedInCount === 0 && <p style={{ fontSize: 13, color: 'var(--mu)' }}>Switch to Guests and start checking people in.</p>}
        </div>
      )}
    </div>
  );
}

function VenueDemo() {
  const init = () => ({
    tables: [{ id: 'T1', seats: 2, s: 'seated' }, { id: 'T2', seats: 2, s: 'free' }, { id: 'T3', seats: 4, s: 'reserved' }, { id: 'T4', seats: 4, s: 'free' }, { id: 'T5', seats: 6, s: 'seated' }, { id: 'T6', seats: 8, s: 'free' }],
    wait: [{ name: 'Okafor', n: 2 }, { name: 'Lindqvist', n: 4 }, { name: 'Rivera', n: 6 }],
  });
  const [d, setD] = useState(init);
  const [msg, setMsg] = useState('Hit Seat next to place the first party on the waitlist.');
  const seatNext = () => {
    if (!d.wait.length) { setMsg('Waitlist is empty. Tap Reset to run the service again.'); return; }
    const [first, ...rest] = d.wait;
    const fit = d.tables.filter((t) => t.s === 'free' && t.seats >= first.n).sort((a, b) => a.seats - b.seats)[0];
    if (!fit) { setMsg(`No free table fits ${first.name} (${first.n}). Tap a seated table to clear it.`); return; }
    setD({ tables: d.tables.map((t) => (t.id === fit.id ? { ...t, s: 'seated' } : t)), wait: rest });
    setMsg(`Seated ${first.name} (${first.n}) at ${fit.id}, the tightest fit.`);
  };
  const clear = (id) => setD((p) => ({ ...p, tables: p.tables.map((t) => (t.id === id && t.s === 'seated' ? { ...t, s: 'free' } : t)) }));
  return (
    <div className="vd">
      <div className="vd-floor">
        <div className="vd-top"><span className="dpill" style={{ margin: 0 }}><i />Live floor</span><button className="btn sm" onClick={() => { setD(init()); setMsg('Reset. Hit Seat next to start.'); }}>Reset</button></div>
        <div className="vd-grid">{d.tables.map((t) => (
          <button key={t.id} type="button" className={`vtb ${t.s}${t.seats <= 2 ? ' round' : ''}`} onClick={() => clear(t.id)} aria-label={`Table ${t.id}, ${t.seats} seats, ${t.s}`}>
            {t.id}<small>{t.seats} seats · {t.s}</small></button>))}</div>
        <div className="vlegend"><span><i style={{ background: 'var(--mn)' }} />Free</span><span><i style={{ background: 'var(--pk)' }} />Seated (tap to clear)</span><span><i style={{ background: 'var(--hl)' }} />Reserved</span></div>
      </div>
      <div className="vd-side">
        <h5 style={{ margin: 0, font: '700 11px Unbounded,sans-serif', textTransform: 'uppercase', color: 'var(--mu)' }}>Walk-in waitlist</h5>
        {d.wait.length === 0 ? <div className="vwt"><small>Nobody waiting</small></div> : d.wait.map((w, i) => <div className="vwt" key={w.name}><span><b>{w.name}</b> · party of {w.n}</span><small>~{(i + 1) * 8} min</small></div>)}
        <button className="btn pri" onClick={seatNext}>Seat next <ArrowRight size={16} /></button>
        <p className="vd-msg" aria-live="polite">{msg}</p>
      </div>
    </div>
  );
}

const SHOWCASE = [
  { key: 'rsvp', eyebrow: 'Step 01', title: 'Guests RSVP in seconds', desc: 'No app, no account: a beautiful invite page guests can respond to from any phone. Tap a response.', device: 'phone', node: <RSVPMockup />, cta: 'See RSVP pages', mode: 'rsvp' },
  { key: 'space', eyebrow: 'Step 02', title: 'Your team plans together', desc: 'Chat, shared tasks, and polls in one live workspace instead of five different apps. Tick a task off.', device: 'browser', node: <EventSpaceMockup />, cta: 'See Events', mode: 'standard' },
  { key: 'checkin', eyebrow: 'Step 03', title: 'Check them in at the door', desc: 'A real, working check-in demo. Duplicate detection and manager overrides included. Try it.', device: 'tablet', url: '/e/tech-summit/check-in', node: <EnterpriseDemo />, cta: 'See Enterprise', mode: 'enterprise' },
];
const BRANCH_DEMOS = {
  events: { k: 'Live demo', h: 'Your team workspace, in motion.', p: 'Chat, shared tasks and polls in one live workspace instead of five different apps. Tick a task off to try it.', device: 'browser', url: '/e/summer-rooftop', node: <EventSpaceMockup />, links: [['Try the invite demo', '/demo/invite'], ['Try the RSVP demo', '/demo/rsvp']] },
  enterprise: { k: 'Live demo', h: 'Work the door yourself.', p: 'Scan guests in, hit a blocked or flagged one and override it with the manager PIN (1234). Then fire a forged ticket and watch the security log.', device: 'tablet', url: '/e/tech-summit/check-in', node: <EnterpriseDemo />, links: [] },
  rsvp: { k: 'Live demo', h: 'What your guests see.', p: 'The page opens on any phone with no app and no account. Tap a response and watch the count move.', device: 'phone', node: <RSVPMockup />, links: [['Try the RSVP demo', '/demo/rsvp']] },
  venue: { k: 'Live demo', h: 'Seat a walk-in in one tap.', p: 'Hit Seat next and the tightest-fit free table goes to the next party on the waitlist. Tap a seated table to clear it.', device: 'browser', url: '/e/taverna-roma/floor', node: <VenueDemo />, links: [] },
};
/* ── Find an event by link ─────────────────────────────────────────────── */
function SlugFinder() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);
  const go = () => {
    const raw = value.trim(); if (!raw) return;
    let slug = raw;
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://x.com/${raw}`);
      const m = url.pathname.match(/\/rsvp\/([^/?#]+)/) || url.pathname.match(/\/e\/([^/?#]+)/);
      slug = m ? m[1] : url.pathname.replace(/^\/+|\/+$/g, '');
    } catch { /* use raw */ }
    slug = slug.replace(/^\/?(rsvp\/|e\/)?/, '').replace(/\/+$/, '');
    if (!slug) { setShake(true); setTimeout(() => setShake(false), 450); return; }
    navigate(`/e/${slug}`);
  };
  return (
    <div className={`find${shake ? ' shake' : ''}`}>
      <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder="Already have an event link? Paste it here" aria-label="Event link or slug" />
      <button onClick={go}>Open <CornerDownRight size={14} /></button>
    </div>
  );
}

function CopyLinkBox({ eventId, subdomain, mode }) {
  const [copied, setCopied] = useState('');
  const origin = window.location.origin;
  const rsvp = subdomain && mode !== 'table-service' ? `${origin}/rsvp/${subdomain}` : null;
  const space = subdomain ? `${origin}/e/${subdomain}` : `${origin}/event/${eventId}`;
  const copy = (key, text, msg) => { navigator.clipboard?.writeText(text); setCopied(key); toast.success(msg); setTimeout(() => setCopied(''), 2000); };
  const Row = ({ k, label, url, msg }) => (
    <div className="link"><small>{label}</small><code>{url}</code>
      <button className="sm-btn go" onClick={() => copy(k, url, msg)}>{copied === k ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</button></div>
  );
  return (
    <div className="done">
      {rsvp && <Row k="rsvp" label="RSVP" url={rsvp} msg="RSVP link copied" />}
      <Row k="space" label="Space" url={space} msg="Event link copied" />
      {rsvp && <small style={{ color: 'var(--mu)' }}>The RSVP link is the one to share. Enable the RSVP page in Event Settings to activate it.</small>}
    </div>
  );
}

/* ── Create wizard ─────────────────────────────────────────────────────── */
function Field({ label, hint, error, children }) {
  return <div><label>{label} {hint && <small>{hint}</small>}</label>{children}{error && <div className="err"><AlertCircle size={13} />{error}</div>}</div>;
}

function Wizard({ mode, formData, setFormData, fieldErrors, setFieldErrors, onSubmit, loading, submittedRef, stepControlRef, abuseStatus, requiresVerification, onCaptchaToken, captchaResetKey, onUserInput, onUserPaste }) {
  const isVenue = mode === 'table-service', isRsvp = mode === 'rsvp';
  const steps = isVenue ? ['type', 'name', 'who', 'pw'] : isRsvp ? ['type', 'name', 'when', 'who', 'pw'] : ['type', 'name', 'when', 'kind', 'who', 'pw'];
  const [step, setStep] = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const [type, setType] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [localErr, setLocalErr] = useState({});
  const [draft, setDraft] = useState(null);
  const firstRef = useRef(null);
  const stepRef = useRef(step);
  const debounce = useRef(null);
  const total = steps.length, cur = steps[step];

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { // lets the parent send the user back to a step after a server error
    if (stepControlRef) stepControlRef.current = { goTo: (n) => { setStep(n); setStepKey((k) => k + 1); setLocalErr({}); }, getStep: () => step };
  });
  useEffect(() => {
    trackFeature('event_creation_start'); trackGAEvent('event_creation_started');
    try {
      const raw = localStorage.getItem('planit_event_draft');
      if (raw) { const d = JSON.parse(raw); if (d.timestamp && Date.now() - d.timestamp < 72 * 3600 * 1000) setDraft(d); }
    } catch { /* ignore */ }
    const onUnload = () => { if (!submittedRef?.current) { trackFeature('event_creation_abandon', { step: stepRef.current }); flushTracker(); } };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); clearTimeout(debounce.current); };
  }, []); // eslint-disable-line
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      try {
        localStorage.setItem('planit_event_draft', JSON.stringify({
          formData: { ...formData, agreeTerms: false, agreeResponsible: false, agreeGuestData: false, agreeAge: false }, // consent is never restored
          step, timestamp: Date.now(), visitorId: localStorage.getItem('planit_vid'),
        }));
      } catch { /* ignore */ }
    }, 1200);
    return () => clearTimeout(debounce.current);
  }, [formData, step]);
  useEffect(() => { const t = setTimeout(() => firstRef.current?.focus(), 320); return () => clearTimeout(t); }, [step]);

  const go = (d) => { setStep((s) => s + d); setStepKey((k) => k + 1); setLocalErr({}); };
  const validate = () => {
    const e = {};
    if (cur === 'name' && !formData.title.trim()) e.title = isVenue ? 'Venue name is required.' : 'Event title is required.';
    if (cur === 'when') { if (!formData.date) e.date = 'Date and time is required.'; if (!formData.timezone) e.timezone = 'Timezone is required.'; }
    if (cur === 'who') {
      if (!formData.organizerName.trim()) e.organizerName = isVenue ? 'Manager name is required.' : 'Your name is required.';
      if (!formData.organizerEmail.trim()) e.organizerEmail = 'Email is required.';
      else if (!validateEmail(formData.organizerEmail.trim())) e.organizerEmail = 'Please enter a valid email.';
    }
    if (cur === 'pw') {
      if (!formData.accountPassword) e.accountPassword = 'Password is required.';
      else if (formData.accountPassword.length < 4) e.accountPassword = 'Must be at least 4 characters.';
      for (const c of LEGAL_CHECKS) if (!formData[c.key]) e[c.key] = c.error;
    }
    setLocalErr(e); return !Object.keys(e).length;
  };
  const next = () => { if (!validate()) return; step < total - 1 ? go(1) : onSubmit(); };
  const set = (f) => (e) => {
    onUserInput?.();
    setFormData((p) => ({ ...p, [f]: e.target.value, ...(f === 'timezone' ? { _tzTouched: true } : {}) }));
    if (localErr[f]) setLocalErr((p) => ({ ...p, [f]: '' }));
    if (fieldErrors[f]) setFieldErrors((p) => ({ ...p, [f]: '' }));
  };
  const err = { ...localErr, ...fieldErrors };
  const enter = (e) => e.key === 'Enter' && next();

  const head = (t, p) => <><h3>{t}</h3><p>{p}</p></>;
  const body = () => {
    if (cur === 'type') return <>
      {head(isVenue ? 'What kind of venue?' : 'What are you planning?', 'This helps us personalise your setup. You can change anything later.')}
      <div className="opts">{(isVenue ? VENUE_TYPES : EVENT_TYPES).map(([id, l, h]) => (
        <button key={id} type="button" className={`opt${type === id ? ' on' : ''}`} onClick={() => setType(id)}><b>{l}</b><span>{h}</span></button>))}</div>
    </>;
    if (cur === 'name') return <>
      {head(isVenue ? 'What\u2019s your venue called?' : 'What\u2019s your event called?', isVenue ? 'Your restaurant name. Guests will see this.' : 'Give it a name your team will recognise.')}
      <div className="fld">
        <Field error={err.title}><input ref={firstRef} className={`inp${err.title ? ' bad' : ''}`} value={formData.title} autoComplete="off" onKeyDown={enter}
          placeholder={isVenue ? 'Taverna Roma, The Oak Room…' : 'Summer Company Retreat 2026'} aria-label="Title"
          onChange={(e) => { onUserInput?.(); const title = e.target.value; setFormData((p) => ({ ...p, title, subdomain: p._subdomainTouched ? p.subdomain : makeSubdomain(title) })); if (localErr.title) setLocalErr((p) => ({ ...p, title: '' })); }} /></Field>
        {formData.title && <Field label="Your URL" error={err.subdomain}><div className="slug">/e/<input value={formData.subdomain} spellCheck={false} aria-label="URL slug"
          onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'); setFormData((p) => ({ ...p, subdomain: v, _subdomainTouched: true })); if (fieldErrors.subdomain) setFieldErrors((p) => ({ ...p, subdomain: '' })); }} /></div></Field>}
        {!isVenue && <textarea className="inp" rows={3} style={{ resize: 'none' }} placeholder="A short description (optional)" aria-label="Description" value={formData.description} onChange={set('description')} />}
      </div></>;
    if (cur === 'when') return <>
      {head('When and where?', 'Set the date and location. Guests see this on their invite.')}
      <div className="fld">
        <Field label="Date & time *" error={err.date}><input ref={firstRef} type="datetime-local" className={`inp${err.date ? ' bad' : ''}`} value={formData.date} onChange={set('date')} /></Field>
        <Field label="Timezone *" error={err.timezone}><select className="inp" value={formData.timezone} onChange={set('timezone')}>{getTimezoneOptions(formData.timezone).map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></Field>
        <Field label="Location"><input className="inp" placeholder="Central Park, NYC" value={formData.location} onChange={set('location')} /></Field>
      </div></>;
    if (cur === 'kind') return <>
      {head('Choose your event mode.', <>This <b style={{ color: 'var(--er)' }}>cannot be changed</b> after your event is created.</>)}
      <div className="opts">
        {[[false, 'Standard', ['Open RSVP link', 'Team chat & tasks', 'Polls & budget', 'Unlimited members']], [true, 'Enterprise', ['Personalized QR invites', 'Check-in dashboard', 'Everything in Standard', 'Table assignments + groups']]].map(([v, l, items]) => (
          <button key={l} type="button" className={`opt${formData.isEnterpriseMode === v ? ' on' : ''}`} onClick={() => setFormData((p) => ({ ...p, isEnterpriseMode: v }))}>
            <b>{l}</b><ul>{items.map((i) => <li key={i}>{i}</li>)}</ul></button>))}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--mu)', margin: '16px 0 0' }}>Enterprise is built for large, ticketed or access-controlled events with 50+ attendees. For open RSVP or team-only events, Standard is all you need.</p>
      <div className="note"><AlertCircle size={15} style={{ marginTop: 2 }} /><span><b>This cannot be changed later.</b> Switching between Standard and Enterprise isn&apos;t possible after creation.</span></div></>;
    if (cur === 'who') return <>
      {head(isVenue ? 'Who manages this venue?' : 'Who\u2019s organizing this?', isVenue ? 'Updates go here, and you\u2019ll use it to log back in.' : 'This is your organizer account. Keep these details safe.')}
      <div className="fld">
        <Field label={`${isVenue ? 'Manager name' : 'Your name'} *`} error={err.organizerName}><input ref={firstRef} className={`inp${err.organizerName ? ' bad' : ''}`} placeholder={isVenue ? 'Head Manager' : 'Alex Smith'} value={
