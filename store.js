const shop = new URLSearchParams(location.search).get("shop");
let products = [];
let cart = [];
let category = "Hamısı";
let visibleProducts = 12;
let productQuery = "";
let stockFilter = "all";
let productSort = "default";
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
  now.setMinutes(Math.ceil((now.getMinutes() + 30) / 30) * 30, 0, 0);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function formatDayLabel(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("az-AZ", { weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
}
function buildTimeOptions() {
  const select = $("preferredTime");
  const options = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push(`<option value="${value}">${value}</option>`);
    }
  }
  select.innerHTML = options.join("");
}
function setupSchedule() {
  buildTimeOptions();
  const today = localDate();
  $("preferredDate").min = today;
  $("preferredDate").value = today;
  const preferred = $("preferredTime");
  const defaultTime = localTime();
  preferred.value = Array.from(preferred.options).some((option) => option.value === defaultTime) ? defaultTime : "10:00";

}
function filteredProducts() {
  const filtered = products.filter((product) => {
    const matchesCategory = category === "Hamısı" || product.category === category;
    const haystack = `${product.name || ""} ${product.category || ""}`.toLocaleLowerCase("az");
    const matchesQuery = !productQuery || haystack.includes(productQuery);
    const qty = Number(product.quantity) || 0;
    const matchesStock = stockFilter === "all" || (stockFilter === "available" && qty > 0) || (stockFilter === "low" && qty > 0 && qty <= 3);
    return matchesCategory && matchesQuery && matchesStock;
  });
  if (productSort === "name") filtered.sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "az"));
  if (productSort === "priceAsc") filtered.sort((a,b) => Number(a.price || 0) - Number(b.price || 0));
  if (productSort === "priceDesc") filtered.sort((a,b) => Number(b.price || 0) - Number(a.price || 0));
  return filtered;
}

