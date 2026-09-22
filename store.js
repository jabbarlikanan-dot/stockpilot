const shop = new URLSearchParams(location.search).get("shop");
let products = [];
let cart = [];
let category = "Hamısı";
let visibleProducts = 12;
let productQuery = "";
let productSort = "default";
let deliveryMap = null;
let deliveryMarker = null;
let deliveryQuote = null;
let quoteTimer = null;
let quoteGeneration=0;
let checkoutBusy=false;
const $ = (id) => document.getElementById(id);
const money = (n) => `${(Number(n) || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
const esc = (s) => String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m]);
const safeImg=(value)=>{const src=String(value||'').trim();return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(src)||/^\/api\/images\/[A-Za-z0-9_./%-]+$/.test(src)&&!src.includes('..')?src:''};

function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function localDate() { return StockDomain.bakuDate(); }
function defaultSchedule() { const ms=Math.ceil((Date.now()+30*60000)/(30*60000))*(30*60000);return new Date(ms+4*3600000).toISOString().slice(0,16); }
function buildTimeOptions() {
  const options = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push(`<option value="${value}">${value}</option>`);
    }
  }
  $("preferredTime").innerHTML = options.join("");
}
function setupSchedule() {
  buildTimeOptions();
  const today = localDate();
  $("preferredDate").min = today;
  $("preferredDate").value = defaultSchedule().slice(0,10);
  const defaultTime = defaultSchedule().slice(11,16);
  $("preferredTime").value = Array.from($("preferredTime").options).some((option) => option.value === defaultTime) ? defaultTime : "10:00";
}
function filteredProducts() {
  const filtered = products.filter((product) => {
    const matchesCategory = category === "Hamısı" || product.category === category;
    const haystack = `${product.name || ""} ${product.category || ""}`.toLocaleLowerCase("az");
    return matchesCategory && (!productQuery || haystack.includes(productQuery));
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
  $("products").innerHTML = (visible.map((product) => `
    <article class="product">
      <div class="product-media">${safeImg(product.image) ? `<img src="${esc(safeImg(product.image))}" alt="${esc(product.name)}" loading="lazy" decoding="async">` : '<div class="placeholder">Şəkil yoxdur</div>'}</div>
      <div class="product-meta"><small>${esc(product.category || "Digər")}</small><span class="product-number">${String(visible.indexOf(product)+1).padStart(2,"0")}</span></div>
      <h2>${esc(product.name)}</h2>
      <footer><span class="price">${money(product.price)}</span><button data-add="${esc(product.id)}">Səbətə əlavə et <span aria-hidden="true">+</span></button></footer>
    </article>`).join("") || '<p class="cart-empty">Bu axtarışa uyğun məhsul tapılmadı.</p>')
    + (shown.length > visible.length ? `<button id="loadMore" class="load-more">Daha çox məhsul göstər (${shown.length - visible.length})</button>` : "");

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.onclick = () => { category = button.dataset.category; visibleProducts = 12; render(); };
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.onclick = () => {
      const product = products.find((item) => item.id === button.dataset.add);
      if (!product) return showToast("Məhsul tapılmadı.");
      const line = cart.find((item) => item.id === product.id);
      if(line?.quantity>=999)return showToast("Bir məhsuldan maksimum 999 ədəd sifariş edilə bilər.");
      if (line) line.quantity += 1;
      else cart.push({ ...product, quantity: 1 });
      renderCart();
      showToast("Məhsul səbətə əlavə edildi ✓");
    };
  });
  const loadMore = $("loadMore");
  if (loadMore) loadMore.onclick = () => { visibleProducts += 12; render(); };
}
function subtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
}
function renderCart() {
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const productTotal = subtotal();
  const fee = Number(deliveryQuote?.fee || 0);
  $("cartCount").textContent = itemsCount;
  $("cartItemsSummary").textContent = `${itemsCount} məhsul`;
  $("cartSubtotalSummary").textContent = money(productTotal);
  $("deliverySummaryBox").classList.toggle("hidden", !fee);
  $("deliveryFeeSummary").textContent = money(fee);
  $("cartTotalSummary").textContent = money(productTotal + fee);
  $("cartLines").innerHTML = cart.map((item) => `
    <div class="line"><span class="line-main"><b>${esc(item.name)}</b><small>${money(item.price)} × ${item.quantity}</small></span><span class="qty-controls"><button data-minus="${esc(item.id)}" aria-label="Azalt">−</button><button data-plus="${esc(item.id)}" aria-label="Artır">+</button></span></div>`).join("") || '<p class="cart-empty">Səbət boşdur.</p>';
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
    if(item.quantity>=999)return showToast("Maksimum say 999-dur.");
    item.quantity += 1;
    renderCart();
  });
}
function setCartOpen(open) {
  $("cart").classList.toggle("hidden", !open);
  $("cartBackdrop").classList.toggle("hidden", !open);
  $("cart").setAttribute("aria-hidden", String(!open));
  $("cartButton").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("cart-open", open);
  if (open) {
    $("closeCart").focus();
    setTimeout(() => deliveryMap?.invalidateSize(), 100);
  } else $("cartButton").focus();
}
function initMap() {
  if (deliveryMap || !window.L) return;
  deliveryMap = L.map("deliveryMap", { zoomControl:true }).setView([40.4093, 49.8671], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"© OpenStreetMap" }).addTo(deliveryMap);
  deliveryMap.on("click", (event) => setDeliveryPoint(event.latlng.lat, event.latlng.lng, true));
}
function setDeliveryPoint(lat, lng, requestQuote = true) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  $("deliveryLat").value = lat.toFixed(6);
  $("deliveryLng").value = lng.toFixed(6);
  initMap();
  if (deliveryMap) {
    if (!deliveryMarker) deliveryMarker = L.marker([lat,lng], { draggable:true }).addTo(deliveryMap);
    else deliveryMarker.setLatLng([lat,lng]);
    deliveryMarker.off("dragend").on("dragend", () => {
      const point = deliveryMarker.getLatLng();
      setDeliveryPoint(point.lat, point.lng, true);
    });
    deliveryMap.setView([lat,lng], Math.max(deliveryMap.getZoom(), 14));
  }
  if (requestQuote) queueQuote();
}
async function updateQuote() {
  const generation=++quoteGeneration;
  if (document.querySelector('input[name="delivery"]:checked')?.value !== "address") return;
  const lat = Number($("deliveryLat").value), lng = Number($("deliveryLng").value);
  if (!$("deliveryLat").value || !$("deliveryLng").value || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    deliveryQuote = null;
    $("deliveryDistance").textContent = "Konum seçilməyib";
    $("deliveryQuote").textContent = "—";
    renderCart();
    return;
  }
  const preferredAt = `${$("preferredDate").value}T${$("preferredTime").value}:00`;
  $("deliveryDistance").textContent = "Hesablanır…";
  $("deliveryQuote").textContent = "…";
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}/delivery-quote`, {
      method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ lat, lng, preferredAt })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Çatdırılma hesablanmadı.");
    if(generation!==quoteGeneration)return;
    deliveryQuote = data;
    $("deliveryDistance").textContent = `${Number(data.distanceKm).toFixed(1)} km · ${data.periodLabel || "standart tarif"}`;
    $("deliveryQuote").textContent = money(data.fee);
    renderCart();
  } catch (error) {
    if(generation!==quoteGeneration)return;
    deliveryQuote = null;
    $("deliveryDistance").textContent = error.message || "Hesablamaq alınmadı";
    $("deliveryQuote").textContent = "—";
    renderCart();
  }
}
function queueQuote() {
  quoteGeneration++;deliveryQuote=null;renderCart();
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(updateQuote, 250);
}
function syncDeliveryFields() {
  quoteGeneration++;clearTimeout(quoteTimer);
  const address = document.querySelector('input[name="delivery"]:checked')?.value === "address";
  $("metroField").classList.toggle("hidden", address);
  $("addressDeliveryPanel").classList.toggle("hidden", !address);
  $("metroField").querySelector("input").required = !address;
  $("addressInput").required = address;
  $("cart").classList.toggle("cart-wide", address);
  if (address) {
    initMap();
    setTimeout(() => deliveryMap?.invalidateSize(), 100);
    queueQuote();
  } else {
    deliveryQuote = null;
    renderCart();
  }
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

$("cartButton").onclick = () => setCartOpen(true);
$("closeCart").onclick = () => setCartOpen(false);
$("cartBackdrop").onclick = () => setCartOpen(false);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("cart").classList.contains("hidden")) setCartOpen(false); });
$("productSearch").addEventListener("input", (event) => { productQuery = String(event.target.value || "").trim().toLocaleLowerCase("az"); visibleProducts = 12; render(); });
$("productSort").addEventListener("change", (event) => { productSort = event.target.value; visibleProducts = 12; render(); });
document.querySelectorAll('input[name="delivery"]').forEach((input) => input.addEventListener("change", syncDeliveryFields));
$("preferredDate").addEventListener("change", queueQuote);
$("preferredTime").addEventListener("change", queueQuote);
$("useMyLocation").onclick = () => {
  if (!navigator.geolocation) return showToast("Bu cihazda konum xidməti dəstəklənmir.");
  $("useMyLocation").disabled = true;
  navigator.geolocation.getCurrentPosition(
    (position) => { setDeliveryPoint(position.coords.latitude, position.coords.longitude, true); $("useMyLocation").disabled = false; },
    () => { showToast("Konumu almaq mümkün olmadı. Xəritədən seçin."); $("useMyLocation").disabled = false; },
    { enableHighAccuracy:true, timeout:9000 }
  );
};
syncDeliveryFields();

