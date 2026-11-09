// B's structural and quoting workloads complement the flat M workloads.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'yamx-balanced-benchmark-'));
const input = join(directory, 'input');
const full = process.argv.includes('--full');
const sizes = full ? [250, 1000, 4000] : [100, 400, 1600];
const targets = [['dash', 'src/yamx.sh'], ['bash', 'src/yamx.sh'], ['zsh', 'src/yamx.sh'],
  [process.execPath, 'src/cli.mjs'], ['lua5.1', 'src/cli.lua'], ['luajit', 'src/cli.lua'], ['lua5.4', 'src/cli.lua']];
const started = performance.now();
let records = 0;
try {
  for (const [command, script] of targets) {
    for (const shape of ['nested', 'quotes', 'spaces', 'long-key', 'late-duplicate', 'late-invalid']) {
      for (const size of sizes) {
        let yaml;
        let nodes;
        if (shape === 'quotes' || shape === 'long-key' || shape === 'spaces') {
          const key = shape === 'long-key' ? `key_${'x'.repeat(size * 16)}` : 'key';
          const value = shape === 'quotes' ? "a'".repeat(size * 8)
            : shape === 'spaces' ? `a${' '.repeat(size * 32)}b` : 'value';
          yaml = shape === 'spaces' ? `${key}: ${value}\n` : `${key}: '${value.replaceAll("'", "''")}'\n`;
          nodes = `0\tmap\t\t\n1\tstr\t${key}\t${value}\n`;
        } else {
          // Repeated child keys test mapping identity without growing path strings.
          yaml = Array.from({ length: size }, (_, i) => `key_${i}:\n  items:\n    - 'value'\n`).join('');
          nodes = '0\tmap\t\t\n' + Array.from({ length: size }, (_, i) =>
            `1\tmap\tkey_${i}\t\n2\tseq\titems\t\n3\tstr\t\tvalue\n`).join('');
        }
        if (shape === 'late-duplicate') {
          yaml += 'key_0: duplicate\n'; nodes += '1\tstr\tkey_0\tduplicate\n';
        }
        if (shape === 'late-invalid') {
          yaml += "bad: '\0'\n"; nodes += '1\tstr\tbad\t\0\n';
        }
        for (const operation of ['validate', 'parse', 'generate']) {
          const text = operation === 'generate' ? nodes : yaml;
          writeFileSync(input, text);
          const samples = [];
          for (let sample = 0; sample < (full ? 3 : 1); sample++) {
            if (performance.now() - started > 240000) throw new Error('B benchmark total time budget exceeded');
            const before = performance.now();
            const result = spawnSync(command, [script, '--profile', 'B', operation, input], {
              cwd: root, stdio: 'ignore', timeout: 15000,
            });
            if (result.error || result.signal) throw result.error || new Error(`${command}: ${result.signal}`);
            if (result.status !== (shape.startsWith('late-') ? 1 : 0))
              throw new Error(`${command} B ${shape} ${operation}: exit ${result.status}`);
            samples.push(performance.now() - before);
          }
          samples.sort((a, b) => a - b);
          console.log(JSON.stringify({ profile: 'B', target: script.endsWith('.mjs') ? 'node' : command,
            shape, operation, size, bytes: Buffer.byteLength(text),
            medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2) }));
          records++;
        }
      }
    }
  }
  console.error(`PASS: B ${records} bounded workload measurements; ${((performance.now() - started) / 1000).toFixed(1)}s`);
} finally { rmSync(directory, { recursive: true, force: true }); }
