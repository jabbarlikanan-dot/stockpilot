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
