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
import { useWhiteLabel } from '../context/WhiteLabelContext';

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

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES — injected once
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&display=swap');

  :root {
    --accent-1: #6366f1;
    --accent-2: #8b5cf6;
    --glow-1: rgba(99,102,241,0.18);
    --glow-2: rgba(139,92,246,0.12);
    --surface-glass: rgba(255,255,255,0.03);
    --border-subtle: rgba(255,255,255,0.06);
  }

  @keyframes loader-bar {
    0%   { transform: scaleX(0);   }
    60%  { transform: scaleX(0.85);}
    100% { transform: scaleX(1);   }
  }
  @keyframes loader-fade-out {
    0%   { opacity:1; }
    100% { opacity:0; pointer-events:none; }
  }
  @keyframes hero-word-in {
    0%   { opacity:0; transform: translateY(28px) skewY(3deg); filter: blur(6px); }
    100% { opacity:1; transform: translateY(0) skewY(0deg);   filter: blur(0);   }
  }
  @keyframes grid-pulse {
    0%,100% { opacity:0.018; }
    50%      { opacity:0.042; }
  }
  @keyframes orb-drift-a {
    0%,100% { transform: translate(0,0) scale(1);      }
    33%     { transform: translate(30px,-20px) scale(1.06); }
    66%     { transform: translate(-18px,25px) scale(0.96); }
  }
  @keyframes orb-drift-b {
    0%,100% { transform: translate(0,0) scale(1);      }
    33%     { transform: translate(-22px,18px) scale(1.04); }
    66%     { transform: translate(28px,-15px) scale(0.98); }
  }
  @keyframes badge-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    50%     { box-shadow: 0 0 22px 2px rgba(99,102,241,0.22); }
  }
  @keyframes scan-line {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes cta-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes float-gentle {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-8px); }
  }
  @keyframes scroll-indicator-bounce {
    0%,100% { opacity:0.3; transform:translateY(0); }
    50%     { opacity:0.7; transform:translateY(6px); }
  }
  @keyframes tick-in {
    0%   { opacity:0; transform:scale(0.6); }
    80%  { transform:scale(1.15); }
    100% { opacity:1; transform:scale(1); }
  }

  .font-syne    { font-family: 'Syne', sans-serif; }
  .hero-word    { animation: hero-word-in 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .loading-bar  { animation: loader-bar 1.6s cubic-bezier(0.22,1,0.36,1) forwards; transform-origin: left; }
  .cta-primary  {
    background: linear-gradient(135deg, #fff 0%, #e8e8f0 100%);
    background-size: 200% auto;
    transition: background-position 0.5s ease, transform 0.2s ease, box-shadow 0.3s ease;
  }
  .cta-primary:hover {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(99,102,241,0.15);
  }
  .cta-venue {
    transition: transform 0.2s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  }
  .cta-venue:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(249,115,22,0.12);
    border-color: rgba(249,115,22,0.6);
  }
  .branch-card {
    transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease;
  }
  .branch-card:hover { transform: translateY(-4px); }
  .branch-card-events:hover { box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 60px rgba(99,102,241,0.08); }
  .branch-card-venue:hover  { box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 60px rgba(249,115,22,0.08); }
  .feature-card {
    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .feature-card:hover {
    transform: translateY(-3px);
    border-color: rgba(99,102,241,0.25);
    box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 24px rgba(99,102,241,0.07);
  }
  .stat-card {
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
  }
  .stat-card:hover {
    border-color: rgba(99,102,241,0.3);
    box-shadow: 0 8px 32px rgba(99,102,241,0.1);
    transform: translateY(-2px);
  }
  .shimmer-white {
    background: linear-gradient(90deg, #fff 0%, #a5b4fc 50%, #fff 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: cta-shimmer 4s linear infinite;
  }
  .shimmer-slate {
    background: linear-gradient(90deg, #94a3b8 0%, #cbd5e1 50%, #94a3b8 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: cta-shimmer 4s linear infinite;
  }
  .typing-dot { animation: float-gentle 1.2s ease-in-out infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  .nav-link { position:relative; }
  .nav-link::after {
    content:''; position:absolute; bottom:-2px; left:50%; right:50%;
    height:1px; background:var(--accent-1);
    transition: left 0.3s ease, right 0.3s ease;
  }
  .nav-link:hover::after { left:10%; right:10%; }
`;

function InjectGlobalCSS() {
  useEffect(() => {
    const id = 'planit-home-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen({ onDone }) {
  const [phase, setPhase] = useState(0); // 0=loading, 1=fading
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1700);
    const t2 = setTimeout(() => onDone(), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div
      aria-hidden="true"
      style={{
        position:'fixed', inset:0, zIndex:9999, background:'#050508',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        transition:'opacity 0.4s ease',
        opacity: phase === 1 ? 0 : 1,
        pointerEvents: phase === 1 ? 'none' : 'all',
      }}
    >
      {/* Scan line */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)', animation:'scan-line 1.8s linear 1' }} />
      </div>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:36 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px rgba(99,102,241,0.2)' }}>
          <Calendar style={{ width:22, height:22, color:'#818cf8' }} />
        </div>
        <span style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-0.03em' }}>PlanIt</span>
      </div>
      {/* Progress bar */}
      <div style={{ width:200, height:1, background:'rgba(255,255,255,0.06)', borderRadius:1, overflow:'hidden' }}>
        <div className="loading-bar" style={{ height:'100%', background:'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius:1 }} />
      </div>
      <p style={{ marginTop:16, fontSize:11, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', fontFamily:'DM Sans,sans-serif' }}>Event & venue management</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED GRID BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
function CinematicGrid() {
  return (
    <div aria-hidden="true" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      {/* Animated grid lines */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', animation:'grid-pulse 6s ease-in-out infinite' }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid-sm" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
          </pattern>
          <pattern id="grid-lg" width="240" height="240" patternUnits="userSpaceOnUse">
            <path d="M 240 0 L 0 0 0 240" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          </pattern>
          <radialGradient id="grid-fade" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </radialGradient>
          <mask id="grid-mask"><rect width="100%" height="100%" fill="url(#grid-fade)"/></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-sm)" mask="url(#grid-mask)"/>
        <rect width="100%" height="100%" fill="url(#grid-lg)" mask="url(#grid-mask)"/>
      </svg>
      {/* Floating orbs */}
      <div style={{ position:'absolute', top:'15%', left:'12%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', animation:'orb-drift-a 18s ease-in-out infinite', filter:'blur(40px)' }}/>
      <div style={{ position:'absolute', bottom:'10%', right:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', animation:'orb-drift-b 22s ease-in-out infinite', filter:'blur(50px)' }}/>
      <div style={{ position:'absolute', top:'55%', left:'55%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)', animation:'orb-drift-a 26s ease-in-out infinite reverse', filter:'blur(60px)' }}/>
    </div>
  );
}

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
      <h2 className="font-syne text-3xl sm:text-5xl md:text-7xl font-black text-white mb-5 leading-tight">{title}</h2>
      {subtitle && <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </Reveal>
  );
}

function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="group relative p-6 sm:p-10 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all duration-500 h-full">
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
      <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-500 h-full">
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


// 
// ENTERPRISE INTERACTIVE DEMO
// 

// 
// ENTERPRISE INTERACTIVE DEMO
// 

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
              className={`px-3 py-2.5 text-xs font-bold capitalize transition-all duration-200 border-b-2 -mb-px flex items-center gap-1.5 ${tab === t ? 'text-white border-white bg-white/5 rounded-t-lg' : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-white/3 rounded-t-lg'}`}>
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

import StarBackground from '../components/StarBackground';



// 
// MAIN
// 

export default function Home() {
  const { wl, isWL } = useWhiteLabel();
  const wlName    = isWL ? (wl?.branding?.companyName || wl?.clientName || '') : '';
  const wlLogo    = isWL ? (wl?.branding?.logoUrl    || '') : '';
  const wlPrimary = isWL ? (wl?.branding?.primaryColor || '') : '';
  // Pages content from WL portal
  const wlPages   = isWL ? (wl?.pages  || {}) : {};
  const wlFeatures= isWL ? (wl?.features || {}) : {};
  // Home page overrides
  const heroHeadline    = wlPages?.home?.headline    || '';
  const heroSubheadline = wlPages?.home?.subheadline || '';
  const heroCta         = wlPages?.home?.ctaText     || '';
  const heroImage       = wlPages?.home?.heroImageUrl|| '';
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '', title: '', description: '', date: '', timezone: getUserTimezone(), location: '',
    organizerName: '', organizerEmail: '', accountPassword: '', password: '', staffPassword: '',
    isEnterpriseMode: false, maxParticipants: 10000,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedBranch, setSelectedBranch] = useState(null); // null | 'events' | 'venue'
  const [loadingDone, setLoadingDone] = useState(false);
  // On white-label domains, skip the branch selector and go straight to event creation
  useEffect(() => { if (isWL) { setSelectedBranch('events'); setLoadingDone(true); } }, [isWL]);

  const selectBranch = (branch) => {
    setSelectedBranch(branch);
    setMode(branch === 'venue' ? 'table-service' : 'standard');
    setTimeout(() => {
      document.getElementById(branch === 'venue' ? 'planit-venue' : 'planit-events')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

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

    //  Client-side field validation 
    const errs = {};
    const isTS = mode === 'table-service';
    if (!formData.title.trim())            errs.title          = isTS ? 'Restaurant name is required.' : 'Event title is required.';
    if (!isTS && !formData.date)           errs.date           = 'Date and time is required.';
    if (!isTS && !formData.timezone)       errs.timezone       = 'Timezone is required.';
    if (!formData.organizerName.trim())    errs.organizerName  = isTS ? 'Manager name is required.' : 'Your name is required.';
    if (!formData.organizerEmail.trim())   errs.organizerEmail = isTS ? 'Manager email is required.' : 'Your email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.organizerEmail.trim()))
                                           errs.organizerEmail = 'Please enter a valid email address.';
    if (!formData.accountPassword)         errs.accountPassword = 'Account password is required.';
    else if (formData.accountPassword.length < 4)
                                           errs.accountPassword = 'Password must be at least 4 characters.';
    if (isTS && formData.staffPassword && formData.staffPassword.length < 4)
                                           errs.staffPassword  = 'Staff PIN must be at least 4 characters.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Scroll to first error
      const firstField = document.querySelector('.field-error');
      if (firstField) firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const dateValue = (!isTS && formData.date) ? localDateTimeToUTC(formData.date, formData.timezone) : undefined;
    const payload = {
      title:          sanitize(formData.title),
      description:    sanitize(formData.description),
      ...(dateValue ? { date: dateValue, timezone: formData.timezone } : {}),
      location:       sanitize(formData.location),
      organizerName:  sanitize(formData.organizerName),
      organizerEmail: sanitize(formData.organizerEmail),
      accountPassword:formData.accountPassword,
      password:       formData.password || undefined,
      staffPassword:  (isTS && formData.staffPassword) ? formData.staffPassword : undefined,
      subdomain:      formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise',
      isTableServiceMode: isTS,
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
    <div className="min-h-screen text-white relative" style={{ background: 'var(--bg-base)', overflowX: 'clip', maxWidth: '100vw', isolation: 'isolate' }}>
      <InjectGlobalCSS />
      {!isWL && !loadingDone && <LoadingScreen onDone={() => setLoadingDone(true)} />}
      <ScrollProgressBar />


      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b transition-colors duration-500"
        style={selectedBranch === 'venue'
          ? { background: 'rgba(10,6,3,0.97)', borderColor: 'rgba(249,115,22,0.20)', backdropFilter: 'blur(24px)' }
          : { background: 'rgba(6,6,12,0.96)', borderColor: 'rgba(38,38,38,0.6)',    backdropFilter: 'blur(24px)' }
        }
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ── Events brand: visible outside Venue section ── */}
            <div style={{ display: selectedBranch === 'venue' ? 'none' : 'flex' }} className="items-center gap-3 transition-opacity duration-300">
              {isWL && wlLogo ? (
                <img src={wlLogo} alt={wlName} className="h-8 object-contain" />
              ) : (
                <>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-neutral-300" />
                    </div>
                    {!isWL && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06060c] animate-pulse" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-syne text-xl font-bold text-white tracking-tight">{isWL ? wlName : 'PlanIt'}</span>
                    {!isWL && <span className="hidden sm:block px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-400 uppercase tracking-wider">Events</span>}
                  </div>
                </>
              )}
            </div>
            {/* ── Venue brand: visible only in Venue section ── */}
            <div style={{ display: selectedBranch === 'venue' ? 'flex' : 'none' }} className="items-center gap-3 transition-opacity duration-300">
              <div className="w-9 h-9 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-syne text-xl font-bold text-white tracking-tight">{isWL ? wlName : 'PlanIt'}</span>
                {!isWL && <span className="hidden sm:block px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400 uppercase tracking-wider">Venue</span>}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {/* ── Branch switcher: shown when a branch is selected ── */}
            {selectedBranch && (
              <button
                onClick={() => setSelectedBranch(null)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200 border border-neutral-800 mr-1"
              >
                <ChevronRight className="w-3 h-3 rotate-180" /> Change
              </button>
            )}
            {/* ── When NOT in Venue section: show Venue link ── */}
            {!isWL && <a href="#planit-venue"
              onClick={(e) => { e.preventDefault(); selectBranch('venue'); }}
              style={{ display: selectedBranch === 'venue' ? 'none' : undefined }}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-orange-400/80 hover:text-orange-300 hover:bg-orange-500/8 rounded-xl transition-all duration-200">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              PlanIt Venue
            </a>}
            {/* ── When IN Venue section: show Events link ── */}
            <a href="#planit-events"
              onClick={(e) => { e.preventDefault(); selectBranch('events'); }}
              style={{ display: selectedBranch === 'venue' ? 'flex' : 'none' }}
              className="items-center gap-1.5 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              <Calendar className="w-3.5 h-3.5" />
              PlanIt Events
            </a>
            <a href="/discover" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              <Zap className="w-3.5 h-3.5" />
              Discover
            </a>
            <a href="/blog" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              Blog
            </a>
            <a href="/status" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Status
            </a>
            <a href="/help" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              Help
            </a>
            <a href="/blog" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              Blog
            </a>
            <a href="/about" className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">
              About
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
            <a href="#planit-venue" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-xl transition-all">
              <UtensilsCrossed className="w-4 h-4" />{isWL ? 'Venue' : 'PlanIt Venue'}
            </a>
            <a href="/discover" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <Zap className="w-4 h-4 text-neutral-500" />Discover
            </a>
            <a href="/status" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-0.5 mr-0.5" />Status
            </a>
            <a href="/help" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>Help
            </a>
            <a href="/blog" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Blog
            </a>
            <a href="/about" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all">
              About
            </a>
            <div className="pt-1 border-t border-neutral-800 flex gap-2 mt-1">
              <a href="/terms" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2 text-xs text-neutral-600 hover:text-neutral-400 rounded-lg hover:bg-neutral-800/40 transition-all">
                Terms
              </a>
              <a href="/privacy" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2 text-xs text-neutral-600 hover:text-neutral-400 rounded-lg hover:bg-neutral-800/40 transition-all">
                Privacy
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="relative" style={{ zIndex: 2, overflowX: 'hidden', maxWidth: '100vw' }}>
        {/* HERO — redesigned */}
        <section id="hero-top" className="relative min-h-screen flex items-center" style={{ overflow: 'hidden', maxWidth: '100vw' }}>
          {/* Layered background system */}
          {(isWL && heroImage)
            ? <div className="absolute inset-0" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.2 }} />
            : <CinematicGrid />
          }
          {/* Deep ambient radials */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ zIndex: 1,
            background: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(99,102,241,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(249,115,22,0.05) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 10% 70%, rgba(139,92,246,0.05) 0%, transparent 50%)',
          }} />

          <div className="w-full relative" style={{ zIndex: 2 }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-36 text-center">

              {/* Eyebrow badges */}
              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.1 }}
                className="inline-flex items-center gap-3 mb-12"
              >
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border border-indigo-500/20 text-indigo-300 uppercase tracking-widest cursor-default"
                  style={{ background: 'rgba(99,102,241,0.07)', animation:'badge-glow 3s ease-in-out infinite' }}>
                  <Calendar className="w-3 h-3" />{isWL ? 'Events' : 'PlanIt Events'}
                </span>
                <span className="w-1 h-1 rounded-full bg-neutral-700" />
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border border-orange-500/25 text-orange-400 uppercase tracking-widest cursor-default"
                  style={{ background: 'rgba(249,115,22,0.06)' }}>
                  <UtensilsCrossed className="w-3 h-3" />{isWL ? 'Venue' : 'PlanIt Venue'}
                </span>
              </motion.div>

              {/* Main headline — word-by-word animation */}
              {(isWL && heroHeadline)
                ? (
                  <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.9, delay:0.25 }}
                    className="font-syne font-black leading-[0.92] tracking-tight mb-8 text-white"
                    style={{ fontSize:'clamp(2.5rem,8.5vw,7rem)' }}>
                    {heroHeadline}
                  </motion.h1>
                ) : (
                  <h1 className="font-syne font-black leading-[0.9] tracking-tight mb-8"
                    style={{ fontSize:'clamp(2.6rem,8.5vw,7rem)' }}>
                    <span className="hero-word inline-block text-white" style={{ animationDelay:'0.25s' }}>Plan</span>{' '}
                    <span className="hero-word inline-block text-white" style={{ animationDelay:'0.38s' }}>every</span>{' '}
                    <span className="hero-word inline-block text-white" style={{ animationDelay:'0.51s' }}>detail.</span>
                    <br />
                    <span className="hero-word inline-block shimmer-slate" style={{ animationDelay:'0.64s' }}>Execute</span>{' '}
                    <span className="hero-word inline-block shimmer-white" style={{ animationDelay:'0.77s' }}>flawlessly.</span>
                  </h1>
                )
              }

              {/* Sub-headline */}
              <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, delay:0.9 }}
                className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light mb-14"
              >
                {isWL
                  ? (heroSubheadline || wlName || 'Your event platform')
                  : <>The complete workspace for events &amp; hospitality —{' '}
                      <span className="text-neutral-200 font-medium">team chat, tasks, RSVP, check-in</span>
                      {' '}and a live floor manager for restaurants.</>
                }
              </motion.p>

              {/* CTA buttons */}
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, delay:1.05 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="#planit-events"
                  onClick={(e) => { e.preventDefault(); selectBranch('events'); }}
                  className="cta-primary group inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-white text-neutral-900 text-sm font-bold rounded-2xl shadow-2xl">
                  <Calendar className="w-4 h-4" />
                  {(isWL && heroCta) ? heroCta : 'Start with Events'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
                <a href="#planit-venue"
                  onClick={(e) => { e.preventDefault(); selectBranch('venue'); }}
                  className="cta-venue group inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 border border-orange-500/30 text-orange-400 text-sm font-bold rounded-2xl"
                  style={{ background: 'rgba(249,115,22,0.06)' }}>
                  <UtensilsCrossed className="w-4 h-4" />
                  Explore Venue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
              </motion.div>

              {/* Trust stats */}
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, delay:1.2 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
                {[
                  { tag: 'Free forever',   desc: 'No credit card required',           icon: '✦' },
                  { tag: 'Zero accounts',  desc: 'Guests join by name instantly',      icon: '◈' },
                  { tag: 'Unlimited team', desc: 'Every organizer & vendor included',  icon: '◉' },
                ].map((item) => (
                  <div key={item.tag} className="stat-card text-center p-5 rounded-2xl cursor-default"
                    style={{ background:'rgba(255,255,255,0.025)', backdropFilter:'blur(12px)' }}>
                    <div className="text-indigo-400 text-lg mb-1">{item.icon}</div>
                    <div className="text-sm font-black text-white mb-0.5 tracking-wide">{item.tag}</div>
                    <div className="text-xs text-neutral-500">{item.desc}</div>
                  </div>
                ))}
              </motion.div>

              {/* Scroll indicator */}
              <div className="mt-16 flex flex-col items-center gap-2 cursor-default" style={{ opacity:0.4 }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">Scroll</span>
                <div style={{ width:1, height:36, background:'linear-gradient(to bottom, rgba(99,102,241,0.6), transparent)', animation:'scroll-indicator-bounce 2s ease-in-out infinite' }} />
              </div>
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════
            BRANCH GATEWAY — redesigned cards
        ═══════════════════════════════════════════════════════════ */}
        <section className="relative border-t overflow-hidden" style={{ borderColor:'rgba(255,255,255,0.05)', display: (selectedBranch || isWL) ? 'none' : 'block' }}>
          {/* Section label */}
          <div className="text-center pt-14 pb-8 relative z-10">
            <Reveal>
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-neutral-800"
                style={{ background:'rgba(255,255,255,0.02)', backdropFilter:'blur(8px)' }}>
                {!isWL && <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-300">The PlanIt Family</span>}
                <span className="w-px h-3 bg-neutral-800" />
                <span className="text-[10px] font-bold text-neutral-500">Two branches, one platform</span>
              </div>
            </Reveal>
          </div>

          {/* Split cards */}
          <div className="grid md:grid-cols-2 gap-px" style={{ background:'rgba(255,255,255,0.04)' }}>

            {/* Events branch */}
            <Reveal>
              <a href="#planit-events"
                onClick={(e) => { e.preventDefault(); selectBranch('events'); }}
                className="branch-card branch-card-events group relative flex flex-col p-10 sm:p-14 overflow-hidden cursor-pointer block"
                style={{ minHeight:'500px', background:'#08080f' }}>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background:'radial-gradient(ellipse 80% 70% at 0% 50%, rgba(99,102,241,0.08) 0%, transparent 65%)' }} />
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background:'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }} />
                <div className="relative mb-10">
                  <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/8">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{isWL ? (wlName || 'Events') : 'PlanIt Events'}</span>
                  </div>
                </div>
                <div className="relative flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-600 mb-3">Branch 01</div>
                  <h3 className="font-syne text-4xl sm:text-5xl font-black text-white leading-[0.92] mb-5 tracking-tight">
                    For anyone<br />who runs<br /><span className="text-neutral-400">events.</span>
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mb-8">
                    Weddings, corporate retreats, galas, conferences. The complete planning workspace — tasks, team chat, RSVP, QR check-in, expenses. Built for the whole arc.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {['Chat', 'Tasks', 'RSVP', 'QR check-in', 'Polls', 'Files', 'Budget'].map(t => (
                      <span key={t} className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-500/8 border border-indigo-500/15 text-indigo-400/70">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-500 group-hover:text-indigo-400 transition-colors duration-300">
                    Explore Events <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
                {/* Mini mockup */}
                <div className="absolute bottom-8 right-8 w-48 opacity-15 group-hover:opacity-40 transition-opacity duration-500 hidden lg:block">
                  <div className="rounded-xl border border-indigo-500/15 overflow-hidden" style={{ background:'rgba(8,8,20,0.95)' }}>
                    <div className="px-3 py-2 border-b border-indigo-500/10 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[9px] text-indigo-400/50 font-mono">team-chat</span>
                    </div>
                    <div className="p-2.5 space-y-2">
                      {[['Alex','Venue confirmed!','#818cf8'],['Sam','Floor plan attached','#a5b4fc'],['You','All set ✓','#e2e8f0']].map(([n,m,c]) => (
                        <div key={n} className="flex items-start gap-1.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-indigo-900/60 flex-shrink-0 mt-0.5" />
                          <div><span className="text-[8px] font-bold" style={{ color:c }}>{n}</span><div className="text-[8px] text-neutral-600">{m}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </a>
            </Reveal>

            {/* Venue branch */}
            <Reveal delay={100}>
              <a href="#planit-venue"
                onClick={(e) => { e.preventDefault(); selectBranch('venue'); }}
                className="branch-card branch-card-venue group relative flex flex-col p-10 sm:p-14 overflow-hidden cursor-pointer block"
                style={{ minHeight:'500px', background:'#0a0804' }}>
                <div className="absolute inset-0 opacity-30 group-hover:opacity-80 transition-opacity duration-700"
                  style={{ background:'radial-gradient(ellipse 80% 70% at 100% 50%, rgba(249,115,22,0.08) 0%, transparent 65%)' }} />
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background:'linear-gradient(90deg, transparent, rgba(249,115,22,0.5), transparent)' }} />
                <div className="relative mb-10">
                  <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-orange-500/25 bg-orange-500/8">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">PlanIt Venue</span>
                  </div>
                </div>
                <div className="relative flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-orange-900/60 mb-3">Branch 02</div>
                  <h3 className="font-syne text-4xl sm:text-5xl font-black text-white leading-[0.92] mb-5 tracking-tight">
                    For every<br />busy Friday<br /><span className="text-orange-500/60">night floor.</span>
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mb-8">
                    Live floor map. Walk-in waitlist. Public wait board. QR reservations. One-tap seating. Everything your front-of-house needs, every night.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {['Floor map', 'Waitlist', 'Wait board', 'QR reserve', 'Seat next', 'Servers'].map(t => (
                      <span key={t} className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-500/8 border border-orange-500/20 text-orange-500/70">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-orange-600/50 group-hover:text-orange-400 transition-colors duration-300">
                    Explore Venue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
                <div className="absolute bottom-8 right-8 w-48 opacity-15 group-hover:opacity-40 transition-opacity duration-500 hidden lg:block">
                  <div className="rounded-xl border border-orange-500/20 overflow-hidden" style={{ background:'rgba(14,10,6,0.95)' }}>
                    <div className="px-3 py-2 border-b border-orange-500/10 flex items-center justify-between">
                      <span className="text-[9px] text-orange-400/50 font-mono">floor</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                      </div>
                    </div>
                    <div className="p-3">
                      <svg viewBox="0 0 120 70" className="w-full">
                        {[[20,35,12,'#22c55e'],[50,25,14,'#ef4444'],[80,35,12,'#ef4444'],[100,50,10,'#f59e0b']].map(([cx,cy,r,c],i) => (
                          <g key={i}>
                            <circle cx={cx} cy={cy} r={r} fill={`${c}22`} stroke={c} strokeWidth="1.5" opacity="0.8" />
                            <text x={cx} y={cy+3} textAnchor="middle" fill={c} fontSize="6" fontWeight="bold">T{i+1}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            </Reveal>
          </div>{/* end grid */}
        </section>{/* end BRANCH GATEWAY */}

        {/* ═══════════════════════════════════════════════════════════
            PLANIT EVENTS — its own "page" section
        ═══════════════════════════════════════════════════════════ */}
        <section id="planit-events" className="relative overflow-hidden" style={{ background: 'var(--bg-surface)', display: selectedBranch === 'events' ? 'block' : 'none' }}>
          {/* Page-break top border with glow */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.12) 20%, rgba(255,255,255,0.25) 50%, rgba(148,163,184,0.12) 80%, transparent)' }} />
          {/* Background texture */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(100,116,139,0.06) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(148,163,184,0.04) 0%, transparent 40%)',
          }} />
          {/* Animated SVG grid decoration */}
          <svg style={{ position:'absolute', top:0, right:0, width:320, height:320, opacity:0.4, pointerEvents:'none' }} viewBox="0 0 320 320" aria-hidden="true">
            <defs><radialGradient id="evg" cx="100%" cy="0%"><stop offset="0%" stopColor="rgba(148,163,184,0.15)"/><stop offset="100%" stopColor="transparent"/></radialGradient></defs>
            <rect width="320" height="320" fill="url(#evg)"/>
            {Array.from({length:6},(_,i)=><line key={i} x1={i*60} y1="0" x2={i*60} y2="320" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
            {Array.from({length:6},(_,i)=><line key={i} x1="0" y1={i*60} x2="320" y2={i*60} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
            {/* Floating task nodes */}
            {[[60,60],[180,40],[260,120],[120,200],[200,260]].map(([cx,cy],i)=>(
              <g key={i}>
                <circle cx={cx} cy={cy} r="18" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                  <animate attributeName="cy" values={`${cy};${cy-8};${cy}`} dur={`${5+i*0.8}s`} begin={`${i*0.6}s`} repeatCount="indefinite"/>
                </circle>
                <line x1={cx} y1={cy-5} x2={cx+8} y2={cy-5} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round"/>
                <line x1={cx} y1={cy} x2={cx+12} y2={cy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeLinecap="round"/>
                <line x1={cx} y1={cy+5} x2={cx+6} y2={cy+5} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeLinecap="round"/>
              </g>
            ))}
          </svg>

          {/* Product "page header" */}
          <div className="relative max-w-screen-xl mx-auto px-6 sm:px-10 pt-20 pb-4">
            <Reveal>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-neutral-300" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">{isWL ? '' : 'PlanIt'}</div>
                  <div className="text-lg font-black text-white tracking-tight leading-none">Events</div>
                </div>
                <div className="ml-2 h-px flex-1 bg-neutral-800" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700">Branch 01</span>
              </div>
            </Reveal>
          </div>

          {/* Hero headline */}
          <div className="relative max-w-screen-xl mx-auto px-6 sm:px-10 pt-10 pb-20">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] mb-6">For event teams who actually have a lot going on</p>
                <h2 className="font-syne font-black text-white leading-[0.9] tracking-tight mb-8" style={{ fontSize: 'clamp(2.2rem, 5vw, 4.5rem)' }}>
                  Everything your<br />
                  team needs.<br />
                  <span style={{ color: '#64748b' }}>Nothing you don't.</span>
                </h2>
                <p className="text-neutral-400 text-lg leading-relaxed mb-10 max-w-lg">
                  From 6 months out to the final wrap-up. {isWL ? (wlName || 'Your platform') : 'PlanIt Events'} is the workspace for the whole team — organizers, vendors, volunteers, everyone.
                </p>
                <div className="flex items-center gap-4">
                  <a href="#create" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl font-bold hover:bg-neutral-100 transition-colors text-sm">
                    Start planning free <ArrowRight className="w-4 h-4" />
                  </a>
                  <span className="text-xs text-neutral-700">No credit card · No account needed</span>
                </div>
              </Reveal>

              {/* Animated workspace mockup */}
              <Reveal delay={120}>
                <div className="relative rounded-2xl border border-neutral-800 overflow-hidden" style={{ background: 'rgba(13,13,22,0.9)' }}>
                  {/* App chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800/60" style={{ background: 'rgba(10,10,18,0.95)' }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                      <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                      <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] text-neutral-500 font-mono">Summer Gala 2026</span>
                      </div>
                    </div>
                  </div>
                  {/* Two-panel layout */}
                  <div className="grid grid-cols-5 divide-x divide-neutral-800/60" style={{ minHeight: 320 }}>
                    {/* Sidebar */}
                    <div className="col-span-2 p-4 space-y-1">
                      {[['Chat','active'],['Tasks',''],['Guests',''],['Polls',''],['Budget','']].map(([label,active]) => (
                        <div key={label} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-white/6 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? 'rgba(255,255,255,0.5)' : '#404040' }} />{label}
                        </div>
                      ))}
                    </div>
                    {/* Chat panel */}
                    <div className="col-span-3 flex flex-col">
                      <div className="px-3 py-2 border-b border-neutral-800/40">
                        <span className="text-[10px] font-bold text-neutral-500"># planning-team</span>
                      </div>
                      <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
                        <div className="msg-1 flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-violet-600/40 flex-shrink-0 mt-0.5 flex items-center justify-center">
                            <span className="text-[7px] font-bold text-violet-300">A</span>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-violet-400 mb-0.5">Alex</div>
                            <div className="text-[10px] text-neutral-400 bg-neutral-800/60 px-2 py-1.5 rounded-lg rounded-tl-none">Venue deposit confirmed</div>
                          </div>
                        </div>
                        <div className="msg-2 flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-sky-600/40 flex-shrink-0 mt-0.5 flex items-center justify-center">
                            <span className="text-[7px] font-bold text-sky-300">S</span>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-sky-400 mb-0.5">Sam</div>
                            <div className="text-[10px] text-neutral-400 bg-neutral-800/60 px-2 py-1.5 rounded-lg rounded-tl-none">Floor plan uploaded to files</div>
                          </div>
                        </div>
                        <div className="msg-3 flex items-start gap-2 justify-end">
                          <div>
                            <div className="text-[10px] text-neutral-300 bg-neutral-700/80 px-2 py-1.5 rounded-lg rounded-tr-none">On it! Creating checklist now</div>
                          </div>
                        </div>
                      </div>
                      {/* typing */}
                      <div className="px-3 pb-3">
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-neutral-800/40 border border-neutral-700/30">
                          <span className="text-[9px] text-neutral-600">Alex is typing</span>
                          <div className="flex items-end gap-0.5">
                            <div className="typing-dot w-1 h-1 rounded-full bg-neutral-500" />
                            <div className="typing-dot w-1 h-1 rounded-full bg-neutral-500" />
                            <div className="typing-dot w-1 h-1 rounded-full bg-neutral-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Features grid */}
          <div className="relative border-t border-neutral-800/40">
            <div className="max-w-screen-xl mx-auto px-6 sm:px-10 py-16">
              <Reveal className="mb-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-600 mb-2">What's included</p>
                <h3 className="font-syne text-2xl font-black text-white">Every tool. One workspace.</h3>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: MessageSquare, label: 'Real-time team chat',    desc: 'Typing indicators, reactions, threads. Your team stays in sync.' },
                  { icon: ListChecks,    label: 'Task management',        desc: 'Assign tasks, set deadlines, track completion down to the wire.' },
                  { icon: BarChart3,     label: 'Polls & voting',         desc: 'Vote on venues, dates, menus. Live results instantly.' },
                  { icon: FileText,      label: 'File sharing',           desc: 'Contracts, floor plans, schedules — all in one place.' },
                  { icon: Users,         label: 'Unlimited team',         desc: 'No caps. Every organizer, vendor, and volunteer included.' },
                  { icon: QrCode,        label: 'QR check-in',           desc: 'Professional guest check-in with real-time attendance.' },
                ].map((f, i) => (
                  <Reveal key={f.label} delay={i * 60}>
                    <div className="feature-card group p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700/50 flex items-center justify-center mb-3 group-hover:bg-neutral-700 transition-colors">
                        <f.icon className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="text-sm font-bold text-white mb-1">{f.label}</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">{f.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>

          {/* Enterprise strip */}
          <div className="border-t border-neutral-800/40">
            <div className="max-w-screen-xl mx-auto px-6 sm:px-10 py-12">
              <Reveal>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 rounded-2xl border border-neutral-800" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-neutral-400" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white mb-0.5">Enterprise Mode</div>
                      <div className="text-xs text-neutral-600">Personalized QR invites, check-in dashboard, real-time attendance analytics. For 100+ guest events.</div>
                    </div>
                  </div>
                  <a href="#create" className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-700 rounded-xl text-xs font-bold text-neutral-300 hover:border-neutral-500 hover:text-white transition-all">
                    Set up Enterprise <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Bottom page-break */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.08) 20%, rgba(255,255,255,0.15) 50%, rgba(148,163,184,0.08) 80%, transparent)' }} />
        </section>

        {/* ═══════════════════════════════════════════════════════════
            BRANCH TRANSITION — visual page turn
        ═══════════════════════════════════════════════════════════ */}
        <div className="relative py-12 flex items-center justify-center overflow-hidden" style={{ background: 'var(--bg-base)', display: selectedBranch ? 'none' : 'flex' }}>
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(249,115,22,0.04) 0%, transparent 60%)' }} />
          <Reveal>
            <div className="relative flex items-center gap-5 text-center">
              <div className="h-px w-16 bg-neutral-800" />
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-neutral-800" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 uppercase tracking-widest">
                  <Calendar className="w-3 h-3 text-neutral-700" /> Events
                </div>
                <span className="text-neutral-800">·</span>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 uppercase tracking-widest">
                  <UtensilsCrossed className="w-3 h-3 text-neutral-700" /> Venue
                </div>
              </div>
              <div className="h-px w-16 bg-neutral-800" />
            </div>
          </Reveal>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            PLANIT VENUE — its own "page" section
        ═══════════════════════════════════════════════════════════ */}
        <section id="planit-venue" className="relative overflow-hidden" style={{ background: 'var(--bg-venue)', display: selectedBranch === 'venue' ? 'block' : 'none' }}>
          {/* Page-break top border with orange glow */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.15) 20%, rgba(249,115,22,0.5) 50%, rgba(249,115,22,0.15) 80%, transparent)' }} />
          {/* Background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 85% 40%, rgba(249,115,22,0.06) 0%, transparent 50%), radial-gradient(circle at 15% 80%, rgba(234,88,12,0.03) 0%, transparent 40%)',
          }} />
          {/* Animated venue floor SVG decoration */}
          <svg style={{ position:'absolute', top:0, left:0, width:280, height:280, opacity:0.35, pointerEvents:'none' }} viewBox="0 0 280 280" aria-hidden="true">
            <defs><radialGradient id="vng" cx="0%" cy="0%"><stop offset="0%" stopColor="rgba(249,115,22,0.12)"/><stop offset="100%" stopColor="transparent"/></radialGradient></defs>
            <rect width="280" height="280" fill="url(#vng)"/>
            {Array.from({length:5},(_,i)=><line key={i} x1={i*60} y1="0" x2={i*60} y2="280" stroke="rgba(249,115,22,0.05)" strokeWidth="1"/>)}
            {Array.from({length:5},(_,i)=><line key={i} x1="0" y1={i*60} x2="280" y2={i*60} stroke="rgba(249,115,22,0.05)" strokeWidth="1"/>)}
            {/* Mini table shapes */}
            {[[50,60,18,'#22c55e'],[130,50,16,'#ef4444'],[60,160,14,'#f59e0b'],[170,150,18,'#22c55e']].map(([cx,cy,r,c],i)=>(
              <g key={i}>
                <circle cx={cx} cy={cy} r={r} fill={`${c}12`} stroke={c} strokeWidth="1" opacity="0.7">
                  <animate attributeName="cy" values={`${cy};${cy-6};${cy}`} dur={`${4+i*0.9}s`} begin={`${i*0.7}s`} repeatCount="indefinite"/>
                </circle>
                <text x={cx} y={cy+4} textAnchor="middle" fill={c} fontSize="8" fontWeight="800" opacity="0.8">T{i+1}</text>
              </g>
            ))}
          </svg>

          {/* Product "page header" */}
          <div className="relative max-w-screen-xl mx-auto px-6 sm:px-10 pt-20 pb-4">
            <Reveal>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/40">PlanIt</div>
                  <div className="text-lg font-black text-white tracking-tight leading-none">Venue</div>
                </div>
                <div className="ml-2 h-px flex-1 bg-orange-500/10" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500/30">Branch 02</span>
              </div>
            </Reveal>
          </div>

          {/* Hero headline */}
          <div className="relative max-w-screen-xl mx-auto px-6 sm:px-10 pt-10 pb-20">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500/40 mb-6">For restaurants that run a real floor every night</p>
                <h2 className="font-syne font-black text-white leading-[0.9] tracking-tight mb-8" style={{ fontSize: 'clamp(2.2rem, 5vw, 4.5rem)' }}>
                  Run your floor.<br />
                  Know your wait.<br />
                  <span style={{ color: 'rgba(249,115,22,0.5)' }}>Seat every table.</span>
                </h2>
                <p className="text-neutral-600 text-lg leading-relaxed mb-10 max-w-lg">
                  Live table states. Walk-in waitlist with a public wait board guests scan at the door. One-tap seating. Your floor data never expires.
                </p>
                <div className="flex items-center gap-4">
                  <a href="#create" onClick={() => setTimeout(() => document.querySelector('[data-mode="table-service"]')?.click(), 100)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-400 transition-colors text-sm">
                    Set up your venue <ArrowRight className="w-4 h-4" />
                  </a>
                  <span className="text-xs text-neutral-700">Free · Data never expires</span>
                </div>
              </Reveal>

              {/* Animated floor map */}
              <Reveal delay={120}>
                <div className="relative rounded-2xl border border-orange-500/15 overflow-hidden" style={{ background: 'rgba(13,10,5,0.95)' }}>
                  {/* App chrome */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-orange-500/10" style={{ background: 'rgba(10,8,3,0.98)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
                        <UtensilsCrossed className="w-2.5 h-2.5 text-orange-400" />
                      </div>
                      <span className="text-xs font-bold text-neutral-400">Taverna Roma</span>
                      <span className="text-[9px] text-orange-400/40 font-bold uppercase tracking-wider">PlanIt Venue</span>
                    </div>
                    <div className="flex gap-2">
                      {[['#22c55e','3 Free'],['#ef4444','4 Occ'],['#8b5cf6','1 Cln']].map(([c,l]) => (
                        <span key={l} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-neutral-900 text-neutral-500">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Floor plan SVG */}
                  <div className="p-4">
                    <svg viewBox="0 0 520 260" className="w-full" style={{ height: 220 }}>
                      <defs>
                        <pattern id="vg" width="28" height="28" patternUnits="userSpaceOnUse">
                          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(249,115,22,0.04)" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="520" height="260" fill="url(#vg)" />
                      {/* Zone */}
                      <rect x="18" y="10" width="155" height="90" rx="8" fill="rgba(249,115,22,0.02)" stroke="rgba(249,115,22,0.08)" strokeDasharray="6 3" />
                      <text x="95" y="58" textAnchor="middle" fill="rgba(249,115,22,0.2)" fontSize="11" fontWeight="700" letterSpacing="2">MAIN ROOM</text>
                      {/* Tables */}
                      {[
                        {x:65,  y:155, r:26, status:'available', label:'T1', cap:'4'},
                        {x:145, y:155, r:26, status:'occupied',  label:'T2', cap:'4', party:'Smith', time:'38m'},
                        {x:215, y:135, r:30, status:'occupied',  label:'T3', cap:'6', party:'Chen',  time:'19m'},
                        {x:300, y:155, r:26, status:'cleaning',  label:'T4', cap:'4'},
                        {x:370, y:135, r:30, status:'available', label:'T5', cap:'6'},
                        {x:455, y:155, r:26, status:'reserved',  label:'T6', cap:'4', party:'Jones'},
                      ].map(t => {
                        const c = t.status==='available'?'#22c55e':t.status==='occupied'?'#ef4444':t.status==='cleaning'?'#8b5cf6':'#f59e0b';
                        const pulse = t.status === 'available';
                        return (
                          <g key={t.label}>
                            <circle cx={t.x} cy={t.y} r={t.r+4} fill="none" stroke={c} strokeWidth="1.5" opacity={pulse ? undefined : "0.5"} className={pulse ? 'table-pulse-ring' : ''} />
                            <circle cx={t.x} cy={t.y} r={t.r} fill={`${c}18`} stroke={c} strokeWidth="1" className={pulse ? 'table-pulse-fill' : ''} />
                            <text x={t.x} y={t.y-3} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="9" fontWeight="800">{t.label}</text>
                            <text x={t.x} y={t.y+8} textAnchor="middle" fill={c} fontSize="8">{t.cap}</text>
                            {t.time && <text x={t.x+t.r-2} y={t.y-t.r+4} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="700" opacity="0.8">{t.time}</text>}
                          </g>
                        );
                      })}
                      {/* Waitlist widget */}
                      <rect x="18" y="178" width="130" height="60" rx="8" fill="rgba(245,158,11,0.06)" stroke="rgba(245,158,11,0.18)" />
                      <text x="30" y="196" fill="#f59e0b" fontSize="8" fontWeight="800" letterSpacing="1">WAITLIST</text>
                      <text x="90" y="196" fill="rgba(245,158,11,0.5)" fontSize="8" fontWeight="700" className="waitlist-tick">·3</text>
                      <text x="30" y="212" fill="rgba(255,255,255,0.4)" fontSize="8">Martinez · 4 · ~14m</text>
                      <text x="30" y="226" fill="rgba(255,255,255,0.4)" fontSize="8">Taylor · 2 · ~8m</text>
                    </svg>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Features grid */}
          <div className="relative border-t border-orange-500/8">
            <div className="max-w-screen-xl mx-auto px-6 sm:px-10 py-16">
              <Reveal className="mb-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500/40 mb-2">What's included</p>
                <h3 className="font-syne text-2xl font-black text-white">Your whole floor, in one screen.</h3>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: Layers,       label: 'Visual floor editor',    desc: 'Drag tables to match your exact layout. Zones, shapes, labels.' },
                  { icon: Users,        label: 'Walk-in waitlist',       desc: 'Add parties instantly. Estimated wait times update as tables clear.' },
                  { icon: QrCode,       label: 'Public wait board',      desc: 'Guests scan the door QR, see the queue, and join from their phone.' },
                  { icon: MapPin,       label: 'Live sync',              desc: 'Every status update hits all staff screens in real time.' },
                  { icon: CheckCircle2, label: 'One-tap seat next',      desc: 'Auto-picks the tightest-fit table and seats the next waiting party.' },
                  { icon: Clock,        label: 'Data never expires',     desc: 'Your floor plan and history persist forever. No cleanup, no resets.' },
                ].map((f, i) => (
                  <Reveal key={f.label} delay={i * 60}>
                    <div className="group p-5 rounded-2xl border border-orange-500/10 hover:border-orange-500/25 transition-all duration-300" style={{ background: 'rgba(249,115,22,0.025)' }}>
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-3 group-hover:bg-orange-500/15 transition-colors">
                        <f.icon className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="text-sm font-bold text-white mb-1">{f.label}</div>
                      <div className="text-xs text-neutral-500 leading-relaxed">{f.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom page-break */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.08) 20%, rgba(249,115,22,0.25) 50%, rgba(249,115,22,0.08) 80%, transparent)' }} />
        </section>

        {/* TESTIMONIALS */}
        <section className="py-32 border-t border-neutral-800/40" style={{ display: selectedBranch ? 'block' : 'none' }}>
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
        <section className="py-28 border-t border-neutral-800/40" style={{ display: selectedBranch ? 'block' : 'none' }}>
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <Reveal className="text-center mb-12">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Explore more</p>
              <h2 className="font-syne text-4xl md:text-5xl font-black text-white mb-4">Everything you need</h2>
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
        <section id="create" className="py-28 border-t border-neutral-800/40" style={{ display: selectedBranch ? 'block' : 'none' }}>
          <div className="max-w-8xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-start">

              <div className="lg:sticky lg:top-24">
                <Reveal>
                  <div className="mb-10">
                    <h2 className="font-syne text-5xl font-black text-white mb-6 tracking-tight leading-tight">
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
                            <div className="w-full">
                              <p className="text-base font-bold text-white mb-4">Your venue is live!</p>
                              {formData.staffPassword && (
                                <div className="mb-4 p-3 bg-neutral-800 border border-neutral-700 rounded-xl">
                                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Default staff login</p>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-neutral-400">Username</span>
                                    <span className="text-white font-mono font-bold">staff</span>
                                  </div>
                                  <div className="flex justify-between text-sm mt-1">
                                    <span className="text-neutral-400">Password</span>
                                    <span className="text-white font-mono font-bold">{formData.staffPassword}</span>
                                  </div>
                                  <p className="text-xs text-neutral-600 mt-2">Share this with your team — they log in at <code className="text-neutral-500">/login</code></p>
                                </div>
                              )}
                              <ol className="text-sm text-neutral-400 space-y-3 list-decimal ml-5">
                                <li>Open your floor dashboard and click "Edit Layout"</li>
                                <li>Drag and drop tables to match your restaurant's floor plan</li>
                                <li>Set each table's capacity and label</li>
                                <li>Open Settings to configure dining time and operating hours</li>
                                <li>Staff log in at <code className="text-neutral-500">/login</code> and go straight to the floor</li>
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
                      <div className={`grid gap-2 ${selectedBranch === 'venue' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {[
                          { val: 'standard',      label: 'Standard',      sub: 'Team planning',     branch: 'events' },
                          { val: 'enterprise',    label: 'Enterprise',    sub: 'Large events + QR', branch: 'events' },
                          { val: 'table-service', label: isWL ? 'Venue' : 'PlanIt Venue', sub: 'Restaurant floor', branch: 'venue' },
                        ].filter(({ branch }) => !selectedBranch || branch === selectedBranch).map(({ val, label, sub }) => (
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
                        <label className="block text-sm font-bold text-neutral-300 mb-2">{mode === 'table-service' ? 'Restaurant name' : 'Event title'} <span className="text-red-400">*</span></label>
                        <input type="text" required
                          className={`dark-input ${fieldErrors.title ? 'border-red-500 focus:border-red-400' : ''}`}
                          placeholder={mode === 'table-service' ? 'Taverna Roma, The Oak Room...' : 'Summer Company Retreat 2025'}
                          value={formData.title}
                          onChange={(e) => { handleTitleChange(e); if (fieldErrors.title) setFieldErrors(p => ({...p, title: ''})); }}
                        />
                        {fieldErrors.title && <p className="field-error text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.title}</p>}
                      </div>

                      {/* URL field — always rendered, fades in when title is present */}
                      <div className={`transition-all duration-300 ${formData.title ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-1.5">
                          {mode === 'table-service' ? 'Venue' : 'Event'} URL{formData._subdomainTouched && <span className="ml-2 text-neutral-600 normal-case tracking-normal font-normal">· custom</span>}
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
                        <p className="text-xs text-neutral-700 mt-1">Lowercase letters, numbers, and hyphens only.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Description</label>
                        <textarea className="dark-input resize-none" rows="3" placeholder={mode === 'table-service' ? 'A short description of your venue (optional)' : "What's this event about?"} value={formData.description} onChange={update('description')} />
                      </div>
                      {mode !== 'table-service' && (
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
                      )}
                      {mode !== 'table-service' && (
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Location</label>
                        <input type="text" className="dark-input" placeholder="Central Park, NYC" value={formData.location} onChange={update('location')} />
                      </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">{mode === 'table-service' ? 'Manager name' : 'Your name'} <span className="text-red-400">*</span></label>
                          <input type="text" required
                            className={`dark-input ${fieldErrors.organizerName ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder={mode === 'table-service' ? 'Head Manager' : 'Alex Smith'}
                            value={formData.organizerName}
                            onChange={(e) => { update('organizerName')(e); setFieldErrors(p => ({...p, organizerName: ''})); }}
                          />
                          {fieldErrors.organizerName && <p className="field-error text-xs text-red-400 mt-1">{fieldErrors.organizerName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">{mode === 'table-service' ? 'Manager email' : 'Your email'} <span className="text-red-400">*</span></label>
                          <input type="email" required
                            className={`dark-input ${fieldErrors.organizerEmail ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder={mode === 'table-service' ? 'manager@restaurant.com' : 'alex@company.com'}
                            value={formData.organizerEmail}
                            onChange={(e) => { update('organizerEmail')(e); setFieldErrors(p => ({...p, organizerEmail: ''})); }}
                          />
                          {fieldErrors.organizerEmail && <p className="field-error text-xs text-red-400 mt-1">{fieldErrors.organizerEmail}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-neutral-500" />{mode === 'table-service' ? 'Organizer Password' : 'Account Password'} <span className="text-red-400">*</span></span>
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
                          : <p className="text-xs text-neutral-600 mt-2">{mode === 'table-service' ? 'Your personal password to manage the venue settings' : 'Required to access this event from other devices or browsers'}</p>
                        }
                      </div>
                      {mode === 'table-service' && (
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-neutral-500" />Staff Password <span className="text-neutral-600 font-normal text-xs">(optional — shared with floor staff)</span></span>
                        </label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} className={`dark-input pr-12 ${fieldErrors.staffPassword ? 'border-red-500 focus:border-red-400' : ''}`}
                            placeholder="PIN or password staff use to log in to the floor"
                            value={formData.staffPassword}
                            onChange={(e) => { update('staffPassword')(e); setFieldErrors(p => ({...p, staffPassword: ''})); }}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {fieldErrors.staffPassword
                          ? <p className="field-error text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.staffPassword}</p>
                          : <p className="text-xs text-neutral-600 mt-2">Leave empty if you'll create individual staff accounts from the floor settings</p>
                        }
                      </div>
                      )}
                      {mode !== 'table-service' && (
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
                      )}
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
                  {isWL && wlLogo
                    ? <img src={wlLogo} alt={wlName} className="h-8 object-contain" />
                    : <><div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center"><Calendar className="w-5 h-5 text-neutral-300" /></div>
                       <span className="font-black text-xl text-white">{isWL ? wlName : 'PlanIt'}</span></>
                  }
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed mb-4">{isWL ? '' : 'The ultimate planning hub for event teams. Plan smart, execute flawlessly.'}</p>
                <p className="text-xs text-neutral-600">Built by Aakshat Hariharan</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Product</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Features', '#features'], ['Discover', '/discover'], ['Blog', '/blog'], ['Status', '/status'], ['Help', '/help'], ['Get Started', '#create'], ['License', '/license']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Company</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['About PlanIt', '/about'], ['Blog & Guides', '/blog'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['License', '/license']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Connect</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Contact / Support', '/support'], ['Wall of Supporters', '/support/wall'], ['System Status', '/status'], ['Help Center', '/help']].map(([l, h]) => (
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
