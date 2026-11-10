import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, openSync, closeSync } from 'node:fs';
import { parse as yamlParse } from 'yaml';
import { cli, fixture, jsLibrary, distribution, distributionProfile } from './helpers.mjs';
const { parse, generate, validate, YamxError } = await import(jsLibrary);
const { nodeText, treeNodes } = await import(distribution ? jsLibrary : new URL('../src/balanced.mjs', import.meta.url));
const standalone = distribution && distributionProfile === 'B';

const parseB = text => parse(text, 'B');
const generateB = value => generate(value, 'B');
const example = readFileSync(new URL('../examples/balanced.yaml', import.meta.url), 'utf8');
const run = (impl, operation, text) => fixture(({ write }) => cli(impl, ['--profile', 'B', operation, write(text)]));
function normalizeZero(value) {
  if (value instanceof Map) return new Map([...value].map(([key, child]) => [key, normalizeZero(child)]));
  if (Array.isArray(value)) return value.map(normalizeZero);
  return Object.is(value, -0) ? 0 : value;
}
const oracle = text => normalizeZero(yamlParse(text, { version: '1.2', schema: 'core', mapAsMap: true }));
function rejectAll(text, code, line, operation = 'parse') {
  if (operation === 'parse') assert.throws(() => parseB(text), error => error instanceof YamxError
    && (!code || error.code === code) && (!line || error.line === line), text);
  for (const impl of ['shell', 'js', 'lua']) {
    const result = run(impl, operation, text);
    assert.equal(result.status, 1, `${impl}: ${JSON.stringify(text)}: ${result.stderr}`);
    assert.equal(result.stdout, '');
    if (code) assert.match(result.stderr, new RegExp(`^${code} line ${line || '[0-9]+'}:`));
  }
}
function acceptAll(text, expected, useOracle = true) {
  assert.deepEqual(parseB(text), expected);
  if (useOracle) assert.deepEqual(oracle(text), expected);
  const transport = nodeText(treeNodes(expected));
  for (const impl of ['shell', 'js', 'lua']) {
    const result = run(impl, 'parse', text);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, transport);
    const generated = run(impl, 'generate', transport);
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(generated.stderr, '');
    assert.equal(generated.stdout, generateB(expected));
    if (useOracle) assert.deepEqual(oracle(generated.stdout), expected);
  }
}

test('B example has independently expected nested meanings and YAML Core types', () => {
  acceptAll(example, new Map([
    ['name', 'YAMX'], ['active', true], ['retries', 3], ['optional', null],
    ['items', [new Map([['name', "Marek's tools"], ['url', 'https://example.org/a#fragment'],
      ['labels', ['shell', 'portable']]])]], ['empty', new Map()],
  ]));
  assert.equal(validate(example, 'B'), undefined);
});

test('B scalar boundaries include all printable string bytes, quoting gotchas and safe integer extremes', () => {
  const alphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join('');
  const expected = new Map([['alphabet', alphabet], ['quotes', "'''"], ['empty', ''],
    ['max', Number.MAX_SAFE_INTEGER], ['min', Number.MIN_SAFE_INTEGER], ['zero', 0],
    ['yes', 'yes'], ['no', 'no'], ['on', 'on'], ['off', 'off'], ['path', '/tmp/a'],
    ['hash', 'a#b'], ['colon', 'a:b'], ['space', '  x  '], ['literal', 'true']]);
  acceptAll(generateB(expected), expected);
  acceptAll("a: '''''''' # 'comment quotes'\nb: 'can''t # hash'\nc: -0\n", new Map([
    ['a', "'''"], ['b', "can't # hash"], ['c', 0],
  ]));
  for (const text of ['{}\n', '[]\n', '# comment\n\n{} # empty\n']) acceptAll(text, text.includes('{}') ? new Map() : []);
  acceptAll('- yes\n- false\n- null\n- []\n- {}\n', ['yes', false, null, [], new Map()]);
});

