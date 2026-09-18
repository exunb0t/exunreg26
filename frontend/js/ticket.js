(function () {
  let priority = "medium";
  let previewId = "#Ex-0000";

  const $ = (id) => document.getElementById(id);

  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtTime(d) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function paintIds() {
    $("side-ticket-id").textContent = previewId;
    $("stub-id").textContent = previewId;
  }

  function paintNow() {
    const now = new Date();
    $("stub-date").textContent = fmtDate(now);
    $("stub-time").textContent = fmtTime(now).toUpperCase();
  }

  async function api(path, options) {
    const resp = await fetch(path, { credentials: "include", ...(options || {}) });
    const ct = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      let msg = `HTTP error! status: ${resp.status}`;
      if (ct.includes("application/json")) {
        const j = await resp.json().catch(() => null);
        msg = (j && (j.error || j.message)) || msg;
      }
      throw new Error(msg);
    }
    return ct.includes("application/json") ? resp.json() : resp.text();
  }

  async function init() {
    if (!window.ExunServices || !window.Utils) return;
    try {
      const session = await window.ExunServices.api.getSession();
      if (!session.authenticated) {
        Utils.showToast("Please log in to create a ticket", "error");
        setTimeout(() => (window.location.href = "/login"), 1200);
        return;
      }
    } catch (e) {
      window.location.href = "/login";
      return;
    }

    try {
      const resp = await api("/api/tickets/next", { method: "GET" });
      if (resp && resp.data && resp.data.displayId) previewId = resp.data.displayId;
    } catch (e) {}
    paintIds();
    paintNow();

    document.querySelectorAll(".segment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        priority = btn.dataset.value;
      });
    });

    const msg = $("t-message");
    msg.addEventListener("input", () => {
      $("t-count").textContent = `${msg.value.length} / 2000`;
    });

    let category = "";
    const dd = $("t-dropdown");
    const ddBtn = $("t-dropdown-btn");
    const ddPanel = $("t-dropdown-panel");
    const ddValue = $("t-dropdown-value");
    const closeDropdown = () => {
      ddPanel.hidden = true;
      ddBtn.setAttribute("aria-expanded", "false");
    };
    const placeDropdown = () => {
      ddPanel.classList.remove("dropdown-panel--above");
      const btnRect = ddBtn.getBoundingClientRect();
      const height = ddPanel.offsetHeight;
      const spaceBelow = window.innerHeight - btnRect.bottom;
      if (height > spaceBelow - 8 && btnRect.top > spaceBelow) {
        ddPanel.classList.add("dropdown-panel--above");
      }
      const rect = ddPanel.getBoundingClientRect();
      if (rect.bottom > window.innerHeight || rect.top < 0) {
        ddPanel.scrollIntoView({ block: "nearest" });
      }
    };
    ddBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = ddPanel.hidden;
      ddPanel.hidden = !willOpen;
      ddBtn.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) placeDropdown();
    });
    ddPanel.querySelectorAll("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        category = opt.dataset.value;
        ddValue.textContent = opt.textContent;
        ddValue.classList.remove("dropdown-placeholder");
        closeDropdown();
      });
    });
    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target)) closeDropdown();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });

    $("ticket-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const subject = $("t-subject").value.trim();
      const message = msg.value.trim();
      if (!subject) {
        Utils.showToast("Subject is required", "error");
        return;
      }
      if (!category) {
        Utils.showToast("Please choose a category", "error");
        return;
      }
      if (!message) {
        Utils.showToast("Description is required", "error");
        return;
      }
      const btn = $("t-submit");
      Utils.setLoading(btn, true);
      try {
        const form = new FormData();
        form.append("subject", subject);
        form.append("category", category);
        form.append("priority", priority);
        form.append("message", message);
        const resp = await fetch("/api/tickets", { method: "POST", credentials: "include", body: form });
        const ct = resp.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await resp.json().catch(() => null) : null;
        if (!resp.ok) throw new Error((data && (data.error || data.message)) || `HTTP error! status: ${resp.status}`);
        const realId = (data && data.data && data.data.displayId) || previewId;
        previewId = realId;
        paintIds();
        $("success-id").textContent = realId;
        $("ticket-form-wrap").hidden = true;
        $("ticket-success").hidden = false;
        Utils.showToast("Ticket submitted", "success");
      } catch (err) {
        Utils.showToast((err && err.message) || "Submit failed", "error");
      } finally {
        Utils.setLoading(btn, false);
      }
    });

    $("t-again").addEventListener("click", async () => {
      $("ticket-form").reset();
      document.querySelectorAll(".segment-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === "medium"));
      priority = "medium";
      category = "";
      $("t-dropdown-value").textContent = "Select a category";
      $("t-dropdown-value").classList.add("dropdown-placeholder");
      $("t-count").textContent = "0 / 2000";
      $("ticket-success").hidden = true;
      $("ticket-form-wrap").hidden = false;
      try {
        const resp = await api("/api/tickets/next", { method: "GET" });
        if (resp && resp.data && resp.data.displayId) previewId = resp.data.displayId;
      } catch (e) {}
      paintIds();
      paintNow();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
