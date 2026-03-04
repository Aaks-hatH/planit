import { useState, useEffect, useRef } from 'react';
import { getUserTimezone, localDateTimeToUTC, getTimezoneOptions } from '../utils/timezoneUtils';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock,
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Zap, Clock,
  CheckCircle2, TrendingUp, ListChecks, Timer,
  Brain, ArrowUpRight, AlertCircle, UtensilsCrossed, MapPin, QrCode, Layers
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

/*
PLANIT SOFTWARE LICENSE AGREEMENT
Copyright (c) 2026 Aakshat Hariharan. All rights reserved.

PLEASE READ THIS LICENSE AGREEMENT CAREFULLY BEFORE ACCESSING, VIEWING,
OR USING THIS SOFTWARE. BY ACCESSING THE REPOSITORY, VIEWING THE SOURCE
CODE, OR USING THE HOSTED SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ
THIS AGREEMENT, UNDERSTAND IT, AND AGREE TO BE BOUND BY ITS TERMS. IF
YOU DO NOT AGREE TO THESE TERMS, YOU MUST IMMEDIATELY CEASE ALL ACCESS
TO AND USE OF THIS SOFTWARE.

================================================================================
SECTION 1 -- DEFINITIONS
================================================================================

1.1  "Software" means the PlanIt application in its entirety, including but
     not limited to all source code, object code, compiled binaries, scripts,
     configuration files, database schemas, API definitions, frontend
     components, backend services, routing infrastructure, watchdog services,
     documentation, design assets, visual layouts, user interface elements,
     architectural decisions, and all related materials made available in this
     repository or through the hosted service.

1.2  "Author" means Aakshat Hariharan, the sole creator and owner of the
     Software and all intellectual property rights therein.

1.3  "You" or "Licensee" means any individual, organization, company,
     partnership, or other legal entity that accesses, views, downloads,
     copies, or otherwise interacts with the Software or any portion thereof.

1.4  "Hosted Service" means the publicly accessible deployment of the
     Software operated by the Author at planitapp.onrender.com and any
     associated domains or subdomains.

1.5  "Derivative Work" means any work, software, product, service, or
     creation that is based on, derived from, substantially similar to,
     inspired by, or incorporates any portion of the Software, including
     works that replicate the design, architecture, functionality, or
     user experience of the Software in any form.

1.6  "Commercial Use" means any use of the Software or any portion thereof
     in connection with any activity intended to generate revenue, profit,
     or other financial or commercial benefit, whether directly or indirectly.

1.7  "Distribute" means to make available, publish, transmit, share,
     sublicense, sell, rent, lease, lend, or otherwise transfer the Software
     or any portion thereof to any third party by any means.

1.8  "Deploy" means to install, run, host, execute, or operate the Software
     or any portion thereof on any server, device, infrastructure, cloud
     platform, virtual machine, container, or computing environment.

================================================================================
SECTION 2 -- GRANT OF LIMITED LICENSE
================================================================================

2.1  Subject to the terms and conditions of this Agreement, the Author
     hereby grants You a limited, non-exclusive, non-transferable,
     non-sublicensable, revocable license to:

     (a) View the source code of the Software solely for personal,
         non-commercial educational and reference purposes; and

     (b) Access and use the Hosted Service for its intended purpose of
         event planning, subject to the Terms of Service of the Hosted
         Service.

2.2  This license does not grant You any rights to the Software except
     as expressly set forth in Section 2.1. All rights not expressly
     granted herein are reserved by the Author.

2.3  The Author reserves the right to revoke this limited license at any
     time, for any reason or no reason, upon notice or without notice.

2.4  Making the repository publicly accessible does not, under any
     circumstances, constitute a grant of any rights beyond those expressly
     set forth in Section 2.1, nor does it constitute a dedication of the
     Software to the public domain.

================================================================================
SECTION 3 -- RESTRICTIONS
================================================================================

3.1  You expressly agree that You will NOT, without prior explicit written
     permission from the Author:

     (a) Copy, clone, fork, mirror, scrape, or otherwise reproduce the
         Software or any portion thereof, in whole or in part, in any
         medium or format, whether digital or physical;

     (b) Deploy, host, run, or execute the Software or any portion thereof
         on any server, device, or infrastructure other than the Author's
         official Hosted Service;

     (c) Distribute, sublicense, sell, rent, lease, transfer, publish,
         or otherwise make the Software or any portion thereof available
         to any third party in any form;

     (d) Modify, adapt, translate, reverse engineer, decompile, disassemble,
         or attempt to derive the source code of any compiled portion of
         the Software;

     (e) Create any Derivative Work based on or substantially similar to
         the Software, including recreating its functionality, architecture,
         design, or user experience in any other codebase or product;

     (f) Use the Software or any portion of its source code, design,
         architecture, or functionality as the basis for any competing
         product or service, whether commercial or non-commercial;

     (g) Use the Software for any Commercial Use without a separately
         negotiated commercial license agreement executed in writing by
         the Author;

     (h) Remove, alter, obscure, or replace any copyright notices, license
         notices, proprietary markings, or attribution notices contained
         in or accompanying the Software;

     (i) Use the name "PlanIt", the PlanIt logo, or the name "Aakshat
         Hariharan" in connection with any product, service, or
         organization in a manner that suggests endorsement, affiliation,
         or sponsorship without prior written permission from the Author;

     (j) Use the Software in any manner that violates any applicable local,
         state, national, or international law or regulation;

     (k) Circumvent, disable, or interfere with any technical measures
         implemented in the Software to enforce the terms of this license,
         including but not limited to the cryptographic license integrity
         verification system embedded in the Software's backend;

     (l) Access the Software's backend services, APIs, or database
         infrastructure through any means other than the official Hosted
         Service's user interface, except as explicitly authorized by
         the Author in writing;

     (m) Use any automated tools, bots, scrapers, or scripts to access,
         download, or index the Software's source code or the Hosted
         Service's content at scale.

3.2  The restrictions set forth in Section 3.1 apply regardless of whether
     Your intended use is personal, educational, academic, commercial,
     non-profit, or for any other purpose.

3.3  The restrictions set forth in this Agreement apply to the Software
     as a whole and to any portion, excerpt, component, module, or file
     thereof, no matter how small.

================================================================================
SECTION 4 -- INTELLECTUAL PROPERTY OWNERSHIP
================================================================================

4.1  The Software and all copies, modifications, and Derivative Works
     thereof, and all intellectual property rights therein, including
     without limitation all copyrights, patents, trade secrets, trademarks,
     and other proprietary rights, are and shall remain the exclusive
     property of the Author.

4.2  Nothing in this Agreement shall be construed to transfer, assign, or
     convey to You any ownership interest in the Software or any intellectual
     property rights therein.

4.3  The design, architecture, visual appearance, user experience, and
     functionality of the Software are trade secrets and confidential
     information of the Author, and You agree to treat them as such.

4.4  Any feedback, suggestions, bug reports, or contributions You provide
     to the Author regarding the Software shall be the sole and exclusive
     property of the Author, and You hereby assign to the Author all
     rights in such feedback without any obligation of compensation or
     attribution to You.

4.5  You acknowledge that the Software embodies substantial creative effort
     and investment by the Author, and that unauthorized use or copying
     would cause irreparable harm to the Author for which monetary damages
     would be inadequate.

================================================================================
SECTION 5 -- TECHNICAL ENFORCEMENT
================================================================================

5.1  The Software includes a cryptographic license integrity verification
     system that runs at server startup and periodically during operation.
     This system uses HMAC proof chains derived from a deployment-specific
     license key to verify that each running instance of the Software is
     an authorized deployment.

5.2  Any attempt to tamper with, circumvent, disable, or bypass this
     verification system constitutes a material breach of this Agreement
     and may also constitute a violation of applicable computer fraud and
     abuse laws.

5.3  Unauthorized deployments will fail to start or will terminate
     automatically. The Author reserves the right to implement additional
     technical measures to prevent unauthorized use at any time.

================================================================================
SECTION 6 -- CONFIDENTIALITY
================================================================================

6.1  You acknowledge that the Software contains confidential and proprietary
     information belonging to the Author, including but not limited to
     source code, algorithms, data structures, database schemas, security
     implementations, and architectural design.

6.2  You agree to maintain the confidentiality of the Software and not to
     disclose, publish, or share any non-public portions of the Software
     with any third party without the Author's prior written consent.

6.3  You agree to take reasonable precautions to prevent unauthorized
     access to or disclosure of the Software, using at least the same
     degree of care You use to protect Your own confidential information,
     but in no event less than reasonable care.

================================================================================
SECTION 7 -- DISCLAIMER OF WARRANTIES
================================================================================

7.1  THE SOFTWARE AND THE HOSTED SERVICE ARE PROVIDED "AS IS" AND "AS
     AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

7.2  THE AUTHOR EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT
     LIMITED TO: (A) ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
     FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT; (B) ANY
     WARRANTIES THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR
     FREE OF HARMFUL COMPONENTS; (C) ANY WARRANTIES REGARDING THE ACCURACY,
     RELIABILITY, OR COMPLETENESS OF THE SOFTWARE OR ANY CONTENT THEREIN;
     AND (D) ANY WARRANTIES ARISING FROM COURSE OF DEALING, COURSE OF
     PERFORMANCE, OR USAGE OF TRADE.

7.3  YOU ASSUME ALL RISK ARISING FROM YOUR ACCESS TO AND USE OF THE
     SOFTWARE AND THE HOSTED SERVICE.

================================================================================
SECTION 8 -- LIMITATION OF LIABILITY
================================================================================

8.1  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
     THE AUTHOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
     CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
     OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION,
     OR ANY OTHER COMMERCIAL DAMAGES OR LOSSES, ARISING OUT OF OR RELATED
     TO THIS AGREEMENT OR YOUR USE OF OR INABILITY TO USE THE SOFTWARE,
     EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

8.2  THE AUTHOR'S TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY AND ALL CLAIMS
     ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE
     GREATER OF (A) THE AMOUNT YOU PAID TO THE AUTHOR IN THE TWELVE MONTHS
     PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS (USD $100.00).

================================================================================
SECTION 9 -- INDEMNIFICATION
================================================================================

9.1  You agree to indemnify, defend, and hold harmless the Author from and
     against any and all claims, damages, losses, liabilities, costs, and
     expenses (including reasonable attorneys' fees) arising out of or
     related to: (a) Your breach of this Agreement; (b) Your use of or
     access to the Software in violation of this Agreement; (c) Your
     violation of any applicable law or regulation; or (d) Your
     infringement of any third-party rights.

================================================================================
SECTION 10 -- TERMINATION
================================================================================

10.1 This Agreement and the license granted herein are effective until
     terminated. The Author may terminate this Agreement and the license
     immediately and without notice if You breach any term of this Agreement.

10.2 Upon termination of this Agreement for any reason: (a) all rights
     granted to You hereunder shall immediately terminate; (b) You must
     immediately cease all use of and access to the Software; (c) You must
     immediately destroy all copies of the Software in Your possession
     or control; and (d) You must certify in writing to the Author that
     You have complied with the foregoing obligations upon request.

10.3 Termination of this Agreement shall not limit the Author's rights
     or remedies at law or in equity. Sections 1, 3, 4, 6, 7, 8, 9,
     10, 11, and 12 shall survive termination of this Agreement.

================================================================================
SECTION 11 -- ENFORCEMENT AND REMEDIES
================================================================================

11.1 You acknowledge that any breach of this Agreement would cause
     irreparable harm to the Author for which monetary damages would be
     an inadequate remedy, and that the Author shall be entitled to seek
     equitable relief, including injunctive relief and specific performance,
     in addition to all other remedies available at law or in equity,
     without the requirement of posting a bond or other security.

11.2 The Author reserves the right to pursue all available legal and
     equitable remedies for violations of this Agreement, including but
     not limited to injunctive relief, damages, disgorgement of profits,
     attorneys' fees, and court costs.

11.3 The failure of the Author to enforce any provision of this Agreement
     shall not constitute a waiver of the Author's right to enforce that
     provision or any other provision in the future.

================================================================================
SECTION 12 -- GENERAL PROVISIONS
================================================================================

12.1 Governing Law. This Agreement shall be governed by and construed in
     accordance with the laws of the jurisdiction in which the Author
     resides, without regard to its conflict of law provisions.

12.2 Entire Agreement. This Agreement constitutes the entire agreement
     between You and the Author with respect to the subject matter hereof
     and supersedes all prior or contemporaneous agreements, representations,
     warranties, and understandings with respect to the Software.

12.3 Severability. If any provision of this Agreement is held to be
     invalid, illegal, or unenforceable, the remaining provisions shall
     continue in full force and effect, and the invalid, illegal, or
     unenforceable provision shall be modified to the minimum extent
     necessary to make it valid, legal, and enforceable.

12.4 No Waiver. No waiver by the Author of any breach of this Agreement
     shall be deemed a waiver of any subsequent breach of the same or any
     other provision.

12.5 Assignment. You may not assign or transfer this Agreement or any
     rights or obligations hereunder, in whole or in part, without the
     Author's prior written consent. Any purported assignment without such
     consent shall be null and void. The Author may assign this Agreement
     freely without restriction.

12.6 Contact. For licensing inquiries, permission requests, or to report
     violations of this Agreement, contact the Author through the official
     support page at planitapp.onrender.com or planit.userhelp@gmail.com

================================================================================

Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
*/

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
}
function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  return `${slug}-${Math.random().toString(36).substring(2, 6)}`;
}

