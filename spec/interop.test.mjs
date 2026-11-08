import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, parse } from '../src/yamx.mjs';

function withShell(run) {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-test-'));
  const file = join(directory, 'input');
  const shell = (operation, input) => {
    writeFileSync(file, input);
    const result = spawnSync(process.env.YAMX_SHELL || 'sh', ['src/yamx.sh', operation, file], { timeout: 5000 });
    if (result.error) throw result.error;
    assert.equal(result.signal, null);
    return { status: result.status, stdout: result.stdout, stderr: result.stderr.toString() };
  };
  try { run(shell); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('each byte is either preserved as a string character or rejected', () => {
  withShell(shell => {
    for (let byte = 0; byte <= 255; byte++) {
      const input = Buffer.concat([Buffer.from("value: '"), Buffer.from([byte]), Buffer.from("'\n")]);
      const allowed = byte >= 32 && byte <= 126 && byte !== 39;
      const result = shell('parse', input);
      assert.equal(result.status, allowed ? 0 : 1, `byte ${byte}`);
      if (allowed) {
        const expected = [['value', String.fromCharCode(byte)]];
        assert.deepEqual(parse(input.toString('latin1')), expected);
        assert.equal(result.stdout.toString(), `value\t${String.fromCharCode(byte)}\n`);
        assert.equal(result.stderr, '');
      } else {
        assert.throws(() => parse(input.toString('latin1')), undefined, `byte ${byte}`);
        assert.equal(result.stdout.length, 0, `no partial data for byte ${byte}`);
      }
    }
  });
});

test('shell and JavaScript can consume each other\'s generated documents', () => {
  withShell(shell => {
    const entries = [['empty', ''], ['url', 'https://example.org/a#b'], ['space', '  x  '],
      ['literal', '$(id) `id` \\ "quoted"'], ['__proto__', 'ordinary key']];
    const tsv = entries.map(([key, value]) => `${key}\t${value}\n`).join('');
    const generated = shell('generate', tsv);
    assert.equal(generated.status, 0);
    assert.equal(generated.stderr, '');
    assert.deepEqual(parse(generated.stdout.toString()), entries);
    assert.equal(generated.stdout.toString(), generate(entries));
    const parsed = shell('parse', generate(entries));
    assert.equal(parsed.status, 0);
    assert.equal(parsed.stderr, '');
    assert.equal(parsed.stdout.toString(), tsv);
  });
});
