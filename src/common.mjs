export class YamxError extends Error {
  constructor(code, line, message) {
    super(`${code} line ${line}: ${message}`);
    this.code = code;
    this.line = line;
  }
}

const fail = (code, line, message) => { throw new YamxError(code, line, message); };

// Shared by the CLI's YAML input and its deliberately restricted TSV transport.
export function checkText(text, allowTab = false) {
  if (typeof text !== 'string') throw new TypeError('expected a string');
  if (text.length === 0) fail('E_EMPTY', 1, 'expected at least one entry');
  let line = 1;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (char === '\n') line++;
    else if (!(code >= 32 && code <= 126) && !(allowTab && char === '\t'))
      fail('E_CHARACTER', line, 'unsupported byte');
  }
  if (!text.endsWith('\n')) fail('E_NEWLINE', line, 'expected a final LF');
}
