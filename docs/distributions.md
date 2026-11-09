# Standalone Minimal artifacts

The technical artifacts for [issue #8](https://github.com/mareklangiewicz/yamx/issues/8)
are in [dist/minimal](../dist/minimal). They implement only YAM(M); they do not
load or contain Balanced's parser. The combined interfaces under `src/` retain
M as the default and explicit B selection.

The reuse license is still awaiting Marek's decision in
[issue #7](https://github.com/mareklangiewicz/yamx/issues/7). These artifacts carry
a pending-license notice, not a grant of copying/redistribution rights. Final
copy/download guidance and page integration remain in issue #10.

## Complete runtime file sets and sizes

These counts include comments, provenance, blank lines and final newlines.
CLI totals include their library, rather than counting only the entry point.
No development scripts, npm packages, repository checkout or build step are
runtime dependencies.

| Usage | Required files under `dist/minimal/` | Bytes | Lines | Runtime dependencies |
| --- | --- | ---: | ---: | --- |
| Shell CLI | `yamx.sh` | 5,200 | 151 | POSIX shell; `od`, `awk`, `sort`, `cat`, `mkdir`, `rm`; private temporary storage |
| JavaScript library | `yamx.mjs` | 3,038 | 73 | Native ES modules and language builtins |
| JavaScript CLI | `yamx.mjs`, `cli.mjs` | 4,933 | 115 | Node 24+; Node builtins |
| Lua library | `yamx.lua` | 4,097 | 108 | Lua 5.1/LuaJIT or newer; builtins only |
| Lua CLI | `yamx.lua`, `cli.lua` | 6,109 | 146 | Lua plus POSIX sh/test for regular-file checks |

Regenerate these measurements with `node scripts/distribute.mjs --sizes`.
Source size is an inspection aid, not correctness or complexity evidence.

## Interfaces

The [M grammar and transport contract](minimal.md) applies unchanged. All CLIs
accept `validate|parse|generate FILE`, optionally preceded by `--profile M`;
B selection is a usage error. JS exports `parse`, `validate`, `generate`,
`checkText` and `YamxError`. Lua exports `parse`, `validate`, `generate`,
`parse_transport`, `generate_transport` and `is_error`, with the untagged ordered
pair lists described in [the Lua interface](lua.md). Library profile arguments
may be omitted or `'M'`; other values are rejected.

Development smoke examples from the checkout:

```sh
sh dist/minimal/yamx.sh parse examples/minimal.yaml
node dist/minimal/cli.mjs validate examples/minimal.yaml
lua5.1 dist/minimal/cli.lua parse examples/minimal.yaml
```

```js
import { parse, generate } from './dist/minimal/yamx.mjs';
const entries = parse("name: 'yamx'\n"); // [['name', 'yamx']]
generate(entries);                       // "name: 'yamx'\n"
```

```lua
local y = dofile('dist/minimal/yamx.lua')
local entries = y.parse("name: 'yamx'\n")
assert(y.generate(entries) == "name: 'yamx'\n")
```

## Maintained source and verification

Run `node scripts/distribute.mjs` after editing maintained source. The assembler
inlines `common.mjs` and `minimal.mjs` for JS, omits explicitly marked Balanced
sections from shell/Lua and the JS CLI, and narrows profile selection. It uses
no minifier or external bundler. Parser logic is maintained once per language;
generated files must not be hand-edited. The source-revision SHA-256 covers
named assembly inputs and the assembly script, so it also identifies dirty
working-tree and archive source without a self-referential commit hash.

`node scripts/distribute.mjs --check` compares every distributed byte with fresh
assembly and fails on drift. The authoritative `sh scripts/check.sh` gate runs
this check, a stale-artifact regression, and the exact committed artifacts in
separate temporary directories outside the checkout. Each documented file set
has its own directory; each library loads with only its single file. CLI probes
run from outside the checkout, and shared ShellSpec examples use absolute paths
to those isolated files. Existing direct JS interface, all-byte, near-miss,
seeded/oracle, long-input, CLI and transport cases exercise these artifacts.
Lua also has a direct Minimal interface suite on 5.1, LuaJIT and 5.4.

The bounded Alpine gate includes BusyBox ash and utilities. Deep verification
regenerates each applicable maintained-source mutant and requires assertion
failures in both combined and standalone tests. The M benchmark accepts
`--distribution` to measure the copied artifacts with the same workloads,
operation checks and time budgets; JSONL records distinguish the distribution.
See [quality discipline](quality.md) for the full required environments and
commands. No browser or publication checks are implied by these parser checks.
