(function () {
  const state = { open: false, authed: false, email: "", convos: [], activeId: null, sending: false, msgById: {}, verIdx: {} };
  const els = {};
  let booted = false;
  let booting = false;

  function hueFor(s) {
    let h = 0;
    const str = String(s || "?");
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function initialFor(convo) {
    const t = (convo && (convo.title || convo.email)) || "?";
    return t.trim().charAt(0).toUpperCase() || "?";
  }

  function avatarHTML(convo, cls) {
    return `<span class="exw-ava ${cls || ""}" style="background:hsl(${hueFor(convo && convo.id)},55%,45%)">${Utils.escapeHtml(initialFor(convo))}</span>`;
  }

  function relTime(iso) {
    try {
      const d = new Date(iso).getTime();
      if (Number.isNaN(d)) return "";
      const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
      if (mins < 1) return "now";
      if (mins < 60) return mins + "m";
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + "h";
      return Math.round(hrs / 24) + "d";
    } catch (e) {
      return "";
    }
  }

  function scrollMsgs() {
    if (els.msgs) els.msgs.scrollTop = els.msgs.scrollHeight;
  }

  function addMsg(role, text) {
    if (!els.msgs) return null;
    const row = document.createElement("div");
    row.className = "exw-msg " + (role === "user" ? "user" : role === "system" ? "system" : "bot");
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = text;
    row.appendChild(b);
    els.msgs.appendChild(row);
    scrollMsgs();
    return row;
  }

  function messageVersions(m) {
    let edits = [];
    try {
      const parsed = JSON.parse((m && m.edits) || "[]");
      if (Array.isArray(parsed)) edits = parsed.map((v) => (typeof v === "string" ? v : v.content)).filter((v) => typeof v === "string");
    } catch (e) {}
    return edits.concat([m.content]);
  }

  function renderMessage(m) {
    const row = document.createElement("div");
    const role = m.role === "user" ? "user" : m.role === "system" ? "system" : "bot";
    row.className = "exw-msg " + role;
    if (m.id != null) {
      row.dataset.mid = String(m.id);
      state.msgById[m.id] = m;
      if (state.verIdx[m.id] == null) state.verIdx[m.id] = messageVersions(m).length - 1;
    }
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = m.content;
    row.appendChild(b);
    if (role === "user" && m.id != null && messageVersions(m).length > 1) {
      row.appendChild(versionFooter(m, b));
    }
    if (els.msgs) els.msgs.appendChild(row);
    scrollMsgs();
    return row;
  }

  function versionFooter(m, bubble) {
    const wrap = document.createElement("div");
    wrap.className = "exw-versions";
    const paint = () => {
      const vers = messageVersions(m);
      const idx = Math.max(0, Math.min(state.verIdx[m.id] == null ? vers.length - 1 : state.verIdx[m.id], vers.length - 1));
      state.verIdx[m.id] = idx;
      const label = wrap.querySelector("span");
      if (label) label.textContent = `${idx + 1}/${vers.length}`;
      bubble.textContent = vers[idx];
    };
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "Previous version");
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      state.verIdx[m.id] = (state.verIdx[m.id] == null ? messageVersions(m).length - 1 : state.verIdx[m.id]) - 1;
      paint();
    });
    const label = document.createElement("span");
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.setAttribute("aria-label", "Next version");
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      state.verIdx[m.id] = (state.verIdx[m.id] == null ? 0 : state.verIdx[m.id]) + 1;
      paint();
    });
    wrap.appendChild(prev);
    wrap.appendChild(label);
    wrap.appendChild(next);
    paint();
    return wrap;
  }

  function editMessage(mid) {
    const row = els.msgs ? els.msgs.querySelector(`.exw-msg[data-mid="${String(mid)}"]`) : null;
    const m = state.msgById[mid];
    if (!row || !m || row.querySelector(".exw-edit")) return;
    const bubble = row.querySelector(".bubble");
    const footer = row.querySelector(".exw-versions");
    if (bubble) bubble.style.display = "none";
    if (footer) footer.style.display = "none";
    const box = document.createElement("div");
    box.className = "exw-edit";
    const ta = document.createElement("textarea");
    ta.value = m.content;
    ta.rows = 3;
    ta.maxLength = 4000;
    const actions = document.createElement("div");
    actions.className = "exw-edit__actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "exw-approve__btn primary";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "exw-approve__btn";
    cancel.textContent = "Cancel";
    const cleanup = () => {
      box.remove();
      if (bubble) bubble.style.display = "";
      if (footer) footer.style.display = "";
    };
    cancel.addEventListener("click", cleanup);
    save.addEventListener("click", async () => {
      const text = ta.value.trim();
      if (!text) {
        Utils.showToast("Message cannot be empty", "error");
        return;
      }
      save.disabled = true;
      try {
        const resp = await window.ExunServices.chat.updateMessage(state.activeId, mid, text);
        const updated = (resp && resp.data) || null;
        if (updated) {
          state.msgById[mid] = updated;
          state.verIdx[mid] = messageVersions(updated).length - 1;
        } else {
          m.content = text;
        }
        cleanup();
        const nb = row.querySelector(".bubble");
        if (nb) nb.textContent = text;
        const oldFooter = row.querySelector(".exw-versions");
        if (oldFooter) oldFooter.remove();
        const fresh = state.msgById[mid] || m;
        if (messageVersions(fresh).length > 1) row.appendChild(versionFooter(fresh, nb));
        Utils.showToast("Message updated", "success");
      } catch (e) {
        save.disabled = false;
        Utils.showToast((e && e.message) || "Update failed", "error");
      }
    });
    actions.appendChild(save);
    actions.appendChild(cancel);
    box.appendChild(ta);
    box.appendChild(actions);
    row.appendChild(box);
    ta.focus();
  }

  function setThreadHeader(convo) {
    if (!convo) return;
    if (els.threadTitle) els.threadTitle.textContent = convo.title || "New conversation";
    if (els.threadStatus) els.threadStatus.textContent = convo.status ? convo.status.charAt(0).toUpperCase() + convo.status.slice(1) : "Active";
    if (els.threadAvatar) {
      els.threadAvatar.innerHTML = `<img src="/assets/favicon.ico" alt="Exunb0t" />`;
    }
  }

  function renderList() {
    if (!els.items) return;
    els.items.innerHTML = "";
    if (state.convos.length === 0) {
      const d = document.createElement("div");
      d.className = "exw-empty";
      d.textContent = "No conversations yet.";
      els.items.appendChild(d);
      return;
    }
    state.convos.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "exw-convo" + (c.id === state.activeId ? " active" : "");
      btn.type = "button";
      btn.dataset.cid = c.id;
      const sub = [c.status, relTime(c.updatedAt || c.createdAt)].filter(Boolean).join(" · ");
      btn.innerHTML = `${avatarHTML(c)}<span class="exw-convo__meta"><span class="exw-convo__title"></span><span class="exw-convo__sub"></span></span>`;
      btn.querySelector(".exw-convo__title").textContent = c.title || "New conversation";
      btn.querySelector(".exw-convo__sub").textContent = sub;
      btn.addEventListener("click", () => selectConvo(c.id));
      els.items.appendChild(btn);
    });
  }

  function renderToggleAvatars() {
    if (!els.toggleAvatars) return;
    let html = `<span class="exw-ava"><img src="/assets/favicon.ico" alt="Exunb0t" /></span>`;
    state.convos.slice(0, 2).forEach((c) => {
      html += avatarHTML(c);
    });
    els.toggleAvatars.innerHTML = html;
  }

  async function loadConvos() {
    const drafts = state.convos.filter((c) => c.draft);
    try {
      const resp = await window.ExunServices.chat.listConversations();
      const server = (resp && resp.data) || [];
      state.convos = [...drafts, ...server.filter((c) => !drafts.some((d) => d.id === c.id))];
    } catch (e) {
      state.convos = [...drafts];
    }
    renderList();
    renderToggleAvatars();
  }

  async function selectConvo(id) {
    state.activeId = id;
    renderList();
    if (els.popup) els.popup.classList.add("show-thread");
    if (els.msgs) els.msgs.innerHTML = "";
    const local = state.convos.find((c) => c.id === id);
    if (local && local.draft) {
      setThreadHeader(local);
      addMsg("bot", "Hi, I am Exunb0t. Ask me anything about Exun 2026.");
      scrollMsgs();
      return;
    }
    try {
      const resp = await window.ExunServices.chat.getConversation(id);
      const data = (resp && resp.data) || {};
      const convo = data.conversation || state.convos.find((c) => c.id === id);
      setThreadHeader(convo);
      const idx = state.convos.findIndex((c) => c.id === id);
      if (idx !== -1 && convo && convo.title) state.convos[idx].title = convo.title;
      (data.messages || []).forEach((m) => {
        renderMessage(m);
      });
      if ((data.messages || []).length === 0) {
        addMsg("bot", "Hi, I am Exunb0t. Ask me anything about Exun 2026.");
      }
      renderList();
    } catch (e) {
      addMsg("system", "Could not load this conversation.");
    }
    scrollMsgs();
  }

  async function newChat() {
    const existing = state.convos.find((c) => c.draft);
    if (existing) {
      await selectConvo(existing.id);
      return;
    }
    const now = new Date().toISOString();
    const draft = { id: `draft-${Date.now()}`, title: "New conversation", status: "active", draft: true, createdAt: now, updatedAt: now };
    state.convos.unshift(draft);
    renderList();
    renderToggleAvatars();
    await selectConvo(draft.id);
  }

  function clearSuggestions() {
    if (!els.msgs) return;
    els.msgs.querySelectorAll(".exw-suggest").forEach((n) => n.remove());
  }

  function renderSuggestions(sugs) {
    clearSuggestions();
    if (!els.msgs || !Array.isArray(sugs) || sugs.length === 0) return;
    const row = document.createElement("div");
    row.className = "exw-suggest";
    sugs.slice(0, 3).forEach((s) => {
      if (!s || !s.label) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "exw-suggest__chip";
      b.textContent = s.label;
      b.addEventListener("click", () => {
        if (s.navigate) {
          window.location.href = s.navigate;
          return;
        }
        if (s.message) sendMessage(s.message);
      });
      row.appendChild(b);
    });
    if (!row.children.length) return;
    els.msgs.appendChild(row);
    scrollMsgs();
  }

  function addApprovalCard() {
    if (!els.msgs) return;
    const row = document.createElement("div");
    row.className = "exw-msg system";
    const b = document.createElement("div");
    b.className = "bubble exw-approve";
    const t = document.createElement("div");
    t.textContent = "I can't confidently answer this. Forward it to a human admin?";
    const actions = document.createElement("div");
    actions.className = "exw-approve__actions";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "exw-approve__btn primary";
    ok.textContent = "Send to human";
    const no = document.createElement("button");
    no.type = "button";
    no.className = "exw-approve__btn";
    no.textContent = "Dismiss";
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      no.disabled = true;
      await escalate();
      row.remove();
    });
    no.addEventListener("click", () => row.remove());
    actions.appendChild(ok);
    actions.appendChild(no);
    b.appendChild(t);
    b.appendChild(actions);
    row.appendChild(b);
    els.msgs.appendChild(row);
    scrollMsgs();
  }

  async function sendMessage(text) {
    if (state.sending) return;
    clearSuggestions();
    if (String(state.activeId || "").startsWith("draft-")) {
      try {
        const resp = await window.ExunServices.chat.createConversation();
        const convo = resp && resp.data;
        if (!convo || !convo.id) throw new Error("create failed");
        const idx = state.convos.findIndex((c) => c.id === state.activeId);
        if (idx !== -1) state.convos[idx] = convo;
        state.activeId = convo.id;
        renderList();
        renderToggleAvatars();
      } catch (e) {
        Utils.showToast("Could not start a conversation", "error");
        return;
      }
    }
    if (!state.activeId || state.sending) return;
    state.sending = true;
    const urow = addMsg("user", text);
    const thinking = addMsg("bot", "Thinking...");
    if (thinking) thinking.classList.add("thinking");
    try {
      const resp = await window.ExunServices.chat.sendMessage(state.activeId, text);
      if (thinking) thinking.remove();
      const data = (resp && resp.data) || {};
      if (urow && data.messageId != null) {
        urow.dataset.mid = String(data.messageId);
        state.msgById[data.messageId] = { id: data.messageId, role: "user", content: text, edits: "[]" };
        state.verIdx[data.messageId] = 0;
      }
      addMsg("bot", data.reply || "No answer returned.");
      if (data.suggestEscalation) {
        addApprovalCard();
      }
      renderSuggestions(data.suggestions);
      loadConvos();
    } catch (e) {
      if (thinking) thinking.remove();
      addMsg("system", (e && e.message) || "Error contacting server.");
    } finally {
      state.sending = false;
    }
  }

  async function deleteConversationById(id) {
    if (!id || state.sending) return;
    if (String(id).startsWith("draft-")) {
      state.convos = state.convos.filter((c) => c.id !== id);
      if (state.activeId === id) {
        state.activeId = null;
        if (els.msgs) els.msgs.innerHTML = "";
        if (els.popup) els.popup.classList.remove("show-thread");
        setThreadHeader({ title: "New conversation", status: "active" });
      }
      renderList();
      renderToggleAvatars();
      return;
    }
    const confirmed = await Utils.showConfirmModal("Delete this conversation and all its messages?", "Delete conversation", "Delete", "Cancel");
    if (!confirmed) return;
    try {
      await window.ExunServices.chat.deleteConversation(id);
      delete state.msgById[id];
      delete state.verIdx[id];
      state.activeId = null;
      await loadConvos();
      if (els.msgs) els.msgs.innerHTML = "";
      if (els.popup) els.popup.classList.remove("show-thread");
      setThreadHeader({ title: "New conversation", status: "active" });
      Utils.showToast("Conversation deleted", "success");
    } catch (e) {
      Utils.showToast((e && e.message) || "Delete failed", "error");
    }
  }

  async function deleteActiveConversation() {
    await deleteConversationById(state.activeId);
  }

  async function escalate() {
    if (!state.activeId || state.sending) return;
    try {
      await window.ExunServices.chat.escalate(state.activeId);
      addMsg("system", "A human admin has been notified and will follow up here and by email.");
    } catch (e) {
      Utils.showToast((e && e.message) || "Could not reach a human", "error");
    }
  }

  async function openWidget() {
    state.open = true;
    if (els.popup) els.popup.hidden = false;
    if (els.toggle) {
      els.toggle.setAttribute("aria-expanded", "true");
      els.toggle.hidden = true;
    }
    try {
      const session = await window.ExunServices.api.getSession();
      state.authed = !!(session && session.authenticated);
      state.email = (session && session.email) || "";
    } catch (e) {
      state.authed = false;
    }
    if (!state.authed) {
      if (els.popup) els.popup.classList.add("logged-out");
      return;
    }
    if (els.popup) els.popup.classList.remove("logged-out");
    await loadConvos();
    if (state.convos.length === 0) {
      await newChat();
    } else if (els.popup) {
      els.popup.classList.remove("show-thread");
    }
  }

  function closeWidget() {
    state.open = false;
    if (els.popup) els.popup.hidden = true;
    if (els.toggle) {
      els.toggle.setAttribute("aria-expanded", "false");
      els.toggle.hidden = false;
    }
  }

  async function askExternal(text) {
    const t = String(text || "").trim().slice(0, 500);
    if (!t) return;
    if (!booted) {
      try {
        await boot();
      } catch (e) {}
    }
    if (!els.popup) return;
    state.open = true;
    els.popup.hidden = false;
    if (els.toggle) {
      els.toggle.setAttribute("aria-expanded", "true");
      els.toggle.hidden = true;
    }
    let session = { authenticated: false };
    try {
      session = await window.ExunServices.api.getSession();
    } catch (e) {}
    state.authed = !!(session && session.authenticated);
    state.email = (session && session.email) || "";
    if (!state.authed) {
      els.popup.classList.add("logged-out");
      Utils.showToast("Login to ask Exunb0t", "info");
      return;
    }
    els.popup.classList.remove("logged-out");
    await loadConvos();
    if (state.activeId && state.convos.some((c) => c.id === state.activeId)) {
      await selectConvo(state.activeId);
    } else if (state.convos.length > 0) {
      await selectConvo(state.convos[0].id);
    } else {
      await newChat();
    }
    if (state.activeId) {
      if (els.input) els.input.focus();
      await sendMessage(t);
    }
  }

  window.ExunChat = {
    ask: askExternal,
    open: () => openWidget(),
    close: () => closeWidget(),
    newChat: () => newChat(),
    deleteConversation: (id) => deleteConversationById(id),
    editMessage: (mid) => editMessage(mid)
  };

  function wire() {
    if (els.toggle) {
      els.toggle.addEventListener("click", () => {
        if (state.open) closeWidget();
        else openWidget();
      });
    }
    if (els.close) els.close.addEventListener("click", closeWidget);
    if (els.lClose) els.lClose.addEventListener("click", closeWidget);
    const toggleMin = () => {
      if (els.popup) els.popup.classList.toggle("minimized");
    };
    const toggleMax = () => {
      if (els.popup) {
        els.popup.classList.remove("minimized");
        els.popup.classList.toggle("zoomed");
      }
    };
    if (els.minBtn) els.minBtn.addEventListener("click", toggleMin);
    if (els.lMin) els.lMin.addEventListener("click", toggleMin);
    if (els.maxBtn) els.maxBtn.addEventListener("click", toggleMax);
    if (els.lMax) els.lMax.addEventListener("click", toggleMax);
    if (els.back && els.popup) els.back.addEventListener("click", () => {
      state.activeId = null;
      renderList();
      els.popup.classList.remove("show-thread");
    });
    if (els.newBtn) els.newBtn.addEventListener("click", newChat);
    if (els.escalate) els.escalate.addEventListener("click", escalate);
    if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteActiveConversation);
    if (els.loginBtn) els.loginBtn.addEventListener("click", () => (window.location.href = "/login"));
    if (els.input && els.send) {
      els.input.addEventListener("input", () => {
        els.send.disabled = !els.input.value.trim() || state.sending;
      });
      if (els.form) {
        els.form.addEventListener("submit", (e) => {
          e.preventDefault();
          const text = (els.input.value || "").trim();
          if (!text) return;
          els.input.value = "";
          els.send.disabled = true;
          sendMessage(text);
        });
      }
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.open) closeWidget();
    });
  }

  function cacheEls() {
    els.toggle = document.getElementById("exw-toggle");
    els.popup = document.getElementById("exw-popup");
    els.items = document.querySelector("#exw-popup .exw-list__items");
    els.msgs = document.querySelector("#exw-popup .exw-thread__msgs");
    els.newBtn = document.getElementById("exw-new");
    els.close = document.getElementById("exw-close");
    els.minBtn = document.getElementById("exw-min");
    els.maxBtn = document.getElementById("exw-max");
    els.lClose = document.getElementById("exw-l-close");
    els.lMin = document.getElementById("exw-l-min");
    els.lMax = document.getElementById("exw-l-max");
    els.back = document.getElementById("exw-back");
    els.escalate = document.getElementById("exw-escalate");
    els.deleteBtn = document.getElementById("exw-delete");
    els.form = document.getElementById("exw-form");
    els.input = document.getElementById("exw-input");
    els.send = document.getElementById("exw-send");
    els.loginBtn = document.getElementById("exw-login-btn");
    els.threadTitle = document.querySelector("#exw-popup .exw-thread__title");
    els.threadStatus = document.querySelector("#exw-popup .exw-thread__status");
    els.threadAvatar = document.querySelector("#exw-popup .exw-thread__avatar");
    els.toggleAvatars = document.querySelector("#exw-toggle .exw-toggle__avatars");
  }

  async function prepareAvatars() {
    let authed = false;
    try {
      const session = await window.ExunServices.api.getSession();
      if (session && session.authenticated) {
        authed = true;
        await loadConvos();
      }
    } catch (e) {}
    if (!authed && document.body.dataset.page !== "query") {
      const root = document.getElementById("exw-root");
      if (root) root.style.display = "none";
      return;
    }
    renderToggleAvatars();
  }

  async function boot() {
    if (booted || booting) return;
    if (!window.ExunServices || !window.Utils) return;
    booting = true;
    try {
      let root = document.getElementById("exw-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "exw-root";
        document.body.appendChild(root);
      }
      const resp = await fetch("/components/chat-widget.html");
      if (!resp.ok) throw new Error("widget load failed");
      root.innerHTML = await resp.text();
      cacheEls();
      wire();
      booted = true;
      prepareAvatars();
    } catch (e) {
      booting = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      setTimeout(() => {
        if (!booted) boot();
      }, 1500);
    });
  } else {
    boot();
  }
})();
