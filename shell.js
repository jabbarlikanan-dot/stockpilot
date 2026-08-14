(() => {
  const key = "stockpilot.sidebar.compact";
  const makeUI = () => {
    if (window.StockPilotUI) return;
    const toastHost = document.createElement("div");
    toastHost.className = "sp-toast-host";
    toastHost.setAttribute("aria-live", "polite");
    document.body.appendChild(toastHost);
    const toast = (message, type = "info", timeout = 2800) => {
      if (!message) return;
      const el = document.createElement("div");
      el.className = `sp-toast sp-toast-${type}`;
      el.textContent = message;
      toastHost.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 180); }, timeout);
    };
    const promptNumber = ({ title = "Dəyər daxil edin", label = "Say", min = 0, max = 999999, value = 1, confirmText = "Təsdiqlə" } = {}) => new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "sp-dialog-backdrop";
      overlay.innerHTML = `<form class="sp-dialog" role="dialog" aria-modal="true"><div class="sp-dialog-head"><h2></h2><button type="button" class="sp-dialog-close" aria-label="Bağla">×</button></div><label class="sp-dialog-field"><span></span><input type="number" inputmode="numeric"></label><div class="sp-dialog-actions"><button type="button" class="sp-dialog-cancel">Ləğv et</button><button type="submit" class="sp-dialog-confirm"></button></div></form>`;
      const form = overlay.querySelector("form"), input = overlay.querySelector("input");
      overlay.querySelector("h2").textContent = title; overlay.querySelector("label span").textContent = label; overlay.querySelector(".sp-dialog-confirm").textContent = confirmText;
      input.min = min; input.max = max; input.value = value;
      const close = (result) => { document.removeEventListener("keydown", onKey); overlay.remove(); resolve(result); };
      const onKey = (event) => { if (event.key === "Escape") close(null); };
      overlay.querySelector(".sp-dialog-close").onclick = () => close(null);
      overlay.querySelector(".sp-dialog-cancel").onclick = () => close(null);
      overlay.onclick = (event) => { if (event.target === overlay) close(null); };
      form.onsubmit = (event) => { event.preventDefault(); const n = Number(input.value); if (!Number.isFinite(n) || n < min || n > max) { input.focus(); return; } close(n); };
      document.addEventListener("keydown", onKey); document.body.appendChild(overlay); setTimeout(() => { input.focus(); input.select(); }, 0);
    });
    window.StockPilotUI = { toast, promptNumber };
  };
  const setup = () => {
    makeUI();
    const shell = document.querySelector(".app-shell");
    const toggle = document.querySelector("[data-sidebar-toggle]");
    if (shell && toggle) {
      const apply = (compact) => {
        shell.classList.toggle("is-sidebar-compact", compact);
        toggle.setAttribute("aria-expanded", String(!compact));
        toggle.setAttribute("aria-label", compact ? "Menyunu aç" : "Menyunu yığ");
        toggle.title = compact ? "Menyunu aç" : "Menyunu yığ";
      };
      apply(localStorage.getItem(key) === "1");
      toggle.addEventListener("click", () => { const compact = !shell.classList.contains("is-sidebar-compact"); localStorage.setItem(key, compact ? "1" : "0"); apply(compact); });
    }
    document.querySelectorAll('a[href="#"]').forEach((link) => link.addEventListener("click", (event) => { if (!link.id) event.preventDefault(); }));
    const updateNetwork = () => document.documentElement.classList.toggle("is-offline", !navigator.onLine);
    addEventListener("online", () => { updateNetwork(); window.StockPilotUI.toast("İnternet bağlantısı bərpa olundu", "success"); });
    addEventListener("offline", () => { updateNetwork(); window.StockPilotUI.toast("İnternet bağlantısı yoxdur. Dəyişikliklər yadda qalmaya bilər.", "error", 4500); });
    updateNetwork();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", setup, { once: true }) : setup();
})();
