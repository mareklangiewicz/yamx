// Copy/download guidance generated from the committed dist/ files. Sizes,
// revisions, file lists, runtime dependencies and runnable examples in README.md
// and docs/distributions.md are written here; `--check` rejects any drift and
// test/copy-guide.test.mjs runs every example outside the checkout.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './distribute.mjs';
import { profileFolders, usagePaths } from './usage-paths.mjs';

export const repository = 'https://github.com/mareklangiewicz/yamx';
export const rawBase = 'https://raw.githubusercontent.com/mareklangiewicz/yamx/main/dist';
const names = { M: 'M — Minimal', B: 'B — Balanced' };
const document = "name: 'yamx'\n"; // accepted by both profiles with the same meaning
export const exampleOutput = '{\n  "name": "yamx"\n}\n';
const fetch = files => files.map(name => `curl -fsSLO "$base/${name}"`).join('\n');
const configFile = `printf "${document.replace('\n', '\\n')}" > config.yaml`;
const examples = {
  shell: `${fetch(['yamx.sh'])}\n${configFile}\nsh yamx.sh validate config.yaml\nsh yamx.sh json config.yaml`,
  'js-library': `${fetch(['yamx.mjs'])}\ncat > example.mjs <<'EOF'
import { toJSON, validate } from './yamx.mjs';
const text = ${JSON.stringify(document)};
validate(text); // throws YamxError on invalid input
process.stdout.write(toJSON(text));
EOF\nnode example.mjs`,
  js: `${fetch(['yamx.mjs', 'cli.mjs'])}\n${configFile}\nnode cli.mjs json config.yaml`,
  'lua-library': `${fetch(['yamx.lua'])}\ncat > example.lua <<'EOF'
local yamx = dofile('yamx.lua')
local text = "${document.replace('\n', '\\n')}"
yamx.validate(text) -- raises an error table on invalid input
io.write(yamx.to_json(text))
EOF\nlua example.lua`,
  lua: `${fetch(['yamx.lua', 'cli.lua'])}\n${configFile}\nlua cli.lua json config.yaml`,
};

/** The documented example for one usage path, downloading from one profile folder. */
export function example(key, profile = 'B') {
  return `base=${rawBase}/${profileFolders[profile]}\n${examples[key]}\n`;
}

/** Facts about the committed artifacts: revision, and bytes/lines per usage path. */
export function facts(directory = root) {
  return Object.entries(profileFolders).map(([profile, folder]) => {
    const text = name => readFileSync(join(directory, 'dist', folder, name), 'utf8');
    const revisions = new Set(usagePaths.flatMap(p => p.files).map(name =>
      /Source revision \(SHA-256\): ([0-9a-f]{64})\n/.exec(text(name))?.[1]));
    if (revisions.size !== 1 || revisions.has(undefined)) throw new Error(`dist/${folder}: files disagree on source revision`);
    return { profile, folder, revision: [...revisions][0], paths: usagePaths.map(path => ({ ...path,
      bytes: path.files.reduce((n, name) => n + Buffer.byteLength(text(name)), 0),
      lines: path.files.reduce((n, name) => n + text(name).split('\n').length - 1, 0) })) };
  });
}

const number = n => n.toLocaleString('en-US');
const blocks = {
  // README: choose a profile, choose a language, copy a file.
  selector: (all, up) => {
    const cell = (f, key) => {
      const path = f.paths.find(p => p.key === key), name = path.files.at(-1);
      return `[\`${name}\`](${up}dist/${f.folder}/${name}) · [download](${rawBase}/${f.folder}/${name}) · ${number(path.bytes)} B, ${number(path.lines)} lines`;
    };
    return ['| Profile | Shell CLI | JavaScript library | Lua library |', '| --- | --- | --- | --- |',
      ...all.map(f => `| **${names[f.profile]}** | ${cell(f, 'shell')} | ${cell(f, 'js-library')} | ${cell(f, 'lua-library')} |`),
      '', 'Each library is one complete file. The optional JavaScript and Lua CLIs add `cli.mjs` or',
      '`cli.lua` beside their library and load it: a CLI file alone is incomplete.', '',
      '```sh', example('shell').trimEnd(), '```', '', 'It prints:', '', '```json', exampleOutput.trimEnd(), '```'].join('\n');
  },
  // docs/distributions.md: complete file sets, measurements and revisions.
  sizes: (all, up) => [
    ...all.flatMap(f => [`${names[f.profile]}, files under [\`dist/${f.folder}/\`](${up}dist/${f.folder}),`
      + ` source revision \`${f.revision}\`:`, '',
      '| Usage | Required files | Bytes | Lines | Runtime dependencies |', '| --- | --- | ---: | ---: | --- |',
      ...f.paths.map(p => `| ${p.label} | ${p.files.map(n => `[\`${n}\`](${up}dist/${f.folder}/${n})`).join(', ')}`
        + ` | ${number(p.bytes)} | ${number(p.lines)} | ${p.runtime} |`), '']),
    'Download links:', '',
    ...all.map(f => `- ${names[f.profile]}: ${usagePaths.flatMap(p => p.files).filter((n, i, a) => a.indexOf(n) === i)
      .map(n => `[\`${n}\`](${rawBase}/${f.folder}/${n})`).join(', ')};`
      + ` [change history](${repository}/commits/main/dist/${f.folder}).`),
  ].join('\n'),
  // docs/distributions.md: one runnable example per usage path.
  examples: () => ['Each example prints:', '', '```json', exampleOutput.trimEnd(), '```',
    ...usagePaths.flatMap(p => ['', `${p.label}:`, '', '```sh', example(p.key).trimEnd(), '```'])].join('\n'),
};
export const targets = [['README.md', ['selector'], ''], ['docs/distributions.md', ['sizes', 'examples'], '../']];

/** Replace each generated block in text; markers must exist exactly once. */
export function render(text, blockNames, up, all) {
  for (const name of blockNames) {
    const begin = `<!-- copy-guide:${name} (generated by scripts/copy-guide.mjs; do not edit) -->\n`;
    const end = `<!-- /copy-guide:${name} -->\n`;
    const start = text.indexOf(begin), stop = text.indexOf(end);
    if (start < 0 || stop < start || text.indexOf(begin, start + 1) >= 0)
      throw new Error(`Missing or repeated copy-guide:${name} block markers`);
    text = text.slice(0, start + begin.length) + blocks[name](all, up) + '\n' + text.slice(stop);
  }
  return text;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2];
  if (mode && !['--check', '--json'].includes(mode)) throw new Error('usage: node scripts/copy-guide.mjs [--check|--json]');
  const all = facts();
  if (mode === '--json') console.log(JSON.stringify({ rawBase, profiles: all }, null, 2));
  else for (const [file, blockNames, up] of targets) {
    const path = join(root, file), before = readFileSync(path, 'utf8'), after = render(before, blockNames, up, all);
    if (mode === '--check') { if (after !== before) throw new Error(`Stale copy guide: ${file}; run node scripts/copy-guide.mjs`); }
    else writeFileSync(path, after);
  }
}
