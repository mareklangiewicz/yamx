# YAMX

**A parameterized family of YAML subsets.**

Think of the name as **YAM(X)**: X selects features and parameters. YAMX is the
plain project name, without punctuation. Parameters may be booleans, numbers,
enums, or sets: allowed scalar styles, indentation width, maximum collection
depth, and so on.

The goal is to make each supported profile easy to **validate, parse, and
generate**, including on small systems using shell scripts. The smallest
profiles should have correspondingly tiny implementations. Full YAML support
is not the destination.

## Status

Experimental bootstrap. Only **Core-0**, a deliberately tiny flat mapping
profile, is implemented. Its precise choices are provisional; there is no
implemented profile configuration API yet.

```yaml
name: 'yamx'
description: 'A parameterized family of YAML subsets'
status: 'experimental'
```

Core-0 uses lowercase identifier keys and single-line ASCII strings in single
quotes, with no apostrophe escaping. Every line ends in LF. Blank lines,
comments, nesting, implicit types, and alternative spellings are rejected.
See the [complete grammar and CLI contract](docs/core-0.md).

## Implementations

- **POSIX shell/POSIX utilities:** `src/yamx.sh`, supported under dash, Bash,
  and native zsh. Uses `od`, `awk`, `sort`, `cat`, `mkdir`, and `rm`, with
  private temporary storage. No YAML library or JavaScript runtime dependency.
- **JavaScript:** `src/yamx.mjs`, an independent dependency-free ES module,
  plus the Node CLI `src/cli.mjs`. No transpilation or bundling.

Both CLIs take an operation and a readable, stable regular file:

```sh
sh src/yamx.sh validate examples/core.yaml
sh src/yamx.sh parse examples/core.yaml > entries.tsv
node src/cli.mjs generate entries.tsv
```

`parse` emits a restricted TSV representation: key, one TAB, value, LF.
Core-0 values cannot contain tabs or newlines, so this transport is unambiguous.
`generate` consumes that same representation. It is a development interface,
not a general-purpose TSV format or a commitment for future profiles.

```js
import { parse, generate, validate } from './src/yamx.mjs';

const text = "name: 'yamx'\n";
validate(text);                    // returns undefined, or throws YamxError
parse(text);                       // [['name', 'yamx']]
generate([['name', 'yamx']]);       // "name: 'yamx'\n"
```

## Executable specification

[ShellSpec](https://github.com/shellspec/shellspec) is the primary behavioral
specification. Nested examples explain accepted input, rejected constructs,
decoded values, generation, and diagnostics. The same suite runs against both
implementations. Node's built-in test runner additionally checks the JS API,
all possible input-byte values, and interoperability with shell.

Install ShellSpec **0.28.1**, Node **24 or newer**, dash, Bash, native zsh,
and bounded ShellCheck (see [quality discipline](docs/quality.md)), then run:

```sh
sh scripts/setup.sh
sh scripts/check.sh
```

Use `SHELLSPEC=/path/to/shellspec` if it is not on PATH. The CLI and spec runner
are invoked through interpreters; executable file permissions are not needed.
The gate requires dash, Bash, and native zsh and runs shared specs, API/CLI
regressions, all-byte checks, seeded inputs, and an independent YAML 1.2 oracle.
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
and metadata that small shell scripts can consume. Nesting, plain strings,
comments, and numeric depth/indentation parameters are possible next steps.
General JSON syntax, anchors/aliases, tags, and document streams are outside
the current scope; adding any feature requires keeping validation simple.

See [AGENTS.md](AGENTS.md) for contribution guidance.
