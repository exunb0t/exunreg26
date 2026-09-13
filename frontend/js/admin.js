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
        const deepTicket = (window.location.hash || '').match(/^#ticket-(\d+)$/);
        if (deepTicket) {
            this.switchTab('tickets');
            const id = Number(deepTicket[1]);
            const tryOpen = async (attempts) => {
                const row = document.querySelector(`[data-ticket-id="${id}"]`);
                if (row) {
                    row.click();
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (attempts > 0) {
                    setTimeout(() => tryOpen(attempts - 1), 500);
                }
            };
            tryOpen(10);
        }
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
        } else if (this.currentTab === 'tickets') {
            await this.renderTickets();
        } else if (this.currentTab === 'kb') {
            await this.renderKb();
        } else if (this.currentTab === 'tools') {
            this.renderTools();
        }
    }

    async renderEvents() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="admin-events">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3>Event Management</h3>
                    <button class="btn btn--primary" id="new-event-btn">New event</button>
                </div>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead><tr><th>Event Name</th><th>Mode</th><th>Participants</th><th>Registrations</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${this.events.map(event => `
                                <tr>
                                    <td>${Utils.escapeHtml(event.name)}</td>
                                    <td>${Utils.escapeHtml(Utils.formatEventMode(event.mode))}</td>
                                    <td>${Utils.escapeHtml(Utils.formatParticipants(event.participants))}</td>
                                    <td>${Utils.escapeHtml(String(event.registrations || 0))}</td>
                                    <td style="white-space:nowrap;">
                                        <button class="btn btn--secondary" data-edit-event="${Utils.escapeHtml(event.id)}">Edit</button>
                                        <button class="btn btn--secondary" data-delete-event="${Utils.escapeHtml(event.id)}">Delete</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        document.getElementById('new-event-btn').addEventListener('click', () => this.openEventModal(null));
        content.querySelectorAll('[data-edit-event]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const ev = this.events.find((e) => String(e.id) === btn.dataset.editEvent);
                this.openEventModal(ev || { id: btn.dataset.editEvent });
            });
        });
        content.querySelectorAll('[data-delete-event]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const confirmed = await Utils.showConfirmModal(`Delete event "${btn.dataset.deleteEvent}" and all its registrations?`, 'Delete event', 'Delete', 'Cancel');
                if (!confirmed) return;
                try {
                    await window.ExunServices.admin.deleteEvent(btn.dataset.deleteEvent);
                    Utils.showToast('Event deleted', 'success');
                    await this.reloadEvents();
                } catch (err) {
                    Utils.showToast((err && err.message) || 'Delete failed', 'error');
                }
            });
        });
    }

    async reloadEvents() {
        try {
            const eventsResp = await window.ExunServices.events.getAllEvents();
            this.events = (eventsResp && eventsResp.data) || [];
        } catch (e) {}
        await this.renderEvents();
    }

    openModal(html) {
        const modal = document.getElementById('admin-modal');
        const box = document.getElementById('modal-content');
        if (!modal || !box) return;
        box.innerHTML = html;
        modal.classList.add('admin-modal--open');
        const close = () => modal.classList.remove('admin-modal--open');
        box.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', close));
        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }

    openEventModal(ev) {
        const isNew = !ev || !ev.name;
        const e = ev || {};
        const checked = (v) => (v ? 'checked' : '');
        this.openModal(`
            <div class="admin-modal__header">
                <h3 class="admin-modal__title">${isNew ? 'New event' : 'Edit event'}</h3>
                <button class="admin-modal__close" data-close-modal>&times;</button>
            </div>
            <div class="admin-form">
                <div class="admin-form__row">
                    <div class="admin-form__group">
                        <label class="admin-form__label">ID (slug)</label>
                        <input id="ev-id" class="admin-form__input" value="${Utils.escapeHtml(e.id || '')}" ${isNew ? '' : 'disabled'} />
                    </div>
                    <div class="admin-form__group">
                        <label class="admin-form__label">Name</label>
                        <input id="ev-name" class="admin-form__input" value="${Utils.escapeHtml(e.name || '')}" />
                    </div>
                </div>
                <div class="admin-form__row">
                    <div class="admin-form__group">
                        <label class="admin-form__label">Mode</label>
                        <select id="ev-mode" class="admin-form__select">
                            ${['online', 'offline', 'hybrid'].map((m) => `<option value="${m}" ${(e.mode || '') === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-form__group">
                        <label class="admin-form__label">Image</label>
                        <input id="ev-image" class="admin-form__input" value="${Utils.escapeHtml(e.image || '')}" placeholder="/illustrations/..." />
                    </div>
                </div>
                <div class="admin-form__row">
                    <div class="admin-form__group">
                        <label class="admin-form__label">Participants</label>
                        <input id="ev-participants" type="number" min="1" class="admin-form__input" value="${e.participants ?? 1}" />
                    </div>
                    <div class="admin-form__group">
                        <label class="admin-form__label">Points</label>
                        <input id="ev-points" type="number" min="0" class="admin-form__input" value="${e.points ?? 0}" />
                    </div>
                </div>
                <div class="admin-form__row">
                    <div class="admin-form__group">
                        <label class="admin-form__label">Eligibility</label>
                        <input id="ev-eligibility" class="admin-form__input" value="${Utils.escapeHtml(e.eligibility || '')}" placeholder="6-12" />
                    </div>
                    <div class="admin-form__group">
                        <label class="admin-form__label">Dates</label>
                        <input id="ev-dates" class="admin-form__input" value="${Utils.escapeHtml(e.dates || '')}" placeholder="TBA" />
                    </div>
                </div>
                <div class="admin-form__group">
                    <label class="admin-form__label">Short description</label>
                    <textarea id="ev-short" class="admin-form__textarea">${Utils.escapeHtml(e.description_short || e.descriptionShort || '')}</textarea>
                </div>
                <div class="admin-form__group">
                    <label class="admin-form__label">Long description</label>
                    <textarea id="ev-long" class="admin-form__textarea">${Utils.escapeHtml(e.description_long || e.descriptionLong || '')}</textarea>
                </div>
                <div class="admin-form__row">
                    <div class="admin-form__group">
                        <label class="admin-form__label"><input type="checkbox" id="ev-open" ${checked(e.open_to_all || e.openToAll)} /> Open to all</label>
                    </div>
                    <div class="admin-form__group">
                        <label class="admin-form__label"><input type="checkbox" id="ev-independent" ${checked(e.individual ?? e.independentRegistration ?? true)} /> Individual registration</label>
                    </div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
                    <button class="btn btn--secondary" data-close-modal>Cancel</button>
                    <button class="btn btn--primary" id="ev-save">Save</button>
                </div>
            </div>`);
        document.getElementById('ev-save').addEventListener('click', async () => {
            const val = (id) => document.getElementById(id).value.trim();
            const num = (id, fb) => {
                const n = Number(val(id));
                return Number.isFinite(n) && n >= 0 ? n : fb;
            };
            const payload = {
                name: val('ev-name'),
                image: val('ev-image'),
                mode: val('ev-mode'),
                eligibility: val('ev-eligibility'),
                dates: val('ev-dates'),
                participants: Math.max(1, Math.floor(num('ev-participants', 1))),
                points: Math.max(0, Math.floor(num('ev-points', 0))),
                descriptionShort: val('ev-short'),
                descriptionLong: val('ev-long'),
                openToAll: document.getElementById('ev-open').checked,
                independentRegistration: document.getElementById('ev-independent').checked
            };
            if (!payload.name) {
                Utils.showToast('Event name required', 'error');
                return;
            }
            try {
                if (isNew) {
                    const id = val('ev-id');
                    if (!id) {
                        Utils.showToast('Event ID required', 'error');
                        return;
                    }
                    await window.ExunServices.admin.createEvent({ id, ...payload });
                    Utils.showToast('Event created', 'success');
                } else {
                    await window.ExunServices.admin.updateEvent(e.id, payload);
                    Utils.showToast('Event updated', 'success');
                }
                document.getElementById('admin-modal').classList.remove('admin-modal--open');
                await this.reloadEvents();
            } catch (err) {
                Utils.showToast((err && err.message) || 'Save failed', 'error');
            }
        });
    }

    async renderTickets() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="admin-tickets">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3>Support Tickets</h3>
                    <select id="ticket-filter" class="admin-form__select" style="width:auto;">
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="answered">Answered</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div id="tickets-table-container"><div class="loading-placeholder">Loading tickets...</div></div>
            </div>`;
        const load = async () => {
            const status = document.getElementById('ticket-filter').value;
            try {
                const resp = await window.ExunServices.admin.listTickets(status || undefined);
                const list = (resp && resp.data) || [];
                document.getElementById('tickets-table-container').innerHTML = `
                    <table class="admin-table">
                        <thead><tr><th>ID</th><th>Subject</th><th>Email</th><th>By</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
                        <tbody>${list.map((t) => `<tr data-ticket-id="${t.id}" style="cursor:pointer;"><td>${t.id}</td><td>${Utils.escapeHtml(t.subject || '')}</td><td>${Utils.escapeHtml(t.userEmail || '')}</td><td>${Utils.escapeHtml(t.createdBy || '')}</td><td>${Utils.escapeHtml(t.category || '')}</td><td>${Utils.escapeHtml(t.priority || '')}</td><td>${Utils.escapeHtml(t.status || '')}</td><td>${Utils.escapeHtml(t.createdAt || '')}</td></tr>`).join('') || '<tr><td colspan="8">No tickets</td></tr>'}</tbody>
                    </table>`;
                document.querySelectorAll('[data-ticket-id]').forEach((row) => {
                    row.addEventListener('click', () => {
                        const next = row.nextElementSibling;
                        if (next && next.classList.contains('ticket-detail-row')) {
                            next.remove();
                            return;
                        }
                        this.openTicketDetail(Number(row.dataset.ticketId), row);
                    });
                });
            } catch (err) {
                Utils.showToast((err && err.message) || 'Failed to load tickets', 'error');
            }
        };
        document.getElementById('ticket-filter').addEventListener('change', load);
        await load();
    }

    async openTicketDetail(id, anchorRow) {
        const table = anchorRow ? anchorRow.closest('table') : null;
        const cols = anchorRow ? anchorRow.children.length : 8;
        document.querySelectorAll('.ticket-detail-row').forEach((r) => r.remove());
        if (!anchorRow) return;
        const detailRow = document.createElement('tr');
        detailRow.className = 'ticket-detail-row';
        const cell = document.createElement('td');
        cell.colSpan = cols;
        cell.innerHTML = '<div class="loading-placeholder">Loading ticket...</div>';
        detailRow.appendChild(cell);
        anchorRow.after(detailRow);
        try {
            const resp = await window.ExunServices.admin.getTicket(id);
            const data = (resp && resp.data) || {};
            const t = data.ticket || {};
            const messages = data.messages || [];
            cell.innerHTML = `
                <div class="admin-card">
                    <h4>#${t.id} ${Utils.escapeHtml(t.subject || '')}</h4>
                    <p><strong>From:</strong> ${Utils.escapeHtml(t.userEmail || '')} · <strong>Status:</strong> ${Utils.escapeHtml(t.status || '')}${t.category ? ` · <strong>Category:</strong> ${Utils.escapeHtml(t.category)}` : ''}${t.priority ? ` · <strong>Priority:</strong> ${Utils.escapeHtml(t.priority)}` : ''}</p>
                    <p>${Utils.escapeHtml(t.message || '')}</p>
                    ${t.adminReply ? `<div class="md-body">${Utils.renderMarkdown(t.adminReply)}</div>` : ''}
                    ${messages.length ? `<div style="margin:12px 0;display:flex;flex-direction:column;gap:8px;">${messages.map((m) => `<div>${m.role === 'admin' ? `<div class="md-body">${Utils.renderMarkdown(String(m.content || '').slice(0, 2000))}</div>` : `<div><strong>${Utils.escapeHtml(m.role)}:</strong> ${Utils.escapeHtml(String(m.content || '').slice(0, 500))}</div>`}</div>`).join('')}</div>` : ''}
                    <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end;">
                        <textarea id="ticket-reply-input" class="admin-form__textarea" placeholder="Write a reply... (Markdown supported)" rows="3" style="flex:1;resize:vertical;"></textarea>
                        <button class="btn btn--primary" id="ticket-reply-send">Reply</button>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <button class="btn btn--secondary" data-ticket-status="open">Reopen</button>
                        <button class="btn btn--secondary" data-ticket-status="answered">Answered</button>
                        <button class="btn btn--secondary" data-ticket-status="closed">Close</button>
                    </div>
                </div>`;
            cell.querySelector('#ticket-reply-send').addEventListener('click', async () => {
                const message = cell.querySelector('#ticket-reply-input').value.trim();
                if (!message) return;
                try {
                    await window.ExunServices.admin.replyTicket(id, message);
                    Utils.showToast('Reply sent', 'success');
                    await this.openTicketDetail(id, anchorRow);
                } catch (err) {
                    Utils.showToast((err && err.message) || 'Reply failed', 'error');
                }
            });
            cell.querySelectorAll('[data-ticket-status]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    try {
                        await window.ExunServices.admin.setTicketStatus(id, btn.dataset.ticketStatus);
                        Utils.showToast('Ticket updated', 'success');
                        await this.renderTickets();
                        const row = document.querySelector(`[data-ticket-id="${id}"]`);
                        if (row) await this.openTicketDetail(id, row);
                    } catch (err) {
                        Utils.showToast((err && err.message) || 'Update failed', 'error');
                    }
                });
            });
            detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            Utils.showToast((err && err.message) || 'Failed to load ticket', 'error');
            detailRow.remove();
        }
    }

    async renderKb() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="admin-kb">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3>Knowledge Base</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn--secondary" id="kb-sync-all">Sync all</button>
                        <button class="btn btn--secondary" id="kb-seed">Seed from env</button>
                    </div>
                </div>
                <form id="kb-add-form" style="display:flex;gap:8px;margin-bottom:16px;" autocomplete="off">
                    <input id="kb-url" class="admin-form__input" placeholder="Google Doc URL" autocomplete="off" style="flex:1;" />
                    <button class="btn btn--primary" type="submit">Add + sync</button>
                </form>
                <div id="kb-table-container"><div class="loading-placeholder">Loading sources...</div></div>
                <div id="kb-chunks-container" style="margin-top:16px;"></div>
            </div>`;
        const load = async () => {
            try {
                const resp = await window.ExunServices.admin.kbSources();
                const list = (resp && resp.data) || [];
                document.getElementById('kb-table-container').innerHTML = `
                    <table class="admin-table">
                        <thead><tr><th>ID</th><th>URL</th><th>Title</th><th>Status</th><th>Chunks</th><th>On</th><th>Actions</th></tr></thead>
                        <tbody>${list.map((s) => `<tr><td>${s.id}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(s.url || '')}</td><td>${Utils.escapeHtml(s.title || '')}</td><td>${Utils.escapeHtml(s.status || '')}</td><td>${s.chunkCount ?? 0}</td><td><button class="btn btn--secondary" data-kb-toggle="${s.id}">${s.enabled ? 'On' : 'Off'}</button></td><td style="white-space:nowrap;"><button class="btn btn--secondary" data-kb-chunks="${s.id}">Chunks</button> <button class="btn btn--secondary" data-kb-sync="${s.id}">Sync</button> <button class="btn btn--secondary" data-kb-delete="${s.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7">No sources</td></tr>'}</tbody>
                    </table>`;
                document.querySelectorAll('[data-kb-chunks]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        try {
                            const r = await window.ExunServices.admin.kbChunks(btn.dataset.kbChunks);
                            const chunks = ((r && r.data && r.data.chunks) || []);
                            document.getElementById('kb-chunks-container').innerHTML = `<div class="admin-card"><h4>Chunks (${chunks.length})</h4>${chunks.slice(0, 20).map((ch) => `<p><strong>#${ch.chunkIndex}:</strong> ${Utils.escapeHtml(String(ch.content || '').slice(0, 300))}...</p>`).join('')}</div>`;
                        } catch (err) {
                            Utils.showToast((err && err.message) || 'Failed to load chunks', 'error');
                        }
                    });
                });
                document.querySelectorAll('[data-kb-sync]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        try {
                            await window.ExunServices.admin.kbSync(Number(btn.dataset.kbSync));
                            Utils.showToast('Source synced', 'success');
                        } catch (err) {
                            Utils.showToast((err && err.message) || 'Sync failed', 'error');
                        } finally {
                            await load();
                        }
                    });
                });
                document.querySelectorAll('[data-kb-toggle]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        try {
                            const r = await window.ExunServices.admin.kbToggleSource(btn.dataset.kbToggle);
                            Utils.showToast((r && r.message) || 'Source toggled', 'success');
                            await load();
                        } catch (err) {
                            Utils.showToast((err && err.message) || 'Toggle failed', 'error');
                        }
                    });
                });
                document.querySelectorAll('[data-kb-delete]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const confirmed = await Utils.showConfirmModal('Delete this source and all its chunks?', 'Delete source', 'Delete', 'Cancel');
                        if (!confirmed) return;
                        try {
                            await window.ExunServices.admin.kbDeleteSource(btn.dataset.kbDelete);
                            Utils.showToast('Source deleted', 'success');
                            await load();
                        } catch (err) {
                            Utils.showToast((err && err.message) || 'Delete failed', 'error');
                        }
                    });
                });
                return list;
            } catch (err) {
                Utils.showToast((err && err.message) || 'Failed to load sources', 'error');
                return [];
            }
        };
        const pollKbUntilFresh = async (startedAt) => {
            for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 4000));
                const list = await load();
                if (list.length > 0 && list.every((s) => s.status === 'error' || (s.lastSyncedAt && s.lastSyncedAt >= startedAt))) break;
            }
            await load();
        };
        document.getElementById('kb-add-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('kb-url').value.trim();
            if (!url) return;
            try {
                const resp = await window.ExunServices.admin.kbAddSource(url);
                Utils.showToast('Source added', 'success');
                document.getElementById('kb-url').value = '';
                if (resp && resp.data && resp.data.failed && resp.data.failed.length > 0) {
                    Utils.showToast(`Could not resolve as Google Doc: ${resp.data.failed.join(', ')}`, 'error');
                }
            } catch (err) {
                Utils.showToast((err && err.message) || 'Add failed', 'error');
            } finally {
                await load();
            }
        });
        document.getElementById('kb-sync-all').addEventListener('click', async () => {
            const startedAt = new Date().toISOString();
            try {
                await window.ExunServices.admin.kbSync();
                Utils.showToast('Sync running in background', 'success');
            } catch (err) {
                Utils.showToast((err && err.message) || 'Sync failed', 'error');
            } finally {
                await pollKbUntilFresh(startedAt);
            }
        });
        document.getElementById('kb-seed').addEventListener('click', async () => {
            const startedAt = new Date().toISOString();
            try {
                await window.ExunServices.admin.kbSeed();
                Utils.showToast('Seed started, sync running in background', 'success');
            } catch (err) {
                Utils.showToast((err && err.message) || 'Seed failed', 'error');
            } finally {
                await pollKbUntilFresh(startedAt);
            }
        });
        await load();
    }

    renderTools() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="admin-tools" style="display:flex;flex-direction:column;gap:24px;">
                <div class="admin-card">
                    <h3>Send invite</h3>
                    <form id="invite-form" style="display:flex;flex-direction:column;gap:10px;" autocomplete="off">
                        <input id="invite-email" class="admin-form__input" placeholder="Email" autocomplete="off" />
                        <textarea id="invite-message" class="admin-form__textarea" placeholder="Message (optional)"></textarea>
                        <button class="btn btn--primary" type="submit" style="align-self:flex-start;">Send invite</button>
                    </form>
                </div>
                <div class="admin-card">
                    <h3>Export to Google Sheet</h3>
                    <form id="sheets-form" style="display:flex;flex-direction:column;gap:10px;" autocomplete="off">
                        <input id="sheets-id" class="admin-form__input" placeholder="Spreadsheet ID (optional if SPREADSHEET_ID is set)" autocomplete="off" />
                        <button class="btn btn--primary" type="submit" style="align-self:flex-start;">Export now</button>
                    </form>
                    <div id="sheets-result" style="margin-top:10px;"></div>
                </div>
                <div class="admin-card">
                    <h3>Drive backup</h3>
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <a class="btn btn--secondary" href="/api/admin/oauth2/start">Connect Google Drive</a>
                            <button class="btn btn--primary" id="backup-now-btn" type="button">Back up now</button>
                        </div>
                        <div id="backup-result"></div>
                    </div>
                </div>
            </div>`;
        document.getElementById('invite-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('invite-email').value.trim();
            const message = document.getElementById('invite-message').value.trim();
            if (!email) return;
            try {
                await window.ExunServices.admin.sendInvite(email, message);
                Utils.showToast('Invite sent', 'success');
                document.getElementById('invite-email').value = '';
                document.getElementById('invite-message').value = '';
            } catch (err) {
                Utils.showToast((err && err.message) || 'Invite failed', 'error');
            }
        });
        document.getElementById('sheets-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const spreadsheetId = document.getElementById('sheets-id').value.trim();
            try {
                const resp = await window.ExunServices.admin.exportSheets(spreadsheetId || undefined);
                const data = (resp && resp.data) || {};
                document.getElementById('sheets-result').textContent = `Exported — users: ${data.users ?? 0}, registrations: ${data.registrations ?? 0}, individual: ${data.individual ?? 0}`;
                Utils.showToast('Sheet updated', 'success');
            } catch (err) {
                Utils.showToast((err && err.message) || 'Export failed', 'error');
            }
        });
        document.getElementById('backup-now-btn').addEventListener('click', async () => {
            const btn = document.getElementById('backup-now-btn');
            Utils.setLoading(btn, true);
            try {
                const resp = await window.ExunServices.admin.backupNow();
                const data = (resp && resp.data) || {};
                document.getElementById('backup-result').textContent = data.uploaded
                    ? `Uploaded (file ${data.fileId || ''})`
                    : `Skipped: ${data.reason || 'unknown'}`;
                Utils.showToast((resp && resp.message) || 'Backup done', data.uploaded ? 'success' : 'info');
            } catch (err) {
                Utils.showToast((err && err.message) || 'Backup failed', 'error');
            } finally {
                Utils.setLoading(btn, false);
            }
        });
    }
}

window.AdminPage = AdminPage;
