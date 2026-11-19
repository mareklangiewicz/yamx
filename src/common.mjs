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

// JSON export from checked preorder nodes {depth, kind, key, value}. Keys are
// identifiers and strings are printable ASCII, so only quotes and backslashes
// need escaping. Each node emits one line; bounded depth keeps closings cheap.
const jsonString = text => `"${text.replace(/["\\]/g, '\\$&')}"`;
export function nodesJSON(nodes) {
  const lines = [];
  const open = [];
  for (let i = 0; i < nodes.length; i++) {
    const { depth, kind, key, value } = nodes[i];
    const next = i + 1 < nodes.length ? nodes[i + 1].depth : 0;
    const container = kind === 'map' || kind === 'seq';
    const children = container && next > depth;
    const scalar = kind === 'map' ? (children ? '{' : '{}') : kind === 'seq' ? (children ? '[' : '[]')
      : kind === 'str' ? jsonString(value) : kind === 'null' ? 'null' : value;
    let line = '  '.repeat(depth) + (key ? `${jsonString(key)}: ` : '') + scalar;
    if (children) { open[depth] = kind; lines.push(line); continue; }
    for (let d = depth - 1; d >= next; d--) {
      lines.push(line);
      line = '  '.repeat(d) + (open[d] === 'map' ? '}' : ']');
    }
    lines.push(i + 1 < nodes.length ? `${line},` : line);
  }
  return lines.join('\n') + '\n';
}
