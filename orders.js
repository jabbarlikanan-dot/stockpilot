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
state.ui = {
  search: "",
  status: "all",
  orderSort: "newest",
  lastSavedAt: null,
  ...(state.ui || {}),
};
let pendingImage = "",
  editing = null,
  lastDeleted = null;
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
const save = () => {
  state.ui.lastSavedAt = new Date().toISOString();
  window.persistStockState(state);
};
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
      }).format(new Date(v))
    : "—";
function calc(i) {
  const c = country(i.country),
    q = +i.qty || 0,
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
function totals(o) {
  return (o.items || []).reduce(
    (a, i) => {
      const x = calc(i);
      a.purchase += x.purchase;
      a.items += +i.qty || 0;
      if (i.sold) {
        a.sales += x.sales;
        a.profit += x.profit;
        a.sold += +i.qty || 0;
      }
      return a;
    },
    { purchase: 0, sales: 0, profit: 0, items: 0, sold: 0 },
  );
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
function newOrder() {
  const o = {
    id: Date.now().toString(),
    name: `Sifariş ${state.orders.length + 1}`,
    budget: 0,
    note: "",
    createdAt: new Date().toISOString(),
    items: [],
  };
  state.orders.push(o);
  state.active = o.id;
  save();
  render();
}
function sortedOrders() {
  return [...state.orders].sort((a, b) =>
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
        (status === "all" || (status === "sold" ? item.sold : !item.sold)),
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
function render() {
  if (!state.orders.length) return newOrder();
  tabs();
  const o = active();
  if (!o) {
    state.active = state.orders[0].id;
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
    todaySold = (o.items || []).filter(
      (i) => i.sold && i.soldAt && new Date(i.soldAt).toDateString() === today,
    ),
    todayValue = todaySold.reduce((s, i) => s + calc(i).sales, 0),
    rows = visibleItems(o);
  $("content").innerHTML =
    `<section class="box orderbar"><div class="field name"><label>Sifarişin adı</label><input id="orderName" value="${esc(o.name)}"></div><div class="field"><label>Yaradılma tarixi</label><input readonly value="${dateTime(o.createdAt)}"></div><div class="field"><label>Büdcə (₼)</label><input id="budget" type="number" min="0" value="${o.budget || 0}"></div><div class="field"><label>Qısa qeyd</label><input id="orderNote" maxlength="80" value="${esc(o.note || "")}" placeholder="Məsələn: Avqust malları"></div><button id="deleteOrder" class="danger">Sifarişi sil</button></section><section class="box tools"><input id="search" value="${esc(state.ui.search)}" placeholder="Məhsul adında axtarış…"><select id="statusFilter"><option value="all">Bütün məhsullar</option><option value="sold" ${state.ui.status === "sold" ? "selected" : ""}>Satılanlar</option><option value="unsold" ${state.ui.status === "unsold" ? "selected" : ""}>Satılmayanlar</option></select><select id="orderSort"><option value="newest">Yeni sifarişlər əvvəl</option><option value="oldest" ${state.ui.orderSort === "oldest" ? "selected" : ""}>Köhnə sifarişlər əvvəl</option></select><small>Son yadda saxlanma: ${dateTime(state.ui.lastSavedAt)}</small></section><section class="workspace"><aside class="box form"><h2>${e ? "Məhsulu redaktə et" : "Məhsul əlavə et"}</h2><div class="grid"><div class="field wide"><label>Məhsulun adı</label><input id="name" value="${e ? esc(e.name) : ""}" placeholder="Məsələn: Kreatin"></div><div class="field"><label>Kateqoriya</label><select id="category">${["Əlavələr", "Geyim", "Elektronika", "Kosmetika", "Ev və digər"].map((v) => `<option ${e?.category === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field"><label>Ölkə</label><select id="productCountry">${countryOptions(e ? e.country : "america")}</select></div><div class="field"><label>Say</label><div class="qty-control"><button type="button" id="qtyMinus">−</button><input id="qty" type="number" min="1" value="${e ? e.qty : 1}"><button type="button" id="qtyPlus">+</button></div></div><div class="field"><label>Alış qiyməti</label><input id="price" type="number" min="0" step=".01" value="${e ? e.price : 0}"></div><div class="field"><label>Satış qiyməti (₼)</label><input id="sale" type="number" min="0" step=".01" value="${e ? e.sale : 0}"></div><div class="field wide"><label>Çəki (qram, ümumi)</label><input id="weight" type="number" min="0" value="${e ? e.weight : 0}"></div><div class="field wide"><label>Məhsul şəkli</label><input id="image" class="file" type="file" accept="image/png,image/jpeg,image/webp">${e && pendingImage ? '<button id="deleteImage" class="remove" style="margin-top:8px">Şəkli sil</button>' : ""}</div></div><p class="hint">Seçilən ölkənin tarifi və məzənnəsi avtomatik tətbiq olunur.</p><button id="saveItem" class="primary save">${e ? "Dəyişiklikləri yadda saxla" : "Listə əlavə et"}</button>${e ? '<button id="cancelEdit" class="secondary save">Ləğv et</button>' : ""}</aside><section class="box tablebox"><div class="scroll"><table class="items"><thead><tr><th>Şəkil</th><th>Məhsul / kateqoriya</th><th>Ölkə</th><th>Say</th><th>Alış</th><th>Karqo</th><th>Ümumi alış</th><th>Satış</th><th>Qazanc</th><th>Faiz</th><th>Status</th><th>Əməliyyat</th></tr></thead><tbody>${
      rows.length
        ? rows
            .map(({ item: i, index: n }) => {
              const x = calc(i),
                im = i.img
                  ? `<img class="thumb" src="${i.img}">`
                  : '<div class="noimg">Şəkil<br>yoxdur</div>';
              return `<tr><td>${im}</td><td><b>${esc(i.name)}</b><small class="category">${esc(i.category || "Digər")}</small></td><td>${x.c.name}</td><td class="num">${i.qty}</td><td class="num">${money((+i.price || 0) * (+i.qty || 0) * x.c.rate)} ₼</td><td class="num">${money(x.ship * x.c.rate)} ₼<br><small>${range(i.weight)}</small></td><td class="num">${money(x.purchase)} ₼</td><td class="num">${money(x.sales)} ₼</td><td class="num lime">${money(x.profit)} ₼</td><td class="num">${(x.pct * 100).toFixed(1)}%</td><td><button class="sold" data-sold="${n}">${i.sold ? `Satılıb<br><small>${dateTime(i.soldAt)}</small>` : "Satıldı et"}</button></td><td><button class="edit" data-edit="${n}">Redaktə</button><button class="remove" data-remove="${n}">Sil</button></td></tr>`;
            })
            .join("")
        : '<tr><td colspan="12" class="empty">Bu filterdə məhsul yoxdur.</td></tr>'
    }</tbody></table></div></section></section><section class="metrics"><div class="box metric"><span>Ümumi alış</span><strong>${money(t.purchase)} ₼</strong></div><div class="box metric"><span>Bu gün satılanlar</span><strong>${todaySold.reduce((s, i) => s + (+i.qty || 0), 0)} ədəd</strong><small>${money(todayValue)} ₼ satış</small></div><div class="box metric"><span>Satış qazancı</span><strong class="lime">${money(t.profit)} ₼</strong></div><div class="box metric budget-card"><span>Büdcə: xərcləndi / qaldı</span><strong>${money(spent)} ₼ / ${money(Math.max(0, remain))} ₼</strong><div class="progress"><i style="width:${used}%"></i></div><small>${used.toFixed(1)}% xərclənib</small></div></section>`;
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
    const i = {
      name: $("name").value.trim(),
      category: $("category").value,
      country: $("productCountry").value,
      qty: +$("qty").value || 0,
      price: +$("price").value || 0,
      sale: +$("sale").value || 0,
      weight: +$("weight").value || 0,
      img: pendingImage,
      sold: e ? e.sold : false,
      soldAt: e?.soldAt || null,
    };
    if (!i.name || !i.qty) return alert("Məhsulun adını və sayını yazın.");
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
      (b.onclick = () => {
        const i = o.items[+b.dataset.sold];
        i.sold = !i.sold;
        i.soldAt = i.sold ? new Date().toISOString() : null;
        save();
        render();
      }),
  );
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
  const rows = Object.entries(state.countries)
    .map(
      ([k, c]) =>
        `<div class="country-editor"><b>${c.name} (${c.currency})</b>${c.tariffs.map((v, n) => `<input data-country="${k}" data-tariff="${n}" type="number" step=".01" value="${v}">`).join("")}<input data-rate="${k}" type="number" step=".01" value="${c.rate}" title="AZN məzənnəsi"></div>`,
    )
    .join("");
  showModal(
    "Tarif və məzənnə ayarları",
    `<p class="hint">Sıra: 0–100 qr, 101–250 qr, 251–500 qr, 501 qr–1 kq, AZN məzənnəsi.</p>${rows}<button id="saveTariffs" class="primary" style="margin-top:12px">Tarifləri yadda saxla</button>`,
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
    save();
    hideModal();
    render();
  };
}
function exportExcel() {
  if (!window.XLSX) return alert("Excel modulu yüklənmədi.");
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
function importItems(file) {
  if (!window.XLSX) return alert("Excel modulu yüklənmədi.");
  if (!file) return;
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
            name,
            qty,
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
        return alert(
          "Oxunan məhsul tapılmadı. Başlıqlar: Məhsul, Say, Alış qiyməti, Satış qiyməti, Çəki, Ölkə, Kateqoriya, Status.",
        );
      }
      o.items.push(...items);
      save();
      render();
      alert(`${items.length} məhsul aktiv sifarişə əlavə edildi.`);
    } catch (error) {
      alert("Excel faylı oxunmadı. Faylın formatını yoxlayın.");
    }
  };
  reader.readAsArrayBuffer(file);
}
function downloadImportTemplate() {
  if (!window.XLSX) return alert("Excel modulu yüklənmədi.");
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
  $("profileBtn").onclick = () => (location.href = "account.html");
  $("openStats").onclick = () => (location.href = "account.html");
  $("openSettings").onclick = tariffSettings;
  $("newOrderTop").onclick = newOrder;
  $("exportBtn").onclick = exportExcel;
  $("importBtn").onclick = () => $("excelImport").click();
  $("templateBtn").onclick = downloadImportTemplate;
  $("excelImport").onchange = (event) => {
    importItems(event.target.files[0]);
    event.target.value = "";
  };
  $("closeModal").onclick = hideModal;
  $("modal").onclick = (e) => {
    if (e.target === $("modal")) hideModal();
  };
  render();
};
