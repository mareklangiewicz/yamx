// Small reviewed fault catalogue; each mutant gets its own disposable checkout.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  ['JS duplicate keys', 'src/yamx.mjs', "if (seen.has(key)) fail('E_DUPLICATE'", "if (false) fail('E_DUPLICATE'"],
  ['JS NUL acceptance', 'src/common.mjs', '!(code >= 32 && code <= 126)', '!(code === 0 || (code >= 32 && code <= 126))'],
  ['JS significant spaces', 'src/yamx.mjs', 'return [key, value];', 'return [key, value.trim()];'],
  ['JS sparse arrays', 'src/yamx.mjs', 'Array.from(entries, (entry, index) => {', 'entries.map((entry, index) => {'],
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
  const specs = label.includes('Lua') ? ['spec/lua.test.mjs'] : label === 'baseline' ? ['spec/lua.test.mjs', 'spec/balanced.test.mjs', ...minimal]
    : label.startsWith('B ') ? ['spec/balanced.test.mjs'] : ['spec/lua.test.mjs', ...minimal];
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
let survivors = 0;
for (const [name, file, before, after] of mutations) {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-mutant-'));
  try {
    for (const folder of ['src', 'spec', 'examples']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
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
    const result = test(directory, name);
    if (result.status === 0) { survivors++; console.error(`SURVIVED: ${name}`); }
    else {
      if (!/ERR_ASSERTION/.test(result.stdout + result.stderr))
        throw new Error(`Mutant ${name} failed without an assertion; investigate infrastructure:\n${result.stdout}\n${result.stderr}`);
      console.log(`DETECTED: ${name}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(`${mutations.length - survivors}/${mutations.length} faults detected under ${shell}`);
process.exitCode = survivors ? 1 : 0;
