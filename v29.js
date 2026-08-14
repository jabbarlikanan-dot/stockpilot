(() => {
  const path = location.pathname.split('/').pop() || 'dashboard.html';
  const page = path.replace('.html','') || 'dashboard';
  document.body.dataset.page = page;

  // Skip navigation improves keyboard/screen-reader navigation.
  const main = document.querySelector('.app-main, main');
  if (main && !document.querySelector('.skip-link')) {
    main.id ||= 'main-content';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Əsas məzmuna keç';
    document.body.prepend(skip);
  }

  // Make sidebar information architecture explicit.
  const nav = document.querySelector('.app-nav');
  if (nav && !nav.querySelector('.nav-section-label')) {
    const items = [...nav.children].filter(el => el.matches('a,button'));
    const inventory = items.find(el => (el.getAttribute('href') || '').includes('inventory'));
    const settings = items.find(el => el.id === 'openSettings' || (el.getAttribute('href') || '').includes('tariff'));
    const insertLabel = (before, text) => {
      if (!before) return;
      const label = document.createElement('span');
      label.className = 'nav-section-label';
      label.textContent = text;
      label.setAttribute('aria-hidden','true');
      nav.insertBefore(label, before);
    };
    insertLabel(inventory, 'Məhsullar');
    insertLabel(settings, 'Hesab və sistem');
  }

  // Current page semantics.
  document.querySelectorAll('.app-nav a, .mobile-bottom a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const hrefPage = href.split('?')[0].split('#')[0];
    if (hrefPage && (hrefPage === path || (path === '' && hrefPage === 'dashboard.html'))) {
      link.setAttribute('aria-current','page');
    }
  });

  // Sidebar control semantics.
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  const sidebar = document.querySelector('.app-sidebar');
  const shell = document.querySelector('.app-shell');
  const syncSidebarAria = () => {
    if (!sidebarToggle || !sidebar || !shell) return;
    sidebar.id ||= 'primary-sidebar';
    sidebarToggle.setAttribute('aria-controls', sidebar.id);
    sidebarToggle.setAttribute('aria-expanded', String(!shell.classList.contains('is-sidebar-compact')));
    sidebarToggle.setAttribute('aria-label', shell.classList.contains('is-sidebar-compact') ? 'Menyunu genişləndir' : 'Menyunu yığ');
  };
  syncSidebarAria();
  sidebarToggle?.addEventListener('click', () => requestAnimationFrame(syncSidebarAria));

  // More menu semantics.
  document.querySelectorAll('.topbar-more').forEach(details => {
    const summary = details.querySelector('summary');
    if (!summary) return;
    summary.setAttribute('aria-haspopup','menu');
    const sync = () => summary.setAttribute('aria-expanded', String(details.open));
    sync();
    details.addEventListener('toggle', sync);
    details.addEventListener('keydown', e => {
      if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
    });
  });

  // Search/filter labels that were previously placeholder-only.
  const inventorySearch = document.getElementById('search');
  if (inventorySearch) inventorySearch.setAttribute('aria-label','Məhsul və ya sifariş üzrə axtar');
  const healthFilters = document.getElementById('healthFilters');
  if (healthFilters) {
    healthFilters.setAttribute('role','group');
    healthFilters.querySelectorAll('button').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
      btn.addEventListener('click', () => requestAnimationFrame(() => {
        healthFilters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
      }));
    });
  }

  // Customer layout switch gets pressed state and readable labels.
  const syncCustomerSwitch = () => {
    document.querySelectorAll('[data-customer-layout]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.classList.contains('primary')));
      btn.setAttribute('title', btn.dataset.customerLayout === 'board' ? 'Sifarişləri status sütunlarında göstər' : 'Sifarişləri siyahı kimi göstər');
    });
  };
  syncCustomerSwitch();

  // Dialog semantics + focus management for dynamically rendered inspector/modal.
  const overlay = document.getElementById('modal');
  const dialog = overlay?.querySelector('.modal');
  const close = document.getElementById('closeModal');
  let lastFocus = null;
  if (overlay && dialog) {
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    if (document.getElementById('modalTitle')) dialog.setAttribute('aria-labelledby','modalTitle');
    close?.setAttribute('aria-label','Pəncərəni bağla');

    const focusables = () => [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
    const opened = () => !overlay.classList.contains('hidden');
    const onKey = e => {
      if (!opened()) return;
      if (e.key === 'Escape') { close?.click(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) { e.preventDefault(); dialog.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const observer = new MutationObserver(() => {
      if (opened()) {
        if (!dialog.contains(document.activeElement)) {
          lastFocus = document.activeElement;
          requestAnimationFrame(() => (close || focusables()[0] || dialog).focus());
        }
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
        if (lastFocus?.isConnected) requestAnimationFrame(() => lastFocus.focus());
      }
    });
    observer.observe(overlay,{attributes:true,attributeFilter:['class']});
  }

  // Keep dynamically re-rendered customer controls accessible.
  const content = document.getElementById('content');
  if (content) new MutationObserver(syncCustomerSwitch).observe(content,{childList:true,subtree:true});

  // Status/count areas should announce updates without interrupting the user.
  document.getElementById('inventoryStats')?.setAttribute('aria-live','polite');
  document.getElementById('operationsHub')?.setAttribute('aria-live','polite');
})();
