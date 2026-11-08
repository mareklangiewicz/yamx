// Bounded workloads and recorded scaling, not a timing-based complexity proof.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'yamx-benchmark-'));
const input = join(directory, 'input');
const full = process.argv.includes('--full');
const sizes = full ? [250, 1000, 4000] : [100, 400, 1600];
const targets = [['dash', 'src/yamx.sh'], ['bash', 'src/yamx.sh'], ['zsh', 'src/yamx.sh'],
  [process.execPath, 'src/cli.mjs']];
const records = [];
const started = performance.now();
try {
  for (const [command, script] of targets) {
    for (const shape of ['entries', 'long-value', 'long-key', 'late-duplicate', 'late-invalid']) {
      for (const size of sizes) {
        const entries = shape === 'long-value' ? [['key', 'x'.repeat(size * 16)]]
          : shape === 'long-key' ? [[`key_${'x'.repeat(size * 16)}`, 'value']]
          : Array.from({ length: size }, (_, i) => [`key_${i}`, 'x'.repeat(32)]);
        for (const operation of ['validate', 'parse', 'generate']) {
          let text = entries.map(([key, value]) => operation === 'generate'
            ? `${key}\t${value}\n` : `${key}: '${value}'\n`).join('');
          if (shape === 'late-duplicate') text += operation === 'generate' ? 'key_0\tduplicate\n' : "key_0: 'duplicate'\n";
          if (shape === 'late-invalid') text += operation === 'generate' ? 'bad\t\0\n' : "bad: '\0'\n";
          writeFileSync(input, text);
          const samples = [];
          for (let sample = 0; sample < (full ? 3 : 1); sample++) {
            if (performance.now() - started > 240000) throw new Error('benchmark total time budget exceeded');
            const before = performance.now();
            const result = spawnSync(command, [script, operation, input], {
              cwd: root, stdio: 'ignore', timeout: 15000,
            });
            if (result.error || result.signal) throw result.error || new Error(`${command}: ${result.signal}`);
            const expected = shape.startsWith('late-') ? 1 : 0;
            if (result.status !== expected) throw new Error(`${command} ${shape} ${operation}: exit ${result.status}`);
            samples.push(performance.now() - before);
          }
          samples.sort((a, b) => a - b);
          const record = { target: script.endsWith('.sh') ? command : 'node', shape, operation,
            size, bytes: Buffer.byteLength(text), medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2) };
          records.push(record);
          console.log(JSON.stringify(record));
        }
      }
    }
  }
  console.error(`PASS: ${records.length} bounded workload measurements; ${((performance.now() - started) / 1000).toFixed(1)}s`);
} finally { rmSync(directory, { recursive: true, force: true }); }
