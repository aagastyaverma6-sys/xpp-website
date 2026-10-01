/* ==========================================================================
 * X++ feedback form — POSTs to /api/feedback (Vercel serverless function).
 * Falls back to a mailto: link if the API is not configured.
 * ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    const nameEl = document.getElementById('f-name');
    const emailEl = document.getElementById('f-email');
    const typeEl = document.getElementById('f-type');
    const msgEl = document.getElementById('f-message');
    const hpEl = document.getElementById('f-company');
    const countEl = document.getElementById('f-count');
    const submitBtn = document.getElementById('f-submit');
    const box = document.getElementById('f-result');
    const consentEl = document.getElementById('f-consent');

    msgEl.addEventListener('input', function () {
      countEl.textContent = msgEl.value.length + ' / 3000';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const type = typeEl.value;
      const message = msgEl.value.trim();

      box.innerHTML = '';
      box.className = '';

      if (hpEl.value) return;                                   // honeypot: silently drop bots
      if (!message) {
        show('Please write a message before sending.', 'bad');
        msgEl.focus();
        return;
      }
      if (message.length > 3000) {
        show('Message is too long (max 3000 characters).', 'bad');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        show('That email address does not look right — please check it.', 'bad');
        emailEl.focus();
        return;
      }
      if (consentEl && !consentEl.checked) {
        show('Please tick the box so I know you are OK being contacted back.', 'bad');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          type: type,
          message: message,
          company: hpEl.value,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (r) {
          if (r.ok && r.data.sent) {
            form.reset();
            countEl.textContent = '0 / 3000';
            show('✓ Sent! Your feedback landed in the X++ inbox — thank you. '
              + (r.data.via ? '(delivered via ' + r.data.via + ')' : ''), 'ok');
          } else if (r.data && r.data.fallback === 'mailto') {
            show('The email backend is not configured on this deployment yet — '
              + 'you can send your feedback directly from your mail app instead. '
              + 'See the fallback panel below.', 'warn');
            showFallback(name, email, type, message);
          } else {
            show('Something went wrong: ' + ((r.data && r.data.error) || 'please try again in a moment.'), 'bad');
          }
        })
        .catch(function () {
          show('Network error — could not reach the server. Please try again, or use the direct email below.', 'bad');
          showFallback(name, email, type, message);
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.getAttribute('data-label') || 'Send feedback';
        });
    });

    function show(text, kind) {
      box.className = 'alert ' + kind;
      box.textContent = text;
      if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showFallback(name, email, type, message) {
      const fb = document.getElementById('f-mailto');
      if (!fb) return;
      const subject = '[X++ ' + type + '] ' + (name ? 'from ' + name : 'website feedback');
      const body = message + (email ? '\n\nReply-to: ' + email : '') + '\n\n— sent from the X++ website feedback form';
      const href = 'mailto:aagastyaverma6@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      fb.href = href;
      fb.style.display = 'inline-flex';
    }
  });
})();
