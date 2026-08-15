(() => {
  const token = localStorage.stockpilotToken;
  const request = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  const formatDate = (value) => new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(value));
  const sender = (item) => item.data?.from ? `Göndərən: ${item.data.from}` : item.kind === "customer-order" ? "Mənbə: Mağaza sifarişi" : item.kind === "order-status" ? "Mənbə: Sifariş sistemi" : item.kind === "ai-price" ? "Mənbə: AI Alış Köməkçisi" : "Mənbə: StockPilot";
  const targetFor = (item) => item.kind === "customer-order" && item.data?.orderId ? `customer-orders.html#order-${encodeURIComponent(item.data.orderId)}` : item.kind === "ai-price" ? `ai-purchases.html#product-${encodeURIComponent(item.data?.productId || "")}` : `notifications.html#note-${encodeURIComponent(item.id)}`;
  let list = [];

  async function markOne(id) {
    await request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
    const item = list.find((note) => note.id === id);
    if (item) item.read = true;
  }

  function previewTitle(item) {
    const status = String(item.title || "").replace(/^Sifariş statusu:\s*/i, "").trim();
    if (item.kind === "order-status" && status) return `Sifariş · ${status}`;
    if (item.kind === "customer-order") return "Yeni müştəri sifarişi";
    if (item.kind === "ai-price") return "AI alış · Yeni fürsət";
    return item.title || "Bildiriş";
  }
  function card(item, preview = false) {
    const title = preview ? previewTitle(item) : item.title;
    const body = preview ? String(item.body || sender(item)).replace(/\s+/g, " ").trim() : item.body;
    return `<article class="notification-item ${item.read ? "" : "unread"}" data-note-id="${esc(item.id)}" tabindex="0" role="link">
      <div class="notification-item-top"><b>${esc(title)}</b>${item.read ? "" : '<span class="notification-new">Yeni</span>'}</div>
      <small>${esc(body)}${preview ? ` · <time>${formatDate(item.createdAt)}</time>` : `<br><span>${esc(sender(item))}</span><br><time>${formatDate(item.createdAt)}</time>`}</small>
      ${preview ? "" : `<a class="notification-open" href="${targetFor(item)}">${item.kind === "customer-order" ? "Müştəri sifarişinə keç →" : item.kind === "ai-price" ? "AI təklifinə bax →" : "Bildirişə bax →"}</a>`}
    </article>`;
  }

  function bindItems(root) {
    root.querySelectorAll("[data-note-id]").forEach((element) => {
      const item = list.find((note) => note.id === element.dataset.noteId);
      if (!item) return;
      const open = (event) => {
        if (event.target.closest("a,button,input,textarea,select")) return;
        markOne(item.id).finally(() => { location.href = targetFor(item); });
      };
      element.onclick = open;
      element.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); } };
      element.querySelectorAll(".notification-open").forEach((link) => {
        link.onclick = (event) => { event.preventDefault(); markOne(item.id).finally(() => { location.href = targetFor(item); }); };
      });
    });
  }

  function renderPage() {
    const page = document.getElementById("notificationsPage");
    if (!page) return;
    page.innerHTML = `<section class="notification-page-head"><div><p class="eyebrow">Şəxsi hesab</p><h1>Bildirişlər</h1><p>Kimdən gəldiyini, mətnini və göndərilmə vaxtını burada izləyin.</p></div><button id="pageReadAll" class="secondary">Hamısını oxundu et</button></section><section class="notification-list notification-page-list">${list.map((item) => card(item)).join("") || '<p class="notification-empty">Hələ bildiriş yoxdur.</p>'}</section><section class="notification-compose box"><h2>İstifadəçiyə bildiriş göndər</h2><p>Username ilə başqa StockPilot istifadəçisinə mesaj göndərin.</p><div class="grid"><div class="field"><label>Username</label><input id="notifyUsername" placeholder="istifadəçi adı"></div><div class="field wide"><label>Başlıq</label><input id="notifyTitle" value="StockPilot bildirişi"></div><div class="field wide"><label>Mesaj</label><textarea id="notifyMessage" placeholder="Mesajınızı yazın"></textarea></div></div><div class="notification-compose-actions"><span id="notifyResult" role="status"></span><button id="sendNotification" class="primary">Bildiriş göndər</button></div></section>`;
    document.getElementById("pageReadAll").onclick = markAll;
    document.getElementById("sendNotification").onclick = sendNotification;
    bindItems(page);
  }

  async function load() {
    if (!token) return;
    const response = await request("/api/notifications");
    if (!response.ok) return;
    list = (await response.json()).notifications || [];
    const unread = list.filter((item) => !item.read).length;
    const badge = document.getElementById("notificationBadge");
    if (badge) { badge.textContent = unread > 99 ? "99+" : unread; badge.classList.toggle("hidden", !unread); }
    const preview = document.getElementById("notificationPreview");
    if (preview) {
      const unreadItems = list.filter((item) => !item.read).slice(0, 6);
      preview.innerHTML = unreadItems.map((item) => card(item, true)).join("") || '<p class="notification-empty">Yeni bildiriş yoxdur.</p>';
      bindItems(preview);
    }
    renderPage();
  }

  async function markAll() { await request("/api/notifications/read-all", { method: "POST" }); list.forEach((item) => { item.read = true; }); await load(); }
  async function sendNotification() {
    const username = document.getElementById("notifyUsername").value.trim();
    const title = document.getElementById("notifyTitle").value.trim();
    const message = document.getElementById("notifyMessage").value.trim();
    const result = document.getElementById("notifyResult");
    result.textContent = "";
    if (!username || !message) { result.textContent = "Username və mesajı yazın."; return; }
    const response = await request("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, title, message }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { result.textContent = data.error || "Bildiriş göndərilmədi."; return; }
    document.getElementById("notifyMessage").value = "";
    result.textContent = "Bildiriş göndərildi.";
  }

  function boot() {
    const button = document.getElementById("notificationButton");
    const popover = document.getElementById("notificationPopover");
    if (button && popover) {
      button.onclick = () => { popover.classList.toggle("hidden"); button.setAttribute("aria-expanded", String(!popover.classList.contains("hidden"))); };
      document.getElementById("readAllNotifications")?.addEventListener("click", markAll);
      document.getElementById("allNotifications")?.addEventListener("click", (event) => { event.preventDefault(); location.href = "notifications.html"; });
      document.addEventListener("click", (event) => { if (!event.target.closest(".notification-menu")) popover.classList.add("hidden"); });
    }
    const later = () => { if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 1200 }); else setTimeout(load, 350); };
    later();
    setInterval(load, 90000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
