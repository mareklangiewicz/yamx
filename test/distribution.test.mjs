import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assemble, root } from '../scripts/distribute.mjs';

test('assembly is deterministic and the gate rejects stale distributed code', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-drift-'));
  const run = (...args) => {
    const r = spawnSync(process.execPath, ['scripts/distribute.mjs', ...args], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    assert.ifError(r.error);
    assert.equal(r.signal, null);
    return r;
  };
  try {
    for (const folder of ['src', 'scripts', 'dist']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
    assert.deepEqual(assemble(directory), assemble(directory));
    assert.equal(run('--check').status, 0);
    const path = join(directory, 'src/minimal.mjs');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n// maintained-source edit\n');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale distribution/);
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    writeFileSync(join(directory, 'dist/minimal/yamx.lua'), '-- stale\n');
    assert.notEqual(run('--check').status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
