/* Sifarişlər, karqo tarifləri, filter və Excel ixracı */
const defaults = {
  america: {
    name: "Amerika",
    currency: "$",
    rate: 1.7,
    tariffs: [3.49, 5.49, 7.49, 9.77],
  },
  turkey: {
    name: "Türkiyə",
    currency: "$",
    rate: 1.7,
    tariffs: [1.49, 2.49, 3.49, 4.29],
  },
  spain: {
    name: "İspaniya",
    currency: "€",
    rate: 1.96,
    tariffs: [1.75, 3.7, 5.6, 7.9],
  },
};
let state = window.__stockState || {
  active: null,
  orders: [],
  countries: defaults,
};
state.countries = { ...defaults, ...(state.countries || {}) };
const notify = (message, type = "info") => window.StockPilotUI?.toast(String(message || ""), type, type === "error" ? 4200 : 2800);
state.ui = {
  search: "",
  status: "all",
  orderSort: "newest",
  showArchived: false,
  lastSavedAt: null,
  orderDetailsOpen: false,
  filtersOpen: false,
  productFormOpen: false,
  panel: "personal",
  customerView: "all",
  customerLayout: "board",
  ...(state.ui || {}),
};
let pendingImage = "",
  editing = null,
  lastDeleted = null;
let xlsxLoader;
async function loadXlsx() {
  if (window.XLSX) return window.XLSX;
  if (!xlsxLoader) {
    xlsxLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Excel modulu yüklənmədi."));
      script.onerror = () => reject(new Error("Excel modulu yüklənmədi."));
      document.head.appendChild(script);
    });
  }
  return xlsxLoader;
}
const isCustomerPage =
  location.pathname.endsWith("customer-orders.html") ||
  location.pathname.endsWith("customer-orders");
