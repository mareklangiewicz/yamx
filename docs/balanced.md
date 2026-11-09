# YAM(B) — Balanced

YAM(B) bundles block collections, readable scalar spellings, and comments while
keeping parsing line-oriented. It is a strict language superset of YAM(M): every
Minimal document is accepted with the same decoded mapping meaning (including
the inherited key-length exception below). B is selected
explicitly; M remains the default. Names alone define no other relationships.
YAMX is experimental; profile grammars can evolve with their implementations
and executable specifications, without formal migrations.

## Collections and layout

- One root mapping or sequence, starting at column 1. Root scalars are excluded.
- Mapping keys use M's `[a-z_][a-z0-9_-]*` rule, excluding `true`, `false`, `null`.
  Keys are unique within each mapping, including empty-valued collections.
  M currently accepts keys longer than YAML's 1,024-character implicit-key
  limit. B inherits that known compatibility limitation to preserve inclusion;
  strict YAML consumers require keys of at most 1,024 characters.
- A mapping entry is `key: value` or `key:` followed by an indented collection.
  A sequence item is `- value` or `-` followed by an indented collection.
  One or more spaces separate the indicator from an inline value.
- Child collections indent exactly two spaces. All entries in a collection
  have the same indentation and kind. Inline nonempty collections and compact
  sequence mappings (`- name: value`) are excluded; use a bare `-` and a child
  block. Indentless sequences are excluded.
- `{}` and `[]` are the only flow forms, for empty collections. They can appear
  as an inline value or as the entire root. An explicit empty collection cannot
  acquire children. A bare `key:` or `-` requires a child collection; it does
  not mean null.
- Nodes have depth 0 at the root and at most 32 parent edges. This fixed bound
  includes scalar and empty collection nodes. Root collections count as depth 0.
- Blank and space-only lines and whole-line comments are ignored. Trailing
  spaces are ignored outside quoted strings. Inline comments start with a `#`
  preceded by a space outside quotes. Comments do not affect nesting or values.
- Input uses printable ASCII and LF, with a required final LF. Tabs, CRLF, BOM,
  non-ASCII and other controls are rejected, including in comments. Empty or
  comment-only input is rejected. There is no document marker or directive.

```yaml
# A block mapping containing a sequence of mappings
name: YAMX
active: true
retries: 3
optional: null
items:
  -
    name: 'Marek''s tools'
    url: https://example.org/a#fragment # ordinary URL string
    labels:
      - shell
      - portable
empty: {}
```

## Scalars

- Single quotes delimit a string. Two adjacent apostrophes encode one
  apostrophe. Backslashes have no escape meaning. Spaces inside quotes are
  significant; a closing quote can be followed only by spaces and a comment.
- Plain `true`, `false`, and `null` have boolean/null meaning.
- Plain integers match `-?(0|[1-9][0-9]*)` and are limited to
  -9007199254740991 through 9007199254740991, inclusive. `-0` normalizes to `0`.
  Other numeric spellings, floats and out-of-range integers require quotes to
  represent strings; they are rejected as unquoted scalars.
- Other plain strings start with an ASCII letter, `_`, or `/`. They may contain
  printable ASCII, including spaces, apostrophes, backslashes, `#` without a
  preceding space, and colons without a following space or end-of-line.
  The YAML Core spellings `True`, `TRUE`, `False`, `FALSE`, `Null`, `NULL` are
  rejected to avoid interpreting typed YAML as strings. `yes`, `no`, `on`, `off`
  remain strings under YAML 1.2 Core. Quote strings starting with other characters.
- Plain strings cannot contain `: ` or end in `:` (which could introduce a
  mapping). Double-quoted and multiline styles, tags, anchors, aliases, merge
  syntax, and nonempty flow collections are excluded.

