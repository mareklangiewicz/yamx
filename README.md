# YAMX

**A parameterized family of YAML subsets.**

**YAMX** is the project name; **YAM(X)** denotes the family. Profile letters
identify curated feature bundles, rather than individual features or use cases.
Names do not imply an inclusion hierarchy: specifications define profile
relationships. Experimental status is separate from profile names.

- **YAM(M) — Minimal:** the currently implemented, deliberately tiny flat mapping
  profile. Its grammar and CLI contract are specified in [docs/minimal.md](docs/minimal.md).
- **YAM(B) — Balanced:** a general-purpose profile balancing
  expressive power with simple implementation through a carefully selected
  bundle of YAML features. The first version adds block collections, comments,
  quoted and plain strings, booleans, null, and safe decimal integers. See
  [the grammar, API, and node transport](docs/balanced.md).

Parameters may be booleans, numbers, enums, or sets: allowed scalar styles,
indentation width, maximum collection depth, and so on.

The goal is to make each supported profile easy to **validate, parse, and
generate**, including on small systems using shell scripts. The smallest
profiles should have correspondingly tiny implementations. Full YAML support
is not the destination.

## Status

Experimental. **YAM(M) — Minimal** and **YAM(B) — Balanced** are implemented.
Their grammars can evolve with their specifications and tests. M remains the
default; select B explicitly with `--profile B` in any CLI or the second
argument `'B'` in the JavaScript or Lua API. There is no general profile configuration
API yet.

```yaml
name: 'yamx'
description: 'A parameterized family of YAML subsets'
status: 'experimental'
```

YAM(M) uses lowercase identifier keys and single-line ASCII strings in single
quotes, with no apostrophe escaping. Every line ends in LF. Blank lines,
comments, nesting, implicit types, and alternative spellings are rejected.
See the [complete grammar and CLI contract](docs/minimal.md).

## Implementations

- **POSIX shell/POSIX utilities:** `src/yamx.sh`, with `src/balanced.awk` beside
  it for B, supported under dash, Bash, and native zsh. Uses `od`, `awk`, `sort`, `cat`, `mkdir`, and `rm`, with
  private temporary storage. No YAML library or JavaScript runtime dependency.
- **Lua:** `src/yamx.lua`, an independent module for Lua 5.1/LuaJIT and newer
  Lua, plus `src/cli.lua`. The library uses only builtins; the CLI additionally
  uses POSIX sh/test for file-type checks. See [the Lua API](docs/lua.md).
- **JavaScript:** `src/yamx.mjs`, an independent dependency-free ES module,
  plus the Node CLI `src/cli.mjs`. No runtime packages or consumer build step.

Readable profile-specific artifacts are available as a technical preview in
[`dist/minimal`](dist/minimal) and [`dist/balanced`](dist/balanced). See the [complete file sets, measurements and
assembly/verification process](docs/distributions.md); the reuse license decision
is still pending.

All three CLIs take an operation and a readable, stable regular file:

```sh
sh src/yamx.sh validate examples/minimal.yaml
sh src/yamx.sh parse examples/minimal.yaml > entries.tsv
node src/cli.mjs generate entries.tsv
lua5.1 src/cli.lua parse examples/minimal.yaml
```

By default, `parse` emits a restricted TSV representation: key, one TAB, value, LF.
YAM(M) values cannot contain tabs or newlines, so this transport is unambiguous.
`generate` consumes that same representation. It is a development interface,
not a general-purpose TSV format or a commitment for future profiles.

B uses typed preorder node records, carrying depth, kind, key and value:

```sh
sh src/yamx.sh --profile B parse examples/balanced.yaml > nodes.tsv
node src/cli.mjs --profile B generate nodes.tsv
```

See [B's node transport](docs/balanced.md#node-transport) for the record contract.

```js
import { parse, generate, validate } from './src/yamx.mjs';

const text = "name: 'yamx'\n";
validate(text);                    // returns undefined, or throws YamxError
parse(text);                       // [['name', 'yamx']]
generate([['name', 'yamx']]);       // "name: 'yamx'\n"

const tree = parse('items:\n  - shell\n  - portable\n', 'B'); // Map + array
generate(tree, 'B');
```

## Executable specification

[ShellSpec](https://github.com/shellspec/shellspec) is the primary behavioral
specification. Nested examples explain accepted input, rejected constructs,
decoded values, generation, and diagnostics. The same suite runs against all three
implementations. Node's built-in test runner additionally checks the JS and Lua
APIs, all possible input-byte values, and interoperability across the CLIs.

Install ShellSpec **0.28.1**, Node **24 or newer**, dash, Bash, native zsh,
Lua **5.1**, **LuaJIT**, **5.4**, and bounded ShellCheck (see [quality discipline](docs/quality.md)), then run:

```sh
sh scripts/setup.sh
sh scripts/check.sh
```

Use `SHELLSPEC=/path/to/shellspec` if it is not on PATH. The CLI and spec runner
are invoked through interpreters; executable file permissions are not needed.
The gate requires dash, Bash, native zsh, Lua 5.1, LuaJIT, and Lua 5.4. It runs
shared specs, API/CLI regressions, all-byte checks, seeded inputs, and an independent YAML 1.2 oracle.
Setup installs the same gate as a local pre-push hook; verify it with
`sh scripts/setup.sh --verify`. CI also requires Alpine/BusyBox portability,
targeted mutation checks, and bounded scaling workloads. ShellSpec and the
locked YAML oracle are development dependencies only. See
[docs/quality.md](docs/quality.md) for commands, constraints, and completion rules.
`sh scripts/test.sh` remains a focused single-shell behavioral runner.

## Design direction

- Start with a tiny common grammar and add independently justified extensions.
- Reject unsupported syntax; never silently ignore or reinterpret it.
- Keep accepted documents valid YAML 1.2 with the documented interpretation.
- For an extending profile, preserve both accepted documents and their meaning.
- Derive profile relationships from language inclusion. A larger depth limit
  broadens a language; changing exact indentation width need not do so.
- Require generators to reject values the selected profile cannot represent.
- Use implementation simplicity as feedback on language design. Tests provide
  evidence of correctness, not a formal proof.

The initial use case is software catalogs containing names, versions, URLs,
and metadata that small shell scripts can consume. B adds nesting, plain
strings and comments. Its exact two-space indentation
and maximum node depth of 32 are fixed for now; configurable parameters remain
future work.
General JSON syntax, anchors/aliases, tags, and document streams are outside
the current scope; adding any feature requires keeping validation simple.

See [AGENTS.md](AGENTS.md) for contribution guidance.

Both profiles currently inherit M's acceptance of keys longer than YAML's
1,024-character implicit-key limit. This is a known YAML compatibility limitation;
see [the profile specification](docs/minimal.md).
