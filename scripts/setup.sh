#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -z "${SHELLSPEC:-}" ] && [ -x .tools/shellspec/shellspec ]; then
  SHELLSPEC=$PWD/.tools/shellspec/shellspec
  export SHELLSPEC
fi
case "${1:-}" in
  --verify)
    for utility in node dash bash zsh lua5.1 luajit lua5.4 od awk sort cat mkdir rm timeout; do
      command -v "$utility" >/dev/null 2>&1 || {
        printf 'Missing required tool: %s\n' "$utility" >&2
        exit 1
      }
    done
    command -v "${SHELLSPEC:-shellspec}" >/dev/null 2>&1 || {
      printf 'Install ShellSpec 0.28.1 or set SHELLSPEC to its path.\n' >&2
      exit 1
    }
    if ! command -v shellcheck-capped >/dev/null 2>&1; then
      if [ "${CI:-}" != true ] || ! command -v shellcheck >/dev/null 2>&1; then
        printf 'Install shellcheck-capped; see docs/quality.md.\n' >&2
        exit 1
      fi
    fi
    [ "$(git config --local --get core.hooksPath)" = hooks ] || {
      printf 'Hook not installed: run sh scripts/setup.sh\n' >&2
      exit 1
    }
    [ -x hooks/pre-push ] || exit 1
    node -e 'import("yaml").catch(() => process.exit(1))'
    printf 'Setup verified: required tools, local hook, and YAML oracle available.\n'
    ;;
  '')
    existing=$(git config --get core.hooksPath || :)
    case "$existing" in
      ''|hooks) ;;
      *) printf 'Existing hooksPath=%s; integrate hooks/pre-push before changing it.\n' "$existing" >&2; exit 2 ;;
    esac
    npm ci --ignore-scripts --no-audit --no-fund
    git config --local core.hooksPath hooks
    sh scripts/setup.sh --verify
    ;;
  *) printf 'usage: sh scripts/setup.sh [--verify]\n' >&2; exit 2 ;;
esac
