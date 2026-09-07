class Navigation {
    constructor() {
        this.session = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUserState();
        this.updateNavigation();
    }

    async loadUserState() {
        try {
            this.session = await window.ExunServices.api.getSession();
        } catch (error) {
            this.session = { authenticated: false, email: null, isAdmin: false };
        }
    }

    updateNavigation() {
        this.updateAuthLinks();
        this.updateActiveLink();
    }

    updateAuthLinks() {
        const authContainer = document.querySelector('[data-nav="auth"]');
        if (!authContainer) return;
        const loggedIn = !!(this.session && this.session.authenticated);
        if (loggedIn) {
            let links = `<a href="/summary" class="navbar__link">Registration Summary</a>`;
            if (this.session.isAdmin) {
                links += `<a href="/admin" class="navbar__link">Admin</a>`;
            }
            links += `<button class="btn btn--primary navbar__link" data-action="logout">Logout</button>`;
            authContainer.innerHTML = links;
        } else {
            if (!authContainer.textContent.trim()) {
                authContainer.innerHTML = `<button class="btn btn--primary navbar__link" data-action="login">Login</button>`;
            }
        }
    }

    updateActiveLink() {
        const navLinks = document.querySelectorAll('.navbar__link');
        let currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
            currentPath = '/';
        }
        navLinks.forEach(link => {
            link.classList.remove('navbar__link--active');
            let linkPath = link.getAttribute('href');
            if (linkPath === '/' || linkPath === '/index.html') {
                linkPath = '/';
            }
            if (linkPath === currentPath) {
                link.classList.add('navbar__link--active');
            }
        });
    }

    setupEventListeners() {
        if (!this._delegatedClickAttached) {
            this._delegatedClickAttached = true;
            document.addEventListener('click', (e) => {
                const loginTarget = e.target.closest('[data-action="login"]');
                if (loginTarget) {
                    e.preventDefault();
                    window.location.href = '/login';
                    return;
                }
                const logoutTarget = e.target.closest('[data-action="logout"]');
                if (logoutTarget) {
                    e.preventDefault();
                    this.handleLogout();
                }
            });
        }
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const navbar = document.querySelector('.navbar');
        const nav = document.querySelector('.navbar__nav');
        if (!navbar || !nav) return;
        let toggleBtn = navbar.querySelector('.navbar__toggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'navbar__toggle';
        }
        toggleBtn.setAttribute('aria-label', 'Toggle navigation');
        toggleBtn.setAttribute('aria-expanded', 'false');
        const svgMenu = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" version="1.1" aria-hidden="true"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g><rect fill-rule="nonzero" x="0" y="0" width="24" height="24"></rect><line x1="5" y1="7" x2="19" y2="7" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line><line x1="5" y1="12" x2="19" y2="12" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line><line x1="5" y1="17" x2="19" y2="17" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line></g></g></svg>`;
        let isOpen = false;
        toggleBtn.innerHTML = svgMenu;
        nav.setAttribute('aria-hidden', 'true');
        nav.classList.remove('open');
        const openMenu = () => {
            isOpen = true;
            nav.classList.add('open');
            nav.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.innerHTML = 'X';
            document.addEventListener('click', outsideClickListener);
            document.addEventListener('keydown', escapeListener);
        };
        const closeMenu = () => {
            isOpen = false;
            nav.classList.remove('open');
            nav.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.innerHTML = svgMenu;
            document.removeEventListener('click', outsideClickListener);
            document.removeEventListener('keydown', escapeListener);
        };
        const outsideClickListener = (e) => {
            if (!navbar.contains(e.target)) {
                closeMenu();
            }
        };
        const escapeListener = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeMenu();
            }
        };
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isOpen) closeMenu(); else openMenu();
        });
        if (!navbar.contains(toggleBtn)) navbar.appendChild(toggleBtn);
        const mql = window.matchMedia('(max-width: 768px)');
        const handleResize = () => {
            const mobile = mql.matches;
            if (!mobile) {
                nav.classList.remove('open');
                nav.removeAttribute('aria-hidden');
                toggleBtn.style.display = 'none';
                toggleBtn.setAttribute('aria-expanded', 'false');
                try { this.updateAuthLinks(); } catch (e) {}
            } else {
                nav.classList.remove('open');
                nav.setAttribute('aria-hidden', 'true');
                toggleBtn.style.display = 'block';
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        };
        handleResize();
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handleResize);
        }
    }

    async handleLogout() {
        const btn = document.querySelector('[data-action="logout"]');
        try {
            Utils.setLoading(btn, true);
            await window.ExunServices.api.logout();
            Utils.showToast('Logged out successfully', 'success');
            setTimeout(() => window.location.href = '/', 800);
        } catch (error) {
            Utils.showToast('Logout failed', 'error');
        } finally {
            Utils.setLoading(btn, false);
        }
    }

    getUserState() {
        return {
            isAuthenticated: !!(this.session && this.session.authenticated),
            isAdmin: !!(this.session && this.session.isAdmin),
            user: this.session
        };
    }
}

window.Navigation = Navigation;

document.addEventListener('DOMContentLoaded', () => {
    const tryInit = () => {
        if (document.querySelector('[data-nav="auth"]')) {
            window.nav = new Navigation();
        } else {
            setTimeout(tryInit, 50);
        }
    };
    tryInit();
});
