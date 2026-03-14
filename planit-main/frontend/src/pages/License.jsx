import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

function Part({ title, children }) {
  return (
    <section className="mb-14">
      <h2 className="text-base font-black text-neutral-900 mb-6 pb-3 border-b-2 border-neutral-200 uppercase tracking-widest">
        {title}
      </h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function SectionBlock({ title, children }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-neutral-800 mb-3 uppercase tracking-wide">{title}</h3>
      <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">{children}</div>
    </div>
  );
}

function ComponentCard({ letter, title, children }) {
  return (
    <div className="border border-neutral-200 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
          {letter}
        </span>
        <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Callout({ children }) {
  return (
    <div className="my-5 p-4 bg-neutral-900 rounded-xl text-sm text-neutral-300 leading-relaxed">
      {children}
    </div>
  );
}

function ClauseList({ items }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map(([id, text]) => (
        <li key={id} className="flex gap-3">
          <span className="text-neutral-400 font-mono text-xs pt-0.5 flex-shrink-0">{id}</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function PermissionGrid() {
  const permitted = [
    'Reading this source code for personal educational reference',
    'Using the Hosted Service at planitapp.onrender.com as an end-user',
    'Discussing the platform publicly in factual, non-misleading terms',
    'Reporting security vulnerabilities responsibly to the Author',
  ];
  const notPermitted = [
    'Deploying any component of the platform on any infrastructure',
    'Copying, cloning, or forking any component',
    'Distributing any component to any third party',
    'Creating any Derivative Work from any component',
    'Using any component for Commercial Use',
    'Removing copyright notices or "Powered by PlanIt" attributions',
    'Using the PlanIt name or logo without consent',
    'Reverse engineering any security or cryptographic mechanism',
    'Using source code in ML or AI training datasets',
    'Conducting penetration testing of the Hosted Service',
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <p className="text-xs font-bold text-green-800 uppercase tracking-wider mb-3">✓ Permitted Without Permission</p>
        <ul className="space-y-2">
          {permitted.map((t, i) => (
            <li key={i} className="text-sm text-green-800 flex gap-2">
              <span className="flex-shrink-0 mt-0.5">✓</span><span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3">✗ Not Permitted Without Written Permission</p>
        <ul className="space-y-2">
          {notPermitted.map((t, i) => (
            <li key={i} className="text-sm text-red-800 flex gap-2">
              <span className="flex-shrink-0 mt-0.5">✗</span><span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function License() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="btn btn-secondary p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-neutral-900 p-2 rounded-xl">
                <ScrollText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-neutral-900">License Agreement</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 md:p-14">

          {/* Title block */}
          <div className="mb-12 text-center border-b border-neutral-200 pb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">PlanIt Platform</p>
            <h1 className="text-4xl font-black text-neutral-900 mb-2 tracking-tight">Master License Agreement</h1>
            <p className="text-sm text-neutral-500 mb-1">Consolidated Intellectual Property Declaration</p>
            <p className="text-sm text-neutral-400">Version 2.0 — January 2026</p>
            <div className="mt-5 inline-flex flex-col items-center gap-1 text-sm text-neutral-500">
              <span>Copyright © 2026 Aakshat Hariharan. All Rights Reserved.</span>
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-400 hover:text-neutral-700 transition-colors">planit.userhelp@gmail.com</a>
              <a href="https://planitapp.onrender.com" className="text-neutral-400 hover:text-neutral-700 transition-colors">https://planitapp.onrender.com</a>
            </div>
          </div>

          <Callout>
            <strong className="text-white">IMPORTANT — READ BEFORE PROCEEDING.</strong>{' '}
            This Master License Agreement is the single authoritative legal instrument governing all intellectual property rights in and to the PlanIt platform. By accessing the repository, viewing any source code file, cloning or forking the repository, running any component locally, or using the Hosted Service, you agree to be legally bound by this Master Agreement and by each individual component license that applies to the portion of the software you are accessing. If you do not agree to these terms, immediately cease all interaction with the PlanIt platform in any form.
          </Callout>

          {/* PART ONE */}
          <Part title="Part One — The PlanIt Platform: An Overview">
            <p className="text-sm text-neutral-600 leading-relaxed">
              The PlanIt platform is a multi-service distributed system comprising four distinct software components, each separately developed, separately deployed, and separately owned by the Author.
            </p>

            <ComponentCard letter="A" title="The Frontend Application">
              <p>The PlanIt Frontend Application is the client-side web application built with React and Vite, served as a single-page application at planitapp.onrender.com. It encompasses the public-facing experience, the EventSpace event management interface, the Admin Panel, the White-Label Client Portal, the White-Label Theming System, the WLHome branded landing page, the Reservation System, and a complete proprietary Visual Design System.</p>
              <p>The Frontend Application is the product of an enormous amount of creative design and engineering work. Its value lies not just in the code, but in the decisions: which components to build, how they interact, what the user experience flows feel like, how the white-label system works architecturally, and what the visual design language communicates. Taken as a whole, it constitutes both a copyrighted work and protectable trade dress.</p>
            </ComponentCard>

            <ComponentCard letter="B" title="The Backend Application">
              <p>The PlanIt Backend Application is the server-side engine built on Node.js and Express.js, deployed as a fleet of five identical instances (Maverick, Goose, Iceman, Slider, and Viper). It encompasses the Event Management Engine, Authentication and Authorization System, White-Label Management API, Cryptographic License Key System, White-Label Client Portal API, the trafficGuard Security Middleware Layer, Email Service, Maintenance System, Data Models, and Real-Time Layer via Socket.IO.</p>
              <p>The Backend Application's value lies in the completeness and correctness of its data models, the security architecture, and the Cryptographic License Key System — a novel HMAC-SHA256-based invention that enables offline-verifiable, tamper-evident license enforcement at scale.</p>
            </ComponentCard>

            <ComponentCard letter="C" title="The Router Service">
              <p>The PlanIt Router Service is the intelligent HTTP traffic orchestration layer deployed at planit-router.onrender.com. It provides intelligent load distribution via a proprietary scoring algorithm, health-aware orchestration, adaptive scaling with boost mode, maintenance coordination, dynamic CORS management, HMAC-based Mesh Authentication, response caching, and WebSocket proxying.</p>
              <p>The Router Service's value is entirely in its Routing Intelligence — the specific algorithm by which it selects backend instances — and the Mesh Protocol, a custom security protocol designed specifically for the PlanIt platform. Both constitute trade secrets in addition to copyrighted works.</p>
            </ComponentCard>

            <ComponentCard letter="D" title="The Watchdog Service">
              <p>The PlanIt Watchdog Service is an autonomous infrastructure monitoring daemon responsible for real-time health monitoring, incident lifecycle management, alert routing and delivery via ntfy.sh and Discord, uptime history aggregation, status page data API, and auto-promotion of scheduled maintenance windows.</p>
              <p>The Watchdog Service's value lies in its Monitoring Intelligence — the specific configuration of polling intervals, failure thresholds, incident severity rules, alert routing logic, and uptime aggregation methodology — developed through operational experience and constituting trade secrets.</p>
            </ComponentCard>
          </Part>

          {/* PART TWO */}
          <Part title="Part Two — Overarching Terms Applicable to All Components">

            <SectionBlock title="Section M-1 — Unified Ownership Declaration">
              <ClauseList items={[
                ['M-1.1', 'The Author is the sole and exclusive owner of all intellectual property rights in and to the PlanIt platform as a whole and in each individual component thereof, including all copyrights, trade secrets, trade dress, and any other proprietary rights recognized under applicable law.'],
                ['M-1.2', 'The PlanIt platform, considered as a whole, constitutes a collective work under copyright law. The Author owns the copyright in the collective work in addition to the component copyrights.'],
                ['M-1.3', 'The architectural decisions governing how the four components interact — the CORS scheme, mesh authentication protocol, white-label domain flow, and maintenance exemption hierarchy — together constitute a proprietary system design that is itself a trade secret and copyrighted work of the Author.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section M-2 — Scope of the Master Agreement">
              <ClauseList items={[
                ['M-2.1', 'This Master Agreement governs any and all access to and use of the PlanIt platform, regardless of which component or components you interact with.'],
                ['M-2.2', 'Where a more specific individual component license agreement addresses a particular topic, that specific provision takes precedence over any general provision in this Master Agreement with respect to that specific topic.'],
                ['M-2.3', 'Interaction with any single component of the PlanIt platform subjects you to the Master Agreement and to the individual license agreement for that component.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section M-3 — Unified Grant of Limited License">
              <ClauseList items={[
                ['M-3.1', 'Subject to your full and continuous compliance with this Master Agreement, the Author grants you a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code of any component solely for personal, non-commercial educational and reference purposes; and (b) access and use the Hosted Service as an end-user for its intended purpose of event planning and management, subject to the Terms of Service.'],
                ['M-3.2', 'White-label clients with executed white-label agreements hold additional rights as specified in those agreements only.'],
                ['M-3.3', 'All rights not expressly granted are reserved by the Author.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section M-4 — Unified Restrictions">
              <p className="mb-2">Without explicit prior written permission from the Author, you must NOT:</p>
              <ul className="space-y-1.5 text-sm text-neutral-700">
                {[
                  'Deploy any component of the platform on any infrastructure',
                  'Copy, clone, or reproduce any component in any form',
                  'Distribute any component to any third party',
                  'Create any Derivative Work from any component',
                  'Use any component for any Commercial Use',
                  'Reverse engineer any security or enforcement mechanism',
                  'Use any component\'s source code in any ML training dataset',
                  'Remove any copyright notice or proprietary marking',
                ].map((r, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-neutral-400 flex-shrink-0">({String.fromCharCode(97 + i)})</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>

            <SectionBlock title="Section M-5 — No Open Source">
              <ClauseList items={[
                ['M-5.1', 'The PlanIt platform is NOT open source software. No component is released under any open-source license, including MIT, Apache 2.0, GNU GPL, GNU LGPL, BSD, Creative Commons, or any other license that would permit copying, modification, or redistribution.'],
                ['M-5.2', 'The presence of this source code in a publicly accessible repository does not constitute: (a) an open-source release; (b) a public domain dedication; (c) an implied license of any kind; (d) a waiver of any copyright or other proprietary right; or (e) consent to any use beyond viewing for educational reference.'],
                ['M-5.3', 'The Author has chosen to make this source code publicly visible solely to demonstrate technical capability and for reference purposes, expressly without waiving any intellectual property right.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section M-6 — Unified Disclaimers and Limitations">
              <div className="bg-neutral-100 rounded-xl p-4 space-y-2 text-sm text-neutral-700 font-medium">
                <p>THE ENTIRE PLANIT PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.</p>
                <p>THE AUTHOR'S TOTAL LIABILITY UNDER THIS MASTER AGREEMENT AND ALL INDIVIDUAL COMPONENT LICENSES COMBINED SHALL NOT EXCEED USD $100.00.</p>
                <p>IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM ANY COMPONENT OF THE PLATFORM.</p>
              </div>
            </SectionBlock>

            <SectionBlock title="Section M-7 — Governing Law and Dispute Resolution">
              <ClauseList items={[
                ['M-7.1', 'This Master Agreement and all individual component license agreements shall be governed by the laws of the jurisdiction in which the Author resides, without regard to conflict of law principles.'],
                ['M-7.2', 'Any dispute that cannot be resolved by direct negotiation shall be submitted to binding arbitration under rules mutually agreed by the parties, except that the Author shall always be entitled to seek emergency injunctive relief from any court of competent jurisdiction without first submitting to arbitration.'],
                ['M-7.3', 'Each party irrevocably waives any objection to the venue or personal jurisdiction of courts in the Author\'s jurisdiction for any proceeding that escapes arbitration.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section M-8 — Contact and Permissions">
              <p>All requests for permissions beyond those granted in this Master Agreement — including commercial license inquiries, white-label partnership inquiries, academic use requests, and security vulnerability reports — must be directed to:</p>
              <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm space-y-1">
                <p><span className="font-semibold text-neutral-700">Email:</span> <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-600 hover:text-neutral-900 transition-colors">planit.userhelp@gmail.com</a></p>
                <p><span className="font-semibold text-neutral-700">Web:</span> <a href="https://planitapp.onrender.com" className="text-neutral-600 hover:text-neutral-900 transition-colors">https://planitapp.onrender.com</a> (Support page)</p>
              </div>
              <p className="mt-3">Permission requests must be made in writing, must identify the requestor and their intended use in detail, and will be evaluated at the Author's sole discretion. Permission is never implied, deemed, or constructively granted.</p>
            </SectionBlock>
          </Part>

          {/* PART THREE */}
          <Part title="Part Three — Frontend Application License">
            <p className="text-sm text-neutral-600 leading-relaxed">Governs all access to and use of the PlanIt client-side React application. Covers every .jsx, .tsx, .css, .html, .json, and .js file in /frontend/src/ and its subdirectories, the Vite configuration, PWA configuration, all design assets, and the complete Visual Design System.</p>

            <SectionBlock title="Section 1 — Definitions">
              <ClauseList items={[
                ['1.1', '"Frontend Application" or "Software" — the PlanIt client-side web application in its entirety, including all React components, context providers, service modules, UI components, design tokens, Tailwind CSS configuration, custom CSS stylesheets, animation definitions, Vite build configuration, PWA manifest, public/ directory assets, the Visual Design System, and the white-label theming architecture.'],
                ['1.2', '"Author" — Aakshat Hariharan, the sole designer, architect, developer, and intellectual property owner of the Frontend Application.'],
                ['1.3', '"You" or "Licensee" — any individual, developer, designer, engineer, researcher, student, company, or other legal or natural person that accesses, views, downloads, clones, compiles, executes, deploys, or otherwise interacts with the Frontend Application.'],
                ['1.4', '"Hosted Service" — the production deployment at planitapp.onrender.com and all associated white-label custom domains.'],
                ['1.5', '"Visual Design System" — the complete proprietary visual language including dark color palette, gradient definitions, glassmorphism treatments, ambient glow patterns, typography hierarchy, micro-interaction patterns, icon usage conventions, and overall aesthetic system.'],
                ['1.6', '"Derivative Work" — any work derived from, copying, adapting, or substantially similar to the Frontend Application in code, design, architecture, or user experience.'],
                ['1.7', '"Commercial Use" — any use in connection with any revenue-generating activity.'],
                ['1.8', '"Deploy" — to serve, host, publish, or make operational the Frontend Application on any infrastructure.'],
                ['1.9', '"Distribute" — to share, transfer, publish, or make available the Frontend Application to any third party.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section 2 — Grant of Limited License">
              <ClauseList items={[
                ['2.1', 'The Author grants you a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access and use the Hosted Service as an end-user.'],
                ['2.2', 'White-label clients with executed agreements hold additional rights per those agreements only.'],
                ['2.3', 'All rights not expressly granted are reserved by the Author.'],
                ['2.4', 'The Author may revoke this license at any time without notice.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section 3 — Restrictions on Use">
              <p className="mb-2">Without prior explicit written permission from the Author, you will NOT:</p>
              <ul className="space-y-1.5 text-sm text-neutral-700">
                {[
                  'Copy, clone, mirror, or reproduce the Frontend Application',
                  'Deploy the Frontend Application on any infrastructure',
                  'Distribute the Frontend Application to any third party',
                  'Modify or create any Derivative Work',
                  'Reverse engineer any compiled or minified portion',
                  'Use the Visual Design System for any other product\'s design',
                  'Use any portion for Commercial Use',
                  'Remove any copyright notices, license notices, or attributions',
                  'Use "PlanIt" or "Aakshat Hariharan" without written consent',
                  'Use automated tools to extract source code or content at scale',
                  'Use source code in ML training datasets or code generation models',
                  'Frame or embed the Hosted Service to misrepresent its origin',
                  'Circumvent any technical enforcement mechanism',
                ].map((r, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-neutral-400 flex-shrink-0">({String.fromCharCode(97 + i)})</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>

            <SectionBlock title="Section 4 — Intellectual Property Ownership">
              <ClauseList items={[
                ['4.1', 'The Frontend Application and all constituent elements are the sole and exclusive property of the Author.'],
                ['4.2', 'The Visual Design System constitutes protectable trade dress and confidential trade secret information.'],
                ['4.3', 'The white-label theming architecture, including the WhiteLabelContext, heartbeat verification, and CSS variable injection, constitutes a proprietary technical system and trade secret.'],
                ['4.4', 'Any feedback or input you provide is assigned to the Author in full without compensation.'],
                ['4.5', 'Third-party open-source dependency copyrights remain with their respective owners. The Author\'s rights extend to original creative expression in how those dependencies are assembled and used.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Sections 5–11 — Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement, General Provisions">
              <ClauseList items={[
                ['5.1', 'You agree to treat the source code, design decisions, component architecture, and all non-public aspects as strictly confidential and not to disclose any Confidential Information to any third party.'],
                ['6.1–6.2', 'THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW. THE AUTHOR\'S TOTAL LIABILITY SHALL NOT EXCEED USD $100.00.'],
                ['7.1', 'IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.'],
                ['8.1', 'You agree to indemnify and hold harmless the Author from any claims arising from your breach of this Agreement.'],
                ['9.1', 'This Agreement is effective from first access and continues until terminated. Breach results in immediate termination without notice. Upon termination, you must cease all use and permanently delete all copies.'],
                ['10.1', 'The Author is entitled to seek injunctive relief without bond for any unauthorized use.'],
                ['11.1–11.7', 'Governing Law: jurisdiction of the Author\'s residence. Entire Agreement: supersedes all prior agreements. Severability: invalid provisions severed, remainder continues. No assignment without Author\'s written consent. Contact: planit.userhelp@gmail.com.'],
              ]} />
            </SectionBlock>
          </Part>

          {/* PART FOUR */}
          <Part title="Part Four — Backend Application License">
            <p className="text-sm text-neutral-600 leading-relaxed">Governs all access to and use of the PlanIt server-side Node.js/Express application. Covers every .js file in /backend/ and its subdirectories, including all route handlers, data models, middleware, service modules, configuration files, and the proprietary Cryptographic License Key System.</p>

            <SectionBlock title="Section 1 — Definitions">
              <ClauseList items={[
                ['1.1', '"Backend Application" or "Software" — the PlanIt server-side application in its entirety, including the main Express.js server, all route handlers, Mongoose data models, middleware, service modules, the Cryptographic License Key System, the white-label resolution and heartbeat enforcement system, the Socket.IO real-time layer, all configuration files, and all documentation and comments.'],
                ['1.2', '"Author" — Aakshat Hariharan, the sole architect, developer, and intellectual property owner of the Backend Application.'],
                ['1.3', '"You" — any individual or entity interacting with the Backend Application in any way.'],
                ['1.4', '"Cryptographic License System" — the HMAC-SHA256-based license key generation and verification system, including the key format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}, algorithm, domain hash function, expiry encoding, and HMAC construction.'],
                ['1.5', '"Data Models" — all Mongoose schema definitions and associated business logic, constituting trade secrets of the Author.'],
                ['1.6', '"Derivative Work" — any work derived from, reimplementing, or substantially similar to the Backend Application.'],
                ['1.7', '"Deploy" — to execute, run, or host the Backend Application on any computing infrastructure.'],
                ['1.8', '"Commercial Use" — any use in connection with commercial activity.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section 2 — Grant of Limited License">
              <ClauseList items={[
                ['2.1', 'The Author grants you a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access the API Surface through the official frontend only, or as explicitly authorized in writing.'],
                ['2.2', 'No right to Deploy, modify, distribute, or commercially exploit the Backend Application is granted.'],
                ['2.3', 'All rights not expressly granted are reserved.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section 3 — Restrictions on Use">
              <p className="mb-2">Without prior explicit written permission, you must NOT:</p>
              <ul className="space-y-1.5 text-sm text-neutral-700">
                {[
                  'Deploy, execute, or host the Backend Application',
                  'Copy, clone, or reproduce the Backend Application',
                  'Distribute the Backend Application to any third party',
                  'Modify or create any Derivative Work, including reimplementing the Data Models or Cryptographic License System',
                  'Reverse engineer the Cryptographic License System',
                  'Access the API Surface through any means other than the official frontend, except as explicitly authorized',
                  'Conduct Penetration Testing or vulnerability assessment',
                  'Access, extract, or aggregate any user data',
                  'Use source code in ML training datasets',
                  'Circumvent any security mechanism',
                  'Use Data Models as basis for a competing platform',
                  'Use for Commercial Use without written license',
                ].map((r, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-neutral-400 flex-shrink-0">({String.fromCharCode(97 + i)})</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm">Unauthorized direct API access constitutes a breach of this Agreement. Security vulnerability reports must be submitted to <a href="mailto:planit.userhelp@gmail.com" className="hover:text-neutral-900 transition-colors">planit.userhelp@gmail.com</a> without public disclosure.</p>
            </SectionBlock>

            <SectionBlock title="Section 4 — Cryptographic License System">
              <ClauseList items={[
                ['4.1', 'The Cryptographic License System is the Author\'s proprietary invention and most sensitive trade secret.'],
                ['4.2', 'Any attempt to reverse engineer, bypass, spoof, or circumvent it constitutes trade secret misappropriation and potential criminal liability.'],
                ['4.3', 'The WL_LICENSE_SECRET and all related secrets are inaccessible to you under any circumstance.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Section 5 — Data and Privacy">
              <p>Unauthorized access to the Backend Application or its databases constitutes a serious privacy violation and may trigger breach notification obligations under applicable data protection law.</p>
            </SectionBlock>

            <SectionBlock title="Sections 6–11 — IP, Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement, General Provisions">
              <p>The Backend Application and all components are the sole property of the Author. Provided "AS IS" without warranty. The Author's liability is limited to USD $100.00. You agree to indemnify the Author for any breach. The Author may terminate this Agreement immediately upon breach. Injunctive relief is available to the Author without bond. Governing law is the jurisdiction of the Author's residence. You agree to comply with all applicable export control laws and not to use knowledge from this source code to harm the Author, the platform, its users, or any third party.</p>
            </SectionBlock>
          </Part>

          {/* PART FIVE */}
          <Part title="Part Five — Router Service License">
            <p className="text-sm text-neutral-600 leading-relaxed">Governs all access to and use of the PlanIt intelligent HTTP traffic orchestration layer. Covers every source file in /router/, the entire Routing Intelligence, the Mesh Protocol implementation, and all configuration and operational tooling.</p>

            <SectionBlock title="Section 1 — Definitions">
              <ClauseList items={[
                ['1.1', '"Router Service" or "Software" — the PlanIt HTTP routing and orchestration layer in its entirety, including all backend selection algorithms, health-check polling logic, maintenance intercept middleware, CORS management system, mesh authentication protocol, response caching layer, rate limiting configuration, health check aggregation, deploy hook configuration, backend fleet registry, WebSocket proxying configuration, and all documentation and comments.'],
                ['1.2', '"Author" — Aakshat Hariharan, the sole architect and owner.'],
                ['1.3', '"You" — any individual or entity interacting with the Router Service.'],
                ['1.4', '"Routing Intelligence" — the proprietary scoring algorithm, health heuristics, boost mode logic, and all decision-making code — constituting trade secrets of the Author.'],
                ['1.5', '"Mesh Protocol" — the HMAC-based inter-service authentication system.'],
                ['1.6', '"Derivative Work" — any work derived from or reimplementing any portion of the Router Service.'],
                ['1.7', '"Deploy" — to execute or host the Router Service on any infrastructure.'],
                ['1.8', '"Commercial Use" — any use in connection with commercial activity.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Sections 2–3 — License Grant and Restrictions">
              <p>The Author grants a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only. No deployment, modification, distribution, or commercial exploitation right is granted. Without prior written permission, you must NOT deploy or host the Router Service; copy or reproduce it; distribute it; modify or create any Derivative Work including reimplementing the Routing Intelligence; benchmark or reverse engineer the Routing Intelligence for building a competing system; disclose Confidential Information; probe or stress-test the Hosted Infrastructure; forge or bypass Mesh Protocol authentication; use source code in ML training datasets; remove copyright notices; or use for Commercial Use without a written license.</p>
              <p>The Routing Intelligence is classified as Confidential Information and a trade secret. Any attempt to extract or commercialize it constitutes trade secret misappropriation.</p>
            </SectionBlock>

            <SectionBlock title="Section 4 — Routing Intelligence as Trade Secret">
              <ClauseList items={[
                ['4.1', 'The Routing Intelligence constitutes a proprietary system developed through substantial engineering investment. The specific combination of health-check scoring weights, backend alive-state hysteresis logic, boost mode thresholds, and maintenance exemption categorization are not publicly known and provide the Author with a competitive advantage.'],
                ['4.2', 'Your obligation to maintain the confidentiality of the Routing Intelligence survives termination of this Agreement indefinitely.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Sections 5–11 — Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement, General Provisions">
              <p>The Router Service is provided "AS IS" without warranty. The Author's liability is limited to USD $100.00. You agree to indemnify the Author for any breach. The Author may terminate this Agreement immediately upon breach. Injunctive relief is available to the Author without bond. Governing law is the jurisdiction of the Author's residence. You agree not to take any action that could degrade, disrupt, or damage the Hosted Infrastructure or Backend Fleet.</p>
            </SectionBlock>
          </Part>

          {/* PART SIX */}
          <Part title="Part Six — Watchdog Service License">
            <p className="text-sm text-neutral-600 leading-relaxed">Governs all access to and use of the PlanIt autonomous infrastructure monitoring daemon. Covers every source file in /watchdog/, the Monitoring Intelligence, alert routing logic, uptime aggregation system, and all configuration and operational data generated by the Watchdog Service.</p>

            <SectionBlock title="Section 1 — Definitions">
              <ClauseList items={[
                ['1.1', '"Watchdog Service" or "Software" — the PlanIt autonomous monitoring daemon in its entirety, including all health-check polling logic, incident lifecycle management, alert routing and deduplication system, uptime history aggregation, status page data API, mesh-authenticated endpoints, auto-promotion of scheduled maintenance, and all configuration, operational documentation, and comments.'],
                ['1.2', '"Author" — Aakshat Hariharan, the sole designer and owner.'],
                ['1.3', '"You" — any individual or entity interacting with the Watchdog Service.'],
                ['1.4', '"Monitoring Intelligence" — the proprietary heuristics, thresholds, timing parameters, and decision logic governing incident detection, severity classification, alert routing, and uptime aggregation — constituting trade secrets of the Author.'],
                ['1.5', '"Operational Data" — uptime records, incident logs, and alert histories generated during operation, owned exclusively by the Author.'],
                ['1.6', '"Derivative Work" — any monitoring tool derived from the Watchdog.'],
                ['1.7', '"Deploy" — to execute or host the Watchdog Service.'],
                ['1.8', '"Commercial Use" — any use in connection with commercial activity.'],
              ]} />
            </SectionBlock>

            <SectionBlock title="Sections 2–3 — License Grant and Restrictions">
              <p>The Author grants a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only. No deployment, modification, distribution, or commercial exploitation right is granted. Without prior written permission, you must NOT: deploy or operate the Watchdog Service; copy or reproduce it; distribute it; modify or create any Derivative Work including adapting the Monitoring Intelligence; disclose Monitoring Intelligence to any third party; access status API endpoints except through the official status page; interfere with, disable, or circumvent the Watchdog Service; use source code in ML training datasets; remove copyright notices; access, export, or aggregate Operational Data; or use for Commercial Use without a written license.</p>
            </SectionBlock>

            <SectionBlock title="Section 4 — Monitoring Intelligence as Trade Secret">
              <p>The Monitoring Intelligence — polling intervals, failure thresholds, incident severity rules, alert suppression cooldowns, uptime aggregation methodology — constitutes trade secrets developed through operational experience. Your confidentiality obligation survives termination indefinitely.</p>
            </SectionBlock>

            <SectionBlock title="Sections 5–11 — Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement, General Provisions">
              <p>The Watchdog Service is provided "AS IS" without warranty. The Author's liability is limited to USD $100.00. You agree to indemnify the Author for any breach. The Author may terminate this Agreement immediately upon breach. Injunctive relief is available to the Author without bond. Governing law is the jurisdiction of the Author's residence. You agree not to generate false health signals, suppress legitimate alerts, or corrupt monitoring data, and not to flood or abuse the ntfy.sh or Discord alert channels used by the Watchdog Service.</p>
            </SectionBlock>
          </Part>

          {/* PART SEVEN */}
          <Part title="Part Seven — Consolidated Closing Provisions">
            <p className="text-sm text-neutral-600 leading-relaxed">This Master Agreement, together with the four individual component license agreements reproduced in Parts Three through Six above, constitutes the complete and exclusive statement of the intellectual property rights and licensing terms governing the PlanIt platform and all of its components.</p>

            <SectionBlock title="Consolidated Ownership Statement">
              <p>Every line of source code, every design decision, every data model, every algorithm, every configuration file, every comment, and every architectural choice across all four components of the PlanIt platform is the original creative work and exclusive property of Aakshat Hariharan. No co-author, contributor, employer, client, or third party holds any ownership interest in any portion of the PlanIt platform. The Author created this platform independently, owns it outright, and licenses it exclusively on the terms set out above.</p>
            </SectionBlock>

            <SectionBlock title="Summary — What Is and Is Not Permitted">
              <PermissionGrid />
            </SectionBlock>

            <SectionBlock title="Violation Reporting">
              <p>If you become aware of any violation of this Master Agreement or any individual component license — including unauthorized forks, deployments, or distributions of any PlanIt component — please report it to:</p>
              <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm space-y-1">
                <p><span className="font-semibold text-neutral-700">Email:</span> <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-600 hover:text-neutral-900 transition-colors">planit.userhelp@gmail.com</a></p>
                <p><span className="font-semibold text-neutral-700">Subject:</span> License Violation Report</p>
              </div>
              <p className="mt-3">The Author takes intellectual property violations seriously and will pursue all available legal remedies against unauthorized uses of the PlanIt platform.</p>
            </SectionBlock>

            <SectionBlock title="Acknowledgment">
              <p>By accessing any component of the PlanIt platform, you acknowledge that:</p>
              <ol className="mt-2 space-y-1.5 text-sm text-neutral-700 list-none">
                {[
                  'You have read this Master Agreement in its entirety',
                  'You understand its terms',
                  'You agree to be legally bound by all of its provisions',
                  'You have the legal capacity and authority to enter into this Agreement',
                  'If you are accessing on behalf of an organization, you have authority to bind that organization to these terms',
                  'You acknowledge that this Agreement is enforceable against you',
                ].map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-neutral-400 flex-shrink-0">({i + 1})</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </SectionBlock>
          </Part>

          {/* Footer */}
          <div className="border-t border-neutral-200 pt-8 text-center space-y-2">
            <p className="text-sm font-bold text-neutral-900">Copyright © 2026 Aakshat Hariharan. All Rights Reserved.</p>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-lg mx-auto">
              The PlanIt platform is proprietary software. All four components — Frontend, Backend, Router, and Watchdog — are protected by copyright law and trade secret law. Unauthorized use, copying, deployment, or distribution of any component is strictly prohibited and will be vigorously enforced.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-neutral-400">
              <a href="https://planitapp.onrender.com" className="hover:text-neutral-700 transition-colors">https://planitapp.onrender.com</a>
              <span>·</span>
              <a href="mailto:planit.userhelp@gmail.com" className="hover:text-neutral-700 transition-colors">planit.userhelp@gmail.com</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
