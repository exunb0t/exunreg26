function isMobile() {
  return window.innerHeight > window.innerWidth || window.innerWidth <= 768;
}

async function loadComponent(componentPath, targetElement) {
  try {
    const response = await fetch(componentPath);
    const html = await response.text();
    if (targetElement) {
      if (targetElement === document.body) {
        document.body.insertAdjacentHTML("beforeend", html);
      } else {
        targetElement.innerHTML = html;
      }
    }
    return html;
  } catch (error) {
    console.error("Error loading component:", error);
    return "";
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function renderMarkdown(src) {
  const inline = (t) => {
    let h = escapeHtml(t);
    h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return h;
  };
  const lines = String(src == null ? "" : src).split("\n");
  const parts = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) parts.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) parts.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const line of lines) {
    const ulm = line.match(/^\s*[-*]\s+(.*)$/);
    const olm = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ulm || olm) {
      flushPara();
      const tag = ulm ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ulm || olm)[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      const hm = line.match(/^\s*#{1,3}\s+(.*)$/);
      if (hm) flushPara();
      para.push(hm ? `**${hm[1]}**` : line);
    }
  }
  flushPara();
  flushList();
  return parts.join("");
}

function showToast(message, type = "info") {
  const holdMs = type === "error" ? 6000 : 3000;
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  while (stack.children.length >= 4) {
    stack.firstChild.remove();
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("toast--show");
  });
  setTimeout(() => {
    toast.classList.remove("toast--show");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, holdMs);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  const phoneRegex = /^\+?[\d\s\-()]{8,}$/;
  return phoneRegex.test(phone);
}

