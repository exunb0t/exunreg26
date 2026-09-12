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
      } catch (err) {
        Utils.showToast((err && err.message) || 'Failed to submit query', 'error');
      }
    });
  }
});
