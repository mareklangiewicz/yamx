// Small reviewed fault catalogue; each mutant gets its own disposable checkout.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble } from './distribute.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const shell = process.env.YAMX_SHELL || 'dash';
const mutations = [
  ['Lua byte gate', 'src/yamx.lua', 'if bad then', 'if false then'],
  ['Lua null preservation', 'src/yamx.lua', "elseif n.kind == 'null' then value = M.null", "elseif n.kind == 'null' then value = false"],
  ['Lua partial output', 'src/cli.lua', "local output = ''", "io.stdout:write('leak\\n'); local output = ''"],
  ['Lua duplicate keys', 'src/yamx.lua', 'if seen[key] then', 'if false then'],
  ['Lua sparse lists', 'src/yamx.lua', 'if largest ~= count then', 'if false then'],
  ['B Lua duplicate keys', 'src/yamx.lua', 'if parent.keys[key] then', 'if false then'],
  ['B Lua scalar types', 'src/yamx.lua', "return 'bool', value", "return 'str', value"],
  ['B Lua apostrophe encoding', 'src/yamx.lua', `value:gsub("'", "''")`, 'value'],

  ['shell duplicate keys', 'src/yamx.sh', '[ -z "$number" ] || fail E_DUPLICATE', ': || fail E_DUPLICATE'],
  ['shell NUL acceptance', 'src/yamx.sh', '!(last >= 32 && last <= 126)', '!(last == 0 || (last >= 32 && last <= 126))'],
  ['shell value corruption', 'src/yamx.sh', String.raw`printf "%s\t%s\n", key, value`, String.raw`printf "%s\t%sx\n", key, value`],
  ['shell partial output', 'src/yamx.sh', 'od -A n', 'printf "leak\\n"; od -A n'],
  ['shell wrong error line', 'src/yamx.sh', 'BEGIN { line = 1 }', 'BEGIN { line = 2 }'],
  ['JS duplicate keys', 'src/minimal.mjs', "if (seen.has(key)) fail('E_DUPLICATE'", "if (false) fail('E_DUPLICATE'"],
  ['JS NUL acceptance', 'src/common.mjs', '!(code >= 32 && code <= 126)', '!(code === 0 || (code >= 32 && code <= 126))'],
  ['JS significant spaces', 'src/minimal.mjs', 'return [key, value];', 'return [key, value.trim()];'],
  ['JS sparse arrays', 'src/minimal.mjs', 'Array.from(entries, (entry, index) => {', 'entries.map((entry, index) => {'],
  ['JS partial output', 'src/cli.mjs', 'let result = \x27\x27;', 'process.stdout.write("leak\\n"); let result = \x27\x27;'],
  ['B shell apostrophe decoding', 'src/balanced.awk', 'gsub(/\\047\\047/, "\\047", quoted)', 'gsub(/\\047\\047/, "", quoted)'],
  ['B shell depth limit', 'src/balanced.awk', 'if (depth > 32)', 'if (0)'],
  ['B shell map scopes', 'src/balanced.awk', 'parent = ids[depth - 1]', 'parent = 0'],
  ['B JS duplicate keys', 'src/balanced.mjs', "if (parent.keys.has(key))", 'if (false)'],
  ['B JS scalar types', 'src/balanced.mjs', "return ['bool', value]", "return ['str', value]"],
  ['B JS apostrophe encoding', 'src/balanced.mjs', `value.replaceAll("'", "''")`, 'value'],
  ['JS wrong error line', 'src/common.mjs', 'this.line = line;', 'this.line = line + 1;'],
];

function test(directory, label) {
  const minimal = ['spec/api.test.mjs', 'spec/cli.test.mjs', 'spec/generated.test.mjs', 'spec/interop.test.mjs'];
  // The baseline exercises the broad suite. Each reviewed fault is then
  // checked by interface/CLI assertions; repeating 512 byte subprocesses per
  // mutant adds no detection evidence. All listed faults must still be caught
  // in both the maintained interface and applicable standalone artifacts.
  const specs = label.includes('Lua') ? ['spec/lua.test.mjs'] : label === 'baseline' ? ['spec/lua.test.mjs', 'spec/balanced.test.mjs', ...minimal]
    : label.startsWith('B ') ? ['spec/balanced.test.mjs'] : ['spec/api.test.mjs', 'spec/cli.test.mjs'];
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...specs], {
    cwd: directory, env: { ...process.env, YAMX_SHELL: shell }, encoding: 'utf8',
    timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
  // Crashes/timeouts are infrastructure failures, never evidence of detection.
  if (result.error || result.signal) throw result.error || new Error(`${label}: ${result.signal}`);
  return result;
}
const baseline = test(root, 'baseline');
if (baseline.status !== 0) {
  console.error(baseline.stdout, baseline.stderr);
  throw new Error('Clean baseline must pass before mutation testing');
}
const standaloneBaseline = spawnSync(process.execPath, ['scripts/check-distribution.mjs', '--quick'], {
  cwd: root, env: { ...process.env, YAMX_SHELL: shell, YAMX_MUTATION: 'baseline' },
  encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
});
if (standaloneBaseline.error || standaloneBaseline.signal || standaloneBaseline.status !== 0)
  throw new Error(`Standalone baseline must pass: ${standaloneBaseline.stdout}\n${standaloneBaseline.stderr}`);
