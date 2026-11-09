# Quality discipline

YAMX is experimental. Intentional grammar changes update the specification,
implementations, and executable examples together. There is no migration or
profile-version ceremony yet; reconsider that when the project is declared
stable. Tests describe the current contract rather than freezing every past
experiment.

## Fast loop

Install Node 24+, dash, Bash, native zsh, ShellSpec 0.28.1, and ShellCheck.
Local lint uses `shellcheck-capped` (Marek's systemd cgroup wrapper); on another
Linux machine provide an equivalent memory-capped wrapper. The CI and Alpine
runners may use plain ShellCheck inside their disposable environments.

```sh
sh scripts/setup.sh          # npm ci, install local hooks, verify dependencies
sh scripts/setup.sh --verify # detect missing tools, oracle, or hook configuration
sh scripts/check.sh          # authoritative fast gate
```

Set `SHELLSPEC=/path/to/shellspec` to select a checkout explicitly. Otherwise a
repo-local `.tools/shellspec/shellspec` takes precedence over PATH. To install
the baseline without changing a global installation:

```sh
git clone https://github.com/shellspec/shellspec.git .tools/shellspec
git -C .tools/shellspec checkout 90e48c950239f3b8a9fdfa3e869592872c77b981
```

Setup preserves an
existing custom hooksPath and asks you to integrate the hook yourself. A new
clone needs setup: Git deliberately does not install repository hooks.
The standalone `node --test test/setup.test.mjs` checks fresh-clone installation,
verification, custom-hook preservation, and propagation of gate failures. It uses
the npm cache populated by setup, without network access.

The gate runs bounded ShellCheck, JavaScript syntax checks, the shared ShellSpec
contract under dash/Bash/zsh, the JS version of that contract, and Node API/CLI,
all-byte, interoperability, seeded-generation, and independent YAML checks.
Every target is required; missing tools fail. Independent checks continue after
failure, and the final exit status aggregates the failures. The local pre-push
hook runs the same gate as CI. Hooks can be bypassed, so they supplement CI.
The development target is roughly 30 seconds, not a brittle timing assertion.

ShellCheck has a 30-second wall/CPU budget and a 512 MiB data-segment limit,
in addition to the local cgroup or container memory limit. Limits apply only to
lint: V8 needs a larger virtual address space even for syntax checks.
Each gate stage has a two-minute timeout; individual CLI probes have five
seconds. ShellSpec runs receive a private temporary directory, avoiding races
between concurrent gate invocations.

## Regression-first changes

For each confirmed bug, add a public API or CLI reproducer, observe it fail on
the old implementation, then fix it and retain the example. Exercise the shared
specification when the guarantee applies to both implementations. Every grammar
change covers acceptance, decoded meaning, nearby rejection, generation, and
interactions with existing constructs. Tests state independently expected
results; implementation agreement and round trips alone are insufficient.

Use behavior names and explained gotchas so the specs teach the contract.
Verify exit status, stdout, diagnostic code and line where promised; error prose
is not stable. Include late failures to prove no partial stdout on invalid data.
Cover malformed API values, usage/input/output failures, unusual file paths,
caller cwd and environment, and long keys/values. A dead or timed-out process is
a failed check, not evidence that malformed input was rejected correctly.

The development-only `yaml` package is locked with integrity metadata. Oracle
checks explicitly select YAML 1.2 Core and preserve keys as a Map. They compare
accepted documents against values generated independently of either parser.
The oracle does not define which documents either profile accepts. Deterministic
seeds make generated failures repeatable; minimize any discovered failure into
a permanent explained example. See https://eemeli.org/yaml/ for the oracle API.

## Complexity and resource discipline

Validation, parsing, and generation must avoid quadratic algorithms, measured
in total input/output bytes, including long keys and values. Linear work is
preferred; justified sorting is allowed. Explain the algorithm and use
adversarial scaling measurements as evidence. Timing cannot prove asymptotics,
and POSIX/JS interfaces do not promise formal bounds for every implementation.

The M shell implementation performs byte validation and line decoding in separate
bounded scans. It stages records once, sorts key/line records to detect duplicates,
and releases output only after success. It retains no growing key/output string
and uses no per-entry scan of earlier keys or native-shell suffix-pattern scan.
Sorting is the non-linear stage (comparison sorting normally scales as K log K
for K records); comparisons also process key bytes. JS uses bounded scans,
Set lookups, arrays, and a final join; its expected costs depend on the engine.
Do not advertise proven worst-case linear runtime.

B uses the same byte gate and staged output, with a bounded-depth POSIX awk
layout stack and typed preorder node records. Duplicate keys are sorted by
mapping identity and key; no growing path strings are constructed. String
escaping uses whole-record substitutions. See docs/balanced.md for its grammar,
transport and costs. Shared specs, API/CLI tests, seeded nested trees, and YAML
oracle checks cover both profiles. M's unbounded implicit-key acceptance is a
known YAML compatibility limitation inherited by B; strict oracle checks use
keys within YAML's 1,024-character limit, while long-key workloads check behavior
and resource use separately.

Shell runtime dependencies are POSIX od, awk, sort, cat, mkdir, and rm. Private
temporary storage replaces potentially quadratic in-memory shell operations.
POSIX awk decodes individual records; key uniqueness uses sorting rather than
an awk hash table. This is an independent shell/POSIX implementation, not a
wrapper around the JavaScript parser. Input must remain stable while processing.
Temporary disk use scales with input and output; this is not a streaming API.

## Deeper loops

```sh
sh scripts/portability.sh        # pinned Alpine base, complete gate + BusyBox ash
sh scripts/portability.sh --deep # mutations in dash/bash/zsh + full scaling samples
```

Use `ENGINE=docker` instead of the default Podman if desired. Containers mount
source read-only, copy the code into disposable storage, disable runtime network,
and cap memory at 768 MiB and processes at 256. Results go to `.quality-out/`.
The Node/Alpine base is pinned by digest, ShellSpec by commit, and npm dependencies
by lockfile. Alpine utility packages still receive repository updates; their
versions are printed so results can be interpreted. Ubuntu CI also records the
runner image and uses Node 24.16.0. Updating pins is a deliberate tested change.

The mutation catalogue injects meaningful faults into disposable copies of both
implementations. A clean baseline and syntactically valid mutants are required;
timeouts and process failures abort the check. Every listed mutant must be
caught. A survivor calls for investigation, not lowering a coverage target.
When refactoring changes a mutation anchor, update it and verify detection.

Scaling workloads exercise increasing record counts, long keys/values, duplicates,
and invalid bytes near EOF across all operations and required shells plus JS.
Both M and B have separate workload drivers. Full runs record three samples
and report the median as JSONL. A workload gets
15 seconds and each profile's measurement driver gets four minutes. CI preserves the
measurements as an artifact. These generous hang guards are gates; relative
performance thresholds await measurements stable enough to justify them.

CI runs fast, Alpine, and deep checks on pushes and pull requests, and weekly to
expose environment drift. GitHub's runtime job limits bound whole jobs as well.
Workflow configuration alone does not establish required branch protection.

## Definition of done

| Rule | Evidence |
| --- | --- |
| Public contract matches implementations | Shared specs, API/CLI and oracle checks |
| Reported bug stays fixed | Reproducer observed red, then green |
| All required environments work | Fast gate and Alpine/BusyBox job |
| Tests detect critical faults | All reviewed mutants detected in dash/bash/zsh |
| No known quadratic work | Algorithm review, long-input regression, scaling artifacts |
| Runtime dependencies stay small and portable | Review plus minimal Alpine userland |
| Lint suppressions are justified | Comment at every suppression; lint gate |
| Tools/hooks are installed and effective | Setup verification and fresh-checkout regression |
| Rules and docs remain true | Review affected docs and commands when changing their mechanism |

Completion reports state what changed, which checks ran, and any failures or
skips. When pushed, inspect the CI result before calling CI verified. Review
clarity, independence of implementations, complexity, and dependency additions;
a green suite does not replace judgment. Do not claim checks that did not run.