function render() {
  const categories = ["Hamısı", ...new Set(products.map((product) => product.category || "Digər"))];
  $("categories").innerHTML = categories.map((name) => `<button class="${name === category ? "active" : ""}" data-category="${esc(name)}">${esc(name)}</button>`).join("");
  const shown = filteredProducts();
  $("productCount").textContent = `${shown.length} məhsul`;
  const visible = shown.slice(0, visibleProducts);
  $("products").innerHTML = (visible.map((product) => {
    const quantity = Number(product.quantity) || 0;
    const available = quantity > 0;
    return `
      <article class="product ${available ? "" : "out-of-stock"}">
        <div class="product-media">
          ${product.image ? `<img src="${product.image}" alt="${esc(product.name)}" loading="lazy" decoding="async" fetchpriority="low">` : '<div class="placeholder">Şəkil yoxdur</div>'}
        </div>
        <div class="product-meta">
          <small>${esc(product.category || "Digər")}</small>
          ${available ? "" : '<span class="stock-badge out">Stokda yoxdur</span>'}
        </div>
        <h2>${esc(product.name)}</h2>
        <footer>
          <span class="price">${money(product.price)}</span>
          <button data-add="${esc(product.id)}" ${available ? "" : "disabled"}>${available ? "Səbətə əlavə et" : "Stokda yoxdur"}</button>
        </footer>
      </article>`;
  }).join("") || '<p class="cart-empty">Bu axtarışa uyğun məhsul tapılmadı.</p>')
    + (shown.length > visible.length ? `<button id="loadMore" class="load-more">Daha çox məhsul göstər (${shown.length - visible.length})</button>` : "");

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.onclick = () => {
      category = button.dataset.category;
      visibleProducts = 12;
      render();
    };
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.onclick = () => {
      const product = products.find((item) => item.id === button.dataset.add);
      if (!product || Number(product.quantity) < 1) return showToast("Bu məhsul hazırda stokda yoxdur.");
      const line = cart.find((item) => item.id === product.id);
      if (line) {
        if (line.quantity >= line.maxQuantity) return showToast("Stokda daha çox məhsul yoxdur.");
        line.quantity += 1;
      } else {
        cart.push({ ...product, maxQuantity: Number(product.quantity), quantity: 1 });
      }
      renderCart();
      showToast("Məhsul səbətə əlavə edildi ✓");
    };
  });
  const loadMore = $("loadMore");
  if (loadMore) loadMore.onclick = () => { visibleProducts += 12; render(); };
}
function renderCart() {
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  $("cartCount").textContent = itemsCount;
  $("cartItemsSummary").textContent = `${itemsCount} məhsul`;
  $("cartTotalSummary").textContent = money(total);
  $("cartLines").innerHTML = cart.map((item) => `
    <div class="line">
      <span class="line-main">
        <b>${esc(item.name)}</b>
        <small>${money(item.price)} × ${item.quantity}</small>
      </span>
      <span class="qty-controls">
        <button data-minus="${esc(item.id)}" aria-label="Azalt">−</button>
        <button data-plus="${esc(item.id)}" aria-label="Artır">+</button>
      </span>
    </div>`).join("") || '<p class="cart-empty">Səbət boşdur. Məhsul əlavə etdikdən sonra checkout burada görünəcək.</p>';

  document.querySelectorAll("[data-minus]").forEach((button) => button.onclick = () => {
    const item = cart.find((line) => line.id === button.dataset.minus);
    if (!item) return;
    item.quantity -= 1;
    if (!item.quantity) cart = cart.filter((line) => line !== item);
    renderCart();
  });
  document.querySelectorAll("[data-plus]").forEach((button) => button.onclick = () => {
    const item = cart.find((line) => line.id === button.dataset.plus);
    if (!item) return;
    if (item.quantity < item.maxQuantity) item.quantity += 1;
    else showToast("Stokda daha çox məhsul yoxdur.");
    renderCart();
  });
}
async function boot() {
  setupSchedule();
  if (!shop) {
    $("shopName").textContent = "Mağaza linki düzgün deyil";
    return;
  }
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Mağaza tapılmadı");
    products = data.products || [];
    $("shopName").textContent = `${data.shop.name} mağazası`;
    $("shopTag").textContent = "STOCKPILOT MAĞAZA";
    render();
    renderCart();
  } catch (error) {
    $("shopName").textContent = error.message || "Mağaza yüklənmədi";
  }
}
function setCartOpen(open) {
  $("cart").classList.toggle("hidden", !open);
  $("cartBackdrop").classList.toggle("hidden", !open);
  $("cart").setAttribute("aria-hidden", String(!open));
  $("cartButton").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("cart-open", open);
  if (open) $("closeCart").focus(); else $("cartButton").focus();
}
$("cartButton").onclick = () => setCartOpen(true);
$("closeCart").onclick = () => setCartOpen(false);
$("cartBackdrop").onclick = () => setCartOpen(false);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("cart").classList.contains("hidden")) setCartOpen(false);
});
$("productSearch").addEventListener("input", (event) => {
  productQuery = String(event.target.value || "").trim().toLocaleLowerCase("az");
  visibleProducts = 12;
  render();
});
$("stockFilter").addEventListener("change", (event) => { stockFilter = event.target.value; visibleProducts = 12; render(); });
$("productSort").addEventListener("change", (event) => { productSort = event.target.value; visibleProducts = 12; render(); });

function syncDeliveryFields() {
  const delivery = document.querySelector('input[name="delivery"]:checked')?.value || "metro";
  const address = delivery === "address";
  $("addressField").classList.toggle("hidden", !address);
  $("metroField").classList.toggle("hidden", address);
  $("addressField").querySelector("input").required = address;
  $("metroField").querySelector("input").required = !address;
}
document.querySelectorAll('input[name="delivery"]').forEach((input) => input.addEventListener("change", syncDeliveryFields));
syncDeliveryFields();

$("checkout").onsubmit = async (event) => {
  event.preventDefault();
  const message = $("message");
  message.textContent = "";
  if (!cart.length) {
    message.textContent = "Səbət boşdur.";
    setCartOpen(true);
    return;
  }
  const form = new FormData(event.currentTarget);
  const date = String(form.get("preferredDate") || "");
  const time = String(form.get("preferredTime") || "");
  if (date < localDate()) {
    message.textContent = "Keçmiş tarix seçilə bilməz.";
    return;
  }
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    message.textContent = "Saatı 24 saat formatında seçin. Məsələn: 14:30";
    return;
  }
  const body = Object.fromEntries(form);
  body.preferredAt = `${date}T${time}:00`;
  body.cart = cart.map(({ id, quantity }) => ({ id, quantity }));
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Göndərilir…";
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Sifariş göndərilmədi.");
    location.assign(`order-success.html?shop=${encodeURIComponent(shop)}&id=${encodeURIComponent(data.orderId || "")}`);
  } catch (error) {
    message.textContent = error.message || "Xəta oldu. Yenidən cəhd edin.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Sifarişi göndər";
  }
};

boot();
