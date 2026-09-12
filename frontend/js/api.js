async function apiRequest(endpoint, options = {}) {
    let url = endpoint || '';
    if (!url.startsWith('/')) url = '/' + url;
    if (!url.startsWith('/api/')) url = '/api' + url;
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    };
    if (config.body && typeof config.body !== 'string') {
        config.body = JSON.stringify(config.body);
    }
    try {
        const response = await fetch(url, config);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok) {
            if (contentType.includes('application/json')) {
                const errJson = await response.json().catch(() => null);
                const msg = (errJson && (errJson.error || errJson.message)) || `HTTP error! status: ${response.status}`;
                const err = new Error(msg);
                err.status = response.status;
                err.data = errJson && errJson.data;
                throw err;
            }
            const err = new Error(`HTTP error! status: ${response.status}`);
            err.status = response.status;
            throw err;
        }
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

let _sessionCache = null;
let _sessionPromise = null;

async function getSession(force = false) {
    if (_sessionCache && !force) return _sessionCache;
    if (_sessionPromise && !force) return _sessionPromise;
    _sessionPromise = apiRequest('/api/auth/session', { method: 'GET' })
        .then((resp) => {
            _sessionCache = (resp && resp.data) || { authenticated: false, email: null, isAdmin: false };
            return _sessionCache;
        })
        .catch(() => {
            _sessionCache = { authenticated: false, email: null, isAdmin: false };
            return _sessionCache;
        })
        .finally(() => {
            _sessionPromise = null;
        });
    return _sessionPromise;
}

function clearSessionCache() {
    _sessionCache = null;
    _sessionPromise = null;
}

async function isAuthenticated() {
    const s = await getSession();
    return !!s.authenticated;
}

async function isAdmin() {
    const s = await getSession();
    return !!s.isAdmin;
}

async function logout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
        clearSessionCache();
    }
}

window.ExunServices = window.ExunServices || {};

window.ExunServices.api = {
    apiRequest,
    getSession,
    clearSessionCache,
    isAuthenticated,
    isAdmin,
    logout
};

window.ExunServices.auth = {
    sendOTP: async function (email, resend) {
        const resp = await apiRequest('/api/auth/send-otp', { method: 'POST', body: resend ? { email, resend: true } : { email } });
        return resp;
    },
    verifyOTP: async function (email, otp) {
        const resp = await apiRequest('/api/auth/verify-otp', { method: 'POST', body: { email, otp } });
        clearSessionCache();
        return resp;
    }
};

window.ExunServices.events = {
    getAllEvents: function () {
        return apiRequest('/api/events', { method: 'GET' });
    },
    getEvent: function (id) {
        return apiRequest(`/api/events/${encodeURIComponent(id)}`, { method: 'GET' });
    }
};

window.ExunServices.profile = {
    get: function () {
        return apiRequest('/api/profile', { method: 'GET' });
    },
    update: function (patch) {
        return apiRequest('/api/profile', { method: 'PATCH', body: patch });
    }
};

window.ExunServices.registrations = {
    submit: function (payload) {
        return apiRequest('/api/submit_registrations', { method: 'POST', body: payload });
    },
    update: function (payload) {
        return apiRequest('/api/submit_registrations', { method: 'PUT', body: payload });
    },
    remove: function (eventId) {
        return apiRequest(`/api/submit_registrations?eventId=${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    }
};

window.ExunServices.summary = {
    get: function () {
        return apiRequest('/api/summary', { method: 'GET' });
    }
};

window.ExunServices.query = {
    submit: function (subject, message) {
        return apiRequest('/api/query', { method: 'POST', body: { subject, message } });
    },
    mine: function () {
        return apiRequest('/api/tickets/mine', { method: 'GET' });
    }
};

window.ExunServices.chat = {
    createConversation: function () {
        return apiRequest('/api/chat/conversations', { method: 'POST', body: {} });
    },
    listConversations: function () {
        return apiRequest('/api/chat/conversations', { method: 'GET' });
    },
    getConversation: function (id) {
        return apiRequest(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'GET' });
    },
    deleteConversation: function (id) {
        return apiRequest(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    sendMessage: function (id, message) {
        return apiRequest(`/api/chat/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { message } });
    },
    updateMessage: function (cid, mid, content) {
        return apiRequest(`/api/chat/conversations/${encodeURIComponent(cid)}/messages/${encodeURIComponent(mid)}`, { method: 'PATCH', body: { content } });
    },
    escalate: function (id, message) {
        return apiRequest(`/api/chat/conversations/${encodeURIComponent(id)}/escalate`, { method: 'POST', body: message ? { message } : {} });
    }
};

window.ExunServices.admin = {
    getStats: function () {
        return apiRequest('/api/admin/stats', { method: 'GET' });
    },
    getConfig: function () {
        return apiRequest('/api/admin/config', { method: 'GET' });
    },
    getEvent: function (id) {
        return apiRequest(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'GET' });
    },
    createEvent: function (payload) {
        return apiRequest('/api/admin/events', { method: 'POST', body: payload });
    },
    updateEvent: function (id, payload) {
        return apiRequest(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    },
    deleteEvent: function (id) {
        return apiRequest(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    getUserDetails: function (id) {
        return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'GET' });
    },
    getEventRegistrations: function (eventId) {
        return apiRequest(`/api/admin/events/${encodeURIComponent(eventId)}/registrations`, { method: 'GET' });
    },
    exportData: function () {
        return apiRequest('/api/admin/export', { method: 'GET' });
    },
    importEvents: function (events) {
        return apiRequest('/api/admin/import_events', { method: 'POST', body: { events } });
    },
    listTickets: function (status) {
        return apiRequest('/api/admin/tickets' + (status ? `?status=${encodeURIComponent(status)}` : ''), { method: 'GET' });
    },
    getTicket: function (id) {
        return apiRequest(`/api/admin/tickets/${encodeURIComponent(id)}`, { method: 'GET' });
    },
    replyTicket: function (id, message) {
        return apiRequest(`/api/admin/tickets/${encodeURIComponent(id)}/reply`, { method: 'POST', body: { message } });
    },
    setTicketStatus: function (id, status) {
        return apiRequest(`/api/admin/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
    },
    kbSources: function () {
        return apiRequest('/api/admin/kb/sources', { method: 'GET' });
    },
    kbAddSource: function (url) {
        return apiRequest('/api/admin/kb/sources', { method: 'POST', body: { url } });
    },
    kbDeleteSource: function (id) {
        return apiRequest(`/api/admin/kb/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    kbChunks: function (id) {
        return apiRequest(`/api/admin/kb/sources/${encodeURIComponent(id)}/chunks`, { method: 'GET' });
    },
    kbSync: function (sourceId) {
        return apiRequest('/api/admin/kb/sync', { method: 'POST', body: sourceId ? { sourceId } : {} });
    },
    kbSeed: function () {
        return apiRequest('/api/admin/kb/sources/seed', { method: 'POST', body: {} });
    },
    sendInvite: function (email, message) {
        return apiRequest('/api/admin/send-invite', { method: 'POST', body: { email, message } });
    },
    syncSheets: function (spreadsheetId, range) {
        return apiRequest('/api/admin/sync-sheets', { method: 'POST', body: range ? { spreadsheetId, range } : { spreadsheetId } });
    }
};
