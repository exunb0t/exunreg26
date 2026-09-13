(function () {
  const state = { open: false, authed: false, email: "", convos: [], activeId: null, sending: false, msgById: {}, verIdx: {} };
  const els = {};
  let booted = false;
  let booting = false;

  const UI_KEY = "exw-ui";

  function saveUi() {
    try {
      sessionStorage.setItem(UI_KEY, JSON.stringify({
        open: state.open,
        minimized: !!(els.popup && els.popup.classList.contains("minimized")),
        zoomed: !!(els.popup && els.popup.classList.contains("zoomed")),
        activeId: state.activeId,
        thread: !!(els.popup && els.popup.classList.contains("show-thread")),
        draft: els.input ? els.input.value : ""
      }));
    } catch (e) {}
  }

  function readUi() {
    try {
      const raw = sessionStorage.getItem(UI_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && typeof s === "object" ? s : null;
    } catch (e) {
      return null;
    }
  }

  async function restoreUi() {
    const saved = readUi();
    if (!saved || !saved.open || !els.popup || !els.toggle) return;
    const root = document.getElementById("exw-root");
    if (root && root.style.display === "none") return;
    state.open = true;
    els.popup.hidden = false;
    els.toggle.setAttribute("aria-expanded", "true");
    els.toggle.hidden = true;
    try {
      const session = await window.ExunServices.api.getSession();
      state.authed = !!(session && session.authenticated);
      state.email = (session && session.email) || "";
    } catch (e) {
      state.authed = false;
    }
    if (!state.authed) {
      els.popup.classList.add("logged-out");
      return;
    }
    els.popup.classList.remove("logged-out");
    await loadConvos();
    const id = saved.activeId;
    if (id && !String(id).startsWith("draft-") && state.convos.some((c) => c.id === id)) {
      await selectConvo(id);
      let redirected = null;
      try {
        redirected = sessionStorage.getItem("exw-redirect");
        sessionStorage.removeItem("exw-redirect");
      } catch (e) {}
      if (redirected) addMsg("system", `Redirected to ${redirected}.`);
      if (els.input && typeof saved.draft === "string" && saved.draft) {
        els.input.value = saved.draft;
        els.send.disabled = !saved.draft.trim();
      }
    } else {
      els.popup.classList.remove("show-thread");
    }
    els.popup.classList.toggle("minimized", !!saved.minimized);
    els.popup.classList.toggle("zoomed", !!saved.zoomed);
    saveUi();
  }

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
      const norm = String(iso || "").trim().replace(" ", "T");
      const stamped = norm.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(norm) ? norm : norm + "Z";
      const d = new Date(stamped).getTime();
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

  function renderMarkdown(src) {
    const inline = (t) => {
      let h = Utils.escapeHtml(t);
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

  function addMsg(role, text) {
    if (!els.msgs) return null;
    const row = document.createElement("div");
    const cls = role === "user" ? "user" : role === "system" ? "system" : "bot";
    row.className = "exw-msg " + cls;
    const b = document.createElement("div");
    b.className = "bubble";
    if (cls === "bot") b.innerHTML = renderMarkdown(text);
    else b.textContent = text;
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
    if (role === "bot") b.innerHTML = renderMarkdown(m.content);
    else b.textContent = m.content;
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
    saveUi();
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
          try {
            sessionStorage.setItem("exw-redirect", s.dest || s.label);
          } catch (e) {}
          saveUi();
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
        saveUi();
      } catch (e) {
        Utils.showToast("Could not start a conversation", "error");
        return;
      }
    }
    if (!state.activeId || state.sending) return;
    state.sending = true;
    if (els.send) els.send.disabled = true;
    const urow = addMsg("user", text);
    const thinking = addMsg("bot", "Thinking...");
    if (thinking) thinking.classList.add("thinking");
    let replyRow = null;
    let replyText = "";
    let gotToken = false;
    let gotDone = false;
    let rafQueued = false;
    const paint = () => {
      rafQueued = false;
      if (replyRow) {
        const b = replyRow.querySelector(".bubble");
        if (b) b.innerHTML = renderMarkdown(replyText);
      }
      scrollMsgs();
    };
    const queuePaint = () => {
      if (!rafQueued) {
        rafQueued = true;
        requestAnimationFrame(paint);
      }
    };
    try {
      const resp = await fetch(`/api/chat/conversations/${encodeURIComponent(state.activeId)}/messages?stream=1`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      if (!resp.ok || !resp.body) {
        let msg = `HTTP error! status: ${resp.status}`;
        try {
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await resp.json().catch(() => null);
            msg = (j && (j.error || j.message)) || msg;
          }
        } catch (e) {}
        throw new Error(msg);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = raw.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let evt = null;
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch (e) {
            continue;
          }
          if (evt && typeof evt.t === "string" && evt.t) {
            if (!gotToken) {
              gotToken = true;
              if (thinking) thinking.remove();
              replyRow = addMsg("bot", "");
            }
            replyText += evt.t;
            queuePaint();
          } else if (evt && evt.done) {
            gotDone = true;
            replyText = typeof evt.reply === "string" ? evt.reply : replyText;
            if (!replyRow) {
              if (thinking) thinking.remove();
              replyRow = addMsg("bot", "");
            }
            paint();
            if (urow && evt.messageId != null) {
              urow.dataset.mid = String(evt.messageId);
              state.msgById[evt.messageId] = { id: evt.messageId, role: "user", content: text, edits: "[]" };
              state.verIdx[evt.messageId] = 0;
            }
            if (evt.suggestEscalation) addApprovalCard();
            renderSuggestions(evt.suggestions);
            loadConvos();
          } else if (evt && evt.error) {
            throw new Error(evt.error);
          }
        }
      }
      paint();
      if (!gotToken && !gotDone) throw new Error("Error contacting server.");
    } catch (e) {
      if (thinking && thinking.isConnected) thinking.remove();
      if (!gotToken) addMsg("system", (e && e.message) || "Error contacting server.");
    } finally {
      state.sending = false;
      if (els.send) els.send.disabled = !els.input.value.trim();
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
      saveUi();
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
    saveUi();
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
    saveUi();
  }

  function closeWidget() {
    state.open = false;
    saveUi();
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
    saveUi();
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
      saveUi();
    };
    const toggleMax = () => {
      if (els.popup) {
        els.popup.classList.remove("minimized");
        els.popup.classList.toggle("zoomed");
      }
      saveUi();
    };
    if (els.minBtn) els.minBtn.addEventListener("click", toggleMin);
    if (els.lMin) els.lMin.addEventListener("click", toggleMin);
    if (els.maxBtn) els.maxBtn.addEventListener("click", toggleMax);
    if (els.lMax) els.lMax.addEventListener("click", toggleMax);
    if (els.back && els.popup) els.back.addEventListener("click", () => {
      state.activeId = null;
      renderList();
      els.popup.classList.remove("show-thread");
      saveUi();
    });
    if (els.newBtn) els.newBtn.addEventListener("click", newChat);
    if (els.xBtn) els.xBtn.addEventListener("click", closeWidget);
    if (els.loginBtn) els.loginBtn.addEventListener("click", () => (window.location.href = "/login"));
    if (els.input && els.send) {
      els.input.addEventListener("input", () => {
        els.send.disabled = !els.input.value.trim() || state.sending;
        saveUi();
      });
      if (els.form) {
        els.form.addEventListener("submit", (e) => {
          e.preventDefault();
          const text = (els.input.value || "").trim();
          if (!text) return;
          els.input.value = "";
          els.send.disabled = true;
          saveUi();
          sendMessage(text);
        });
      }
    }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open) closeWidget();
  });
  window.addEventListener("beforeunload", () => saveUi());
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
    els.xBtn = document.getElementById("exw-x");
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
      await prepareAvatars();
      await restoreUi();
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
