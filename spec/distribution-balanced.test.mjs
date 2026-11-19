import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cli, fixture, jsLibrary, distribution, distributionProfile } from './helpers.mjs';
const enabled = distribution && distributionProfile === 'B';

test('standalone B defaults and CLIs exchange typed transport without an M file', { skip: !enabled }, async () => {
  const y = await import(jsLibrary);
  const document = "a:\n  - null\n  - false\n  - {}\n  - []\nb: 'can''t'\n";
  const expected = new Map([['a', [null, false, new Map(), []]], ['b', "can't"]]);
  assert.deepEqual(y.parse(document), expected);
  assert.equal(y.generate(expected), document);
  assert.equal(y.validate(document), undefined);
  fixture(({ write }) => {
    for (const source of ['shell', 'js', 'lua']) {
      const parsed = cli(source, ['parse', write(document)]);
      assert.equal(parsed.status, 0, parsed.stderr);
      for (const target of ['shell', 'js', 'lua']) {
        const generated = cli(target, ['generate', write(parsed.stdout)]);
        assert.equal(generated.status, 0, generated.stderr);
        assert.equal(generated.stdout, document);
      }
    }
  });
});

test('standalone B libraries and CLIs preserve or reject every byte independently', { skip: !enabled }, async () => {
  const y = await import(jsLibrary);
  fixture(({ write }) => {
    for (let byte = 0; byte <= 255; byte++) {
      const character = String.fromCharCode(byte);
      const allowed = byte >= 32 && byte <= 126;
      const input = `value: '${byte === 39 ? "''" : character}'\n`;
      if (allowed) assert.deepEqual(y.parse(input), new Map([['value', character]]));
      else assert.throws(() => y.parse(input), y.YamxError);
      for (const impl of ['shell', ...(process.env.YAMX_JS_BYTES ? ['js'] : []), 'lua']) {
        const result = cli(impl, ['parse', write(Buffer.from(input, 'latin1'))]);
        assert.equal(result.status, allowed ? 0 : 1, `${impl} byte ${byte}: ${result.stderr}`);
        assert.equal(result.stdout, allowed ? `0\tmap\t\t\n1\tstr\tvalue\t${character}\n` : '');
      }
    }
  });
});

test('standalone B guards keep physical diagnostics, map scopes and atomic output', { skip: !enabled }, async () => {
  const y = await import(jsLibrary);
  const document = "left:\n  name: 'can''t'\nright:\n  name: false\nnil: null\n";
  const transport = "0\tmap\t\t\n1\tmap\tleft\t\n2\tstr\tname\tcan't\n1\tmap\tright\t\n2\tbool\tname\tfalse\n1\tnull\tnil\t\n";
  const invalid = [["a: one\na: two\n", 'E_DUPLICATE', 2],
    ["a: ok\nb: '\0'\n", 'E_CHARACTER', 2],
    [Array.from({ length: 33 }, (_, i) => `${'  '.repeat(i)}a:\n`).join(''), 'E_DEPTH', 33]];
  fixture(({ write }) => {
    for (const [input, code, line] of invalid) {
      assert.throws(() => y.parse(input), e => e instanceof y.YamxError && e.code === code && e.line === line);
      for (const impl of ['shell', 'js', 'lua']) for (const operation of ['parse', 'validate']) {
        const rejected = cli(impl, [operation, write(input)]);
        assert.equal(rejected.status, 1, rejected.stderr);
        assert.equal(rejected.stdout, '');
        assert.match(rejected.stderr, new RegExp(`^${code} line ${line}:`));
      }
    }
    for (const impl of ['shell', 'js', 'lua']) for (const [operation, input, output] of [
      ['parse', document, transport], ['generate', transport, document]]) {
      const result = cli(impl, [operation, write(input)]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, output);
    }
  });
});

test('standalone B defaults export typed JSON from the library and every CLI', { skip: !enabled }, async () => {
  const y = await import(jsLibrary);
  const document = "text: 'say \"hi\" C:\\'\nnested:\n  - '-'\n  -\n    n: -0\nlast: true\n";
  const json = '{\n  "text": "say \\"hi\\" C:\\\\",\n  "nested": [\n    "-",\n    {\n      "n": 0\n    }\n  ],\n  "last": true\n}\n';
  assert.equal(y.toJSON("text: 'x'\n"), '{\n  "text": "x"\n}\n');
  assert.throws(() => y.toJSON("text: 'x'\n", 'M'), TypeError);
  fixture(({ write }) => {
    for (const impl of ['shell', 'js', 'lua']) {
      const result = cli(impl, ['json', write(document)]);
      assert.equal(result.status, 0, `${impl}: ${result.stderr}`);
      assert.equal(result.stdout, json, impl);
      const rejected = cli(impl, ['json', write("a: 1\nb: '\\'\nb: 2\n")]);
      assert.equal(rejected.status, 1);
      assert.equal(rejected.stdout, '');
      assert.match(rejected.stderr, /^E_DUPLICATE line 3:/);
    }
  });
});
