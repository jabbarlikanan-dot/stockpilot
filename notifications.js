(() => {
  const token = localStorage.stockpilotToken;
  const request = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m]);
  const formatDate = (value) => new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short", hour12: false }).format(new Date(value));
  let list = [];
  async function load() {
    const response = await request("/api/notifications");
    if (!response.ok) return;
    list = (await response.json()).notifications || [];
    const unread = list.filter((item) => !item.read).length;
    const badge = document.getElementById("notificationBadge");
    if (badge) { badge.textContent = unread > 99 ? "99+" : unread; badge.classList.toggle("hidden", !unread); }
    const target = document.getElementById("notificationPreview");
    if (target) target.innerHTML = list.slice(0, 5).map((item) => `<article class="notification-item ${item.read ? "" : "unread"}" data-note-id="${item.id}"><b>${esc(item.title)}</b><small>${esc(item.body)}<br>${formatDate(item.createdAt)}</small></article>`).join("") || '<p class="notification-empty">Yeni bildiriş yoxdur.</p>';
  }
  async function markAll() { await request("/api/notifications/read-all", { method: "POST" }); await load(); }
  function openAll(event) {
    event.preventDefault();
    const body = `<div class="notification-list">${list.map((item) => `<article class="notification-item ${item.read ? "" : "unread"}"><b>${esc(item.title)}</b><small>${esc(item.body)}<br>${formatDate(item.createdAt)}</small></article>`).join("") || '<p class="hint">Bildiriş yoxdur.</p>'}</div><hr><h3>İstifadəçiyə bildiriş göndər</h3><div class="grid"><div class="field"><label>Username</label><input id="notifyUsername" placeholder="istifadəçi adı"></div><div class="field wide"><label>Başlıq</label><input id="notifyTitle" value="StockPilot bildirişi"></div><div class="field wide"><label>Mesaj</label><textarea id="notifyMessage" placeholder="Mesajınızı yazın"></textarea></div></div><button id="sendNotification" class="primary" style="margin-top:12px">Bildiriş göndər</button>`;
    if (typeof window.showModal === "function") {
      window.showModal("Bütün bildirişlər", body);
      document.getElementById("sendNotification").onclick = async () => {
        const username = document.getElementById("notifyUsername").value;
        const title = document.getElementById("notifyTitle").value;
        const message = document.getElementById("notifyMessage").value;
        const response = await request("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, title, message }) });
        if (!response.ok) return alert((await response.json().catch(() => ({}))).error || "Bildiriş göndərilmədi.");
        alert("Bildiriş göndərildi.");
        window.hideModal?.();
      };
    }
  }
  function boot() {
    const button = document.getElementById("notificationButton");
    const popover = document.getElementById("notificationPopover");
    if (!button || !popover) return;
    button.onclick = () => { popover.classList.toggle("hidden"); button.setAttribute("aria-expanded", String(!popover.classList.contains("hidden"))); };
    document.getElementById("readAllNotifications").onclick = markAll;
    document.getElementById("allNotifications").onclick = openAll;
    document.addEventListener("click", (event) => { if (!event.target.closest(".notification-menu")) popover.classList.add("hidden"); });
    load();
    setInterval(load, 45000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
