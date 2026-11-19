import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from '../scripts/distribute.mjs';
import { example, exampleOutput, rawBase, targets } from '../scripts/copy-guide.mjs';
import { profileFolders, usagePaths } from '../scripts/usage-paths.mjs';

const guide = (directory, ...args) => {
  const r = spawnSync(process.execPath, ['scripts/copy-guide.mjs', ...args], { cwd: directory, encoding: 'utf8', timeout: 5000 });
  assert.ifError(r.error);
  assert.equal(r.signal, null);
  return r;
};

test('the gate rejects a copy guide that no longer matches the distributed files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-guide-drift-'));
  try {
    for (const name of ['LICENSE', 'README.md', 'src', 'scripts', 'dist', 'docs']) cpSync(join(root, name), join(directory, name), { recursive: true });
    assert.equal(guide(directory, '--check').status, 0);
    // A regenerated artifact changes its size and revision, so the docs are stale.
    const path = join(directory, 'dist/balanced/yamx.lua');
    writeFileSync(path, readFileSync(path, 'utf8') + '-- maintained-source edit\n');
    const stale = guide(directory, '--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale copy guide: README\.md/);
    assert.equal(guide(directory).status, 0);
    assert.equal(guide(directory, '--check').status, 0);
    const edited = readFileSync(path);
    const lines = edited.toString().split('\n').length - 1;
    assert.ok(readFileSync(join(directory, 'docs/distributions.md'), 'utf8')
      .includes(`[\`yamx.lua\`](../dist/balanced/yamx.lua) | ${edited.length.toLocaleString('en-US')} | ${lines} |`));
    // Files of one profile must agree on the revision the docs present.
    writeFileSync(path, readFileSync(path, 'utf8').replace(/(Source revision \(SHA-256\): )[0-9a-f]{64}/, `$1${'0'.repeat(64)}`));
    assert.match(guide(directory, '--check').stderr, /disagree on source revision/);
    // A lost marker must fail loudly rather than drop the generated block.
    cpSync(join(root, 'dist'), join(directory, 'dist'), { recursive: true });
    const readme = join(directory, 'README.md');
    writeFileSync(readme, readFileSync(readme, 'utf8').replace(/<!-- \/copy-guide:selector -->\n/, ''));
    assert.match(guide(directory, '--check').stderr, /copy-guide:selector block markers/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// Each documented snippet runs verbatim in an empty directory outside the checkout.
// A curl stand-in serves the committed dist/ files for the documented raw URLs.
test('every documented copy path runs outside the checkout with only its files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-guide-run-'));
  try {
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'curl'), `#!/bin/sh
for url do :; done
case $url in "$YAMX_RAW_BASE"/*) ;; *) echo "unexpected URL: $url" >&2; exit 22 ;; esac
printf '%s\\n' "$url" >> "$YAMX_FETCHED"
cat "$YAMX_DIST/\${url#"$YAMX_RAW_BASE"/}" > "\${url##*/}"
`);
    writeFileSync(join(bin, 'lua'), '#!/bin/sh\nexec "${YAMX_LUA:-lua5.1}" "$@"\n');
    for (const name of ['curl', 'lua']) chmodSync(join(bin, name), 0o755);
    for (const [profile, folder] of Object.entries(profileFolders)) for (const { key, files } of usagePaths) {
      const work = join(directory, `${folder}-${key}`), fetched = join(directory, `${folder}-${key}.urls`);
      mkdirSync(work);
      const snippet = example(key, profile);
      assert.ok(snippet.includes(`${rawBase}/${folder}\n`), snippet);
      const r = spawnSync('sh', ['-eu', '-c', snippet], { cwd: work, encoding: 'utf8', timeout: 10000,
        env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, YAMX_LUA: process.env.YAMX_LUA ?? 'lua5.1',
          YAMX_RAW_BASE: rawBase, YAMX_DIST: join(root, 'dist'), YAMX_FETCHED: fetched } });
      const label = `${profile} ${key}`;
      assert.ifError(r.error);
      assert.equal(r.signal, null, label);
      assert.equal(r.stderr, '', label);
      assert.equal(r.status, 0, label);
      assert.equal(r.stdout, exampleOutput, label);
      assert.deepEqual(readFileSync(fetched, 'utf8').trimEnd().split('\n'), files.map(name => `${rawBase}/${folder}/${name}`), label);
      for (const name of files) assert.equal(readFileSync(join(work, name), 'utf8'), readFileSync(join(root, 'dist', folder, name), 'utf8'));
      const own = new Set([...files, 'config.yaml', 'example.mjs', 'example.lua']);
      for (const name of readdirSync(work)) assert.ok(own.has(name), `${label}: unexpected ${name}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const slug = heading => heading.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replaceAll(' ', '-');
test('relative links in the README and docs resolve to files and headings', () => {
  const pages = ['README.md', ...readdirSync(join(root, 'docs')).filter(n => n.endsWith('.md')).map(n => `docs/${n}`)];
  for (const [file] of targets) assert.ok(pages.includes(file));
  for (const page of pages) {
    const text = readFileSync(join(root, page), 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/.test(target)) continue;
      const [path, anchor] = target.split('#');
      const resolved = path ? join(root, dirname(page), path) : join(root, page);
      assert.ok(existsSync(resolved), `${page}: ${target}`);
      if (anchor) {
        const headings = readFileSync(resolved, 'utf8').split('\n').filter(l => /^#+ /.test(l)).map(l => slug(l.replace(/^#+ /, '')));
        assert.ok(headings.includes(anchor), `${page}: ${target}`);
      }
    }
  }
});
