import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const distributionProfile = process.env.YAMX_DISTRIBUTION_PROFILE || 'M';
export const distribution = process.env.YAMX_DISTRIBUTION;
export const jsLibrary = pathToFileURL(distribution ? join(distribution, 'js-library/yamx.mjs') : join(root, 'src/yamx.mjs'));
export const cliScript = implementation => distribution
  ? join(distribution, implementation, implementation === 'shell' ? 'yamx.sh' : implementation === 'lua' ? 'cli.lua' : 'cli.mjs')
  : join(root, implementation === 'shell' ? 'src/yamx.sh' : implementation === 'lua' ? 'src/cli.lua' : 'src/cli.mjs');
export const shell = process.env.YAMX_SHELL || 'sh';

export function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'yamx test.'));
  const file = join(directory, '-input with spaces\nand newline');
  const write = input => { writeFileSync(file, input); return file; };
  try { return run({ directory, file, write }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

export function cli(implementation, args, options = {}) {
  const command = implementation === 'shell' ? shell : implementation === 'lua' ? (process.env.YAMX_LUA || 'lua5.1') : process.execPath;
  const script = cliScript(implementation);
  const result = spawnSync(command, [script, ...args], {
    cwd: distribution || root, encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result;
}