function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function AnimatedCounter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useScrollReveal(0.1);
  useEffect(() => {
    if (!visible) return;
    let startTime, raf;
    const animate = (ts) => {
      if (!startTime) startTime = ts;
      const pct = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(end * pct));
      if (pct < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [visible, end, duration]);
  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}

function CopyLinkBox({ eventId, subdomain }) {
  const [copied, setCopied] = useState(false);
  const link = subdomain ? `${window.location.origin}/e/${subdomain}` : `${window.location.origin}/event/${eventId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true); toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-2xl border border-neutral-700 overflow-hidden bg-neutral-900 hover:border-neutral-600 transition-all duration-300">
      <div className="flex items-center gap-3 px-5 py-4">
        <Link className="w-4 h-4 text-neutral-500 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-300 font-mono truncate">{link}</span>
        <button onClick={handleCopy} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-neutral-900 hover:bg-neutral-100'}`}>
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`${className} transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <Reveal className="text-center mb-16">
      {eyebrow && <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">{eyebrow}</p>}
      <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-5 leading-tight">{title}</h2>
      {subtitle && <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </Reveal>
  );
}

function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="group relative p-6 sm:p-10 rounded-3xl border border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all duration-500 h-full">
        <div className="mb-5">
          <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center group-hover:bg-white transition-all duration-500 group-hover:scale-110">
            <Icon className="w-7 h-7 text-neutral-400 group-hover:text-neutral-900 transition-colors duration-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
      </div>
    </Reveal>
  );
}

function TestimonialCard({ quote, author, role, event, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-500 h-full">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
            <span className="text-base font-bold text-neutral-900">{author.charAt(0)}</span>
          </div>
          <div>
            <p className="text-base font-semibold text-white">{author}</p>
            <p className="text-xs text-neutral-500">{role}</p>
            <p className="text-xs text-neutral-600 mt-0.5">{event}</p>
          </div>
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed mb-4">"{quote}"</p>

      </div>
    </Reveal>
  );
}


// ─────────────────────────────────────────────
// ENTERPRISE INTERACTIVE DEMO
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ENTERPRISE INTERACTIVE DEMO
// ─────────────────────────────────────────────

const DEMO_GUESTS = [
  { id: 1, name: 'Sarah Johnson',   group: 4, table: 12, code: 'SJ4A-X9', role: 'VIP',      status: 'normal' },
  { id: 2, name: 'Marcus Rivera',   group: 2, table: 5,  code: 'MR2B-K3', role: 'Speaker',  status: 'normal' },
  { id: 3, name: 'Priya Sharma',    group: 1, table: 8,  code: 'PS1C-M7', role: 'Attendee', status: 'normal' },
  { id: 4, name: 'Tom & Lisa Chen', group: 2, table: 3,  code: 'TC2D-R1', role: 'Sponsor',  status: 'normal' },
  { id: 5, name: 'Dev Patel',       group: 6, table: 15, code: 'DP6E-N5', role: 'Attendee', status: 'blocked',  blockReason: 'Duplicate identity — another invite with same email already checked in' },
  { id: 6, name: 'Amara Okafor',    group: 1, table: 7,  code: 'AO1F-Q2', role: 'Attendee', status: 'flagged',  flagReason: 'Low trust score: 42/100 — scanned from 3 different devices' },
];

function QRPattern({ code, size = 40, faded = false }) {
  const cells = 10;
  const hash = code.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: `repeat(${cells}, 1fr)`, gap: 1, padding: 3, background: faded ? '#333' : 'white', borderRadius: 6, opacity: faded ? 0.4 : 1 }}>
      {Array.from({ length: cells * cells }, (_, i) => {
        const filled = ((hash * (i + 13) * 1103515245 + 12345) & 0x7fffffff) % 3 !== 0;
        return <div key={i} style={{ background: filled ? (faded ? '#888' : '#111') : (faded ? '#333' : 'white'), borderRadius: 1 }} />;
      })}
    </div>
  );
}

function EnterpriseDemo() {
  const [tab, setTab] = useState('guests');
  const [guests, setGuests] = useState(DEMO_GUESTS.map(g => ({ ...g, checkedIn: false, checking: false, checkedAt: null, scanCount: 0 })));
  const [scanning, setScanning] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [securityLog, setSecurityLog] = useState([]);
  const [overrideTarget, setOverrideTarget] = useState(null); // guest being overridden
  const [overridePin, setOverridePin] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const checkedInCount = guests.filter(g => g.checkedIn).length;
  const totalGuests = guests.reduce((s, g) => s + g.group, 0);
  const checkedInPeople = guests.filter(g => g.checkedIn).reduce((s, g) => s + g.group, 0);
  const pct = Math.round((checkedInPeople / totalGuests) * 100);

  const addLog = (entry) => setSecurityLog(prev => [{ ...entry, id: Date.now() + Math.random(), ts: new Date() }, ...prev].slice(0, 20));

  const handleCheckIn = (guest) => {
    if (scanning) return;

    // Already checked in → duplicate attempt
    if (guest.checkedIn) {
      addLog({ type: 'duplicate', severity: 'high', name: guest.name, msg: `Duplicate scan — ${guest.name} already checked in at ${guest.checkedAt?.toLocaleTimeString()}` });
      return;
    }

    // Blocked guest
    if (guest.status === 'blocked') {
      addLog({ type: 'blocked', severity: 'critical', name: guest.name, msg: `BLOCKED: ${guest.name} — ${guest.blockReason}` });
      setOverrideTarget(guest);
      return;
    }

    // Flagged guest
    if (guest.status === 'flagged') {
      addLog({ type: 'flagged', severity: 'high', name: guest.name, msg: `WARNING: ${guest.name} — ${guest.flagReason}` });
      setOverrideTarget(guest);
      return;
    }

    // Normal check-in
    setScanning(guest.id);
    setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checking: true, scanCount: g.scanCount + 1 } : g));
    setTimeout(() => {
      const now = new Date();
      setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checkedIn: true, checking: false, checkedAt: now } : g));
      setLastChecked(guest.id);
      setScanning(null);
      addLog({ type: 'success', severity: 'ok', name: guest.name, msg: `Checked in: ${guest.name} — party of ${guest.group}, table ${guest.table}` });
      setTimeout(() => setLastChecked(null), 2500);
    }, 900);
  };

  const handleOverride = () => {
    if (overridePin !== '1234') {
      setOverrideError('Wrong PIN. Try 1234 for this demo.');
      return;
    }
    setOverrideError('');
    setOverrideSuccess(true);
    const target = overrideTarget;
    setTimeout(() => {
      const now = new Date();
      setGuests(prev => prev.map(g => g.id === target.id ? { ...g, checkedIn: true, checking: false, checkedAt: now, status: 'normal' } : g));
      addLog({ type: 'override', severity: 'medium', name: target.name, msg: `Manager override approved — ${target.name} manually checked in` });
      setOverrideTarget(null);
      setOverridePin('');
      setOverrideSuccess(false);
    }, 1000);
  };

  const simulateUnauthorized = () => {
    if (simulating) return;
    setSimulating(true);
    const fakeCodes = ['XX99-ZZ', 'FAKE-001', 'HACK-123'];
    const code = fakeCodes[Math.floor(Math.random() * fakeCodes.length)];
    addLog({ type: 'unauthorized', severity: 'critical', name: 'Unknown', msg: `UNAUTHORIZED: Code "${code}" not found — possible forged ticket` });
    setTimeout(() => {
      addLog({ type: 'ratelimit', severity: 'medium', name: 'System', msg: `Rate limit triggered — IP blocked for 60s after 3 failed attempts` });
      setSimulating(false);
    }, 1200);
    if (tab !== 'security') setTab('security');
  };

  const handleReset = () => {
    setGuests(DEMO_GUESTS.map(g => ({ ...g, checkedIn: false, checking: false, checkedAt: null, scanCount: 0 })));
    setSecurityLog([]);
    setLastChecked(null);
    setScanning(null);
    setOverrideTarget(null);
    setOverridePin('');
    setOverrideError('');
  };

  const roleColors = {
    VIP: 'text-amber-400 bg-amber-400/10',
    Speaker: 'text-blue-400 bg-blue-400/10',
    Sponsor: 'text-purple-400 bg-purple-400/10',
    Attendee: 'text-neutral-400 bg-neutral-800',
  };
  const logColors = {
    ok: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/20',
    high: 'text-amber-400 border-amber-800/40 bg-amber-950/20',
    critical: 'text-red-400 border-red-800/40 bg-red-950/20',
    medium: 'text-blue-400 border-blue-800/40 bg-blue-950/20',
  };
  const logIcons = { success: '+', duplicate: '!', blocked: 'x', flagged: '!', unauthorized: 'x', override: 'o', ratelimit: '-' };

  return (
    <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 overflow-hidden">

      {/* Manager override modal */}
      {overrideTarget && !overrideSuccess && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 24 }}>
          <div className="w-full max-w-xs mx-4 bg-neutral-900 rounded-2xl border border-neutral-700 p-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 ${overrideTarget.status === 'blocked' ? 'bg-red-950/50 border border-red-800/50 text-red-400' : 'bg-amber-950/50 border border-amber-800/50 text-amber-400'}`}>
              {overrideTarget.status === 'blocked' ? 'Guest Blocked' : 'Guest Flagged'}
            </div>
            <p className="text-sm font-bold text-white mb-1">{overrideTarget.name}</p>
            <p className="text-xs text-neutral-500 mb-4">{overrideTarget.blockReason || overrideTarget.flagReason}</p>
            <p className="text-xs font-bold text-neutral-400 mb-2">Manager PIN required to override</p>
            <input
              type="password"
              maxLength={4}
              value={overridePin}
              onChange={e => { setOverridePin(e.target.value); setOverrideError(''); }}
              placeholder="Enter PIN (hint: 1234)"
              className="dark-input text-center text-lg font-mono tracking-widest mb-2"
              autoFocus
            />
            {overrideError && <p className="text-xs text-red-400 mb-2">{overrideError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setOverrideTarget(null); setOverridePin(''); setOverrideError(''); }}
                className="flex-1 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-all">
                Cancel
              </button>
              <button onClick={handleOverride}
                className="flex-1 py-2 text-xs font-bold text-white bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all">
                Override
              </button>
            </div>
          </div>
        </div>
      )}
      {overrideTarget && overrideSuccess && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 24 }}>
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
              <Check className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-bold text-emerald-400">Override approved</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-5 pb-0" style={{ position: 'relative' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-400 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live Check-in Demo
            </div>
            <h3 className="text-sm font-bold text-white">Tech Summit 2025</h3>
            <p className="text-xs text-neutral-500">{DEMO_GUESTS.length} invites · {totalGuests} guests</p>
          </div>
          <div className="relative w-12 h-12 flex-shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="18" fill="none" stroke="#262626" strokeWidth="4" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#10b981" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - pct / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-white">{pct}%</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-800">
          {['guests', 'security', 'analytics'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-bold capitalize transition-all duration-200 border-b-2 -mb-px flex items-center gap-1.5 ${tab === t ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
              {t === 'security' && securityLog.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-black" style={{ fontSize: 9 }}>
                  {securityLog.filter(l => l.severity === 'critical' || l.severity === 'high').length}
                </span>
              )}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* GUESTS TAB */}
      {tab === 'guests' && (
        <div className="p-3" style={{ minHeight: 280, maxHeight: 360, overflowY: 'auto' }}>
          <div className="space-y-2">
            {guests.map(guest => {
              const isBlocked = guest.status === 'blocked' && !guest.checkedIn;
              const isFlagged = guest.status === 'flagged' && !guest.checkedIn;
              return (
                <div key={guest.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                    guest.checkedIn  ? 'border-emerald-800/50 bg-emerald-950/30' :
                    guest.checking   ? 'border-neutral-600 bg-neutral-800/80' :
                    isBlocked        ? 'border-red-900/60 bg-red-950/20' :
                    isFlagged        ? 'border-amber-900/50 bg-amber-950/15' :
                    'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                  }`}>

                  {/* QR / status icon */}
                  <div className="flex-shrink-0">
                    {guest.checking ? (
                      <div className="w-10 h-10 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : guest.checkedIn ? (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : isBlocked ? (
                      <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-900/50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-400" />
                      </div>
                    ) : isFlagged ? (
                      <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-900/50 flex items-center justify-center">
                        <span className="text-amber-400 font-black text-xs">FLAG</span>
                      </div>
                    ) : (
                      <QRPattern code={guest.code} size={40} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{guest.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${roleColors[guest.role]}`}>{guest.role}</span>
                      {isBlocked && <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-red-950/60 text-red-400 border border-red-900/40">BLOCKED</span>}
                      {isFlagged && <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-amber-950/50 text-amber-400 border border-amber-900/40">FLAGGED</span>}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">
                      {guest.checkedIn
                        ? `Checked in · Party of ${guest.group} · Table ${guest.table}`
                        : isBlocked ? guest.blockReason
                        : isFlagged ? guest.flagReason
                        : `Party of ${guest.group} · Table ${guest.table}`}
                    </p>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => handleCheckIn(guest)}
                    disabled={!!scanning}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      guest.checkedIn   ? 'bg-emerald-950/40 text-emerald-600 cursor-default' :
                      scanning === guest.id ? 'bg-neutral-700 text-neutral-400 cursor-wait' :
                      scanning          ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' :
                      isBlocked         ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-900/40' :
                      isFlagged         ? 'bg-amber-950/50 text-amber-400 border border-amber-900/40 hover:bg-amber-900/40' :
                      'bg-white text-neutral-900 hover:bg-neutral-100 hover:scale-105 active:scale-95'
                    }`}>
                    {guest.checkedIn ? 'Done' : scanning === guest.id ? '…' : isBlocked ? 'Blocked' : isFlagged ? 'Review' : 'Scan'}
                  </button>

                  {lastChecked === guest.id && (
                    <span className="flex-shrink-0 text-xs text-emerald-400 font-bold animate-pulse">In!</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Simulate unauthorized */}
          <div className="mt-3 p-3 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/30">
            <p className="text-xs text-neutral-600 mb-2 font-medium">Simulate security scenarios:</p>
            <div className="flex gap-2">
              <button onClick={simulateUnauthorized} disabled={simulating}
                className="flex-1 py-1.5 text-xs font-bold text-red-400 border border-red-900/50 rounded-xl bg-red-950/20 hover:bg-red-950/40 transition-all disabled:opacity-40">
                {simulating ? 'Scanning…' : 'Try forged ticket'}
              </button>
              {(checkedInCount > 0 || securityLog.length > 0) && (
                <button onClick={handleReset} className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-400 border border-neutral-800 rounded-xl transition-colors">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {tab === 'security' && (
        <div className="p-4" style={{ minHeight: 280, maxHeight: 360, overflowY: 'auto' }}>
          {/* Security overview badges */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Blocked', count: guests.filter(g => g.status === 'blocked' && !g.checkedIn).length, color: 'text-red-400', bg: 'bg-red-950/30 border-red-900/40' },
              { label: 'Flagged', count: guests.filter(g => g.status === 'flagged' && !g.checkedIn).length, color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-900/40' },
              { label: 'Alerts', count: securityLog.filter(l => l.severity !== 'ok').length, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-900/40' },
            ].map(s => (
              <div key={s.label} className={`text-center p-2.5 rounded-xl border ${s.bg}`}>
                <div className={`text-xl font-black tabular-nums ${s.color}`}>{s.count}</div>
                <div className="text-xs text-neutral-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Security features list */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest">Active protections</p>
            {[
              { icon: 'X', label: 'Duplicate detection', desc: 'Flags same identity across multiple invites', active: true, color: 'text-emerald-400' },
              { icon: '-', label: 'Rate limiting', desc: '3 failed scans → 60s IP lockout', active: true, color: 'text-emerald-400' },
              { icon: '!', label: 'Trust scoring', desc: 'Flags low-trust guests for manual review', active: true, color: 'text-emerald-400' },
              { icon: 'O', label: 'Manager override', desc: 'PIN-protected override for blocked guests', active: true, color: 'text-emerald-400' },
              { icon: 'Q', label: 'QR forgery detection', desc: 'Rejects codes not in guest registry', active: true, color: 'text-emerald-400' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-neutral-900/40 rounded-xl border border-neutral-800">
                <span className={`text-sm font-black flex-shrink-0 mt-0.5 ${f.color}`}>{f.icon}</span>
                <div>
                  <p className="text-xs font-bold text-white">{f.label}</p>
                  <p className="text-xs text-neutral-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live log */}
          <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest mb-2">Security log</p>
          {securityLog.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-neutral-700">No events yet.</p>
              <p className="text-xs text-neutral-700 mt-1">Go to Guests → try scanning blocked/flagged guests or a forged ticket.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {securityLog.map(entry => (
                <div key={entry.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs ${logColors[entry.severity]}`}>
                  <span className="font-black flex-shrink-0 mt-0.5">{logIcons[entry.type] || '·'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug">{entry.msg}</p>
                    <p className="opacity-50 mt-0.5">{entry.ts.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="p-4" style={{ minHeight: 280, maxHeight: 360, overflowY: 'auto' }}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Arrived',  value: checkedInPeople, color: 'text-emerald-400' },
              { label: 'Pending',  value: totalGuests - checkedInPeople, color: 'text-amber-400' },
              { label: 'Checked',  value: checkedInCount, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-neutral-900 rounded-2xl border border-neutral-800">
                <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest mb-3">Guest breakdown</p>
          <div className="space-y-2.5 mb-4">
            {guests.map(g => (
              <div key={g.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-neutral-400 truncate">{g.name}</span>
                  <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">
                    {g.checkedIn ? `${g.group}/${g.group}` : `0/${g.group}`}
                  </span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    g.checkedIn ? 'bg-emerald-500' :
                    g.checking  ? 'bg-neutral-600' :
                    g.status === 'blocked' ? 'bg-red-800' :
                    g.status === 'flagged' ? 'bg-amber-800' : 'bg-neutral-700'
                  }`} style={{ width: g.checkedIn ? '100%' : g.checking ? '45%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-neutral-900 rounded-2xl border border-neutral-800">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold text-neutral-400">Overall attendance</span>
              <span className="text-xs font-black text-white">{pct}%</span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-neutral-600 mt-2">{checkedInPeople} of {totalGuests} guests arrived</p>
          </div>

          {checkedInCount === 0 && (
            <p className="text-center text-xs text-neutral-600 mt-4">← Switch to Guests and start checking people in</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '', title: '', description: '', date: '', timezone: getUserTimezone(), location: '',
    organizerName: '', organizerEmail: '', accountPassword: '', password: '',
    isEnterpriseMode: false, maxParticipants: 10000,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({ ...prev, title, subdomain: prev._subdomainTouched ? prev.subdomain : makeSubdomain(title) }));
  };
  const update = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value, ...(field === 'subdomain' ? { _subdomainTouched: true } : {}) }));

  // Sanitise a string: trim whitespace, collapse internal whitespace
  const sanitize = (str) => (str || '').trim().replace(/\s+/g, ' ');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Client-side field validation ──────────────────────────────────────
    const errs = {};
    if (!formData.title.trim())            errs.title          = 'Event title is required.';
    if (!formData.date)                    errs.date           = 'Date and time is required.';
    if (!formData.timezone)                errs.timezone       = 'Timezone is required.';
    if (!formData.organizerName.trim())    errs.organizerName  = 'Your name is required.';
    if (!formData.organizerEmail.trim())   errs.organizerEmail = 'Your email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.organizerEmail.trim()))
                                           errs.organizerEmail = 'Please enter a valid email address.';
    if (!formData.accountPassword)         errs.accountPassword = 'Account password is required.';
    else if (formData.accountPassword.length < 4)
                                           errs.accountPassword = 'Password must be at least 4 characters.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Scroll to first error
      const firstField = document.querySelector('.field-error');
      if (firstField) firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const dateValue = formData.date ? localDateTimeToUTC(formData.date, formData.timezone) : formData.date;
    const payload = {
      title:          sanitize(formData.title),
      description:    sanitize(formData.description),
      date:           dateValue,
      timezone:       formData.timezone,
      location:       sanitize(formData.location),
      organizerName:  sanitize(formData.organizerName),
      organizerEmail: sanitize(formData.organizerEmail),
      accountPassword:formData.accountPassword,
      password:       formData.password || undefined,
      subdomain:      formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise',
      isTableServiceMode: mode === 'table-service',
      maxParticipants: formData.maxParticipants,
    };
    try {
      const response = await eventAPI.create(payload);
      localStorage.setItem('eventToken', response.data.token);
      localStorage.setItem('username', sanitize(formData.organizerName));
      setCreated(response.data.event);
    } catch (error) {
      const data = error.response?.data;

      // Friendly labels for server field paths
      const FIELD_LABELS = {
        date:            'Date and time',
        timezone:        'Timezone',
        title:           mode === 'table-service' ? 'Restaurant name' : 'Event title',
        organizerName:   mode === 'table-service' ? 'Manager name' : 'Your name',
        organizerEmail:  mode === 'table-service' ? 'Manager email' : 'Your email',
        accountPassword: 'Account password',
        password:        mode === 'table-service' ? 'Staff PIN' : 'Event password',
        subdomain:       mode === 'table-service' ? 'Restaurant URL' : 'Event URL',
      };

      if (data?.errors && Array.isArray(data.errors)) {
        const serverErrs = {};
        const toastMsgs = [];
        data.errors.forEach(e => {
          const path = e.path || e.param || '';
          const label = FIELD_LABELS[path] || path;
          const msg = e.msg || e.message || 'Invalid value';
          // Skip date errors entirely for table-service (shouldn't reach here but safety net)
          if (path === 'date' && mode === 'table-service') return;
          serverErrs[path] = `${label}: ${msg}`;
          toastMsgs.push(`${label} — ${msg}`);
        });
        setFieldErrors(serverErrs);
        if (toastMsgs.length === 1) {
          toast.error(toastMsgs[0]);
        } else if (toastMsgs.length > 1) {
          toast.error(`${toastMsgs.length} fields need attention:\n${toastMsgs.map(m => `• ${m}`).join('\n')}`, { duration: 6000 });
        }
      } else {
        const msg = data?.error || 'Failed to create';
        if (msg.includes('already taken')) {
          setFieldErrors({ subdomain: 'This URL is already taken — try a different name.' });
          toast.error('That URL is already in use. We\'ve generated a new one — feel free to customise it.');
          setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title) }));
        } else if (msg.includes('email')) {
          toast.error('Please enter a valid email address.');
        } else if (msg.includes('password')) {
          toast.error('Password must be at least 6 characters.');
        } else {
          toast.error(msg || 'Something went wrong. Please check your details and try again.');
        }
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#07070e', overflowX: 'clip', maxWidth: '100vw', isolation: 'isolate' }}>
      <style>{`
        /* ── Shimmer text ──────────────────────────────────────── */
        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .shimmer-white {
          background: linear-gradient(90deg, #94a3b8 15%, #ffffff 42%, #94a3b8 68%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 4s ease-in-out infinite;
        }
        .shimmer-slate {
          background: linear-gradient(120deg, #64748b 0%, #cbd5e1 48%, #64748b 90%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 5s ease-in-out infinite;
        }
        /* ── Scan-line sweep on stat cards ──────────────────────── */
        @keyframes scan-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%);  }
        }
        .stat-card { position: relative; overflow: hidden; }
        .stat-card::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%);
          transform: translateX(-120%);
          animation: scan-sweep 5s ease-in-out infinite;
          pointer-events: none;
        }
        .stat-card:nth-child(2)::after { animation-delay: 1.6s; }
        .stat-card:nth-child(3)::after { animation-delay: 3.2s; }
        /* ── Input styles ────────────────────────────────────────── */
        .dark-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(15,15,25,0.8);
          border: 1px solid #334155;
          border-radius: 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .dark-input:focus { border-color: #64748b; }
        .dark-input::placeholder { color: #475569; }
        .dark-input option { background: #0f172a; color: white; }
        /* ── Respect reduced motion ──────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .stat-card::after, .shimmer-white, .shimmer-slate { animation: none !important; }
        }
      `}</style>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b border-neutral-800/60"
        style={{ background: 'rgba(6,6,12,0.96)' }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-300" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06060c] animate-pulse" />
            </div>
            <span className="text-xl font-bold text-white">PlanIt</span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="/discover" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              <Zap className="w-3.5 h-3.5" />
              Discover
            </a>
            <a href="/status" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Status
            </a>
            <a href="/help" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              Help
            </a>
            {['Terms|/terms', 'Privacy|/privacy'].map(s => {
              const [label, href] = s.split('|');
              return <a key={label} href={href} className="hidden lg:block px-3 py-2 text-sm text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">{label}</a>;
            })}
            <a href="/support" className="hidden sm:inline-flex ml-2 px-3 sm:px-5 py-2.5 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition-all duration-200">
              Support Us
            </a>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden ml-2 w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-all"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </nav>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-800/60 px-4 py-3 space-y-1" style={{ background: 'rgba(6,6,12,0.98)' }}>
            <a href="/discover" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <Zap className="w-4 h-4 text-neutral-500" />Discover
            </a>
            <a href="/status" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-0.5 mr-0.5" />Status
            </a>
            <a href="/help" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>Help
            </a>
            <a href="/terms" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              Terms
            </a>
            <a href="/privacy" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              Privacy
            </a>
            <div className="pt-1 border-t border-neutral-800">
              <a href="/support" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 mt-2 w-full px-4 py-3 text-sm font-semibold text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition-all">
                Support Us
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="relative" style={{ zIndex: 2, overflowX: 'hidden', maxWidth: '100vw' }}>
        {/* HERO */}
        <section className="relative min-h-screen flex items-center" style={{ overflow: 'hidden', maxWidth: '100vw' }}>
          {/* Subtle top gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(40,40,70,0.25) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div className="w-full">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-36 text-center">

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-neutral-500 mb-12 border border-neutral-800/80 uppercase tracking-widest cursor-default"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                Event Management Platform
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="font-black leading-[0.92] tracking-tight mb-8"
                style={{ fontSize: 'clamp(2.5rem, 8.5vw, 7rem)' }}
              >
                Make it{' '}
                <span className="shimmer-slate">Effortless</span>
                ,{' '}
                <span className="shimmer-white">by design.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.42 }}
                className="text-xl md:text-2xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light mb-14"
              >
                The all-in-one workspace for event teams. From first idea to final wrap-up.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.55 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16 w-full px-0 sm:px-0"
              >
                <a href="#create" className="group inline-flex items-center justify-center gap-3 w-full sm:w-auto px-9 py-4 bg-white text-neutral-900 text-base font-bold rounded-2xl hover:bg-neutral-100 hover:scale-105 transition-all duration-300 shadow-2xl">
                  Start planning
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
                <a href="#features"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-9 py-4 border border-neutral-700 text-neutral-300 text-base font-medium rounded-2xl hover:border-neutral-500 hover:text-white hover:scale-105 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  See features <ChevronRight className="w-4 h-4" />
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.68 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-xl mx-auto w-full"
              >
                {[
                  { value: 50000, suffix: '+', label: 'Events planned' },
                  { value: 500,   suffix: 'k+', label: 'Teams organized' },
                  { value: 100,   suffix: '%',  label: 'Success rate' },
                ].map((stat, i) => (
                  <div key={i}
                    className="stat-card text-center p-6 rounded-2xl border border-neutral-800/70 hover:border-neutral-600 transition-all duration-400 cursor-default hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="text-3xl font-black text-white mb-1">
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs font-medium text-neutral-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-28 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <SectionHeader eyebrow="How teams use it" title="Your event, every step" subtitle="Built for the full arc. Months of prep to the final goodbye." />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Brain,        phase: 'Before', num: '01', title: 'Coordinate your team',  desc: 'Assign tasks, split expenses, finalize the guest list, share files, and get every detail locked in before the big day.' },
                { icon: Zap,          phase: 'During', num: '02', title: 'Stay on top of it',     desc: 'Quick check-ins, QR guest arrivals, last-minute updates. Your team stays synced while the event runs itself.' },
                { icon: CheckCircle2, phase: 'After',  num: '03', title: 'Wrap it up right',      desc: 'Close expenses, share memories, collect feedback. Every loose end, tied.' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 120}>
                  <div className="group relative p-8 bg-neutral-900/50 rounded-3xl border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all duration-500">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-800 group-hover:bg-white flex items-center justify-center transition-all duration-500">
                        <item.icon className="w-6 h-6 text-neutral-400 group-hover:text-neutral-900 transition-colors duration-500" />
                      </div>
                      <span className="text-3xl font-black text-neutral-800 group-hover:text-neutral-700 transition-colors select-none">{item.num}</span>
                    </div>
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest mb-2">{item.phase}</p>
                    <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="py-32 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <SectionHeader eyebrow="Features" title="Everything you need" subtitle="Powerful tools for seamless event planning and coordination" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard icon={MessageSquare} title="Real-time team chat"       description="Instant messaging with typing indicators, reactions, and threaded conversations. Keep your planning team connected and aligned." delay={0} />
              <FeatureCard icon={ListChecks}    title="Task management"           description="Create checklists, assign tasks, set deadlines, and track completion. Never miss a critical planning milestone." delay={80} />
              <FeatureCard icon={BarChart3}     title="Quick polls and voting"    description="Make team decisions faster with live polls. Vote on venues, dates, menus, and more. See results instantly." delay={160} />
              <FeatureCard icon={FileText}      title="Unlimited file sharing"    description="Share contracts, floor plans, schedules, and more. Everything your team needs in one organized space." delay={240} />
              <FeatureCard icon={Clock}         title="Timeline and scheduling"   description="Build your event timeline, coordinate arrival times, and manage your run-of-show with precision." delay={320} />
              <FeatureCard icon={Users}         title="Unlimited participants"    description="No limits on team size. Bring your entire planning committee, vendors, volunteers, everyone who needs to be involved." delay={400} />
            </div>
          </div>
        </section>

        {/* ENTERPRISE */}
        <section className="py-32 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-xs font-bold text-neutral-300 mb-8">
                  <Zap className="w-4 h-4" />Enterprise Mode
                </div>
                <h2 className="text-5xl font-black text-white mb-6 leading-tight">Built for large-scale events</h2>
                <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
                  Hosting a wedding, conference, or corporate event? Enterprise Mode gives you professional-grade tools for managing hundreds of guests.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: CheckCircle2, text: 'QR code-based guest check-in system' },
                    { icon: Users,        text: 'Personalized digital invitations for each guest' },
                    { icon: TrendingUp,   text: 'Real-time attendance analytics dashboard' },
                    { icon: Timer,        text: 'Track check-in times and flow metrics' },
                  ].map((item, i) => (
                    <Reveal key={i} delay={i * 80}>
                      <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-neutral-900" />
                        </div>
                        <span className="text-neutral-300 font-medium">{item.text}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="relative">
                  <EnterpriseDemo />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* TABLE SERVICE MODE */}
        <section className="py-32 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: demo floor map mockup */}
              <Reveal delay={140}>
                <div className="relative order-2 lg:order-1">
                  <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 overflow-hidden p-1">
                    {/* Mini floor map demo */}
                    <div className="bg-neutral-950 rounded-2xl p-4" style={{ minHeight: 340 }}>
                      {/* Header bar */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-white rounded flex items-center justify-center"><UtensilsCrossed className="w-3 h-3 text-neutral-900" /></div>
                          <span className="text-sm font-bold text-white">Taverna Roma</span>
                          <span className="text-xs text-neutral-600">Table Service</span>
                        </div>
                        <div className="flex gap-1.5">
                          {[['#22c55e','4 Available'],['#ef4444','3 Occupied'],['#8b5cf6','1 Cleaning']].map(([c,l]) => (
                            <span key={l} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* SVG floor plan */}
                      <svg viewBox="0 0 500 240" className="w-full" style={{ height: 220 }}>
                        <defs><pattern id="g" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" /></pattern></defs>
                        <rect width="500" height="240" fill="url(#g)" />
                        {/* Zone label */}
                        <rect x="20" y="10" width="140" height="80" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeDasharray="5 3" />
                        <text x="90" y="55" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="11" fontWeight="600">Dining Room</text>
                        {/* Tables */}
                        {[
                          {x:60, y:150, r:24, status:'available', label:'T1', cap:'4', party:''},
                          {x:130, y:150, r:24, status:'occupied',  label:'T2', cap:'2/4', party:'Smith', time:'42m'},
                          {x:200, y:130, r:28, status:'occupied',  label:'T3', cap:'5/6', party:'Chen',  time:'18m'},
                          {x:280, y:150, r:24, status:'cleaning',  label:'T4', cap:'4', party:''},
                          {x:350, y:130, r:28, status:'available', label:'T5', cap:'6', party:''},
                          {x:430, y:150, r:24, status:'reserved',  label:'T6', cap:'4', party:'Jones'},
                        ].map(t => {
                          const c = t.status === 'available' ? '#22c55e' : t.status === 'occupied' ? '#ef4444' : t.status === 'cleaning' ? '#8b5cf6' : '#f59e0b';
                          return (
                            <g key={t.label}>
                              <circle cx={t.x} cy={t.y} r={t.r + 3} fill="none" stroke={c} strokeWidth="2" opacity="0.7" />
                              <circle cx={t.x} cy={t.y} r={t.r} fill={`${c}22`} />
                              <text x={t.x} y={t.y - 4} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="700">{t.label}</text>
                              <text x={t.x} y={t.y + 8} textAnchor="middle" dominantBaseline="middle" fill={c} fontSize="9">{t.cap}</text>
                              {t.time && <text x={t.x + t.r - 2} y={t.y - t.r + 2} textAnchor="middle" fill="white" fontSize="8" fontWeight="700">{t.time}</text>}
                            </g>
                          );
                        })}
                        {/* Waitlist panel */}
                        <rect x="20" y="170" width="120" height="55" rx="6" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.2)" />
                        <text x="30" y="185" fill="#f59e0b" fontSize="9" fontWeight="700">WAITLIST — 2 parties</text>
                        <text x="30" y="200" fill="rgba(255,255,255,0.5)" fontSize="9">Martinez · 4 guests · ~12m</text>
                        <text x="30" y="213" fill="rgba(255,255,255,0.5)" fontSize="9">Taylor · 2 guests · ~8m</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Right: copy */}
              <Reveal className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs font-bold text-orange-400 mb-8">
                  <UtensilsCrossed className="w-4 h-4" />Table Service Mode
                </div>
                <h2 className="text-5xl font-black text-white mb-6 leading-tight">Built for restaurants & venues</h2>
                <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
                  A dedicated floor management system for hospitality teams. Real-time table states, walk-in waitlists with live wait time estimates, and QR code reservations — all on one screen.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Layers,            text: 'Visual floor plan editor — drag tables to match your layout exactly' },
                    { icon: Users,             text: 'Walk-in waitlist with estimated wait times based on your timing config' },
                    { icon: QrCode,            text: 'Time-limited QR code reservations guests scan at the door' },
                    { icon: MapPin,            text: 'Live table states sync instantly across every staff device' },
                    { icon: CheckCircle2,      text: 'Your floor plan data persists forever — never auto-wiped' },
                  ].map((item, i) => (
                    <Reveal key={i} delay={i * 80}>
                      <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 hover:border-orange-500/20 hover:bg-orange-500/5 transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="text-neutral-300 font-medium">{item.text}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="mt-8">
                  <a href="#create" onClick={() => setTimeout(() => document.querySelector('[data-mode="table-service"]')?.click(), 100)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-400 transition-colors text-sm">
                    Set up your venue <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-32 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <SectionHeader eyebrow="Testimonials" title="Trusted by event planners" subtitle="See how teams are using PlanIt to execute flawless events" />
            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard quote="PlanIt transformed how we coordinated our annual company conference. The task management kept our 15-person planning team organized for 6 months of prep. The QR check-in on event day was seamless for 300 attendees." author="Michael Chen" role="Senior Event Coordinator" event="Tech Summit 2025" delay={0} />
              <TestimonialCard quote="As a wedding planner, I've used every tool out there. PlanIt stands out because it doesn't require my couples or vendors to create accounts. We used it for 4 months of planning." author="Sarah Williams" role="Lead Wedding Planner" event="Williams-Martinez Wedding" delay={120} />
              <TestimonialCard quote="Our nonprofit used PlanIt to coordinate a 500-person fundraising gala. The unlimited participant feature meant we could include our entire board, 30 volunteers, all vendors, and staff." author="David Martinez" role="Development Director" event="Charity Gala 2025" delay={240} />
            </div>
          </div>
        </section>

        {/* DISCOVER + STATUS CARDS */}
        <section className="py-28 border-t border-neutral-800/40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <Reveal className="text-center mb-12">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Explore more</p>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Everything you need</h2>
              <p className="text-lg text-neutral-400 max-w-md mx-auto">Find public events and check our service health — all in one place.</p>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Discover Card */}
              <Reveal delay={0}>
                <a href="/discover" className="group relative block p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-500 hover:bg-neutral-800/60 transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'radial-gradient(ellipse at top left, rgba(80,60,200,0.12) 0%, transparent 65%)' }} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-6 group-hover:bg-white group-hover:border-white transition-all duration-500 group-hover:scale-110">
                      <Zap className="w-7 h-7 text-neutral-300 group-hover:text-neutral-900 transition-colors duration-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Discover Events</h3>
                    <p className="text-neutral-400 leading-relaxed mb-6">Browse public events happening right now. Find meetups, workshops, and gatherings open to everyone.</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                      Browse events
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                    </div>
                  </div>
                </a>
              </Reveal>

              {/* Status Card */}
              <Reveal delay={120}>
                <a href="/status" className="group relative block p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-500 hover:bg-neutral-800/60 transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'radial-gradient(ellipse at top right, rgba(20,180,80,0.10) 0%, transparent 65%)' }} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-6 group-hover:bg-white group-hover:border-white transition-all duration-500 group-hover:scale-110">
                      <TrendingUp className="w-7 h-7 text-neutral-300 group-hover:text-neutral-900 transition-colors duration-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-2xl font-bold text-white">System Status</h3>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-900/50 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        Operational
                      </span>
                    </div>
                    <p className="text-neutral-400 leading-relaxed mb-6">Monitor real-time uptime, API performance, and incident history. Stay informed about service health.</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                      View status
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                    </div>
                  </div>
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* CREATE EVENT */}
        <section id="create" className="py-28 border-t border-neutral-800/40">
          <div className="max-w-8xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-start">

              <div className="lg:sticky lg:top-24">
                <Reveal>
                  <div className="mb-10">
                    <h2 className="text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                      {created
                        ? mode === 'table-service' ? 'Venue created!' : 'Event created!'
                        : mode === 'table-service' ? 'Set up your venue' : 'Start planning your event'}
                    </h2>
                    <p className="text-xl text-neutral-400 leading-relaxed">
                      {created
                        ? mode === 'table-service'
                          ? 'Your floor management system is live. Set up your seating layout and go.'
                          : 'Your planning hub is ready. Share the link with your team and get started.'
                        : mode === 'table-service'
                          ? 'Create your restaurant workspace in 60 seconds. Your data never expires.'
                          : 'Create your event workspace in 60 seconds. No credit card, no hassle, just start planning.'}
                    </p>
                  </div>
                </Reveal>

                {!created && (
                  <Reveal delay={100}>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-10">
                      {[{ icon: Clock, label: '60 seconds' }, { icon: Shield, label: 'Secure' }, { icon: CheckCircle2, label: 'Free forever' }].map((item, i) => (
                        <div key={i} className="text-center p-5 bg-neutral-900/50 rounded-2xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-300 hover:scale-105">
                          <item.icon className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-neutral-300">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    {mode === 'table-service' ? (
                      <div className="space-y-3 p-5 sm:p-8 bg-neutral-900/50 rounded-3xl border border-neutral-800">
                        <p className="text-base font-bold text-white mb-4">Everything included in Table Service:</p>
                        {['Visual floor plan editor — drag & drop tables anywhere', 'Live table states: available, occupied, cleaning, reserved', 'Walk-in waitlist with real-time estimated wait times', 'QR code reservations with configurable expiry windows', 'Per-restaurant timing config: dining duration, buffer, hours', 'Instant sync across all staff devices via live socket', 'Data never auto-deleted — your floor plan persists forever', 'Party size tracking and server assignment per table', 'Occupancy overview and turn time estimates at a glance'].map((item, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                            <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3 p-5 sm:p-8 bg-neutral-900/50 rounded-3xl border border-neutral-800">
                        <p className="text-base font-bold text-white mb-4">Everything included:</p>
                        {['Private event space with custom branded URL', 'Unlimited team members, no caps', 'Real-time chat with file sharing', 'Task lists and deadline tracking', 'Polls, voting, and decision tools', 'RSVP management and tracking', 'Expense splitting and budgets', 'QR check-in for large events', 'Timeline and scheduling tools'].map((item, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Reveal>
                )}

                {created && (
                  <Reveal delay={100}>
                    <div className="space-y-6">
                      <div className="flex items-center justify-center p-10 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce shadow-lg">
                            <Check className="w-10 h-10 text-white" />
                          </div>
                          <p className="text-lg font-bold text-emerald-400">
                            {mode === 'table-service' ? 'Venue created!' : mode === 'enterprise' ? 'Enterprise event created!' : 'Your planning hub is live!'}
                          </p>
                        </div>
                      </div>
                      {mode === 'table-service' ? (
                        <div className="p-8 bg-neutral-900/50 border border-neutral-800 rounded-3xl">
                          <div className="flex items-start gap-4">
                            <UtensilsCrossed className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                            <div>
                              <p className="text-base font-bold text-white mb-4">Next steps for Table Service:</p>
                              <ol className="text-sm text-neutral-400 space-y-3 list-decimal ml-5">
                                <li>Open your floor dashboard and click "Edit Layout"</li>
                                <li>Drag and drop tables to match your restaurant's floor plan</li>
                                <li>Set each table's capacity and label</li>
                                <li>Open Settings to configure your avg. dining time and hours</li>
                                <li>Staff can now manage tables, waitlists, and reservations live</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      ) : mode === 'enterprise' ? (
                        <div className="p-8 bg-neutral-900/50 border border-neutral-800 rounded-3xl">
                          <div className="flex items-start gap-4">
                            <Zap className="w-6 h-6 text-neutral-400 flex-shrink-0 mt-1" />
                            <div>
                              <p className="text-base font-bold text-white mb-4">Next steps for Enterprise Mode:</p>
                              <ol className="text-sm text-neutral-400 space-y-3 list-decimal ml-5">
                                <li>Enter your event and click "Manage Guest Invites"</li>
                                <li>Add all guests with names, email, and group sizes</li>
                                <li>Send personalized invite links with QR codes to each guest</li>
                                <li>On event day, use the check-in dashboard to scan QR codes</li>
                                <li>View real-time attendance analytics as guests arrive</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-neutral-300 mb-3">Your event link:</p>
                          <CopyLinkBox eventId={created.id} subdomain={created.subdomain} />
                          <p className="text-xs text-neutral-600 mt-3">Share this link with your planning team to get started</p>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          const base = created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`;
                          navigate(mode === 'table-service' ? `${base}/floor` : `${base}?new=1`);
                        }}
                        className="w-full px-8 py-5 bg-white text-neutral-900 rounded-2xl font-bold hover:scale-105 hover:bg-neutral-100 transition-all duration-300 shadow-xl flex items-center justify-center gap-3 text-lg"
                      >
                        {mode === 'table-service' ? 'Open Floor Dashboard' : mode === 'enterprise' ? 'Set Up Guest Invites' : 'Enter your planning hub'}
                        <ArrowUpRight className="w-5 h-5" />
                      </button>
                    </div>
                  </Reveal>
                )}
              </div>

              {!created && (
                <Reveal delay={80}>
                  <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 p-5 sm:p-10 hover:border-neutral-700 transition-all duration-500 sticky top-24">
                    <div className="mb-8 p-5 bg-neutral-950/80 rounded-2xl border border-neutral-800">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: 'standard',      label: 'Standard',      sub: 'Team planning' },
                          { val: 'enterprise',    label: 'Enterprise',    sub: 'Full Execution' },
                          { val: 'table-service', label: 'Table Service', sub: 'Restaurant Floor' },
                        ].map(({ val, label, sub }) => (
                          <button key={val} type="button" onClick={() => setMode(val)}
                            data-mode={val}
                            className={`px-3 py-4 text-sm font-bold rounded-2xl border-2 transition-all duration-300 ${mode === val ? 'bg-white text-neutral-900 border-white shadow-lg scale-[1.03]' : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:scale-[1.02]'}`}>
                            <div className="font-bold mb-1 text-xs sm:text-sm">{label}</div>
                            <div className="text-xs opacity-70 hidden sm:block">{sub}</div>
                          </button>
                        ))}
                      </div>
                      {mode === 'table-service' && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                          <UtensilsCrossed className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-300/80 leading-relaxed">Restaurant & venue mode. Your floor plan and data are <strong className="text-orange-300">never auto-deleted</strong> — they persist until you choose to clear them.</p>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Event title <span className="text-red-400">*</span></label>
                        <input type="text" required
                          className={`dark-input ${fieldErrors.title ? 'border-red-500 focus:border-red-400' : ''}`}
                          placeholder={mode === 'table-service' ? 'Taverna Roma, The Oak Room...' : 'Summer Company Retreat 2025'}
                          value={formData.title}
                          onChange={(e) => { handleTitleChange(e); if (fieldErrors.title) setFieldErrors(p => ({...p, title: ''})); }}
                        />
                        {fieldErrors.title && <p className="field-error text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.title}</p>}
                        {formData.title && formData.subdomain && (
                          <div className="mt-3 space-y-1.5">
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                              Event URL
                              {formData._subdomainTouched && (
                                <span className="ml-2 text-neutral-600 normal-case tracking-normal font-normal">custom</span>
                              )}
                            </label>
                            <div className="flex items-center bg-neutral-950/60 border border-neutral-800 rounded-lg overflow-hidden focus-within:border-neutral-600 transition-colors">
                              <span className="pl-3 pr-1 text-xs text-neutral-600 font-mono whitespace-nowrap flex-shrink-0">/e/</span>
                              <input
                                type="text"
                                value={formData.subdomain}
                                onChange={(e) => {
                                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
                                  setFormData(prev => ({ ...prev, subdomain: cleaned, _subdomainTouched: true }));
                                }}
                                className="flex-1 bg-transparent text-xs text-neutral-300 font-mono font-bold py-2 pr-3 outline-none min-w-0"
                                spellCheck={false}
                                autoComplete="off"
                              />
                              {formData._subdomainTouched && (
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title), _subdomainTouched: false }))}
                                  className="px-3 py-2 text-xs text-neutral-600 hover:text-neutral-400 transition-colors border-l border-neutral-800 flex-shrink-0"
                                  title="Reset to auto-generated"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-neutral-700">Only lowercase letters, numbers, and hyphens.</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Description</label>
                        <textarea className="dark-input resize-none" rows="3" placeholder="What's this event about?" value={formData.description} onChange={update('description')} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Date and time <span className="text-red-400">*</span></label>
                          <input type="datetime-local" required
                            className={`dark-input ${fieldErrors.date ? 'border-red-500 focus:border-red-400' : ''}`}
                            value={formData.date}
                            onChange={(e) => { update('date')(e); setFieldErrors(p => ({...p, date: ''})); }}
                          />
                          {fieldErrors.date && <p className="field-error text-xs text-red-400 mt-1">{fieldErrors.date}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Timezone <span className="text-red-400">*</span></label>
                          <select required className="dark-input" value={formData.timezone} onChange={update('timezone')}>
                            {getTimezoneOptions().map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Location</label>
                        <input type="text" className="dark-input" placeholder="Central Park, NYC" value={formData.location} onChange={update('location')} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Your name <span className="text-red-400">*</span></label>
                          <input type="text" required
                            className={`dark-input ${fieldErrors.organizerName ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder="Alex Smith"
                            value={formData.organizerName}
                            onChange={(e) => { update('organizerName')(e); setFieldErrors(p => ({...p, organizerName: ''})); }}
                          />
                          {fieldErrors.organizerName && <p className="field-error text-xs text-red-400 mt-1">{fieldErrors.organizerName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Your email <span className="text-red-400">*</span></label>
                          <input type="email" required
                            className={`dark-input ${fieldErrors.organizerEmail ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder="alex@company.com"
                            value={formData.organizerEmail}
                            onChange={(e) => { update('organizerEmail')(e); setFieldErrors(p => ({...p, organizerEmail: ''})); }}
                          />
                          {fieldErrors.organizerEmail && <p className="field-error text-xs text-red-400 mt-1">{fieldErrors.organizerEmail}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-neutral-500" />Account Password <span className="text-red-400">*</span></span>
                        </label>
                        <div className="relative">
                          <input type={showAccountPassword ? 'text' : 'password'} required
                            className={`dark-input pr-12 ${fieldErrors.accountPassword ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder="Create a secure password (min 4 characters)"
                            value={formData.accountPassword}
                            onChange={(e) => { update('accountPassword')(e); setFieldErrors(p => ({...p, accountPassword: ''})); }}
                            minLength={4}
                          />
                          <button type="button" onClick={() => setShowAccountPassword(!showAccountPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                            {showAccountPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {fieldErrors.accountPassword
                          ? <p className="field-error text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.accountPassword}</p>
                          : <p className="text-xs text-neutral-600 mt-2">Required to access this event from other devices or browsers</p>
                        }
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-neutral-500" />Event Password <span className="text-neutral-600 font-normal text-xs">(optional)</span></span>
                        </label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} className="dark-input pr-12" placeholder={mode === 'enterprise' ? 'Add layer of security' : 'Leave empty for open access'} value={formData.password} onChange={update('password')} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full px-8 py-5 bg-white text-neutral-900 rounded-2xl font-bold hover:scale-105 hover:bg-neutral-100 transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 text-lg">
                        {loading
                          ? <><div className="w-5 h-5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />Creating...</>
                          : mode === 'table-service'
                            ? <>Create venue <UtensilsCrossed className="w-5 h-5" /></>
                            : <>Create event <ArrowRight className="w-5 h-5" /></>
                        }
                      </button>
                    </form>
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-neutral-800/50" style={{ background: 'rgba(6,6,12,0.95)' }}>
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center"><Calendar className="w-5 h-5 text-neutral-300" /></div>
                  <span className="font-black text-xl text-white">PlanIt</span>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed mb-4">The ultimate planning hub for event teams. Plan smart, execute flawlessly.</p>
                <p className="text-xs text-neutral-600">Built by Aakshat Hariharan</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Product</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Features', '#features'], ['Discover', '/discover'], ['Status', '/status'], ['Help', '/help'], ['Get Started', '#create'], ['Help', '/help']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Company</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Admin Login', '/admin']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Connect</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Contact Us', 'mailto:planit.userhelp@gmail'], ['Wall of Supporters', '/support/wall'], ['About PlanIt', '/about']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-600">
              <span>© 2026 PlanIt. All rights reserved.</span>
              <span className="font-medium">By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
