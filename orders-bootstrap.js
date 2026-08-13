const token = localStorage.stockpilotToken;
const defaultState = {
  active: null,
  orders: [],
  countries: {
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
  },
};
let currentUser;

function logout() {
  localStorage.removeItem("stockpilotToken");
  location.href = "index.html";
}
function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

window.persistStockState = async (state) => {
  try {
    const response = await api("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) throw new Error("State save failed");
  } catch {
    console.error("Məlumat serverə yazılmadı.");
  }
};

window.accountPanel = () => {
  const total = allTotals();
  showModal(
    "Hesabım və ümumi statistika",
    `<p class="hint">Bütün sifariş səhifələrinin ümumi göstəriciləri.</p><div class="stats"><div><span>Məhsul sayı</span><b>${total.items}</b></div><div><span>Satılmış məhsul</span><b>${total.sold}</b></div><div><span>Ümumi satış</span><b>${money(total.sales)} ₼</b></div><div><span>Ümumi qazanc</span><b>${money(total.profit)} ₼</b></div></div>`,
  );
};

async function start() {
  if (!token) return logout();
  let state = defaultState;
  try {
    const me = await api("/api/me");
    if (!me.ok) return logout();
    currentUser = (await me.json()).user;
    window.currentUser = currentUser;
    const saved = await api("/api/state");
    if (saved.ok) state = (await saved.json()).state || defaultState;
    const customer = await api("/api/customer-orders");
    window.__customerOrders = customer.ok ? (await customer.json()).orders || [] : [];
  } catch {
    return logout();
  }
  state = {
    ...defaultState,
    ...state,
    orders: Array.isArray(state.orders) ? state.orders : [],
    countries: { ...defaultState.countries, ...(state.countries || {}) },
  };
  window.__stockState = state;
  document.getElementById("profileInitial").textContent =
    currentUser.firstName[0].toUpperCase();
  document.getElementById("profileName").textContent =
    `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById("logout").onclick = logout;
  const orders = document.createElement("script");
  orders.src = "orders.js";
  orders.onload = () => window.startStockPilot();
  document.body.appendChild(orders);
}
start();
