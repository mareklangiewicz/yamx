import { readFileSync } from 'node:fs';
import { checkText, generate, parse, validate, YamxError } from './yamx.mjs';

const [operation, file, ...extra] = process.argv.slice(2);
if (!file || extra.length || !['validate', 'parse', 'generate'].includes(operation)) {
  console.error('usage: node src/cli.mjs validate|parse|generate FILE');
  process.exit(2);
}

try {
  // latin1 preserves every input byte for the ASCII gate, including invalid UTF-8.
  const text = readFileSync(file).toString('latin1');
  let result = '';
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
  process.stdout.write(result);
} catch (error) {
  console.error(error instanceof YamxError ? error.message : 'E_IO: unable to read input');
  process.exitCode = error instanceof YamxError ? 1 : 2;
}
