# Lua implementation

`src/yamx.lua` is an independent, dependency-free Lua module. Lua 5.1,
LuaJIT and Lua 5.4 are required test targets. The implementation uses Lua 5.1
syntax and standard APIs available in newer Lua versions. It never evaluates
YAMX input as code. It does not depend on luagnd or invoke either other parser.

Load it with `require('yamx')` after adding `src/?.lua` to your package path,
or use `dofile` with an explicit path:

```lua
local yamx = dofile('src/yamx.lua')
local entries = yamx.parse("name: 'yamx'\n")
assert(entries[1][1] == 'name' and entries[1][2] == 'yamx')
local text = yamx.generate(entries)
yamx.validate(text) -- returns nil on success
```

`parse(text, profile)`, `validate(text, profile)`, and `generate(value, profile)`
use M when profile is omitted or nil. Select `'B'` explicitly for Balanced.
M parses to a dense ordered list of `{key, string}` pairs.

## Balanced values

B uses tagged tables, so empty maps and sequences retain their kind. Maps are
ordered dense lists of `{key, value}` pairs; they are not key-indexed Lua tables.
Sequences are dense lists of values. `yamx.map(entries)` and `yamx.seq(items)`
tag the supplied untagged table in place; omitting the argument creates an empty
collection. Constructors tag values; `generate` validates the complete tree.

```lua
local value = yamx.map({
  { 'name', 'yamx' },
  { 'items', yamx.seq({ false, yamx.null, yamx.map(), yamx.seq() }) },
})
local text = yamx.generate(value, 'B')
local parsed = yamx.parse(text, 'B')
assert(yamx.kind(parsed) == 'map')
assert(parsed[2][2][2] == yamx.null)
```

Scalars are Lua strings, booleans, safe integer numbers, and the singleton
`yamx.null`. Lua `nil` is not a data value: using it removes table entries.
The shared integer range is -9007199254740991 through 9007199254740991, which
is exactly representable by the standard double-number Lua 5.1/LuaJIT builds.
Negative zero generates as `0`. `yamx.kind(value)` returns `'map'`, `'seq'`,
or `'null'` for these special values and nil otherwise.

Generation rejects untagged B tables, holes, extra list fields, malformed
pairs, duplicate/invalid keys, cycles, unsupported scalars, unsafe numbers,
and excessive depth. Shared subtrees without cycles are allowed. Validation
and generation retain the existing profile specifications, including ASCII
and final LF requirements. Map insertion order is preserved.

## Errors

Invalid documents and unrepresentable values raise error tables with `code`,
`line`, and `message` fields. `tostring(error)` gives the common diagnostic form.
`yamx.is_error(error)` distinguishes these from ordinary Lua API usage errors.
Use `pcall` to catch them:

```lua
local ok, err = pcall(yamx.parse, "a: bare\n")
assert(not ok and yamx.is_error(err))
assert(err.code == 'E_SYNTAX' and err.line == 1)
```

Unknown profiles, non-string parse input and invalid constructor arguments
raise ordinary Lua usage errors. Data error line numbers refer to input lines;
API generation numbers M entries or B preorder nodes, including the root.

## CLI and development transport

```sh
lua5.1 src/cli.lua validate examples/minimal.yaml
luajit src/cli.lua --profile B parse examples/balanced.yaml > nodes.tsv
lua5.4 src/cli.lua --profile B generate nodes.tsv
```

The CLI matches shell/JavaScript operations and exit codes: 0 success, 1 invalid
data, 2 usage or I/O failure. It accepts a readable, stable regular file.
Standard Lua lacks a stat API, so the CLI additionally requires POSIX sh/test
for `test -f`; paths are shell-quoted. The library itself only uses Lua builtins.
The CLI loads the module relative to its script, independent of caller cwd.
It buffers validated output and checks write/flush errors.

`parse_transport(text, profile)` decodes the existing restricted M pair records
or B typed preorder records into API values. `generate_transport(value, profile)`
emits those records. These are development transports shared by the three CLIs,
not a general TSV format. See [Minimal](minimal.md) and [Balanced](balanced.md).
JSON export remains a separately agreed, pending feature across implementations.

## Focused checks

```sh
lua5.1 spec/lua_api.lua
YAMX_IMPL=lua YAMX_LUA=luajit shellspec --format documentation spec
YAMX_LUA=lua5.4 node --test spec/lua.test.mjs spec/balanced.test.mjs spec/cli.test.mjs
sh scripts/check.sh
```

The full gate requires all three Lua runtimes. Mutation and scaling checks also
include Lua; see [quality discipline](quality.md).
