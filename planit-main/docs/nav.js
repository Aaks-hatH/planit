// nav.js — injects sidebar nav and mobile toggle into all pages
// Each page sets window.CURRENT_PAGE before including this script

(function () {
  const PAGE = window.CURRENT_PAGE || '';

  const pages = [
    {
      section: 'Overview',
      links: [
        { id: 'index',          href: 'index.html',          label: 'What is PlanIt?',      icon: homeIcon() },
        { id: 'getting-started',href: 'getting-started.html', label: 'Getting Started',      icon: rocketIcon() },
      ]
    },
    {
      section: 'Using PlanIt',
      links: [
        { id: 'invites',        href: 'invites.html',         label: 'Guest Invites',        icon: ticketIcon() },
        { id: 'check-in',       href: 'check-in.html',        label: 'Check-in System',      icon: scanIcon() },
        { id: 'seating',        href: 'seating.html',         label: 'Seating Maps',         icon: gridIcon() },
        { id: 'walkie-talkie',  href: 'walkie-talkie.html',   label: 'Walkie-Talkie',        icon: micIcon() },
      ]
    },
    {
      section: 'Organiser Tools',
      links: [
        { id: 'admin',          href: 'admin.html',           label: 'Admin Panel',          icon: shieldIcon() },
        { id: 'integrations',   href: 'integrations.html',    label: 'Integrations & QR',    icon: linkIcon() },
      ]
    },
    {
      section: 'Support',
      links: [
        { id: 'faq',            href: 'faq.html',             label: 'FAQ',                  icon: helpIcon() },
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
        sec.appendChild(a);
      });
      nav.appendChild(sec);
    });
  }

  function buildMobileToggle() {
    const topbar = document.querySelector('.topbar');
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

  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar();
    buildMobileToggle();
  });

  // ── Icon helpers ──
  function svgIcon(path) {
    return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }
  function homeIcon()   { return svgIcon('<path d="M2 6.5L8 2l6 4.5V14H2V6.5z"/><path d="M5.5 14v-4h5v4"/>'); }
  function rocketIcon() { return svgIcon('<path d="M8 2s3 1.5 3 5.5c0 2-1.5 4-3 4.5-1.5-.5-3-2.5-3-4.5C5 3.5 8 2 8 2z"/><path d="M5 10l-2.5 3.5M11 10l2.5 3.5"/><circle cx="8" cy="7" r="1.2"/>'); }
  function ticketIcon() { return svgIcon('<rect x="2" y="4.5" width="12" height="7" rx="1.5"/><path d="M10 4.5v7M2 7.5h2M2 9h2M12 7.5h2M12 9h2"/>'); }
  function scanIcon()   { return svgIcon('<path d="M2 5V3h3M14 5V3h-3M2 11v2h3M14 11v2h-3M2 8h12"/><rect x="4" y="5" width="3" height="3" rx=".5"/><rect x="9" y="5" width="3" height="3" rx=".5"/><rect x="4" y="8.5" width="3" height="2.5" rx=".5"/>'); }
  function gridIcon()   { return svgIcon('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'); }
  function micIcon()    { return svgIcon('<rect x="5.5" y="1.5" width="5" height="7" rx="2.5"/><path d="M3 8a5 5 0 0010 0"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="5.5" y1="14.5" x2="10.5" y2="14.5"/>'); }
  function shieldIcon() { return svgIcon('<path d="M8 2l5 2.5V9c0 2.5-2 4.5-5 5-3-1-5-2.5-5-5V4.5L8 2z"/>'); }
  function linkIcon()   { return svgIcon('<path d="M9.5 6.5l-4 4"/><path d="M7 4.5L9 2.5a3 3 0 114.2 4.2L11 8.5"/><path d="M5 11.5L3 13.5A3 3 0 11-1.2 9.3L1 7.5"/>'); }
  function helpIcon()   { return svgIcon('<circle cx="8" cy="8" r="6"/><path d="M6.5 6a1.7 1.7 0 013.3.6c0 1.5-1.8 1.8-1.8 3"/><circle cx="8" cy="12" r=".6" fill="currentColor" stroke="none"/>'); }
})();
