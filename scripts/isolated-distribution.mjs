// Each documented usage path gets only its complete file set, outside checkout.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './distribute.mjs';

export function isolate(directory = root) {
  const temporary = mkdtempSync(join(tmpdir(), 'yamx-distribution-'));
  for (const [usage, names] of [['shell', ['yamx.sh']], ['js-library', ['yamx.mjs']],
    ['js', ['yamx.mjs', 'cli.mjs']], ['lua-library', ['yamx.lua']], ['lua', ['yamx.lua', 'cli.lua']]]) {
    mkdirSync(join(temporary, usage));
    for (const name of names) copyFileSync(join(directory, 'dist/minimal', name), join(temporary, usage, name));
  }
  return { directory: temporary, close: () => rmSync(temporary, { recursive: true, force: true }) };
}