test('B is a strict superset of M without changing M defaults or string semantics', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const entries = Array.from({ length: seed }, (_, i) => [`key_${i}`, ` ${seed} # : \\ true `]);
    const minimal = standalone ? entries.map(([key, value]) => `${key}: '${value}'\n`).join('') : generate(entries);
    const expected = new Map(entries);
    if (!standalone) assert.deepEqual(parse(minimal), entries);
    acceptAll(minimal, expected);
  }
  if (standalone) assert.deepEqual(parse('name: bare\n'), new Map([['name', 'bare']]));
  else {
    assert.throws(() => parse('name: bare\n'), YamxError);
    for (const impl of ['shell', 'js', 'lua']) {
      const explicit = fixture(({ write }) => cli(impl, ['--profile', 'M', 'parse', write("name: 'x'\n")]));
      assert.equal(explicit.status, 0, explicit.stderr);
      assert.equal(explicit.stdout, 'name\tx\n');
    }
  }
  assert.throws(() => parse('a: x\n', 'unknown'), TypeError);
  assert.throws(() => validate('a: x\n', 'unknown'), TypeError);
  assert.throws(() => generate([], 'unknown'), TypeError);
});

test('B nesting is exact, bounded, and does not conflate map scopes or mixed collections', () => {
  acceptAll('left:\n  name: x\nright:\n  name: y\n', new Map([
    ['left', new Map([['name', 'x']])], ['right', new Map([['name', 'y']])],
  ]));
  const nested = depth => Array.from({ length: depth }, (_, i) => `${'  '.repeat(i)}a:`).join('\n')
    + `\n${'  '.repeat(depth)}leaf: x\n`;
  const deepest = nested(31);
  let tree = new Map([['leaf', 'x']]);
  for (let i = 0; i < 31; i++) tree = new Map([['a', tree]]);
  acceptAll(deepest, tree);
  rejectAll(nested(32), 'E_DEPTH', 33);
  for (const text of [
    ' a: x\n', 'a:\n b: x\n', 'a:\n    b: x\n', 'a: x\n  b: y\n',
    'a: {}\n  b: x\n', 'a: []\n  - x\n', 'a:\nb: x\n', 'a:\n# end\n',
    'a: x\n- y\n', '- x\na: y\n', '-\n  - x\n  a: y\n', '{}\na: x\n',
    'a:\n  b:\n    c: x\n  - y\n', '- x\n  - y\n', 'x\n', 'null\n',
  ]) rejectAll(text);
  rejectAll('# first\na: one\n\na: two\n', 'E_DUPLICATE', 4);
  rejectAll('a:\n  x: one\n  x: two\n', 'E_DUPLICATE', 3);
  rejectAll('a: {}\na: []\n', 'E_DUPLICATE', 2);
});

test('B bytes and document boundaries reject controls even in ignored comments', () => {
  rejectAll('', 'E_EMPTY', 1);
  rejectAll('# only\n \n', 'E_EMPTY', 1);
  rejectAll('a: x', 'E_NEWLINE', 1);
  for (const byte of [0, 9, 13, 31, 127, 128, 255])
    rejectAll(`a: ok\n# bad ${String.fromCharCode(byte)}\n`, 'E_CHARACTER', 2);
});

test('B generation rejects malformed node transports atomically', () => {
  for (const text of [
    '0\tstr\t\tx\n', '1\tmap\t\t\n', '00\tmap\t\t\n', '33\tmap\t\t\n',
    '0\tmap\t\t\n0\tmap\t\t\n', '0\tmap\tkey\t\n', '0\tmap\t\tvalue\n',
    '0\tmap\t\t\n2\tstr\tkey\tx\n', '0\tmap\t\t\n1\tstr\ta\tx\n2\tstr\tb\ty\n',
    '0\tmap\t\t\n1\tother\ta\tx\n', '0\tmap\t\t\n1\tbool\ta\tTRUE\n',
    '0\tmap\t\t\n1\tnull\ta\tnull\n', '0\tmap\t\t\n1\tint\ta\t1.5\n',
    '0\tmap\t\t\n1\tint\ta\t9007199254740992\n', '0\tseq\t\t\n1\tstr\ta\tx\n',
    '0\tmap\t\t\n1\tstr\ttrue\tx\n', '0\tmap\t\t\n1\tstr\ta\tx\textra\n',
    '0\tmap\t\t\n\n', '0\tmap\t\t',
  ]) rejectAll(text, undefined, undefined, 'generate');
  rejectAll('0\tmap\t\t\n1\tstr\ta\tx\n1\tstr\ta\ty\n', 'E_DUPLICATE', 3, 'generate');
  for (const impl of ['shell', 'js', 'lua']) {
    const result = run(impl, 'generate', '0\tmap\t\t\n1\tint\tzero\t-0\n');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'zero: 0\n');
  }
});

