class HomePage {
    constructor() {
        this.events = [];
        this.init();
    }

    async init() {
        await this.loadEvents();
        this.renderEvents();
        this.setupEventListeners();
        const focusId = new URLSearchParams(window.location.search).get('focus');
        if (focusId) Utils.focusEventCard(focusId);
    }

    async loadEvents() {
        try {
            const response = await window.ExunServices.events.getAllEvents();
            this.events = (response && response.data) || [];
        } catch (error) {
            console.error('Failed to load events from API:', error);
            Utils.showToast('Failed to load events', 'error');
        }
    }

    renderEvents() {
        const eventsGrid = document.querySelector('.events-grid');
        if (!eventsGrid) return;
        eventsGrid.innerHTML = '';
        if (this.events.length === 0) {
            eventsGrid.innerHTML = '<div class="no-events">No events published yet.</div>';
            return;
        }
        this.events.forEach(event => {
            eventsGrid.appendChild(this.createEventCard(event));
        });
    }

    createEventCard(event) {
        const card = document.createElement('a');
        card.href = `/event/${Utils.slugify(event.name || event.id)}`;
        card.className = 'event-card';
        card.dataset.eventId = event.id;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            Utils.rememberEventBack(`/?focus=${encodeURIComponent(event.id)}`);
            window.location.href = `/event/${Utils.slugify(event.name || event.id)}`;
        });
        const imageUrl = event.image ? (String(event.image).startsWith('/') ? event.image : `/illustrations/${String(event.image).split('/').pop()}`) : '/assets/exun_base.webp';
        const eligibilityText = Utils.formatEligibility(event.eligibility, event.open_to_all || event.openToAll);
        const participantsText = Utils.formatParticipantsDisplay(event);
        const modeText = Utils.formatEventMode(event.mode);
        card.innerHTML = `
            <img src="${Utils.escapeHtml(imageUrl)}" alt="${Utils.escapeHtml(event.name)}" class="event-card__image" loading="lazy" />
            <h3 class="event-card__title">${Utils.escapeHtml(event.name)}</h3>
            <div class="event-card__pills">
                <span class="event-card__mode">${Utils.escapeHtml(modeText)}</span>
                <span class="event-card__eligibility">${Utils.escapeHtml(eligibilityText)}</span>
            </div>
            <div class="event-card__participants">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2977f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>${Utils.escapeHtml(participantsText)}</span>
            </div>
        `;
        return card;
    }

    setupEventListeners() {
        const exploreBtn = document.querySelector('[data-action="explore-events"]');
        const brochureBtn = document.querySelector('[data-action="view-brochure"]');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                window.location.href = '/events';
            });
        }
        if (brochureBtn) {
            brochureBtn.addEventListener('click', () => {
                window.location.href = '/brochure';
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'home') {
        new HomePage();
    }
});
