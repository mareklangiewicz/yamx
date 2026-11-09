import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSync, closeSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cli, fixture, root, shell } from './helpers.mjs';

for (const implementation of ['shell', 'js', 'lua']) {
  test(`${implementation}: usage and input failures exit 2 without data`, () => fixture(({ file, directory, write }) => {
    write("name: 'x'\n");
    for (const args of [[], ['parse'], ['unknown', file], ['parse', file, 'extra'],
      ['parse', `${file}.missing`], ['parse', directory], ['parse', '/dev/null']]) {
      const result = cli(implementation, args);
      assert.equal(result.status, 2, JSON.stringify(args));
      assert.equal(result.stdout, '');
      assert.notEqual(result.stderr, '');
    }
  }));

  test(`${implementation}: output I/O failures exit 2`, () => fixture(({ write }) => {
    const fd = openSync('/dev/full', 'w');
    try {
      const result = cli(implementation, ['parse', write("name: 'x'\n")], { stdio: ['ignore', fd, 'pipe'] });
      assert.equal(result.status, 2);
      assert.match(result.stderr, /E_IO/);
    } finally { closeSync(fd); }
  }));

  test(`${implementation}: late failures never publish partial output`, () => fixture(({ write }) => {
    for (const [operation, input] of [
      ['parse', "good: 'x'\nbad: bare\n"],
      ['parse', "good: 'x'\nbad: '\0'\n"],
      ['generate', "good\tx\nbad\tcan't\n"],
      ['generate', 'good\tx\nbad\t\0\n'],
    ]) {
      const result = cli(implementation, [operation, write(input)]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /line 2:/);
    }
  }));

  test(`${implementation}: parsing is independent of caller cwd, locale, and IFS`, () => fixture(({ directory, write }) => {
    const result = cli(implementation, ['parse', write("yes: '  literal $() `id`  '\n")], {
      cwd: directory, env: { ...process.env, LC_ALL: 'C.UTF-8', IFS: ':x' },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'yes\t  literal $() `id`  \n');
    assert.equal(result.stderr, '');
  }));
}

test('shell reports missing runtime utilities and cleans up temporary files', () => fixture(({ directory, file, write }) => {
  write("name: 'x'\n");
  const command = shell.startsWith('/') ? shell : process.env.PATH.split(':')
    .map(directory => join(directory, shell)).find(path => existsSync(path));
  assert.ok(command, `required shell ${shell} is installed`);
  const missing = spawnSync(command, [join(root, 'src/yamx.sh'), 'parse', file], {
    encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: directory },
  });
  assert.ifError(missing.error);
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /E_IO: missing utility: od/);
  for (const text of ["name: 'x'\n", "name: 'x'\nname: 'y'\n", "name: '\0'\n"]) {
    const result = cli('shell', ['parse', write(text)], { env: { ...process.env, TMPDIR: directory } });
    assert.equal(result.status, text === "name: 'x'\n" ? 0 : 1);
    assert.deepEqual(readdirSync(directory), [file.slice(directory.length + 1)]);
  }
  const noScratch = cli('shell', ['parse', file], { env: { ...process.env, TMPDIR: join(directory, 'absent') } });
  assert.equal(noScratch.status, 2);
  assert.equal(noScratch.stdout, '');
  assert.match(noScratch.stderr, /E_IO/);
}));

test('shell distinguishes a failed byte-inspection utility from invalid data', () => fixture(({ directory, write }) => {
  writeFileSync(join(directory, 'awk'), '#!/bin/sh\nexit 2\n', { mode: 0o700 });
  const result = cli('shell', ['validate', write("name: 'x'\n")], {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /E_IO/);
}));
