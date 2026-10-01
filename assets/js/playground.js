/* ==========================================================================
 * X++ playground — in-browser editor + runner (interpreter: xpp-interpreter.js)
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------ utilities */

  function b64urlEncode(s) {
    const b64 = btoa(unescape(encodeURIComponent(s)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return decodeURIComponent(escape(atob(t)));
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* -------------------------------------------------------------- examples */

  const EXAMPLES = {
    hello: {
      label: 'Hello, X++',
      code: 'RNM=ZITR\n\n# Your first X++ program\nout "Hello from X++ v0.4.1!"\nout "Programming for everyone."\n',
      input: '',
    },
    fib: {
      label: 'Fibonacci (recursive)',
      code: 'RNM=ZITR\n\nfn fib(n):\n  if n <= 1:\n    return n\n  end\n  return fib(n-1) + fib(n-2)\nend\n\nloop i from 0 to 10:\n  out i, fib(i)\nend\n',
      input: '',
    },
    fib_fast: {
      label: 'Fibonacci (iterative)',
      code: 'RNM=ZITR\n\nfn fib_fast(n):\n  a = 0\n  b = 1\n  if n == 0:\n    return 0\n  end\n  if n == 1:\n    return 1\n  end\n  loop i from 2 to n:\n    c = a + b\n    a = b\n    b = c\n  end\n  return b\nend\n\nout fib_fast(30)\n',
      input: '',
    },
    fizzbuzz: {
      label: 'FizzBuzz',
      code: 'RNM=ZITR\n\nloop n from 1 to 15:\n  if n % 15 == 0:\n    out "FizzBuzz"\n  elif n % 3 == 0:\n    out "Fizz"\n  elif n % 5 == 0:\n    out "Buzz"\n  else:\n    out n\n  end\nend\n',
      input: '',
    },
    primes: {
      label: 'Prime sieve',
      code: 'RNM=ZITR\n\n# Sieve of Eratosthenes up to 50\nlimit = 50\nis_prime = []\nloop i from 0 to limit:\n  push true to is_prime\nend\nis_prime[0] = false\nis_prime[1] = false\n\nloop n from 2 to limit:\n  if is_prime[n]:\n    m = n * n\n    while m <= limit:\n      is_prime[m] = false\n      m = m + n\n    end\n  end\nend\n\ncount = 0\nloop n from 2 to limit:\n  if is_prime[n]:\n    out n\n    count = count + 1\n  end\nend\nout "primes found:", count\n',
      input: '',
    },
    collections: {
      label: 'Lists & dicts',
      code: 'RNM=ZITR\n\nnums = [1, 2, 3]\npush 4 to nums\nout "list:", nums\nout "len:", len(nums), "sum:", sum(nums)\n\nuser = {"name": "Aagastya", "lang": "X++"}\nuser.version = "0.4.1"\nout user\nout "keys:", keys(user)\nloop k in keys(user):\n  out " ", k, "=", user[k]\nend\n\nwords = ["xpp", "is", "fast", "xpp", "is", "easy"]\ncounts = {}\nloop w in words:\n  if contains(counts, w):\n    counts[w] = counts[w] + 1\n  else:\n    counts[w] = 1\n  end\nend\nout counts\n',
      input: '',
    },
    errors: {
      label: 'safe / fail — error handling',
      code: 'RNM=ZITR\n\nsafe:\n  x = 1 / 0\n  out "never reached"\nfail e:\n  out "caught:", e\nend\n\nfn risky(n):\n  if n < 0:\n    return 0 - n\n  end\n  return 1 / n\nend\n\nloop n in [4, 0, -7]:\n  safe:\n    out "risky(" + str(n) + ") =", risky(n)\n  fail e:\n    out "risky(" + str(n) + ") failed:", e\n  end\nend\n',
      input: '',
    },
    input: {
      label: 'Reading input (in)',
      code: 'RNM=ZITR\n\n# `in` reads one line from the Input box (bottom right)\nname = in "What is your name? "\nout "Hello,", name, "!"\n\nn = int(in "Give me a number: ")\nif n % 2 == 0:\n  out n, "is even"\nelse:\n  out n, "is odd"\nend\n',
      input: 'Aagastya\n42\n',
    },
    strings: {
      label: 'Strings & builtins',
      code: 'RNM=ZITR\n\ns = "X++ makes pseudocode real"\nout "len:", len(s)\nout "first:", s[0], "last:", s[-1]\nout "upper? no builtin — but slicing lists works:", sorted([5, 3, 9, 1])\nout "repeat:", "x" + "p" * 3\nout "contains:", contains(s, "pseudocode")\n\nloop word in ["write", "pseudocode", "ship", "it"]:\n  out word\nend\n',
      input: '',
    },
    bench: {
      label: 'Benchmark loop (web VM)',
      code: 'RNM=ZITR\n\n# The native ZJIT engine does this ~100x faster.\ntotal = 0\nloop i from 1 to 1000000:\n  total = total + i\nend\nout "sum 1..1000000 =", total\nout "elapsed:", clock()\n',
      input: '',
    },
    guess: {
      label: 'Number guessing game',
      code: 'RNM=ZITR\n\n# Guess the secret number — type guesses in the Input box\nsecret = 37\ntries = 0\n\nwhile true:\n  g = int(in "Your guess (1-100): ")\n  tries = tries + 1\n  if g == secret:\n    out "Correct! You got it in", tries, "tries."\n    break\n  elif g < secret:\n    out "Too low!"\n  else:\n    out "Too high!"\n  end\nend\n',
      input: '50\n25\n37\n',
    },
  };

  /* ---------------------------------------------------------------- setup */

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.XPP) return;

    const $ = (s) => document.querySelector(s);
    const editor = $('#xpp-editor');
    const highlight = $('#xpp-highlight');
    const gutter = $('#xpp-gutter');
    const output = $('#xpp-output');
    const inputBox = $('#xpp-input');
    const runBtn = $('#pg-run');
    const shareBtn = $('#pg-share');
    const resetBtn = $('#pg-reset');
    const clearBtn = $('#pg-clear');
    const sel = $('#pg-example');
    const status = $('#pg-status');
    const statusLed = $('#pg-status-led');
    const statusText = $('#pg-status-text');
    const statusMs = $('#pg-status-ms');

    /* ---------------------------------------------------- state restore */

    let suppressSave = false;
    try {
      const savedCode = localStorage.getItem('xpp-pg-code');
      const savedIn = localStorage.getItem('xpp-pg-input');
      if (savedCode !== null) editor.value = savedCode;
      else editor.value = EXAMPLES.fib.code;
      if (savedIn !== null) inputBox.value = savedIn;
    } catch (e) {
      editor.value = EXAMPLES.fib.code;
    }

    // deep link: #code=<base64url>
    const applyHash = function () {
      const m = location.hash.match(/^#code=([A-Za-z0-9\-_]+)/);
      if (!m) return;
      try {
        editor.value = b64urlDecode(m[1]);
        suppressSave = true;                 // don't persist deep-linked code
      } catch (e) { }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);

    /* ----------------------------------------------------- example picker */

    Object.keys(EXAMPLES).forEach(function (key) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = EXAMPLES[key].label;
      sel.appendChild(o);
    });
    const initialOption = document.createElement('option');
    initialOption.value = '';
    initialOption.textContent = 'Examples…';
    sel.insertBefore(initialOption, sel.firstChild);
    sel.value = '';

    sel.addEventListener('change', function () {
      if (!sel.value) return;
      const ex = EXAMPLES[sel.value];
      editor.value = ex.code;
      inputBox.value = ex.input || '';
      sel.value = '';
      render();
      saveState();
      runCode();
    });

    /* --------------------------------------------------------- the editor */

    function render() {
      const code = editor.value;
      if (window.XPPHL) highlight.innerHTML = window.XPPHL.highlight(code) + '\n';
      const lines = code.split('\n').length;
      let g = '';
      for (let i = 1; i <= lines; i++) g += i + '\n';
      gutter.textContent = g;
    }

    function syncScroll() {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
      gutter.scrollTop = editor.scrollTop;
    }

    editor.addEventListener('input', function () { render(); saveState(); });
    editor.addEventListener('scroll', syncScroll);
    editor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart, t = editor.selectionEnd;
        editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(t);
        editor.selectionStart = editor.selectionEnd = s + 2;
        render(); saveState();
      } else if (e.key === 'Enter') {
        // auto-indent (extra indent after a block opener)
        const s = editor.selectionStart;
        const lineStart = editor.value.lastIndexOf('\n', s - 1) + 1;
        const curLine = editor.value.slice(lineStart, s);
        let indent = (curLine.match(/^ */) || [''])[0];
        if (/:\s*$/.test(curLine.trimEnd())) indent += '  ';
        if (indent) {
          e.preventDefault();
          const ins = '\n' + indent;
          editor.value = editor.value.slice(0, s) + ins + editor.value.slice(editor.selectionEnd);
          editor.selectionStart = editor.selectionEnd = s + ins.length;
          render(); saveState();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
        e.preventDefault();
        runCode();
      }
    });
    editor.addEventListener('paste', function () { setTimeout(render, 0); });

    /* ------------------------------------------------------------ running */

    let runToken = 0;
    function runCode() {
      const token = ++runToken;
      const code = editor.value;
      const input = inputBox.value;

      setStatus('running', 'running…', '');
      output.innerHTML = '<span class="o-dim">…</span>';

      // let the browser paint the running state before we block the thread
      requestAnimationFrame(function () {
        setTimeout(function () {
          if (token !== runToken) return;
          const t0 = performance.now();
          let r;
          try {
            r = window.XPP.run(code, { input: input, timeoutMs: 8000, maxOps: 300000000 });
          } catch (e) {
            r = { exitCode: 1, stdout: '', stderr: 'X++ [ZITR] error: internal: ' + e.message, ms: 0 };
          }
          const ms = Math.max(1, Math.round(performance.now() - t0));

          const html = [];
          if (r.stdout) html.push(escapeHtml(r.stdout));
          if (r.stderr) html.push('<span class="o-err">' + escapeHtml(r.stderr.trim()) + '</span>');
          if (!r.stdout && !r.stderr) html.push('<span class="o-dim">(no output)</span>');
          output.innerHTML = html.join('\n');

          if (r.exitCode === 0) setStatus('ok', 'exited 0', ms + ' ms');
          else setStatus('err', 'exited ' + r.exitCode, ms + ' ms');
        }, 30);
      });
    }

    function setStatus(cls, text, ms) {
      status.className = 'pg-status ' + cls;
      statusText.textContent = text;
      statusMs.textContent = ms;
    }

    runBtn.addEventListener('click', runCode);

    /* ---------------------------------------------------------- share/url */

    shareBtn.addEventListener('click', function () {
      const url = location.origin + location.pathname + '#code=' + b64urlEncode(editor.value);
      try {
        history.replaceState(null, '', '#code=' + b64urlEncode(editor.value));
      } catch (e) { }
      const done = function () {
        const prev = shareBtn.textContent;
        shareBtn.textContent = 'link copied ✓';
        setTimeout(function () { shareBtn.textContent = prev; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          prompt('Copy this link:', url);
        });
      } else {
        prompt('Copy this link:', url);
      }
    });

    resetBtn.addEventListener('click', function () {
      editor.value = EXAMPLES.fib.code;
      inputBox.value = '';
      render();
      saveState();
    });

    clearBtn.addEventListener('click', function () {
      output.innerHTML = '<span class="o-dim">(cleared)</span>';
      setStatus('', 'idle', '');
    });

    function saveState() {
      if (suppressSave) return;
      try {
        localStorage.setItem('xpp-pg-code', editor.value);
        localStorage.setItem('xpp-pg-input', inputBox.value);
      } catch (e) { }
    }
    inputBox.addEventListener('input', saveState);

    /* -------------------------------------------------------------- boot */

    render();
    setStatus('', 'idle — press Run or Ctrl/Cmd + Enter', '');
    editor.focus();
  });
})();
