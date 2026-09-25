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

  function ticketStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 'ticket-status--resolved';
    if (s === 'replied' || s === 'answered') return 'ticket-status--replied';
    return 'ticket-status--open';
  }

  function ticketDisplayId(id) {
    return `#Ex-${1000 + Number(id || 0)}`;
  }

  function ticketDateTime(iso) {
    try {
      const s = String(iso || '').trim();
      if (!s) return '';
      const d = s.includes('T') ? new Date(s) : new Date(s.replace(' ', 'T') + 'Z');
      if (Number.isNaN(d.getTime())) return '';
      const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${date}, ${time}`;
    } catch (e) {
      return '';
    }
  }

  function ticketDate(iso) {
    try {
      const s = String(iso || '').trim();
      if (!s) return '';
      const d = s.includes('T') ? new Date(s) : new Date(s.replace(' ', 'T') + 'Z');
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
    const rawStatus = String(t.status || 'open');
    status.textContent = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
    top.appendChild(idChip);
    top.appendChild(status);
    card.appendChild(top);
    const title = document.createElement('h4');
    title.className = 'ticket-card__title';
    title.textContent = t.subject || 'Untitled';
    card.appendChild(title);
    const replies = Array.isArray(t.replies) ? t.replies : [];
    const facts = [
      t.category ? ['category', 'Category', t.category] : null,
      t.priority ? ['flag', 'Priority', t.priority] : null,
      ticketDate(t.createdAt) ? ['calendar_month', 'Opened', ticketDate(t.createdAt)] : null,
      replies.length > 0 ? ['forum', 'Replies', String(replies.length)] : null,
    ].filter(Boolean);
    if (facts.length > 0) {
      const dl = document.createElement('dl');
      dl.className = 'ticket-facts';
      facts.forEach(([glyph, k, v]) => {
        const row = document.createElement('div');
        row.className = 'ticket-fact';
        const dt = document.createElement('dt');
        dt.innerHTML = Utils.icon(glyph, 16);
        dt.appendChild(document.createTextNode(k));
        const dd = document.createElement('dd');
        dd.textContent = v;
        row.appendChild(dt);
        row.appendChild(dd);
        dl.appendChild(row);
      });
      card.appendChild(dl);
    }
    const msg = document.createElement('p');
    msg.className = 'ticket-card__message';
    msg.textContent = t.message || '';
    card.appendChild(msg);
    if (replies.length > 0) {
      const ordered = [...replies].reverse();
      const collapsed = ordered.length > 2;
      ordered.forEach((r) => {
        const reply = document.createElement('div');
        reply.className = 'ticket-card__reply';
        if (collapsed) reply.hidden = true;
        const label = document.createElement('div');
        label.className = 'ticket-card__reply-label';
        const who = document.createElement('span');
        who.className = 'ticket-card__reply-who';
        who.innerHTML = Utils.icon('support_agent', 16);
        who.appendChild(document.createTextNode('Support team'));
        label.appendChild(who);
        const when = r.createdAt ? ticketDateTime(r.createdAt) : '';
        if (when) {
          const date = document.createElement('span');
          date.className = 'ticket-card__reply-date';
          date.textContent = when;
          label.appendChild(date);
        }
        const body = document.createElement('div');
        body.className = 'md-body';
        body.innerHTML = Utils.renderMarkdown(r.message || '');
        reply.appendChild(label);
        reply.appendChild(body);
        card.appendChild(reply);
      });
      const shown = card.querySelectorAll('.ticket-card__reply');
      if (shown.length > 0) shown[0].hidden = false;
      if (collapsed) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ticket-thread-toggle';
        const hidden = ordered.length - 1;
        const moreText = `Show ${hidden} earlier ${hidden === 1 ? 'reply' : 'replies'}`;
        let expanded = false;
        toggle.textContent = moreText;
        toggle.addEventListener('click', () => {
          expanded = !expanded;
          shown.forEach((el, idx) => { el.hidden = !expanded && idx > 0; });
          toggle.textContent = expanded ? 'Show less' : moreText;
        });
        card.appendChild(toggle);
      }
    } else if (t.adminReply) {
      const reply = document.createElement('div');
      reply.className = 'ticket-card__reply';
      const label = document.createElement('div');
      label.className = 'ticket-card__reply-label';
      const who = document.createElement('span');
      who.className = 'ticket-card__reply-who';
      who.innerHTML = Utils.icon('support_agent', 16);
      who.appendChild(document.createTextNode('Support team'));
      label.appendChild(who);
      const body = document.createElement('div');
      body.className = 'md-body';
      body.innerHTML = Utils.renderMarkdown(t.adminReply);
      reply.appendChild(label);
      reply.appendChild(body);
      card.appendChild(reply);
    } else {
      const empty = document.createElement('p');
      empty.className = 'ticket-card__noreply';
      empty.textContent = 'No replies yet. You\'ll get an email when we respond to your query.';
      card.appendChild(empty);
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
    if (!session.authenticated) {
      const prompt = document.createElement('p');
      prompt.className = 'ticket-card__noreply';
      const link = document.createElement('a');
      link.href = '/login';
      link.textContent = 'Log in to view your tickets';
      prompt.appendChild(link);
      box.innerHTML = '';
      box.appendChild(prompt);
      section.style.display = '';
      return;
    }
    try {
      const resp = await window.ExunServices.query.mine();
      const list = (resp && resp.data) || [];
      if (list.length === 0) return;
      box.innerHTML = '';
      list.forEach((t) => box.appendChild(renderTicket(t)));
      section.style.display = '';
      if (window.location.pathname.endsWith('/tickets') || window.location.hash === '#tickets-section') {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.location.hash === '#tickets-section') {
          window.history.replaceState(null, '', '/query/tickets');
        }
      }
    } catch (e) {}
  }

  loadMyTickets();

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const message = (input.value || '').trim();
      if (!message) return;
      input.value = '';
      if (window.ExunChat && typeof window.ExunChat.ask === 'function') {
        window.ExunChat.ask(message);
      } else {
        Utils.showToast('Chat is still loading, please try again', 'info');
      }
    });
  }
});
