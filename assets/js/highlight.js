/* ==========================================================================
 * X++ syntax highlighter — tiny, dependency-free, browser + Node compatible.
 * Produces safe HTML (input is escaped first).
 * ========================================================================== */
(function (root) {
  'use strict';

  const KEYWORDS = new Set([
    'fn', 'end', 'if', 'elif', 'else', 'while', 'loop', 'from', 'to', 'step',
    'in', 'safe', 'fail', 'return', 'out', 'push', 'read', 'break', 'continue',
    'true', 'false', 'nil', 'and', 'or', 'not',
  ]);
  const BUILTINS = new Set([
    'print', 'input', 'str', 'int', 'float', 'len', 'abs', 'min', 'max', 'sum',
    'sorted', 'range', 'type', 'bool', 'append', 'pop', 'get', 'set',
    'contains', 'keys', 'values', 'write', 'exit', 'clock',
  ]);

  const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function highlight(src) {
    let out = '';
    let i = 0;
    const n = src.length;

    const isIdStart = (c) => /[A-Za-z_]/.test(c);
    const isId = (c) => /[A-Za-z0-9_]/.test(c);
    const isDigit = (c) => c >= '0' && c <= '9';

    while (i < n) {
      const c = src[i];

      // comments
      if (c === '#') {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        out += '<span class="tk-com">' + esc(src.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // strings
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') {
          if (src[j] === '\\') j++;
          j++;
        }
        if (j < n && src[j] === c) j++;
        out += '<span class="tk-str">' + esc(src.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // numbers
      if (isDigit(c)) {
        let j = i;
        while (j < n && isDigit(src[j])) j++;
        if (src[j] === '.' && isDigit(src[j + 1])) { j++; while (j < n && isDigit(src[j])) j++; }
        if (src[j] === 'e' || src[j] === 'E') {
          let k = j + 1;
          if (src[k] === '+' || src[k] === '-') k++;
          if (isDigit(src[k])) { j = k; while (j < n && isDigit(src[j])) j++; }
        }
        out += '<span class="tk-num">' + src.slice(i, j) + '</span>';
        i = j;
        continue;
      }

      // identifiers / keywords / directives
      if (isIdStart(c)) {
        let j = i;
        while (j < n && isId(src[j])) j++;
        const word = src.slice(i, j);
        // directive line: RNM=... or USE MODEL "..."
        if (word === 'RNM' && src[j] === '=') {
          let k = j;
          while (k < n && src[k] !== '\n') k++;
          out += '<span class="tk-dir">' + esc(src.slice(i, k)) + '</span>';
          i = k;
          continue;
        }
        if (word === 'USE') {
          let k = j;
          while (k < n && src[k] !== '\n') k++;
          out += '<span class="tk-dir">' + esc(src.slice(i, k)) + '</span>';
          i = k;
          continue;
        }
        if (KEYWORDS.has(word)) out += '<span class="tk-kw">' + word + '</span>';
        else if (BUILTINS.has(word) && src[j] === '(') out += '<span class="tk-bi">' + word + '</span>';
        else if (BUILTINS.has(word) && (src[j] === ' ' || src[j] === '\n' || src[j] === '\t' || j >= n)) {
          // bare builtin used as call target (len x, read "f" is kw though)
          out += '<span class="tk-bi">' + word + '</span>';
        } else if (src[j] === '(') {
          out += '<span class="tk-fn">' + word + '</span>';
        } else {
          out += word;
        }
        i = j;
        continue;
      }

      // operators / punctuation
      if ('+-*/%<>=!'.includes(c)) {
        if ((c === '*' && src[i + 1] === '*') ||
            ((c === '=' || c === '!' || c === '<' || c === '>') && src[i + 1] === '=')) {
          out += '<span class="tk-op">' + esc(src.slice(i, i + 2)) + '</span>';
          i += 2;
        } else {
          out += '<span class="tk-op">' + esc(c) + '</span>';
          i++;
        }
        continue;
      }

      out += esc(c);
      i++;
    }
    return out;
  }

  const XPPHL = { highlight, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = XPPHL;
  root.XPPHL = XPPHL;
})(typeof self !== 'undefined' ? self : globalThis);
