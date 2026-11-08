# Working on YAMX

## Purpose

YAMX means YAM(X): a parameterized family of small YAML subsets. X can contain
boolean, numeric, enum, and set parameters. Small parsers and validators,
especially shell implementations, are a design goal. Do not drift toward a
general YAML parser or introduce a framework for hypothetical future features.

## Current scope

- Core-0 is an experimental starting point, specified in docs/core-0.md.
- Keep future ideas separate from implemented guarantees.
- Maintain independent POSIX shell and plain JavaScript implementations.
- Shell runtime dependencies are builtins and POSIX od, awk, sort, cat, mkdir,
  and rm, with private temporary storage. Justify and test added dependencies.
  Keep this implementation independent of JavaScript.
- JavaScript uses native ES modules and Node builtins, with no build step or
  runtime packages. Keep the library independent of any GitHub Action wrapper.
- Use real YAML 1.2 syntax and explicitly documented scalar semantics.

## Behavioral contract

- Reject input outside the selected profile, including malformed bytes.
- Never evaluate input as shell or JavaScript code.
- Validation must enforce the same grammar as parsing.
- Emitters must reject unrepresentable values; do not coerce or discard them.
- An extension must preserve the meaning of documents accepted by its base.
  Experimental profiles may intentionally change with their specs and tests;
  migration/version ceremony waits until the project is declared stable.
- Specify parameter relationships rather than assuming all profiles form a
  chain or that larger numeric values always broaden the language.
- Avoid quadratic work in validate, parse, and generate, including long keys
  and values. Explain costs and check adversarial scaling. Qualify claims about
  interpreter/runtime internals; timing alone is not a complexity proof.

## Tests as documentation

Use ShellSpec for the shared behavioral suite. Group examples by language rule
with Describe/Context/It and keep representative examples visible inline.
Parameterize repetitive boundary cases without hiding the rule being tested.

For each grammar change, cover acceptance, decoded meaning, nearby rejection
cases, generation where applicable, and interaction with existing features.
Assert independently expected results, not just agreement between parsers.
Keep diagnostics useful and test stable error codes and line numbers.

Before changing code or quality controls, read `docs/quality.md` for the
regression-first workflow, resource budgets, and definition of done.
Run `sh scripts/check.sh`; dash, Bash, and native zsh are required targets.
Node's built-in tests supplement ShellSpec for API and cross-language checks.
Document any checks that could not run. Change grammar, implementation, and
executable examples together. Keep the implementation understandable before
trying to optimize it.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. Before tracker operations, read
`docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels. Before triaging or changing triage
labels, read `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. Before exploring the codebase, read
`docs/agents/domain.md`.
