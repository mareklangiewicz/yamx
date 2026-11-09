#!/bin/sh
set -eu
# Source is mounted read-only; all test scratch and copied code stay disposable.
cp -R /src/src /src/examples /src/spec /src/scripts /src/hooks /src/test /src/.shellspec /work/
ln -s /opt/dependencies/node_modules /work/node_modules
cd /work
apk info -v
case "${1:-}" in
  --deep)
    for shell in dash bash zsh; do
      YAMX_SHELL=$shell node scripts/mutation.mjs
    done
    node scripts/benchmark.mjs --full > /out/benchmark.jsonl
    node scripts/benchmark-balanced.mjs --full >> /out/benchmark.jsonl
    exit 0
    ;;
  '') ;;
  *) printf 'usage: sh scripts/portability.sh [--deep]\n' >&2; exit 2 ;;
esac
sh scripts/check.sh
# BusyBox ash + BusyBox od/awk/sort are an additional required environment.
YAMX_IMPL=shell YAMX_SHELL=/bin/ash "$SHELLSPEC" --format progress spec
YAMX_SHELL=/bin/ash node --test spec/*.test.mjs
