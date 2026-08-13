const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const api = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const defaults = { Amerika: { currency: "$", rate: 1.7, steps: [3.49, 5.49, 7.49, 9.77] }, Türkiyə: { currency: "$", rate: 1.7, steps: [1.49, 2.49, 3.49, 4.29] }, İspaniya: { currency: "€", rate: 1.95, steps: [1.75, 3.7, 5.6, 7.9] } };
let state = { countries: {} };
const money = (n) => Number(n || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function profile(user) { document.getElementById("user").innerHTML = `${user.photo ? `<img class="avatar" src="${user.photo}">` : `<b class="avatar">${user.firstName[0]}</b>`}<span><b>${user.firstName} ${user.lastName}</b><br><small>@${user.username}</small></span>`; }
function getTariff(country) {
  const saved = state.countries?.[country];
  if (!saved) return defaults[country];
  return { currency: saved.currency || defaults[country].currency, rate: Number(saved.rate || defaults[country].rate), steps: [Number(saved.p100), Number(saved.p250), Number(saved.p500), Number(saved.p1000)] };
}
function calculate() {
  const country = document.getElementById("country").value;
  const grams = Math.max(1, Number(document.getElementById("grams").value || 1));
  const tariff = getTariff(country);
  const price = grams <= 100 ? tariff.steps[0] : grams <= 250 ? tariff.steps[1] : grams <= 500 ? tariff.steps[2] : grams <= 1000 ? tariff.steps[3] : Math.ceil(grams / 1000) * tariff.steps[3];
  document.getElementById("result").innerHTML = `<span>${country} · ${grams} qram</span><h2>${money(price)} ${tariff.currency}</h2><b>${money(price * tariff.rate)} ₼</b><p>1 ${tariff.currency} = ${money(tariff.rate)} ₼ · ${grams > 1000 ? "1 kq-dan yuxarı tarif" : "standart tarif"}</p>`;
  document.getElementById("tariffs").innerHTML = ["0–100 qram", "101–250 qram", "251–500 qram", "501 qram–1 kq"].map((label, index) => `<div><span>${label}</span><b>${money(tariff.steps[index])} ${tariff.currency} / ${money(tariff.steps[index] * tariff.rate)} ₼</b></div>`).join("");
}
async function boot() {
  const [me, saved] = await Promise.all([api("/api/me"), api("/api/state")]);
  if (!me.ok || !saved.ok) { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; return; }
  profile((await me.json()).user); state = (await saved.json()).state || state; calculate();
  document.getElementById("calculate").onclick = calculate; document.getElementById("country").onchange = calculate; document.getElementById("grams").oninput = calculate;
  document.getElementById("logout").onclick = () => { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; };
}
boot();
