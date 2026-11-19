// Ledger of tree hashes that passed the complete gate on a clean checkout.
// The pre-push hook skips a rerun when every pushed commit's tree is listed,
// so a push no longer holds the remote connection open for minutes (#12).
// A tree hash names exact content, so an amended message keeps its entry.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const zero = /^0+$/;

function git(root, args, input) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', input, timeout: 30000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

function ledgerPath(root) {
  const common = git(root, ['rev-parse', '--git-common-dir']);
  if (!common) return null;
  return join(isAbsolute(common) ? common : join(root, common), 'yamx-gate-pass');
}

function entries(root) {
  const path = ledgerPath(root);
  return new Set(path && existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : []);
}

/** HEAD's tree hash when the checkout has no staged, unstaged or untracked changes; null otherwise. */
export function cleanTree(root) {
  const status = git(root, ['status', '--porcelain', '--untracked-files=normal']);
  if (status !== '') return null;
  return git(root, ['rev-parse', 'HEAD^{tree}']);
}

/** Records `tree` after a passing gate, only if the checkout still holds exactly that tree. */
export function recordPass(root, tree) {
  if (!tree || cleanTree(root) !== tree) return false;
  if (entries(root).has(tree)) return true;
  appendFileSync(ledgerPath(root), `${tree}\n`);
  return true;
}

/**
 * Whether the pre-push stdin (`<local ref> <local sha> <remote ref> <remote sha>` lines)
 * pushes only commits whose trees passed. Deletions push no content. Empty input is not covered.
 */
export function coversPush(root, input) {
  const shas = input.split('\n').filter(Boolean).map(line => line.split(' ')[1]);
  if (!shas.length) return false;
  const passed = entries(root);
  return shas.every(sha => zero.test(sha) || passed.has(git(root, ['rev-parse', `${sha}^{tree}`])));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const [command] = process.argv.slice(2);
  if (command === 'covers') {
    const covered = coversPush(root, readFileSync(0, 'utf8'));
    if (covered) console.log('Gate: every pushed tree already passed on a clean checkout; skipping the rerun.');
    process.exitCode = covered ? 0 : 1;
  } else {
    console.error('usage: node scripts/gate-ledger.mjs covers < pre-push-input');
    process.exitCode = 2;
  }
}
