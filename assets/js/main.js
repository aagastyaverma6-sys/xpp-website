/* ==========================================================================
 * X++ site — shared behaviour: theme, nav, tabs, copy buttons, code blocks.
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- theme */
  const saved = (() => {
    try { return localStorage.getItem('xpp-theme'); } catch (e) { return null; }
  })();
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);

  window.XPP_setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('xpp-theme', t); } catch (e) { }
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    /* theme toggle buttons */
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', function () {
        const cur = document.documentElement.getAttribute('data-theme');
        window.XPP_setTheme(cur === 'dark' ? 'light' : 'dark');
      });
    });

    /* mobile nav */
    const burger = document.querySelector('[data-nav-burger]');
    const links = document.querySelector('.nav-links');
    if (burger && links) {
      burger.addEventListener('click', function () { links.classList.toggle('open'); });
      links.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') links.classList.remove('open');
      });
    }

    /* tabs */
    document.querySelectorAll('[data-tabs]').forEach((group) => {
      const tabs = group.querySelectorAll('.tab');
      const panels = group.querySelectorAll('.tab-panel');
      tabs.forEach((tab) => {
        tab.addEventListener('click', function () {
          const target = tab.getAttribute('data-tab');
          tabs.forEach((t) => t.classList.toggle('active', t === tab));
          panels.forEach((p) => p.classList.toggle('active', p.id === target));
        });
      });
    });

    /* copy buttons */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-copy]');
      if (!btn) return;
      const sel = btn.getAttribute('data-copy');
      const el = sel === 'self' ? btn : document.querySelector(sel);
      let text = '';
      if (sel === 'self') {
        text = btn.getAttribute('data-copy-text') || '';
      } else if (el) {
        text = el.tagName === 'TEXTAREA' ? el.value : el.textContent;
      }
      const done = function () {
        const prev = btn.textContent;
        btn.textContent = 'copied ✓';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = prev; btn.classList.remove('done'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
      } else { legacyCopy(text); done(); }
    });

    function legacyCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { }
      document.body.removeChild(ta);
    }

    /* activate <pre data-lang="xpp"> code blocks: highlight + chrome */
    document.querySelectorAll('pre[data-lang="xpp"], pre[data-lang="sh"]').forEach((pre) => {
      if (pre.closest('.code-block')) return;                    // already wrapped
      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      const name = pre.getAttribute('data-name') || 'program.xp';
      const runnable = pre.getAttribute('data-open-in-playground') === 'yes';
      pre.parentNode.insertBefore(wrap, pre);

      const head = document.createElement('div');
      head.className = 'cb-head';
      head.innerHTML =
        '<span class="cb-dots"><i></i><i></i><i></i></span>' +
        '<span class="cb-name">' + name + '</span>' +
        '<span class="cb-actions">' +
        (runnable ? '<button class="copy-btn" data-open-pg>▶ playground</button>' : '') +
        '<button class="copy-btn" data-copy-self>copy</button></span>';
      wrap.appendChild(head);

      if (pre.getAttribute('data-lang') === 'xpp' && window.XPPHL) {
        const code = pre.textContent.replace(/\n$/, '');
        pre.innerHTML = window.XPPHL.highlight(code);
      }
      wrap.appendChild(pre);

      const selfBtn = head.querySelector('[data-copy-self]');
      if (selfBtn) {
        selfBtn.setAttribute('data-copy', 'self');
        selfBtn.setAttribute('data-copy-text', pre.textContent);
      }
      const pgBtn = head.querySelector('[data-open-pg]');
      if (pgBtn) {
        pgBtn.addEventListener('click', function () {
          const code = pre.textContent;
          window.open('playground.html#code=' + encodeURIComponentXPP(code), '_self');
        });
      }
    });

    function encodeURIComponentXPP(s) {
      return encodeURIComponent(btoa(unescape(encodeURIComponent(s))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    /* docs: scrollspy for the TOC */
    const tocLinks = document.querySelectorAll('.toc a[href^="#"]');
    if (tocLinks.length && 'IntersectionObserver' in window) {
      const map = {};
      tocLinks.forEach((a) => { map[a.getAttribute('href').slice(1)] = a; });
      const obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            tocLinks.forEach((a) => a.classList.remove('active'));
            const a = map[en.target.id];
            if (a) a.classList.add('active');
          }
        });
      }, { rootMargin: '-84px 0px -70% 0px' });
      document.querySelectorAll('.doc section[id]').forEach((s) => obs.observe(s));
    }

    /* example filter buttons & search */
    const filterBtns = document.querySelectorAll('#ex-filters .tab');
    const searchInput = document.querySelector('#ex-search');
    
    function applyExampleFilter() {
      const activeTab = document.querySelector('#ex-filters .tab.active');
      const filter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const cards = document.querySelectorAll('.example-card');

      cards.forEach((card) => {
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();
        const text = card.textContent.toLowerCase();
        const matchesFilter = (filter === 'all' || tags.includes(filter));
        const matchesQuery = (!q || text.includes(q) || tags.includes(q));
        card.style.display = (matchesFilter && matchesQuery) ? '' : 'none';
      });
    }

    if (filterBtns.length) {
      filterBtns.forEach((btn) => {
        btn.addEventListener('click', function () {
          filterBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          applyExampleFilter();
        });
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', applyExampleFilter);
    }

  });
})();
