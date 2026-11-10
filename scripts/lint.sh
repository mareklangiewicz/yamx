#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# The local wrapper uses a memory-capped cgroup. CI runs in disposable runners.
if command -v shellcheck-capped >/dev/null 2>&1; then
  lint=shellcheck-capped
elif [ "${CI:-}" = true ]; then
  lint=shellcheck
else
  printf 'Install shellcheck-capped (see docs/quality.md); refusing unbounded local lint.\n' >&2
  exit 2
fi
# ShellSpec is a DSL, not shell syntax; lint runnable scripts and hooks only.
# GHC's virtual-address reservation makes ulimit -v unsuitable. Bound the data
# segment instead, in addition to the local cgroup or container memory ceiling.
# These development limits are supported by our Linux dash/bash/zsh/ash runners.
# shellcheck disable=SC3045
(
  ulimit -d 524288
  ulimit -t 30
  timeout 30 "$lint" -s sh src/yamx.sh dist/minimal/yamx.sh dist/balanced/yamx.sh scripts/*.sh hooks/*
)
for file in dist/minimal/*.mjs dist/balanced/*.mjs src/*.mjs scripts/*.mjs spec/*.mjs test/*.mjs; do
  node --check "$file"
done
