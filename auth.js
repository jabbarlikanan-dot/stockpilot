const api = (path, options = {}) => fetch(path, { ...options, credentials: "same-origin", headers: { ...(options.headers || {}) } });

function message(form, text) {
  form.querySelector(".msg").textContent = text;
}
function sizeActiveForm() {
  const wrap = document.querySelector(".form-wrap");
  const active = document.querySelector(".form.active");
  if (!wrap || !active) return;
  requestAnimationFrame(() => { wrap.style.minHeight = `${Math.ceil(active.scrollHeight)}px`; });
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
      sizeActiveForm();
    };
  });
  sizeActiveForm();
  addEventListener("resize", sizeActiveForm);
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
  const submit = form.querySelector('button[type="submit"], button.primary');
  const original = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = "Daxil olunur…"; }
  try {
    const response = await api("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readResponse(response);
    if (response.ok) {
      localStorage.removeItem("stockpilotToken");
      return (location.href = "dashboard.html");
    }
    const suffix = data.requestId ? ` · ID: ${data.requestId}` : "";
    return message(form, `${data.error || "Məlumatlar yanlışdır."}${suffix}`);
  } catch {
    return message(
      form,
      "Serverə qoşulmaq alınmadı. İnterneti yoxlayıb yenidən cəhd edin.",
    );
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = original; }
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
  const submit = form.querySelector('button[type="submit"], button.primary');
  const original = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = "Hesab yaradılır…"; }
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      credentials: "same-origin",
      body: data,
    });
    const result = await readResponse(response);
    if (response.ok) {
      localStorage.removeItem("stockpilotToken");
      return (location.href = "dashboard.html");
    }
    return message(
      form,
      `${result.error || "Qeydiyyat baş tutmadı. Məlumatları yoxlayın."}${result.requestId ? ` · ID: ${result.requestId}` : ""}`,
    );
  } catch {
    return message(
      form,
      "Serverə qoşulmaq alınmadı. Qeydiyyat database-ə yazılmadı.",
    );
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = original; }
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
});
