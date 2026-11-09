import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsLibrary } from './helpers.mjs';
const { generate, parse, validate, YamxError } = await import(jsLibrary);

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

test('generation rejects sparse arrays instead of silently dropping entries', () => {
  for (const entries of [new Array(1), [['ok', 'x'], , ['last', 'y']]]) {
    assert.throws(() => generate(entries), error =>
      error instanceof YamxError && error.code === 'E_SYNTAX');
  }
});

test('API errors expose stable codes and one-based line numbers', () => {
  assert.throws(() => parse("first: 'x'\nfirst: 'y'\n"), error =>
    error instanceof YamxError && error.code === 'E_DUPLICATE' && error.line === 2);
  assert.throws(() => generate([['first', 'x'], ['first', 'y']]), error =>
    error instanceof YamxError && error.code === 'E_DUPLICATE' && error.line === 2);
  assert.throws(() => parse("first: 'x'\nsecond: '\0'\n"), error =>
    error instanceof YamxError && error.code === 'E_CHARACTER' && error.line === 2);
});
