const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const api = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const money = (n) => `${Number(n || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
let state = { orders: [] };
let user;
let healthFilter = "all";
const logout = () => { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; };
const toast = (message, type = "info") => window.StockPilotUI?.toast(message, type);

function paintUser() {
  const root = document.getElementById("user");
  root.replaceChildren();
  const avatar = user.photo ? Object.assign(document.createElement("img"), { className: "avatar", src: user.photo, alt: "" }) : Object.assign(document.createElement("b"), { className: "avatar", textContent: (user.firstName || "U")[0].toUpperCase() });
  const copy = document.createElement("span");
  const name = document.createElement("b"); name.textContent = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const br = document.createElement("br");
  const username = document.createElement("small"); username.textContent = `@${user.username || ""}`;
  copy.append(name, br, username); root.append(avatar, copy);
}
function acquired(item) { return Math.max(0, Number(item.acquiredQty ?? item.qty) || 0); }
function sold(item) { const value = Number(item.soldQty); return Math.min(acquired(item), Math.max(0, Number.isFinite(value) ? value : item.sold ? acquired(item) : 0)); }
function remaining(item) { return Math.min(Math.max(0, acquired(item) - sold(item)), Math.max(0, Number(item.qty) || 0)); }
function allItems() {
  return state.orders.filter((order) => !order.archived).flatMap((order) => (order.items || []).map((item, index) => ({ order, item, index }))).filter(({ item }) => remaining(item) > 0);
}
function addSale(item, quantity) {
  const count = Math.min(remaining(item), Math.max(0, Number(quantity) || 0));
  if (!count) return false;
  const now = new Date().toISOString();
  item.acquiredQty = acquired(item);
  item.qty = remaining(item) - count;
  item.soldQty = sold(item) + count;
  item.saleEvents = [...(Array.isArray(item.saleEvents) ? item.saleEvents : item.soldAt ? [{ qty: sold(item), soldAt: item.soldAt }] : []), { qty: count, soldAt: now }];
  item.sold = item.qty === 0;
  item.soldAt = item.sold ? now : null;
  return true;
}
async function save() {
  const response = await api("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
  if (!response.ok) throw new Error("Dəyişiklik serverdə yadda saxlanmadı.");
}
async function persistAndRender(successMessage = "Stok yeniləndi") {
  try { await save(); render(); toast(successMessage, "success"); }
  catch (error) { toast(error.message || "Yadda saxlama xətası", "error"); }
}
async function askSaleCount(item) {
  if (window.StockPilotUI?.promptNumber) return window.StockPilotUI.promptNumber({ title: "Satış əlavə et", label: `Stokda ${remaining(item)} ədəd var. Neçə ədəd satıldı?`, min: 1, max: remaining(item), value: 1, confirmText: "Satışı əlavə et" });
  const value = Number(prompt(`Neçə ədəd satıldı? Stokda ${remaining(item)} ədəd var.`, "1"));
  return Number.isFinite(value) ? value : null;
}
function render() {
  const search = document.getElementById("search").value.toLowerCase().trim();
  const lowOnly = document.getElementById("onlyLow").checked;
  const entries = allItems();
  const healthOf = (item) => {
    const left = remaining(item);
    const min = Math.max(0, Number(item.minStock || 0));
    if (left <= Math.max(1, Math.floor(min / 2))) return "critical";
    if (left <= min) return "low";
    return "healthy";
  };
  const low = entries.filter(({ item }) => remaining(item) <= Number(item.minStock || 0));
  const favourite = entries.filter(({ item }) => item.favorite);
  document.getElementById("inventoryStats").innerHTML = `<article class="card"><span>Aktiv stok</span><b>${entries.reduce((sum, { item }) => sum + remaining(item), 0)} ədəd</b></article><article class="card"><span>Az qalan məhsul</span><b class="danger-value">${low.length}</b></article><article class="card"><span>Favorilər</span><b>${favourite.length}</b></article><article class="card"><span>Stokun alış dəyəri</span><b>${money(entries.reduce((sum, { item }) => sum + remaining(item) * Number(item.price || 0), 0))}</b></article>`;
  const shown = entries.filter(({ item, order }) => (!search || `${item.name || ""} ${order.name || ""}`.toLowerCase().includes(search)) && (!lowOnly || remaining(item) <= Number(item.minStock || 0)) && (healthFilter === "all" || healthOf(item) === healthFilter));
  document.getElementById("inventory").innerHTML = shown.length ? shown.map(({ order, item, index }) => {
    const isLow = remaining(item) <= Number(item.minStock || 0);
    const image = item.img || item.image || "";
    const health = healthOf(item);
    const healthLabel = health === "critical" ? "Kritik stok" : health === "low" ? "Az qalıb" : "Sağlam stok";
    return `<article class="card stock-card ${isLow ? "is-low" : ""} health-${health}"><div class="stock-photo">${image ? `<img src="${esc(image)}" alt="${esc(item.name || "Məhsul")}">` : "▦"}</div><div class="stock-copy"><span class="stock-health ${health}">${healthLabel}</span><small>${esc(order.name || "Sifariş")} · ${esc(item.category || "Digər")}</small><h3>${item.favorite ? "★ " : ""}${esc(item.name || "Adsız məhsul")}</h3><p>${isLow ? `⚠ Minimum hədd: ${Number(item.minStock || 0)} ədəd` : `Minimum hədd: ${Number(item.minStock || 0)} ədəd`}</p></div><div class="stock-actions"><div class="qty-stepper"><button data-minus="${esc(order.id)}:${index}" aria-label="Stoku azalt">−</button><b>${remaining(item)}</b><button data-plus="${esc(order.id)}:${index}" aria-label="Stoku artır">+</button></div><button class="secondary" data-sold="${esc(order.id)}:${index}">Satış əlavə et</button></div></article>`;
  }).join("") : `<div class="card empty-state">${search || lowOnly ? "Filterə uyğun stok məhsulu yoxdur." : "Aktiv stokda məhsul yoxdur."}</div>`;
  document.querySelectorAll("[data-plus],[data-minus],[data-sold]").forEach((button) => {
    button.onclick = async () => {
      const ref = button.dataset.plus || button.dataset.minus || button.dataset.sold;
      const splitAt = ref.lastIndexOf(":");
      const orderId = ref.slice(0, splitAt), index = Number(ref.slice(splitAt + 1));
      const order = state.orders.find((entry) => entry.id === orderId);
      const item = order?.items?.[index];
      if (!item) return toast("Məhsul tapılmadı. Səhifəni yeniləyin.", "error");
      if (button.dataset.plus) { item.qty = remaining(item) + 1; item.acquiredQty = acquired(item) + 1; return persistAndRender(); }
      if (button.dataset.minus) {
        if (remaining(item) <= 1) return toast("Son məhsulu azaltmaq əvəzinə satış kimi qeyd edin.", "info");
        item.qty = remaining(item) - 1; return persistAndRender();
      }
      const count = await askSaleCount(item);
      if (count == null) return;
      if (!Number.isFinite(Number(count)) || Number(count) <= 0 || Number(count) > remaining(item)) return toast(`1–${remaining(item)} arası say daxil edin.`, "error");
      addSale(item, Number(count)); return persistAndRender("Satış əlavə edildi");
    };
  });
}
async function boot() {
  const [me, saved] = await Promise.all([api("/api/me"), api("/api/state")]);
  if (!me.ok || !saved.ok) return logout();
  user = (await me.json()).user;
  state = (await saved.json()).state || { orders: [] };
  if (!Array.isArray(state.orders)) state.orders = [];
  paintUser(); render();
  document.getElementById("search").oninput = render;
  document.getElementById("onlyLow").onchange = render;
  document.querySelectorAll("[data-health]").forEach((button) => button.onclick = () => {
    healthFilter = button.dataset.health;
    document.querySelectorAll("[data-health]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
  document.getElementById("logout").onclick = logout;
}
boot().catch(() => logout());
