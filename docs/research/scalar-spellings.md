# Scalar spellings that YAML readers agree on

Research for [#14](https://github.com/mareklangiewicz/yamx/issues/14), part of
the scalar-resolution map [#13](https://github.com/mareklangiewicz/yamx/issues/13).
Collected 2026-11-20.

The question: which plain spellings and double-quoted escapes mean the same
thing to real YAML readers, so that the typed resolver can accept only those
and reject the rest loudly?

## How each claim was checked

Every loader claim comes from source code pinned to a tag or commit (links
below). Each table cell is marked by how it was checked:

- **run**: run locally against the system PyYAML 6.0.3, with both the
  pure-Python `SafeLoader` and the libyaml 0.2.5 `CSafeLoader`, by loading
  `k: <spelling>`. No library was installed for this.
- no mark: read from the pinned source, not run.
- **unverified**: the source was not read far enough to be sure; the cell says why.

Readers and the pins used:

| Short name | Reader, version | YAML version by default | Primary source |
|---|---|---|---|
| JSON | YAML 1.2.2 JSON schema | 1.2 | [spec §10.2](https://yaml.org/spec/1.2.2/#102-json-schema) |
| Core | YAML 1.2.2 Core schema | 1.2 | [spec §10.3](https://yaml.org/spec/1.2.2/#103-core-schema) |
| 1.1 types | YAML 1.1 type repository | 1.1 | [bool](https://yaml.org/type/bool.html), [int](https://yaml.org/type/int.html), [float](https://yaml.org/type/float.html), [null](https://yaml.org/type/null.html) |
| PyYAML | PyYAML 6.0.3 `SafeLoader` | 1.1 | [resolver.py](https://github.com/yaml/pyyaml/blob/6.0.3/lib/yaml/resolver.py#L170-L219), [constructor.py](https://github.com/yaml/pyyaml/blob/6.0.3/lib/yaml/constructor.py#L224-L263), [scanner.py](https://github.com/yaml/pyyaml/blob/6.0.3/lib/yaml/scanner.py#L1158-L1225) |
| libyaml | libyaml 0.2.5 (scanner only; it never resolves plain scalars, so PyYAML's `CSafeLoader` still uses PyYAML's Python resolver) | – | [scanner.c](https://github.com/yaml/libyaml/blob/0.2.5/src/scanner.c#L3119-L3250) |
| SnakeYAML | SnakeYAML 2.6 | 1.1 | [Resolver.java](https://bitbucket.org/snakeyaml/snakeyaml/src/snakeyaml-2.6/src/main/java/org/yaml/snakeyaml/resolver/Resolver.java), [SafeConstructor.java](https://bitbucket.org/snakeyaml/snakeyaml/src/snakeyaml-2.6/src/main/java/org/yaml/snakeyaml/constructor/SafeConstructor.java), [ScannerImpl.java](https://bitbucket.org/snakeyaml/snakeyaml/src/snakeyaml-2.6/src/main/java/org/yaml/snakeyaml/scanner/ScannerImpl.java) |
| snake-engine | snakeyaml-engine 3.0.1, `CoreScalarResolver` | 1.2 | [CoreScalarResolver.java](https://bitbucket.org/snakeyaml/snakeyaml-engine/src/snakeyaml-engine-3.0.1/src/main/java/org/snakeyaml/engine/v2/resolver/CoreScalarResolver.java), [CharConstants.java](https://bitbucket.org/snakeyaml/snakeyaml-engine/src/snakeyaml-engine-3.0.1/src/main/java/org/snakeyaml/engine/v2/common/CharConstants.java) |
| go v2 | go-yaml v2.4.0 | 1.1-ish | [resolve.go](https://github.com/go-yaml/yaml/blob/v2.4.0/resolve.go#L32-L200), [decode.go](https://github.com/go-yaml/yaml/blob/v2.4.0/decode.go#L474-L480), [scannerc.go](https://github.com/go-yaml/yaml/blob/v2.4.0/scannerc.go#L2379-L2460) |
| go v3 | go-yaml v3.0.1 | 1.2-ish | [resolve.go](https://github.com/go-yaml/yaml/blob/v3.0.1/resolve.go#L47-L280), [decode.go](https://github.com/go-yaml/yaml/blob/v3.0.1/decode.go#L678-L693), [scannerc.go](https://github.com/go-yaml/yaml/blob/v3.0.1/scannerc.go#L2500-L2577) |
| go v4 | yaml/go-yaml v4.0.0 (the maintained successor; `go-yaml/yaml` is archived and its README says "THIS PROJECT IS UNMAINTAINED") | 1.2-ish | [resolver.go](https://github.com/yaml/go-yaml/blob/v4.0.0/internal/libyaml/resolver.go#L92-L250), [constructor.go](https://github.com/yaml/go-yaml/blob/v4.0.0/internal/libyaml/constructor.go#L200-L210), [scanner.go](https://github.com/yaml/go-yaml/blob/v4.0.0/internal/libyaml/scanner.go#L2323-L2400) |
| js-yaml 4 | js-yaml 4.1.1, default schema (scalar code is identical to 4.1.0) | 1.2-ish | [lib/type/](https://github.com/nodeca/js-yaml/tree/4.1.1/lib/type), [schema/core.js](https://github.com/nodeca/js-yaml/blob/4.1.1/lib/schema/core.js), [loader.js](https://github.com/nodeca/js-yaml/blob/4.1.1/lib/loader.js#L89-L121) |
| js-yaml 5 | js-yaml 5.5.0, default `CORE_SCHEMA` | 1.2 | [src/tag/scalar/](https://github.com/nodeca/js-yaml/tree/5.5.0/src/tag/scalar), [migrate_v4_to_v5.md](https://github.com/nodeca/js-yaml/blob/5.5.0/docs/migrate_v4_to_v5.md#schema), [parser_scalar.ts](https://github.com/nodeca/js-yaml/blob/5.5.0/src/parser/parser_scalar.ts) |
| yaml | `yaml` on npm 2.9.1, default (`version: '1.2'`, `schema: 'core'`) | 1.2 | [schema/core/](https://github.com/eemeli/yaml/tree/v2.9.1/src/schema/core), [common/null.ts](https://github.com/eemeli/yaml/blob/v2.9.1/src/schema/common/null.ts), [json/schema.ts](https://github.com/eemeli/yaml/blob/v2.9.1/src/schema/json/schema.ts), [options.ts](https://github.com/eemeli/yaml/blob/v2.9.1/src/options.ts#L86-L143), [resolve-flow-scalar.ts](https://github.com/eemeli/yaml/blob/v2.9.1/src/compose/resolve-flow-scalar.ts#L210-L247) |
| yaml 1.1 | `yaml` on npm 2.9.1 with `version: '1.1'` (or a `%YAML 1.1` directive) | 1.1 | [schema/yaml-1.1/](https://github.com/eemeli/yaml/tree/v2.9.1/src/schema/yaml-1.1) |
| ruamel | ruamel.yaml 0.19.1 (commit `18535afd`), default 1.2; a `%YAML 1.1` directive switches tables | 1.2 | [resolver.py](https://sourceforge.net/p/ruamel-yaml/code/ci/18535afdf40e92015047ba059f9001e55f3f6ce6/tree/resolver.py), [constructor.py](https://sourceforge.net/p/ruamel-yaml/code/ci/18535afdf40e92015047ba059f9001e55f3f6ce6/tree/constructor.py), [scanner.py](https://sourceforge.net/p/ruamel-yaml/code/ci/18535afdf40e92015047ba059f9001e55f3f6ce6/tree/scanner.py), [compat.py](https://sourceforge.net/p/ruamel-yaml/code/ci/18535afdf40e92015047ba059f9001e55f3f6ce6/tree/compat.py) (`_DEFAULT_YAML_VERSION = (1, 2)`) |
| StrictYAML | StrictYAML 1.7.3 | – | [parser.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/parser.py), [scalar.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/scalar.py), [constants.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/constants.py), [utils.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/utils.py) |

JSON numbers and strings are taken from [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259).

## 1. JSON schema compared with Core schema (the spec)

The spec's resolution tables, quoted from §10.2.2 and §10.3.2:

| Tag | JSON schema regex | Core schema regex |
|---|---|---|
| null | `null` | `null \| Null \| NULL \| ~` and the empty scalar |
| bool | `true \| false` | `true \| True \| TRUE \| false \| False \| FALSE` |
| int | `-? ( 0 \| [1-9] [0-9]* )` | `[-+]? [0-9]+`, `0o [0-7]+`, `0x [0-9a-fA-F]+` |
| float | `-? ( 0 \| [1-9] [0-9]* ) ( \. [0-9]* )? ( [eE] [-+]? [0-9]+ )?` | `[-+]? ( \. [0-9]+ \| [0-9]+ ( \. [0-9]* )? ) ( [eE] [-+]? [0-9]+ )?`, `[-+]? \.(inf\|Inf\|INF)`, `\.(nan\|NaN\|NAN)` |
| anything else | **Error** | `tag:yaml.org,2002:str` |

In both schemas the first match wins and int is tried before float, so `0` is an int.

What follows from the tables:

- **Same tag and value in both schemas:** `null`, `true`, `false`;
  integers matching `-?(0|[1-9][0-9]*)` (and `-0` resolves to int 0 in both);
  and every spelling that matches the JSON float regex but not the JSON int
  regex, for example `1.5`, `-0.0`, `1e3`, `2.3e4`, `-2E+05`, `0.`, `1.`. Core's
  float regex covers JSON's, and int comes first in both, so these floats
  agree in tag and value.
- **The spec admits one quirk:** the JSON-schema float regex allows `1.` (no
  digit after the dot), which JSON itself (RFC 8259 `frac = decimal-point 1*DIGIT`)
  rejects. The note in §10.2.2 says this "cannot be addressed in the 1.2.2
  specification".
- **Plain strings never agree.** Under the JSON schema a plain scalar that
  matches none of the regexes is an error, and §10.2.2 says the processor
  "should consider them to be an error". So `hello` is `!!str` under Core and
  an error under JSON. The only string spelling the JSON schema accepts is a
  quoted one. For yamx, "plain strings" in the typed resolver can only mean
  "Core says str and no common reader gives it another type" (see §3).
- **Core-only spellings** (JSON schema gives an error): `Null`, `NULL`, `~`, the
  empty scalar, `True`, `TRUE`, `False`, `FALSE`, `+1`, `007`, `0777`, `08`
  (Core: decimal int 7, 777, 8), `0o7`, `0x1F`, `.5`, `+1.5`, `.inf`, `-.Inf`, `+.INF`,
  `.nan`, `.NaN`, `.NAN`. The spec's own Example 10.8 lists `True, Null, 0o7, 0x3A, +12.3`
  as invalid under JSON.
- Ints have "arbitrary size" in the spec (§10.2.1.3), and a processor "may
  reject such a value as an error, truncate it with a warning or find some
  other manner to round-trip it". RFC 8259 §6 promises exact agreement only for
  integers in `[-(2**53)+1, (2**53)-1]`.

## 2. Plain spellings in YAML 1.2 readers

Cells give the resulting type and value. **ERR** means the reader rejects the
document. A dash (–) means the spelling does not apply.

| Spelling | JSON | Core | yaml | js-yaml 5 | js-yaml 4 | go v3 | go v4 | ruamel | snake-engine |
|---|---|---|---|---|---|---|---|---|---|
| `null` | null | null | null | null | null | null | null | null | null |
| `Null` `NULL` `~` (empty) | ERR | null | null | null | null | null | null | null | null |
| `true` `false` | bool | bool | bool | bool | bool | bool | bool | bool | bool |
| `True` `TRUE` `False` `FALSE` | ERR | bool | bool | bool | bool | bool | bool | bool | bool |
| `yes` `no` `on` `off` `y` `n` | ERR | str | str | str | str | str, but **bool** when decoded into a Go `bool` | str, but **bool** when decoded into a Go `bool` | str | str |
| `0` `34` `-12` | int | int | int | int | int | int | int | int | int |
| `-0` | int 0 | int 0 | int **−0** (JS `parseInt("-0")`) | int **−0** (`-1 * parseInt("0")`) | int 0 | int 0 | **float −0.0** (`resolveMap` has `-0`, `-0.0` as `negativeZero`) | int 0 | int (sign of zero unverified: the constructor was not read) |
| `+1` | ERR | int 1 | int 1 | int 1 | int 1 | int 1 | int 1 | int 1 | int 1 |
| `007` | ERR | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 |
| `0777` | ERR | int 777 | int 777 | int 777 | int 777 | **int 511** (Go `ParseInt(s, 0, 64)`; the source comment says 1.1 octals "are still decoded by default in v3") | **int 511** | int 777 | int (value unverified) |
| `08` | ERR | int 8 | int 8 | int 8 | int 8 | **float 8** (int parse fails as octal, `yamlStyleFloat` matches) | **float 8** | int 8 | int (value unverified) |
| `0o7` | ERR | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 |
| `0x1F` | ERR | int 31 | int 31 | int 31 | int 31 | int 31 | int 31 | int 31 | int 31 |
| `0b101` | ERR | str | str | str | **int 5** | **int 5** | **int 5** | **int 5** | str |
| `1_000` | ERR | str | str | str | **int 1000** | **int 1000** (`_` stripped before parsing) | **int 1000** | **int 1000** | str |
| `1:20` | ERR | str | str | str | str | str (source: "Base 60 floats … purposefully unsupported") | str | str | str |
| `1.5` `1e3` `-2E+05` | float | float | float | float | float | float | float | float | float |
| `1.` | float 1 | float 1 | float 1 | float 1 | float 1 | float 1 | float 1 | float 1 | float 1 |
| `.5` | ERR | float | float | float | float | float | float | float | float |
| `.inf` `-.inf` `.nan` | ERR | float | float | float | float | float | float | float | float |
| `2001-12-14` | ERR | str | str | str | **Date** (default schema adds `timestamp`) | **time.Time** | **time.Time** | **date** (timestamp resolver is registered for 1.2 too) | str |
| `=` | ERR | str | str | str | str | str | str | `!!value` tag (constructor behaviour unverified) | str |
| `<<` (as a value) | ERR | str | str (merge is off by default for 1.2) | str (merge is opt-in in v5) | `!!merge` | `!!merge` | `!!merge` | `!!merge` | str unless merge is enabled |
| `9007199254740993` (2^53+1) | int | int | **9007199254740992** unless `intAsBigInt` | **9007199254740992** | **9007199254740992** | int, exact (int64) | int, exact | int, exact | int (width unverified) |

js-yaml 4 note: its own comment in `schema/json.js` says that "JS-YAML does not
support schema-specific tag resolution restrictions", so its `JSON_SCHEMA`
and `CORE_SCHEMA` give the same results, which are more lenient than the spec
(binary, `_`, `Null`). js-yaml 5 and `yaml` have separate, spec-shaped JSON
schemas ([int_json.ts](https://github.com/nodeca/js-yaml/blob/5.5.0/src/tag/scalar/int_json.ts),
[yaml json/schema.ts](https://github.com/eemeli/yaml/blob/v2.9.1/src/schema/json/schema.ts)).
`yaml`'s JSON schema reports the spec's error: `Unresolved plain scalar`.

## 3. Plain spellings in YAML 1.1 readers

| Spelling | 1.1 types | PyYAML (run) | SnakeYAML | go v2 | yaml 1.1 | ruamel `%YAML 1.1` |
|---|---|---|---|---|---|---|
| `null` `Null` `NULL` `~` (empty) | null | null | null | null | null | null |
| `true` `True` `TRUE` | bool | bool | bool | bool | bool | bool |
| `yes` `Yes` `YES` `no` `on` `off` (all case forms) | bool | **bool** | **bool** | **bool** | **bool** | **bool** |
| `y` `Y` `n` `N` | bool | str | str | **bool** | **bool** | **bool** |
| `0` `34` `-12` | int | int | int | int | int | int |
| `-0` | int 0 | int 0 | int 0 | int 0 | int **−0** (JS) | int 0 |
| `+1` | int 1 | int 1 | int 1 | int 1 | int 1 | int 1 |
| `0777` | int 511 | **int 511** | **int 511** | **int 511** | **int 511** | **int 511** |
| `007` | int 7 | int 7 | int 7 | int 7 | int 7 | int 7 |
| `08` | str | str | str | **float 8** | **int 8** | str |
| `0o7` | str | str | str | **int 7** (Go base-0 parsing accepts `0o`) | str | str |
| `0x1F` | int 31 | int 31 | int 31 | int 31 | int 31 | int 31 |
| `0b101` | int 5 | int 5 | int 5 | int 5 | int 5 | int 5 |
| `1_000` | int 1000 | int 1000 | int 1000 | int 1000 | int 1000 | int 1000 |
| `1:20` | int 80 | **int 80** | **int 80** | str | **int 80** | **int 80** |
| `1.5` `1.` `.5` | float | float | float | float | float | float |
| `1e3` | str (1.1 float needs a `.`) | **str** | float 1000 | float 1000 | float 1000 | float 1000 |
| `1.5e3` | str (1.1 exponent needs a sign) | **str** | float | float | float | float |
| `1.5e+3` | float | float | float | float | float | float |
| `.inf` `.nan` | float | float | float | float | float | float |
| `2001-12-14` | timestamp | **date** | **Date** | str (v2 turns timestamps back into strings for `interface{}`) | **Date** | **date** |
| `=` | `!!value` | **ERR** (`ConstructorError`: SafeConstructor has no `!!value` constructor) | `!!value` tag (constructor unverified) | str | str | `!!value` tag (unverified) |
| `9007199254740993` | int | int, exact | int (Java `BigInteger` fallback; unverified) | int, exact | **9007199254740992** | int, exact |

Both PyYAML loaders gave identical results for every spelling above (run), as
expected since libyaml never resolves plain scalars.

### Misread risks

A 1.1 reader, or go-yaml decoding into a typed Go `bool`, gives a non-string
to these plain spellings, which Core reads as strings:

- **Booleans:** `yes`, `no`, `on`, `off` in every case form (`Yes`, `YES`, …), read by every 1.1 reader
  checked. `y`, `Y`, `n`, `N` are read as booleans by the 1.1 spec, go v2,
  `yaml` 1.1 and ruamel 1.1, but **not** by PyYAML or SnakeYAML. go v3 and v4
  also turn all of these into `true`/`false` when the Go target type is `bool`
  ([v3 decode.go](https://github.com/go-yaml/yaml/blob/v3.0.1/decode.go#L684-L692),
  [v4 constructor.go](https://github.com/yaml/go-yaml/blob/v4.0.0/internal/libyaml/constructor.go#L203-L206)).
- **Numbers:** anything with `_` (`1_000`); sexagesimal `1:20`, `-1:20`, `1:20.5`
  (not in go-yaml); binary `0b101`; and `0o7` in go-yaml only.
- **Timestamps:** `2001-12-14` and the longer date-time forms (PyYAML, SnakeYAML, js-yaml 4, go v3/v4,
  ruamel even in 1.2 mode, `yaml` 1.1).
- **Special keys:** `=` (an error in PyYAML) and `<<` (a merge key in most loaders).

A 1.1 reader gives a **different number** to these spellings, which Core reads as numbers:

- Leading-zero integers: `0777` is 511 in 1.1 and in go v2, v3 and v4, but 777 in Core. Also `010`, `007`
  (equal by luck only when every digit is below 8 and the value is below 8).
- `08`, `09`: str in PyYAML and SnakeYAML, float in go-yaml, int in Core.
- `1e3`, `1.5e3`: str in PyYAML (1.1 floats need a dot and a signed exponent).
- `-0`: int 0, int −0 (JS) or float −0.0 (go v4).

Among the spelling families checked, these get the same reading from every
reader, 1.1 or 1.2: `null`, `true`, `false`, `-?[1-9][0-9]*`, `0`, and floats
of the form `-?(0|[1-9][0-9]*)\.[0-9]+([eE][-+][0-9]+)?`. The last two have
caveats: no reader agrees exactly beyond 2^53 in JavaScript, and float
values agree only up to binary64 rounding.

## 4. Double-quoted escapes compared with JSON

The YAML 1.2.2 escape set ([§5.7](https://yaml.org/spec/1.2.2/#57-escaped-characters),
productions [41]–[62]) is: `\0 \a \b \t \<TAB> \n \v \f \r \e \<SPACE> \" \/ \\ \N \_ \L \P \xHH \uHHHH \UHHHHHHHH`.
The JSON set ([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)) is `\" \\ \/ \b \f \n \r \t \uHHHH`.
JSON's set is a strict subset of YAML's; the spec says `\/` exists "for JSON
compatibility" and that double-quoted style "is a superset of the JSON string format".

- **YAML-only escapes:** `\0 \a \v \e \<SPACE> \<TAB> \N \_ \L \P \x \U`.
- **`\^@`** (named in the issue) is neither a YAML nor a JSON escape. All
  readers checked reject unknown escapes. For PyYAML both loaders give a
  `ScannerError` (run). So do `\'` and `\q`, except that go v2 and v3 accept `\'`.
- **Surrogates:** RFC 8259 writes non-BMP characters as a `𝄞`
  surrogate pair and says a lone surrogate gives "unpredictable" behaviour
  (§8.2). YAML defines escapes as Unicode *characters* and excludes the
  surrogate block from its printable set (§5.1). It never mentions `\u` pairs,
  and its own non-BMP escape is `\U0001D11E`. The spec does not say whether
  `𝄞` is valid YAML.

| Escape | YAML 1.2 | JSON | PyYAML pure (run) | libyaml (run, via CSafeLoader) | go v2, v3 | go v4 | SnakeYAML | snake-engine | js-yaml 4, 5 | yaml | ruamel |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `\" \\ \b \f \n \r \t` | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `\/` | yes | yes | yes | yes | **ERR** (no case for `/`) | yes | **ERR** (missing from `ESCAPE_REPLACEMENTS`) | yes | yes | yes | yes |
| `é`, `é` (BMP, not a surrogate) | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `😀` (pair) | undefined | U+1F600 | **two lone surrogates**; the string cannot be encoded as UTF-8 | **ERR** "invalid Unicode character escape code" | **ERR** (same check) | **ERR** | U+1F600 (Java UTF-16 `appendCodePoint` per half; unverified beyond the source) | unverified | U+1F600 (JS UTF-16 halves join) | U+1F600 (`String.fromCodePoint` per half) | two lone surrogates (`chr(code)`, like PyYAML) |
| `\uD83D` (lone) | undefined | "unpredictable" | lone surrogate | **ERR** | **ERR** | **ERR** | lone surrogate (unverified) | unverified | lone surrogate | lone surrogate | lone surrogate |
| `\U0001F600` | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `\x41 \0 \a \v \e \<SPACE> \N \_` | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `\<TAB>` | yes | no | yes | yes | yes | yes | **ERR** (not in the map) | yes | yes | yes | yes |
| `\L \P` | yes | no | yes | yes | yes | yes | yes | **ERR** (not in `ESCAPE_REPLACEMENTS`; the rest of the scanner was not traced) | yes | yes | yes |
| `\'` | no | no | ERR | ERR | **accepted** | ERR | ERR | ERR | ERR | ERR | ERR |

Raw characters, not escapes: YAML 1.2 requires processors to "allow all
non-C0 characters inside quoted scalars" (§5.1, `nb-json`). PyYAML instead
rejects a raw DEL (U+007F), C1 controls (U+0080–U+009F) and U+FFFE inside
double quotes with a `ReaderError` (run, both loaders). A generator should
write these as `\u` escapes.

Conclusion for the escape set: the JSON escapes on which every reader agrees
are `\" \\ \b \f \n \r \t` and `\uHHHH` for any value outside D800–DFFF. Two
JSON escapes fail somewhere:

- `\/` is rejected by go-yaml v2 and v3 and by SnakeYAML 2.6.
- `\uD800`–`\uDFFF`, paired or lone, is rejected by libyaml (so also by
  PyYAML's C loader) and by go-yaml. Python-based readers keep the halves as
  lone surrogates, and UTF-16 runtimes (JS, Java) join them.

A non-BMP character has to be written literally in UTF-8 to keep the JSON
subset. `\U` would work everywhere checked, but it is not JSON.

## 5. StrictYAML's strings-by-default rule

StrictYAML 1.7.3 ships a vendored ruamel.yaml (`strictyaml/ruamel/`).
Its `StrictYAMLLoader` keeps ruamel's `VersionedResolver`, so implicit
resolution still assigns `!!bool`, `!!int` and the other tags. But
`StrictYAMLConstructor` starts from an empty `yaml_constructors = {}` and maps
every scalar tag (`null`, `bool`, `int`, `float`, `binary`, `timestamp`, `str`)
to `RoundTripConstructor.construct_yaml_str`
([parser.py L35–L36, L137–L185](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/parser.py#L35-L185)).
So the resolved tag is computed and then thrown away, and every scalar
becomes its string. Its scanner also rejects tag tokens, anchors and,
unless allowed, flow collections.

Types come back only through a user schema. `Any()` returns "simple
dicts/lists of strings"
([any_validator.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/any_validator.py)).
`Bool()` accepts `yes true on 1 y` / `no false off 0 n` case-insensitively
([constants.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/constants.py),
[scalar.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/scalar.py)).
`Int()` matches `^[-+]?[0-9_]+$` and `Float()` a decimal regex that allows
`_`, `4.` and exponents
([utils.py](https://github.com/crdoconnor/strictyaml/blob/1.7.3/strictyaml/utils.py)).
The validators read the constructed string, so as far as the source shows,
quoting does not change the result: `"yes"` and `yes` validate the same way.
That is the opposite of yamx's choice, where a resolver works from the scalar
token and the quotes are part of it. The background rationale is in
[Implicit typing removed](https://hitchdev.com/strictyaml/why/implicit-typing-removed/).

## 6. What this means for the typed resolver (inference, not a decision)

- The plain set in the #13 note (`true`, `false`, `null`, decimal integers)
  is confirmed as agreed by both 1.2 schemas and by every 1.1 loader checked,
  provided that "decimal integer" means `0|-?[1-9][0-9]*`, with no leading zeros, no `+` and no `_`.
- Two edges are worth rejecting loudly or bounding:
  - `-0` is int 0 in the spec, but −0 in both JS libraries and float −0.0 in go-yaml v4.
  - Integers beyond ±(2^53−1) lose precision in every JS reader by default (RFC 8259 §6 draws the same line).
- Floats are not in the #13 set, but they *do* agree under JSON and Core. The
  shape that also survives PyYAML is `-?(0|[1-9][0-9]*)\.[0-9]+([eE][-+][0-9]+)?`,
  with digits on both sides of the dot and a signed exponent if there is one.
  This is Marek's call.
- Plain strings have no JSON-schema meaning (it reports an error), so the
  resolver must define them as plain scalars that Core reads as str *and* that
  no 1.1 reader in §3 types. The loaders themselves dispatch on the first character,
  for example PyYAML's `first` lists and go-yaml's `resolveTable`: `yYnNtTfFoO`,
  `-+0123456789.`, `~`, `<`, `=`, and the empty scalar. A matching guard is
  one possible simple rule. It would also reject harmless words like `fast`
  or `-x`, a trade-off for the #13 rule of thumb.
- For the escape set, "exactly JSON's escapes" needs two cuts to be portable:
  drop `\/`, and drop `\u` values D800–DFFF. Then every reader checked agrees.
  A generator should also escape raw DEL and C1 characters as `\u00XX`, or
  PyYAML refuses the output.
