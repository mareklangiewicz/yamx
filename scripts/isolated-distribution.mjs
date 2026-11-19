// Each documented usage path gets only its complete file set, outside checkout.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './distribute.mjs';
import { profileFolders, usagePaths } from './usage-paths.mjs';

export function isolate(directory = root, profile = 'M') {
  const temporary = mkdtempSync(join(tmpdir(), 'yamx-distribution-'));
  for (const { key, files } of usagePaths) {
    mkdirSync(join(temporary, key));
    for (const name of files) copyFileSync(join(directory, 'dist', profileFolders[profile], name), join(temporary, key, name));
  }
  return { directory: temporary, close: () => rmSync(temporary, { recursive: true, force: true }) };
}
