import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assemble, licenseNotice, root } from '../scripts/distribute.mjs';

test('assembly is deterministic and the gate rejects stale distributed code', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-drift-'));
  const run = (...args) => {
    const r = spawnSync(process.execPath, ['scripts/distribute.mjs', ...args], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    assert.ifError(r.error);
    assert.equal(r.signal, null);
    return r;
  };
  try {
    for (const folder of ['LICENSE', 'src', 'scripts', 'dist']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
    for (const profile of ['M', 'B']) assert.deepEqual(assemble(directory, profile), assemble(directory, profile));
    assert.equal(run('--check').status, 0);
    const path = join(directory, 'src/minimal.mjs');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n// maintained-source edit\n');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale distribution/);
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const awk = join(directory, 'src/balanced.awk');
    writeFileSync(awk, readFileSync(awk, 'utf8') + '\n# maintained B source edit\n');
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    writeFileSync(join(directory, 'dist/balanced/yamx.lua'), '-- stale\n');
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    // The copyright notice is derived from LICENSE, so a LICENSE edit is drift.
    const license = join(directory, 'LICENSE');
    writeFileSync(license, readFileSync(license, 'utf8').replace(/^Copyright \(c\) .*$/m, 'Copyright (c) 2099 Someone Else'));
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    assert.match(readFileSync(join(directory, 'dist/minimal/yamx.sh'), 'utf8'), /^# Copyright \(c\) 2099 Someone Else$/m);
    writeFileSync(license, 'Some Other License\n');
    assert.notEqual(run().status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('every standalone file carries the MIT notice from LICENSE', () => {
  const notice = licenseNotice(readFileSync(join(root, 'LICENSE'), 'utf8'));
  assert.match(notice, /^Copyright \(c\) 2026 Marek Langiewicz\nSPDX-License-Identifier: MIT\n/);
  for (const folder of ['minimal', 'balanced']) for (const name of ['yamx.sh', 'yamx.mjs', 'yamx.lua', 'cli.mjs', 'cli.lua']) {
    const text = readFileSync(join(root, 'dist', folder, name), 'utf8');
    for (const line of notice.trimEnd().split('\n')) assert.ok(text.includes(` ${line}\n`), `${folder}/${name}: ${line}`);
    assert.doesNotMatch(text, /License choice pending/);
  }
});
