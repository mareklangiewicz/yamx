import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { cli, fixture, root } from './helpers.mjs';

test('Lua public API preserves types and rejects unrepresentable values', () => {
  const result = spawnSync(process.env.YAMX_LUA || 'lua5.1', ['spec/lua_api.lua'], {
    cwd: root, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Lua API contracts passed\n');
});

test('Lua CLI treats apostrophes and shell syntax in paths as literal data', () => fixture(({ directory }) => {
  const path = join(directory, "quote'$(exit 99)`exit 99`;\n-input");
  writeFileSync(path, "a: 'x'\n");
  const result = cli('lua', ['parse', path]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'a\tx\n');
  const scripts = join(directory, "scripts ' with spaces");
  mkdirSync(scripts);
  for (const name of ['cli.lua', 'yamx.lua']) copyFileSync(join(root, 'src', name), join(scripts, name));
  const relocated = spawnSync(process.env.YAMX_LUA || 'lua5.1', [join(scripts, 'cli.lua'), 'parse', path], {
    cwd: directory, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(relocated.error);
  assert.equal(relocated.status, 0, relocated.stderr);
  assert.equal(relocated.stdout, 'a\tx\n');
}));
