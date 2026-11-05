#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SHELLSPEC=${SHELLSPEC:-shellspec}
# YAMX_SHELL selects the parser interpreter independently of ShellSpec's shell.
for implementation in shell js; do
  printf '\nImplementation: %s (shell: %s)\n' "$implementation" "${YAMX_SHELL:-sh}"
  YAMX_IMPL=$implementation "$SHELLSPEC" --format documentation spec
done
node --test spec/*.test.mjs
