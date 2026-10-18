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
    '001_mathx_basics': {
      label: 'mathX Core Operations [XITR]',
      code: 'RNM = XITR
use mathX

out "=== mathX Basics ==="
val = mathX.sqrt(256)
out "sqrt(256) =", val

hypot = mathX.sqrt(mathX.pow(3, 2) + mathX.pow(4, 2))
out "hypotenuse 3-4-5 =", hypot

out "pi =", mathX.pi
out "e  =", mathX.e
out "log(e) =", mathX.log(mathX.e)
',
      input: '',
    },
    '005_xnum_vector_math': {
      label: 'Xnum Vector Operations [XITR]',
      code: 'RNM = XITR
use Xnum

v1 = [1.0, 2.0, 3.0]
v2 = [4.0, 5.0, 6.0]

dp = Xnum.dot(v1, v2)
out "Dot Product v1 . v2 =", dp

n1 = Xnum.norm(v1)
out "Norm of v1 =", n1

cp = Xnum.cross(v1, v2)
out "Cross Product v1 x v2 =", cp
',
      input: '',
    },
    '008_xlin_determinants': {
      label: 'Xlin Matrix Determinants [ZITR]',
      code: 'RNM = ZITR
use Xlin

m2 = [[4, 7], [2, 6]]
det2 = Xlin.det(m2)
out "Det 2x2 [[4,7],[2,6]] =", det2

m3 = [[1, 2, 3], [0, 1, 4], [5, 6, 0]]
det3 = Xlin.det(m3)
out "Det 3x3 =", det3
tr = Xlin.trace(m3)
out "Trace 3x3 =", tr
',
      input: '',
    },
    '011_xcas_symbolic_diff': {
      label: 'XCAS Symbolic Differentiation [XITR]',
      code: 'RNM = XITR
use XCAS

expr1 = "x^3 + 4*x^2 - 5*x + 7"
d1 = XCAS.diff(expr1, "x")
out "d/dx (" + expr1 + ") ="
out "  ->", d1

expr2 = "sin(x) + cos(x)"
d2 = XCAS.diff(expr2, "x")
out "d/dx (" + expr2 + ") ="
out "  ->", d2
',
      input: '',
    },
    '014_xcalculus_derivative': {
      label: 'XCalculus Numerical Derivatives [XCOM]',
      code: 'RNM = XCOM
use XCalculus

fn f(x):
  return x * x * x
end

df = XCalculus.derivative(f, 2.0)
out "f(x) = x^3 at x=2"
out "f\'(2)  approx =", df
out "Exact is 3*2^2 = 12.0"
',
      input: '',
    },
    '018_xsci_numerical_quad': {
      label: 'Xsci Quadrature Integration [XITR]',
      code: 'RNM = XITR
use Xsci

fn integrand(x):
  return x * x + 2.0 * x
end

res = Xsci.quad(integrand, 0.0, 2.0)
out "=== Xsci Adaptive Quad ==="
out "Integral value:", res["value"]
out "Estimated err :", res["error"]
',
      input: '',
    },
    '022_xplotlib_ascii_graph': {
      label: 'Xplotlib Terminal ASCII Graph [ZITR]',
      code: 'RNM = ZITR
use Xplotlib

data = [1.0, 4.0, 9.0, 16.0, 25.0, 16.0, 9.0, 4.0, 1.0]
out "=== Xplotlib Terminal Graph ==="
chart = Xplotlib.render_ascii(data, 20, 8)
out chart
',
      input: '',
    },
    '026_math_physics_projectile': {
      label: 'Combo: Projectile Simulation [ZITR]',
      code: 'RNM = ZITR
use mathX
use Xnum

v0 = 50.0
angle = 45.0 * (mathX.pi / 180.0)
g = 9.81

t_flight = (2.0 * v0 * mathX.sin(angle)) / g
r_max = (v0 * v0 * mathX.sin(2.0 * angle)) / g
h_max = (v0 * v0 * mathX.pow(mathX.sin(angle), 2)) / (2.0 * g)

out "=== Ballistic Projectile Simulation ==="
out "Initial Velocity :", v0, "m/s"
out "Launch Angle     : 45 degrees"
out "Time of Flight   :", t_flight, "s"
out "Maximum Range    :", r_max, "m"
out "Peak Height      :", h_max, "m"
',
      input: '',
    },
    '030_scrapex_html_parse': {
      label: 'ScrapeX HTML Parsing [XITR]',
      code: 'RNM = XITR
use ScrapeX

html = "<html><body><h1>Welcome to X++</h1><p class=\'intro\'>The future of coding.</p></body></html>"
doc = ScrapeX.parse(html)
out "Parsed HTML Document:", doc["tag"]

h1_node = ScrapeX.select_one(doc, "h1")
out "H1 Heading:", ScrapeX.get_text(h1_node)

p_node = ScrapeX.select_one(doc, "p.intro")
out "Intro Paragraph:", ScrapeX.get_text(p_node)
',
      input: '',
    },
    '033_xweb_simple_page': {
      label: 'XWeb HTML5 Page Generator [ZITR]',
      code: 'RNM = ZITR
use XWeb

title = "My X++ Web App"
body = "<h1>Hello from X++</h1><p>Running under standard RNM.</p>"
page = XWeb.page(title, body)
out "=== Generated HTML Document ==="
out page
',
      input: '',
    },
    '046_graphix_primitives': {
      label: 'GraphiX 2D Primitives [ZITR]',
      code: 'RNM = ZITR
use GraphiX

c = GraphiX.create_canvas(800, 600)
GraphiX.circle(c, 400, 300, 50, "#ff4444")
GraphiX.rect(c, 50, 50, 200, 100, "#3388ff")
GraphiX.line(c, 0, 0, 800, 600, "#ffffff")

out "Canvas Objects Drawn:", len(c["elements"])
out "Canvas Dimensions   :", c["width"], "x", c["height"]
',
      input: '',
    },
    '052_terminx_colors_styles': {
      label: 'TerminX ANSI Color Palette [ZITR]',
      code: 'RNM = ZITR
use TerminX

out TerminX.bold("=== TerminX Styling Suite ===")
out TerminX.green("[SUCCESS]") + " Pipeline initialized"
out TerminX.yellow("[WARNING]") + " Memory threshold at 80%"
out TerminX.red("[ERROR]  ") + " Connection dropped"
out TerminX.blue("[INFO]   ") + " Running under ZITR native engine"
',
      input: '',
    },
    '057_gamex_sprite_2d_png': {
      label: 'GameX 2D Sprite Loader [ZITR]',
      code: 'RNM = ZITR
use GameX

supported = GameX.formats()["2d"]
out "Supported 2D Formats Count:", len(supported)

sprite = GameX.load_sprite("player_walk.aseprite", "ASEPRITE")
out "Loaded Sprite:", sprite["name"]
out "Sprite Format:", sprite["format"]
',
      input: '',
    },
    '062_xanmin8_mobjects': {
      label: 'Xanmin8 Mathematical Objects [ZITR]',
      code: 'RNM = ZITR
use Xanmin8

c = Xanmin8.Circle(2.5, "#ff3366")
s = Xanmin8.Square(4.0, "#33ccff")
txt = Xanmin8.MathTex("e^{i\pi} + 1 = 0")

out "Created Circle  : radius =", c["radius"]
out "Created Square  : side   =", s["side"]
out "Created MathTex : formula=", txt["tex"]
',
      input: '',
    },
    '068_os_env_and_paths': {
      label: 'os Environment & Current Directory [ZITR]',
      code: 'RNM = ZITR
use os

cwd = os.getcwd()
out "Current Directory:", cwd
out "OS Platform Name :", os.name

user = os.getenv("USER")
out "Current User env :", user
',
      input: '',
    },
    '073_time_benchmarking': {
      label: 'time Microsecond Precision Profiler [ZITR]',
      code: 'RNM = ZITR
use time

t0 = time.perf_counter()
total = 0
loop i from 0 to 10000:
  total = total + i
end
t1 = time.perf_counter()

elapsed = t1 - t0
out "Computed Sum :", total
out "Elapsed Time :", elapsed, "seconds"
',
      input: '',
    },
    '075_random_distributions': {
      label: 'random Sampling & Shuffling [ZITR]',
      code: 'RNM = ZITR
use random

dice = random.randint(1, 6)
out "Dice Roll 1-6:", dice

val = random.uniform(10.0, 20.0)
out "Uniform Float in [10, 20]:", val

items = ["alpha", "beta", "gamma", "delta"]
choice = random.choice(items)
out "Random selection:", choice
',
      input: '',
    },
    '076_json_serialization': {
      label: 'json Nested Object Serialization [XCOM]',
      code: 'RNM = XCOM
use json

cfg = {
  "app": "XPP",
  "version": "0.4.5",
  "engines": ["ZITR", "ZCOM", "ZJIT", "XCOM", "XITR"],
  "active": True
}

s = json.dumps(cfg)
out "Serialized JSON:"
out s

parsed = json.loads(s)
out "Parsed back app name:", parsed["app"]
',
      input: '',
    },
    '079_collections_counter': {
      label: 'collections Counter Frequencies [ZITR]',
      code: 'RNM = ZITR
use collections

words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
cnt = collections.Counter(words)
out "=== Frequency Counter ==="
out "Frequencies:", cnt
out "Most Common:", cnt.most_common(1)
',
      input: '',
    },
    '086_sqlite3_create_table': {
      label: 'sqlite3 In-Memory Table Creation [ZITR]',
      code: 'RNM = ZITR
use sqlite3

conn = sqlite3.connect(":memory:")
sqlite3.execute(conn, "CREATE TABLE logs (id INT, message TEXT);")
sqlite3.execute(conn, "INSERT INTO logs VALUES (1, \'System started\');")
sqlite3.execute(conn, "INSERT INTO logs VALUES (2, \'All tests passed\');")

cur = sqlite3.execute(conn, "SELECT * FROM logs;")
rows = sqlite3.fetchall(cur)
out "=== SQLite Records ==="
loop r in rows:
  out "Log Entry:", r
end
',
      input: '',
    },
    '098_safe_fail_recovery': {
      label: 'Safe/Fail Error Resilience [ZITR]',
      code: 'RNM = ZITR

out "=== Safe / Fail Resilience ==="
safe:
  out "Attempting dangerous division:"
  denom = 0
  val = 100 / denom
  out "Never reaches here"
fail err:
  out "Caught handled error successfully!"
end
out "Program recovered and continues normally"
',
      input: '',
    },
    '100_matrix_neural_layer': {
      label: 'Combo: Neural Network Forward Layer [XITR]',
      code: 'RNM = XITR
use Xnum
use mathX

fn sigmoid(x):
  return 1.0 / (1.0 + mathX.exp(-x))
end

inputs = [0.5, 0.8]
weights = [[0.2, 0.4], [0.7, 0.1]]
bias = [0.1, -0.2]

# Compute z = W * x + b
z1 = (weights[0][0] * inputs[0]) + (weights[0][1] * inputs[1]) + bias[0]
z2 = (weights[1][0] * inputs[0]) + (weights[1][1] * inputs[1]) + bias[1]

a1 = sigmoid(z1)
a2 = sigmoid(z2)

out "=== Neural Layer Activation ==="
out "Layer Inputs   :", inputs
out "Neuron 1 Output:", a1
out "Neuron 2 Output:", a2
',
      input: '',
    },
    '110_full_stack_xpp_app': {
      label: 'Combo: Full-Stack Integrated App [XITR]',
      code: 'RNM = XITR
use sqlite3
use XWeb
use TerminX

out TerminX.banner("X++ Full-Stack Demo", "magenta")

# 1. Database layer
conn = sqlite3.connect(":memory:")
sqlite3.execute(conn, "CREATE TABLE stats (key TEXT, val INT);")
sqlite3.execute(conn, "INSERT INTO stats VALUES (\'visits\', 1540);")
sqlite3.execute(conn, "INSERT INTO stats VALUES (\'stars\', 48);")

rows = sqlite3.fetchall(sqlite3.execute(conn, "SELECT * FROM stats;"))
out TerminX.green("[DB] Stats loaded:")
loop r in rows:
  out "  *", r[0], "=", r[1]
end

# 2. Web layer
dash = XWeb.page("System Overview", "Database and Web service synchronized.")
out TerminX.blue("[WEB] Generated dashboard view:")
out "Length of HTML payload:", len(dash), "bytes"
out TerminX.bold("=== Full-Stack Pipeline Complete ===")
',
      input: '',
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
