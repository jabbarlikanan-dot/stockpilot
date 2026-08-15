const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const api = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const logout = () => { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; };
function paint(user) {
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const userRoot = document.getElementById("user");
  userRoot.replaceChildren();
  const avatar = user.photo ? Object.assign(document.createElement("img"), { className: "avatar", src: user.photo, alt: "" }) : Object.assign(document.createElement("b"), { className: "avatar", textContent: (user.firstName || "U")[0].toUpperCase() });
  const userCopy = document.createElement("span");
  const name = document.createElement("b"); name.textContent = full;
  const br = document.createElement("br");
  const username = document.createElement("small"); username.textContent = `@${user.username || ""}`;
  userCopy.append(name, br, username); userRoot.append(avatar, userCopy);

  const hero = document.getElementById("profileHero");
  hero.replaceChildren();
  const heroAvatar = document.createElement("div"); heroAvatar.className = "hero-avatar";
  if (user.photo) heroAvatar.append(Object.assign(document.createElement("img"), { src: user.photo, alt: "" })); else heroAvatar.textContent = (user.firstName || "U")[0].toUpperCase();
  const h2 = document.createElement("h2"); h2.textContent = full;
  const p = document.createElement("p"); p.textContent = `@${user.username || ""}`;
  hero.append(heroAvatar, h2, p);
}

async function boot() {
  const res = await api("/api/me");
  if (!res.ok) return logout();
  let user = (await res.json()).user;
  paint(user);
  const form = document.getElementById("profileForm");
  form.firstName.value = user.firstName;
  form.lastName.value = user.lastName;
  form.username.value = user.username;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    const msg = document.getElementById("message");
    if (body.newPassword && !/^\d{4}$/.test(body.newPassword)) return (msg.textContent = "Yeni şifrə 4 rəqəmli olmalıdır.");
    const update = await api("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await update.json().catch(() => ({}));
    if (!update.ok) { msg.className = "msg"; return (msg.textContent = data.error || "Dəyişiklik yadda saxlanmadı."); }
    localStorage.stockpilotToken = data.token;
    user = data.user;
    paint(user);
    form.currentPassword.value = ""; form.newPassword.value = "";
    msg.className = "success"; msg.textContent = "Profil uğurla yeniləndi.";
  };
  document.getElementById("logout").onclick = logout;
}
boot().catch(logout);

async function setupStoreSettings() {
  const form = document.getElementById("storeSettingsForm");
  if (!form) return;
  const message = document.getElementById("storeSettingsMessage");
  const response = await api("/api/store-settings");
  const data = await response.json().catch(() => ({}));
  if (response.ok && data.settings) {
    for (const [key, value] of Object.entries(data.settings)) if (form.elements[key]) form.elements[key].value = value;
  }
  document.getElementById("useStoreLocation").onclick = () => {
    if (!navigator.geolocation) { message.textContent = "Bu cihazda konum xidməti yoxdur."; return; }
    message.textContent = "Konum alınır…";
    navigator.geolocation.getCurrentPosition((position) => {
      form.originLat.value = position.coords.latitude.toFixed(6);
      form.originLng.value = position.coords.longitude.toFixed(6);
      message.textContent = "Cari konum götürüldü. Yadda saxlamağı unutmayın.";
    }, () => { message.textContent = "Konumu almaq mümkün olmadı."; }, { enableHighAccuracy:true, timeout:9000 });
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    message.textContent = "Saxlanılır…";
    const body = Object.fromEntries(new FormData(form));
    const save = await api("/api/store-settings", { method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
    const saved = await save.json().catch(() => ({}));
    message.textContent = save.ok ? "Çatdırılma ayarları saxlanıldı." : (saved.error || "Ayarlar saxlanılmadı.");
  };
}
setupStoreSettings().catch(() => {});

// v35 — Bakı ride-hailing balanslı preset
(() => {
  const preset = document.getElementById("taxiPreset");
  const form = document.getElementById("storeSettingsForm");
  if (!preset || !form) return;
  preset.addEventListener("click", () => {
    form.baseFee.value = "3.20";
    form.perKm.value = "0.32";
    form.minFee.value = "5.00";
    form.morningMultiplier.value = "1.08";
    form.eveningMultiplier.value = "1.12";
    form.nightMultiplier.value = "1.08";
    form.weekendMultiplier.value = "1.05";
    const message = document.getElementById("storeSettingsMessage");
    if (message) message.textContent = "Bakı taksi preset tətbiq edildi. Yadda saxlamaq üçün düyməni basın.";
  });
})();
