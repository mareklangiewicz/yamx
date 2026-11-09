# Independent POSIX awk implementation of docs/balanced.md.
function reject(code, message, at) {
  print code " line " (at ? at : NR) ": " message > ENVIRON["YAMX_ERROR"]
  failed = 1
  exit 1
}
function rtrim(text,    end) {
  end = length(text)
  while (end > 0 && substr(text, end, 1) == " ") end--
  return substr(text, 1, end)
}
function validkey(key) {
  return key ~ /^[a-z_][a-z0-9_-]*$/ && key != "true" && key != "false" && key != "null"
}
function integer(value,    digits) {
  if (value !~ /^-?(0|[1-9][0-9]*)$/) reject("E_STRING", "expected a safe decimal integer")
  digits = value
  sub(/^-/, "", digits)
  # Equal-length decimal comparison uses a nonnumeric prefix to force lexical order.
  if (length(digits) > 16 || (length(digits) == 16 && "x" digits > "x9007199254740991"))
    reject("E_STRING", "integer outside the safe range")
  return value == "-0" ? "0" : value
}
function writeyaml(nextdepth,    prefix, i, scalar, empty, quoted) {
  if (!saved) return
  empty = (savedkind == "map" || savedkind == "seq") && nextdepth <= saveddepth
  if (saveddepth == 0 && !empty) return
  prefix = ""
  for (i = 1; i < saveddepth; i++) prefix = prefix "  "
  if (saveddepth) prefix = prefix (savedkey != "" ? savedkey ":" : "-")
  if (savedkind == "map" || savedkind == "seq") {
    if (empty) scalar = savedkind == "map" ? "{}" : "[]"
    else { print prefix; return }
  } else if (savedkind == "str") {
    quoted = savedvalue
    gsub(/\047/, "\047\047", quoted)
    scalar = "\047" quoted "\047"
  } else if (savedkind == "null") scalar = "null"
  else scalar = savedvalue
  print prefix (saveddepth ? " " : "") scalar
}
function node(depth, kind, key, value, source,    parent) {
  if (depth > 32) reject("E_DEPTH", "maximum depth is 32", source)
  if (kind != "map" && kind != "seq" && kind != "str" && kind != "int" && kind != "bool" && kind != "null")
    reject("E_SYNTAX", "unknown node kind", source)
  if (!count) {
    if (depth != 0 || (kind != "map" && kind != "seq") || key != "")
      reject("E_SYNTAX", "expected a root collection", source)
  } else {
    if (depth == 0 || depth > lastdepth + 1 || (types[depth - 1] != "map" && types[depth - 1] != "seq"))
      reject("E_SYNTAX", "missing parent collection", source)
    parent = ids[depth - 1]
    if (types[depth - 1] == "map") {
      if (!validkey(key)) reject("E_KEY", "expected a non-reserved lowercase identifier", source)
      print parent "\t" key "\t" source > ENVIRON["YAMX_KEYS"]
    } else if (key != "") reject("E_KEY", "sequence items have no key", source)
  }
  if (kind == "int") value = integer(value)
  else if (kind == "bool") {
    if (value != "true" && value != "false") reject("E_STRING", "expected true or false", source)
  } else if (kind != "str" && value != "") reject("E_SYNTAX", "expected an empty value", source)
  count++
  types[depth] = kind
  ids[depth] = count
  lastdepth = depth
  if (operation == "parse") printf "%d\t%s\t%s\t%s\n", depth, kind, key, value
  if (operation == "generate") {
    writeyaml(depth)
    saved = 1
    saveddepth = depth
    savedkind = kind
    savedkey = key
    savedvalue = value
  }
}
function scalar(text,    value, quoted, comment) {
  if (substr(text, 1, 1) == "\047") {
    # A bounded whole-record match; paired apostrophes have a unique decoding.
    if (!match(text, /^\047([^\047]|\047\047)*\047( +#.*)?$/))
      reject("E_SYNTAX", "expected a closed single-quoted string")
    # Locate the closing quote without repeatedly slicing/growing a prefix.
    match(text, /^\047([^\047]|\047\047)*\047/)
    quoted = substr(text, 2, RLENGTH - 2)
    gsub(/\047\047/, "\047", quoted)
    scalarkind = "str"
    scalarvalue = quoted
    return
  }
  value = text
  comment = index(value, " #")
  if (comment) value = substr(value, 1, comment - 1)
  value = rtrim(value)
  scalarvalue = value
  if (value == "{}" || value == "[]") {
    scalarkind = value == "{}" ? "map" : "seq"
    scalarvalue = ""
  } else if (value == "true" || value == "false") scalarkind = "bool"
  else if (value == "null") { scalarkind = "null"; scalarvalue = "" }
  else if (value ~ /^-?[0-9]/) { scalarkind = "int"; scalarvalue = integer(value) }
  else {
    if (value !~ /^[A-Za-z_\/]/ || value ~ /: |:$/ || value ~ /^(True|TRUE|False|FALSE|Null|NULL)$/)
      reject("E_STRING", "unsupported plain scalar; quote string data")
    scalarkind = "str"
  }
}
operation == "generate" {
  fields = split($0, record, "\t")
  if (fields != 4 || record[1] !~ /^(0|[1-9][0-9]*)$/)
    reject("E_SYNTAX", "expected depth TAB kind TAB key TAB value")
  node(record[1] + 0, record[2], record[3], record[4], NR)
  next
}
{
  text = rtrim($0)
  body = text
  sub(/^ +/, "", body)
  if (body == "" || substr(body, 1, 1) == "#") next
  indent = length(text) - length(body)
  if (indent % 2) reject("E_SYNTAX", "expected two-space indentation")
  depth = indent / 2 + 1
  if (depth > 32) reject("E_DEPTH", "maximum depth is 32")
  kind = (body == "-" || substr(body, 1, 2) == "- ") ? "seq" : "map"
  if (!count) {
    if (indent) reject("E_SYNTAX", "root must start at column 1")
    if (body ~ /^(\{\}|\[\])( +#.*)?$/) {
      node(0, substr(body, 1, 1) == "{" ? "map" : "seq", "", "", NR)
      rootempty = 1
      next
    }
    node(0, kind, "", "", NR)
    layout[0] = kind
    layoutdepth = 0
  } else if (rootempty) reject("E_SYNTAX", "content after an empty root")
  if (pending) {
    if (depth != pendingdepth + 1) reject("E_SYNTAX", "expected an indented child collection")
    node(pendingdepth, kind, pendingkey, "", pendingline)
    layout[pendingdepth] = kind
    layoutdepth = pendingdepth
    pending = 0
  } else if (depth > layoutdepth + 1) reject("E_SYNTAX", "unexpected indentation")
  layoutdepth = depth - 1
  if (layout[depth - 1] != kind) reject("E_SYNTAX", "mixed collection kinds")
  key = ""
  if (kind == "seq") {
    value = substr(body, 2)
    sub(/^ +/, "", value)
  } else {
    separator = index(body, ":")
    if (!separator) reject("E_SYNTAX", "expected key: value")
    key = substr(body, 1, separator - 1)
    value = substr(body, separator + 1)
    if (value != "" && substr(value, 1, 1) != " ") reject("E_SYNTAX", "expected space after colon")
    if (!validkey(key)) reject("E_KEY", "expected a non-reserved lowercase identifier")
    sub(/^ +/, "", value)
  }
  if (value == "" || substr(value, 1, 1) == "#") {
    pending = 1
    pendingdepth = depth
    pendingkey = key
    pendingline = NR
  } else {
    scalar(value)
    node(depth, scalarkind, key, scalarvalue, NR)
  }
}
END {
  if (!failed) {
    if (pending) reject("E_SYNTAX", "missing child collection", pendingline)
    if (!count) reject("E_EMPTY", "expected a collection", 1)
    if (operation == "generate") writeyaml(-1)
  }
}
