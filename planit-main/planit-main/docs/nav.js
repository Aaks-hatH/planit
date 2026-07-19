(function () {
  const PAGE = window.CURRENT_PAGE || '';
  const pages = [
    { section: 'Overview', links: [
        { id: 'index',           href: 'index.html',           label: 'Introduction' },
        { id: 'getting-started', href: 'getting-started.html', label: 'Getting Started' },
    ]},
    { section: 'Features', links: [
        { id: 'invites',         href: 'invites.html',         label: 'Guest Invites' },
        { id: 'check-in',        href: 'check-in.html',        label: 'Check-in System' },
        { id: 'seating',         href: 'seating.html',         label: 'Seating Maps' },
        { id: 'walkie-talkie',   href: 'walkie-talkie.html',   label: 'Walkie-Talkie' },
        { id: 'planning-tools',  href: 'planning-tools.html',  label: 'Planning Tools' },
        { id: 'table-service',   href: 'table-service.html',   label: 'Table Service Mode' },
    ]},
    { section: 'Security & Data', links: [
        { id: 'security',        href: 'security.html',        label: 'Security & Passwords' },
        { id: 'infrastructure',  href: 'infrastructure.html',  label: 'Infrastructure' },
    ]},
    { section: 'Reference', links: [
        { id: 'integrations',    href: 'integrations.html',    label: 'Integrations & QR' },
        { id: 'admin',           href: 'admin.html',           label: 'Admin Panel' },
        { id: 'troubleshooting', href: 'troubleshooting.html', label: 'Troubleshooting' },
        { id: 'faq',             href: 'faq.html',             label: 'FAQ' },
    ]}
  ];

  const icons = {
    'index':          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6.5L8 2l6 4.5V14H2V6.5z"/><path d="M5.5 14v-4h5v4"/></svg>',
    'getting-started':'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2s3 1.5 3 5.5c0 2-1.5 4-3 4.5-1.5-.5-3-2.5-3-4.5C5 3.5 8 2 8 2z"/></svg>',
    'invites':        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="4.5" width="12" height="7" rx="1.5"/><path d="M10 4.5v7"/></svg>',
    'check-in':       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3h3M14 5V3h-3M2 11v2h3M14 11v2h-3M2 8h12"/></svg>',
    'seating':        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
    'walkie-talkie':  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="1.5" width="5" height="7" rx="2.5"/><path d="M3 8a5 5 0 0010 0"/><line x1="8" y1="13" x2="8" y2="14.5"/></svg>',
    'planning-tools': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4h8M2 8h6M2 12h4"/><polyline points="10 10 12 12 15 8"/></svg>',
    'table-service':  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3v4M3 7c0 2 2 3 2 5v3M11 3v3a3 3 0 01-3 3v8"/></svg>',
    'security':       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2l5 2.5V9c0 2.5-2 4.5-5 5-3-1-5-2.5-5-5V4.5L8 2z"/></svg>',
    'infrastructure': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/></svg>',
    'integrations':   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9.5 6.5l-4 4"/><path d="M7 4.5L9 2.5a3 3 0 114.2 4.2L11 8.5"/></svg>',
    'admin':          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="6" r="2.5"/><path d="M3 14s1-4 5-4 5 4 5 4"/></svg>',
    'troubleshooting':'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2L2 13h12L8 2z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12" r=".6" fill="currentColor" stroke="none"/></svg>',
    'faq':            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M6.5 6a1.7 1.7 0 013.3.6c0 1.5-1.8 1.8-1.8 3"/><circle cx="8" cy="12" r=".6" fill="currentColor" stroke="none"/></svg>',
  };

  function buildSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.innerHTML = '';
    pages.forEach(({ section, links }) => {
      const sec = document.createElement('div');
      sec.className = 'nav-section';
      sec.innerHTML = `<div class="nav-section-label">${section}</div>`;
      links.forEach(({ id, href, label }) => {
        const a = document.createElement('a');
        a.href = href;
        a.className = 'nav-link' + (id === PAGE ? ' active' : '');
        a.innerHTML = (icons[id] || '') + label;
        a.dataset.searchLabel = label.toLowerCase();
        sec.appendChild(a);
      });
      nav.appendChild(sec);
    });
  }

  function buildSearchBox() {
    const input = document.querySelector('.sidebar-search-input');
    if (!input) return;
    input.addEventListener('input', function () {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.nav-link').forEach(a => {
        a.style.display = (!q || (a.dataset.searchLabel||'').includes(q)) ? '' : 'none';
      });
      document.querySelectorAll('.nav-section').forEach(sec => {
        const any = [...sec.querySelectorAll('.nav-link')].some(a => a.style.display !== 'none');
        sec.style.display = any ? '' : 'none';
      });
    });
    document.addEventListener('keydown', e => {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); input.focus(); input.select();
      }
      if (e.key === 'Escape') input.blur();
    });
  }

  function buildMobileToggle() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle  = document.querySelector('.menu-toggle');
    if (!toggle || !sidebar || !overlay) return;
    toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('open'); });
    overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });
  }

  function buildRightTOC() {
    const container = document.querySelector('.toc-right');
    if (!container) return;
    const headings = [...document.querySelectorAll('.content h2,.content h3')];
    if (headings.length < 3) return;
    container.innerHTML = '<div class="toc-right-title">On this page</div>';
    headings.forEach(h => {
      if (!h.id) return;
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'toc-right-link' + (h.tagName === 'H3' ? ' sub' : '');
      a.textContent = h.textContent.trim();
      container.appendChild(a);
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const link = container.querySelector(`a[href="#${e.target.id}"]`);
        if (link) link.classList.toggle('active', e.isIntersecting);
      });
    }, { rootMargin: '-10% 0px -80% 0px' });
    headings.forEach(h => h.id && observer.observe(h));
  }

  function buildCopyButtons() {
    document.querySelectorAll('pre').forEach(pre => {
      const header = pre.previousElementSibling;
      const btn = makeCopyBtn(pre);
      if (header && header.classList.contains('code-header')) {
        header.appendChild(btn);
      } else {
        let wrap = pre.closest('.code-block-wrap');
        if (!wrap) { wrap = document.createElement('div'); wrap.className = 'code-block-wrap'; pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre); }
        btn.style.cssText = 'position:absolute;top:10px;right:10px;';
        wrap.style.position = 'relative';
        wrap.appendChild(btn);
      }
    });
  }

  function makeCopyBtn(pre) {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = copyIcon() + 'Copy';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent || '').then(() => {
        btn.innerHTML = checkIcon() + 'Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = copyIcon() + 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
    return btn;
  }

  function buildTabs() {
    document.querySelectorAll('.tabs').forEach(el => {
      const btns = el.querySelectorAll('.tab-btn'), panels = el.querySelectorAll('.tab-panel');
      btns.forEach((btn, i) => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active')); panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active'); if (panels[i]) panels[i].classList.add('active');
      }));
      if (btns[0]) btns[0].classList.add('active'); if (panels[0]) panels[0].classList.add('active');
    });
  }

  function buildURLBuilder() {
    document.querySelectorAll('.url-builder').forEach(ub => {
      const input = ub.querySelector('.url-builder-input'), output = ub.querySelector('.url-builder-output'), btn = ub.querySelector('.url-builder-btn');
      const tpl = ub.dataset.template || 'https://planitapp.onrender.com/invite/{code}';
      if (!input || !output) return;
      const update = () => { const c = (input.value||'AB12CD34').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); output.textContent = tpl.replace('{code}',c); };
      input.addEventListener('input', update); update();
      if (btn) btn.addEventListener('click', () => { navigator.clipboard.writeText(output.textContent); btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy URL', 2000); });
    });
  }

  function buildBoardingPassDemo() {
    document.querySelectorAll('.bp-admit').forEach(btn => btn.addEventListener('click', () => {
      const panel = btn.closest('.demo-panel'); if (!panel) return;
      panel.innerHTML = `<div style="padding:40px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">✅</div><div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:#10b981;">Guest Admitted</div><div style="font-size:13px;color:var(--text-3);margin-top:4px;">Table 12 · Adults: 2 · Children: 0</div></div>`;
    }));
    document.querySelectorAll('.bp-deny').forEach(btn => btn.addEventListener('click', () => {
      const bp = btn.closest('.demo-panel')?.querySelector('.boarding-pass'); if (bp) { bp.style.borderColor='rgba(239,68,68,0.4)'; bp.style.background='rgba(239,68,68,0.04)'; }
      btn.textContent = 'Entry Denied'; btn.style.background = 'rgba(239,68,68,0.15)';
    }));
  }

  function buildFAQSearch() {
    const search = document.querySelector('.faq-search'); if (!search) return;
    search.addEventListener('input', function () {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('details.faq-item').forEach(item => item.classList.toggle('hidden', !!q && !item.textContent.toLowerCase().includes(q)));
      document.querySelectorAll('.faq-group').forEach(g => { g.style.display = [...g.querySelectorAll('details.faq-item')].some(i=>!i.classList.contains('hidden'))?'':'none'; });
    });
  }

  function animateStats() {
    document.querySelectorAll('.stat-num[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10), suffix = el.dataset.suffix||'', dur = 1200, t0 = performance.now();
      const tick = now => { const p=Math.min((now-t0)/dur,1),e=1-Math.pow(1-p,3); el.textContent=Math.round(target*e)+suffix; if(p<1) requestAnimationFrame(tick); };
      new IntersectionObserver(entries => { if(entries[0].isIntersecting) requestAnimationFrame(tick); }).observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar(); buildSearchBox(); buildMobileToggle(); buildRightTOC();
    buildCopyButtons(); buildTabs(); buildURLBuilder(); buildBoardingPassDemo();
    buildFAQSearch(); animateStats();
  });

  function svgI(p){ return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${p}</svg>`; }
  function copyIcon()  { return svgI('<rect x="4" y="4" width="9" height="11" rx="1.5"/><path d="M7 4V3a1 1 0 011-1h5a1 1 0 011 1v8a1 1 0 01-1 1h-1"/>'); }
  function checkIcon() { return svgI('<polyline points="2 8 6 12 14 4"/>'); }
})();
