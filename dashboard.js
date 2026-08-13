const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const request = (path, options = {}) =>
  fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
let me;
function logout() {
  localStorage.removeItem("stockpilotToken");
  location.href = "index.html";
}
function format(amount) {
  return `${Number(amount || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
}
function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}
function startOfWeek(date) {
  const item = new Date(date);
  item.setHours(0, 0, 0, 0);
  item.setDate(item.getDate() - ((item.getDay() + 6) % 7));
  return item;
}
function paintUser() {
  const full = `${me.firstName} ${me.lastName}`;
  const avatar = me.photo
    ? `<img class="avatar" src="${me.photo}">`
    : `<b class="avatar">${me.firstName[0]}</b>`;
  document
    .querySelectorAll("#user")
    .forEach(
      (item) =>
        (item.innerHTML = `${avatar}<span><b>${full}</b><br><small>@${me.username}</small></span>`),
    );
}
function soldValue(item) {
  if (item.customerSale) return Number(item.sales) || 0;
  return (+item.sale || 0) * (+item.qty || 0);
}
function profitValue(item) {
  if (item.customerSale)
    return (Number(item.sales) || 0) - (Number(item.purchase) || 0);
  const rate = item.country === "spain" ? 1.96 : 1.7;
  return soldValue(item) - (+item.price || 0) * (+item.qty || 0) * rate;
}
function drawStats(state) {
  const now = new Date(),
    weekStart = startOfWeek(now),
    items = (state.orders || [])
      .flatMap((order) => order.items || [])
      .filter((item) => item.sold)
      .concat(
        (state.customerSales || []).map((sale) => ({
          ...sale,
          customerSale: true,
          sold: true,
          name: sale.name || "Müştəri sifarişi",
          qty: sale.quantity,
        })),
      );
  const inPeriod = (test) =>
    items.filter((item) => item.soldAt && test(new Date(item.soldAt)));
  const today = inPeriod((date) => sameDay(date, now)),
    week = inPeriod((date) => date >= weekStart && date <= now),
    month = inPeriod(
      (date) =>
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear(),
    ),
    year = inPeriod((date) => date.getFullYear() === now.getFullYear());
  const sum = (list, getter = soldValue) =>
    list.reduce((total, item) => total + getter(item), 0);
  const stats = document.getElementById("stats");
  if (stats)
    stats.innerHTML = `<div class="card"><span>Bu gün satış</span><b>${format(sum(today))}</b></div><div class="card"><span>Bu həftə satış</span><b>${format(sum(week))}</b></div><div class="card"><span>Bu ay qazanc</span><b>${format(sum(month, profitValue))}</b></div><div class="card"><span>Bu il satılan məhsul</span><b>${year.reduce((n, item) => n + (+item.qty || 0), 0)}</b></div>`;
  const names = ["B.e", "Ç.a", "Ç.", "C.a", "C.", "Ş.", "B."];
  const bars = names.map((day, index) => ({
    day,
    value: sum(inPeriod((date) => (date.getDay() + 6) % 7 === index)),
  }));
  const largest = Math.max(1, ...bars.map((bar) => bar.value));
  const chart = document.getElementById("chart");
  if (chart)
    chart.innerHTML = bars
      .map(
        (bar) =>
          `<div class="bar" style="height:${Math.max(8, Math.round((bar.value / largest) * 100))}%"><small>${bar.day}</small></div>`,
      )
      .join("");
  const detail = document.getElementById("detail");
  if (detail)
    detail.innerHTML = `<p class="notice">Bu profilə aid ümumi nəticə: <b>${format(sum(items))}</b> satış, <b>${format(sum(items, profitValue))}</b> qazanc.</p>`;
  const grouped = items.reduce((result, item) => {
    const key = item.name || "Adsız məhsul";
    result[key] = (result[key] || 0) + profitValue(item);
    return result;
  }, {});
  const top = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topProducts = document.getElementById("topProducts");
  if (topProducts)
    topProducts.innerHTML = `<h2>Ən çox qazandıran 3 məhsul</h2>${top.length ? `<ol>${top.map(([name, profit]) => `<li><span>${name}</span><b>${format(profit)}</b></li>`).join("")}</ol>` : '<p class="notice">Satılmış məhsul olduqda burada görünəcək.</p>'}`;
}
async function boot() {
  let state;
  try {
    const user = await request("/api/me");
    if (!user.ok) return logout();
    me = (await user.json()).user;
    const saved = await request("/api/state");
    state = saved.ok ? (await saved.json()).state : { orders: [] };
  } catch {
    return logout();
  }
  paintUser();
  document
    .querySelectorAll("#logout")
    .forEach((item) => (item.onclick = logout));
  drawStats(state);
}
boot();
