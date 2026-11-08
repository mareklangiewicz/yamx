#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
engine=${ENGINE:-podman}
mkdir -p .quality-out
"$engine" build -f test/portability/Containerfile -t yamx-quality-alpine .
exec "$engine" run --rm --memory=768m --pids-limit=256 --network=none \
  -v "$PWD:/src:ro" -v "$PWD/.quality-out:/out:rw" \
  yamx-quality-alpine sh /src/scripts/container-check.sh "$@"
