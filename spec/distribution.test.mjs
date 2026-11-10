import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, distribution, distributionProfile, cli, fixture, jsLibrary } from './helpers.mjs';

test('standalone libraries load with only their chosen file', { skip: !distribution }, () => {
  assert.deepEqual(readdirSync(join(distribution, 'js-library')), ['yamx.mjs']);
  assert.deepEqual(readdirSync(join(distribution, 'lua-library')), ['yamx.lua']);
  const result = spawnSync(process.env.YAMX_LUA || 'lua5.1', [join(root, distributionProfile === 'B' ? 'spec/lua_api.lua' : 'spec/lua_minimal_api.lua'), join(distribution, 'lua-library/yamx.lua')], {
    cwd: distribution, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, LUA_PATH: '/nonexistent/?.lua', LUA_CPATH: '/nonexistent/?.so' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, distributionProfile === 'B' ? 'Lua API contracts passed\n' : 'Standalone Lua Minimal contracts passed\n');
});

test('standalone interfaces reject the other profile', { skip: !distribution }, async () => {
  const y = await import(jsLibrary);
  const other = distributionProfile === 'B' ? 'M' : 'B';
  for (const fn of [y.parse, y.validate, y.generate]) assert.throws(() => fn('', other), TypeError);
  fixture(({ write }) => {
    for (const impl of ['shell', 'js', 'lua']) {
      const result = cli(impl, ['--profile', other, 'parse', write("a: 'x'\n")]);
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, '');
    }
  });
});
