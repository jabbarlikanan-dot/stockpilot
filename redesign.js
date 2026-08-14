(() => {
  const isEditable = (el) => el && (el.matches?.('input,textarea,select,[contenteditable="true"]'));
  const internalPages = [
    { label: 'Şəxsi sifarişlər', href: 'dashboard.html', keywords: 'sifariş satış alış dashboard' },
    { label: 'Müştəri sifarişləri', href: 'customer-orders.html', keywords: 'müştəri order' },
    { label: 'Stok nəzarəti', href: 'inventory.html', keywords: 'stok məhsul inventory' },
    { label: 'Ümumi statistika', href: 'account.html', keywords: 'statistika hesab gəlir qazanc' },
    { label: 'Bildirişlər', href: 'notifications.html', keywords: 'bildiriş notification' },
    { label: 'Profil ayarları', href: 'profile.html', keywords: 'profil hesab ayar' }
  ];

  const inApp = !!document.querySelector('.app-shell');
  if (inApp) {
    const style = document.createElement('style');
    style.textContent = `
      .sp-command-backdrop{position:fixed;inset:0;z-index:260;display:grid;place-items:start center;padding:12vh 14px 20px;background:#0009;backdrop-filter:blur(9px)}
      .sp-command{width:min(560px,100%);overflow:hidden;border:1px solid #35412e;border-radius:18px;background:#11170f;box-shadow:0 34px 110px #000c}
      .sp-command-search{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #293323}
      .sp-command-search svg{width:19px;height:19px;stroke:#8e9a88;fill:none;stroke-width:2}
      .sp-command-search input{min-height:44px!important;border:0!important;background:transparent!important;box-shadow:none!important;padding:8px 4px!important;font-size:15px}
      .sp-command-list{display:grid;gap:3px;max-height:360px;overflow:auto;padding:8px}
      .sp-command-item{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:10px 12px;border:1px solid transparent;border-radius:11px;color:#dce5d6;text-decoration:none;font-weight:750}
      .sp-command-item:hover,.sp-command-item.active{border-color:#39472f;background:#1a2317;color:#c6d92c}
      .sp-command-item small{color:#6f7d69;font-weight:700}
      .sp-command-empty{padding:22px;color:#7d8977;text-align:center}
      .sp-command-hint{display:flex;justify-content:space-between;gap:8px;padding:9px 12px;border-top:1px solid #293323;color:#65715f;font-size:11px}
      .sp-command-hint kbd{padding:2px 6px;border:1px solid #33402c;border-radius:6px;background:#171f14;color:#aab5a4;font:700 10px/1.5 inherit}
    `;
    document.head.appendChild(style);

    let backdrop = null;
    const closePalette = () => { backdrop?.remove(); backdrop = null; };
    const openPalette = () => {
      if (backdrop) return;
      backdrop = document.createElement('div');
      backdrop.className = 'sp-command-backdrop';
      backdrop.innerHTML = `
        <section class="sp-command" role="dialog" aria-modal="true" aria-label="Sürətli naviqasiya">
          <div class="sp-command-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" autocomplete="off" placeholder="Səhifə və ya funksiya axtar…" aria-label="Sürətli naviqasiya axtarışı" />
          </div>
          <div class="sp-command-list"></div>
          <div class="sp-command-hint"><span>↑ ↓ seç · Enter aç</span><span><kbd>Esc</kbd> bağla</span></div>
        </section>`;
      document.body.appendChild(backdrop);
      const input = backdrop.querySelector('input');
      const list = backdrop.querySelector('.sp-command-list');
      let active = 0;
      let visible = internalPages.slice();
      const render = () => {
        list.innerHTML = visible.length ? visible.map((item, i) => `<a class="sp-command-item${i===active?' active':''}" href="${item.href}"><span>${item.label}</span><small>↗</small></a>`).join('') : '<div class="sp-command-empty">Nəticə tapılmadı</div>';
      };
      const filter = () => {
        const q = input.value.trim().toLocaleLowerCase('az');
        visible = internalPages.filter(x => `${x.label} ${x.keywords}`.toLocaleLowerCase('az').includes(q));
        active = 0;
        render();
      };
      render();
      requestAnimationFrame(() => input.focus());
      input.addEventListener('input', filter);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (visible.length) active = (active + 1) % visible.length; render(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (visible.length) active = (active - 1 + visible.length) % visible.length; render(); }
        if (e.key === 'Enter' && visible[active]) { e.preventDefault(); location.href = visible[active].href; }
      });
      backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closePalette(); });
    };

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); backdrop ? closePalette() : openPalette(); return; }
      if (e.key === 'Escape' && backdrop) { e.preventDefault(); closePalette(); return; }
      if (e.key === '/' && !isEditable(document.activeElement)) {
        const search = document.querySelector('input[type="search"], #search, input[placeholder*="axtar" i]');
        if (search) { e.preventDefault(); search.focus(); search.select?.(); }
      }
    });

    // Adds a subtle keyboard discoverability hint on desktop only.
    if (matchMedia('(min-width: 900px)').matches) {
      const top = document.querySelector('.topbar > div, .top > div');
      if (top && !top.querySelector('[data-command-trigger]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary';
        btn.dataset.commandTrigger = '1';
        btn.setAttribute('aria-label', 'Sürətli naviqasiyanı aç');
        btn.style.cssText = 'min-width:64px;padding-inline:10px;color:#8d9987;font-size:11px;letter-spacing:.02em';
        btn.textContent = navigator.platform?.toLowerCase().includes('mac') ? '⌘ K' : 'Ctrl K';
        btn.addEventListener('click', openPalette);
        top.prepend(btn);
      }
    }
  }
})();
