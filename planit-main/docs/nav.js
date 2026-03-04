// nav.js — PlanIt Docs navigation, search, TOC, and interactive features
(function () {
  const PAGE = window.CURRENT_PAGE || '';

  const pages = [
    {
      section: 'Overview',
      links: [
        { id: 'index',           href: 'index.html',           label: 'Introduction',       icon: homeIcon() },
        { id: 'getting-started', href: 'getting-started.html', label: 'Getting Started',    icon: rocketIcon() },
      ]
    },
    {
      section: 'Features',
      links: [
        { id: 'invites',         href: 'invites.html',         label: 'Guest Invites',      icon: ticketIcon() },
        { id: 'check-in',        href: 'check-in.html',        label: 'Check-in System',   icon: scanIcon() },
        { id: 'seating',         href: 'seating.html',         label: 'Seating Maps',       icon: gridIcon() },
        { id: 'walkie-talkie',   href: 'walkie-talkie.html',   label: 'Walkie-Talkie',      icon: micIcon() },
      ]
    },
    {
      section: 'Reference',
      links: [
        { id: 'integrations',    href: 'integrations.html',    label: 'Integrations & QR',  icon: linkIcon() },
        { id: 'faq',             href: 'faq.html',             label: 'FAQ',                icon: helpIcon() },
      ]
    }
  ];

  function buildSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.innerHTML = '';
    pages.forEach(({ section, links }) => {
      const sec = document.createElement('div');
      sec.className = 'nav-section';
      sec.innerHTML = `<div class="nav-section-label">${section}</div>`;
      links.forEach(({ id, href, label, icon }) => {
        const a = document.createElement('a');
        a.href = href;
        a.className = 'nav-link' + (id === PAGE ? ' active' : '');
        a.innerHTML = icon + label;
        a.dataset.searchLabel = label.toLowerCase();
        sec.appendChild(a);
      });
      nav.appendChild(sec);
    });
  }

  function buildSearchBox() {
    const wrap = document.querySelector('.sidebar-search-wrap');
    if (!wrap) return;
    const input = wrap.querySelector('.sidebar-search-input');
    if (!input) return;

    input.addEventListener('input', function () {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.nav-link').forEach(a => {
        const label = a.dataset.searchLabel || '';
        const show = !q || label.includes(q);
        a.style.display = show ? '' : 'none';
      });
      document.querySelectorAll('.nav-section-label').forEach(lbl => {
        const sec = lbl.closest('.nav-section');
        if (!sec) return;
        const anyVisible = [...sec.querySelectorAll('.nav-link')].some(a => a.style.display !== 'none');
        sec.style.display = anyVisible ? '' : 'none';
      });
    });

    // Keyboard shortcut: / or K to focus search
    document.addEventListener('keydown', function (e) {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === 'Escape') input.blur();
    });
  }

  function buildMobileToggle() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.querySelector('.menu-toggle');
    if (!toggle || !sidebar || !overlay) return;
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  function buildRightTOC() {
    const container = document.querySelector('.toc-right');
    if (!container) return;
    const headings = [...document.querySelectorAll('.content h2, .content h3')];
    if (headings.length < 3) return;

    container.innerHTML = '<div class="toc-right-title">On this page</div>';
    headings.forEach(h => {
      if (!h.id) return;
      const link = document.createElement('a');
      link.href = '#' + h.id;
      link.className = 'toc-right-link' + (h.tagName === 'H3' ? ' sub' : '');
      link.textContent = h.textContent.replace(/¶$/, '').trim();
      container.appendChild(link);
    });

    // Scroll spy
    const links = container.querySelectorAll('.toc-right-link');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const id = e.target.id;
        const link = container.querySelector(`a[href="#${id}"]`);
        if (link) link.classList.toggle('active', e.isIntersecting);
      });
    }, { rootMargin: '-10% 0px -80% 0px' });
    headings.forEach(h => h.id && observer.observe(h));
  }

  function buildCopyButtons() {
    document.querySelectorAll('pre').forEach(pre => {
      const wrap = pre.closest('.code-block-wrap');
      let header = pre.previousElementSibling;
      if (header && header.classList.contains('code-header')) {
        const btn = buildCopyBtn(pre);
        header.appendChild(btn);
      } else {
        // Wrap in code-block-wrap if not already
        if (!wrap) {
          const w = document.createElement('div');
          w.className = 'code-block-wrap';
          pre.parentNode.insertBefore(w, pre);
          w.appendChild(pre);
        }
        const btn = buildCopyBtn(pre);
        btn.style.cssText = 'position:absolute;top:10px;right:10px;';
        (pre.closest('.code-block-wrap') || pre.parentNode).style.position = 'relative';
        (pre.closest('.code-block-wrap') || pre.parentNode).appendChild(btn);
      }
    });
  }

  function buildCopyBtn(pre) {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = copyIcon() + 'Copy';
    btn.addEventListener('click', () => {
      const text = pre.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = checkIcon() + 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = copyIcon() + 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
    return btn;
  }

  function buildTabs() {
    document.querySelectorAll('.tabs').forEach(tabsEl => {
      const btns = tabsEl.querySelectorAll('.tab-btn');
      const panels = tabsEl.querySelectorAll('.tab-panel');
      btns.forEach((btn, i) => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('active'));
          panels.forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          if (panels[i]) panels[i].classList.add('active');
        });
      });
      if (btns[0]) btns[0].classList.add('active');
      if (panels[0]) panels[0].classList.add('active');
    });
  }

  function buildSecurityLevels() {
    document.querySelectorAll('.security-levels').forEach(container => {
      const levels = container.querySelectorAll('.sec-level');
      levels.forEach(lv => {
        lv.addEventListener('click', () => {
          levels.forEach(l => l.classList.remove('active-sec'));
          lv.classList.add('active-sec');
          const desc = container.nextElementSibling;
          if (desc && desc.classList.contains('sec-level-detail')) {
            const id = lv.dataset.level;
            desc.querySelectorAll('[data-level-detail]').forEach(d => {
              d.style.display = d.dataset.levelDetail === id ? '' : 'none';
            });
          }
        });
      });
    });
  }

  function buildURLBuilder() {
    document.querySelectorAll('.url-builder').forEach(ub => {
      const input = ub.querySelector('.url-builder-input');
      const output = ub.querySelector('.url-builder-output');
      const btn = ub.querySelector('.url-builder-btn');
      const template = ub.dataset.template || 'https://planitapp.onrender.com/{endpoint}/{code}';
      if (!input || !output) return;
      function update() {
        const code = (input.value || 'AB12CD34').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        output.textContent = template.replace('{code}', code);
      }
      input.addEventListener('input', update);
      update();
      if (btn) btn.addEventListener('click', () => {
        navigator.clipboard.writeText(output.textContent);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy URL', 2000);
      });
    });
  }

  function buildBoardingPassDemo() {
    document.querySelectorAll('.bp-admit').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.closest('.demo-panel');
        if (!panel) return;
        const orig = panel.innerHTML;
        panel.innerHTML = `
          <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 32px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
            <div style="font-family: var(--font-head); font-size: 20px; font-weight: 700; color: #10b981; margin-bottom: 6px;">Guest Admitted</div>
            <div style="font-size: 13px; color: var(--text-3);">Table 12 • Adults: 2 • Children: 0</div>
            <button onclick="this.closest('.demo-panel').innerHTML = \`${orig.replace(/`/g, '\\`')}\`" style="margin-top: 16px; background: var(--bg-3); border: 1px solid var(--border-2); color: var(--text-2); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-family: var(--font-body); font-size: 12px;">Reset demo</button>
          </div>`;
      });
    });
    document.querySelectorAll('.bp-deny').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.closest('.demo-panel');
        if (!panel) return;
        panel.querySelector('.boarding-pass').style.borderColor = 'rgba(239,68,68,0.4)';
        panel.querySelector('.boarding-pass').style.background = 'rgba(239,68,68,0.04)';
        btn.textContent = 'Entry Denied';
        btn.style.background = 'rgba(239,68,68,0.15)';
      });
    });
  }

  function buildFAQSearch() {
    const search = document.querySelector('.faq-search');
    if (!search) return;
    search.addEventListener('input', function () {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('details.faq-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.classList.toggle('hidden', !!q && !text.includes(q));
      });
      document.querySelectorAll('.faq-group').forEach(group => {
        const anyVisible = [...group.querySelectorAll('details.faq-item')].some(i => !i.classList.contains('hidden'));
        group.style.display = anyVisible ? '' : 'none';
      });
    });
  }

  function animateStats() {
    document.querySelectorAll('.stat-num[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      let start = 0;
      const duration = 1200;
      const startTime = performance.now();
      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * ease) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { requestAnimationFrame(tick); observer.disconnect(); }
      });
      observer.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar();
    buildSearchBox();
    buildMobileToggle();
    buildRightTOC();
    buildCopyButtons();
    buildTabs();
    buildSecurityLevels();
    buildURLBuilder();
    buildBoardingPassDemo();
    buildFAQSearch();
    animateStats();
  });

  // ── SVG icon helpers ────────────────────────────────────────
  function svgIcon(path, vb) {
    return `<svg viewBox="${vb||'0 0 16 16'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }
  function homeIcon()   { return svgIcon('<path d="M2 6.5L8 2l6 4.5V14H2V6.5z"/><path d="M5.5 14v-4h5v4"/>'); }
  function rocketIcon() { return svgIcon('<path d="M8 2s3 1.5 3 5.5c0 2-1.5 4-3 4.5-1.5-.5-3-2.5-3-4.5C5 3.5 8 2 8 2z"/><path d="M5 10l-2.5 3.5M11 10l2.5 3.5"/><circle cx="8" cy="7" r="1.2"/>'); }
  function ticketIcon() { return svgIcon('<rect x="2" y="4.5" width="12" height="7" rx="1.5"/><path d="M10 4.5v7M2 7.5h2M2 9h2M12 7.5h2M12 9h2"/>'); }
  function scanIcon()   { return svgIcon('<path d="M2 5V3h3M14 5V3h-3M2 11v2h3M14 11v2h-3M2 8h12"/>'); }
  function gridIcon()   { return svgIcon('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'); }
  function micIcon()    { return svgIcon('<rect x="5.5" y="1.5" width="5" height="7" rx="2.5"/><path d="M3 8a5 5 0 0010 0"/><line x1="8" y1="13" x2="8" y2="14.5"/>'); }
  function linkIcon()   { return svgIcon('<path d="M9.5 6.5l-4 4"/><path d="M7 4.5L9 2.5a3 3 0 114.2 4.2L11 8.5"/>'); }
  function helpIcon()   { return svgIcon('<circle cx="8" cy="8" r="6"/><path d="M6.5 6a1.7 1.7 0 013.3.6c0 1.5-1.8 1.8-1.8 3"/><circle cx="8" cy="12" r=".6" fill="currentColor" stroke="none"/>'); }
  function copyIcon()   { return svgIcon('<rect x="4" y="4" width="9" height="11" rx="1.5"/><path d="M7 4V3a1 1 0 011-1h5a1 1 0 011 1v8a1 1 0 01-1 1h-1"/>'); }
  function checkIcon()  { return svgIcon('<polyline points="2 8 6 12 14 4"/>'); }
})();
