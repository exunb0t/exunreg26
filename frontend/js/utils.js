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
  }, 3000);
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
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
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
    .trim()
    .toLowerCase()
    .replace(/[:'/"?!.,]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
  showToast,
  debounce,
  validateEmail,
  validatePhone,
  sanitizeHTML,
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