state.customerOrders = window.__customerOrders || [];
const $ = (id) => document.getElementById(id);
const money = (n) =>
  (Number(n) || 0).toLocaleString("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
let saveTimer = null;
const save = (now = false) => {
  state.ui.lastSavedAt = new Date().toISOString();
  clearTimeout(saveTimer);
  const persist = () => window.persistStockState(state);
  if (now) return persist();
  saveTimer = setTimeout(persist, 280);
};
window.addEventListener("pagehide", () => {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  window.persistStockState(state);
});
const active = () => state.orders.find((o) => o.id === state.active);
const country = (k) => state.countries[k] || state.countries.america;
const shipping = (g, k) => {
  g = +g || 0;
  const a = country(k).tariffs;
  return !g
    ? 0
    : g <= 100
      ? a[0]
      : g <= 250
        ? a[1]
        : g <= 500
          ? a[2]
          : Math.ceil(g / 1000) * a[3];
};
const range = (g) =>
  g <= 100
    ? "0–100 qr"
    : g <= 250
      ? "101–250 qr"
      : g <= 500
        ? "251–500 qr"
        : g <= 1000
          ? "501 qr–1 kq"
          : `${Math.ceil(g / 1000)} kq`;
const dateTime = (v) =>
  v
    ? new Intl.DateTimeFormat("az-AZ", {
        dateStyle: "short",
        timeStyle: "short",
        hour12: false,
      }).format(new Date(v))
    : "—";
const customerStatus = {
  new: "Yeni",
  confirmed: "Təsdiqləndi",
  preparing: "Hazırlanır",
  courier: "Kuryerdə",
  delivered: "Tamamlandı",
  cancelled: "Ləğv edildi",
};
const terminalCustomerStatus = new Set(["delivered", "cancelled"]);
const nextCustomerStatus = {
  new: "confirmed",
  confirmed: "preparing",
  preparing: "courier",
  courier: "delivered",
};
const phoneForWhatsApp = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("994")) return digits;
  if (digits.startsWith("0")) return `994${digits.slice(1)}`;
  return digits.length <= 9 ? `994${digits}` : digits;
};
const whatsappLink = (order) => {
  const phone = phoneForWhatsApp(order.customer?.phone);
  const message = `Salam, ${order.customer?.name || ""}! Sifarişinizin statusu: ${customerStatus[order.status] || "Yeni"}. Sifariş: ${(order.cart || []).map((item) => `${item.name} × ${item.quantity}`).join(", ")}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
function customerOrderCard(order, compact = false) {
  const statusOptions = Object.entries(customerStatus)
    .map(([key, label]) => `<option value="${key}" ${order.status === key ? "selected" : ""}>${label}</option>`)
    .join("");
  const selectedFromNotification = location.hash === `#order-${order.id}`;
  const nextStatus = nextCustomerStatus[order.status];
  const nextButton = nextStatus
    ? `<button class="customer-quick-next" data-customer-next="${order.id}" data-next-status="${nextStatus}">${customerStatus[nextStatus]} →</button>`
    : "";
  return `<article id="order-${esc(order.id)}" class="customer-card status-${esc(order.status)} ${terminalCustomerStatus.has(order.status) ? "done" : ""} ${selectedFromNotification ? "highlight" : ""}">
    <div class="customer-card-main"><span class="customer-card-status">${esc(customerStatus[order.status] || "Yeni")}</span><b>${esc(order.customer?.name)}</b><span>${esc(order.customer?.phone)} · ${money(order.total)} ₼</span>
    <small>${(order.cart || []).map((item) => `${esc(item.name)} × ${item.quantity}`).join(", ")}${order.customer?.note ? ` — ${esc(order.customer.note)}` : ""}</small>
    <small>${dateTime(order.createdAt)}${order.customer?.delivery ? ` · ${esc(order.customer.delivery === "metro" ? "Metro təhvil" : "Ünvana çatdırılma")}` : ""}${order.customer?.preferredAt ? ` · İstədiyi vaxt: ${dateTime(order.customer.preferredAt)}` : ""}</small></div>
    <div class="customer-actions">${nextButton}<select data-customer-status="${order.id}" ${order.status === "delivered" ? "disabled" : ""}>${statusOptions}</select>
    <button class="edit" data-customer-edit="${order.id}">Detallar</button><a class="whatsapp" data-customer-whatsapp="${order.id}" href="${whatsappLink(order)}" target="_blank" rel="noopener">WhatsApp</a><button class="remove" data-customer-delete="${order.id}">Sil</button></div>
  </article>`;
}
function calc(i) {
  const c = country(i.country),
    q = +(i.acquiredQty ?? i.qty) || 0,
    ship = shipping(i.weight, i.country),
    purchase = ((+i.price || 0) * q + ship) * c.rate,
    sales = (+i.sale || 0) * q;
  return {
    c,
    ship,
    purchase,
    sales,
    profit: sales - purchase,
    pct: sales ? (sales - purchase) / sales : 0,
  };
}
// acquiredQty is the original stock. qty is always the currently remaining stock.
// These helpers also preserve compatibility with older all-or-nothing sold records.
function acquiredQty(i) {
  return Math.max(0, Number(i.acquiredQty ?? i.qty) || 0);
}
function soldQty(i) {
  const acquired = acquiredQty(i);
  const stored = Number(i.soldQty);
  return Math.min(acquired, Math.max(0, Number.isFinite(stored) ? stored : i.sold ? acquired : 0));
}
function remainingQty(i) {
  const acquired = acquiredQty(i);
  const left = Number(i.qty);
  return Math.min(acquired - soldQty(i), Math.max(0, Number.isFinite(left) ? left : acquired - soldQty(i)));
}
function soldEvents(i) {
  if (Array.isArray(i.saleEvents)) return i.saleEvents;
  return i.soldAt && soldQty(i) ? [{ qty: soldQty(i), soldAt: i.soldAt }] : [];
}
function soldSummary(i, qty = soldQty(i)) {
  const acquired = acquiredQty(i);
  const x = calc(i);
  const count = Math.min(acquired, Math.max(0, Number(qty) || 0));
  const purchase = acquired ? x.purchase * (count / acquired) : 0;
  const sales = (Number(i.sale) || 0) * count;
  return { purchase, sales, profit: sales - purchase, pct: sales ? (sales - purchase) / sales : 0 };
}
function addSale(i, qty) {
  const count = Math.min(remainingQty(i), Math.max(0, Number(qty) || 0));
  if (!count) return false;
  const now = new Date().toISOString();
  i.acquiredQty = acquiredQty(i);
  i.qty = remainingQty(i) - count;
  i.soldQty = soldQty(i) + count;
  i.saleEvents = [...soldEvents(i), { qty: count, soldAt: now }];
  i.sold = i.qty === 0;
  i.soldAt = i.sold ? now : null;
  return true;
}
function undoLastSale(i) {
  const events = [...soldEvents(i)];
  const last = events.pop();
  if (!last) return false;
  const count = Math.min(soldQty(i), Math.max(0, Number(last.qty) || 0));
  i.qty = Math.min(acquiredQty(i), remainingQty(i) + count);
  i.soldQty = Math.max(0, soldQty(i) - count);
  i.saleEvents = events;
  i.sold = i.qty === 0;
  i.soldAt = i.sold ? events.at(-1)?.soldAt || null : null;
  return true;
}
function totals(o) {
  const total = (o.items || []).reduce(
    (a, i) => {
      const x = calc(i);
      a.purchase += x.purchase;
      a.items += acquiredQty(i);
      const sold = soldSummary(i);
      a.sales += sold.sales;
      a.profit += sold.profit;
      a.sold += soldQty(i);
      return a;
    },
    { purchase: 0, sales: 0, profit: 0, items: 0, sold: 0 },
  );
  (state.customerSales || [])
    .filter((sale) => sale.orderId === o.id)
    .forEach((sale) => {
      total.sales += Number(sale.sales) || 0;
      total.profit += (Number(sale.sales) || 0) - (Number(sale.purchase) || 0);
      total.sold += Number(sale.quantity) || 0;
    });
  return total;
}
function allTotals() {
  return state.orders.reduce(
    (a, o) => {
      const t = totals(o);
      Object.keys(a).forEach((k) => (a[k] += t[k]));
      return a;
    },
    { purchase: 0, sales: 0, profit: 0, items: 0, sold: 0 },
  );
}
async function refreshCustomerOrders() {
  const response = await fetch("/api/customer-orders", {
    headers: { Authorization: `Bearer ${localStorage.stockpilotToken}` },
  });
  if (!response.ok) throw new Error("Sifarişlər yenilənmədi.");
  state.customerOrders = (await response.json()).orders || [];
  const stateResponse = await fetch("/api/state", {
    headers: { Authorization: `Bearer ${localStorage.stockpilotToken}` },
  });
  if (stateResponse.ok) {
    const fresh = (await stateResponse.json()).state || {};
    state.orders = Array.isArray(fresh.orders) ? fresh.orders : state.orders;
    state.customerSales = Array.isArray(fresh.customerSales) ? fresh.customerSales : state.customerSales;
    state.countries = { ...state.countries, ...(fresh.countries || {}) };
  }
}
function customerHistory() {
  const history = [...state.customerOrders].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );
  showModal(
    "Bütün müştəri sifarişləri",
    `<p class="hint">Burada bütün statuslardakı sifarişlər göstərilir.</p><div class="customer-history">${history.length ? history.map((order) => customerOrderCard(order)).join("") : "<p class=\"hint\">Hələ müştəri sifarişi yoxdur.</p>"}</div>`,
  );
  bindCustomerOrderActions();
}
function editCustomerOrder(id) {
  const order = state.customerOrders.find((item) => item.id === id);
  if (!order) return;
  const customer = order.customer || {};
  showModal(
    "Müştəri sifarişini redaktə et",
    `<div class="grid"><div class="field"><label>Ad soyad</label><input id="customerName" value="${esc(customer.name)}"></div><div class="field"><label>Telefon</label><input id="customerPhone" value="${esc(customer.phone)}"></div><div class="field wide"><label>Qeyd</label><input id="customerNote" value="${esc(customer.note || "")}"></div><div class="field"><label>Çatdırılma</label><select id="customerDelivery"><option value="metro" ${customer.delivery === "metro" ? "selected" : ""}>Metro təhvil</option><option value="address" ${customer.delivery === "address" ? "selected" : ""}>Ünvana çatdırılma</option></select></div><div class="field"><label>İstədiyi tarix/saat</label><input id="customerPreferredAt" type="datetime-local" value="${esc(customer.preferredAt || "")}"></div><div class="field"><label>Metro / rayon</label><input id="customerMetro" value="${esc(customer.metro || "")}"></div><div class="field wide"><label>Ünvan</label><input id="customerAddress" value="${esc(customer.address || "")}"></div><div class="field wide"><label>Ödəniş</label><select id="customerPayment"><option value="cash" ${customer.payment === "cash" ? "selected" : ""}>Nağd ödəniş</option><option value="card" ${customer.payment === "card" ? "selected" : ""}>Kartla ödəniş</option></select></div></div><button id="saveCustomerEdit" class="primary" style="margin-top:14px">Dəyişiklikləri yadda saxla</button>`,
  );
  $("saveCustomerEdit").onclick = async () => {
    const response = await fetch(`/api/customer-orders/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", Authorization: `Bearer ${localStorage.stockpilotToken}` },
      body: JSON.stringify({ status: order.status, customer: { name: $("customerName").value, phone: $("customerPhone").value, note: $("customerNote").value, delivery: $("customerDelivery").value, preferredAt: $("customerPreferredAt").value, metro: $("customerMetro").value, address: $("customerAddress").value, payment: $("customerPayment").value } }),
    });
    if (!response.ok) return notify("Dəyişiklik yadda saxlanmadı.");
    await refreshCustomerOrders();
    hideModal();
    render();
  };
}
function bindCustomerOrderActions() {
  document.querySelectorAll("[data-customer-status]").forEach((select) => (select.onchange = async () => {
    const response = await fetch(`/api/customer-orders/${select.dataset.customerStatus}`, { method: "PUT", headers: { "content-type": "application/json", Authorization: `Bearer ${localStorage.stockpilotToken}` }, body: JSON.stringify({ status: select.value }) });
    if (!response.ok) return notify("Status yadda saxlanmadı.");
    const result = await response.json().catch(() => ({}));
    if (result.whatsappUrl && confirm("Müştəriyə WhatsApp status mesajı açılsın?")) window.open(result.whatsappUrl, "_blank", "noopener");
    await refreshCustomerOrders();
    hideModal();
    render();
  }));
  document.querySelectorAll("[data-customer-next]").forEach((button) => (button.onclick = async () => {
    const id = button.dataset.customerNext;
    const status = button.dataset.nextStatus;
    const response = await fetch(`/api/customer-orders/${id}`, { method: "PUT", headers: { "content-type": "application/json", Authorization: `Bearer ${localStorage.stockpilotToken}` }, body: JSON.stringify({ status }) });
    if (!response.ok) return notify("Status yadda saxlanmadı.", "error");
    await refreshCustomerOrders();
    render();
  }));
  document.querySelectorAll("[data-customer-edit]").forEach((button) => (button.onclick = () => editCustomerOrder(button.dataset.customerEdit)));
  document.querySelectorAll("[data-customer-delete]").forEach((button) => (button.onclick = async () => {
    if (!confirm("Müştəri sifarişi silinsin?")) return;
    const response = await fetch(`/api/customer-orders/${button.dataset.customerDelete}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.stockpilotToken}` } });
    if (!response.ok) return notify("Sifariş silinmədi.");
    await refreshCustomerOrders();
    hideModal();
    render();
  }));
}
function newOrder() {
  const o = {
    id: Date.now().toString(),
    name: `Sifariş ${state.orders.length + 1}`,
    budget: 0,
    note: "",
    archived: false,
    createdAt: new Date().toISOString(),
    items: [],
  };
  state.orders.push(o);
  state.active = o.id;
  save();
  render();
}
function duplicateOrder() {
  const source = active();
  if (!source) return newOrder();
  const copy = {
    ...JSON.parse(JSON.stringify(source)),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name || "Sifariş"} — kopya`,
    createdAt: new Date().toISOString(),
    archived: false,
    // Yeni cədvəl satış tarixçəsini yox, yalnız məhsulları kopyalayır.
    items: (source.items || []).map((item) => {
      const result = { ...item };
      const count = acquiredQty(item);
      result.qty = count;
      result.acquiredQty = count;
      result.sold = false;
      result.soldQty = 0;
      result.saleEvents = [];
      delete result.soldAt;
      return result;
    }),
  };
  state.orders.push(copy);
  state.active = copy.id;
  save();
  render();
}
function sortedOrders() {
  return state.orders
    .filter((o) => Boolean(o.archived) === Boolean(state.ui.showArchived))
    .sort((a, b) =>
    state.ui.orderSort === "oldest"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt),
  );
}
function compactImage(file) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement("canvas"),
          z = Math.min(1, 180 / Math.max(im.width, im.height));
        c.width = im.width * z;
        c.height = im.height * z;
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/png"));
      };
      im.src = r.result;
    };
    r.onerror = no;
    r.readAsDataURL(file);
  });
}
function tabs() {
  $("tabs").innerHTML =
    sortedOrders()
      .map(
        (o) =>
          `<button class="tab ${o.id === state.active ? "active" : ""}" data-id="${o.id}">${esc(o.name)}</button>`,
      )
      .join("") + '<button id="newOrder" class="plus">+</button>';
  document.querySelectorAll(".tab").forEach(
    (b) =>
      (b.onclick = () => {
        state.active = b.dataset.id;
        editing = null;
        save();
        render();
      }),
  );
  $("newOrder").onclick = newOrder;
}
function productDetail(item) {
  const x = calc(item), sold = soldSummary(item), left = remainingQty(item);
  showModal(
    item.name,
    `<div class="detail-card">${item.img ? `<img class="thumb" src="${item.img}">` : '<div class="noimg">Şəkil<br>yoxdur</div>'}<div><p class="category">${esc(item.category || "Digər")} · ${x.c.name}</p><div class="detail-grid"><div>Stokda qalan<b>${left} ədəd</b></div><div>Satılan<b>${soldQty(item)} ədəd</b></div><div>Çəki<b>${item.weight || 0} qr</b></div><div>Ümumi alış<b>${money(x.purchase)} ₼</b></div><div>Reallaşan qazanc<b class="lime">${money(sold.profit)} ₼</b></div><div>Karqo<b>${money(x.ship * x.c.rate)} ₼</b></div></div></div></div>`,
  );
}
function countryOptions(selected) {
  return Object.entries(state.countries)
    .map(
      ([k, c]) =>
        `<option value="${k}" ${k === selected ? "selected" : ""}>${c.name}</option>`,
    )
    .join("");
}
function visibleItems(o) {
  const q = state.ui.search.trim().toLocaleLowerCase("az"),
    status = state.ui.status;
  return (o.items || [])
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        (!q ||
          `${item.name} ${item.category || ""}`
            .toLocaleLowerCase("az")
            .includes(q)) &&
        (status === "all" || (status === "sold" ? soldQty(item) > 0 : remainingQty(item) > 0)),
    );
}
function undoBox() {
  const box = $("undoToast");
  if (!box) return;
  if (!lastDeleted) {
    box.classList.add("hidden");
    return;
  }
  box.innerHTML = `<span>Son silinən məhsul: <b>${esc(lastDeleted.item.name)}</b></span><button id="undoDelete" class="secondary">Geri qaytar</button>`;
  box.classList.remove("hidden");
  $("undoDelete").onclick = () => {
    const o = state.orders.find((x) => x.id === lastDeleted.orderId);
    if (o) {
      o.items.splice(lastDeleted.index, 0, lastDeleted.item);
      save();
    }
    lastDeleted = null;
    render();
  };
}
function collapsePanel(panel, id, title, info, opened) {
  const disclosure = document.createElement("details");
  disclosure.id = id;
  disclosure.className = "box disclosure";
  disclosure.open = Boolean(opened);
  disclosure.innerHTML = `<summary><span><small>${title}</small><b>${info}</b></span><i>⌄</i></summary>`;
  panel.parentNode.insertBefore(disclosure, panel);
  panel.classList.remove("box");
  disclosure.append(panel);
  disclosure.ontoggle = () => {
    if (id === "orderDetails") state.ui.orderDetailsOpen = disclosure.open;
    if (id === "filterDetails") state.ui.filtersOpen = disclosure.open;
    if (id === "productForm") state.ui.productFormOpen = disclosure.open;
    save();
  };
}
function compactPanels(order) {
  collapsePanel(
    document.querySelector(".orderbar"),
    "orderDetails",
    "Sifariş məlumatları",
    `${esc(order.name)} · ${dateTime(order.createdAt)}`,
    state.ui.orderDetailsOpen,
  );
  const activeFilter = state.ui.search || state.ui.status !== "all";
  collapsePanel(
    document.querySelector(".tools"),
    "filterDetails",
    "Axtarış və filterlər",
    activeFilter ? "Filter aktivdir" : "Məhsulları tap və sırala",
    state.ui.filtersOpen,
  );
  collapsePanel(
    document.querySelector(".workspace .form"),
    "productForm",
    editing !== null ? "Məhsulu redaktə et" : "Məhsul əlavə et",
    editing !== null ? "Dəyişikliklər üçün aç" : "Yeni məhsul əlavə etmək üçün aç",
    editing !== null || !order.items?.length || state.ui.productFormOpen,
  );
}
function renderOperationsHub() {
  const root = document.getElementById("operationsHub");
  if (!root) return;
  const stockItems = state.orders
    .filter((order) => !order.archived)
    .flatMap((order) => (order.items || []).map((item) => ({ order, item })))
    .filter(({ item }) => remainingQty(item) > 0);
  const risky = stockItems.filter(({ item }) => remainingQty(item) <= Math.max(0, Number(item.minStock || 0)));
  const critical = risky.filter(({ item }) => remainingQty(item) <= Math.max(1, Math.floor(Number(item.minStock || 0) / 2)));
  const newCustomers = state.customerOrders.filter((order) => order.status === "new");
  const inProgress = state.customerOrders.filter((order) => ["confirmed", "preparing", "courier"].includes(order.status));
  const activeOrders = state.orders.filter((order) => !order.archived).length;
  const priority = [];
  if (critical.length) priority.push(`<a href="inventory.html">${critical.length} kritik stok →</a>`);
  if (newCustomers.length) priority.push(`<a href="customer-orders.html">${newCustomers.length} sifariş →</a>`);
  if (inProgress.length) priority.push(`<a href="customer-orders.html">${inProgress.length} çatdırılma →</a>`);
  root.innerHTML = `<section class="ops-compact"><div class="ops-compact-title"><b>Bu gün</b><small>iş vəziyyəti</small></div><div class="ops-statuses"><a class="ops-status is-new" href="customer-orders.html" title="Yeni müştəri sifarişləri"><i></i><span>Yeni</span><b>${newCustomers.length}</b></a><a class="ops-status ${risky.length ? "is-risk" : "is-ok"}" href="inventory.html" title="Riskli stok"><i></i><span>Stok riski</span><b>${risky.length}</b></a><a class="ops-status is-active" href="#tabs" title="Aktiv şəxsi sifarişlər"><i></i><span>Aktiv sifariş</span><b>${activeOrders}</b></a><a class="ops-status ${inProgress.length ? "is-active" : "is-ok"}" href="customer-orders.html" title="Aktiv çatdırılmalar"><i></i><span>Çatdırılma</span><b>${inProgress.length}</b></a>${priority.length ? `<span class="ops-priority">${priority.join("")}</span>` : ""}</div></section>`;
}

