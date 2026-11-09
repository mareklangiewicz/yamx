import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isolate } from './isolated-distribution.mjs';
import { root } from './distribute.mjs';

const temporary = isolate();
const quick = process.argv.includes('--quick');
const shellspec = process.env.SHELLSPEC ? resolve(process.env.SHELLSPEC)
  : existsSync(join(root, '.tools/shellspec/shellspec')) ? join(root, '.tools/shellspec/shellspec') : 'shellspec';
const option = name => { const at = process.argv.indexOf(name); return at < 0 ? null : process.argv[at + 1]; };
const onlyShell = option('--shell');
const onlyLua = option('--lua');
const onlyJs = process.argv.includes('--js');
const failures = [];
const env = { ...process.env, YAMX_DISTRIBUTION: temporary.directory,
  YAMX_JS_CLI: join(temporary.directory, 'js/cli.mjs'),
  YAMX_LUA_CLI: join(temporary.directory, 'lua/cli.lua'),
  YAMX_SHELL_CLI: join(temporary.directory, 'shell/yamx.sh') };
function run(label, command, args, extra = {}) {
  console.log(`\n${label}`);
  const r = spawnSync(command, args, { cwd: root, env: { ...env, ...extra }, stdio: 'inherit', timeout: 120000 });
  if (r.error || r.signal || r.status !== 0) { failures.push(label); console.error(r.error || r.signal || r.status); }
}
try {
  const shells = onlyLua || onlyJs ? [] : onlyShell ? [onlyShell] : quick ? [env.YAMX_SHELL || 'dash'] : ['dash', 'bash', 'zsh', ...(env.YAMX_BUSYBOX ? ['/bin/ash'] : [])];
  for (const shell of shells) {
    if (!quick) run(`Standalone M shared specification: ${shell}`, shellspec, ['--format', 'progress', 'spec/minimal_spec.sh'], { YAMX_IMPL: 'shell', YAMX_SHELL: shell });
    run(`Standalone M interfaces, bytes, CLI, oracle, transports: ${shell}`, process.execPath,
      ['--test', ...(env.YAMX_MUTATION ? ['spec/api.test.mjs', 'spec/cli.test.mjs', 'spec/distribution.test.mjs'] : ['spec/api.test.mjs', 'spec/cli.test.mjs', 'spec/generated.test.mjs', 'spec/interop.test.mjs', 'spec/distribution.test.mjs'])], { YAMX_SHELL: shell, ...(!quick && shell === 'dash' ? { YAMX_JS_BYTES: '1' } : {}) });
  }
  if (!quick && !onlyShell && !onlyLua) {
    run('Standalone M JavaScript shared specification', shellspec, ['--format', 'progress', 'spec/minimal_spec.sh'], { YAMX_IMPL: 'js' });
  }
  if (!quick && !onlyShell && !onlyJs) {
    for (const lua of (onlyLua ? [onlyLua] : ['lua5.1', 'luajit', 'lua5.4'])) {
      run(`Standalone M Lua shared specification: ${lua}`, shellspec, ['--format', 'progress', 'spec/minimal_spec.sh'], { YAMX_IMPL: 'lua', YAMX_LUA: lua });
      run(`Standalone M Lua interfaces, CLI, bytes, transports: ${lua}`, process.execPath,
        ['--test', 'spec/distribution.test.mjs', 'spec/cli.test.mjs', 'spec/interop.test.mjs'], { YAMX_LUA: lua });
    }
  }
} finally { temporary.close(); }
console.log(`Standalone gate: ${failures.length ? 'FAIL: ' + failures.join(', ') : 'PASS'}`);
process.exitCode = failures.length ? 1 : 0;
