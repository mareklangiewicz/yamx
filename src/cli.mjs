import { readFileSync, statSync, writeSync } from 'node:fs';
import { checkText, generate, parse, validate, YamxError } from './yamx.mjs';
// @balanced-begin
import { yamlNodes, nodeText, transportNodes, nodesYaml, validateBalanced } from './balanced.mjs';
// @balanced-end

const args = process.argv.slice(2);
let profile = 'M';
if (args[0] === '--profile') { args.shift(); profile = args.shift(); }
const [operation, file, ...extra] = args;
if (!['M', 'B'].includes(profile) || !file || extra.length || !['validate', 'parse', 'generate'].includes(operation)) {
  console.error('usage: node src/cli.mjs [--profile M|B] validate|parse|generate FILE');
  process.exit(2);
}

try {
  if (!statSync(file).isFile()) throw new Error('expected a regular file');
  // latin1 preserves every input byte for the ASCII gate, including invalid UTF-8.
  const text = readFileSync(file).toString('latin1');
  let result = '';
// @balanced-begin
  if (profile === 'B') {
    if (operation === 'generate') result = nodesYaml(transportNodes(text));
    else if (operation === 'parse') result = nodeText(yamlNodes(text));
    else validateBalanced(text);
  } else
// @balanced-end
  if (operation === 'generate') {
    checkText(text, true);
    const entries = text.slice(0, -1).split('\n').map((line, index) => {
      const fields = line.split('\t');
      if (fields.length !== 2)
        throw new YamxError('E_SYNTAX', index + 1, 'expected key TAB value');
      return fields;
    });
    result = generate(entries);
  } else if (operation === 'validate') {
    validate(text);
  } else {
    result = parse(text).map(([key, value]) => `${key}\t${value}\n`).join('');
  }
  // Synchronous writes make output errors part of the CLI exit contract.
  const bytes = Buffer.from(result);
  for (let offset = 0; offset < bytes.length;)
    offset += writeSync(1, bytes, offset, bytes.length - offset);
} catch (error) {
  console.error(error instanceof YamxError ? error.message : 'E_IO: unable to read input or write output');
  process.exitCode = error instanceof YamxError ? 1 : 2;
}
