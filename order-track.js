const params = new URLSearchParams(location.search);
const shop = params.get("shop") || "";
const orderId = params.get("id") || "";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[m]);
const money = (n) => `${(Number(n) || 0).toLocaleString("az-AZ", { minimumFractionDigits:2, maximumFractionDigits:2 })} ₼`;
const statusMap = {
  new: "Yeni",
  confirmed: "Təsdiqləndi",
  preparing: "Hazırlanır",
  courier: "Kuryerdə",
  delivered: "Çatdırıldı",
  cancelled: "Ləğv edildi",
};
const flow = ["new", "confirmed", "preparing", "courier", "delivered"];
function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("az-AZ", { dateStyle:"medium", timeStyle:"short", hour12:false }).format(new Date(value));
  } catch { return "—"; }
}
function renderSteps(status) {
  const current = flow.indexOf(status);
  $("statusSteps").innerHTML = flow.map((key, index) => `
    <div class="status-step ${status === "cancelled" ? "" : index <= current ? "done" : ""} ${key === status ? "current" : ""}">
      <span class="status-dot"></span>
      <small>${statusMap[key]}</small>
    </div>`).join("");
}
async function boot() {
  $("backStore").href = `store.html?shop=${encodeURIComponent(shop)}`;
  if (!shop || !orderId) {
    $("trackError").classList.remove("hidden");
    $("trackError").textContent = "Sifariş linki düzgün deyil.";
    return;
  }
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(shop)}/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Sifariş tapılmadı.");
    const code = `#${String(data.id || orderId).slice(0,8).toUpperCase()}`;
    const statusLabel = statusMap[data.status] || data.status || "Yeni";
    $("trackTitle").textContent = `Sifariş ${code}`;
    $("trackMeta").textContent = `Yaradılıb: ${formatDateTime(data.createdAt)}`;
    $("statusBadge").textContent = statusLabel;
    $("statusBadge").className = `status-badge status-${data.status || "new"}`;
    renderSteps(data.status);
    const cart = Array.isArray(data.cart) ? data.cart : [];
    $("trackCount").textContent = `${cart.reduce((s,x) => s + (Number(x.quantity)||0),0)} məhsul`;
    $("trackProducts").innerHTML = cart.map((item) => `
      <article class="track-product">
        <div class="track-product-image">
          ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}">` : '<span>Şəkil yoxdur</span>'}
        </div>
        <div class="track-product-copy">
          <h3>${esc(item.name)}</h3>
          <p>${money(item.price)} · ${Number(item.quantity)||1} ədəd</p>
        </div>
      </article>`).join("") || '<p class="track-empty">Məhsul məlumatı yoxdur.</p>';
    $("summaryCode").textContent = code;
    $("summaryTime").textContent = formatDateTime(data.preferredAt);
    $("summaryDelivery").textContent = data.delivery === "address" ? "Taksi ilə ünvana" : "Metroda təhvil";
    $("summarySubtotal").textContent = money(data.subtotal ?? data.total);
    const deliveryFee = Number(data.deliveryFee) || 0;
    $("summaryDeliveryFeeRow").classList.toggle("hidden", !deliveryFee);
    $("summaryDeliveryFee").textContent = money(deliveryFee);
    $("summaryTotal").textContent = money(data.total);
    const shareText = `StockPilot sifariş ${code} · ${statusLabel}`;
    $("shareOrder").onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: `Sifariş ${code}`, text: shareText, url: location.href });
        else { await navigator.clipboard.writeText(location.href); $("shareOrder").textContent = "Link kopyalandı"; setTimeout(() => $("shareOrder").textContent = "Paylaş", 1800); }
      } catch {}
    };
    $("copyTrackLink").onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); $("copyTrackLink").textContent = "Kopyalandı"; setTimeout(() => $("copyTrackLink").textContent = "Linki kopyala", 1600); } catch {}
    };
  } catch (error) {
    $("trackTitle").textContent = "Sifariş tapılmadı";
    $("trackError").classList.remove("hidden");
    $("trackError").textContent = error.message || "Sifariş məlumatı yüklənmədi.";
  }
}
boot();
