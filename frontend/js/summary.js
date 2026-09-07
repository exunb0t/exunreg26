class SummaryPage {
  constructor() {
    this.userProfile = null;
    this.registrations = [];
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
      const [profileResp, summaryResp] = await Promise.all([
        window.ExunServices.profile.get().catch((e) => { throw e; }),
        window.ExunServices.summary.get().catch((e) => { throw e; })
      ]);
      this.userProfile = (profileResp && profileResp.data) || {};
      const data = (summaryResp && summaryResp.data) || {};
      this.registrations = data.registrations || data.events || [];
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
    const confirmed = this.registrations.filter((r) => String(r.status || "").toLowerCase() === "confirmed").length;
    const pending = this.registrations.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
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
    if (!this.registrations || this.registrations.length === 0) {
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
    container.innerHTML = `<div class="registrations-grid">${this.registrations.map((r) => this.renderRegistrationCard(r)).join("")}</div>`;
    container.querySelectorAll(".btn-view-details").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const eid = btn.dataset.eventId;
        Utils.rememberEventBack("/summary");
        window.location.href = `/event/${Utils.slugify(btn.dataset.eventName || eid)}?id=${encodeURIComponent(eid)}`;
      });
    });
    container.querySelectorAll(".btn-delete-reg").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const eid = btn.dataset.eventId;
        const confirmed = await Utils.showConfirmModal("Delete your registration for this event?", "Delete registration", "Delete", "Cancel");
        if (!confirmed) return;
        try {
          await window.ExunServices.registrations.remove(eid);
          Utils.showToast("Registration deleted", "success");
          await this.refreshData();
        } catch (err) {
          Utils.showToast((err && err.message) || "Delete failed", "error");
        }
      });
    });
  }

  renderRegistrationCard(r) {
    const status = String(r.status || "pending").toLowerCase();
    const statusClass = status === "confirmed" ? "confirmed" : "pending";
    const members = r.participants || [];
    return `
      <div class="registration-card registration-card--${statusClass}" data-event-id="${Utils.escapeHtml(r.eventId)}">
        <div class="registration-card__header">
          <h4 class="registration-card__title">${Utils.escapeHtml(r.eventName || r.eventId)}</h4>
          <div class="registration-card__status registration-card__status--${statusClass}">${Utils.escapeHtml(status.toUpperCase())}</div>
        </div>
        <div class="registration-card__details">
          ${r.teamName ? `<div class="registration-detail"><span class="registration-detail__label">Team:</span><span class="registration-detail__value">${Utils.escapeHtml(r.teamName)}</span></div>` : ""}
          ${r.createdAt ? `<div class="registration-detail"><span class="registration-detail__label">Date:</span><span class="registration-detail__value">${Utils.escapeHtml(Utils.formatDate(r.createdAt))}</span></div>` : ""}
        </div>
        ${members.length ? `<div class="team-members"><h5 class="team-members__title">Team Members:</h5><div class="team-members__list">${members.map((m) => `<div class="team-member">${Utils.escapeHtml(m.name || "")} (${Utils.escapeHtml(m.email || "")})</div>`).join("")}</div></div>` : ""}
        <div class="registration-card__actions" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn--secondary btn-view-details" data-event-id="${Utils.escapeHtml(r.eventId)}" data-event-name="${Utils.escapeHtml(r.eventName || "")}">View Details</button>
          <button class="btn btn--tertiary btn-delete-reg" data-event-id="${Utils.escapeHtml(r.eventId)}">Delete</button>
        </div>
      </div>`;
  }

  setupEventListeners() {
    const editBtn = document.getElementById("edit-profile-btn");
    if (editBtn) editBtn.addEventListener("click", () => (window.location.href = "/complete"));
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await window.ExunServices.api.logout();
        window.location.href = "/login";
      });
    }
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        Utils.setLoading(refreshBtn, true);
        await this.refreshData();
        Utils.setLoading(refreshBtn, false);
      });
    }
  }

  async refreshData() {
    await this.loadData();
    this.renderSummary();
    Utils.showToast("Data refreshed successfully", "success");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body && document.body.dataset.page === "summary") {
    new SummaryPage();
  }
});
