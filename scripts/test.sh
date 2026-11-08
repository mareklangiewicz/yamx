#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -z "${SHELLSPEC:-}" ] && [ -x .tools/shellspec/shellspec ]; then
  SHELLSPEC=$PWD/.tools/shellspec/shellspec
fi
SHELLSPEC=${SHELLSPEC:-shellspec}
temporary=$(mktemp -d "${TMPDIR:-/tmp}/yamx-focused.XXXXXXXX")
trap 'rm -rf "$temporary"' 0
trap 'exit 2' HUP INT TERM
TMPDIR=$temporary
export TMPDIR
# YAMX_SHELL selects the parser interpreter independently of ShellSpec's shell.
for implementation in shell js; do
  printf '\nImplementation: %s (shell: %s)\n' "$implementation" "${YAMX_SHELL:-sh}"
  YAMX_IMPL=$implementation "$SHELLSPEC" --format documentation spec
done
node --test spec/*.test.mjs
