import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const zero = '0'.repeat(40);

// The stub gate exits 37, so status 37 proves the hook ran the gate and 0 proves it skipped it.
test('pre-push skips the gate only for trees that passed on a clean checkout', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx gate ledger '));
  function run(command, args, input = '') {
    const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', input, timeout: 30000,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'yamx', GIT_AUTHOR_EMAIL: 'yamx@example.invalid',
        GIT_COMMITTER_NAME: 'yamx', GIT_COMMITTER_EMAIL: 'yamx@example.invalid' } });
    if (result.error || result.signal) throw result.error || new Error(result.signal);
    return result;
  }
  const head = () => run('git', ['rev-parse', 'HEAD']).stdout.trim();
  const push = sha => run('sh', ['hooks/pre-push', 'origin', 'url'], `refs/heads/main ${sha} refs/heads/main ${zero}\n`);
  const commit = (file, text) => {
    writeFileSync(join(directory, file), text);
    run('git', ['add', file]);
    assert.equal(run('git', ['commit', '-qm', file]).status, 0);
  };
  try {
    for (const path of ['scripts', 'hooks']) cpSync(join(root, path), join(directory, path), { recursive: true });
    writeFileSync(join(directory, 'scripts/check.sh'), '#!/bin/sh\nexit 37\n');
    run('git', ['init', '-q']);
    run('git', ['add', '.']);
    run('git', ['commit', '-qm', 'base']);
    const ledger = await import(pathToFileURL(join(directory, 'scripts/gate-ledger.mjs')).href);

    assert.equal(push(head()).status, 37, 'an unrecorded tree runs the gate');
    const passed = ledger.cleanTree(directory);
    assert.match(passed, /^[0-9a-f]{40}$/);
    assert.equal(ledger.recordPass(directory, passed), true);
    const hit = push(head());
    assert.equal(hit.status, 0, hit.stderr);
    assert.match(hit.stdout, /already passed/);

    run('git', ['commit', '-q', '--amend', '-m', 'reworded']);
    assert.equal(push(head()).status, 0, 'a reworded commit keeps its tree');
    assert.equal(run('sh', ['hooks/pre-push'], `(delete) ${zero} refs/heads/old ${head()}\n`).status, 0,
      'a deletion pushes no content');
    assert.equal(run('sh', ['hooks/pre-push'], '').status, 37, 'empty input is not evidence of a pass');

    writeFileSync(join(directory, 'untracked.txt'), 'x\n');
    assert.equal(ledger.cleanTree(directory), null, 'untracked files make the checkout unclean');
    rmSync(join(directory, 'untracked.txt'));
    writeFileSync(join(directory, 'hooks/pre-push'), '#!/bin/sh\nexit 1\n');
    assert.equal(ledger.cleanTree(directory), null, 'unstaged edits make the checkout unclean');
    run('git', ['checkout', '--', 'hooks/pre-push']);

    commit('changed.txt', 'new content\n');
    const changed = head();
    assert.equal(push(changed).status, 37, 'new content runs the gate');
    const started = ledger.cleanTree(directory);
    commit('during.txt', 'edited while the gate ran\n');
    assert.equal(ledger.recordPass(directory, started), false, 'a tree changed during the gate is not recorded');
    assert.equal(push(changed).status, 37);
    assert.equal(run('sh', ['hooks/pre-push'],
      `refs/heads/a ${changed} refs/heads/a ${zero}\nrefs/heads/b ${head()} refs/heads/b ${zero}\n`).status, 37,
    'every pushed tree must be recorded');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
