// Profile dispatch and YAM(M) pair-list API; B uses Map/array trees.
import { checkText, YamxError } from './common.mjs';
import { parseBalanced, validateBalanced, generateBalanced } from './balanced.mjs';
export { checkText, YamxError } from './common.mjs';

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

export function parse(text, profile = 'M') {
  if (profile === 'B') return parseBalanced(text);
  if (profile !== 'M') throw new TypeError('unknown profile');
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

export function validate(text, profile = 'M') {
  if (profile === 'B') return validateBalanced(text);
  if (profile !== 'M') throw new TypeError('unknown profile');
  parse(text); // Validation and parsing deliberately use the same grammar.
}

export function generate(entries, profile = 'M') {
  if (profile === 'B') return generateBalanced(entries);
  if (profile !== 'M') throw new TypeError('unknown profile');
  if (!Array.isArray(entries)) throw new TypeError('expected an array of entries');
  if (entries.length === 0) fail('E_EMPTY', 1, 'expected at least one entry');
  const seen = new Set();
  return Array.from(entries, (entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2)
      fail('E_SYNTAX', index + 1, 'expected a key/value pair');
    const [key, value] = entry;
    checkEntry(key, value, index + 1, seen);
    return `${key}: '${value}'\n`;
  }).join('');
}