test('B API generation refuses malformed values, cycles and sparse arrays', () => {
  const cycle = []; cycle.push(cycle);
  const mapCycle = new Map(); mapCycle.set('self', mapCycle);
  for (const value of [null, 'x', true, 1, {}, new Set(), cycle, mapCycle, new Array(2),
    new Map([['true', 'x']]), new Map([[1, 'x']]), new Map([['x', undefined]]),
    new Map([['x', 1.5]]), [NaN], [Infinity], [1n], ['é'], ['\t'], ['\n'],
    [Number.MAX_SAFE_INTEGER + 1],
  ]) assert.throws(() => generateB(value), YamxError);
  const shared = new Map([['name', 'x']]);
  acceptAll(generateB([shared, shared]), [shared, shared]);
  let tooDeep = 'leaf';
  for (let i = 0; i < 33; i++) tooDeep = [tooDeep];
  assert.throws(() => generateB(tooDeep), error => error.code === 'E_DEPTH');
});

test('B CLI has the same usage, I/O, cwd and output failure guarantees as M', () => fixture(({ write, directory }) => {
  for (const impl of ['shell', 'js', 'lua']) {
    for (const args of [ ['--profile'], ['--profile', 'X', 'parse', write('a: x\n')],
      ['--profile', 'B', 'parse', directory], ['--profile', 'B', 'parse', '/dev/null'],
      ['--profile', 'B', 'parse', `${directory}/missing`], ['--profile', 'B', 'bogus', write('a: x\n')],
      ['--profile', 'B', 'parse', write('a: x\n'), 'extra'],
    ]) {
      const result = cli(impl, args);
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, '');
    }
    const result = cli(impl, ['--profile', 'B', 'parse', write('a: x\n')], {
      cwd: directory, env: { ...process.env, LC_ALL: 'C.UTF-8', IFS: ':x' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '0\tmap\t\t\n1\tstr\ta\tx\n');
    const fd = openSync('/dev/full', 'w');
    try {
      const failed = cli(impl, ['--profile', 'B', 'parse', write('a: x\n')], { stdio: ['ignore', fd, 'pipe'] });
      assert.equal(failed.status, 2);
      assert.match(failed.stderr, /E_IO/);
    } finally { closeSync(fd); }
  }
}));

test('B long strings, many apostrophes and long keys finish without prefix rescans', () => {
  const expected = new Map([[`key_${'x'.repeat(50000)}`, "a'".repeat(25000)], ['tail', 'x'.repeat(100000)]]);
  // M already accepts unbounded keys, beyond YAML's implicit-key limit.
  // Keep B a superset; this inherited boundary is documented, not oracle-certified.
  acceptAll(generateB(expected), expected, false);
});

test('seeded nested B trees have independent expected meanings and cross-language generation', () => {
  const words = ['alpha', "can't", 'true', '  spaced  ', 'a#b', 'a: b', '', 'C:\\tmp'];
  for (let seed = 1; seed <= 12; seed++) {
    let state = seed;
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
    function value(depth) {
      const choice = next() % (depth < 4 ? 8 : 6);
      if (choice < 2) return words[next() % words.length];
      if (choice === 2) return null;
      if (choice === 3) return !!(next() % 2);
      if (choice < 6) return next() % 200000 - 100000;
      const children = next() % 5;
      if (choice === 6) return Array.from({ length: children }, () => value(depth + 1));
      return new Map(Array.from({ length: children }, (_, i) => [`key_${i}`, value(depth + 1)]));
    }
    const expected = new Map([['seed', seed], ['items', Array.from({ length: 8 }, () => value(0))]]);
    const canonical = generateB(expected);
    acceptAll(canonical, expected);
    // Exercise presentation rules independently of canonical generation.
    const decorated = '# seed\n\n' + canonical.split('\n').filter(Boolean)
      .map(line => `${line} # node\n\n`).join('');
    acceptAll(decorated, expected);
  }
});

test('B plain strings with long interior space runs do not rescan suffixes', () => {
  // The old unanchored / +#.../ scan exceeded the five-second CLI budget.
  const value = `a${' '.repeat(131072)}b`;
  acceptAll(`value: ${value}\n`, new Map([['value', value]]));
});
