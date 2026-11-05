// Core-0 is experimental. Entries are [key, value] pairs, both strings.
export class YamxError extends Error {
  constructor(code, line, message) {
    super(`${code} line ${line}: ${message}`);
    this.code = code;
    this.line = line;
  }
}

const fail = (code, line, message) => { throw new YamxError(code, line, message); };
const keyPattern = /^[a-z_][a-z0-9_-]*$/;
const reserved = new Set(['true', 'false', 'null']);

function checkEntry(key, value, line, seen) {
  if (typeof key !== 'string' || !keyPattern.test(key) || reserved.has(key))
    fail('E_KEY', line, 'expected a non-reserved lowercase identifier');
  if (seen.has(key)) fail('E_DUPLICATE', line, 'duplicate mapping key');
  seen.add(key);
  if (typeof value !== 'string' || !/^[\x20-\x26\x28-\x7e]*$/.test(value))
    fail('E_STRING', line, 'expected printable ASCII without apostrophes');
}

// Shared by the CLI's YAML input and its deliberately restricted TSV transport.
export function checkText(text, allowTab = false) {
  if (typeof text !== 'string') throw new TypeError('expected a string');
  if (text.length === 0) fail('E_EMPTY', 1, 'expected at least one entry');
  let line = 1;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (char === '\n') line++;
    else if (!(code >= 32 && code <= 126) && !(allowTab && char === '\t'))
      fail('E_CHARACTER', line, 'unsupported byte');
  }
  if (!text.endsWith('\n')) fail('E_NEWLINE', line, 'expected a final LF');
}

export function parse(text) {
  checkText(text);
  const seen = new Set();
  return text.slice(0, -1).split('\n').map((line, index) => {
    const match = /^([^:]*): '(.*)'$/.exec(line);
    if (!match) fail('E_SYNTAX', index + 1, 'expected key: quoted-value');
    const [, key, value] = match;
    checkEntry(key, value, index + 1, seen);
    return [key, value];
  });
}

export function validate(text) {
  parse(text); // Validation and parsing deliberately use the same grammar.
}

export function generate(entries) {
  if (!Array.isArray(entries)) throw new TypeError('expected an array of entries');
  if (entries.length === 0) fail('E_EMPTY', 1, 'expected at least one entry');
  const seen = new Set();
  return entries.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2)
      fail('E_SYNTAX', index + 1, 'expected a key/value pair');
    const [key, value] = entry;
    checkEntry(key, value, index + 1, seen);
    return `${key}: '${value}'\n`;
  }).join('');
}
