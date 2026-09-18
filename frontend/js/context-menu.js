(function () {
  const ICONS = {
    sparkle: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c.9 6.2 3.8 9.1 10 10-6.2.9-9.1 3.8-10 10-.9-6.2-3.8-9.1-10-10 6.2-.9 9.1-3.8 10-10z"/></svg>',
    copy: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    external: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    link: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    image: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    back: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    forward: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    reload: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  let menu = null;
  let authedCache = null;

  async function isAuthed() {
    if (authedCache !== null) return authedCache;
    try {
      const s = await window.ExunServices.api.getSession();
      authedCache = !!(s && s.authenticated);
    } catch (e) {
      authedCache = false;
    }
    return authedCache;
  }

  function inEditable(t) {
    return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function selectionText() {
    try {
      const s = window.getSelection();
      if (!s || s.isCollapsed) return "";
      return (s.toString() || "").trim();
    } catch (e) {
      return "";
    }
  }

  function elementContext(el) {
    let node = el instanceof Element ? el : null;
    while (node && node !== document.body) {
      const t = (node.innerText || "").replace(/\s+/g, " ").trim();
      if (t.length >= 30) return t.slice(0, 800);
      node = node.parentElement;
    }
    return "Page: " + (document.title || window.location.pathname);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      Utils.showToast("Copied to clipboard", "success");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        Utils.showToast("Copied to clipboard", "success");
      } catch (err) {
        Utils.showToast("Copy failed", "error");
      }
      ta.remove();
    }
  }

  function ensureMenu() {
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "ctx-menu";
      document.body.appendChild(menu);
    }
    return menu;
  }

  function closeMenu() {
    if (menu) menu.classList.remove("open");
  }

  function openMenu(x, y, items) {
    const m = ensureMenu();
    m.innerHTML = "";
    const groups = [[], [], []];
    let lastGroup = 0;
    for (const it of items) {
      if (it.divider) {
        groups[lastGroup].push(it);
        continue;
      }
      lastGroup = it.danger ? 2 : it.warn ? 1 : 0;
      groups[lastGroup].push(it);
    }
    const trim = (g) => {
      while (g.length && g[0].divider) g.shift();
      while (g.length && g[g.length - 1].divider) g.pop();
      return g;
    };
    const safe = trim(groups[0]);
    const modify = trim(trim(groups[1]).concat(trim(groups[2])));
    const sections = [safe, modify].filter((g) => g.length > 0);
    const addSep = () => {
      const sep = document.createElement("div");
      sep.className = "ctx-sep";
      m.appendChild(sep);
    };
    sections.forEach((group, gi) => {
      if (gi > 0) addSep();
      group.forEach((it) => {
        if (it.divider) {
          addSep();
          return;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ctx-item" + (it.primary ? " primary" : "") + (it.danger ? " danger" : "") + (it.disabled ? " disabled" : "");
        b.innerHTML = `${ICONS[it.icon] || ""}<span></span>`;
        b.querySelector("span").textContent = it.label;
        if (it.disabled) {
          b.disabled = true;
          b.title = "Login to use this";
        } else {
          b.addEventListener("click", () => {
            closeMenu();
            it.action();
          });
        }
        m.appendChild(b);
      });
    });
    m.style.visibility = "hidden";
    m.classList.add("open");
    const r = m.getBoundingClientRect();
    let lx = Math.min(x, window.innerWidth - r.width - 8);
    let ly = Math.min(y, window.innerHeight - r.height - 8);
    m.style.left = Math.max(8, lx) + "px";
    m.style.top = Math.max(8, ly) + "px";
    m.style.visibility = "";
  }

  document.addEventListener("contextmenu", async (e) => {
    if (e.target && e.target.closest && e.target.closest("#ctx-menu")) {
      closeMenu();
      return;
    }
    if (inEditable(e.target)) return;
    e.preventDefault();
    const t = e.target;
    const link = t && t.closest ? t.closest("a[href]") : null;
    const img = t && t.closest ? t.closest("img[src]") : null;
    const sel = selectionText();
    const authed = await isAuthed();
    const regCard = t && t.closest ? t.closest(".registration-card[data-event-id]") : null;
    const evCard = !regCard && t && t.closest ? t.closest(".event-card[href]") : null;
    const cardHandled = !!(regCard || evCard);
    const items = [];
    const ctx = elementContext(t);
    items.push({
      icon: "sparkle",
      primary: true,
      disabled: !authed,
      label: authed ? "Ask Exunb0t about this" : "Ask Exunb0t (login required)",
      action: () => {
        if (window.ExunChat && window.ExunChat.ask) {
          window.ExunChat.ask(`Looking at "${document.title}":\n\n${ctx}`);
        }
      }
    });
    items.push({ divider: true });
    if (sel) {
      items.push({ icon: "copy", label: "Copy selection", action: () => copyText(sel) });
      items.push({ divider: true });
    }
    if (link && link.href && !cardHandled) {
      const href = link.href;
      items.push({ icon: "external", label: "Open link in new tab", action: () => window.open(href, "_blank", "noopener") });
      items.push({ icon: "link", label: "Copy link address", action: () => copyText(href) });
      items.push({ divider: true });
    }
    if (img && img.src && (!link || !link.contains(img))) {
      const src = img.src;
      items.push({ icon: "external", label: "Open image in new tab", action: () => window.open(src, "_blank", "noopener") });
      items.push({ icon: "image", label: "Copy image address", action: () => copyText(src) });
      items.push({ divider: true });
    }
    const chatApi = window.ExunChat || null;
    const userMsg = t && t.closest ? t.closest(".exw-msg.user[data-mid]") : null;
    if (userMsg && chatApi && chatApi.editMessage) {
      const mid = userMsg.dataset.mid;
      items.push({ icon: "sparkle", label: "Edit message", warn: true, action: () => chatApi.editMessage(mid) });
      items.push({ divider: true });
    }
    const convoRow = t && t.closest ? t.closest(".exw-convo") : null;
    const inChat = t && t.closest ? t.closest("#exw-popup") : null;
    if (chatApi && (convoRow || inChat)) {
      if (!convoRow) {
        items.push({ icon: "copy", label: "New chat", action: () => chatApi.newChat && chatApi.newChat() });
      } else {
        const cid = convoRow.dataset.cid;
        items.push({ icon: "external", label: "Open conversation", action: () => {
          if (convoRow.tagName === "BUTTON") convoRow.click();
        } });
        if (cid) items.push({ icon: "trash", label: "Delete this chat", danger: true, action: () => chatApi.deleteConversation && chatApi.deleteConversation(cid) });
        items.push({ icon: "copy", label: "New chat", action: () => chatApi.newChat && chatApi.newChat() });
      }
      items.push({ divider: true });
    }
    if (regCard) {
      const eid = regCard.dataset.eventId;
      const ename = (regCard.querySelector(".registration-card__title") || {}).textContent || eid;
      items.push({ icon: "external", label: "View event page", action: () => {
        if (window.summaryPage && window.summaryPage.toggleEditor) {
          Utils.rememberEventBack("/summary");
        }
        window.location.href = `/event/${Utils.slugify(ename.trim() || eid)}`;
      } });
      if (window.summaryPage && window.summaryPage.toggleEditor) {
        items.push({ icon: "sparkle", label: "Edit registration", warn: true, action: () => window.summaryPage.toggleEditor(regCard, eid) });
      }
      items.push({ icon: "link", label: "Copy event link", action: () => copyText(`${window.location.origin}/event/${Utils.slugify(ename.trim() || eid)}`) });
      items.push({
        icon: "trash",
        label: "Delete registration",
        danger: true,
        action: async () => {
          const ok = await Utils.showConfirmModal("Delete your registration for this event?", "Delete registration", "Delete", "Cancel");
          if (!ok) return;
          try {
            await window.ExunServices.registrations.remove(eid);
            Utils.showToast("Registration deleted", "success");
            if (window.summaryPage && window.summaryPage.refreshData) await window.summaryPage.refreshData();
            else window.location.reload();
          } catch (err) {
            Utils.showToast((err && err.message) || "Delete failed", "error");
          }
        }
      });
      items.push({ divider: true });
    }
    if (t && t.closest && t.closest("#profile-section")) {
      items.push({ icon: "external", label: "Edit details", action: () => (window.location.href = "/complete") });
      items.push({ divider: true });
    }
    if (t && t.closest && (t.closest(".summary-stats") || t.closest(".summary-actions"))) {
      if (window.summaryPage && window.summaryPage.refreshData) {
        items.push({ icon: "reload", label: "Refresh summary", action: () => window.summaryPage.refreshData() });
        items.push({ divider: true });
      }
    }
    if (evCard) {
      const href = evCard.href;
      items.push({ icon: "external", label: "Open event", action: () => (window.location.href = href) });
      items.push({ icon: "link", label: "Copy event link", action: () => copyText(href) });
      items.push({ divider: true });
    }
    const faqItem = t && t.closest ? t.closest(".faq-item") : null;
    if (faqItem) {
      const q = faqItem.querySelector(".faq-question");
      const a = faqItem.querySelector(".faq-answer");
      if (q && q.textContent.trim()) items.push({ icon: "copy", label: "Copy question", action: () => copyText(q.textContent.trim()) });
      if (a && a.textContent.trim()) items.push({ icon: "copy", label: "Copy answer", action: () => copyText(a.textContent.trim()) });
      if ((q && q.textContent.trim()) || (a && a.textContent.trim())) items.push({ divider: true });
    }
    const cell = t && t.closest ? t.closest("td, th") : null;
    if (cell && cell.textContent.trim()) {
      items.push({ icon: "copy", label: "Copy cell text", action: () => copyText(cell.textContent.trim()) });
      items.push({ divider: true });
    }
    items.push({ icon: "back", label: "Back", action: () => window.history.back() });
    items.push({ icon: "forward", label: "Forward", action: () => window.history.forward() });
    items.push({ icon: "reload", label: "Reload", action: () => window.location.reload() });
    items.push({ divider: true });
    items.push({ icon: "link", label: "Copy page link", action: () => copyText(window.location.href) });
    openMenu(e.clientX, e.clientY, items);
  });

  document.addEventListener("click", (e) => {
    if (menu && menu.classList.contains("open") && !menu.contains(e.target)) closeMenu();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", closeMenu);
  document.addEventListener("scroll", closeMenu, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) authedCache = null;
  });
})();
