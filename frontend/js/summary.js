class SummaryPage {
  constructor() {
    this.userProfile = null;
    this.registrations = [];
    this.allEvents = [];
    this.init();
  }

  async init() {
    const session = await window.ExunServices.api.getSession().catch(() => ({ authenticated: false }));
    if (!session.authenticated) {
      Utils.showToast("Please log in to view your summary", "error");
      setTimeout(() => (window.location.href = "/login"), 1200);
      return;
    }
    await this.loadData();
    this.renderSummary();
    this.setupEventListeners();
  }

  async loadData() {
    try {
      const [profileResp, summaryResp, eventsResp] = await Promise.all([
        window.ExunServices.profile.get().catch((e) => { throw e; }),
        window.ExunServices.summary.get().catch((e) => { throw e; }),
        window.ExunServices.events.getAllEvents().catch(() => null)
      ]);
      this.userProfile = (profileResp && profileResp.data) || {};
      const data = (summaryResp && summaryResp.data) || {};
      this.registrations = data.registrations || data.events || [];
      this.allEvents = (eventsResp && eventsResp.data) || [];
      if (data.user) {
        this.userProfile = { ...this.userProfile, ...data.user };
      }
    } catch (err) {
      console.error("Failed to load summary data:", err);
      Utils.showToast((err && err.message) || "Failed to load summary data", "error");
    }
  }

  renderSummary() {
    this.renderStats();
    this.renderProfile();
    this.renderRegistrations();
  }

  renderStats() {
    const total = this.registrations.length;
    const confirmed = this.registrations.filter((r) => (r.participants || []).length > 0).length;
    const pending = total - confirmed;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("total-registrations", total);
    set("confirmed-registrations", confirmed);
    set("pending-registrations", pending);
  }

  renderProfile() {
    const container = document.getElementById("profile-section");
    if (!container) return;
    if (!this.userProfile) {
      container.innerHTML = '<div class="loading-placeholder">Loading profile...</div>';
      return;
    }
    const u = this.userProfile;
    const name = u.fullname || u.username || "";
    const email = u.email || "";
    const phone = u.phoneNumber || "";
    const address = u.address || "";
    const institution = u.institutionName || "";
    const principalName = u.principalsName || "";
    const principalEmail = u.principalsEmail || "";
    if (u.individual) {
      container.innerHTML = `
        <div class="profile-card">
          <h4 class="profile-card__title">Individual Information</h4>
          <div class="registration-card__details">
            <div class="registration-detail"><span class="registration-detail__label">Name:</span><span class="registration-detail__value">${Utils.escapeHtml(name || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Email:</span><span class="registration-detail__value">${Utils.escapeHtml(email || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Phone:</span><span class="registration-detail__value">${Utils.escapeHtml(phone || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Address:</span><span class="registration-detail__value">${Utils.escapeHtml(address || "Not provided")}</span></div>
          </div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="profile-card">
          <h4 class="profile-card__title">School Information</h4>
          <div class="registration-card__details">
            <div class="registration-detail"><span class="registration-detail__label">School:</span><span class="registration-detail__value">${Utils.escapeHtml(institution || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Email:</span><span class="registration-detail__value">${Utils.escapeHtml(email || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Phone:</span><span class="registration-detail__value">${Utils.escapeHtml(phone || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Address:</span><span class="registration-detail__value">${Utils.escapeHtml(address || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Principal:</span><span class="registration-detail__value">${Utils.escapeHtml(principalName || "Not provided")}</span></div>
            <div class="registration-detail"><span class="registration-detail__label">Principal Email:</span><span class="registration-detail__value">${Utils.escapeHtml(principalEmail || "Not provided")}</span></div>
          </div>
        </div>`;
    }
  }

  renderRegistrations() {
    const container = document.getElementById("registrations-container");
    if (!container) return;
    const byId = new Map((this.registrations || []).map((r) => [String(r.eventId), r]));
    const events = (this.allEvents && this.allEvents.length > 0)
      ? this.allEvents
      : (this.registrations || []).map((r) => ({ id: r.eventId, name: r.eventName || r.eventId }));
    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3 class="empty-state__title">No Registrations Yet</h3>
          <p class="empty-state__description">You haven't registered for any events yet. Explore our events and register for your favorites!</p>
          <button class="btn btn--primary" data-action="browse-events">Browse Events</button>
        </div>`;
      const browse = container.querySelector('[data-action="browse-events"]');
      if (browse) browse.addEventListener("click", () => (window.location.href = "/events"));
      return;
    }
    container.innerHTML = `<div class="registrations-grid">${events.map((ev) => {
      const reg = byId.get(String(ev.id));
      if (reg && (reg.participants || []).length > 0) return this.renderRegistrationCard(reg, true);
      if (reg) return this.renderRegistrationCard(reg, false);
      return this.renderUnregisteredCard(ev);
    }).join("")}</div>`;
    container.querySelectorAll(".registration-card__title-link").forEach((a) => {
      a.addEventListener("click", () => {
        Utils.rememberEventBack("/summary");
      });
    });
    container.querySelectorAll(".registration-card[data-event-id]").forEach((card) => {
      card.style.cursor = "pointer";
      card.addEventListener("click", (ev) => {
        if (ev.target.closest("button, a, input, textarea, select, .reg-inline")) return;
        if (card.dataset.eventId) this.toggleEditor(card, card.dataset.eventId);
      });
    });
  }

  eventUrl(eid, name) {
    return `/event/${Utils.slugify(name || eid)}`;
  }

  renderRegistrationCard(r, named) {
    const hasNames = named !== undefined ? named : (r.participants || []).length > 0;
    const members = r.participants || [];
    const statusClass = hasNames ? "confirmed" : "pending";
    const ev = (this.allEvents || []).find((e) => String(e.id) === String(r.eventId)) || {};
    const cap = parseInt(ev.participants || 0, 10) || 0;
    const statusWord = hasNames ? "Registered" : "Incomplete";
    const statusDetail = hasNames
      ? (cap > 0
        ? `${members.length} of ${cap} seat${cap === 1 ? "" : "s"} filled`
        : `${members.length} participant${members.length === 1 ? "" : "s"}`)
      : "add your team";
    const name = r.eventName || r.eventId;
    const url = this.eventUrl(r.eventId, r.eventName);
    return `
      <div class="registration-card registration-card--${statusClass}" data-event-id="${Utils.escapeHtml(r.eventId)}">
        <div class="registration-card__header">
          <div class="registration-card__head-text">
            <h4 class="registration-card__title"><a class="registration-card__title-link" href="${Utils.escapeHtml(url)}">${Utils.escapeHtml(name)}</a></h4>
            <div class="reg-status"><span class="reg-status__word">${Utils.icon(hasNames ? "task_alt" : "pending_actions", 16)}${Utils.escapeHtml(statusWord)}</span><span class="reg-status__detail">${Utils.escapeHtml(statusDetail)}</span></div>
          </div>
          <span class="reg-chevron"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></span>
        </div>
        <div class="registration-card__details">
          ${r.teamName ? `<div class="registration-detail"><span class="registration-detail__label">Team:</span><span class="registration-detail__value">${Utils.escapeHtml(r.teamName)}</span></div>` : ""}
          ${r.createdAt ? `<div class="registration-detail"><span class="registration-detail__label">Date:</span><span class="registration-detail__value">${Utils.escapeHtml(Utils.formatDate(r.createdAt))}</span></div>` : ""}
        </div>
        ${members.length ? `<div class="team-members"><h5 class="team-members__title">Team Members:</h5><div class="team-members__list">${members.map((m) => `<div class="team-member">${Utils.escapeHtml(m.name || "")} (${Utils.escapeHtml(m.email || "")})</div>`).join("")}</div></div>` : ""}
      </div>`;
  }

  renderUnregisteredCard(ev) {
    const eid = ev.id;
    const name = ev.name || eid;
    const url = this.eventUrl(eid, name);
    return `
      <div class="registration-card registration-card--pending" data-event-id="${Utils.escapeHtml(eid)}">
        <div class="registration-card__header">
          <div class="registration-card__head-text">
            <h4 class="registration-card__title"><a class="registration-card__title-link" href="${Utils.escapeHtml(url)}">${Utils.escapeHtml(name)}</a></h4>
            <div class="reg-status"><span class="reg-status__word">${Utils.icon("pending_actions", 16)}Not registered</span></div>
          </div>
          <span class="reg-chevron"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></span>
        </div>
        <div class="reg-inline"><div class="reg-inline__inner"></div></div>
      </div>`;
  }

  profileComplete() {
    const u = this.userProfile || {};
    const phone = u.phoneNumber || "";
    if (!phone || !String(phone).trim()) return false;
    if (u.individual) return true;
    const inst = u.institutionName || "";
    const princ = u.principalsEmail || "";
    return !!(inst && String(inst).trim() && princ && String(princ).trim());
  }

  editorSnapshot(box) {
    return Array.from(box.querySelectorAll(".reg-edit-row")).map((r) => ({
      name: ((r.querySelector('[data-f="name"]') || {}).value || "").trim(),
      email: ((r.querySelector('[data-f="email"]') || {}).value || "").trim(),
      cls: ((r.querySelector('[data-f="class"]') || {}).value || "").trim(),
      phone: ((r.querySelector('[data-f="phone"]') || {}).value || "").trim()
    }));
  }

  editorDirty(box) {
    try {
      const initial = JSON.parse(box.dataset.initial || "[]");
      const current = this.editorSnapshot(box);
      if (initial.length !== current.length) return true;
      for (let i = 0; i < current.length; i++) {
        const a = initial[i] || {};
        const b = current[i];
        if ((a.name || "") !== b.name || (a.email || "") !== b.email || (a.cls || "") !== b.cls || (a.phone || "") !== b.phone) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  editorRow(member, idx) {
    const m = member || {};
    const n = idx == null ? "" : ` ${idx + 1}`;
    const row = document.createElement("div");
    row.className = "reg-edit-row";
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    row.innerHTML = `
      <input class="form-input" data-f="name" placeholder="Full name${n}" autocomplete="off" readonly value="${esc(m.name)}" />
      <input class="form-input" data-f="email" placeholder="Email${n}" autocomplete="off" readonly value="${esc(m.email)}" />
      <input class="form-input" data-f="class" placeholder="Class${n}" autocomplete="off" readonly value="${esc(m.class)}" />
      <input class="form-input" data-f="phone" placeholder="Phone${n}" autocomplete="off" readonly value="${esc(m.phone)}" />`;
    return row;
  }

  async toggleEditor(cardEl, eventId) {
    let shell = cardEl.querySelector(".reg-inline");
    if (cardEl.classList.contains("expanded") && shell) {
      const inner = shell.querySelector(".reg-inline__inner");
      if (inner && this.editorDirty(inner)) {
        const ok = await Utils.showConfirmModal("You have unsaved changes. Discard them?", "Discard changes", "Discard", "Keep editing");
        if (!ok) return;
      }
      cardEl.classList.remove("expanded");
      setTimeout(() => {
        const el = cardEl.querySelector(".reg-inline");
        if (el && !cardEl.classList.contains("expanded")) el.remove();
      }, 380);
      return;
    }
    if (!this.profileComplete()) {
      Utils.showToast("Complete your profile before registering", "error");
      setTimeout(() => { window.location.href = "/complete"; }, 900);
      return;
    }
    const ev = (this.allEvents || []).find((e) => String(e.id) === String(eventId)) || {};
    const reg = (this.registrations || []).find((r) => String(r.eventId) === String(eventId)) || null;
    const capacity = parseInt(ev.participants || 1, 10) || 1;
    const members = (reg && reg.participants) || [];
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "reg-inline";
      const inner = document.createElement("div");
      inner.className = "reg-inline__inner";
      shell.appendChild(inner);
      const actions = cardEl.querySelector(".registration-card__actions");
      if (actions) cardEl.insertBefore(shell, actions);
      else cardEl.appendChild(shell);
    }
    const inner = shell.querySelector(".reg-inline__inner");
    inner.dataset.capacity = String(capacity);
    inner.innerHTML = "";
    const meta = document.createElement("div");
    meta.className = "reg-edit";
    const desc = document.createElement("p");
    desc.className = "reg-edit__desc";
    desc.textContent = ev.description_short || ev.descriptionShort || "";
    const info = document.createElement("div");
    info.className = "reg-edit__meta";
    const modeEl = document.createElement("div");
    modeEl.textContent = Utils.formatEventMode(ev.mode);
    const capEl = document.createElement("div");
    capEl.className = "reg-edit__sub";
    capEl.textContent = `Up to ${capacity} participant${capacity === 1 ? "" : "s"}`;
    info.appendChild(modeEl);
    info.appendChild(capEl);
    meta.appendChild(desc);
    meta.appendChild(info);
    const rowsBox = document.createElement("div");
    rowsBox.className = "reg-edit__rows";
    const start = [];
    for (let i = 0; i < capacity; i++) start.push(members[i] || {});
    start.forEach((m, i) => rowsBox.appendChild(this.editorRow(m, i)));
    meta.appendChild(rowsBox);
    const btns = document.createElement("div");
    btns.className = "reg-edit__actions";
    if (reg) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "reg-delete-link";
      delBtn.textContent = "Delete registration";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = await Utils.showConfirmModal("Delete your registration for this event?", "Delete registration", "Delete", "Cancel");
        if (!confirmed) return;
        try {
          await window.ExunServices.registrations.remove(eventId);
          Utils.showToast("Registration deleted", "success");
          await this.refreshData(true);
        } catch (err) {
          Utils.showToast((err && err.message) || "Delete failed", "error");
        }
      });
      btns.appendChild(delBtn);
    }
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn--primary";
    saveBtn.textContent = reg ? "Update" : "Save";
    saveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.saveEditor(inner, eventId, !!reg);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (this.editorDirty(inner)) {
        const ok = await Utils.showConfirmModal("You have unsaved changes. Discard them?", "Discard changes", "Discard", "Keep editing");
        if (!ok) return;
      }
      cardEl.classList.remove("expanded");
      setTimeout(() => {
        const el = cardEl.querySelector(".reg-inline");
        if (el && !cardEl.classList.contains("expanded")) el.remove();
      }, 380);
    });
    btns.appendChild(cancelBtn);
    btns.appendChild(saveBtn);
    meta.appendChild(btns);
    inner.appendChild(meta);
    inner.dataset.initial = JSON.stringify(this.editorSnapshot(inner));
    requestAnimationFrame(() => cardEl.classList.add("expanded"));
  }

  async saveEditor(inner, eventId, isUpdate) {
    const rows = this.editorSnapshot(inner);
    const students = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const n = i + 1;
      if (!r.name && !r.email && !r.cls && !r.phone) continue;
      if (!r.name) {
        Utils.showToast(`Participant ${n}: name is required`, "error");
        return;
      }
      if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
        Utils.showToast(`Participant ${n} (${r.name}): valid email required`, "error");
        return;
      }
      students.push({ fullname: r.name, email: r.email, class: r.cls, phone: r.phone });
    }
    if (students.length === 0) {
      Utils.showToast("Please add at least one participant", "error");
      return;
    }
    try {
      if (isUpdate) {
        await window.ExunServices.registrations.update({ eventId, students });
        Utils.showToast(`Registration updated (${students.length} participant${students.length === 1 ? "" : "s"})`, "success");
      } else {
        await window.ExunServices.registrations.submit({ eventId, students });
        Utils.showToast(`Registered ${students.length} participant${students.length === 1 ? "" : "s"}`, "success");
      }
      await this.refreshData(true);
    } catch (err) {
      Utils.showToast((err && err.message) || "Save failed", "error");
    }
  }

  setupEventListeners() {
    document.addEventListener("focusin", (e) => {
      const inp = e.target && e.target.closest ? e.target.closest(".reg-edit-row input[readonly]") : null;
      if (inp) inp.removeAttribute("readonly");
    });
    window.addEventListener("beforeunload", (e) => {
      const inners = document.querySelectorAll(".reg-inline__inner");
      for (const inner of inners) {
        if (this.editorDirty(inner)) {
          e.preventDefault();
          e.returnValue = "";
          return;
        }
      }
    });
    const editBtn = document.getElementById("edit-profile-btn");
    if (editBtn) editBtn.addEventListener("click", () => (window.location.href = "/complete"));
  }

  async refreshData(quiet) {
    await this.loadData();
    this.renderSummary();
    if (!quiet) Utils.showToast("Data refreshed successfully", "success");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body && document.body.dataset.page === "summary") {
    window.summaryPage = new SummaryPage();
  }
});
