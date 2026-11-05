import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, parse, validate, YamxError } from '../src/yamx.mjs';

test('every supported string byte survives generation and parsing', () => {
  for (let code = 32; code <= 126; code++) {
    if (code === 39) continue;
    const entries = [['value', ` ${String.fromCharCode(code)} `]];
    assert.deepEqual(parse(generate(entries)), entries);
  }
});

test('canonical documents survive parsing and generation byte for byte', () => {
  const text = "__proto__: 'literal'\nempty: ''\nspaces: '  x  '\n";
  assert.equal(generate(parse(text)), text);
  assert.equal(validate(text), undefined);
});

test('generation refuses unrepresentable values and malformed entries', () => {
  const cases = [
    [[], 'E_EMPTY'],
    [[['key', "can't"]], 'E_STRING'],
    [[['key', '\n']], 'E_STRING'],
    [[['key', 'é']], 'E_STRING'],
    [[['key', 123]], 'E_STRING'],
    [[['key', 'x'], ['key', 'y']], 'E_DUPLICATE'],
    [[['true', 'x']], 'E_KEY'],
    [[['key']], 'E_SYNTAX'],
  ];
  for (const [entries, code] of cases)
    assert.throws(() => generate(entries), error => error instanceof YamxError && error.code === code);
});
