class EventDetailPage {
  constructor() {
    this.event = null;
    this.eventId = this.getEventIdFromUrl();
    this.existingRegistration = null;
    this.init();
  }

  getEventIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get("id") || urlParams.get("eventId");
    if (q) return q;
    const match = window.location.pathname.match(/\/event\/([^\/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  }

  async init() {
    if (!this.eventId) {
      Utils.showToast("Invalid event ID", "error");
      Utils.redirect("/events", 800);
      return;
    }
    await this.loadEvent();
    if (!this.event) return;
    this.renderEvent();
    this.setupEventListeners();
  }

  async loadEvent() {
    try {
      const response = await window.ExunServices.events.getEvent(this.eventId);
      if (response && response.status === "success") {
        this.event = response.data;
        if (this.event.id) this.eventId = this.event.id;
      } else {
        throw new Error((response && response.error) || "Event not found");
      }
    } catch (error) {
      console.error("Failed to load event:", error);
      Utils.showToast("Failed to load event details", "error");
      Utils.redirect("/events", 800);
    }
  }

  icons() {
    return {
      mode: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2977f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
      participants: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2977f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      eligibility: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2977f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      points: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2977f5" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c.9 6.2 3.8 9.1 10 10-6.2.9-9.1 3.8-10 10-.9-6.2-3.8-9.1-10-10 6.2-.9 9.1-3.8 10-10z"/></svg>`,
      dates: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 9H21M7 3V5M17 3V5M6 12H8M11 12H13M16 12H18M6 15H8M11 15H13M16 15H18M6 18H8M11 18H13M16 18H18M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="#2977f5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };
  }

  formatEligibilityDetail() {
    if (this.event.open_to_all || this.event.openToAll) return "Open to All";
    const nums = (String(this.event.eligibility == null ? "" : this.event.eligibility).match(/\d+/g) || []);
    if (nums.length >= 2) return `Grades ${nums[0]}-${nums[nums.length - 1]}`;
    if (nums.length === 1) return `Grade ${nums[0]}`;
    const clean = String(this.event.eligibility == null ? "" : this.event.eligibility).trim();
    return clean === "" ? "TBA" : clean;
  }

  renderEvent() {
    if (!this.event) return;
    document.title = `${this.event.name} | Exun 2026`;
    const heading = document.getElementById("event-heading");
    if (heading) {
      const name = this.event.name || "";
      const colon = name.indexOf(":");
      if (colon !== -1) {
        heading.innerHTML = `<span class="accent">${Utils.escapeHtml(name.slice(0, colon + 1))}</span>${Utils.escapeHtml(name.slice(colon + 1))}`;
      } else {
        heading.textContent = name;
      }
    }
    const imgEl = document.getElementById("event-image");
    if (imgEl) {
      const raw = this.event.image;
      imgEl.src = raw ? (String(raw).startsWith("/") ? raw : `/illustrations/${String(raw).split("/").pop()}`) : "/assets/exun_base.webp";
      imgEl.alt = this.event.name;
    }
    const icons = this.icons();
    const details = document.getElementById("event-info");
    if (details) {
      const rows = [
        ["Mode", icons.mode, Utils.formatEventMode(this.event.mode) || "TBA"],
        ["Participants", icons.participants, String(this.event.participants || "TBA")],
        ["Eligibility", icons.eligibility, this.formatEligibilityDetail()],
        ["Points", icons.points, String(this.event.points || 0)],
        ["Dates", icons.dates, this.event.dates || "TBA"]
      ];
      details.innerHTML = rows.map(([label, icon, value]) => `
        <div class="event-info-item"><span class="event-info-label">${icon}<span>${Utils.escapeHtml(label)}</span></span><span class="event-info-value">${Utils.escapeHtml(value)}</span></div>
      `).join("");
    }
    const description = document.getElementById("event-description");
    if (description) {
      const longDesc = this.event.description_long || this.event.descriptionLong || "";
      const shortDesc = this.event.description_short || this.event.descriptionShort || "";
      let html = "";
      if (shortDesc) html += `<p>${Utils.escapeHtml(shortDesc)}</p>`;
      if (longDesc) html += String(longDesc).split("\n").filter((p) => p.trim()).map((p) => `<p>${Utils.escapeHtml(p.trim())}</p>`).join("");
      if (!html) html = "<p>Details coming soon.</p>";
      description.innerHTML = html;
    }
  }

  setupEventListeners() {
    const registerBtn = document.getElementById("register-event-btn");
    if (registerBtn) {
      registerBtn.addEventListener("click", () => this.handleRegisterClick());
    }
    const backBtn = document.querySelector('[data-action="back-to-events"]');
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        const here = window.location.pathname + window.location.search;
        const back = Utils.readEventBack();
        if (back && back !== here) {
          window.location.href = back;
        } else {
          window.location.href = `/events?focus=${encodeURIComponent(this.eventId)}`;
        }
      });
    }
  }

  async handleRegisterClick() {
    const session = await window.ExunServices.api.getSession();
    if (!session.authenticated) {
      Utils.redirect("/login", 100);
      return;
    }
    try {
      const profileResp = await window.ExunServices.profile.get();
      if (!profileResp || profileResp.status !== "success" || !profileResp.data) {
        Utils.redirect("/complete", 100);
        return;
      }
      const check = this.checkProfileCompleteness(profileResp.data);
      if (!check.ok) {
        Utils.showToast("Complete your profile before registering. Missing: " + check.missing.join(", "), "error");
        setTimeout(() => Utils.redirect("/complete", 100), 900);
        return;
      }
    } catch (e) {
      Utils.showToast("Failed to verify profile. Please login again.", "error");
      Utils.redirect("/login", 200);
      return;
    }
    await this.openRegistrationModal();
  }

  checkProfileCompleteness(user) {
    const u = { ...user };
    const missing = [];
    const phone = u.phoneNumber || u.phone_number || "";
    if (!phone || String(phone).trim() === "") missing.push("phone number");
    if (!u.individual && !u.Individual) {
      const inst = u.institutionName || u.institution_name || "";
      const princ = u.principalsEmail || u.principals_email || "";
      if (!inst || String(inst).trim() === "") missing.push("institution name");
      if (!princ || String(princ).trim() === "") missing.push("principal's email");
    }
    return { ok: missing.length === 0, missing };
  }

  async loadExistingRegistration() {
    try {
      const resp = await window.ExunServices.summary.get();
      const regs = ((resp && resp.data && (resp.data.registrations || resp.data.events)) || []);
      this.existingRegistration = regs.find((r) => String(r.eventId) === String(this.eventId)) || null;
    } catch (e) {
      this.existingRegistration = null;
    }
  }

  async openRegistrationModal() {
    await this.loadExistingRegistration();
    const capacity = parseInt(this.event.participants || 1, 10) || 1;
    const existingMembers = (this.existingRegistration && this.existingRegistration.participants) || [];
    const isUpdate = !!this.existingRegistration;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.tabIndex = -1;
    const modal = document.createElement("div");
    modal.className = "modal-box";
    const title = document.createElement("h3");
    title.textContent = `${isUpdate ? "Update" : "Register for"} ${this.event.name || ""}`;
    title.style.marginTop = "0";
    modal.appendChild(title);

    const editor = document.createElement("div");
    editor.className = "inline-registration-editor";
    editor.style.marginTop = "12px";
    const rows = [];

    const createRow = (p) => {
      const row = document.createElement("div");
      row.className = "inline-member-row";
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr 1fr 90px 130px";
      row.style.gap = "12px";
      row.style.marginBottom = "10px";
      const nameVal = String((p && (p.name || p.fullname)) || "").replace(/"/g, "&quot;");
      const emailVal = String((p && p.email) || "").replace(/"/g, "&quot;");
      const classVal = String((p && p.class) || "").replace(/"/g, "&quot;");
      const phoneVal = String((p && p.phone) || "").replace(/"/g, "&quot;");
      row.innerHTML = `
        <input class="form-input" data-name="name" placeholder="Full name" value="${nameVal}" autocomplete="off" readonly />
        <input class="form-input" data-name="email" placeholder="Email" value="${emailVal}" autocomplete="off" readonly />
        <input class="form-input" data-name="class" placeholder="Class" value="${classVal}" autocomplete="off" readonly />
        <input class="form-input" data-name="phone" placeholder="Phone" value="${phoneVal}" autocomplete="off" readonly />
      `;
      return row;
    };

    editor.addEventListener("focusin", (e) => {
      const inp = e.target && e.target.closest ? e.target.closest("input[readonly]") : null;
      if (inp) inp.removeAttribute("readonly");
    });

    for (let i = 0; i < capacity; i++) {
      const r = createRow(existingMembers[i] || {});
      rows.push(r);
      editor.appendChild(r);
    }

    const actions = document.createElement("div");
    actions.style.marginTop = "12px";
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.justifyContent = "flex-end";
    actions.style.alignItems = "center";
    if (isUpdate) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete registration";
      deleteBtn.style.marginRight = "auto";
      deleteBtn.style.background = "none";
      deleteBtn.style.border = "none";
      deleteBtn.style.padding = "10px 4px";
      deleteBtn.style.fontFamily = "inherit";
      deleteBtn.style.fontSize = "14px";
      deleteBtn.style.fontWeight = "600";
      deleteBtn.style.color = "#d33f49";
      deleteBtn.style.opacity = "0.75";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = await Utils.showConfirmModal("Delete your registration for this event?", "Delete registration", "Delete", "Cancel");
        if (!confirmed) return;
        try {
          await window.ExunServices.registrations.remove(this.eventId);
          Utils.showToast("Registration deleted", "success");
          cleanup();
        } catch (err) {
          Utils.showToast((err && err.message) || "Delete failed", "error");
        }
      });
      actions.appendChild(deleteBtn);
    }
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn--primary";
    saveBtn.textContent = isUpdate ? "Update" : "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.textContent = "Cancel";
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    editor.appendChild(actions);

    modal.appendChild(editor);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.classList.add("modal-open");
      modal.classList.add("modal-open");
    }, 10);

    const cleanup = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") cleanup();
    };
    document.addEventListener("keydown", onKeyDown);
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cleanup();
    });
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) cleanup();
    });

    saveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const students = [];
      for (const r of rows) {
        const name = (r.querySelector('[data-name="name"]').value || "").trim();
        const email = (r.querySelector('[data-name="email"]').value || "").trim();
        const cls = (r.querySelector('[data-name="class"]').value || "").trim();
        const phone = (r.querySelector('[data-name="phone"]').value || "").trim();
        if (!name) continue;
        students.push({ fullname: name, email, class: cls, phone });
      }
      if (students.length === 0) {
        Utils.showToast("Please add at least one participant", "error");
        return;
      }
      try {
        const payload = { eventId: this.eventId, students };
        if (isUpdate) {
          await window.ExunServices.registrations.update(payload);
          Utils.showToast("Registration updated", "success");
        } else {
          await window.ExunServices.registrations.submit(payload);
          Utils.showToast("Registration saved", "success");
        }
        setTimeout(cleanup, 600);
      } catch (err) {
        Utils.showToast((err && err.message) || "Save failed", "error");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "event-detail") {
    new EventDetailPage();
  }
});