function sanitizeHTML(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAllowedUrl(url) {
  const v = String(url || "").trim();
  return /^(https?:\/\/|\/|#)/i.test(v) && !/^javascript:/i.test(v) && !/^data:/i.test(v);
}

function sanitizeAttr(str) {
  return sanitizeHTML(str);
}

const MATERIAL_PATHS = {
  category: "m260-520 220-360 220 360H260ZM700-80q-75 0-127.5-52.5T520-260q0-75 52.5-127.5T700-440q75 0 127.5 52.5T880-260q0 75-52.5 127.5T700-80Zm-580-20v-320h320v320H120Zm580-60q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm-500-20h160v-160H200v160Zm202-420h156l-78-126-78 126Zm78 0ZM360-340Zm340 80Z",
  flag: "M200-120v-680h360l16 80h224v400H520l-16-80H280v280h-80Zm300-440Zm86 160h134v-240H510l-16-80H280v240h290l16 80Z",
  calendar_month: "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z",
  forum: "M280-240q-17 0-28.5-11.5T240-280v-80h520v-360h80q17 0 28.5 11.5T880-680v600L720-240H280ZM80-280v-560q0-17 11.5-28.5T120-880h520q17 0 28.5 11.5T680-840v360q0 17-11.5 28.5T640-440H240L80-280Zm520-240v-280H160v280h440Zm-440 0v-280 280Z",
  support_agent: "M440-120v-80h320v-284q0-117-81.5-198.5T480-764q-117 0-198.5 81.5T200-484v244h-40q-33 0-56.5-23.5T80-320v-80q0-21 10.5-39.5T120-469l3-53q8-68 39.5-126t79-101q47.5-43 109-67T480-840q68 0 129 24t109 66.5Q766-707 797-649t40 126l3 52q19 9 29.5 27t10.5 38v92q0 20-10.5 38T840-249v49q0 33-23.5 56.5T760-120H440Zm-80-280q-17 0-28.5-11.5T320-440q0-17 11.5-28.5T360-480q17 0 28.5 11.5T400-440q0 17-11.5 28.5T360-400Zm240 0q-17 0-28.5-11.5T560-440q0-17 11.5-28.5T600-480q17 0 28.5 11.5T640-440q0 17-11.5 28.5T600-400Zm-359-62q-7-106 64-182t177-76q89 0 156.5 56.5T720-519q-91-1-167.5-49T435-698q-16 80-67.5 142.5T241-462Z",
  schedule: "m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z",
  task_alt: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-18-2-36t-6-35l65-65q11 32 17 66t6 70q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-56-216L254-466l56-56 114 114 400-401 56 56-456 457Z",
  pending_actions: "M680-80q-83 0-141.5-58.5T480-280q0-83 58.5-141.5T680-480q83 0 141.5 58.5T880-280q0 83-58.5 141.5T680-80Zm67-105 28-28-75-75v-112h-40v128l87 87Zm-547 65q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v250q-18-13-38-22t-42-16v-212h-80v120H280v-120h-80v560h212q7 22 16 42t22 38H200Zm280-640q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z"
};

function icon(name, size) {
  const d = MATERIAL_PATHS[name];
  if (!d) return "";
  const s = Number(size) || 18;
  return `<svg class="mi" width="${s}" height="${s}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}

function escapeHtml(str) {
  return sanitizeHTML(String(str == null ? "" : str));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  } catch (error) {
    console.error("Failed to copy:", error);
    showToast("Failed to copy to clipboard", "error");
  }
}

function generateRandomId() {
  return Math.random().toString(36).substr(2, 9);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

async function handleFormSubmit(form, submitHandler) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  try {
    await submitHandler(data);
  } catch (error) {
    console.error("Form submission error:", error);
    showToast(error.message || "An error occurred", "error");
  }
}

function setLoading(element, isLoading) {
  if (!element) return;
  if (isLoading) {
    element.disabled = true;
    element.classList.add("loading");
    if (element.dataset.originalText === undefined) {
      element.dataset.originalText = element.textContent;
    }
    element.textContent = "Loading...";
  } else {
    element.disabled = false;
    element.classList.remove("loading");
    if (element.dataset.originalText !== undefined) {
      element.textContent = element.dataset.originalText;
      delete element.dataset.originalText;
    }
  }
}

function redirect(url, delay = 0) {
  setTimeout(() => {
    window.location.href = url;
  }, delay);
}

function formatEventMode(mode) {
  if (!mode || typeof mode !== "string") return "";
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
}

function formatParticipants(count) {
  const n = Number(count);
  if (!Number.isFinite(n)) return String(count || "TBA");
  if (n === 1) return "1 participant";
  return `${n} participants`;
}

function formatParticipantsDisplay(event) {
  const custom = event ? (event.display_participants || event.displayParticipants) : "";
  if (custom && /[a-zA-Z]/.test(String(custom))) return String(custom);
  return formatParticipants(event ? event.participants : 0);
}

function formatEligibility(eligibility, openToAll) {
  if (openToAll) return "Open to All";
  const nums = (String(eligibility == null ? "" : eligibility).match(/\d+/g) || []).map((n) => n.trim());
  if (nums.length >= 2) return `${nums[0]}th - ${nums[nums.length - 1]}th`;
  if (nums.length === 1) return `${nums[0]}th`;
  const clean = String(eligibility == null ? "" : eligibility).trim();
  return clean === "" ? "All Classes" : clean;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rememberEventBack(href) {
  try {
    sessionStorage.setItem("exun_event_back", href);
  } catch (e) {}
}

function readEventBack() {
  try {
    return sessionStorage.getItem("exun_event_back") || "";
  } catch (e) {
    return "";
  }
}

function focusEventCard(eventId) {
  if (!eventId) return false;
  const cards = document.querySelectorAll('.event-card[data-event-id]');
  for (const card of cards) {
    if (card.dataset.eventId === String(eventId)) {
      setTimeout(() => {
        try {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {
          card.scrollIntoView();
        }
      }, 80);
      card.classList.add("event-card--flash");
      setTimeout(() => card.classList.remove("event-card--flash"), 2400);
      return true;
    }
  }
  return false;
}

function showConfirmModal(message, title = "Confirm", confirmText = "Confirm", cancelText = "Cancel") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(244, 245, 247, 0.55)";
    overlay.style.backdropFilter = "blur(14px) saturate(1.25)";
    overlay.style.webkitBackdropFilter = "blur(14px) saturate(1.25)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "20000";
    overlay.tabIndex = 0;
    const box = document.createElement("div");
    box.style.background = "#fff";
    box.style.borderRadius = "16px";
    box.style.padding = "24px";
    box.style.maxWidth = "480px";
    box.style.width = "92%";
    box.style.boxShadow = "0 20px 60px rgba(2,6,23,0.2)";
    box.style.fontFamily = "'Outfit', sans-serif";
    const titleEl = document.createElement("div");
    titleEl.style.fontSize = "16px";
    titleEl.style.fontWeight = "700";
    titleEl.style.marginBottom = "8px";
    titleEl.textContent = title || "Confirm";
    const desc = document.createElement("div");
    desc.style.fontSize = "14px";
    desc.style.color = "#374151";
    desc.style.marginBottom = "16px";
    desc.textContent = message || "";
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "10px";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.textContent = cancelText || "Cancel";
    cancelBtn.style.borderRadius = "999px";
    cancelBtn.style.padding = "10px 24px";
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn--primary";
    confirmBtn.textContent = confirmText || "Confirm";
    confirmBtn.style.borderRadius = "999px";
    confirmBtn.style.padding = "10px 24px";
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    box.appendChild(titleEl);
    box.appendChild(desc);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const cleanup = () => {
      overlay.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        cleanup();
        resolve(false);
      }
      if (ev.key === "Enter") {
        cleanup();
        resolve(true);
      }
      if (ev.key === "Tab") {
        ev.preventDefault();
        if (document.activeElement === cancelBtn) confirmBtn.focus();
        else cancelBtn.focus();
      }
    };
    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(false);
    });
    confirmBtn.addEventListener("click", () => {
      cleanup();
      resolve(true);
    });
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) {
        cleanup();
        resolve(false);
      }
    });
    overlay.addEventListener("keydown", onKeyDown);
    setTimeout(() => {
      overlay.focus();
      cancelBtn.focus();
    }, 10);
  });
}

window.Utils = {
  isMobile,
  loadComponent,
  formatDate,
  renderMarkdown,
  icon,
  showToast,
  debounce,
  validateEmail,
  validatePhone,
  sanitizeHTML,
  sanitizeAttr,
  isAllowedUrl,
  escapeHtml,
  copyToClipboard,
  generateRandomId,
  formatFileSize,
  throttle,
  handleFormSubmit,
  setLoading,
  redirect,
  formatEventMode,
  formatParticipants,
  formatParticipantsDisplay,
  formatEligibility,
  slugify,
  showConfirmModal,
  rememberEventBack,
  readEventBack,
  focusEventCard
};

window.debounce = debounce;
window.slugify = slugify;
window.rememberEventBack = rememberEventBack;
window.readEventBack = readEventBack;
window.focusEventCard = focusEventCard;
window.escapeHtml = escapeHtml;
window.formatEventMode = formatEventMode;
window.formatParticipants = formatParticipants;
window.formatParticipantsDisplay = formatParticipantsDisplay;
window.formatEligibility = formatEligibility;
window.isMobile = isMobile;