$("checkout").onsubmit = async (event) => {
  event.preventDefault();
  if(checkoutBusy)return;
  const message = $("message"); message.textContent = "";
  if (!cart.length) { message.textContent = "Səbət boşdur."; return; }
  const form = new FormData(event.currentTarget);
  const date = String(form.get("preferredDate") || ""), time = String(form.get("preferredTime") || "");
  if (date < localDate()) { message.textContent = "Keçmiş tarix seçilə bilməz."; return; }
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) { message.textContent = "Saatı 24 saat formatında seçin."; return; }
  if (form.get("delivery") === "address" && (!form.get("deliveryLat") || !form.get("deliveryLng"))) { message.textContent = "Çatdırılma konumunu xəritədən seçin."; return; }
  const body = Object.fromEntries(form);
  body.preferredAt = `${date}T${time}:00`;
  const scheduleError=StockDomain.scheduleError(body.preferredAt);if(scheduleError){message.textContent=scheduleError;return;}
  if(body.delivery==="address"&&!deliveryQuote){message.textContent="Əvvəl çatdırılma qiymətinin hesablanmasını gözləyin.";return;}
  body.cart = cart.map(({ id, quantity }) => ({ id, quantity }));
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  const encoded=JSON.stringify(body),storageKey=`checkout:${shop}`;
  let attempt;try{attempt=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(!attempt||attempt.body!==encoded)attempt={key:crypto.randomUUID(),body:encoded};
  sessionStorage.setItem(storageKey,JSON.stringify(attempt));
  checkoutBusy=true;submit.disabled = true; submit.textContent = "Göndərilir…";
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}/orders`, { method:"POST", headers:{"content-type":"application/json","idempotency-key":attempt.key}, body:encoded });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Sifariş göndərilmədi.");
    location.assign(`order-success.html?shop=${encodeURIComponent(shop)}&id=${encodeURIComponent(data.orderId || "")}`);
  } catch (error) { message.textContent = error.message || "Xəta oldu. Yenidən cəhd edin."; }
  finally { checkoutBusy=false;submit.disabled = false; submit.textContent = "Sifarişi göndər"; }
};

boot();
