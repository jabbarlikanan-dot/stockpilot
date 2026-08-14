(() => {
  const key = "stockpilot.sidebar.compact";
  const setup = () => {
    const shell = document.querySelector(".app-shell");
    const toggle = document.querySelector("[data-sidebar-toggle]");
    if (!shell || !toggle) return;
    const apply = (compact) => {
      shell.classList.toggle("is-sidebar-compact", compact);
      toggle.setAttribute("aria-expanded", String(!compact));
      toggle.title = compact ? "Menyunu aç" : "Menyunu yığ";
    };
    apply(localStorage.getItem(key) === "1");
    toggle.addEventListener("click", () => {
      const compact = !shell.classList.contains("is-sidebar-compact");
      localStorage.setItem(key, compact ? "1" : "0");
      apply(compact);
    });
  };
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", setup, { once: true })
    : setup();
})();
