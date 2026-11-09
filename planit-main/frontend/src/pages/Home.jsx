import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock, ArrowRight, ArrowUpRight,
  Eye, EyeOff, Zap, ListChecks, AlertCircle, UtensilsCrossed, QrCode, Bot, CheckSquare,
  CornerDownRight, Menu, X, Layers, MapPin, Clock, CheckCircle2,
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

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap');
.pi{--ac:#2236ff;--hl:#ffe14d;--ink:#0d0e1c;--lav:#eceeff;--bg:#fff;--sf:#fff;--mu:#5a5d70;--ln:#d9dbe8;--ok:#0c8a5b;--pk:#ff7ac6;--mn:#6ff0c0;--er:#d12f2f;--acs:#fff6c2;
background:var(--bg);color:var(--ink);font:400 16px/1.6 'Hanken Grotesk',system-ui,sans-serif;min-height:100vh;overflow-x:clip;-webkit-font-smoothing:antialiased}
.pi *{box-sizing:border-box}.pi a{color:inherit;text-decoration:none}.pi button{font:inherit;color:inherit;cursor:pointer}
.pi h1,.pi h2,.pi h3,.pi .ph{font-family:Unbounded,'Hanken Grotesk',sans-serif;font-weight:700;letter-spacing:-.035em;line-height:1.04;margin:0}
.pi :focus-visible{outline:3px solid var(--hl);outline-offset:2px}.pi svg{flex-shrink:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 28px}
.nav{position:sticky;top:0;z-index:40;background:var(--ac);color:#fff;transition:background-color .45s}
.nav .wrap{display:flex;align-items:center;height:68px;gap:32px}
.brand{display:flex;align-items:center;gap:11px;font:700 21px Unbounded,sans-serif;letter-spacing:-.04em}
.mark{width:30px;height:30px;border-radius:8px;background:var(--ink);color:#fff;display:grid;place-items:center;font:700 15px Unbounded,sans-serif;overflow:hidden}.mark img{width:22px;height:22px;object-fit:contain}
.links{display:flex;gap:28px;margin-left:auto;align-items:center;font-size:15px;font-weight:500}
.links a:not(.btn){opacity:.8;transition:opacity .15s}.links a:not(.btn):hover{opacity:1}
.burger{display:none;margin-left:auto;background:none;border:0;padding:8px;color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:2px solid var(--ink);background:#fff;color:var(--ink);border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;transition:transform .12s,box-shadow .12s}
.pi .btn,.pi .sm-btn,.pi .lnk{font-weight:700}
.btn.pri{background:var(--hl);box-shadow:4px 4px 0 var(--ink)}.btn.dk{background:var(--ink);color:#fff;box-shadow:4px 4px 0 var(--ac)}
.btn.pri:hover,.btn.dk:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}.btn.dk:hover{box-shadow:2px 2px 0 var(--ac)}
.btn:not(.pri):not(.dk):hover{background:var(--ink);color:#fff}
.btn.sm{padding:8px 14px;font-size:14px;box-shadow:3px 3px 0 var(--ink)}.btn:disabled{opacity:.55;cursor:not-allowed}.btn.wide{width:100%;padding:16px 20px;font-size:16px}
.nav .btn.sm{border-color:#fff;box-shadow:3px 3px 0 var(--ink)}
.lnk{background:none;border:0;padding:0 0 2px;font-weight:700;border-bottom:2px solid var(--ac);color:var(--ink)}.lnk:hover{background:var(--hl)}
.hero{position:relative;background-color:var(--ac);background-image:radial-gradient(rgba(255,255,255,.22) 1.6px,transparent 1.6px);background-size:28px 28px;transition:background-color .45s;color:#fff;padding:72px 0 0;overflow:hidden}.hero-g{position:relative;z-index:1}
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
.panel{position:relative;background:#fff;color:var(--ink);border-radius:12px;padding:34px 32px 30px;box-shadow:10px 10px 0 var(--sh,var(--ink));scroll-margin-top:96px}
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
.ov{position:fixed;inset:0;z-index:100;background:color-mix(in srgb,var(--ac) 94%,transparent);display:flex;padding:20px;overflow:auto;animation:fi .25s}@keyframes fi{from{opacity:0}}
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
.hero h1 em{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 4 Q6 0 12 4 T24 4' fill='none' stroke='%236ff0c0' stroke-width='3'/%3E%3C/svg%3E") repeat-x 0 100%;padding-bottom:.2em}
.deco{position:absolute;pointer-events:none;z-index:0}.d1{left:calc(50% - 70px);top:44px}.d2{left:28px;top:26px}
.float{animation:flt 5s ease-in-out infinite}@keyframes flt{50%{transform:translateY(-10px) rotate(4deg)}}
.spin-slow{animation:spn 24s linear infinite}@keyframes spn{to{transform:rotate(360deg)}}
.stick{animation:wob 5s ease-in-out infinite}@keyframes wob{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-4deg) scale(1.05)}}
.ch .mini{display:grid;gap:5px;margin-top:10px;font-size:13px;color:var(--ink)}.ch .mini span{display:block}.ch .mini span::before{content:'';display:inline-block;width:6px;height:6px;background:var(--ac);margin-right:9px;transform:rotate(45deg);vertical-align:1px}
.perf::before,.perf::after{background:var(--ac)}
.uses{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px}
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
.sec.pk{background:var(--pk);border-top:2px solid var(--ink);padding:72px 0}.sec.ac{background-color:var(--ac);background-image:radial-gradient(rgba(255,255,255,.22) 1.6px,transparent 1.6px);background-size:28px 28px;transition:background-color .45s;color:#fff;border-top:2px solid var(--ink)}
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

.swap{animation:swp .45s cubic-bezier(.2,.8,.2,1)}@keyframes swp{from{opacity:0;transform:translateY(14px)}}
.hero .eye,.hero .lead,.feats .feat,.uses .use,.stp{animation:swp .45s cubic-bezier(.2,.8,.2,1) backwards}
.col{padding:0 0 24px;overflow:hidden;gap:16px}.col>*:not(.colh){margin:0 22px}
.colh{display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:0;border-bottom:2px solid var(--ink);background:var(--c);color:#fff;padding:18px 22px}
.colh h3{font-size:24px;font-weight:800;color:#fff}.col .ico{width:38px;height:38px;border-radius:9px;background:var(--ch);color:var(--ink);border:2px solid var(--ink)}
.col:nth-child(n) .ico{background:var(--ch);color:var(--ink)}
.col .best{padding:12px 14px;background:var(--lav);border:2px solid var(--ink);border-radius:8px;margin-top:0}.best small{display:block;color:var(--mu);font-size:12.5px;font-weight:600}.best b{font-size:14.5px;line-height:1.35;display:block}
.col.sel{transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--ink)}.col.sel .best{background:var(--ch)}.hero h1.long{font-size:clamp(2.1rem,4.2vw,3.7rem)}
.col>button.lnk{margin:auto 22px 0}
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
  { id: 'standard', tab: 'Events', best: 'Weddings, galas, multi-day events', short: 'Chat, tasks, polls, RSVP and check-in', icon: Calendar, title: 'Planning an event?', blurb: 'Weddings, conferences, retreats, galas. Chat, tasks, polls, RSVP and check-in in one workspace.',
    launch: 'Create your event', sub: 'Build your planning workspace in under 60 seconds. No credit card required.', cta: 'Start building',
    incl: ['Private event space with a custom URL', 'Unlimited team members', 'Real-time chat with file sharing', 'Task lists and deadlines', 'Polls and voting', 'RSVP management', 'Budgets and expense splitting', 'QR check-in for large events'] },
  { id: 'enterprise', tab: 'Enterprise', best: 'Events with 100+ guests', short: 'Personal QR invites and a check-in dashboard', icon: Zap, title: 'Running a big, ticketed night?', blurb: 'A personal QR invite for every guest, a live check-in dashboard and fraud checks at the door.',
    launch: 'Launch an enterprise event', sub: 'Personalized QR invites, a check-in dashboard and live analytics for large events.', cta: 'Set up enterprise event',
    incl: ['Personalized QR invite per guest', 'Real-time check-in dashboard', 'Group sizes and table assignments', 'Trust scoring and manager override', 'Duplicate and forgery detection', 'Everything in Standard'] },
  { id: 'rsvp', tab: 'RSVP', best: 'Parties, meetups, simple gatherings', short: 'A guest list and an RSVP page', icon: CheckSquare, title: 'Just need RSVPs?', blurb: 'A clean, section-based RSVP page and a guest list. Live in under a minute.',
    launch: 'Create your RSVP page', sub: 'A guest list and a good-looking RSVP page. No seating charts, no floor management.', cta: 'Start building',
    incl: ['Drag-and-drop RSVP page builder', '16-block library: hero, agenda, FAQ, gallery', 'Auto-generated cover graphic', 'The same guest list as every PlanIt event', 'Simple check-in', 'Views and response analytics'] },
  { id: 'table-service', tab: 'Venue', best: 'Restaurants that run a real floor every night', short: 'Floor map, waitlist and reservations', icon: UtensilsCrossed, title: 'Running a restaurant floor?', blurb: 'Live floor map, walk-in waitlist, QR reservations and one-tap seating. Your data never expires.',
    launch: 'Launch your venue', sub: 'Set up your floor plan and start managing tables in under 60 seconds.', cta: 'Set up your venue',
    incl: ['Visual floor plan editor', 'Live table states', 'Walk-in waitlist with wait estimates', 'QR reservations with expiry windows', 'Per-venue timing and hours', 'Instant sync across staff devices', 'Floor plan never auto-deleted'] },
];

const STEPS = [
  ['Name it', 'Pick a mode and give it a name. Your private space and link are ready in under a minute.'],
  ['Bring your team', 'Share the link. Organizers, vendors and volunteers are unlimited, and guests need no account.'],
  ['Run the day', 'Chat, tasks, polls, RSVPs and door check-in, live in one workspace.'],
];
const FAQ = [
  ['Is PlanIt really free?', 'Yes. Free forever, with no credit card and no per-seat pricing. Your team is unlimited.'],
  ['Do my guests need accounts?', 'No. Guests join by name with a personal QR, and RSVP pages open on any phone with no app and no account.'],
  ['Can I switch between Standard and Enterprise later?', 'No. The mode is chosen when you create the event and cannot be changed afterwards. Pick Enterprise for large, ticketed or access-controlled events with 50+ attendees.'],
  ['How long is my data kept?', 'Event data is auto-deleted 7 days after the event. For restaurants, your floor plan and history never expire.'],
  ['Can I run my event from Claude?', 'Yes. Add PlanIt to Claude as a connector, then ask it to add guests, send announcements and check attendance.'],
];

const branchOf = (id) => (id === 'rsvp' ? 'rsvp' : id === 'table-service' ? 'venue' : 'events');
const BRANCHES = {
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

const THEME = {
  standard: { ac: '#2236ff', hl: '#ffe14d', acs: '#fff6c2', sh: '#0d0e1c', d1: '#ff7ac6', d2: '#6ff0c0' },
  enterprise: { ac: '#17143a', hl: '#ff7ac6', acs: '#ffe3f3', sh: '#ff7ac6', d1: '#ffe14d', d2: '#6ff0c0' },
  rsvp: { ac: '#078a5d', hl: '#ffe14d', acs: '#e0f8ec', sh: '#0d0e1c', d1: '#ff7ac6', d2: '#ffe14d' },
  'table-service': { ac: '#d9430d', hl: '#ffe14d', acs: '#ffe9de', sh: '#0d0e1c', d1: '#6ff0c0', d2: '#ffe14d' },
};
const HERO = {
  standard: { e: BRANCHES.events.eyebrow, h: BRANCHES.events.h },
  enterprise: { e: 'For 100+ guest events', h: ['Plan the night.', 'Run the door.'] },
  rsvp: { e: BRANCHES.rsvp.eyebrow, h: BRANCHES.rsvp.h },
  'table-service': { e: BRANCHES.venue.eyebrow, h: BRANCHES.venue.h },
};
const FEAT_BY_MODE = {
  standard: BRANCHES.events.items,
  enterprise: [
    [QrCode, 'Personalized QR invites', 'A personal QR for every guest. Scan at the door, watch attendance update live.'],
    [BarChart3, 'Check-in dashboard', 'Real-time attendance analytics for the whole night.'],
    [Users, 'Groups & tables', 'Group sizes and table assignments for every guest.'],
    [Shield, 'Trust scoring & override', 'Trust scoring with manager override built in.'],
    [AlertCircle, 'Duplicate & forgery detection', 'Catch duplicate and forged scans at the door.'],
    [Calendar, 'Everything in Standard', 'Chat, tasks, polls, files and RSVP management included.'],
  ],
  rsvp: BRANCHES.rsvp.items,
  'table-service': BRANCHES.venue.items,
};
const SPANS = { 3: [1, 1, 1], 6: [2, 1, 1, 2, 2, 1], 7: [2, 1, 1, 1, 1, 1, 2] };
const TINTS = { 3: ['c-ac', 'c-hl', 'c-pk'], 6: ['c-ac', 'c-hl', '', 'c-pk', 'c-ink', ''], 7: ['c-ac', 'c-hl', '', '', '', '', 'c-ink'] };
const STEPS_BY = {
  standard: STEPS,
  enterprise: [['Name it', 'Create your event in Enterprise mode. It can\u2019t be changed later, so pick it up front.'], ['Send personal invites', 'Every guest gets a personalized QR invite, with group sizes and table assignments.'], ['Scan at the door', 'Check guests in live, with duplicate and forgery detection and manager override.']],
  rsvp: [['Name it', 'Give your event a name, then pick a template and accent colour.'], ['Build the page', 'Drag, drop and reorder from a 16-block library: hero, agenda, FAQ, sponsors and more.'], ['Share one link', 'Guests RSVP in seconds, with no app and no account. Watch the guest list fill.']],
  'table-service': [['Draw your floor', 'Drag tables to match your exact layout, with zones, shapes and labels.'], ['Open the door', 'Guests scan the door QR, see the queue and join the waitlist from their phone.'], ['Seat every table', 'Live table states on every staff screen, and one tap to seat the next party.']],
};

function Burst({ className, color, size = 110 }) {
  const pts = Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI) / 12, r = i % 2 ? 36 : 50; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' ');
  return <svg className={`deco ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><polygon points={pts} fill={color} stroke="#0d0e1c" strokeWidth="2.5" strokeLinejoin="round" /></svg>;
}
const Squiggle = ({ className, color = '#6ff0c0' }) => (
  <svg className={`deco ${className}`} width="96" height="26" viewBox="0 0 84 24" fill="none" aria-hidden="true"><path d="M2 12 Q12 0 22 12 T42 12 T62 12 T82 12" stroke={color} strokeWidth="5" strokeLinecap="round" /></svg>
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
        <Field label={`${isVenue ? 'Manager name' : 'Your name'} *`} error={err.organizerName}><input ref={firstRef} className={`inp${err.organizerName ? ' bad' : ''}`} placeholder={isVenue ? 'Head Manager' : 'Alex Smith'} value={formData.organizerName} onChange={set('organizerName')} onKeyDown={enter} /></Field>
        <Field label={`${isVenue ? 'Manager email' : 'Your email'} *`} error={err.organizerEmail}><input type="email" className={`inp${err.organizerEmail ? ' bad' : ''}`} placeholder={isVenue ? 'manager@restaurant.com' : 'alex@company.com'} value={formData.organizerEmail} onChange={set('organizerEmail')} onKeyDown={enter} /></Field>
      </div></>;
    const second = isVenue ? 'Staff password' : 'Event password';
    const hint = isVenue ? 'The PIN your floor staff use to log in (optional)' : isRsvp ? 'Restricts who can open your event space (optional). The RSVP page stays open to anyone with the link unless you protect it in RSVP Settings.' : 'Restrict who can join your event (optional)';
    return <>
      {head(isVenue ? 'Secure your venue.' : 'Secure your event.', isVenue ? 'Set a password to manage the venue and a staff PIN for your team.' : 'Your account password gets you back in from any device.')}
      <div className="fld">
        <Field label={<><Lock size={12} style={{ verticalAlign: -1 }} /> {isVenue ? 'Organizer password' : 'Account password'} *</>} error={err.accountPassword}>
          <div className="pw"><input ref={firstRef} type={showPw ? 'text' : 'password'} className={`inp${err.accountPassword ? ' bad' : ''}`} placeholder="Minimum 4 characters" minLength={4} value={formData.accountPassword} onChange={set('accountPassword')} onKeyDown={enter} />
            <button type="button" onClick={() => setShowPw((p) => !p)} aria-label="Show password">{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>
        <Field label={second} hint="(optional)"><div className="pw"><input type={showPw2 ? 'text' : 'password'} className="inp" placeholder={isVenue ? 'Staff PIN or password' : 'Leave empty for open access'} value={isVenue ? formData.staffPassword : formData.password} onChange={set(isVenue ? 'staffPassword' : 'password')} />
          <button type="button" onClick={() => setShowPw2((p) => !p)} aria-label="Show password">{showPw2 ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <small style={{ color: 'var(--mu)', display: 'block', marginTop: 6 }}>{hint}</small></Field>
        <div className="fld" style={{ gap: 10, paddingTop: 14, borderTop: '1px solid var(--ln)' }}>
          {LEGAL_CHECKS.map((c) => (
            <div key={c.key}><label className="chk"><input type="checkbox" checked={!!formData[c.key]} onChange={(e) => { onUserInput?.(); const v = e.target.checked; setFormData((p) => ({ ...p, [c.key]: v })); if (v) setLocalErr((p) => { const n = { ...p }; delete n[c.key]; return n; }); }} /><span>{c.label}</span></label>
              {err[c.key] && <div className="err" style={{ marginLeft: 26 }}><AlertCircle size={13} />{err[c.key]}</div>}</div>))}
        </div>
      </div></>;
  };

  return (
    <div>
      <div className="prog">{steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}<span>Step {step + 1} of {total}</span></div>
      {draft && (
        <div className="banner"><span><b>You were in the middle of creating an event.</b> Continue where you left off?</span>
          <button className="btn pri sm" onClick={() => { setFormData(draft.formData); setStep(draft.step); setStepKey((k) => k + 1); setDraft(null); }}>Continue</button>
          <button className="btn sm" onClick={() => { localStorage.removeItem('planit_event_draft'); setDraft(null); }}>Start fresh</button></div>)}
      <div key={stepKey} className="step" onPaste={onUserPaste}>
        {abuseStatus && <div className="banner"><span><b>{abuseStatus.title}</b> {abuseStatus.message}</span></div>}
        {body()}
        {requiresVerification && <div style={{ marginTop: 18, display: 'grid', justifyItems: 'center', gap: 10 }}><p style={{ fontSize: 13, color: 'var(--mu)', margin: 0 }}>Please complete the verification step to continue.</p><TurnstileWidget onToken={onCaptchaToken} resetKey={captchaResetKey} theme="light" /></div>}
      </div>
      <div className="nv">
        {step > 0 && <button className="btn" type="button" onClick={() => go(-1)}>Back</button>}
        <button className="btn pri" type="button" onClick={next} disabled={loading}>
          {loading ? <><div className="spin" />Creating…</> : step === total - 1 ? <>{isVenue ? 'Launch venue' : 'Create event'} <ArrowRight size={16} /></> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();
  const { wl, isWL } = useWhiteLabel();
  const wlName = isWL ? (wl?.branding?.companyName || wl?.clientName || '') : '';
  const wlLogo = isWL ? (wl?.branding?.logoUrl || '') : '';
  const wlPrimary = isWL ? (wl?.branding?.primaryColor || '') : '';
  const wlHome = isWL ? (wl?.pages?.home || {}) : {};
  const brand = isWL ? wlName : 'PlanIt';

  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState('standard');
  const [picked, setPicked] = useState(false); // user has chosen a type, so copy + theme follow it
  const [selectedBranch, setSelectedBranch] = useState(null); // null | 'events' | 'rsvp' | 'venue'
  const [formData, setFormData] = useState({
    subdomain: '', title: '', description: '', date: '', timezone: getUserTimezone(), location: '',
    organizerName: '', organizerEmail: '', accountPassword: '', password: '', staffPassword: '',
    isEnterpriseMode: false, maxParticipants: 10000, agreeTerms: false, agreeResponsible: false, agreeGuestData: false, agreeAge: false,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [wizardKey, setWizardKey] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [abuseStatus, setAbuseStatus] = useState(null);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const submittedRef = useRef(false);
  const stepRef = useRef(null);
  const timing = useRef({ pageLoadedAt: Date.now(), formStartedAt: 0, firstInputAt: 0, largestPasteChars: 0, largestPasteElapsedMs: 0 });
  const m = MODES.find((x) => x.id === mode) || MODES[0];

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8); on();
    window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { // default the timezone from the visitor's location, never overriding a manual pick
    let off = false;
    detectTimezone(() => eventAPI.detectTimezone()).then((tz) => { if (!off && tz) setFormData((f) => (f._tzTouched || f.timezone !== getUserTimezone() ? f : { ...f, timezone: tz })); });
    return () => { off = true; };
  }, []);
  useEffect(() => { // the white-label landing page links here with ?new=1
    if (isWL && new URLSearchParams(window.location.search).get('new') === '1') setWizardOpen(true);
  }, [isWL]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setWizardOpen(false); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (!wizardOpen) return; const p = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = p; };
  }, [wizardOpen]);

  const pickMode = (id, target) => {
    setPicked(true); setSelectedBranch((b) => (b ? branchOf(id) : b));
    setMode(id); setFormData((p) => ({ ...p, isEnterpriseMode: id === 'enterprise' })); setWizardKey((k) => k + 1);
    if (target) setTimeout(() => { document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById(target === 'start' ? 'hero-title' : 'create-title')?.focus({ preventScroll: true }); }, 30);
  };
  const selectBranch = (id) => { pickMode(id); setSelectedBranch(branchOf(id)); setTimeout(() => document.getElementById('branch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const backToAll = () => { setSelectedBranch(null); setTimeout(() => document.getElementById('modes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const goHash = (e, href) => {
    if (!href.startsWith('#')) return;
    e.preventDefault(); setMenu(false);
    const go = () => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (selectedBranch && !['#start', '#create', '#branch'].includes(href)) { setSelectedBranch(null); setTimeout(go, 60); } else go();
  };
  const heroTitle = (e) => { const title = e.target.value; setFormData((p) => ({ ...p, title, subdomain: p._subdomainTouched ? p.subdomain : makeSubdomain(title) })); };
  const openWizard = () => { setFormData((p) => ({ ...p, isEnterpriseMode: mode === 'enterprise' })); setWizardKey((k) => k + 1); timing.current.formStartedAt = Date.now(); setWizardOpen(true); };

  const handleSubmit = async () => {
    const TS = mode === 'table-service', errs = {};
    if (!formData.title.trim()) errs.title = TS ? 'Restaurant name is required.' : 'Event title is required.';
    if (!TS && !formData.date) errs.date = 'Date and time is required.';
    if (!TS && !formData.timezone) errs.timezone = 'Timezone is required.';
    if (!formData.organizerName.trim()) errs.organizerName = TS ? 'Manager name is required.' : 'Your name is required.';
    if (!formData.organizerEmail.trim()) errs.organizerEmail = TS ? 'Manager email is required.' : 'Your email is required.';
    else if (!validateEmail(formData.organizerEmail.trim())) errs.organizerEmail = 'Please enter a valid email address.';
    if (!formData.accountPassword) errs.accountPassword = 'Account password is required.';
    else if (formData.accountPassword.length < 4) errs.accountPassword = 'Password must be at least 4 characters.';
    if (TS && formData.staffPassword && formData.staffPassword.length < 4) errs.staffPassword = 'Staff PIN must be at least 4 characters.';
    for (const c of LEGAL_CHECKS) if (!formData[c.key]) errs[c.key] = c.error;
    if (Object.keys(errs).length) { setFieldErrors(errs); return false; }
    setFieldErrors({}); setLoading(true);

    const dateValue = !TS && formData.date ? localDateTimeToUTC(formData.date, formData.timezone) : undefined;
    const payload = {
      title: sanitize(formData.title), description: sanitize(formData.description),
      ...(dateValue ? { date: dateValue, timezone: formData.timezone } : {}),
      location: sanitize(formData.location), organizerName: sanitize(formData.organizerName), organizerEmail: sanitize(formData.organizerEmail),
      accountPassword: formData.accountPassword, password: formData.password || undefined,
      staffPassword: TS && formData.staffPassword ? formData.staffPassword : undefined,
      subdomain: formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise' || formData.isEnterpriseMode, isTableServiceMode: TS,
      eventType: mode === 'rsvp' ? 'rsvpOnly' : 'standard', maxParticipants: formData.maxParticipants,
      agreedToTerms: true, legalVersion: LEGAL_VERSION, ...(turnstileToken ? { turnstileToken } : {}),
      behavior: { ...timing.current, submittedAt: Date.now(), formStartedAt: timing.current.formStartedAt || timing.current.pageLoadedAt },
      browserMeta: {
        webdriver: navigator.webdriver === true, language: navigator.language || '', platform: navigator.platform || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '', hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0, plugins: navigator.plugins ? Array.from(navigator.plugins).slice(0, 5).map((p) => p.name) : [], userAgent: navigator.userAgent || '',
      },
    };
    try {
      const res = await eventAPI.create(payload);
      localStorage.setItem('eventToken', res.data.token); localStorage.setItem('username', sanitize(formData.organizerName));
      setCreated(res.data.event);
      if (res.data.recoveryCode) setRecoveryCode(res.data.recoveryCode);
      submittedRef.current = true; localStorage.removeItem('planit_event_draft');
      trackFeature('event_creation_complete'); trackGAEvent('event_created', { event_type: formData.isEnterpriseMode ? 'enterprise' : 'standard' });
      setRequiresVerification(false); setAbuseStatus(null);
      return true;
    } catch (error) {
      const data = error.response?.data;
      const L = { date: 'Date and time', timezone: 'Timezone', title: TS ? 'Restaurant name' : 'Event title', organizerName: TS ? 'Manager name' : 'Your name', organizerEmail: TS ? 'Manager email' : 'Your email', accountPassword: 'Account password', password: TS ? 'Staff PIN' : 'Event password', subdomain: TS ? 'Restaurant URL' : 'Event URL', agreedToTerms: 'Terms agreement' };
      if (data?.requiresVerification || data?.code === 'VERIFICATION_REQUIRED' || data?.code === 'INVALID_VERIFICATION') {
        setRequiresVerification(true); setCaptchaResetKey((k) => k + 1); setTurnstileToken('');
        setAbuseStatus({ title: data?.code === 'INVALID_VERIFICATION' ? 'Invalid verification.' : 'Verification required.', message: data?.userMessage || 'Please complete the verification step to continue.' });
        return;
      }
      if (['TRY_AGAIN_LATER', 'ADDITIONAL_REVIEW_REQUIRED', 'SUBMISSION_RECEIVED'].includes(data?.code)) {
        setAbuseStatus({ title: 'Please try again.', message: data?.userMessage || 'We couldn\u2019t complete your request right now. Please try again shortly.' }); return;
      }
      if (Array.isArray(data?.errors)) {
        const se = {}, msgs = [];
        data.errors.forEach((e) => {
          const path = e.path || e.param || ''; if (path === 'date' && TS) return;
          const t = `${L[path] || path}: ${e.msg || e.message || 'Invalid value'}`; se[path] = t; msgs.push(t);
        });
        setFieldErrors(se);
        if (msgs.length === 1) toast.error(msgs[0]); else if (msgs.length) toast.error(`${msgs.length} fields need attention:\n${msgs.map((x) => `• ${x}`).join('\n')}`, { duration: 6000 });
      } else {
        const msg = data?.error || 'Failed to create', nameStep = TS ? 2 : mode === 'rsvp' ? 3 : 4;
        if (msg.includes('already taken')) { setFieldErrors({ subdomain: 'This URL is already taken. Please choose a different one.' }); stepRef.current?.goTo(1); }
        else if (msg.includes('not available')) { setFieldErrors({ subdomain: 'This URL is not available. Please choose a different one.' }); stepRef.current?.goTo(1); }
        else if (msg.includes('not allowed') || msg.toLowerCase().includes('display name')) { setFieldErrors({ organizerName: 'This display name is not allowed. Please choose a different one.' }); stepRef.current?.goTo(nameStep); }
        else if (msg.includes('email')) { setFieldErrors({ organizerEmail: 'Please enter a valid email address.' }); stepRef.current?.goTo(nameStep); }
        else if (msg.includes('password')) setFieldErrors({ accountPassword: 'Password must be at least 6 characters.' });
        else toast.error(msg || 'Something went wrong. Please check your details and try again.');
      }
      return false;
    } finally { setLoading(false); }
  };

  const doneLabel = { 'table-service': 'Open floor dashboard', enterprise: 'Set up guest invites', rsvp: 'Open RSVP dashboard' }[mode] || 'Enter your planning hub';
  const enterEvent = () => {
    const base = created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`;
    navigate(mode === 'table-service' ? `${base}/floor` : mode === 'rsvp' ? `${base}/rsvp-dashboard` : `${base}?new=1`);
  };
  const createdView = created && (
    <div className="done">
      <h3>{mode === 'table-service' ? 'Venue created.' : mode === 'rsvp' ? 'Your RSVP page is live.' : 'Event created.'}</h3>
      <p style={{ margin: 0, color: 'var(--mu)' }}>Share the link with your team and get started.</p>
      {mode !== 'table-service' && mode !== 'enterprise' && <CopyLinkBox eventId={created.id} subdomain={created.subdomain} mode={mode} />}
      {mode === 'table-service' && formData.staffPassword && <div className="link" style={{ display: 'block' }}><small>Staff login</small><br />Username <b>staff</b> · Password <b>{formData.staffPassword}</b><br /><small>Staff sign in at /login</small></div>}
      <button className="btn pri wide" onClick={enterEvent}>{doneLabel}</button>
    </div>
  );
  const th = THEME[mode] || THEME.standard;
  const hero = picked ? HERO[mode] : null;
  const feats = FEAT_BY_MODE[mode];
  const steps = STEPS_BY[mode];
  const uses = (mode === 'table-service' ? VENUE_TYPES : EVENT_TYPES).filter((t) => t[0] !== 'other');
  const nameLabel = mode === 'table-service' ? 'Venue name' : mode === 'rsvp' ? 'What are you hosting?' : 'Event name';
  const namePh = mode === 'table-service' ? 'Taverna Roma, The Oak Room…' : 'Summer Company Retreat 2026';
  const nav = isWL ? [['Discover', '/discover'], ['Help', '/help'], ['About', '/about']] : [['Features', '#features'], ['Modes', '#modes'], ['Claude', '#claude'], ['Discover', '/discover'], ['Blog', '/blog'], ['Help', '/help']];
  const startFree = (e) => { e.preventDefault(); setMenu(false); pickMode(mode, 'start'); };

  return (
    <div className="pi" style={isWL ? (wlPrimary ? { '--ac': wlPrimary, '--acs': `color-mix(in srgb, ${wlPrimary} 12%, white)` } : undefined) : { '--ac': th.ac, '--hl': th.hl, '--acs': th.acs, '--sh': th.sh }}>
      <InjectCSS />
      {recoveryCode && <RecoveryCodeModal code={recoveryCode} onDismiss={() => setRecoveryCode(null)} eventSlug={created?.subdomain} />}

      <header className={`nav${scrolled ? ' sc' : ''}`}>
        <div className="wrap">
          <a href="#top" className="brand" aria-label={`${brand} home`}>
            {isWL ? <span className="mark">{wlLogo ? <img src={wlLogo} alt="" /> : (brand.charAt(0) || 'P')}</span> : <Logo />}{brand}
          </a>
          <nav className="links" aria-label="Primary">
            {nav.map(([l, h]) => <a key={l} href={h} onClick={(e) => goHash(e, h)}>{l}</a>)}
            <a href="#start" className="btn pri sm" onClick={startFree}>Start free</a>
          </nav>
          <button className="burger" aria-label="Toggle menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)}>{menu ? <X /> : <Menu />}</button>
        </div>
        {menu && <div className="menu">{nav.map(([l, h]) => <a key={l} href={h} onClick={(e) => goHash(e, h)}>{l}</a>)}<a href="/terms">Terms</a><a href="/privacy">Privacy</a>
          <a href="#start" className="btn pri" onClick={startFree}>Start free</a></div>}
      </header>

      <main id="top">
        <section className="hero">
          <Burst className="d1 spin-slow" color={th.d1} size={96} /><Squiggle className="d2 float" color={th.d2} />
          <div className="wrap hero-g">
            <div>
              <span className="eye" key={`e${picked ? mode : 'x'}`}>{isWL ? 'Event platform' : hero ? hero.e : 'For event teams & venues'}</span>
              {wlHome.headline ? <h1>{wlHome.headline}</h1> : hero
                ? <h1 key={mode} className={`swap${hero.h.join('').length > 40 ? ' long' : ''}`}>{hero.h.map((l, i) => i === hero.h.length - 1 ? <em key={l}>{l}</em> : <span key={l}>{l}<br /></span>)}</h1>
                : <h1>Plan the night.<br /><em>Run the door.</em></h1>}
              <p className="lead" key={`l${picked ? mode : 'x'}`}>{isWL ? (wlHome.subheadline || wlName || 'Your event platform') : hero ? m.blurb : 'One workspace for events and hospitality: team chat, tasks, RSVPs, check-in, and a live floor manager for restaurants.'}</p>
              <SlugFinder />
            </div>
            <div className="panel" id="start">
              <span className="stick" aria-hidden="true">Free<br />forever</span>
              {created ? createdView : (
                <>
                  <h2 className="ph">Start free</h2>
                  <label className="l" htmlFor="hero-title">{nameLabel}</label>
                  <input id="hero-title" className="inp" value={formData.title} onChange={heroTitle} onKeyDown={(e) => e.key === 'Enter' && openWizard()} placeholder={namePh} autoComplete="off" />
                  <div className="perf" aria-hidden="true" />
                  <div className="choose" role="radiogroup" aria-label="Event mode">
                    {MODES.map((x) => (
                      <button key={x.id} type="button" role="radio" aria-checked={mode === x.id} data-mode={x.id} className={`ch${mode === x.id ? ' on' : ''}`} onClick={() => pickMode(x.id)}>
                        <span className="dot" />
                        <span style={{ flex: 1 }}><b>{x.tab}</b><small>{x.short}</small>
                          {mode === x.id && <span className="mini">{x.incl.slice(0, 4).map((i) => <span key={i}>{i}</span>)}</span>}</span>
                      </button>))}
                  </div>
                  <button className="btn pri wide" onClick={openWizard}>{m.cta}</button>
                  <p className="sub2">{m.sub}</p>
                  {!isWL && <p className="sub2" style={{ marginTop: 8 }}><button className="lnk" onClick={() => selectBranch(mode)}>See everything in {m.tab}</button></p>}
                  {mode === 'enterprise' && <div className="note"><AlertCircle size={15} style={{ marginTop: 2 }} />Mode cannot be changed after creation.</div>}
                </>
              )}
            </div>
          </div>
          <div className="wrap">
            {wlHome.heroImageUrl && <img className="hero-img" src={wlHome.heroImageUrl} alt="" />}
            <ul className="facts">{[['Free forever', 'No credit card, no per-seat pricing'], ['No guest accounts', 'Guests join by name with a personal QR'], ['Unlimited team', 'Organizers, vendors and volunteers'], ['Tidy by default', 'Event data auto-deleted 7 days after']].map(([t, d]) => <li key={t}><b>{t}</b>{d}</li>)}</ul>
          </div>
        </section>

        {!isWL && !selectedBranch && <div className="belt" aria-hidden="true"><div>{[0, 1].map((k) => feats.map(([, t]) => <span key={`${k}-${t}`}>{t}</span>))}</div></div>}

        {!isWL && selectedBranch && (() => {
          const b = BRANCHES[selectedBranch];
          const jump = () => pickMode(selectedBranch === 'rsvp' ? 'rsvp' : selectedBranch === 'venue' ? 'table-service' : (mode === 'enterprise' ? 'enterprise' : 'standard'), 'create');
          return (
            <section className={`sec br br-${selectedBranch}`} id="branch">
              <div className="wrap">
                <button className="back" onClick={backToAll}><ArrowRight size={15} style={{ transform: 'rotate(180deg)' }} />All options</button>
                <div className="br-h">
                  <div><span className="eye">{b.eyebrow}</span><h2>{b.h.map((l, i) => <span key={l} className={i === b.h.length - 1 ? 'hl' : ''}>{l}<br /></span>)}</h2></div>
                  <div><p className="br-p">{b.p}</p><div className="cta"><button className="btn dk" onClick={jump}>{b.cta} <ArrowRight size={16} /></button><span className="br-note">{b.note}</span></div></div>
                </div>
                <div className="sh2"><span className="eye">What&apos;s included</span><h3>{b.incTitle}</h3></div>
                <div className="feats br-f">{b.items.map(([I, t, d]) => <div className="feat" key={t}><I size={26} strokeWidth={1.7} /><h3>{t}</h3><p>{d}</p></div>)}</div>
                {selectedBranch === 'events' && (
                  <div className="callouts">
                    <div className="callout"><b>See it in action</b><p>Invites and RSVP pages guests actually want to share. Live countdowns, who else is going, a QR entry pass, and a personalized share card for every guest. Try the real thing, no account needed.</p><a className="btn pri sm" href="/demo/invite">Open the invite demo <ArrowUpRight size={14} /></a></div>
                    <div className="callout alt"><b>Enterprise Mode</b><p>Personalized QR invites, check-in dashboard, real-time attendance analytics. For 100+ guest events.</p><button className="btn dk sm" onClick={() => pickMode('enterprise', 'create')}>Choose Enterprise <ArrowRight size={14} /></button></div>
                  </div>)}
                {selectedBranch === 'rsvp' && (
                  <div style={{ marginTop: 64 }}>
                    <div className="sh2"><span className="eye">Compare</span><h3>Which one do you actually need?</h3></div>
                    <div className="vs">
                      <div className="vcard"><b><Calendar size={17} /> Standard Event</b><small>The full workspace</small>
                        <dl><div><dt>Setup time</dt><dd>~5–10 min</dd></div><div><dt>Included</dt><dd>Seating charts, floor management, enterprise check-in, RSVP page</dd></div><div><dt>Best for</dt><dd>Weddings, galas, multi-day events</dd></div></dl></div>
                      <div className="vcard on"><span className="tagl">Lightweight</span><b><CheckSquare size={17} /> RSVP Event</b><small>Just the RSVP page</small>
                        <dl><div><dt>Setup time</dt><dd>~1 min</dd></div><div><dt>Included</dt><dd>Guest list, RSVP builder, basic check-in, analytics</dd></div><div><dt>Intentionally left out</dt><dd>Seating charts, floor management, ticketing, advanced fraud detection</dd></div><div><dt>Best for</dt><dd>Parties, meetups, simple gatherings</dd></div></dl></div>
                    </div>
                  </div>)}
              </div>
            </section>
          );
        })()}

        {!isWL && !selectedBranch && (
          <section className="sec" id="uses">
            <div className="wrap">
              <div className="sh"><div><span className="eye">Built for</span><h2>{mode === 'table-service' ? 'Every kind of venue you run.' : 'Every kind of room you run.'}</h2></div><p>From a wedding for 80 to a conference floor to a Friday-night dining room, the same workspace fits.</p></div>
              <div className="uses">{uses.map(([id, l, h], i) => <div key={`${mode}-${id}`} className={`use u${i % 4}`}><b>{l}</b><span>{h}</span></div>)}</div>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec ink" id="how">
            <div className="wrap">
              <div className="sh"><div><span className="eye">How it works</span><h2>Live in about a minute.</h2></div><p>No setup call, no seat licences, no guest sign-ups. Three steps and your team is in.</p></div>
              <div className="steps">{steps.map(([t, d], i) => <div key={`${mode}-${t}`} className="stp"><i>{`0${i + 1}`}</i><h3>{t}</h3><p>{d}</p></div>)}</div>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec" id="modes">
            <div className="wrap">
              <div className="sh"><div><span className="eye">Compare</span><h2>Four ways to start. One workspace.</h2></div><p>Pick a column to see the whole page change to that type, or open one for the full story.</p></div>
              <div className="cols">
                {MODES.map((x) => (
                  <div className={`col${mode === x.id ? ' sel' : ''}`} key={x.id} style={{ '--c': THEME[x.id].ac, '--ch': THEME[x.id].hl }}>
                    <button className="colh" onClick={() => pickMode(x.id)} aria-pressed={mode === x.id}><span className="ico"><x.icon size={20} strokeWidth={1.9} /></span><h3>{x.tab}</h3></button>
                    <p>{x.blurb}</p>
                    <div className="best"><small>Best for</small><b>{x.best}</b></div>
                    <ul className="incl">{x.incl.map((i) => <li key={i}><Check size={14} />{i}</li>)}</ul>
                    <button className="lnk" onClick={() => selectBranch(x.id)}>Start with {x.tab} <ArrowRight size={14} style={{ verticalAlign: -2 }} /></button>
                  </div>))}
              </div>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec lav" id="features">
            <div className="wrap">
              <div className="sh"><div><span className="eye">Features</span><h2 key={mode} className="swap">{`What you get with ${m.tab}.`}</h2></div><p>{m.blurb}</p></div>
              <div className="feats" key={mode}>{feats.map(([I, t, d], i) => <div className={`feat ${(TINTS[feats.length] || [])[i] || ''}${(SPANS[feats.length] || [])[i] === 2 ? ' w2' : ''}`} key={t}><I size={26} strokeWidth={1.7} /><h3>{t}</h3><p>{d}</p></div>)}</div>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec yel" id="claude">
            <div className="wrap cl">
              <div>
                <span className="eye" style={{ background: '#fff' }}>Claude integration</span>
                <h2>Run your event by talking to Claude.</h2>
                <p className="sub">Add PlanIt to Claude once, then just ask. Build the guest list, set up seating, send announcements and watch check-ins without opening the dashboard.</p>
                <div className="cta">
                  <a className="btn dk" target="_blank" rel="noopener noreferrer" href="https://claude.ai/customize/connectors?modal=add-custom-connector&mcpName=PlanIt&mcpServerUrl=https://planit-mcp.onrender.com/mcp">Add to Claude <ArrowUpRight size={15} /></a>
                  <a className="btn" href="/help#claude">How it works</a><a className="btn" href="/mcp-docs">Docs</a>
                </div>
              </div>
              <ul className="say">{['\u201cAdd Sarah Jones, sarah@example.com\u201d', '\u201cHow many people have checked in so far?\u201d', '\u201cSend an announcement: doors open in 10 minutes\u201d', '\u201cCreate 15 round tables of 10\u201d'].map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec pk" id="white-label">
            <div className="wrap wlb">
              <div><span className="eye" style={{ background: '#fff' }}>White label</span><h2>Launch your own branded event platform.</h2><p>Run PlanIt under your own name, logo and colours, on your own domain.</p></div>
              <a className="btn dk" href="/white-label">Explore white label <ArrowUpRight size={15} /></a>
            </div>
          </section>
        )}

        {!isWL && !selectedBranch && (
          <section className="sec" id="faq">
            <div className="wrap">
              <div className="sh"><div><span className="eye">FAQ</span><h2>Good questions.</h2></div><p>The short answers. Anything else, the help centre has it.</p></div>
              <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
            </div>
          </section>
        )}

        <section className="sec ac" id="create">
          <div className="wrap">
            <div className="sh"><div><span className="eye">Get started</span><h2>Pick your event type.</h2></div><p>See what each one includes, then launch it. Takes about a minute and costs nothing.</p></div>
            <div className="cr">
              <div>
                <div className="mtabs" role="tablist" aria-label="Event type">
                  {MODES.map((x) => <button key={x.id} role="tab" aria-selected={mode === x.id} className={`mt${mode === x.id ? ' on' : ''}`} onClick={() => pickMode(x.id)}><x.icon size={17} />{x.tab}</button>)}
                </div>
                <h3 className="crh">{m.title}</h3>
                <p className="crp">{m.blurb}</p>
                <ul className="incl two">{m.incl.map((i) => <li key={i}><Check size={14} />{i}</li>)}</ul>
              </div>
              <div className="panel" style={{ marginTop: 0 }}>
                {created ? createdView : (
                  <>
                    <m.icon size={28} style={{ color: 'var(--ac)', marginBottom: 14 }} />
                    <h2 className="ph" style={{ fontSize: 24 }}>{m.launch}</h2>
                    <label className="l" htmlFor="create-title">{nameLabel}</label>
                    <input id="create-title" className="inp" value={formData.title} onChange={heroTitle} onKeyDown={(e) => e.key === 'Enter' && openWizard()} placeholder={namePh} autoComplete="off" />
                    <div className="perf" aria-hidden="true" />
                    <button className="btn pri wide" onClick={openWizard}>{m.cta}</button>
                    <p className="sub2">{m.sub}</p>
                    {mode === 'enterprise' && <div className="note"><AlertCircle size={15} style={{ marginTop: 2 }} />Mode cannot be changed after creation.</div>}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {wizardOpen && !created && (
        <div className="ov" role="dialog" aria-modal="true" aria-label="Create">
          <div className="wz">
            <button className="x" onClick={() => setWizardOpen(false)} aria-label="Close">×</button>
            {mode !== 'table-service' && (
              <div className="seg">
                {MODES.filter((x) => x.id !== 'table-service').map((x) => <button key={x.id} className={mode === x.id ? 'on' : ''} onClick={() => pickMode(x.id)}>{x.tab}</button>)}
              </div>)}
            <p className="wmeta"><b>{m.tab}:</b> {m.short}.</p>
            <Wizard key={wizardKey} mode={mode} formData={formData} setFormData={setFormData} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors}
              loading={loading} submittedRef={submittedRef} stepControlRef={stepRef} abuseStatus={abuseStatus} requiresVerification={requiresVerification}
              onCaptchaToken={setTurnstileToken} captchaResetKey={captchaResetKey}
              onUserInput={() => { if (!timing.current.firstInputAt) timing.current.firstInputAt = Date.now(); }}
              onUserPaste={(e) => { const len = e.clipboardData?.getData('text')?.length || 0; if (len > timing.current.largestPasteChars) { timing.current.largestPasteChars = len; timing.current.largestPasteElapsedMs = Date.now() - (timing.current.formStartedAt || timing.current.pageLoadedAt); } }}
              onSubmit={async () => { const ok = await handleSubmit(); if (ok) setWizardOpen(false); }} />
            <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--mu)', margin: '18px 0 0' }}>Press Esc to close</p>
          </div>
        </div>
      )}

      <footer className="foot">
        <div className="wrap">
          <div>
            <div><h4 style={{ fontSize: 22, fontFamily: 'Unbounded,sans-serif', color: '#fff' }}>{brand}</h4>{isWL && wlLogo && <img src={wlLogo} alt={brand} style={{ height: 32, objectFit: 'contain', marginBottom: 12 }} />}
              <p style={{ color: 'var(--mu)', fontSize: 14.5, maxWidth: 280, margin: 0 }}>{isWL ? '' : 'The planning hub for event teams, plus standalone RSVP pages when that\u2019s all you need.'}</p></div>
            {[['Product', [['Features', '#features'], ['Claude integration', '/help#claude'], ['Discover', '/discover'], ['Blog', '/blog'], ['Status', '/status'], ['Help', '/help'], ['Get started', '#start']]],
              ['Company', [['About', '/about'], ['Careers', '/careers'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['License', '/license'], ['Credits', '/credits']]],
              ['Connect', [['Contact / Support', '/support'], ['Wall of Supporters', '/support/wall'], ['System Status', '/status'], ['Help Center', '/help']]]].map(([t, ls]) => (
              <div key={t}><h4>{t}</h4><ul>{ls.map(([l, h]) => <li key={l}><a href={h} onClick={(e) => goHash(e, h)}>{l}</a></li>)}</ul></div>))}
          </div>
          <div className="fine"><span>© 2026 {brand}. All rights reserved.</span>{!isWL && <span>Built by Aakshat Hariharan</span>}</div>
        </div>
      </footer>
    </div>
  );
}
