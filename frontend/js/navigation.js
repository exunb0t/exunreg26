class Navigation {
    constructor() {
        this.session = null;
        this.init();
    }

    async init() {
        const authContainer = document.querySelector('[data-nav="auth"]');
        if (authContainer && !authContainer.textContent.trim()) {
            authContainer.innerHTML = `<span class="navbar__link navbar__link--loading" aria-hidden="true">…</span>`;
        }
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
        if (!navbar) return;
        let toggleBtn = navbar.querySelector('.navbar__toggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'navbar__toggle';
        }
        toggleBtn.setAttribute('aria-label', 'Toggle navigation');
        toggleBtn.setAttribute('aria-expanded', 'false');
        const svgMenu = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" aria-hidden="true"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g><line x1="5" y1="7" x2="19" y2="7" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line><line x1="5" y1="12" x2="19" y2="12" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line><line x1="5" y1="17" x2="19" y2="17" stroke="#0C0310" stroke-width="2" stroke-linecap="round"></line></g></g></svg>`;
        const svgClose = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        toggleBtn.innerHTML = svgMenu;
        if (!navbar.contains(toggleBtn)) navbar.appendChild(toggleBtn);

        let overlay = document.querySelector('.mobile-menu');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-menu';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <div class="mobile-menu__top">
                    <a href="/" class="mobile-menu__brand" aria-label="Exun Clan home"><img src="/assets/exun.png" alt="Exun Clan" /></a>
                    <button class="mobile-menu__close" aria-label="Close menu">${svgClose}</button>
                </div>
                <nav class="mobile-menu__links" aria-label="Mobile navigation"></nav>
                <div class="mobile-menu__bottom"></div>`;
            document.body.appendChild(overlay);
        }

        const renderMenu = () => {
            const linksBox = overlay.querySelector('.mobile-menu__links');
            const bottom = overlay.querySelector('.mobile-menu__bottom');
            const loggedIn = !!(this.session && this.session.authenticated);
            const isAdmin = !!(this.session && this.session.isAdmin);
            const current = window.location.pathname;
            const links = [
                ['Home', '/'],
                ['Events', '/events'],
                ['Brochure', '/brochure'],
                ['Queries', '/query'],
                ['Schedule', 'https://exun.co/25/schedule', true]
            ];
            if (loggedIn) links.push(['Registration Summary', '/summary']);
            if (isAdmin) links.push(['Admin', '/admin']);
            linksBox.innerHTML = '';
            links.forEach(([label, href, external]) => {
                const a = document.createElement('a');
                a.className = 'mobile-menu__link' + (href === current ? ' mobile-menu__link--active' : '');
                a.textContent = label;
                a.href = href;
                if (external) {
                    a.target = '_blank';
                    a.rel = 'noopener';
                }
                linksBox.appendChild(a);
            });
            bottom.innerHTML = '';
            const cta = document.createElement('button');
            cta.className = 'mobile-menu__cta';
            cta.textContent = loggedIn ? 'Logout' : 'Login';
            cta.addEventListener('click', () => {
                closeMenu();
                if (loggedIn) this.handleLogout();
                else window.location.href = '/login';
            });
            bottom.appendChild(cta);
            const divider = document.createElement('hr');
            divider.className = 'mobile-menu__divider';
            bottom.appendChild(divider);
            const row = document.createElement('div');
            row.className = 'mobile-menu__social-row';
            row.innerHTML = `
                <div class="mobile-menu__socials">
                    <a href="https://www.instagram.com/exunclan" target="_blank" rel="noopener" aria-label="Instagram">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/><path d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z" fill="currentColor"/></svg>
                    </a>
                    <a href="https://x.com/exunclan" target="_blank" rel="noopener" aria-label="X">
                        <svg width="22" height="22" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"/></svg>
                    </a>
                    <a href="https://exun.co/25/whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6.014 8.00613C6.12827 7.1024 7.30277 5.87414 8.23488 6.01043L8.23339 6.00894C9.14051 6.18132 9.85859 7.74261 10.2635 8.44465C10.5504 8.95402 10.3641 9.4701 10.0965 9.68787C9.7355 9.97883 9.17099 10.3803 9.28943 10.7834C9.5 11.5 12 14 13.2296 14.7107C13.695 14.9797 14.0325 14.2702 14.3207 13.9067C14.5301 13.6271 15.0466 13.46 15.5548 13.736C16.3138 14.178 17.0288 14.6917 17.69 15.27C18.0202 15.546 18.0977 15.9539 17.8689 16.385C17.4659 17.1443 16.3003 18.1456 15.4542 17.9421C13.9764 17.5868 8 15.27 6.08033 8.55801C5.97237 8.24048 5.99955 8.12044 6.014 8.00613Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 23C10.7764 23 10.0994 22.8687 9 22.5L6.89443 23.5528C5.56462 24.2177 4 23.2507 4 21.7639V19.5C1.84655 17.492 1 15.1767 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23ZM6 18.6303L5.36395 18.0372C3.69087 16.4772 3 14.7331 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C11.0143 21 10.552 20.911 9.63595 20.6038L8.84847 20.3397L6 21.7639V18.6303Z" fill="currentColor"/></svg>
                    </a>
                </div>
                <a class="mobile-menu__lnexun" href="https://lnexun.com/" target="_blank" rel="noopener">
                    <span>ln(exun)</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>`;
            bottom.appendChild(row);
        };

        const escapeListener = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') closeMenu();
        };
        const openMenu = () => {
            renderMenu();
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', escapeListener);
        };
        const closeMenu = () => {
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', escapeListener);
        };
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (overlay.classList.contains('open')) closeMenu(); else openMenu();
        });
        overlay.querySelector('.mobile-menu__close').addEventListener('click', closeMenu);

        const mql = window.matchMedia('(max-width: 768px)');
        const handleResize = () => {
            const mobile = mql.matches;
            toggleBtn.style.display = mobile ? 'block' : 'none';
            toggleBtn.setAttribute('aria-expanded', 'false');
            if (!mobile && overlay.classList.contains('open')) closeMenu();
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
            setTimeout(() => window.location.reload(), 800);
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
