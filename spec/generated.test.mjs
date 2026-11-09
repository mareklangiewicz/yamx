import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse as yamlParse } from 'yaml';
import { parse, generate } from '../src/yamx.mjs';
import { cli, fixture } from './helpers.mjs';

function random(seed) {
  let state = seed;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
}

test('seeded YAM(M) documents agree with independently generated values and YAML 1.2 Core', () => fixture(({ write }) => {
  for (let seed = 1; seed <= 8; seed++) {
    const next = random(seed);
    const entries = [['yes', 'true'], ['__proto__', 'ordinary'], ['constructor', '01.20']];
    for (let index = 0; index < 32; index++) {
      const chars = Array.from({ length: next() % 80 }, () => {
        const byte = 32 + next() % 94;
        return String.fromCharCode(byte >= 39 ? byte + 1 : byte);
      });
      entries.push([`key_${index}`, chars.join('')]);
    }
    const text = entries.map(([key, value]) => `${key}: '${value}'\n`).join('');
    assert.deepEqual(parse(text), entries, `seed ${seed}`);
    assert.equal(generate(entries), text, `seed ${seed}`);
    const oracle = yamlParse(text, { version: '1.2', schema: 'core', mapAsMap: true });
    assert.deepEqual([...oracle], entries, `independent YAML oracle, seed ${seed}`);
    const tsv = entries.map(([key, value]) => `${key}\t${value}\n`).join('');
    const parsed = cli('shell', ['parse', write(text)]);
    assert.equal(parsed.status, 0, `seed ${seed}: ${parsed.stderr}`);
    assert.equal(parsed.stdout, tsv);
    const emitted = cli('shell', ['generate', write(tsv)]);
    assert.equal(emitted.status, 0, `seed ${seed}: ${emitted.stderr}`);
    assert.equal(emitted.stdout, text);
  }
}));

test('near misses at grammar boundaries are rejected with no partial output', () => fixture(({ write }) => {
  const valid = "key: '  text  '\n";
  const invalid = [valid.slice(0, -1), valid.replace('\n', '\r\n'),
    valid.replace('key', 'Key'), valid.replace(': ', ':  '), valid.replace("'  text  '", 'bare'),
    valid.replace('text', "can\'t"), valid + "other: 'bad\0'\n", valid + valid,
    `\uFEFF${valid}`, valid + '\n', valid.replace('text', 'téxt')];
  for (const text of invalid) {
    assert.throws(() => parse(text));
    const result = cli('shell', ['parse', write(text)]);
    assert.equal(result.status, 1, JSON.stringify(text));
    assert.equal(result.stdout, '');
  }
}));

test('long keys and values complete within the subprocess smoke-test budget', () => fixture(({ write }) => {
  // Native zsh suffix scans previously took seconds even at 25 KiB. This is a
  // generous hang/regression guard, not a precise timing or complexity proof.
  const entries = [[`key_${'x'.repeat(65536)}`, 'x'.repeat(65536)]];
  const text = `${entries[0][0]}: '${entries[0][1]}'\n`;
  const tsv = `${entries[0][0]}\t${entries[0][1]}\n`;
  assert.deepEqual(parse(text), entries);
  assert.equal(generate(entries), text);
  for (const operation of ['parse', 'validate', 'generate']) {
    const result = cli('shell', [operation, write(operation === 'generate' ? tsv : text)]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, operation === 'validate' ? '' : operation === 'parse' ? tsv : text);
  }
}));
