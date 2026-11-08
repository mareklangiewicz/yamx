import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('fresh-checkout setup installs a working gate and preserves existing hook choices', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'yamx fresh checkout '));
  function run(command, args) {
    const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, npm_config_offline: 'true',
        SHELLSPEC: process.env.SHELLSPEC?.includes('/') ? resolve(root, process.env.SHELLSPEC) : 'shellspec' } });
    if (result.error || result.signal) throw result.error || new Error(result.signal);
    return result;
  }
  try {
    for (const path of ['scripts', 'hooks', 'package.json', 'package-lock.json'])
      cpSync(join(root, path), join(directory, path), { recursive: true });
    assert.equal(run('git', ['init', '-q']).status, 0);
    assert.notEqual(run('sh', ['scripts/setup.sh', '--verify']).status, 0);
    const installed = run('sh', ['scripts/setup.sh']);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(run('sh', ['scripts/setup.sh', '--verify']).status, 0);
    writeFileSync(join(directory, 'scripts/check.sh'), '#!/bin/sh\nexit 37\n');
    assert.equal(run('sh', ['hooks/pre-push']).status, 37, 'the hook must propagate a failed gate');
    assert.equal(run('git', ['config', '--local', 'core.hooksPath', 'custom-hooks']).status, 0);
    assert.notEqual(run('sh', ['scripts/setup.sh']).status, 0, 'preserve custom hook configuration');
    assert.equal(run('git', ['config', '--local', '--get', 'core.hooksPath']).stdout.trim(), 'custom-hooks');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
