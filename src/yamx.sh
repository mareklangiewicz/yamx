#!/bin/sh
# Experimental Core-0 CLI. Requires a stable regular input file and POSIX od.
LC_ALL=C
export LC_ALL
set -f

fail() {
  printf '%s line %s: %s\n' "$1" "$number" "$2" >&2
  exit 1
}

number=1
if [ "$#" -ne 2 ]; then
  printf 'usage: sh src/yamx.sh validate|parse|generate FILE\n' >&2
  exit 2
fi
operation=$1
file=$2
case "$operation" in
  validate|parse|generate) ;;
  *) printf 'unknown operation: %s\n' "$operation" >&2; exit 2 ;;
esac
if [ ! -f "$file" ] || [ ! -r "$file" ]; then
  printf 'E_IO: expected a readable regular file\n' >&2
  exit 2
fi

# Inspect bytes before shell read: some shells silently discard NUL bytes.
# Keep this separate from the small line grammar below.
bytes=$(od -A n -t u1 -v < "$file") || exit 2
last=
for byte in $bytes; do
  last=$byte
  case "$byte" in
    10) number=$((number + 1)) ;;
    9) [ "$operation" = generate ] || fail E_CHARACTER 'unsupported byte' ;;
    *) [ "$byte" -ge 32 ] && [ "$byte" -le 126 ] || fail E_CHARACTER 'unsupported byte' ;;
  esac
done
[ -n "$last" ] || fail E_EMPTY 'expected at least one entry'
[ "$last" = 10 ] || fail E_NEWLINE 'expected a final LF'
unset bytes

number=0
seen='|'
output=
lf='
'
tab=$(printf '\t')
while IFS= read -r line; do
  number=$((number + 1))
  if [ "$operation" = generate ]; then
    case "$line" in
      *"$tab"*) key=${line%%"$tab"*}; value=${line#*"$tab"} ;;
      *) fail E_SYNTAX 'expected key TAB value' ;;
    esac
    case "$value" in *"$tab"*) fail E_SYNTAX 'expected exactly one TAB' ;; esac
  else
    case "$line" in
      *': '*) key=${line%%: *}; value=${line#*: } ;;
      *) fail E_SYNTAX 'expected key: quoted-value' ;;
    esac
    case "$value" in
      "'"*"'") value=${value#\'}; value=${value%\'} ;;
      *) fail E_SYNTAX 'expected a single-quoted string' ;;
    esac
  fi
  case "$key" in
    ''|[!a-z_]*|*[!a-z0-9_-]*|true|false|null)
      fail E_KEY 'expected a non-reserved lowercase identifier' ;;
  esac
  case "$seen" in *"|$key|"*) fail E_DUPLICATE 'duplicate mapping key' ;; esac
  seen=$seen$key'|'
  case "$value" in *"'"*) fail E_STRING 'apostrophes are not supported in Core-0 strings' ;; esac
  if [ "$operation" = generate ]; then
    output=$output$key": '"$value"'"$lf
  else
    output=$output$key$tab$value$lf
  fi
done < "$file"

# No partial stdout on invalid input, even when a later entry fails.
[ "$operation" = validate ] || printf '%s' "$output"
exit 0
