/* ==========================================================================
 * X++ (XPlusPlus) — web interpreter
 * A faithful port of the native ZITR VM semantics (X++ v0.4.1) to JavaScript.
 * Grammar, scoping, value formatting, builtin behaviour and error messages
 * mirror native/xpp_parse.cpp · xpp_codegen.cpp · xpp_vm.cpp · xpp_values.cpp
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- values */

  const NIL = { xppNil: true };                 // singleton nil
  class XFloat {                                // float wrapper (keeps int/float distinction)
    constructor(v) { this.v = v; }
  }
  class XFn {                                   // user function value
    constructor(name, params, body, localNames) {
      this.name = name; this.params = params; this.body = body; this.localNames = localNames;
    }
  }
  class XBuiltin {                              // builtin function value
    constructor(name, fn) { this.name = name; this.fn = fn; }
  }
  class XDict {                                 // insertion-ordered dict with string keys
    constructor() { this.m = new Map(); }
  }

  const isNum  = (v) => typeof v === 'number' || v instanceof XFloat;
  const isInt  = (v) => typeof v === 'number';
  const num    = (v) => (v instanceof XFloat ? v.v : v);

  /* control-flow signals (NOT catchable by safe/fail) */
  class BreakSignal { }
  class ContinueSignal { }
  class ReturnSignal { constructor(v) { this.v = v; } }
  class ExitSignal { constructor(c) { this.code = c; } }
  class TimeoutSignal { }

  /* runtime errors (catchable by safe/fail) */
  class XError extends Error { constructor(m) { super(m); } }

  /* ------------------------------------------------------------ formatting */

  function fmtDouble(d) {
    if (Number.isNaN(d)) return 'nan';
    if (!Number.isFinite(d)) return d > 0 ? 'inf' : '-inf';
    if (Number.isInteger(d) && Math.abs(d) < 9.007199254740992e15) return String(d);
    // mimic C++ std::setprecision(15) with default (%g-like) formatting
    let s = d.toPrecision(15);
    if (s.indexOf('e') !== -1 || Math.abs(d) >= 1e15 || (d !== 0 && Math.abs(d) < 1e-4)) {
      const dec = d.toExponential(14);                  // 15 significant digits
      let [mant, ex] = dec.split('e');
      mant = mant.indexOf('.') !== -1 ? mant.replace(/0+$/, '').replace(/\.$/, '') : mant;
      const e = parseInt(ex, 10);
      return mant + 'e' + (e >= 0 ? '+' : '-') + String(Math.abs(e)).padStart(2, '0');
    }
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  function display(v) {                            // to_display_string
    if (v === NIL) return 'nil';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (v instanceof XFloat) return fmtDouble(v.v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(display).join(', ') + ']';
    if (v instanceof XDict) {
      const parts = [];
      for (const [k, val] of v.m) parts.push('"' + k + '": ' + display(val));
      return '{' + parts.join(', ') + '}';
    }
    if (v instanceof XFn) return '<fn>';
    if (v instanceof XBuiltin) return '<builtin ' + v.name + '>';
    return '<?>';
  }

  const toStr = display;                           // to_str mirrors to_display_string

  function truthy(v) {
    if (v === NIL) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v instanceof XFloat) return v.v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof XDict) return v.m.size > 0;
    return true;
  }

  function eq(x, y) {                              // value_equal
    if (isNum(x) && isNum(y)) return num(x) === num(y);
    if (x === NIL || y === NIL) return x === y;
    if (typeof x === 'boolean' || typeof y === 'boolean') return x === y;
    if (typeof x === 'string' || typeof y === 'string') return x === y && typeof x === typeof y;
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) if (!eq(x[i], y[i])) return false;
      return true;
    }
    if (x instanceof XDict && y instanceof XDict) {
      if (x.m.size !== y.m.size) return false;
      for (const [k, v] of x.m) {
        if (!y.m.has(k) || !eq(v, y.m.get(k))) return false;
      }
      return true;
    }
    return x === y;
  }

  function cmp(x, y) {                             // value_compare (throws on mixed)
    if (isNum(x) && isNum(y)) {
      const a = num(x), b = num(y);
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    if (typeof x === 'string' && typeof y === 'string') {
      return x < y ? -1 : (x > y ? 1 : 0);
    }
    throw new XError("comparison '<' '>' requires numbers or strings");
  }
  function cmpBin(x, y) {                          // comparison opcodes check first
    if ((isNum(x) && isNum(y)) || (typeof x === 'string' && typeof y === 'string')) return cmp(x, y);
    throw new XError('comparison requires two numbers or two strings');
  }

  /* -------------------------------------------------------------- lexer */

  const TWO_OPS = ['==', '!=', '<=', '>=', '**'];
  const SINGLE_OPS = '()[]{}:,+-*/%<>=.';

  function lex(src) {
    const toks = [];
    let pos = 0, line = 1;
    const n = src.length;
    const peek = (o) => { const i = pos + (o || 0); return i < n ? src[i] : '\0'; };

    while (pos < n) {
      const c = src[pos];
      if (c === ' ' || c === '\t' || c === '\r') { pos++; continue; }
      if (c === '\n') { toks.push({ k: 'nl', line }); pos++; line++; continue; }
      if (c === '#') { while (pos < n && src[pos] !== '\n') pos++; continue; }
      if (c >= '0' && c <= '9') {
        const s = pos, sl = line;
        while (peek() >= '0' && peek() <= '9') pos++;
        let isFloat = false;
        if (peek() === '.' && peek(1) >= '0' && peek(1) <= '9') {
          isFloat = true; pos++;
          while (peek() >= '0' && peek() <= '9') pos++;
        }
        if (peek() === 'e' || peek() === 'E') {
          const save = pos;
          pos++;
          if (peek() === '+' || peek() === '-') pos++;
          if (peek() >= '0' && peek() <= '9') {
            isFloat = true;
            while (peek() >= '0' && peek() <= '9') pos++;
          } else { pos = save; }
        }
        const text = src.slice(s, pos);
        if (isFloat) toks.push({ k: 'float', text, v: parseFloat(text), line: sl });
        else {
          const iv = parseInt(text, 10);
          if (String(iv) === text && Math.abs(iv) <= Number.MAX_SAFE_INTEGER)
            toks.push({ k: 'int', text, v: iv, line: sl });
          else toks.push({ k: 'float', text, v: parseFloat(text), line: sl });
        }
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const s = pos, sl = line;
        while (pos < n && /[A-Za-z0-9_]/.test(src[pos])) pos++;
        toks.push({ k: 'id', text: src.slice(s, pos), line: sl });
        continue;
      }
      if (c === '"' || c === "'") {
        const q = c, sl = line;
        pos++;
        let out = '';
        for (;;) {
          if (pos >= n || src[pos] === '\n')
            throw new XError('line ' + sl + ': unterminated string');
          const ch = src[pos++];
          if (ch === '\\') {
            if (pos >= n) throw new XError('line ' + sl + ': unterminated string');
            const e = src[pos++];
            if (e === 'n') out += '\n';
            else if (e === 't') out += '\t';
            else if (e === 'r') out += '\r';
            else if (e === '\\') out += '\\';
            else if (e === '"') out += '"';
            else if (e === "'") out += "'";
            else if (e === '0') out += '\0';
            else out += e;
            continue;
          }
          if (ch === q) break;
          out += ch;
        }
        toks.push({ k: 'str', text: out, line: sl });
        continue;
      }
      let matched = false;
      for (const t of TWO_OPS) {
        if (src.startsWith(t, pos)) {
          toks.push({ k: 'op', text: t, line }); pos += 2; matched = true; break;
        }
      }
      if (matched) continue;
      if (SINGLE_OPS.includes(c)) { toks.push({ k: 'op', text: c, line }); pos++; continue; }
      throw new XError("line " + line + ": unexpected character '" + c + "'");
    }
    toks.push({ k: 'eof', text: '', line });
    return toks;
  }

  /* -------------------------------------------------------------- parser */

  const ST = { FN: 'fn', IF: 'if', WHILE: 'while', LOOPF: 'loopf', LOOPX: 'loopx',
               SAFE: 'safe', RET: 'ret', BREAK: 'break', CONT: 'continue',
               OUT: 'out', PUSH: 'push', SET: 'set', EXPR: 'expr' };

  function parse(src) {
    const t = lex(src);
    let p = 0;
    const cur = () => t[p];
    const at = (o) => t[Math.min(p + o, t.length - 1)];
    const is = (k, text) => t[p].k === k && (text === undefined || t[p].text === text);
    const isOp = (o) => is('op', o);
    const isKw = (s) => is('id', s);
    const next = () => { if (p + 1 < t.length) p++; };
    const err = (m) => { throw new XError('line ' + t[p].line + ': ' + m + " (near '" + t[p].text + "')"); };
    const expectOp = (o) => { if (!isOp(o)) err("expected '" + o + "'"); next(); };
    const skipNl = () => { while (is('nl')) next(); };

    const funcs = [];                              // every fn declaration, hoisted & global

    function parseProgram() {
      const stmts = [];
      skipNl();
      while (!is('eof')) {
        skipNl();
        if (isKw('RNM') || isKw('USE')) { skipDirective(); continue; }
        if (is('eof')) break;
        stmts.push(parseStmt());
        skipNl();
      }
      return stmts;
    }

    function skipDirective() {
      while (!is('nl') && !is('eof')) next();
      if (is('nl')) next();
    }

    function parseStmt() {
      if (isKw('fn')) return parseFn();
      if (isKw('if')) return parseIf();
      if (isKw('while')) return parseWhile();
      if (isKw('loop')) return parseLoop();
      if (isKw('safe')) return parseSafe();
      if (isKw('return')) {
        next();
        const s = { k: ST.RET };
        if (!is('nl') && !is('eof')) s.a = parseExpr();
        return s;
      }
      if (isKw('break')) { next(); return { k: ST.BREAK }; }
      if (isKw('continue')) { next(); return { k: ST.CONT }; }
      if (isKw('out')) {
        next();
        const s = { k: ST.OUT, args: [parseExpr()] };
        while (isOp(',')) { next(); s.args.push(parseExpr()); }
        return s;
      }
      if (isKw('push')) return parsePush();
      return parseAssignOrExpr();
    }

    function parseFn() {
      next();
      if (!is('id')) err('expected function name');
      const name = cur().text; next();
      expectOp('(');
      const params = [];
      if (!isOp(')')) {
        for (;;) {
          if (!is('id')) err('expected parameter name');
          params.push(cur().text); next();
          if (!isOp(',')) break;
          next();
        }
      }
      expectOp(')');
      expectOp(':');
      skipNl();
      const body = [];
      while (!isKw('end')) { body.push(parseStmt()); skipNl(); }
      next();
      const f = { name, params, body };
      funcs.push(f);
      return { k: ST.FN, fn: f };
    }

    function parseIf() {
      next();
      const s = { k: ST.IF, arms: [], els: [] };
      let cond = parseExpr();
      expectOp(':'); skipNl();
      s.arms.push([cond, parseArmBody(['elif', 'else', 'end'])]);
      while (isKw('elif')) {
        next();
        cond = parseExpr();
        expectOp(':'); skipNl();
        s.arms.push([cond, parseArmBody(['elif', 'else', 'end'])]);
      }
      if (isKw('else')) {
        next(); expectOp(':'); skipNl();
        s.els = parseArmBody(['end']);
      }
      if (!isKw('end')) err("expected 'end' for if");
      next();
      return s;
    }

    function parseArmBody(stoppers) {
      const body = [];
      while (!stoppers.some((x) => isKw(x))) { body.push(parseStmt()); skipNl(); }
      return body;
    }

    function parseWhile() {
      next();
      const s = { k: ST.WHILE, a: parseExpr() };
      expectOp(':'); skipNl();
      s.body = parseArmBody(['end']);
      next();
      return s;
    }

    function parseLoop() {
      next();
      if (!is('id')) err('expected loop variable');
      const v = cur().text; next();
      const s = {};
      if (isKw('from')) {
        next();
        s.k = ST.LOOPF; s.name = v; s.a = parseExpr();
        if (!isKw('to')) err("expected 'to'");
        next();
        s.b = parseExpr();
        if (isKw('step')) { next(); s.step = parseExpr(); }
      } else if (isKw('in')) {
        next();
        s.k = ST.LOOPX; s.name = v; s.b = parseExpr();
      } else err("expected 'from' or 'in' after loop variable");
      expectOp(':'); skipNl();
      s.body = parseArmBody(['end']);
      next();
      return s;
    }

    function parseSafe() {
      next();
      const s = { k: ST.SAFE, body: [], els: [], exc: null };
      expectOp(':'); skipNl();
      s.body = parseArmBody(['fail']);
      if (isKw('fail')) {
        next();
        if (is('id')) { s.exc = cur().text; next(); }
        expectOp(':'); skipNl();
        s.els = parseArmBody(['end']);
      }
      if (!isKw('end')) err("expected 'end' for safe");
      next();
      return s;
    }

    function parsePush() {
      next();
      const s = { k: ST.PUSH, a: parseExpr() };
      if (!isKw('to')) err("expected 'to' in push");
      next();
      if (!is('id')) err('expected list name');
      s.name = cur().text; next();
      return s;
    }

    function parseAssignOrExpr() {
      if (is('id')) {
        const save = p;
        const name = cur().text; next();
        let idx = null;
        if (isOp('[')) {
          next(); idx = parseExpr(); expectOp(']');
        } else if (isOp('.')) {
          next();
          if (!is('id')) err("expected attribute name after '.'");
          idx = { k: 'str', v: cur().text }; next();
        }
        if (isOp('=')) {
          next();
          return { k: ST.SET, name, idx, a: parseExpr() };
        }
        p = save;                                   // not an assignment — reparse as expression
      }
      return { k: ST.EXPR, a: parseExpr() };
    }

    /* expressions — precedence chain mirrors the native parser exactly */
    function parseExpr() { return parseOr(); }

    function parseOr() {
      let l = parseAnd();
      while (isKw('or')) { next(); l = { k: 'or', a: l, b: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      let l = parseNot();
      while (isKw('and')) { next(); l = { k: 'and', a: l, b: parseNot() }; }
      return l;
    }
    function parseNot() {
      if (isKw('not')) { next(); return { k: 'not', a: parseNot() }; }
      return parseCompare();
    }
    function parseCompare() {
      let l = parseSum();
      for (;;) {
        let op = null;
        if (isOp('==')) op = '=='; else if (isOp('!=')) op = '!=';
        else if (isOp('<=')) op = '<='; else if (isOp('>=')) op = '>=';
        else if (isOp('<')) op = '<'; else if (isOp('>')) op = '>';
        if (!op) break;
        next();
        l = { k: 'bin', op, a: l, b: parseSum() };
      }
      return l;
    }
    function parseSum() {
      let l = parseTerm();
      for (;;) {
        let op = null;
        if (isOp('+')) op = '+'; else if (isOp('-')) op = '-';
        if (!op) break;
        next();
        l = { k: 'bin', op, a: l, b: parseTerm() };
      }
      return l;
    }
    function parseTerm() {
      let l = parseUnary();
      for (;;) {
        let op = null;
        if (isOp('*')) op = '*'; else if (isOp('/')) op = '/'; else if (isOp('%')) op = '%';
        if (!op) break;
        next();
        l = { k: 'bin', op, a: l, b: parseUnary() };
      }
      return l;
    }
    function parseUnary() {
      if (isOp('-')) { next(); return { k: 'neg', a: parseUnary() }; }
      if (isOp('+')) { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const l = parseAtom();
      if (isOp('**')) { next(); return { k: 'bin', op: '**', a: l, b: parseUnary() }; }
      return l;
    }

    function parseAtom() {
      if (is('int')) { const v = cur().v; next(); return { k: 'lit', v }; }
      if (is('float')) { const v = cur().v; next(); return { k: 'lit', v: new XFloat(v) }; }
      if (is('str')) { const v = cur().text; next(); return { k: 'lit', v }; }
      if (isKw('true')) { next(); return { k: 'lit', v: true }; }
      if (isKw('false')) { next(); return { k: 'lit', v: false }; }
      if (isKw('nil')) { next(); return { k: 'lit', v: NIL }; }
      if (isKw('in')) {
        next();
        let prompt = '';
        if (is('str')) { prompt = cur().text; next(); }
        return { k: 'input', prompt };
      }
      if (isKw('read')) {
        next();
        if (!is('str')) err('expected filename after read');
        const f = cur().text; next();
        return { k: 'read', file: f };
      }
      if (isKw('len') && at(1).k === 'op' && at(1).text === '(') {
        next(); next();
        const e = { k: 'call', name: 'len', args: [parseExpr()] };
        expectOp(')');
        return parsePostfix(e);
      }
      if (isOp('[')) return parsePostfix(parseListLit());
      if (isOp('{')) return parsePostfix(parseDictLit());
      if (isOp('(')) {
        next();
        const e = parseExpr();
        expectOp(')');
        return parsePostfix(e);
      }
      if (is('id')) {
        const name = cur().text; next();
        if (isOp('(')) {
          next();
          const args = [];
          if (!isOp(')')) {
            for (;;) {
              args.push(parseExpr());
              if (!isOp(',')) break;
              next();
            }
          }
          expectOp(')');
          return parsePostfix({ k: 'call', name, args });
        }
        return parsePostfix({ k: 'var', name });
      }
      err('expected expression');
    }

    function parseListLit() {
      next();
      const items = [];
      if (!isOp(']')) {
        for (;;) {
          items.push(parseExpr());
          if (!isOp(',')) break;
          next();
        }
      }
      expectOp(']');
      return { k: 'list', items };
    }

    function parseDictLit() {
      next();
      const pairs = [];
      if (!isOp('}')) {
        for (;;) {
          let key;
          if (is('str')) { key = cur().text; next(); }
          else if (is('id')) { key = cur().text; next(); }
          else err('expected dict key');
          expectOp(':');
          pairs.push([key, parseExpr()]);
          if (!isOp(',')) break;
          next();
        }
      }
      expectOp('}');
      return { k: 'dict', pairs };
    }

    function parsePostfix(e) {
      for (;;) {
        if (isOp('[')) {
          next();
          const idx = parseExpr();
          expectOp(']');
          e = { k: 'idx', a: e, b: idx };
        } else if (isOp('.')) {
          next();
          if (!is('id')) err("expected attribute after '.'");
          e = { k: 'attr', a: e, name: cur().text };
          next();
        } else break;
      }
      return e;
    }

    const stmts = parseProgram();

    /* collect local names per function (Python-like: assignment makes a name local) */
    function collectAssigns(body, out) {
      for (const st of body) {
        switch (st.k) {
          case ST.SET: out.push(st.name); break;
          case ST.LOOPF: case ST.LOOPX: out.push(st.name); break;
          case ST.SAFE: if (st.exc) out.push(st.exc); break;
        }
        if (st.k === ST.IF) {
          for (const arm of st.arms) collectAssigns(arm[1], out);
          collectAssigns(st.els, out);
        } else if (st.k === ST.WHILE || st.k === ST.LOOPF || st.k === ST.LOOPX) {
          collectAssigns(st.body, out);
        } else if (st.k === ST.SAFE) {
          collectAssigns(st.body, out);
          collectAssigns(st.els, out);
        }
      }
    }
    for (const f of funcs) {
      const local = new Set(f.params);
      const names = [];
      collectAssigns(f.body, names);
      for (const nm of names) local.add(nm);
      f.localNames = local;
    }

    return { stmts, funcs };
  }

  /* --------------------------------------------------------- interpreter */

  function utf8Len(s) {
    if (/^[\x00-\x7F]*$/.test(s)) return s.length;
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; }
  }

  class Interp {
    constructor(opts) {
      opts = opts || {};
      this.out = opts.out || (() => { });
      this.err = opts.err || this.out;
      this.inputLines = (opts.input === undefined || opts.input === null) ? [] : String(opts.input).split('\n');
      this.inputPos = 0;
      this.files = opts.files instanceof Map ? opts.files : new Map();   // virtual FS for read/write
      this.functions = new Map();
      this.globals = new Map();
      this.builtins = new Map();
      this.deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : Infinity;
      this.maxOps = opts.maxOps || 50000000;
      this.ops = 0;
      this.startTime = Date.now();
      this._initBuiltins();
    }

    /* ---- helpers ---- */
    tick() {
      if ((++this.ops & 0x3fff) === 0) {
        if (Date.now() > this.deadline) throw new TimeoutSignal();
        if (this.ops > this.maxOps) throw new TimeoutSignal();
      }
    }

    readVar(name, env) {
      if (env && env.has(name)) {
        const v = env.get(name);
        return v === undefined ? NIL : v;
      }
      if (this.functions.has(name)) return this.functions.get(name);
      if (this.builtins.has(name)) return this.builtins.get(name);
      return this.globals.has(name) ? this.globals.get(name) : NIL;
    }

    storeVar(name, v, localNames, env) {
      if (localNames) env.set(name, v);
      else this.globals.set(name, v);
    }

    /* ---- entry ---- */
    run(src) {
      let prog;
      try {
        prog = parse(src);
      } catch (e) {
        if (e instanceof XError) {
          this.err('X++ [ZITR] error: ' + e.message);
          return 1;
        }
        throw e;
      }
      for (const f of prog.funcs)
        this.functions.set(f.name, new XFn(f.name, f.params, f.body, f.localNames));
      try {
        this.execBlock(prog.stmts, null, null);
      } catch (e) {
        if (e instanceof ReturnSignal) return 0;
        if (e instanceof ExitSignal) return e.code;
        if (e instanceof BreakSignal || e instanceof ContinueSignal)
          return this._fatal("'break'/'continue' outside a loop");
        if (e instanceof TimeoutSignal) {
          this.err('X++ [ZITR] error: execution timed out in the web playground (possible infinite loop).');
          return 1;
        }
        if (e instanceof XError) { this.err('X++ [ZITR] error: ' + e.message); return 1; }
        if (e instanceof RangeError) {
          this.err('X++ [ZITR] error: stack overflow — recursion went deeper than the web playground can follow (the native VM handles 20,000+ frames — install X++ to run this natively).');
          return 1;
        }
        throw e;
      }
      return 0;
    }

    _fatal(msg) {
      this.err('X++ [ZITR] error: ' + msg);
      return 1;
    }

    /* ---- statements ----
     * exec() holds only the recursion-critical cases (thin frames); everything
     * else lives in exec2(). Same for eval()/eval2() — deep X++ recursion
     * passes through at most 3 slim JS frames per X++ call. */
    execBlock(stmts, env, localNames) {
      for (const st of stmts) this.exec(st, env, localNames);
    }

    exec(st, env, localNames) {
      switch (st.k) {
        case ST.EXPR: return this.eval(st.a, env, localNames);
        case ST.RET: throw new ReturnSignal(st.a ? this.eval(st.a, env, localNames) : NIL);
        case ST.BREAK: throw new BreakSignal();
        case ST.CONT: throw new ContinueSignal();
        case ST.IF: {
          for (const arm of st.arms) {
            if (truthy(this.eval(arm[0], env, localNames))) {
              for (const s2 of arm[1]) this.exec(s2, env, localNames);
              return;
            }
          }
          for (const s2 of st.els) this.exec(s2, env, localNames);
          return;
        }
        default: return this.exec2(st, env, localNames);
      }
    }

    exec2(st, env, localNames) {
      switch (st.k) {
        case ST.FN: return;                                  // hoisted at parse time
        case ST.OUT: {
          const parts = [];
          for (const a of st.args) parts.push(display(this.eval(a, env, localNames)));
          this.out(parts.join(' ') + '\n');
          return;
        }
        case ST.SET: {
          const v = this.eval(st.a, env, localNames);
          if (!st.idx) { this.storeVar(st.name, v, localNames, env); return; }
          const target = st.idx.k === 'str' ? undefined : st.idx;
          const obj = this.readVar(st.name, env);
          if (target === undefined) {                        // attribute assignment
            if (!(obj instanceof XDict)) throw new XError('attribute assignment requires dict');
            obj.m.set(st.idx.v, v);
            return;
          }
          const key = this.eval(st.idx, env, localNames);
          if (Array.isArray(obj)) {
            if (!isNum(key)) throw new XError('list index must be a number');
            let i = Math.trunc(num(key));
            if (i < 0) i += obj.length;
            if (i < 0 || i >= obj.length) throw new XError('list index out of range');
            obj[i] = v;
          } else if (obj instanceof XDict) {
            const ks = typeof key === 'string' ? key : toStr(key);
            obj.m.set(ks, v);
          } else throw new XError('index assignment requires list/dict');
          return;
        }
        case ST.WHILE: {
          while (truthy(this.eval(st.a, env, localNames))) {
            this.tick();
            try { for (const s2 of st.body) this.exec(s2, env, localNames); }
            catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
          }
          return;
        }
        case ST.LOOPF: {
          let v = this.eval(st.a, env, localNames);
          const end = this.eval(st.b, env, localNames);
          let step = st.step ? this.eval(st.step, env, localNames) : 1;
          if (!(isNum(v) && isNum(end) && isNum(step)))
            throw new XError('loop bounds must be numbers');
          const asc = num(step) >= 0;
          if (asc ? num(v) > num(end) : num(v) < num(end)) return;   // precheck — may run zero times
          for (;;) {
            this.tick();
            this.storeVar(st.name, v, localNames, env);
            try { for (const s2 of st.body) this.exec(s2, env, localNames); }
            catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
            v = this.add(v, step);
            if (asc ? !(num(v) <= num(end)) : !(num(v) >= num(end))) break;
          }
          return;
        }
        case ST.LOOPX: {
          const seq = this.eval(st.b, env, localNames);
          if (!(Array.isArray(seq) || typeof seq === 'string'))
            throw new XError('loop requires list or string');
          let i = 0;
          for (;;) {
            this.tick();
            const len = seq.length;
            if (i >= len) break;
            const item = Array.isArray(seq) ? seq[i] : seq.charAt(i);
            this.storeVar(st.name, item, localNames, env);
            try { for (const s2 of st.body) this.exec(s2, env, localNames); }
            catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
            i++;
          }
          return;
        }
        case ST.SAFE: {
          try {
            for (const s2 of st.body) this.exec(s2, env, localNames);
          } catch (e) {
            if (!(e instanceof XError)) throw e;
            if (st.exc) {
              if (localNames && localNames.has(st.exc)) env.set(st.exc, e.message);
              else this.globals.set(st.exc, e.message);
            }
            for (const s2 of st.els) this.exec(s2, env, localNames);
          }
          return;
        }
        case ST.PUSH: {
          const v = this.eval(st.a, env, localNames);
          const lst = env && env.has(st.name) ? env.get(st.name)
            : this.globals.has(st.name) ? this.globals.get(st.name) : NIL;
          this.builtinPush(lst, v);
          return;
        }
      }
    }

    /* ---- expressions ---- */
    eval(e, env, localNames) {
      switch (e.k) {
        case 'lit': return e.v;
        case 'var': return this.readVar(e.name, env);
        case 'bin': {
          const op = e.op;
          if (op === '==' || op === '!=') {
            const r = eq(this.eval(e.a, env, localNames), this.eval(e.b, env, localNames));
            return op === '==' ? r : !r;
          }
          const a = this.eval(e.a, env, localNames);
          const b = this.eval(e.b, env, localNames);
          return this.binop(op, a, b);
        }
        case 'call': {
          const callee = this.readVar(e.name, env);
          const args = [];
          for (const a of e.args) args.push(this.eval(a, env, localNames));
          if (callee instanceof XFn) {
            const fenv = new Map();
            for (const nm of callee.localNames) fenv.set(nm, NIL);
            for (let i = 0; i < callee.params.length && i < args.length; i++)
              fenv.set(callee.params[i], args[i]);
            this.tick();
            try {
              for (const s2 of callee.body) this.exec(s2, fenv, callee.localNames);
            } catch (r) {
              if (r instanceof ReturnSignal) return r.v;
              throw r;
            }
            return NIL;
          }
          if (callee instanceof XBuiltin) return callee.fn.call(this, args);
          throw new XError('attempt to call a non-function value');
        }
        default: return this.eval2(e, env, localNames);
      }
    }

    binop(op, a, b) {
      switch (op) {
        case '<': return cmpBin(a, b) < 0;
        case '<=': return cmpBin(a, b) <= 0;
        case '>': return cmpBin(a, b) > 0;
        case '>=': return cmpBin(a, b) >= 0;
        case '+': return this.add(a, b);
        case '-': return this.arith(a, b, '-', (x, y) => x - y);
        case '*': return this.mul(a, b);
        case '/': {
          if (a === NIL || b === NIL) return NIL;      // nil propagates (native NaN-boxing)
          if (!isNum(a) || !isNum(b)) throw new XError("unsupported operand for '/'");
          const d = num(b);
          if (d === 0) throw new XError('division by zero');
          return new XFloat(num(a) / d);
        }
        case '%': {
          if (a === NIL || b === NIL) return NIL;
          if (!isNum(a) || !isNum(b)) throw new XError("unsupported operand for '%'");
          const x = num(a), y = num(b);
          if (y === 0) throw new XError('modulo by zero');
          let m = x % y;
          if (m !== 0 && ((m < 0) !== (y < 0))) m += y;
          if (isInt(a) && isInt(b)) return m;
          return new XFloat(m);
        }
        case '**': {
          if (a === NIL || b === NIL) return NIL;
          if (!isNum(a) || !isNum(b)) throw new XError("unsupported operand for '**'");
          return new XFloat(Math.pow(num(a), num(b)));
        }
      }
      throw new XError('bad operator ' + op);
    }

    eval2(e, env, localNames) {
      switch (e.k) {
        case 'list': {
          const items = [];
          for (const it of e.items) items.push(this.eval(it, env, localNames));
          return items;
        }
        case 'dict': {
          const d = new XDict();
          for (const [k, ve] of e.pairs) d.m.set(k, this.eval(ve, env, localNames));
          return d;
        }
        case 'or': {
          const l = this.eval(e.a, env, localNames);
          return truthy(l) ? l : this.eval(e.b, env, localNames);
        }
        case 'and': {
          const l = this.eval(e.a, env, localNames);
          return truthy(l) ? this.eval(e.b, env, localNames) : l;
        }
        case 'not': return !truthy(this.eval(e.a, env, localNames));
        case 'neg': {
          const v = this.eval(e.a, env, localNames);
          if (isInt(v)) return -v;
          if (v instanceof XFloat) return new XFloat(-v.v);
          throw new XError("unary '-' needs a number");
        }
        case 'idx': {
          const seq = this.eval(e.a, env, localNames);
          const key = this.eval(e.b, env, localNames);
          if (Array.isArray(seq)) {
            if (!isNum(key)) throw new XError('list index must be a number');
            let i = Math.trunc(num(key));
            if (i < 0) i += seq.length;
            if (i < 0 || i >= seq.length) throw new XError('list index out of range');
            return seq[i];
          }
          if (typeof seq === 'string') {
            if (!isNum(key)) throw new XError('string index must be a number');
            let i = Math.trunc(num(key));
            if (i < 0) i += seq.length;
            if (i < 0 || i >= seq.length) throw new XError('string index out of range');
            return seq.charAt(i);
          }
          if (seq instanceof XDict) {
            const ks = typeof key === 'string' ? key : toStr(key);
            if (!seq.m.has(ks)) throw new XError("dict key not found: '" + ks + "'");
            return seq.m.get(ks);
          }
          throw new XError('indexing requires list/string/dict');
        }
        case 'attr': {
          const obj = this.eval(e.a, env, localNames);
          if (obj instanceof XDict) {
            if (!obj.m.has(e.name)) throw new XError("dict has no key '" + e.name + "'");
            return obj.m.get(e.name);
          }
          throw new XError('attribute access requires dict');
        }
        case 'input': {
          if (e.prompt) this.out(e.prompt);
          const line = this.inputPos < this.inputLines.length ? this.inputLines[this.inputPos++] : '';
          return line;
        }
        case 'read': {
          if (this.files.has(e.file)) return this.files.get(e.file);
          throw new XError("read(): cannot open file '" + e.file + "'");
        }
      }
      throw new XError('bad expression');
    }

    callValue(callee, args) {
      if (callee instanceof XFn) {
        const env = new Map();
        for (const nm of callee.localNames) env.set(nm, NIL);
        for (let i = 0; i < callee.params.length && i < args.length; i++)
          env.set(callee.params[i], args[i]);
        this.tick();
        try {
          this.execBlock(callee.body, env, callee.localNames);
        } catch (r) {
          if (r instanceof ReturnSignal) return r.v;
          throw r;
        }
        return NIL;
      }
      if (callee instanceof XBuiltin) return callee.fn.call(this, args);
      throw new XError('attempt to call a non-function value');
    }

    /* ---- arithmetic (value_add / value_sub / value_mul) ---- */
    add(a, b) {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (typeof a === 'string' || typeof b === 'string') {
        if (typeof a === 'string' && isNum(b)) return a + toStr(b);
        if (typeof b === 'string' && isNum(a)) return toStr(a) + b;
        throw new XError('cannot add string and non-string/non-number');
      }
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      if (a === NIL || b === NIL) return NIL;         // nil propagates (native NaN-boxing)
      if (isInt(a) && isInt(b)) return a + b;
      if (isNum(a) && isNum(b)) return new XFloat(num(a) + num(b));
      throw new XError("unsupported operand for '+'");
    }
    arith(a, b, sym, f) {
      if (a === NIL || b === NIL) return NIL;
      if (isInt(a) && isInt(b)) return f(a, b);
      if (isNum(a) && isNum(b)) return new XFloat(f(num(a), num(b)));
      throw new XError("unsupported operand for '" + sym + "'");
    }
    mul(a, b) {
      if (a === NIL || b === NIL) return NIL;
      if (Array.isArray(a) && isInt(b)) {
        const n = Math.max(0, b);
        const out = [];
        for (let i = 0; i < n; i++) out.push(...a);
        return out;
      }
      if (Array.isArray(b) && isInt(a)) return this.mul(b, a);
      if (typeof a === 'string' && isInt(b)) {
        const n = Math.max(0, b);
        let s = '';
        for (let i = 0; i < n; i++) s += a;
        return s;
      }
      if (typeof b === 'string' && isInt(a)) return this.mul(b, a);
      if (isInt(a) && isInt(b)) return a * b;
      if (isNum(a) && isNum(b)) return new XFloat(num(a) * num(b));
      throw new XError("unsupported operand for '*'");
    }
    builtinPush(lst, v) {
      if (!Array.isArray(lst)) throw new XError('push(): expected list, value');
      lst.push(v);
      return lst;
    }

    /* ---- builtins ---- */
    _initBuiltins() {
      const B = (name, fn) => this.builtins.set(name, new XBuiltin(name, fn));

      B('print', function (args) {
        this.out(args.map(display).join(' ') + '\n');
        return NIL;
      });
      B('input', function (args) {
        const p = args.length === 0 ? '' : (typeof args[0] === 'string' ? args[0] : toStr(args[0]));
        if (p) this.out(p);
        return this.inputPos < this.inputLines.length ? this.inputLines[this.inputPos++] : '';
      });
      B('str', function (args) { return args.length === 0 ? toStr(NIL) : toStr(args[0]); });
      B('int', function (args) {
        if (args.length === 0) throw new XError('int() needs 1 argument');
        const v = args[0];
        if (isInt(v)) return v;
        if (v instanceof XFloat) return Math.trunc(v.v);
        if (typeof v === 'string') {
          const r = parseInt(v, 10);
          if (isNaN(r)) throw new XError('int(): invalid integer string');
          return r;
        }
        throw new XError('int(): unsupported type');
      });
      B('float', function (args) {
        if (args.length === 0) throw new XError('float() needs 1 argument');
        const v = args[0];
        if (isNum(v)) return v instanceof XFloat ? v : new XFloat(v);
        if (typeof v === 'string') {
          const s = v.trim();
          if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) || s === '')
            throw new XError('float(): invalid number string');
          return new XFloat(Number(s));
        }
        throw new XError('float(): unsupported type');
      });
      B('len', function (args) {
        if (args.length === 0) throw new XError('len() needs 1 argument');
        const v = args[0];
        if (typeof v === 'string') return utf8Len(v);
        if (Array.isArray(v)) return v.length;
        if (v instanceof XDict) return v.m.size;
        throw new XError('len(): unsupported type');
      });
      B('abs', function (args) {
        if (args.length === 0) throw new XError('abs() needs 1 argument');
        const v = args[0];
        if (isInt(v)) return Math.abs(v);
        if (v instanceof XFloat) return new XFloat(Math.abs(v.v));
        throw new XError('abs(): unsupported type');
      });
      B('min', function (args) {
        if (args.length === 0) throw new XError('min() needs arguments');
        let b = args[0];
        for (let i = 1; i < args.length; i++) if (cmp(args[i], b) < 0) b = args[i];
        return b;
      });
      B('max', function (args) {
        if (args.length === 0) throw new XError('max() needs arguments');
        let b = args[0];
        for (let i = 1; i < args.length; i++) if (cmp(args[i], b) > 0) b = args[i];
        return b;
      });
      B('sum', function (args) {
        const seq = args.length === 0 ? NIL : args[0];
        if (!(Array.isArray(seq) || typeof seq === 'string'))
          throw new XError('sum() needs a list or string');
        // faithful port of the native accumulator: ints pile into iv; the first
        // float switches to fv — int contributions seen before it are dropped.
        let iv = 0, fv = 0, isF = false;
        const acc = (v) => {
          if (!isNum(v)) throw new XError('sum(): non-number element');
          if (!isF && v instanceof XFloat) { fv += v.v; isF = true; }
          else if (isF) { fv += num(v); }
          else { iv += v; }
        };
        if (Array.isArray(seq)) for (const v of seq) acc(v);
        else for (let i = 0; i < seq.length; i++) acc(seq.charCodeAt(i));
        return isF ? new XFloat(fv) : iv;
      });
      B('sorted', function (args) {
        if (args.length === 0 || !Array.isArray(args[0]))
          throw new XError('sorted() needs a list');
        const copy = args[0].slice();
        copy.sort((x, y) => cmp(x, y));
        return copy;
      });
      B('range', function (args) {
        let lo = 0, hi = 0, st = 1;
        const req = (v) => {
          if (!isNum(v)) throw new XError('builtin requires number for range');
          return Math.trunc(num(v));
        };
        if (args.length === 1) hi = req(args[0]);
        else if (args.length >= 2) { lo = req(args[0]); hi = req(args[1]); }
        if (args.length >= 3) st = req(args[2]);
        if (st === 0) throw new XError('range(): step cannot be zero');
        const out = [];
        if (st > 0) for (let i = lo; i < hi; i += st) out.push(i);
        else for (let i = lo; i > hi; i += st) out.push(i);
        return out;
      });
      B('type', function (args) {
        if (args.length === 0) return 'nil';
        const v = args[0];
        if (v === NIL) return 'nil';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (isInt(v)) return 'int';
        if (v instanceof XFloat) return 'float';
        if (typeof v === 'string') return 'string';
        if (Array.isArray(v)) return 'list';
        if (v instanceof XDict) return 'dict';
        if (v instanceof XFn) return 'function';
        return 'builtin';
      });
      B('bool', function (args) { return args.length === 0 ? false : truthy(args[0]); });
      B('push', function (args) {
        if (args.length < 2 || !Array.isArray(args[0]))
          throw new XError('push(): expected list, value');
        args[0].push(args[1]);
        return args[0];
      });
      B('append', function (args) {
        if (args.length < 2 || !Array.isArray(args[0]))
          throw new XError('append(): expected list, value');
        args[0].push(args[1]);
        return args[0];
      });
      B('pop', function (args) {
        if (args.length === 0 || !Array.isArray(args[0])) throw new XError('pop(): expected list');
        const o = args[0];
        if (o.length === 0) return NIL;
        let idx = args.length >= 2 ? this._truncArg(args[1], 'pop') : o.length - 1;
        if (idx < 0) idx += o.length;
        if (idx < 0 || idx >= o.length) throw new XError('pop(): index out of range');
        return o.splice(idx, 1)[0];
      });
      B('get', function (args) {
        if (args.length < 2) throw new XError('get() needs 2-3 arguments');
        const seq = args[0];
        if (Array.isArray(seq)) {
          let i = this._truncArg(args[1], 'get');
          if (i < 0) i += seq.length;
          if (i < 0 || i >= seq.length) return args.length >= 3 ? args[2] : NIL;
          return seq[i];
        }
        if (seq instanceof XDict) {
          const k = typeof args[1] === 'string' ? args[1] : toStr(args[1]);
          if (seq.m.has(k)) return seq.m.get(k);
          return args.length >= 3 ? args[2] : NIL;
        }
        throw new XError('get(): expected list or dict');
      });
      B('set', function (args) {
        if (args.length < 3) throw new XError('set() needs 3 arguments');
        const seq = args[0];
        if (Array.isArray(seq)) {
          let i = this._truncArg(args[1], 'set');
          if (i < 0) i += seq.length;
          if (i < 0 || i >= seq.length) throw new XError('set(): index out of range');
          seq[i] = args[2];
        } else if (seq instanceof XDict) {
          const k = typeof args[1] === 'string' ? args[1] : toStr(args[1]);
          seq.m.set(k, args[2]);
        } else throw new XError('set(): expected list or dict');
        return seq;
      });
      B('contains', function (args) {
        if (args.length < 2) throw new XError('contains() needs 2 arguments');
        const seq = args[0];
        if (Array.isArray(seq)) {
          for (const v of seq) if (eq(v, args[1])) return true;
          return false;
        }
        if (seq instanceof XDict) {
          const k = typeof args[1] === 'string' ? args[1] : toStr(args[1]);
          return seq.m.has(k);
        }
        if (typeof seq === 'string') {
          return seq.indexOf(typeof args[1] === 'string' ? args[1] : '') !== -1;
        }
        throw new XError('contains(): expected list/dict/string');
      });
      B('keys', function (args) {
        if (args.length === 0 || !(args[0] instanceof XDict)) throw new XError('keys(): expected dict');
        return [...args[0].m.keys()];
      });
      B('values', function (args) {
        if (args.length === 0 || !(args[0] instanceof XDict)) throw new XError('values(): expected dict');
        return [...args[0].m.values()];
      });
      B('read', function (args) {
        if (args.length === 0 || typeof args[0] !== 'string')
          throw new XError('read() needs a string path');
        const p = args[0];
        if (this.files.has(p)) return this.files.get(p);
        throw new XError("read(): cannot open file '" + p + "'");
      });
      B('write', function (args) {
        if (args.length < 2 || typeof args[0] !== 'string')
          throw new XError('write() needs (path, text)');
        this.files.set(args[0], typeof args[1] === 'string' ? args[1] : toStr(args[1]));
        return NIL;
      });
      B('exit', function (args) {
        const c = args.length === 0 ? 0 : this._truncArg(args[0], 'exit');
        throw new ExitSignal(c);
      });
      B('clock', function () {
        return new XFloat((Date.now() - this.startTime) / 1000);
      });
    }

    _truncArg(v, what) {
      if (!isNum(v)) throw new XError('builtin requires number for ' + what);
      return Math.trunc(num(v));
    }
  }

  /* ---------------------------------------------------------------- public */

  function run(src, opts) {
    let outBuf = '', errBuf = '';
    const o = opts || {};
    const interp = new Interp({
      out: (s) => { outBuf += s; if (o.onOut) o.onOut(s); },
      err: (s) => { errBuf += s; if (o.onErr) o.onErr(s); },
      input: o.input,
      files: o.files,
      timeoutMs: o.timeoutMs !== undefined ? o.timeoutMs : 4000,
      maxOps: o.maxOps,
    });
    const t0 = Date.now();
    const code = interp.run(src);
    return { exitCode: code, stdout: outBuf, stderr: errBuf, ms: Date.now() - t0 };
  }

  const XPP = { run, parse, Interp, XError, XFloat, XDict, XFn, NIL, display, truthy, fmtDouble };
  if (typeof module !== 'undefined' && module.exports) module.exports = XPP;
  root.XPP = XPP;
})(typeof self !== 'undefined' ? self : globalThis);
