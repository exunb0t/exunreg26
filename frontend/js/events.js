class EventsPage {
    constructor() {
        this.events = [];
        this.filteredEvents = [];
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        await this.loadEvents();
        this.setupFilters();
        this.renderEvents();
        this.setupEventListeners();
        this.trackFilterSlider();
        const focusId = new URLSearchParams(window.location.search).get('focus');
        if (focusId) Utils.focusEventCard(focusId);
    }

    async setupSummaryButton() {
        try {
            const session = await window.ExunServices.api.getSession();
            if (session && session.authenticated) {
                const wrapper = document.getElementById('summary-btn-wrapper');
                if (wrapper) wrapper.style.display = '';
            }
        } catch (e) {}
    }

    async loadEvents() {
        try {
            const response = await window.ExunServices.events.getAllEvents();
            this.events = (response && response.data) || [];
            this.events = this.events.map(event => ({
                ...event,
                image: event.image ? (String(event.image).startsWith('/') ? event.image : `/illustrations/${String(event.image).split('/').pop()}`) : '/assets/exun_base.webp'
            }));
            this.filteredEvents = [...this.events];
        } catch (error) {
            console.error('Failed to load events from API:', error);
            Utils.showToast('Failed to load events', 'error');
            this.showNoEvents();
        }
    }

    setupFilters() {
        const filtersContainer = document.querySelector('.events-page__filters');
        if (!filtersContainer) return;
        const categories = this.getEventCategories();
        filtersContainer.innerHTML = '';
        filtersContainer.appendChild(this.createFilterButton('all', 'All Events', true));
        categories.forEach(category => {
            filtersContainer.appendChild(this.createFilterButton(category.key, category.name));
        });
    }

    createFilterButton(key, name, active = false) {
        const button = document.createElement('button');
        button.className = `filter-btn ${active ? 'filter-btn--active' : ''}`;
        button.textContent = name;
        button.dataset.filter = key;
        button.addEventListener('click', () => {
            this.applyFilter(key);
            this.updateActiveFilter(button);
        });
        return button;
    }

    getEventCategories() {
        return [
            { key: 'build', name: 'Build' },
            { key: 'gaming', name: 'Gaming' },
            { key: 'cubing', name: 'Cubing' },
            { key: 'robotics', name: 'Robotics' }
        ];
    }

    applyFilter(filterKey) {
        this.currentFilter = filterKey;
        if (filterKey === 'all') {
            this.filteredEvents = [...this.events];
        } else {
            this.filteredEvents = this.events.filter(event => {
                const name = event.name || '';
                switch (filterKey) {
                    case 'build': return name.includes('Build:');
                    case 'gaming': return name.includes('DomainSquare+') || name.includes('Gaming');
                    case 'cubing': return name.includes('CubXL');
                    case 'robotics': return name.includes('Roboknights');
                    default: return false;
                }
            });
        }
        this.renderEvents();
    }

    updateActiveFilter(activeButton) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('filter-btn--active'));
        activeButton.classList.add('filter-btn--active');
        this.moveFilterSlider(activeButton);
        const strip = document.querySelector('.events-page__filters');
        if (strip && strip.scrollWidth > strip.clientWidth + 1) {
            strip.scrollTo({
                left: activeButton.offsetLeft - strip.clientWidth / 2 + activeButton.offsetWidth / 2,
                behavior: 'smooth'
            });
        }
    }

    moveFilterSlider(activeButton) {
        const container = document.querySelector('.events-page__filters');
        if (!container || !activeButton) return;
        let slider = container.querySelector('.filter-slider');
        if (!slider) {
            slider = document.createElement('span');
            slider.className = 'filter-slider';
            slider.setAttribute('aria-hidden', 'true');
            container.prepend(slider);
        }
        slider.style.transform = `translateX(${activeButton.offsetLeft - 2}px)`;
        slider.style.top = `${activeButton.offsetTop - 2}px`;
        slider.style.width = `${activeButton.offsetWidth + 4}px`;
        slider.style.height = `${activeButton.offsetHeight + 4}px`;
    }

    trackFilterSlider() {
        requestAnimationFrame(() => {
            const active = document.querySelector('.filter-btn--active');
            if (active) this.moveFilterSlider(active);
        });
        window.addEventListener('resize', Utils.debounce(() => {
            const active = document.querySelector('.filter-btn--active');
            if (active) this.moveFilterSlider(active);
        }, 150));
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                const active = document.querySelector('.filter-btn--active');
                if (active) this.moveFilterSlider(active);
            });
        }
    }

    renderEvents() {
        const eventsGrid = document.querySelector('.events-page__grid');
        if (!eventsGrid) return;
        eventsGrid.innerHTML = '';
        if (this.filteredEvents.length === 0) {
            this.showNoEvents();
            return;
        }
        this.filteredEvents.forEach(event => {
            eventsGrid.appendChild(this.createEventCard(event));
        });
    }

    createEventCard(event) {
        const card = document.createElement('a');
        card.href = `/event/${Utils.slugify(event.name || event.id)}?id=${encodeURIComponent(event.id)}`;
        card.className = 'event-card';
        card.dataset.eventId = event.id;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            Utils.rememberEventBack(`/events?focus=${encodeURIComponent(event.id)}`);
            window.location.href = `/event/${Utils.slugify(event.name || event.id)}?id=${encodeURIComponent(event.id)}`;
        });
        const imageUrl = event.image ? event.image : '/assets/exun_base.webp';
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

    showNoEvents() {
        const eventsGrid = document.querySelector('.events-page__grid');
        if (!eventsGrid) return;
        eventsGrid.innerHTML = `<div class="no-events">No events found for the selected filter.</div>`;
    }

    setupEventListeners() {
        const searchInput = document.querySelector('[data-search="events"]');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchEvents(e.target.value);
            }, 300));
        }
    }

    searchEvents(query) {
        if (!query.trim()) {
            this.applyFilter(this.currentFilter);
            return;
        }
        const searchTerm = query.toLowerCase();
        this.filteredEvents = this.events.filter(event =>
            event.name.toLowerCase().includes(searchTerm) ||
            (event.description_short && event.description_short.toLowerCase().includes(searchTerm)) ||
            (event.description_long && event.description_long.toLowerCase().includes(searchTerm))
        );
        this.renderEvents();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'events') {
        new EventsPage();
    }
});
