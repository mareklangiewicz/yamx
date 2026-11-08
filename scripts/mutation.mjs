// Small reviewed fault catalogue; each mutant gets its own disposable checkout.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const shell = process.env.YAMX_SHELL || 'dash';
const mutations = [
  ['shell duplicate keys', 'src/yamx.sh', '[ -z "$number" ] || fail E_DUPLICATE', ': || fail E_DUPLICATE'],
  ['shell NUL acceptance', 'src/yamx.sh', '!(last >= 32 && last <= 126)', '!(last == 0 || (last >= 32 && last <= 126))'],
  ['shell value corruption', 'src/yamx.sh', String.raw`printf "%s\t%s\n", key, value`, String.raw`printf "%s\t%sx\n", key, value`],
  ['shell partial output', 'src/yamx.sh', 'od -A n', 'printf "leak\\n"; od -A n'],
  ['shell wrong error line', 'src/yamx.sh', 'BEGIN { line = 1 }', 'BEGIN { line = 2 }'],
  ['JS duplicate keys', 'src/yamx.mjs', "if (seen.has(key)) fail('E_DUPLICATE'", "if (false) fail('E_DUPLICATE'"],
  ['JS NUL acceptance', 'src/yamx.mjs', '!(code >= 32 && code <= 126)', '!(code === 0 || (code >= 32 && code <= 126))'],
  ['JS significant spaces', 'src/yamx.mjs', 'return [key, value];', 'return [key, value.trim()];'],
  ['JS sparse arrays', 'src/yamx.mjs', 'Array.from(entries, (entry, index) => {', 'entries.map((entry, index) => {'],
  ['JS partial output', 'src/cli.mjs', 'let result = \x27\x27;', 'process.stdout.write("leak\\n"); let result = \x27\x27;'],
  ['JS wrong error line', 'src/yamx.mjs', 'this.line = line;', 'this.line = line + 1;'],
];

function test(directory, label) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'spec/api.test.mjs', 'spec/cli.test.mjs',
    'spec/generated.test.mjs', 'spec/interop.test.mjs'], {
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
    for (const folder of ['src', 'spec']) cpSync(join(root, folder), join(directory, folder), { recursive: true });
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const path = join(directory, file);
    const source = readFileSync(path, 'utf8');
    const occurrences = source.split(before).length - 1;
    if (!occurrences) throw new Error(`Stale mutation: ${name}`);
    // Some faults affect both parse and generate; replace every matching site.
    writeFileSync(path, source.replaceAll(before, after));
    const syntax = spawnSync(file.endsWith('.sh') ? shell : process.execPath,
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
