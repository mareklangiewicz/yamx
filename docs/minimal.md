# YAM(M) — Minimal

YAM(M) is the Minimal profile in the YAM(X) family. Its status is
experimental; that status is separate from its name. Its deliberately small
grammar makes implementation costs visible.

Profile letters identify curated feature bundles. The name Minimal does not
establish an inclusion relationship with other profiles; specifications must
define those relationships. See the [family overview](../README.md) for naming
and the implemented [YAM(B) — Balanced](balanced.md) superset.

## Document grammar

```ebnf
document = entry, { entry } ;
entry    = key, ": ", "'", { char }, "'", LF ;
key      = first, { rest } ;
first    = "a" .. "z" | "_" ;
rest     = first | "0" .. "9" | "-" ;
char     = ASCII-0x20 .. ASCII-0x26 | ASCII-0x28 .. ASCII-0x7E ;
LF       = ASCII-0x0A ;
```

Additional constraints:

- The document is a nonempty flat mapping. Collection depth is 1 (the root).
- Keys are unique. `true`, `false`, and `null` are reserved and forbidden as
  keys, so permitted keys resolve as strings under YAML 1.2 Core schema.
- Each value is a string; the surrounding quotes are syntax, not data.
- Every entry occupies exactly one line, including a required final LF.
- ASCII spaces inside strings are significant, including at either end.
- Backslashes, double quotes, hashes, colons, and shell-looking content inside
  the quotes are literal. There is no escape processing.
- No other bytes or syntax are accepted, including blank lines, CRLF, BOM,
  tabs, non-ASCII, apostrophes inside values, comments, or nested collections.

Known compatibility limitation: keys currently have no length bound. YAML 1.2
limits implicit keys to 1,024 characters, so longer keys accepted here are not
strictly valid YAML. B inherits this acceptance to preserve its superset
relationship. Long-key smoke/scaling tests check behavior, not YAML conformance;
strict independent oracle checks use keys within YAML's limit.

ASCII is also valid UTF-8. YAML compatibility here targets **YAML 1.2 Core
schema**, not the different implicit typing of some YAML 1.1 loaders. Keys such
as `yes` remain strings under the chosen interpretation. The YAML mapping's
meaning is unordered; entry order is preserved by our pair-list API for useful
round trips, not asserted to be an ordered YAML mapping type.

## CLI contract

```sh
sh src/yamx.sh validate FILE
sh src/yamx.sh parse FILE
sh src/yamx.sh generate FILE

node src/cli.mjs validate FILE
node src/cli.mjs parse FILE
node src/cli.mjs generate FILE
```

Input is a stable readable regular file. Do not mutate it during processing:
the shell CLI inspects bytes with `od` before reading lines. Standard input and
concurrent file modification handling are not implemented.

| Operation | Input | Successful stdout |
|---|---|---|
| validate | YAM(M) document | Nothing |
| parse | YAM(M) document | One `key TAB value LF` record per entry |
| generate | Restricted TSV records | Canonical YAM(M) document |

The TSV transport has exactly one TAB separator per record and at least one
record. Keys and values must be representable in YAM(M); an empty value is
allowed, an empty key is not. Final LF is mandatory. There is no TSV quoting
or escaping. Newline-containing values are outside this transport's domain;
they must never be encoded as extra records by a caller.

Both CLIs stage output until validation succeeds, so invalid input produces no
partial stdout. The shell CLI uses private temporary files, bounded byte/line
passes, and sorted key records for duplicate detection. It avoids growing-prefix
string operations, including native shell suffix scans that regress on long
keys. This is not a streaming API or a formal runtime bound; see docs/quality.md
for complexity reasoning, resource budgets, and scaling checks.

The shell implementation uses POSIX od, awk, sort, cat, mkdir, and rm, and runs
under dash, Bash, and native zsh. Numeric `od` output prevents NUL and other
invalid bytes from being silently dropped before grammar checks. The JS CLI reads
bytes as Latin-1 solely for a lossless ASCII validation gate; this is not an
alternative document encoding.

## Diagnostics

Exit 0 means success, 1 means invalid data, and 2 means CLI usage or I/O failure.
Nonregular inputs are rejected. Output-device failures also exit 2; unlike invalid
input, a failing output device may have received some bytes before failing.
Invalid-data diagnostics start with `CODE line N:`; line numbers are one-based.
Error prose is explanatory and not a stable machine interface.

| Code | Meaning |
|---|---|
| E_EMPTY | No entries |
| E_CHARACTER | Byte outside the permitted alphabet |
| E_NEWLINE | Missing final LF |
| E_SYNTAX | Entry or transport syntax is unsupported |
| E_KEY | Invalid or reserved key |
| E_DUPLICATE | Repeated key |
| E_STRING | Value cannot be represented |

Byte checks precede line syntax checks. Other invalid input may violate several
rules; do not rely on diagnostic precedence beyond documented examples.

## Next decisions

The profile configuration API is not implemented. Before changing a profile or
adding another, define its grammar and relationships to existing profiles.
Possible grammar extensions include apostrophe escaping, blank lines,
whole-line comments, restricted plain strings, and bounded mapping nesting.
B now implements several of these choices; its current grammar is defined in
[balanced.md](balanced.md). Further changes remain open.
Exact indentation width and maximum collection depth are separate parameters.
Generation/parsing must preserve meaning throughout any comparable profiles.

Full YAML is a reference language, not an implementation target.

Reference: [YAML 1.2.2 specification](https://yaml.org/spec/1.2.2/).
