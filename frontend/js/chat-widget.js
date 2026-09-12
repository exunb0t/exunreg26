(function () {
  const state = { open: false, authed: false, email: "", convos: [], activeId: null, sending: false };
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
    try {
      const resp = await window.ExunServices.chat.listConversations();
      state.convos = (resp && resp.data) || [];
    } catch (e) {
      state.convos = [];
    }
    renderList();
    renderToggleAvatars();
  }

  async function selectConvo(id) {
    state.activeId = id;
    renderList();
    if (els.popup) els.popup.classList.add("show-thread");
    if (els.msgs) els.msgs.innerHTML = "";
    try {
      const resp = await window.ExunServices.chat.getConversation(id);
      const data = (resp && resp.data) || {};
      const convo = data.conversation || state.convos.find((c) => c.id === id);
      setThreadHeader(convo);
      const idx = state.convos.findIndex((c) => c.id === id);
      if (idx !== -1 && convo && convo.title) state.convos[idx].title = convo.title;
      (data.messages || []).forEach((m) => {
        if (m.role === "user") addMsg("user", m.content);
        else if (m.role === "assistant") addMsg("bot", m.content);
        else addMsg("system", m.content);
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
    try {
      const resp = await window.ExunServices.chat.createConversation();
      const convo = resp && resp.data;
      if (convo && convo.id) {
        state.convos.unshift(convo);
        renderList();
        renderToggleAvatars();
        await selectConvo(convo.id);
        return;
      }
    } catch (e) {}
    Utils.showToast("Could not start a conversation", "error");
  }

  async function sendMessage(text) {
    if (!state.activeId || state.sending) return;
    state.sending = true;
    addMsg("user", text);
    const thinking = addMsg("bot", "Thinking...");
    if (thinking) thinking.classList.add("thinking");
    try {
      const resp = await window.ExunServices.chat.sendMessage(state.activeId, text);
      if (thinking) thinking.remove();
      const data = (resp && resp.data) || {};
      addMsg("bot", data.reply || "No answer returned.");
      if (data.escalated || data.ticketId) {
        addMsg("system", "This question has been forwarded to a human admin. You will be notified here and by email once they respond.");
      }
      loadConvos();
    } catch (e) {
      if (thinking) thinking.remove();
      addMsg("system", (e && e.message) || "Error contacting server.");
    } finally {
      state.sending = false;
    }
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
    } else {
      await selectConvo(state.convos[0].id);
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

  function wire() {
    if (els.toggle) {
      els.toggle.addEventListener("click", () => {
        if (state.open) closeWidget();
        else openWidget();
      });
    }
    if (els.close) els.close.addEventListener("click", closeWidget);
    if (els.back && els.popup) els.back.addEventListener("click", () => els.popup.classList.remove("show-thread"));
    if (els.newBtn) els.newBtn.addEventListener("click", newChat);
    if (els.escalate) els.escalate.addEventListener("click", escalate);
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
    els.back = document.getElementById("exw-back");
    els.escalate = document.getElementById("exw-escalate");
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
