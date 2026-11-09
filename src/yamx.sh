#!/bin/sh
# YAM(M) / YAM(B) CLI: native dash, bash, and zsh; standard POSIX utilities only.
LC_ALL=C
export LC_ALL
set -f

fail() {
  printf '%s line %s: %s\n' "$1" "$number" "$2" >&2
  exit 1
}
io_error() {
  printf 'E_IO: %s\n' "$1" >&2
  exit 2
}

number=1
profile=M
if [ "${1:-}" = --profile ]; then
  [ "$#" -ge 2 ] || { printf 'missing profile\n' >&2; exit 2; }
  profile=$2
  shift 2
fi
case "$profile" in M|B) ;; *) printf 'unknown profile: %s\n' "$profile" >&2; exit 2 ;; esac
if [ "$#" -ne 2 ]; then
  printf 'usage: sh src/yamx.sh [--profile M|B] validate|parse|generate FILE\n' >&2
  exit 2
fi
operation=$1
file=$2
case "$operation" in
  validate|parse|generate) ;;
  *) printf 'unknown operation: %s\n' "$operation" >&2; exit 2 ;;
esac
if [ ! -f "$file" ] || [ ! -r "$file" ]; then
  io_error 'expected a readable regular file'
fi
for utility in od awk sort cat mkdir rm; do
  command -v "$utility" >/dev/null 2>&1 || io_error "missing utility: $utility"
done

# mkdir is the atomic ownership check; umask protects every intermediate file.
umask 077
attempt=0
while :; do
  workspace=${TMPDIR:-/tmp}/yamx.$$.${attempt}
  if mkdir "$workspace" 2>/dev/null; then break; fi
  attempt=$((attempt + 1))
  [ "$attempt" -lt 10 ] || io_error 'cannot create temporary directory'
done
trap 'rm -rf "$workspace"' 0
trap 'exit 2' HUP INT TERM PIPE

# Inspect numeric bytes before shell read: shells may silently discard NUL.
# Separate commands preserve od failure status without non-POSIX pipefail.
od -A n -t u1 -v < "$file" > "$workspace/bytes" || io_error 'cannot inspect input'
if awk -v operation="$operation" '
  function reject(code, message) {
    print code " line " line ": " message
    failed = 1
    exit 1
  }
  BEGIN { line = 1 }
  {
    for (i = 1; i <= NF; i++) {
      last = $i + 0
      count++
      if (last == 10) line++
      else if (!(last >= 32 && last <= 126) && !(last == 9 && operation == "generate"))
        reject("E_CHARACTER", "unsupported byte")
    }
  }
  END {
    if (!failed) {
      if (!count) reject("E_EMPTY", "expected at least one entry")
      if (last != 10) reject("E_NEWLINE", "expected a final LF")
    }
  }
' "$workspace/bytes" > "$workspace/error"; then
  :
else
  result=$?
  if [ -s "$workspace/error" ]; then
    cat "$workspace/error" >&2
    exit 1
  fi
  io_error "cannot validate bytes (awk exit $result)"
fi

# Decode each line with bounded passes. Native shell suffix-pattern scans can
# become quadratic on long keys (especially zsh), even without growing buffers.
: > "$workspace/keys" || io_error 'cannot stage keys'
: > "$workspace/error" || io_error 'cannot stage diagnostics'
if [ "$profile" = B ]; then
  # Use the bundled awk source beside this entry point, independent of caller cwd.
  case $0 in */*) source_dir=${0%/*} ;; *) source_dir=. ;; esac
  if YAMX_KEYS="$workspace/keys" YAMX_ERROR="$workspace/error" awk -v operation="$operation" \
    -f "$source_dir/balanced.awk" < "$file" > "$workspace/output"; then
    :
  else
    result=$?
    if [ -s "$workspace/error" ]; then
      cat "$workspace/error" >&2
      exit 1
    fi
    io_error "cannot decode or stage input (awk exit $result)"
  fi
else
if YAMX_KEYS="$workspace/keys" YAMX_ERROR="$workspace/error" awk -v operation="$operation" '
  function reject(code, message) {
    print code " line " NR ": " message > ENVIRON["YAMX_ERROR"]
    exit 1
  }
  {
    if (operation == "generate") {
      separator = index($0, "\t")
      if (!separator) reject("E_SYNTAX", "expected key TAB value")
      key = substr($0, 1, separator - 1)
      value = substr($0, separator + 1)
      if (index(value, "\t")) reject("E_SYNTAX", "expected exactly one TAB")
    } else {
      separator = index($0, ": ")
      if (!separator) reject("E_SYNTAX", "expected key: quoted-value")
      key = substr($0, 1, separator - 1)
      quoted = substr($0, separator + 2)
      if (length(quoted) < 2 || substr(quoted, 1, 1) != "\047" || substr(quoted, length(quoted), 1) != "\047")
        reject("E_SYNTAX", "expected a single-quoted string")
      value = substr(quoted, 2, length(quoted) - 2)
    }
    if (key !~ /^[a-z_][a-z0-9_-]*$/ || key == "true" || key == "false" || key == "null")
      reject("E_KEY", "expected a non-reserved lowercase identifier")
    if (index(value, "\047")) reject("E_STRING", "apostrophes are not supported in YAM(M) strings")
    print key "\t" NR > ENVIRON["YAMX_KEYS"]
    if (operation == "generate") printf "%s: \047%s\047\n", key, value
    else if (operation == "parse") printf "%s\t%s\n", key, value
  }
' < "$file" > "$workspace/output"; then
  :
else
  result=$?
  if [ -s "$workspace/error" ]; then
    cat "$workspace/error" >&2
    exit 1
  fi
  io_error "cannot decode or stage input (awk exit $result)"
fi

fi

tab=$(printf '\t')
# Group equal keys and order their occurrences. Choose the earliest repeated
# input line across all groups so duplicate diagnostics retain input order.
if [ "$profile" = B ]; then
  sort -t "$tab" -k1,1n -k2,2 -k3,3n "$workspace/keys" > "$workspace/sorted" || io_error 'cannot sort keys'
  number=$(awk -F "$tab" '
    NR > 1 && $1 == parent && $2 == previous { if (!duplicate || $3 < duplicate) duplicate = $3 }
    { parent = $1; previous = $2 }
    END { if (duplicate) print duplicate }
  ' "$workspace/sorted") || io_error 'cannot check duplicate keys'
else
sort -t "$tab" -k1,1 -k2,2n "$workspace/keys" > "$workspace/sorted" || io_error 'cannot sort keys'
number=$(awk -F "$tab" '
  NR > 1 && $1 == previous { if (!duplicate || $2 < duplicate) duplicate = $2 }
  { previous = $1 }
  END { if (duplicate) print duplicate }
' "$workspace/sorted") || io_error 'cannot check duplicate keys'
fi
[ -z "$number" ] || fail E_DUPLICATE 'duplicate mapping key'

# Invalid input never publishes partial stdout. Output-device failures may.
if [ "$operation" != validate ]; then
  cat "$workspace/output" || io_error 'cannot write output'
fi
exit 0