let survivors = 0;
for (const [name, file, before, after] of mutations) {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-mutant-'));
  try {
    for (const folder of ['src', 'spec', 'examples', 'scripts', 'dist']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const path = join(directory, file);
    const source = readFileSync(path, 'utf8');
    const occurrences = source.split(before).length - 1;
    if (!occurrences) throw new Error(`Stale mutation: ${name}`);
    // Some faults affect both parse and generate; replace every matching site.
    writeFileSync(path, source.replaceAll(before, after));
    const syntax = file.endsWith('.lua')
      ? spawnSync('lua5.1', ['-e', `assert(loadfile(${JSON.stringify(path)}))`], { timeout: 5000, encoding: 'utf8' })
      : file.endsWith('.awk')
      ? spawnSync('awk', ['-v', 'operation=generate', '-f', path], {
        input: '0\tmap\t\t\n', timeout: 5000, encoding: 'utf8',
        env: { ...process.env, YAMX_KEYS: join(directory, 'keys'), YAMX_ERROR: join(directory, 'error') },
      })
      : spawnSync(file.endsWith('.sh') ? shell : process.execPath,
        [file.endsWith('.sh') ? '-n' : '--check', path], { timeout: 5000, encoding: 'utf8' });
    if (syntax.error || syntax.status !== 0) throw new Error(`Invalid mutant ${name}: ${syntax.stderr}`);
    for (const [artifact, source] of assemble(directory)) writeFileSync(join(directory, 'dist/minimal', artifact), source);
    if (!name.startsWith('B ') && name !== 'Lua null preservation') {
      const artifact = join(directory, 'dist/minimal', file.includes('cli.') ? file.split('/').pop()
        : file.endsWith('.lua') ? 'yamx.lua' : file.endsWith('.sh') ? 'yamx.sh' : 'yamx.mjs');
      const checked = file.endsWith('.lua')
        ? spawnSync('lua5.1', ['-e', `assert(loadfile(${JSON.stringify(artifact)}))`], { timeout: 5000, encoding: 'utf8' })
        : spawnSync(file.endsWith('.sh') ? shell : process.execPath,
          [file.endsWith('.sh') ? '-n' : '--check', artifact], { timeout: 5000, encoding: 'utf8' });
      if (checked.error || checked.signal || checked.status !== 0)
        throw new Error(`Invalid standalone mutant ${name}: ${checked.stderr}`);
    }
    const result = test(directory, name);
    if (result.status === 0) { survivors++; console.error(`SURVIVED: ${name}`); }
    else {
      if (!/ERR_ASSERTION/.test(result.stdout + result.stderr))
        throw new Error(`Mutant ${name} failed without an assertion; investigate infrastructure:\n${result.stdout}\n${result.stderr}`);
      if (!name.startsWith('B ') && name !== 'Lua null preservation') {
        const isolated = spawnSync(process.execPath, ['scripts/check-distribution.mjs', '--quick'], {
          cwd: directory, env: { ...process.env, YAMX_SHELL: shell, YAMX_MUTATION: name }, encoding: 'utf8',
          timeout: 60000, maxBuffer: 4 * 1024 * 1024,
        });
        if (isolated.error || isolated.signal) throw isolated.error || new Error(`${name}: ${isolated.signal}`);
        if (isolated.status === 0 || !/ERR_ASSERTION/.test(isolated.stdout + isolated.stderr))
          throw new Error(`Standalone mutant ${name} not detected by an assertion:\n${isolated.stdout}\n${isolated.stderr}`);
      }
      console.log(`DETECTED (including standalone M where applicable): ${name}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(`${mutations.length - survivors}/${mutations.length} faults detected under ${shell}`);
process.exitCode = survivors ? 1 : 0;
