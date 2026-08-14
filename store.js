const shop = new URLSearchParams(location.search).get("shop");
let products = [];
let cart = [];
let category = "Hamısı";
let visibleProducts = 12;
const $ = (id) => document.getElementById(id);
const money = (n) => `${(Number(n) || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
const esc = (s) => String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m]);

function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function localDate() {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function localTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30, 0, 0);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function setupSchedule() {
  $("preferredDate").min = localDate();
  $("preferredDate").value = localDate();
  $("preferredTime").value = localTime();
}
function render() {
  const categories = ["Hamısı", ...new Set(products.map((product) => product.category || "Digər"))];
  $("categories").innerHTML = categories.map((name) => `<button class="${name === category ? "active" : ""}" data-category="${esc(name)}">${esc(name)}</button>`).join("");
  const shown = products.filter((product) => category === "Hamısı" || product.category === category);
  const visible = shown.slice(0, visibleProducts);
  $("products").innerHTML = (visible.map((product) => {
    const available = Number(product.quantity) > 0;
    return `<article class="product ${available ? "" : "out-of-stock"}">${product.image ? `<img src="${product.image}" alt="${esc(product.name)}" loading="lazy" decoding="async" fetchpriority="low">` : '<div class="placeholder">Şəkil yoxdur</div>'}<small>${esc(product.category)}</small><h2>${esc(product.name)}</h2><footer><span class="price">${money(product.price)}</span><button data-add="${esc(product.id)}" ${available ? "" : "disabled"}>${available ? "Səbətə" : "Stokda yoxdur"}</button></footer></article>`;
  }).join("") || "<p>Məhsul hələ əlavə edilməyib.</p>") + (shown.length > visible.length ? `<button id="loadMore" class="load-more">Daha çox məhsul göstər (${shown.length - visible.length})</button>` : "");
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.onclick = () => { category = button.dataset.category; visibleProducts = 12; render(); };
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.onclick = () => {
      const product = products.find((item) => item.id === button.dataset.add);
      if (!product || Number(product.quantity) < 1) return showToast("Bu məhsul hazırda stokda yoxdur.");
      const line = cart.find((item) => item.id === product.id);
      if (line) {
        if (line.quantity >= line.maxQuantity) return showToast("Stokda daha çox məhsul yoxdur.");
        line.quantity += 1;
      } else cart.push({ ...product, maxQuantity: Number(product.quantity), quantity: 1 });
      renderCart();
      showToast("Məhsul səbətə əlavə edildi ✓");
    };
  });
  const loadMore = $("loadMore");
  if (loadMore) loadMore.onclick = () => { visibleProducts += 12; render(); };
}
function renderCart() {
  $("cartCount").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  $("cartLines").innerHTML = cart.map((item) => `<div class="line"><span><b>${esc(item.name)}</b><small>${money(item.price)} × ${item.quantity}</small></span><span><button data-minus="${esc(item.id)}" aria-label="Azalt">−</button><button data-plus="${esc(item.id)}" aria-label="Artır">+</button></span></div>`).join("") || '<p class="cart-empty">Səbət boşdur.</p>';
  document.querySelectorAll("[data-minus]").forEach((button) => button.onclick = () => {
    const item = cart.find((line) => line.id === button.dataset.minus);
    item.quantity -= 1;
    if (!item.quantity) cart = cart.filter((line) => line !== item);
    renderCart();
  });
  document.querySelectorAll("[data-plus]").forEach((button) => button.onclick = () => {
    const item = cart.find((line) => line.id === button.dataset.plus);
    if (item.quantity < item.maxQuantity) item.quantity += 1;
    else showToast("Stokda daha çox məhsul yoxdur.");
    renderCart();
  });
}
async function boot() {
  setupSchedule();
  if (!shop) { $("shopName").textContent = "Mağaza linki düzgün deyil"; return; }
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Mağaza tapılmadı");
    products = data.products || [];
    $("shopName").textContent = `${data.shop.name} mağazası`;
    $("shopTag").textContent = "STOCKPILOT MAĞAZA";
    render(); renderCart();
  } catch (error) { $("shopName").textContent = error.message || "Mağaza yüklənmədi"; }
}
$("cartButton").onclick = () => $("cart").classList.remove("hidden");
$("closeCart").onclick = () => $("cart").classList.add("hidden");
$("checkout").onsubmit = async (event) => {
  event.preventDefault();
  const message = $("message"); message.textContent = "";
  if (!cart.length) { message.textContent = "Səbət boşdur."; return; }
  const form = new FormData(event.currentTarget);
  const date = String(form.get("preferredDate") || "");
  const time = String(form.get("preferredTime") || "");
  if (date < localDate()) { message.textContent = "Keçmiş tarix seçilə bilməz."; return; }
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) { message.textContent = "Saatı 24 saat formatında yazın: 14:30"; return; }
  const body = Object.fromEntries(form);
  body.preferredAt = `${date}T${time}:00`;
  body.cart = cart.map(({ id, quantity }) => ({ id, quantity }));
  const submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true; submit.textContent = "Göndərilir…";
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Sifariş göndərilmədi.");
    location.assign(`order-success.html?shop=${encodeURIComponent(shop)}&id=${encodeURIComponent(data.orderId || "")}`);
  } catch (error) { message.textContent = error.message || "Xəta oldu. Yenidən cəhd edin."; }
  finally { submit.disabled = false; submit.textContent = "Sifarişi göndər"; }
};
boot();
