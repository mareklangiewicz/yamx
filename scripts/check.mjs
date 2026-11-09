import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'yamx-check-'));
const start = performance.now();
const failures = [];
const env = { ...process.env, TMPDIR: temporary };
const pinnedShellspec = join(root, '.tools/shellspec/shellspec');
const shellspec = env.SHELLSPEC || (existsSync(pinnedShellspec) ? pinnedShellspec : 'shellspec');
function run(label, command, args, extraEnv = {}) {
  console.log(`\n${label}`);
  const result = spawnSync(command, args, {
    cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit', timeout: 120000,
  });
  if (result.error || result.signal || result.status !== 0) {
    failures.push(label);
    console.error(result.error?.message || `Failed: ${label} (${result.signal || result.status})`);
  }
}
try {
  run('Static checks', 'sh', ['scripts/lint.sh']);
  for (const shell of ['dash', 'bash', 'zsh']) {
    run(`Required shell: ${shell}`, shell, ['-c', 'exit 0']);
    run(`YAM(M) and YAM(B) specifications: ${shell}`, shellspec, ['--format', 'progress', 'spec'], {
      YAMX_IMPL: 'shell', YAMX_SHELL: shell,
    });
    run(`API, bytes, generated cases, CLI: ${shell}`, process.execPath,
      ['--test', 'spec/balanced.test.mjs', 'spec/api.test.mjs', 'spec/cli.test.mjs', 'spec/generated.test.mjs', 'spec/interop.test.mjs'],
      { YAMX_SHELL: shell });
  }
  for (const lua of ['lua5.1', 'luajit', 'lua5.4']) {
    run(`Lua syntax: ${lua}`, lua, ['-e', "assert(loadfile('src/yamx.lua')); assert(loadfile('src/cli.lua')); assert(loadfile('spec/lua_api.lua'))"]);
    run(`Lua shared specification: ${lua}`, shellspec, ['--format', 'progress', 'spec'],
      { YAMX_IMPL: 'lua', YAMX_LUA: lua });
    run(`Lua API and CLI contracts: ${lua}`, process.execPath,
      ['--test', 'spec/lua.test.mjs', 'spec/balanced.test.mjs', 'spec/cli.test.mjs'], { YAMX_LUA: lua });
  }
  run('JavaScript shared specification', shellspec, ['--format', 'progress', 'spec'], { YAMX_IMPL: 'js' });
} finally { rmSync(temporary, { recursive: true, force: true }); }
console.log(`\nGate: ${failures.length ? 'FAIL' : 'PASS'} in ${((performance.now() - start) / 1000).toFixed(1)}s`);
if (failures.length) console.error(`Failed checks: ${failures.join(', ')}`);
process.exitCode = failures.length ? 1 : 0;
