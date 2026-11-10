#!/bin/sh
set -eu
# Source is mounted read-only; all test scratch and copied code stay disposable.
cp -R /src/src /src/dist /src/examples /src/spec /src/scripts /src/hooks /src/test /src/.shellspec /work/
ln -s /opt/dependencies/node_modules /work/node_modules
cd /work
apk info -v
case "${1:-}" in
  --deep)
    for shell in dash bash zsh; do
      case "$shell" in
        dash) lua=lua5.1 ;;
        bash) lua=luajit ;;
        zsh) lua=lua5.4 ;;
      esac
      YAMX_SHELL=$shell YAMX_LUA=$lua node scripts/mutation.mjs
    done
    node scripts/benchmark.mjs --full > /out/benchmark.jsonl
    node scripts/benchmark.mjs --full --distribution >> /out/benchmark.jsonl
    node scripts/benchmark-balanced.mjs --full >> /out/benchmark.jsonl
    node scripts/benchmark-balanced.mjs --full --distribution >> /out/benchmark.jsonl
    exit 0
    ;;
  '') ;;
  *) printf 'usage: sh scripts/portability.sh [--deep]\n' >&2; exit 2 ;;
esac
YAMX_BUSYBOX=1 sh scripts/check.sh
# BusyBox ash + BusyBox od/awk/sort are an additional required environment.
YAMX_IMPL=shell YAMX_SHELL=/bin/ash "$SHELLSPEC" --format progress spec
YAMX_SHELL=/bin/ash node --test spec/*.test.mjs
