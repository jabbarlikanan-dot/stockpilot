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
    return message(form, data.error || "Məlumatlar yanlışdır.");
  } catch {
    return message(
      form,
      "Serverə qoşulmaq alınmadı. İnterneti yoxlayıb yenidən cəhd edin.",
    );
  }
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
    return message(
      form,
      result.error || "Qeydiyyat baş tutmadı. Məlumatları yoxlayın.",
    );
  } catch {
    return message(
      form,
      "Serverə qoşulmaq alınmadı. Qeydiyyat database-ə yazılmadı.",
    );
  }
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
        "Qeydiyyat database-ə yazıldı. Username və şifrənlə daxil ol.";
      item.style.color = "#c6d92c";
    });
  }
});
