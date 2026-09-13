document.addEventListener('DOMContentLoaded', function () {
  (async function loadFAQ() {
    try {
      const resp = await fetch('/data/faq.json');
      if (!resp.ok) return;
      const j = await resp.json();
      const container = document.getElementById('faqContainer');
      if (!container || !j || !j.faq) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'faq-wrapper';
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      j.faq.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'faq-item' + (idx === 0 ? ' faq-item--open' : '');
        const btn = document.createElement('button');
        btn.className = 'faq-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-expanded', idx === 0 ? 'true' : 'false');
        const q = document.createElement('span');
        q.className = 'faq-question';
        q.textContent = item.question || '';
        const icon = document.createElement('span');
        icon.className = 'faq-icon';
        icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
        btn.appendChild(q);
        btn.appendChild(icon);
        const body = document.createElement('div');
        body.className = 'faq-answer-wrap';
        const qa = document.createElement('p');
        qa.className = 'faq-answer';
        qa.innerHTML = esc(item.answer).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        body.appendChild(qa);
        btn.addEventListener('click', () => {
          const willOpen = !card.classList.contains('faq-item--open');
          wrapper.querySelectorAll('.faq-item--open').forEach((other) => {
            other.classList.remove('faq-item--open');
            const otherBtn = other.querySelector('.faq-toggle');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          });
          if (willOpen) {
            card.classList.add('faq-item--open');
            btn.setAttribute('aria-expanded', 'true');
          } else {
            btn.setAttribute('aria-expanded', 'false');
          }
        });
        card.appendChild(btn);
        card.appendChild(body);
        wrapper.appendChild(card);
      });
      container.appendChild(wrapper);
    } catch (e) {}
  })();

  const form = document.getElementById('query-form');
  const input = document.getElementById('query-input');
  const results = document.getElementById('results');

  function ticketStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 'ticket-status--resolved';
    if (s === 'replied' || s === 'answered') return 'ticket-status--replied';
    return 'ticket-status--open';
  }

  function ticketDisplayId(id) {
    return `#Ex-${1000 + Number(id || 0)}`;
  }

  function ticketDate(iso) {
    try {
      const d = new Date(String(iso || '').trim().replace(' ', 'T') + 'Z');
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function renderTicket(t) {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    const top = document.createElement('div');
    top.className = 'ticket-card__top';
    const idChip = document.createElement('span');
    idChip.className = 'ticket-card__id';
    idChip.textContent = ticketDisplayId(t.id);
    const status = document.createElement('span');
    status.className = 'ticket-status ' + ticketStatusClass(t.status);
    status.textContent = String(t.status || 'open').toUpperCase();
    top.appendChild(idChip);
    top.appendChild(status);
    card.appendChild(top);
    const title = document.createElement('h4');
    title.className = 'ticket-card__title';
    title.textContent = t.subject || 'Untitled';
    card.appendChild(title);
    const metaBits = [t.category, t.priority ? `Priority: ${t.priority}` : '', ticketDate(t.createdAt)].filter(Boolean);
    if (metaBits.length) {
      const meta = document.createElement('p');
      meta.className = 'ticket-card__meta';
      meta.textContent = metaBits.join(' · ');
      card.appendChild(meta);
    }
    const msg = document.createElement('p');
    msg.className = 'ticket-card__message';
    msg.textContent = t.message || '';
    card.appendChild(msg);
    if (t.adminReply) {
      const reply = document.createElement('div');
      reply.className = 'ticket-card__reply';
      const label = document.createElement('div');
      label.className = 'ticket-card__reply-label';
      label.textContent = 'Admin reply' + (t.repliedBy ? ' · ' + t.repliedBy : '');
      const body = document.createElement('div');
      body.className = 'md-body';
      body.innerHTML = Utils.renderMarkdown(t.adminReply);
      reply.appendChild(label);
      reply.appendChild(body);
      card.appendChild(reply);
    }
    return card;
  }

  async function loadMyTickets() {
    const section = document.getElementById('tickets-section');
    const box = document.getElementById('tickets-container');
    if (!section || !box) return;
    let session = { authenticated: false };
    try {
      session = await window.ExunServices.api.getSession();
    } catch (e) {}
    if (!session.authenticated) return;
    try {
      const resp = await window.ExunServices.query.mine();
      const list = (resp && resp.data) || [];
      if (list.length === 0) return;
      box.innerHTML = '';
      list.forEach((t) => box.appendChild(renderTicket(t)));
      section.style.display = '';
    } catch (e) {}
  }

  loadMyTickets();

  function addResult(subject, message, status) {
    if (!results) return;
    const placeholder = results.querySelector('.text-muted');
    if (placeholder) placeholder.remove();
    const container = document.createElement('div');
    container.className = 'answer-card';
    const qElem = document.createElement('div');
    qElem.className = 'answer-query';
    qElem.textContent = subject;
    const aElem = document.createElement('div');
    aElem.className = 'answer-body';
    aElem.textContent = status === 'sent' ? `Ticket submitted: ${message}` : message;
    container.appendChild(qElem);
    container.appendChild(aElem);
    results.prepend(container);
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const message = (input.value || '').trim();
      const subject = (message.slice(0, 80) || 'Support query').trim();
      if (!message) return;
      const session = await window.ExunServices.api.getSession().catch(() => ({ authenticated: false }));
      if (!session.authenticated) {
        Utils.showToast('Please login to submit a query', 'error');
        window.location.href = '/login';
        return;
      }
      try {
        await window.ExunServices.query.submit(subject, message);
        addResult(subject, message, 'sent');
        Utils.showToast('Query submitted successfully', 'success');
        input.value = '';
  loadMyTickets().then(() => {
    if (window.location.hash === '#tickets-section') {
      const section = document.getElementById('tickets-section');
      if (section && section.style.display !== 'none') {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
      } catch (err) {
        Utils.showToast((err && err.message) || 'Failed to submit query', 'error');
      }
    });
  }
});
