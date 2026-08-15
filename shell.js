(() => {
  const key = "stockpilot.sidebar.compact";
  const makeUI = () => {
    if (window.StockPilotUI) return;
    const toastHost = document.createElement("div");
    toastHost.className = "sp-toast-host";
    toastHost.setAttribute("aria-live", "polite");
    document.body.appendChild(toastHost);
    const toast = (message, type = "info", timeout = 2800) => {
      if (!message) return;
      const el = document.createElement("div");
      el.className = `sp-toast sp-toast-${type}`;
      el.textContent = message;
      toastHost.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 180); }, timeout);
    };
    const promptNumber = ({ title = "Dəyər daxil edin", label = "Say", min = 0, max = 999999, value = 1, confirmText = "Təsdiqlə" } = {}) => new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "sp-dialog-backdrop";
      overlay.innerHTML = `<form class="sp-dialog" role="dialog" aria-modal="true"><div class="sp-dialog-head"><h2></h2><button type="button" class="sp-dialog-close" aria-label="Bağla">×</button></div><label class="sp-dialog-field"><span></span><input type="number" inputmode="numeric"></label><div class="sp-dialog-actions"><button type="button" class="sp-dialog-cancel">Ləğv et</button><button type="submit" class="sp-dialog-confirm"></button></div></form>`;
      const form = overlay.querySelector("form"), input = overlay.querySelector("input");
      overlay.querySelector("h2").textContent = title; overlay.querySelector("label span").textContent = label; overlay.querySelector(".sp-dialog-confirm").textContent = confirmText;
      input.min = min; input.max = max; input.value = value;
      const close = (result) => { document.removeEventListener("keydown", onKey); overlay.remove(); resolve(result); };
      const onKey = (event) => { if (event.key === "Escape") close(null); };
      overlay.querySelector(".sp-dialog-close").onclick = () => close(null);
      overlay.querySelector(".sp-dialog-cancel").onclick = () => close(null);
      overlay.onclick = (event) => { if (event.target === overlay) close(null); };
      form.onsubmit = (event) => { event.preventDefault(); const n = Number(input.value); if (!Number.isFinite(n) || n < min || n > max) { input.focus(); return; } close(n); };
      document.addEventListener("keydown", onKey); document.body.appendChild(overlay); setTimeout(() => { input.focus(); input.select(); }, 0);
    });
    window.StockPilotUI = { toast, promptNumber };
  };
  const setup = () => {
    makeUI();
    const shell = document.querySelector(".app-shell");
    const toggle = document.querySelector("[data-sidebar-toggle]");
    if (shell && toggle) {
      const apply = (compact) => {
        shell.classList.toggle("is-sidebar-compact", compact);
        toggle.setAttribute("aria-expanded", String(!compact));
        toggle.setAttribute("aria-label", compact ? "Menyunu aç" : "Menyunu yığ");
        toggle.title = compact ? "Menyunu aç" : "Menyunu yığ";
      };
      apply(localStorage.getItem(key) === "1");
      toggle.addEventListener("click", () => { const compact = !shell.classList.contains("is-sidebar-compact"); localStorage.setItem(key, compact ? "1" : "0"); apply(compact); });
    }
    document.querySelectorAll('a[href="#"]').forEach((link) => link.addEventListener("click", (event) => { if (!link.id) event.preventDefault(); }));
    const updateNetwork = () => document.documentElement.classList.toggle("is-offline", !navigator.onLine);
    addEventListener("online", () => { updateNetwork(); window.StockPilotUI.toast("İnternet bağlantısı bərpa olundu", "success"); });
    addEventListener("offline", () => { updateNetwork(); window.StockPilotUI.toast("İnternet bağlantısı yoxdur. Dəyişikliklər yadda qalmaya bilər.", "error", 4500); });
    updateNetwork();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", setup, { once: true }) : setup();
})();

