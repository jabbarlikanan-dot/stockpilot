const token = localStorage.stockpilotToken;
if (!token) location.href = "index.html";
const api = (path, options = {}) => fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const logout = () => { localStorage.removeItem("stockpilotToken"); location.href = "index.html"; };
function paint(user) {
  const full = `${user.firstName} ${user.lastName}`;
  document.getElementById("user").innerHTML = `${user.photo ? `<img class="avatar" src="${user.photo}">` : `<b class="avatar">${user.firstName[0]}</b>`}<span><b>${full}</b><br><small>@${user.username}</small></span>`;
  document.getElementById("profileHero").innerHTML = `<div class="hero-avatar">${user.photo ? `<img src="${user.photo}">` : user.firstName[0]}</div><h2>${full}</h2><p>@${user.username}</p>`;
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
    const data = await update.json();
    if (!update.ok) return (msg.textContent = data.error || "Dəyişiklik yadda saxlanmadı.");
    localStorage.stockpilotToken = data.token;
    user = data.user;
    paint(user);
    form.currentPassword.value = ""; form.newPassword.value = "";
    msg.className = "success"; msg.textContent = "Profil uğurla yeniləndi.";
  };
  document.getElementById("logout").onclick = logout;
}
boot().catch(logout);
