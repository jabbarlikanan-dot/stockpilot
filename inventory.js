const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const api = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const money = (n) => `${Number(n || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
let state = { orders: [] };
let user;
const logout = () => { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; };
function paintUser() {
  document.getElementById("user").innerHTML = `${user.photo ? `<img class="avatar" src="${user.photo}">` : `<b class="avatar">${user.firstName[0]}</b>`}<span><b>${user.firstName} ${user.lastName}</b><br><small>@${user.username}</small></span>`;
}
function allItems() {
  return state.orders.filter((order) => !order.archived).flatMap((order) => (order.items || []).map((item, index) => ({ order, item, index }))).filter(({ item }) => !item.sold);
}
async function save() {
  await api("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
}
function render() {
  const search = document.getElementById("search").value.toLowerCase().trim();
  const lowOnly = document.getElementById("onlyLow").checked;
  const entries = allItems();
  const low = entries.filter(({ item }) => Number(item.qty || 0) <= Number(item.minStock || 0));
  const favourite = entries.filter(({ item }) => item.favorite);
  document.getElementById("inventoryStats").innerHTML = `<article class="card"><span>Aktiv stok</span><b>${entries.reduce((sum, { item }) => sum + Number(item.qty || 0), 0)} ədəd</b></article><article class="card"><span>Az qalan məhsul</span><b class="danger-value">${low.length}</b></article><article class="card"><span>Favorilər</span><b>${favourite.length}</b></article><article class="card"><span>Stokun alış dəyəri</span><b>${money(entries.reduce((sum, { item }) => sum + Number(item.qty || 0) * Number(item.price || 0), 0))}</b></article>`;
  const shown = entries.filter(({ item, order }) => (!search || `${item.name} ${order.name}`.toLowerCase().includes(search)) && (!lowOnly || Number(item.qty || 0) <= Number(item.minStock || 0)));
  document.getElementById("inventory").innerHTML = shown.length ? shown.map(({ order, item, index }) => {
    const isLow = Number(item.qty || 0) <= Number(item.minStock || 0);
    return `<article class="card stock-card ${isLow ? "is-low" : ""}"><div class="stock-photo">${item.image ? `<img src="${item.image}" alt="">` : "▦"}</div><div class="stock-copy"><small>${order.name} · ${item.category || "Digər"}</small><h3>${item.favorite ? "★ " : ""}${item.name}</h3><p>${isLow ? `⚠ Minimum hədd: ${item.minStock} ədəd` : `Minimum hədd: ${item.minStock || 0} ədəd`}</p></div><div class="stock-actions"><div class="qty-stepper"><button data-minus="${order.id}:${index}">−</button><b>${item.qty}</b><button data-plus="${order.id}:${index}">+</button></div><button class="secondary" data-sold="${order.id}:${index}">Satıldı et</button></div></article>`;
  }).join("") : `<div class="card empty-state">Axtarışa uyğun stok məhsulu yoxdur.</div>`;
  document.querySelectorAll("[data-plus],[data-minus],[data-sold]").forEach((button) => {
    button.onclick = async () => {
      const [orderId, index] = (button.dataset.plus || button.dataset.minus || button.dataset.sold).split(":");
      const item = state.orders.find((order) => order.id === orderId).items[Number(index)];
      if (button.dataset.plus) item.qty = Number(item.qty || 0) + 1;
      if (button.dataset.minus) item.qty = Math.max(1, Number(item.qty || 0) - 1);
      if (button.dataset.sold) { item.sold = true; item.soldAt = new Date().toISOString(); }
      await save(); render();
    };
  });
}
async function boot() {
  const [me, saved] = await Promise.all([api("/api/me"), api("/api/state")]);
  if (!me.ok || !saved.ok) return logout();
  user = (await me.json()).user;
  state = (await saved.json()).state || { orders: [] };
  paintUser(); render();
  document.getElementById("search").oninput = render;
  document.getElementById("onlyLow").onchange = render;
  document.getElementById("logout").onclick = logout;
}
boot().catch(logout);