Generation uses single quotes for every string, doubled apostrophes, decimal
integers, lowercase booleans/null, two-space block indentation, and `{}`/`[]`
for empty collections. Comments and input scalar spellings are presentation,
not preserved data. Mapping entry order is preserved for convenience; YAML
mapping meaning remains unordered.

## API and CLI

```js
import { parse, generate, validate } from '../src/yamx.mjs';
const tree = parse('name: YAMX\nactive: true\n', 'B'); // Map
validate('name: YAMX\n', 'B');
generate(new Map([['items', ['shell', true, 3, null]]]), 'B');
```

The B API uses `Map` for mappings, arrays for sequences, strings, booleans,
null, and safe integer Numbers. Root must be a Map or array. Generation rejects
invalid keys, unsupported types, sparse arrays, cycles, excessive depth, and
strings outside printable ASCII. Shared subtrees can be emitted independently.
Unknown profile names are API TypeErrors or CLI usage errors (exit 2).

```sh
sh src/yamx.sh --profile B validate examples/balanced.yaml
sh src/yamx.sh --profile B parse examples/balanced.yaml > nodes.tsv
node src/cli.mjs --profile B generate nodes.tsv
```

M's default invocation, pair-list API, and restricted TSV remain unchanged.
Both CLIs share M's stable-file, I/O, exit-code, and atomic-output contracts.
B diagnostics also use `CODE line N:`; grammar/layout failures use `E_SYNTAX`,
unrepresentable scalars `E_STRING`, depth violations `E_DEPTH`, and existing
empty/byte/newline/key/duplicate codes retain their meanings. YAML input errors
refer to physical source lines, including ignored comments; transport errors
refer to transport record lines. API generation errors use preorder node numbers.
Byte checks precede grammar checks; other diagnostic precedence is unspecified
when input violates several rules.

### Node transport

B `parse` emits preorder records with exactly four TAB-separated fields:

`depth TAB kind TAB key TAB value LF`

- The first record is the root, depth `0`, kind `map` or `seq`, empty key/value.
- Kinds are `map`, `seq`, `str`, `int`, `bool`, `null`.
- A mapping child carries its key; a sequence child carries an empty key.
- Container and null values are empty. Boolean values are `true` or `false`.
  Integer values use the scalar integer grammar and range, normalizing `-0`.
  String values are decoded printable ASCII, including empty strings/apostrophes.
- Depths are canonical decimal integers from 0 through 32. A node's parent is
  the latest preceding container at depth one less. Depth can increase only
  by one. Scalars cannot have children. There is exactly one root.
- Duplicate keys are rejected per mapping, never across distinct mappings.
  `generate` validates every record before publishing output.

This transport needs no escaping because tabs and newlines cannot occur in
keys or scalar data. It is data, never shell source. It is a development
interface, separate from M's flat TSV.

## Implementation costs

The shell parser uses byte inspection, a bounded-depth layout stack in POSIX
awk. The same node-validation functions check parsed nodes and incoming
transport records, generating YAML when requested. Duplicate checks sort `(mapping-id, key, source-line)`
records, avoiding scans of earlier keys and growing path strings. Quoted
strings are decoded/encoded by substitutions over a whole line, not repeated
prefix concatenation. Comment separation uses literal searches; trailing-space
trimming scans backward once, avoiding unanchored whitespace-regex rescans. JS uses a bounded stack, Maps, arrays, and output joins.
Both implementations avoid known quadratic algorithms; sorting and underlying
runtime/regex/utility behavior qualify complexity claims as in quality.md.
Temporary storage and output memory scale with data size; this is not a
streaming or constant-storage API. The fixed depth bound caps per-node stack
work. The shell entry point loads `src/balanced.awk` from beside `src/yamx.sh`; keep
these files together. There is no new runtime package or external utility
dependency.

The independent [YAML 1.2.2 specification](https://yaml.org/spec/1.2.2/)
defines the reference syntax and Core scalar meanings; B defines its own
accepted subset. Tests compare against the locked YAML oracle.
