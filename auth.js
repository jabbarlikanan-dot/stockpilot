const LOCAL_USERS_KEY = "stockpilotLocalUsersV1";
const LOCAL_SESSION_PREFIX = "local:";

const api = (path, options = {}) =>
  fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(localStorage.stockpilotToken
        ? { Authorization: `Bearer ${localStorage.stockpilotToken}` }
        : {}),
    },
  });

function message(form, text) {
  form.querySelector(".msg").textContent = text;
}
function localUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}
function setupSwitcher() {
  document.querySelectorAll("[data-form]").forEach((button) => {
    button.onclick = () => {
      document
        .querySelectorAll("[data-form]")
        .forEach((item) => item.classList.toggle("active", item === button));
      document
        .querySelectorAll(".form")
        .forEach((item) =>
          item.classList.toggle(
            "active",
            item.id === `${button.dataset.form}Form`,
          ),
        );
    };
  });
}
async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
function photoData(file) {
  return new Promise((resolve) => {
    if (!file || !file.size) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  if (!/^\d{4}$/.test(body.password))
    return message(form, "Şifrə 4 rəqəm olmalıdır.");
  message(form, "");
  try {
    const response = await api("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readResponse(response);
    if (response.ok && data.token) {
      localStorage.stockpilotToken = data.token;
      return (location.href = "dashboard.html");
    }
  } catch {
    /* Static versiyada lokal giriş yoxlanacaq. */
  }
  const user = localUsers().find(
    (item) =>
      item.username === body.username && item.password === body.password,
  );
  if (!user)
    return message(form, "Məlumatlar yanlışdır. Username və şifrəni yoxlayın.");
  localStorage.stockpilotToken = `${LOCAL_SESSION_PREFIX}${user.username}`;
  location.href = "dashboard.html";
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const password = data.get("password");
  const confirm = data.get("confirm");
  if (password !== confirm) return message(form, "Şifrələr eyni deyil.");
  if (!/^\d{4}$/.test(password))
    return message(form, "Şifrə dəqiq 4 rəqəm olmalıdır.");
  data.delete("confirm");
  message(form, "");
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      body: data,
    });
    const result = await readResponse(response);
    if (response.ok && result.token)
      return (location.href = "index.html?registered=1");
    if (response.status === 409)
      return message(
        form,
        result.error || "Bu username artıq istifadə olunur.",
      );
  } catch {
    /* Static versiyada lokal yaddaş istifadə ediləcək. */
  }
  const username = String(data.get("username") || "").trim();
  const users = localUsers();
  if (
    users.some((item) => item.username.toLowerCase() === username.toLowerCase())
  )
    return message(form, "Bu username artıq istifadə olunur.");
  const file = data.get("photo");
  users.push({
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    username,
    password,
    photo: await photoData(file),
    state: { orders: [] },
  });
  saveLocalUsers(users);
  location.href = "index.html?registered=1&local=1";
}

document.addEventListener("DOMContentLoaded", () => {
  setupSwitcher();
  document
    .querySelectorAll("#loginForm")
    .forEach((form) => (form.onsubmit = login));
  document
    .querySelectorAll("#registerForm")
    .forEach((form) => (form.onsubmit = register));
  const params = new URLSearchParams(location.search);
  if (params.get("registered") === "1") {
    document.querySelectorAll("#loginForm .msg").forEach((item) => {
      item.textContent =
        params.get("local") === "1"
          ? "Qeydiyyat tamamlandı. Username və şifrənlə daxil ol."
          : "Qeydiyyat database-ə yazıldı. Username və şifrənlə daxil ol.";
      item.style.color = "#c6d92c";
    });
  }
});
