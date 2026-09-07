class AdminPage {
    constructor() {
        this.currentTab = 'overview';
        this.stats = {};
        this.events = [];
        this.init();
    }

    async init() {
        const session = await window.ExunServices.api.getSession(true).catch(() => ({ authenticated: false }));
        if (!session.authenticated) {
            Utils.showToast('Please login first', 'error');
            setTimeout(() => window.location.href = '/login', 1200);
            return;
        }
        if (!session.isAdmin) {
            Utils.showToast('Access denied. Admin privileges required.', 'error');
            setTimeout(() => window.location.href = '/', 1500);
            return;
        }
        try {
            await this.loadData();
        } catch (err) {
            Utils.showToast((err && err.message) || 'Failed to load admin data', 'error');
            return;
        }
        this.setupEventListeners();
        this.renderCurrentTab();
    }

    async loadData() {
        const [statsResp, eventsResp] = await Promise.all([
            window.ExunServices.admin.getStats(),
            window.ExunServices.events.getAllEvents()
        ]);
        this.stats = (statsResp && statsResp.data) || {};
        this.events = ((eventsResp && eventsResp.data) || []);
        this.renderStats();
    }

    renderStats() {
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = v;
        };
        set('total-events', this.stats.events ?? 0);
        set('active-events', this.stats.events ?? 0);
        set('total-users', this.stats.users ?? 0);
        set('total-registrations', this.stats.registrations ?? 0);
    }

    setupEventListeners() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('admin-tab--active', tab.dataset.tab === tabName);
        });
        this.renderCurrentTab();
    }

    async renderCurrentTab() {
        const content = document.getElementById('admin-content');
        if (!content) return;
        if (this.currentTab === 'overview') {
            content.innerHTML = `
                <div class="admin-overview">
                    <h3>System Overview</h3>
                    <p>Users: ${Utils.escapeHtml(String(this.stats.users ?? 0))} · Events: ${Utils.escapeHtml(String(this.stats.events ?? 0))} · Registrations: ${Utils.escapeHtml(String(this.stats.registrations ?? 0))}</p>
                </div>`;
        } else if (this.currentTab === 'events') {
            await this.renderEvents();
        } else if (this.currentTab === 'users') {
            content.innerHTML = `
                <div class="admin-users">
                    <h3>User Lookup</h3>
                    <form id="user-lookup-form" style="display:flex;gap:8px;margin-bottom:16px;" autocomplete="off">
                        <input id="user-lookup-id" class="form-input" placeholder="User ID (numeric)" inputmode="numeric" autocomplete="off" />
                        <button class="btn btn--primary" type="submit">Lookup</button>
                    </form>
                    <div id="users-table-container"></div>
                </div>`;
            const form = document.getElementById('user-lookup-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('user-lookup-id').value.trim();
                if (!id) return;
                try {
                    const resp = await window.ExunServices.admin.getUserDetails(id);
                    const u = (resp && resp.data) || {};
                    document.getElementById('users-table-container').innerHTML = `
                        <table class="admin-table"><tbody>
                            <tr><th>Name</th><td>${Utils.escapeHtml(u.fullname || u.username || '')}</td></tr>
                            <tr><th>Email</th><td>${Utils.escapeHtml(u.email || '')}</td></tr>
                            <tr><th>School</th><td>${Utils.escapeHtml(u.institutionName || '')}</td></tr>
                            <tr><th>Phone</th><td>${Utils.escapeHtml(u.phoneNumber || '')}</td></tr>
                        </tbody></table>`;
                } catch (err) {
                    Utils.showToast((err && err.message) || 'User not found', 'error');
                }
            });
        } else if (this.currentTab === 'registrations') {
            content.innerHTML = `
                <div class="admin-registrations">
                    <h3>Registration Lookup</h3>
                    <form id="reg-lookup-form" style="display:flex;gap:8px;margin-bottom:16px;" autocomplete="off">
                        <input id="reg-lookup-event" class="form-input" placeholder="Event ID" autocomplete="off" />
                        <button class="btn btn--primary" type="submit">Load</button>
                    </form>
                    <div id="registrations-content"></div>
                </div>`;
            const form = document.getElementById('reg-lookup-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const eventId = document.getElementById('reg-lookup-event').value.trim();
                if (!eventId) return;
                try {
                    const resp = await window.ExunServices.admin.getEventRegistrations(eventId);
                    const regs = (resp && resp.data) || [];
                    document.getElementById('registrations-content').innerHTML = `
                        <table class="admin-table">
                            <thead><tr><th>ID</th><th>User</th><th>Team</th><th>Status</th></tr></thead>
                            <tbody>${regs.map((r) => `<tr><td>${Utils.escapeHtml(String(r.id))}</td><td>${Utils.escapeHtml(String(r.userId))}</td><td>${Utils.escapeHtml(r.teamName || '')}</td><td>${Utils.escapeHtml(r.status || '')}</td></tr>`).join('')}</tbody>
                        </table>`;
                } catch (err) {
                    Utils.showToast((err && err.message) || 'Failed to load registrations', 'error');
                }
            });
        }
    }

    async renderEvents() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="admin-events">
                <h3>Event Management</h3>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead><tr><th>Event Name</th><th>Mode</th><th>Participants</th><th>Registrations</th></tr></thead>
                        <tbody>
                            ${this.events.map(event => `
                                <tr>
                                    <td>${Utils.escapeHtml(event.name)}</td>
                                    <td>${Utils.escapeHtml(Utils.formatEventMode(event.mode))}</td>
                                    <td>${Utils.escapeHtml(Utils.formatParticipants(event.participants))}</td>
                                    <td>${Utils.escapeHtml(String(event.registrations || 0))}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
}

window.AdminPage = AdminPage;