function renderCustomerPanel() {
  const counts = Object.fromEntries(
    Object.keys(customerStatus).map((status) => [status, state.customerOrders.filter((order) => order.status === status).length]),
  );
  const shown = state.ui.customerView === "all" ? state.customerOrders : state.customerOrders.filter((order) => order.status === state.ui.customerView);
  const filterButton = (value, label, count) => `<button class="${state.ui.customerView === value ? "primary" : "secondary"}" data-customer-filter="${value}">${label} (${count})</button>`;
  const boardStatuses = ["new", "confirmed", "preparing", "courier"];
  const board = `<div class="customer-board">${boardStatuses.map((status) => {
    const list = state.customerOrders.filter((order) => order.status === status);
    return `<section class="customer-column"><div class="customer-column-head"><b>${customerStatus[status]}</b><span>${list.length}</span></div>${list.length ? list.map((order) => customerOrderCard(order, true)).join("") : '<p class="hint">Boşdur</p>'}</section>`;
  }).join("")}</div>`;
  const list = `<div class="customer-list-wrap">${shown.length ? shown.map((order) => customerOrderCard(order)).join("") : '<p class="hint">Bu filtr üçün sifariş yoxdur.</p>'}</div>`;
  $("content").innerHTML = `<section class="box customer-orders customer-panel"><div class="customer-heading"><div><h2>Müştəri sifarişləri</h2><p>${state.customerOrders.length} ümumi sifariş · statusları bir kliklə irəli apar.</p></div><div class="customer-actions"><div class="customer-view-switch"><button class="${state.ui.customerLayout === "board" ? "primary" : "secondary"}" data-customer-layout="board">Board</button><button class="${state.ui.customerLayout === "list" ? "primary" : "secondary"}" data-customer-layout="list">Siyahı</button></div><button id="refreshCustomerOrders" class="secondary">Yenilə</button><button id="customerHistory" class="secondary">Tarixçə</button></div></div><div class="customer-filters">${filterButton("all", "Hamısı", state.customerOrders.length)}${filterButton("new", "Yeni", counts.new)}${filterButton("confirmed", "Təsdiqləndi", counts.confirmed)}${filterButton("preparing", "Hazırlanır", counts.preparing)}${filterButton("courier", "Kuryerdə", counts.courier)}${filterButton("delivered", "Tamamlandı", counts.delivered)}${filterButton("cancelled", "Ləğv edildi", counts.cancelled)}</div>${state.ui.customerLayout === "board" && state.ui.customerView === "all" ? board : list}</section>`;
  if (location.hash.startsWith("#order-")) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" }));
  if ($("customerHistory")) $("customerHistory").onclick = customerHistory;
  if ($("refreshCustomerOrders")) $("refreshCustomerOrders").onclick = async () => { try { await refreshCustomerOrders(); render(); } catch { notify("Sifarişlər yenilənmədi. Giriş sessiyasını yeniləyin."); } };
  document.querySelectorAll("[data-customer-layout]").forEach((button) => button.onclick = () => { state.ui.customerLayout = button.dataset.customerLayout; render(); });
  document.querySelectorAll("[data-customer-filter]").forEach((button) => button.onclick = () => { state.ui.customerView = button.dataset.customerFilter; if (state.ui.customerView !== "all") state.ui.customerLayout = "list"; render(); });
  bindCustomerOrderActions();
}
function render() {
  if (isCustomerPage) return renderCustomerPanel();
  renderOperationsHub();
  if (!state.orders.length) return newOrder();
  $("archiveToggle").textContent = state.ui.showArchived
    ? "Aktiv sifarişlər"
    : "Arxiv";
  tabs();
  const o = active();
  if (!o || Boolean(o.archived) !== Boolean(state.ui.showArchived)) {
    state.active = sortedOrders()[0]?.id || null;
    if (!state.active && state.ui.showArchived) {
      state.ui.showArchived = false;
      return render();
    }
    if (!state.active) return newOrder();
    return render();
  }
  const e = Number.isInteger(editing) ? o.items[editing] : null;
  if (!e) editing = null;
  if (e) pendingImage = e.img || "";
  const t = totals(o),
    remain = (+o.budget || 0) - t.purchase + t.sales,
    spent = Math.max(0, t.purchase - t.sales),
    used = o.budget ? Math.min(100, (spent / +o.budget) * 100) : 0,
    today = new Date().toDateString(),
    todaySold = (o.items || []).flatMap((i) =>
      soldEvents(i)
        .filter((event) => event.soldAt && new Date(event.soldAt).toDateString() === today)
        .map((event) => ({ item: i, qty: Number(event.qty) || 0 })),
    ),
    todayCustomerSales = (state.customerSales || []).filter(
      (sale) => sale.orderId === o.id && sale.soldAt && new Date(sale.soldAt).toDateString() === today,
    ),
    todayValue = todaySold.reduce((s, sale) => s + soldSummary(sale.item, sale.qty).sales, 0) + todayCustomerSales.reduce((sum, sale) => sum + (Number(sale.sales) || 0), 0),
    rows = visibleItems(o);
  $("content").innerHTML =
    `<section class="box orderbar"><div class="field name"><label>Sifarişin adı</label><input id="orderName" value="${esc(o.name)}"></div><div class="field"><label>Yaradılma tarixi</label><input readonly value="${dateTime(o.createdAt)}"></div><div class="field"><label>Büdcə (₼)</label><input id="budget" type="number" min="0" value="${o.budget || 0}"></div><div class="field"><label>Qısa qeyd</label><input id="orderNote" maxlength="80" value="${esc(o.note || "")}" placeholder="Məsələn: Avqust malları"></div><button id="duplicateOrder" class="secondary" title="Bu cədvəlin kopyasını yarat">Dublikat et</button><button id="archiveOrder" class="secondary">${o.archived ? "Arxivdən çıxar" : "Arxivlə"}</button><button id="deleteOrder" class="danger">Sifarişi sil</button></section><section class="box tools"><input id="search" value="${esc(state.ui.search)}" placeholder="Məhsul adında axtarış…"><select id="statusFilter"><option value="all">Bütün məhsullar</option><option value="sold" ${state.ui.status === "sold" ? "selected" : ""}>Satılanlar</option><option value="unsold" ${state.ui.status === "unsold" ? "selected" : ""}>Satılmayanlar</option></select><select id="orderSort"><option value="newest">Yeni sifarişlər əvvəl</option><option value="oldest" ${state.ui.orderSort === "oldest" ? "selected" : ""}>Köhnə sifarişlər əvvəl</option></select><small>Son yadda saxlanma: ${dateTime(state.ui.lastSavedAt)}</small></section><section class="workspace"><aside class="box form"><h2>${e ? "Məhsulu redaktə et" : "Məhsul əlavə et"}</h2><div class="grid"><div class="field wide"><label>Məhsulun adı</label><input id="name" value="${e ? esc(e.name) : ""}" placeholder="Məsələn: Kreatin"></div><div class="field"><label>Kateqoriya</label><select id="category">${["Əlavələr", "Geyim", "Elektronika", "Kosmetika", "Ev və digər"].map((v) => `<option ${e?.category === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field"><label>Ölkə</label><select id="productCountry">${countryOptions(e ? e.country : "america")}</select></div><div class="field"><label>Say</label><div class="qty-control"><button type="button" id="qtyMinus">−</button><input id="qty" type="number" min="1" value="${e ? e.qty : 1}"><button type="button" id="qtyPlus">+</button></div></div><div class="field"><label>Minimum stok</label><input id="minStock" type="number" min="0" value="${e?.minStock ?? 3}"></div><div class="field"><label>Alış qiyməti</label><input id="price" type="number" min="0" step=".01" value="${e ? e.price : 0}"></div><div class="field"><label>Satış qiyməti (₼)</label><input id="sale" type="number" min="0" step=".01" value="${e ? e.sale : 0}"></div><div class="field wide"><label>Çəki (qram, ümumi)</label><input id="weight" type="number" min="0" value="${e ? e.weight : 0}"></div><div class="field wide"><label>Məhsul şəkli</label><input id="image" class="file" type="file" accept="image/png,image/jpeg,image/webp">${e && pendingImage ? '<button id="deleteImage" class="remove" style="margin-top:8px">Şəkli sil</button>' : ""}</div></div><p class="hint">Seçilən ölkənin tarifi və məzənnəsi avtomatik tətbiq olunur.</p><button id="saveItem" class="primary save">${e ? "Dəyişiklikləri yadda saxla" : "Listə əlavə et"}</button>${e ? '<button id="cancelEdit" class="secondary save">Ləğv et</button>' : ""}</aside><section class="box tablebox"><div class="scroll"><table class="items"><thead><tr><th>Şəkil</th><th>Məhsul</th><th>Say</th><th>Ümumi alış</th><th>Satış</th><th>Qazanc</th><th>Əməliyyat</th></tr></thead><tbody>${
      rows.length
        ? rows
            .map(({ item: i, index: n }) => {
              const x = calc(i),
                sold = soldSummary(i),
                left = remainingQty(i),
                soldCount = soldQty(i),
                im = i.img
                  ? `<img class="thumb" src="${i.img}">`
                  : '<div class="noimg">Şəkil<br>yoxdur</div>';
              const isLow = left > 0 && left <= (+i.minStock || 3);
              const statusClass = left === 0 ? "sold" : isLow ? "low" : "ok";
              const statusLabel = left === 0 ? "Hamısı satılıb" : isLow ? "Stok azalır" : "Stok normaldır";
              return `<tr><td>${im}</td><td class="product-cell"><button class="fav ${i.favorite ? "active" : ""}" data-fav="${n}" title="Favorit">★</button><button class="product-link" data-detail="${n}"><b>${esc(i.name)}</b></button><span class="product-subline"><span class="row-status ${statusClass}" title="${statusLabel}" aria-label="${statusLabel}"><i></i></span><small>${esc(i.category || "Digər")} · ${x.c.name}</small></span></td><td class="num"><b>${left}</b><br><small>${soldCount} satılıb</small></td><td class="num">${money(x.purchase)} ₼</td><td class="num">${money(sold.sales)} ₼</td><td class="num lime">${money(sold.profit)} ₼</td><td><div class="table-actions">${left ? `<button class="sold table-sale" data-sold="${n}" title="Satış əlavə et">+ Satış</button>` : ""}${soldCount ? `<button class="undo-sale" data-undo-sale="${n}" title="Son satışı geri al">↶</button>` : ""}<button class="edit" data-edit="${n}" title="Redaktə et">Düzəlt</button><button class="remove" data-remove="${n}" title="Sil">Sil</button></div></td></tr>`;
            })
            .join("")
        : '<tr><td colspan="7" class="empty">Bu filterdə məhsul yoxdur.</td></tr>'
    }</tbody></table></div></section></section><section class="metrics"><div class="box metric"><span>Ümumi alış</span><strong>${money(t.purchase)} ₼</strong></div><div class="box metric"><span>Bu gün satılanlar</span><strong>${todaySold.reduce((sum, sale) => sum + sale.qty, 0) + todayCustomerSales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0)} ədəd</strong><small>${money(todayValue)} ₼ satış</small></div><div class="box metric"><span>Satış qazancı</span><strong class="lime">${money(t.profit)} ₼</strong></div><div class="box metric budget-card"><span>Büdcə: xərcləndi / qaldı</span><strong>${money(spent)} ₼ / ${money(Math.max(0, remain))} ₼</strong><div class="progress"><i style="width:${used}%"></i></div><small>${used.toFixed(1)}% xərclənib</small></div></section>`;
  compactPanels(o);
  bind(o, e);
  undoBox();
}
function bind(o, e) {
  $("orderName").onchange = (v) => {
    o.name = v.target.value || "Adsız sifariş";
    save();
    tabs();
  };
  $("orderNote").onchange = (v) => {
    o.note = v.target.value;
    save();
  };
  $("budget").onchange = (v) => {
    o.budget = +v.target.value || 0;
    save();
    render();
  };
  $("search").oninput = (v) => {
    state.ui.search = v.target.value;
    render();
  };
  $("statusFilter").onchange = (v) => {
    state.ui.status = v.target.value;
    render();
  };
  $("orderSort").onchange = (v) => {
    state.ui.orderSort = v.target.value;
    save();
    render();
  };
  $("deleteOrder").onclick = () => {
    if (confirm("Sifariş silinsin?")) {
      state.orders = state.orders.filter((x) => x.id !== o.id);
      state.active = state.orders[0]?.id || null;
      save();
      render();
    }
  };
  $("archiveOrder").onclick = () => {
    o.archived = !o.archived;
    state.ui.showArchived = o.archived;
    state.active = sortedOrders()[0]?.id || null;
    save();
    render();
  };
  $("duplicateOrder").onclick = duplicateOrder;
  $("qtyMinus").onclick = () =>
    ($("qty").value = Math.max(1, (+$("qty").value || 1) - 1));
  $("qtyPlus").onclick = () => ($("qty").value = (+$("qty").value || 0) + 1);
  $("image").onchange = async (v) => {
    if (v.target.files[0]) pendingImage = await compactImage(v.target.files[0]);
  };
  if ($("deleteImage"))
    $("deleteImage").onclick = () => {
      pendingImage = "";
      render();
    };
  if ($("cancelEdit"))
    $("cancelEdit").onclick = () => {
      editing = null;
      pendingImage = "";
      render();
    };
  $("saveItem").onclick = () => {
    const requestedQty = +$("qty").value || 0;
    const adjustedAcquiredQty = e
      ? Math.max(
          soldQty(e) + requestedQty,
          acquiredQty(e) + requestedQty - remainingQty(e),
        )
      : requestedQty;
    const i = {
      id: e?.id || crypto.randomUUID(),
      name: $("name").value.trim(),
      category: $("category").value,
      country: $("productCountry").value,
      qty: requestedQty,
      acquiredQty: adjustedAcquiredQty,
      minStock: +$("minStock").value || 0,
      price: +$("price").value || 0,
      sale: +$("sale").value || 0,
      weight: +$("weight").value || 0,
      img: pendingImage,
      favorite: e?.favorite || false,
      soldQty: e ? soldQty(e) : 0,
      saleEvents: e ? soldEvents(e) : [],
      sold: e ? Boolean(e.sold) : false,
      soldAt: e?.soldAt || null,
    };
    if (!i.name || !i.qty) return notify("Məhsulun adını və sayını yazın.");
    if (e) o.items[editing] = i;
    else o.items.push(i);
    editing = null;
    pendingImage = "";
    save();
    render();
  };
  document.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        editing = +b.dataset.edit;
        render();
      }),
  );
  document.querySelectorAll("[data-detail]").forEach(
    (b) => (b.onclick = () => productDetail(o.items[+b.dataset.detail])),
  );
  document.querySelectorAll("[data-fav]").forEach(
    (b) =>
      (b.onclick = () => {
        const item = o.items[+b.dataset.fav];
        item.favorite = !item.favorite;
        save();
        render();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        const index = +b.dataset.remove;
        lastDeleted = { orderId: o.id, index, item: o.items[index] };
        o.items.splice(index, 1);
        save();
        render();
      }),
  );
  document.querySelectorAll("[data-sold]").forEach(
    (b) =>
      (b.onclick = async () => {
        const i = o.items[+b.dataset.sold];
        const max = remainingQty(i);
        const count = window.StockPilotUI?.promptNumber
          ? await window.StockPilotUI.promptNumber({ title: "Satış əlavə et", label: `Stokda ${max} ədəd var. Neçə ədəd satıldı?`, min: 1, max, value: 1, confirmText: "Satışı əlavə et" })
          : Number(prompt(`Neçə ədəd satıldı? Stokda ${max} ədəd var.`, "1"));
        if (count == null || !Number.isFinite(Number(count)) || Number(count) <= 0) return;
        if (Number(count) > max) return notify(`Stokda yalnız ${max} ədəd qalıb.`, "error");
        addSale(i, Number(count));
        save();
        render();
        notify("Satış əlavə edildi", "success");
      }),
  );
  document.querySelectorAll("[data-undo-sale]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = o.items[+b.dataset.undoSale];
        if (undoLastSale(i)) {
          save();
          render();
        }
      }),
  );
  if ($("customerHistory")) $("customerHistory").onclick = customerHistory;
  bindCustomerOrderActions();
}
function showModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").classList.remove("hidden");
}
function hideModal() {
  $("modal").classList.add("hidden");
}
function tariffSettings() {
  const bands = [
    ["0–100 qr", "Bu çəkiyə qədər sabit qiymət"],
    ["101–250 qr", "Bu çəkiyə qədər sabit qiymət"],
    ["251–500 qr", "Bu çəkiyə qədər sabit qiymət"],
    ["501 qr – 1 kq", "1 kq-dan yuxarı hər başlanmış kq üçün"],
  ];
  const rows = Object.entries(state.countries)
    .map(
      ([k, c]) =>
        `<section class="country-editor tariff-editor"><div class="tariff-title"><label>Ölkə adı<input data-country-name="${k}" value="${esc(c.name)}" aria-label="Ölkə adı"></label><label>Valyuta<input data-currency="${k}" value="${esc(c.currency)}" maxlength="3" aria-label="Valyuta"></label><label>1 vahid = AZN<input data-rate="${k}" type="number" min="0" step=".01" value="${c.rate}" aria-label="AZN məzənnəsi"></label></div><div class="tariff-bands">${c.tariffs.map((v, n) => `<label><b>${bands[n][0]}</b><small>${bands[n][1]}</small><span><input data-country="${k}" data-tariff="${n}" type="number" min="0" step=".01" value="${v}" aria-label="${bands[n][0]} karqo tarifi">${esc(c.currency)}</span></label>`).join("")}</div></section>`,
    )
    .join("");
  showModal(
    "Tarif və məzənnə ayarları",
    `<p class="hint">Hər ölkənin karqo planını ayrıca dəyişin. 1 kq-dan ağır məhsulda son qiymət hər başlanmış kq üçün tətbiq olunur və AZN məbləği avtomatik hesablanır.</p>${rows}<button id="saveTariffs" class="primary" style="margin-top:12px">Tarifləri yadda saxla</button>`,
  );
  $("saveTariffs").onclick = () => {
    document
      .querySelectorAll("[data-tariff]")
      .forEach(
        (x) =>
          (state.countries[x.dataset.country].tariffs[+x.dataset.tariff] =
            +x.value || 0),
      );
    document
      .querySelectorAll("[data-rate]")
      .forEach((x) => (state.countries[x.dataset.rate].rate = +x.value || 0));
    document.querySelectorAll("[data-country-name]").forEach((x) => {
      state.countries[x.dataset.countryName].name = x.value.trim() || "Ölkə";
    });
    document.querySelectorAll("[data-currency]").forEach((x) => {
      state.countries[x.dataset.currency].currency = x.value.trim() || "₼";
    });
    save(true);
    hideModal();
    render();
  };
}
async function exportExcel() {
  try { await loadXlsx(); } catch { return notify("Excel modulu yüklənmədi. İnterneti yoxlayın."); }
  const wb = XLSX.utils.book_new();
  state.orders.forEach((o, n) => {
    const rows = [
      [
        "Məhsul",
        "Kateqoriya",
        "Ölkə",
        "Say",
        "Alış (₼)",
        "Karqo (₼)",
        "Ümumi alış",
        "Satış",
        "Qazanc",
        "Faiz",
        "Status",
        "Satış tarixi",
      ],
    ];
    o.items.forEach((i) => {
      const x = calc(i);
      rows.push([
        i.name,
        i.category || "Digər",
        x.c.name,
        i.qty,
        (+i.price || 0) * (+i.qty || 0) * x.c.rate,
        x.ship * x.c.rate,
        x.purchase,
        x.sales,
        x.profit,
        x.pct,
        i.sold ? "Satılıb" : "Satılmayıb",
        i.soldAt ? dateTime(i.soldAt) : "",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 13 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 11 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      (o.name || `Sifariş ${n + 1}`).slice(0, 31),
    );
  });
  XLSX.writeFile(wb, "stockpilot-hesabat.xlsx");
}
function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}
function readImportValue(row, aliases) {
  const entry = Object.entries(row).find(([key]) =>
    aliases.includes(normalizeHeader(key)),
  );
  return entry ? entry[1] : "";
}
function importCountry(value) {
  const key = normalizeHeader(value);
  if (["turkiye", "turkey", "tr"].includes(key)) return "turkey";
  if (["ispaniya", "spain", "es"].includes(key)) return "spain";
  return "america";
}
function importSold(value) {
  return ["satilib", "satildi", "beli", "yes", "true", "1"].includes(
    normalizeHeader(value),
  );
}
async function importItems(file) {
  if (!file) return;
  try { await loadXlsx(); } catch { return notify("Excel modulu yüklənmədi. İnterneti yoxlayın."); }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const book = XLSX.read(event.target.result, { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const o = active();
      const items = rows
        .map((row) => {
          const name = String(
            readImportValue(row, ["mehsul", "mehsulunadi", "product", "name"]),
          ).trim();
          const qty =
            Number(readImportValue(row, ["say", "qty", "quantity"])) || 0;
          const sold = importSold(
            readImportValue(row, ["status", "satilib", "sold"]),
          );
          return {
            id: crypto.randomUUID(),
            name,
            qty,
            acquiredQty: qty,
            category:
              String(readImportValue(row, ["kateqoriya", "category"])).trim() ||
              "Ev və digər",
            country: importCountry(readImportValue(row, ["olke", "country"])),
            price:
              Number(
                readImportValue(row, [
                  "alisqiymeti",
                  "alis",
                  "price",
                  "purchaseprice",
                ]),
              ) || 0,
            sale:
              Number(
                readImportValue(row, [
                  "satisqiymeti",
                  "satis",
                  "sale",
                  "salesprice",
                ]),
              ) || 0,
            weight:
              Number(
                readImportValue(row, ["ceki", "weight", "gram", "grams"]),
              ) || 0,
            img: "",
            sold,
            soldAt: sold ? new Date().toISOString() : null,
          };
        })
        .filter((item) => item.name && item.qty > 0);
      if (!items.length) {
        return notify(
          "Oxunan məhsul tapılmadı. Başlıqlar: Məhsul, Say, Alış qiyməti, Satış qiyməti, Çəki, Ölkə, Kateqoriya, Status.",
        );
      }
      o.items.push(...items);
      save();
      render();
      notify(`${items.length} məhsul aktiv sifarişə əlavə edildi.`);
    } catch (error) {
      notify("Excel faylı oxunmadı. Faylın formatını yoxlayın.");
    }
  };
  reader.readAsArrayBuffer(file);
}
async function downloadImportTemplate() {
  try { await loadXlsx(); } catch { return notify("Excel modulu yüklənmədi. İnterneti yoxlayın."); }
  const rows = [
    [
      "Məhsul",
      "Say",
      "Alış qiyməti",
      "Satış qiyməti",
      "Çəki",
      "Ölkə",
      "Kateqoriya",
      "Status",
    ],
    ["Kreatin", 2, 27, 120, 360, "Amerika", "Əlavələr", "Satılmayıb"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 26 },
    { wch: 8 },
    { wch: 14 },
    { wch: 15 },
    { wch: 11 },
    { wch: 13 },
    { wch: 17 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Məhsullar");
  XLSX.writeFile(wb, "stockpilot-mehsul-import-nuemune.xlsx");
}
window.startStockPilot = () => {
  $("profileBtn").onclick = () => (location.href = "profile.html");
  if (isCustomerPage) {
    $("personalOrdersPanel").onclick = () => (location.href = "dashboard.html");
    const refreshWhenVisible = async () => {
      if (document.visibilityState === "visible") {
        try {
          await refreshCustomerOrders();
          render();
        } catch {
          // Sessiya bitibsə səhifə mövcud məlumatı göstərməyə davam edir.
        }
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
  } else {
    $("customerOrdersPanel").onclick = () => (location.href = "customer-orders.html");
  }
  $("openStats").onclick = () => (location.href = "account.html");
  $("openSettings").onclick = (event) => {
    event.preventDefault();
    tariffSettings();
  };
  if ($("newOrderTop")) $("newOrderTop").onclick = newOrder;
  if ($("archiveToggle")) $("archiveToggle").onclick = () => {
    state.ui.showArchived = !state.ui.showArchived;
    state.active = sortedOrders()[0]?.id || null;
    save();
    render();
  };
  if ($("exportBtn")) $("exportBtn").onclick = exportExcel;
  if ($("importBtn")) $("importBtn").onclick = () => $("excelImport").click();
  if ($("templateBtn")) $("templateBtn").onclick = downloadImportTemplate;
  $("storeBtn").onclick = () => window.open(`store.html?shop=${encodeURIComponent(window.currentUser?.username || '')}`, '_blank');
  if ($("quoteBtn")) $("quoteBtn").onclick = () => {
    const o = active();
    const w = window.open("", "_blank");
    const itemText = o.items
      .map((item) => `${esc(item.name)} — ${money(calc(item).sales)} ₼`)
      .join("<br>");
    w.document.write(`<title>Qiymət təklifi</title><h1>${esc(o.name)}</h1><p>${itemText}</p><h2>Cəmi: ${money(totals(o).sales)} ₼</h2><p>StockPilot qiymət təklifi</p>`);
    w.document.close();
    w.print();
  };
  if ($("excelImport")) $("excelImport").onchange = (event) => {
    importItems(event.target.files[0]);
    event.target.value = "";
  };
  if (location.hash === "#tariffs") setTimeout(tariffSettings, 0);
  $("closeModal").onclick = hideModal;
  $("modal").onclick = (e) => {
    if (e.target === $("modal")) hideModal();
  };
  if (!isCustomerPage && new URLSearchParams(location.search).get("add") === "1") {
    state.ui.productFormOpen = true;
    history.replaceState({}, "", "dashboard.html");
  }
  render();
};