// v37 — mobile-first topbar, drawer and normalized bottom navigation
(() => {
  const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const pageName = () => {
    const p = location.pathname.split('/').pop() || 'dashboard.html';
    if (p === 'dashboard.html') return 'Sifarişlər';
    if (p === 'customer-orders.html') return 'Müştəri sifarişləri';
    if (p === 'inventory.html') return 'Stok';
    if (p === 'ai-purchases.html') return 'AI Alış';
    if (p === 'notifications.html') return 'Bildirişlər';
    if (p === 'profile.html') return 'Profil';
    if (p === 'account.html') return 'Hesab';
    return 'İdarəetmə';
  };
  const currentPath = () => location.pathname.split('/').pop() || 'dashboard.html';

  async function resolveUser(){
    if (window.currentUser) return window.currentUser;
    const token = localStorage.stockpilotToken;
    if (!token) return null;
    try{
      const r = await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`}});
      if (!r.ok) return null;
      return (await r.json()).user || null;
    }catch{return null}
  }

  function mobileStoreOpen(){
    const existing = document.getElementById('storeBtn');
    if (existing) return existing.click();
    resolveUser().then(user => {
      if (user?.username) window.open(`store.html?shop=${encodeURIComponent(user.username)}`,'_blank');
      else location.href='profile.html';
    });
  }

  function normalizeBottom(){
    let nav = document.querySelector('.mobile-bottom');
    if (!nav){
      nav = document.createElement('nav');
      nav.className='mobile-bottom';
      nav.setAttribute('aria-label','Sürətli menyu');
      document.body.appendChild(nav);
    }
    const p=currentPath();
    const active = (name) => p===name ? ' class="active"' : '';
    nav.innerHTML = `
      <a${active('dashboard.html')} href="dashboard.html">${icon('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>')}<span>Sifarişlər</span></a>
      <a${active('inventory.html')} href="inventory.html">${icon('<path d="M4 8h16v12H4zM8 8V5h8v3M8 13h8"/>')}<span>Stok</span></a>
      <a class="mobile-primary-action" href="dashboard.html?add=1">${icon('<path d="M12 5v14M5 12h14"/>')}<span>Əlavə et</span></a>
      <button type="button" data-mobile-store>${icon('<path d="M4 10h16v10H4zM6 10V6h12v4M8 14h8"/>')}<span>Mağaza</span></button>
      <a${active('account.html')} href="account.html">${icon('<circle cx="12" cy="8" r="3"/><path d="M5 20c.6-3.4 2.9-5 7-5s6.4 1.6 7 5"/>')}<span>Hesab</span></a>`;
    nav.querySelector('[data-mobile-store]')?.addEventListener('click',mobileStoreOpen);
  }

  function buildMobileChrome(){
    if (document.querySelector('.mobile-topbar')) return;
    const top=document.createElement('header');
    top.className='mobile-topbar';
    top.innerHTML=`
      <button class="mobile-menu-button" type="button" aria-label="Menyunu aç" aria-expanded="false">${icon('<path d="M4 7h16M4 12h16M4 17h16"/>')}</button>
      <a class="mobile-topbar-brand" href="dashboard.html">
        <img src="stockpilot-logo.png" alt="StockPilot">
        <span class="mobile-topbar-context"><small>İdarəetmə</small><b>${pageName()}</b></span>
      </a>
      <div class="mobile-topbar-actions">
        <button class="mobile-icon-button mobile-notification-trigger" type="button" aria-label="Bildirişlər">${icon('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>')}<b class="notification-badge hidden" data-mobile-notification-badge>0</b></button>
        <button class="mobile-avatar" type="button" aria-label="Profil"><b data-mobile-initial>U</b></button>
      </div>`;
    document.body.appendChild(top);

    const backdrop=document.createElement('div');
    backdrop.className='mobile-drawer-backdrop';
    const drawer=document.createElement('aside');
    drawer.className='mobile-drawer';
    drawer.setAttribute('aria-label','Mobil menyu');
    drawer.innerHTML=`
      <div class="mobile-drawer-head"><img src="stockpilot-logo.png" alt="StockPilot"><button class="mobile-drawer-close" type="button" aria-label="Menyunu bağla">×</button></div>
      <div class="mobile-drawer-section">
        <div class="mobile-drawer-label">İdarəetmə</div>
        <a href="dashboard.html">${icon('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>')}<span>Şəxsi sifarişlər</span></a>
        <a href="customer-orders.html">${icon('<path d="M4 6h16v12H4zM8 10h.01M12 10h4M8 14h8"/>')}<span>Müştəri sifarişləri</span></a>
        <a href="inventory.html">${icon('<path d="M4 8h16v12H4zM8 8V5h8v3M8 13h8"/>')}<span>Stok nəzarəti</span></a>
        <button class="mobile-drawer-link" type="button" data-mobile-store>${icon('<path d="M4 10h16v10H4zM6 10V6h12v4M8 14h8"/>')}<span>Mağazam</span></button>
      </div>
      <div class="mobile-drawer-section">
        <div class="mobile-drawer-label">Ağıllı alətlər</div>
        <a href="ai-purchases.html">${icon('<path d="M9 3h6l1 3 3 1v6l-3 1-1 3H9l-1-3-3-1V7l3-1 1-3Z"/><path d="M9 10h.01M15 10h.01M9 14c1.5 1 4.5 1 6 0"/>')}<span>AI Alış Köməkçisi</span></a>
        <a href="notifications.html">${icon('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>')}<span>Bildirişlər</span></a>
      </div>
      <div class="mobile-drawer-section">
        <div class="mobile-drawer-label">Hesab</div>
        <a href="profile.html">${icon('<circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/>')}<span>Profil ayarları</span></a>
        <a href="account.html">${icon('<circle cx="12" cy="12" r="3"/><path d="M19 12h2M3 12h2M12 3v2M12 19v2"/>')}<span>Hesab</span></a>
      </div>
      <div class="mobile-drawer-footer"><button class="mobile-drawer-link" type="button" data-mobile-logout>${icon('<path d="M10 4H5v16h5M14 8l4 4-4 4m4-4H9"/>')}<span>Çıxış</span></button></div>`;
    document.body.append(backdrop,drawer);

    const menuBtn=top.querySelector('.mobile-menu-button');
    const close=()=>{drawer.classList.remove('open');backdrop.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');document.body.style.overflow=''};
    const open=()=>{drawer.classList.add('open');backdrop.classList.add('open');menuBtn.setAttribute('aria-expanded','true');document.body.style.overflow='hidden'};
    menuBtn.addEventListener('click',open);
    drawer.querySelector('.mobile-drawer-close').addEventListener('click',close);
    backdrop.addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    drawer.querySelectorAll('[data-mobile-store]').forEach(b=>b.addEventListener('click',()=>{close();mobileStoreOpen()}));
    drawer.querySelector('[data-mobile-logout]')?.addEventListener('click',()=>{
      const existing=document.getElementById('logout');
      if(existing) existing.click(); else {localStorage.removeItem('stockpilotToken');location.href='index.html'}
    });
    top.querySelector('.mobile-notification-trigger').addEventListener('click',()=>location.href='notifications.html');
    top.querySelector('.mobile-avatar').addEventListener('click',()=>location.href='account.html');

    resolveUser().then(user=>{
      if(!user)return;
      const initial=String(user.firstName||user.username||'U').charAt(0).toUpperCase();
      top.querySelector('[data-mobile-initial]').textContent=initial;
    });

    const syncBadge=()=>{
      const desktop=document.getElementById('notificationBadge');
      const mobile=top.querySelector('[data-mobile-notification-badge]');
      if(!desktop||!mobile)return;
      const apply=()=>{
        mobile.textContent=desktop.textContent||'0';
        mobile.classList.toggle('hidden',desktop.classList.contains('hidden')||Number(desktop.textContent||0)<1);
      };
      apply();
      new MutationObserver(apply).observe(desktop,{subtree:true,childList:true,attributes:true,characterData:true});
    };
    setTimeout(syncBadge,400);

    const cp=currentPath();
    drawer.querySelectorAll('a').forEach(a=>{
      if((a.getAttribute('href')||'').split('?')[0]===cp)a.classList.add('active');
    });
  }

  const init=()=>{normalizeBottom();buildMobileChrome()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
