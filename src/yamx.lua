-- Independent Lua 5.1+ implementation of YAM(M) and YAM(B).
local M = {}
local map_mt, seq_mt = {}, {}
local error_mt = { __tostring = function(e)
  return e.code .. ' line ' .. e.line .. ': ' .. e.message
end }
M.null = setmetatable({}, { __tostring = function() return 'yamx.null' end })
local function fail(code, line, message)
  error(setmetatable({ code = code, line = line, message = message }, error_mt), 0)
end
function M.is_error(value) return getmetatable(value) == error_mt end
local function tagged(value, mt)
  if value == nil then value = {} end
  if type(value) ~= 'table' or getmetatable(value) ~= nil then
    error('expected an untagged table', 2)
  end
  return setmetatable(value, mt)
end
-- Maps are ordered lists of {key, value} pairs; sequences are dense lists.
function M.map(entries) return tagged(entries, map_mt) end
function M.seq(items) return tagged(items, seq_mt) end
function M.kind(value)
  if value == M.null then return 'null' end
  local mt = getmetatable(value)
  if mt == map_mt then return 'map' end
  if mt == seq_mt then return 'seq' end
end
local function profile(value)
  if value == nil then return 'M' end
  if value ~= 'M' and value ~= 'B' then error('unknown profile', 3) end
  return value
end
local function check_text(text, tabs)
  if type(text) ~= 'string' then error('expected a string', 3) end
  if #text == 0 then fail('E_EMPTY', 1, 'expected a collection') end
  local bad = text:find(tabs and '[^\32-\126\n\t]' or '[^\32-\126\n]')
  if bad then
    local _, count = text:sub(1, bad - 1):gsub('\n', '')
    fail('E_CHARACTER', count + 1, 'unsupported byte')
  end
  if text:sub(-1) ~= '\n' then
    local _, count = text:gsub('\n', '')
    fail('E_NEWLINE', count + 1, 'expected a final LF')
  end
end
local function check_key(key, line)
  if type(key) ~= 'string' or not key:match('^[a-z_][a-z0-9_-]*$')
      or key == 'true' or key == 'false' or key == 'null' then
    fail('E_KEY', line, 'expected a non-reserved lowercase identifier')
  end
end
local function integer(text, line)
  local digits = text:sub(1, 1) == '-' and text:sub(2) or text
  if not digits:match('^%d+$') or (#digits > 1 and digits:sub(1, 1) == '0')
      or #digits > 16 or (#digits == 16 and digits > '9007199254740991') then
    fail('E_STRING', line, 'expected a safe decimal integer')
  end
  return text == '-0' and '0' or text
end
-- Reject holes and extra properties without relying on Lua's undefined # result
-- for sparse tables, or invoking caller metamethods. Work is proportional to size.
local function dense(value, line)
  if type(value) ~= 'table' then fail('E_SYNTAX', line, 'expected a list') end
  local count, largest = 0, 0
  for key in next, value do
    if type(key) ~= 'number' or key < 1 or key % 1 ~= 0 then
      fail('E_SYNTAX', line, 'expected a dense list without extra fields')
    end
    count = count + 1
    if key > largest then largest = key end
  end
  if largest ~= count then fail('E_SYNTAX', line, 'sparse list') end
  return count
end
local function minimal(entries)
  if getmetatable(entries) ~= nil then fail('E_SYNTAX', 1, 'expected an untagged pair list') end
  local count = dense(entries, 1)
  if count == 0 then fail('E_EMPTY', 1, 'expected at least one entry') end
  local seen = {}
  for i = 1, count do
    local pair = rawget(entries, i)
    if dense(pair, i) ~= 2 then fail('E_SYNTAX', i, 'expected a key/value pair') end
    local key, value = rawget(pair, 1), rawget(pair, 2)
    check_key(key, i)
    if seen[key] then fail('E_DUPLICATE', i, 'duplicate mapping key') end
    seen[key] = true
    if type(value) ~= 'string' or value:find('[^\32-\38\40-\126]') then
      fail('E_STRING', i, 'expected printable ASCII without apostrophes')
    end
  end
end
local function parse_minimal(text, transport)
  check_text(text, transport)
  local entries = {}
  for record in text:gmatch('(.-)\n') do
    local key, value
    if transport then key, value = record:match('^([^\t]*)\t([^\t]*)$')
    else key, value = record:match("^([^:]*): '(.*)'$") end
    if not key then fail('E_SYNTAX', #entries + 1, 'expected a key/value record') end
    entries[#entries + 1] = { key, value }
  end
  minimal(entries)
  return entries
end
local function trim_right(text)
  local last = #text
  while last > 0 and text:byte(last) == 32 do last = last - 1 end
  return text:sub(1, last)
end
local function scalar(text, line)
  if text:sub(1, 1) == "'" then
    -- Scan once, copying whole spans between quotes. Avoid suffix rescans and
    -- repeatedly appending to a growing string when decoding doubled quotes.
    local chunks, start, i = {}, 2, 2
    while i <= #text do
      if text:byte(i) == 39 then
        chunks[#chunks + 1] = text:sub(start, i - 1)
        if text:byte(i + 1) == 39 then
          chunks[#chunks + 1] = "'"
          i = i + 2
          start = i
        else
          local rest = text:sub(i + 1)
          if rest ~= '' and not rest:match('^ +#') then
            fail('E_SYNTAX', line, 'unexpected text after quoted string')
          end
          return 'str', table.concat(chunks)
        end
      else i = i + 1 end
    end
    fail('E_SYNTAX', line, 'expected a closed single-quoted string')
  end
  local comment = text:find(' #', 1, true)
  local value = trim_right(comment and text:sub(1, comment - 1) or text)
  if value == '{}' then return 'map', '' end
  if value == '[]' then return 'seq', '' end
  if value == 'true' or value == 'false' then return 'bool', value end
  if value == 'null' then return 'null', '' end
  if value:match('^%-?%d') then return 'int', integer(value, line) end
  if not value:match('^[A-Za-z_/]') or value:find(': ', 1, true) or value:sub(-1) == ':'
      or value == 'True' or value == 'TRUE' or value == 'False' or value == 'FALSE'
      or value == 'Null' or value == 'NULL' then
    fail('E_STRING', line, 'unsupported plain scalar; quote string data')
  end
  return 'str', value
end
local function node(depth, kind, key, value, line)
  return { depth = depth, kind = kind, key = key, value = value, line = line }
end
local function yaml_nodes(text)
  check_text(text)
  local nodes, stack, pending, root_empty = {}, {}, nil, false
  local line = 0
  for record in text:gmatch('(.-)\n') do
    line = line + 1
    local raw = trim_right(record)
    local spaces = raw:match('^ *')
    local body = raw:sub(#spaces + 1)
    if body ~= '' and body:sub(1, 1) ~= '#' then
      local indent = #spaces
      if indent % 2 ~= 0 then fail('E_SYNTAX', line, 'expected two-space indentation') end
      local depth = math.floor(indent / 2) + 1
      if depth > 32 then fail('E_DEPTH', line, 'maximum depth is 32') end
      local sequence = body == '-' or body:sub(1, 2) == '- '
      local kind = sequence and 'seq' or 'map'
      local empty_root = false
      if #nodes == 0 then
        if indent ~= 0 then fail('E_SYNTAX', line, 'root must start at column 1') end
        local first, rest = body:sub(1, 2), body:sub(3)
        if (first == '{}' or first == '[]') and (rest == '' or rest:match('^ +#')) then
          nodes[1] = node(0, first == '{}' and 'map' or 'seq', '', '', line)
          root_empty, empty_root = true, true
        else
          nodes[1] = node(0, kind, '', '', line)
          stack[1] = kind
        end
      elseif root_empty then fail('E_SYNTAX', line, 'content after an empty root') end
      if not empty_root then
        if pending then
          if depth ~= pending.depth + 1 then fail('E_SYNTAX', line, 'expected an indented child collection') end
          pending.kind = kind
          stack[pending.depth + 1] = kind
          pending = nil
        elseif depth > #stack then fail('E_SYNTAX', line, 'unexpected indentation') end
        for i = #stack, depth + 1, -1 do stack[i] = nil end
        if stack[depth] ~= kind then fail('E_SYNTAX', line, 'mixed collection kinds') end
        local key, value = '', nil
        if sequence then value = body:sub(2):gsub('^ +', '')
        else
          local colon = body:find(':', 1, true)
          if not colon then fail('E_SYNTAX', line, 'expected key: value') end
          key, value = body:sub(1, colon - 1), body:sub(colon + 1)
          if value ~= '' and value:sub(1, 1) ~= ' ' then fail('E_SYNTAX', line, 'expected key: value') end
          value = value:gsub('^ +', '')
          check_key(key, line)
        end
        if value == '' or value:sub(1, 1) == '#' then
          pending = node(depth, '', key, '', line)
          nodes[#nodes + 1] = pending
        else
          local child_kind, decoded = scalar(value, line)
          nodes[#nodes + 1] = node(depth, child_kind, key, decoded, line)
        end
      end
    end
  end
  if pending then fail('E_SYNTAX', pending.line, 'missing child collection') end
  if #nodes == 0 then fail('E_EMPTY', 1, 'expected a collection') end
  return nodes
end
local kinds = { map = true, seq = true, str = true, int = true, bool = true, null = true }
local function check_nodes(nodes)
  local stack = {}
  for i, n in ipairs(nodes) do
    local depth, kind, key, value, line = n.depth, n.kind, n.key, n.value, n.line
    if depth < 0 or depth > 32 or depth % 1 ~= 0 then fail('E_DEPTH', line, 'depth must be between 0 and 32') end
    if not kinds[kind] then fail('E_SYNTAX', line, 'unknown node kind') end
    if i == 1 then
      if depth ~= 0 or (kind ~= 'map' and kind ~= 'seq') or key ~= '' then
        fail('E_SYNTAX', line, 'expected one root collection')
      end
    else
      local parent = stack[depth]
      if depth == 0 or not parent then fail('E_SYNTAX', line, 'missing parent collection') end
      if parent.kind == 'map' then
        check_key(key, line)
        if parent.keys[key] then fail('E_DUPLICATE', line, 'duplicate mapping key') end
        parent.keys[key] = true
      elseif key ~= '' then fail('E_KEY', line, 'sequence items have no key') end
    end
    if kind == 'str' then
      if type(value) ~= 'string' or value:find('[^\32-\126]') then fail('E_STRING', line, 'expected printable ASCII') end
    elseif kind == 'int' then n.value = integer(value, line)
    elseif kind == 'bool' then
      if value ~= 'true' and value ~= 'false' then fail('E_STRING', line, 'expected true or false') end
    elseif value ~= '' then fail('E_SYNTAX', line, 'expected an empty value field') end
    -- Ancestors above depth remain live; descendants must not survive a sibling.
    for d = depth + 1, 33 do stack[d] = nil end
    if kind == 'map' or kind == 'seq' then stack[depth + 1] = { kind = kind, keys = {} } end
  end
end
local function transport_nodes(text)
  check_text(text, true)
  local nodes = {}
  for record in text:gmatch('(.-)\n') do
    local depth, kind, key, value = record:match('^([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)$')
    if not depth or not (depth == '0' or depth:match('^[1-9]%d*$')) then
      fail('E_SYNTAX', #nodes + 1, 'expected depth TAB kind TAB key TAB value')
    end
    nodes[#nodes + 1] = node(tonumber(depth), kind, key, value, #nodes + 1)
  end
  check_nodes(nodes)
  return nodes
end
local function tree(nodes)
  check_nodes(nodes)
  local stack, root = {}, nil
  for _, n in ipairs(nodes) do
    local value
    if n.kind == 'map' then value = M.map()
    elseif n.kind == 'seq' then value = M.seq()
    elseif n.kind == 'null' then value = M.null
    elseif n.kind == 'bool' then value = n.value == 'true'
    elseif n.kind == 'int' then value = tonumber(n.value)
    else value = n.value end
    if n.depth == 0 then root = value
    else
      local parent = stack[n.depth]
      parent[#parent + 1] = M.kind(parent) == 'map' and { n.key, value } or value
    end
    stack[n.depth + 1] = value
  end
  return root
end
local function tree_nodes(root)
  local nodes, ancestors = {}, {}
  local function visit(value, depth, key)
    local line = #nodes + 1
    if depth > 32 then fail('E_DEPTH', line, 'maximum depth is 32') end
    local kind, encoded = M.kind(value), ''
    if not kind then
      if type(value) == 'string' then kind, encoded = 'str', value
      elseif type(value) == 'boolean' then kind, encoded = 'bool', tostring(value)
      elseif type(value) == 'number' and value == value and math.abs(value) <= 9007199254740991 and value % 1 == 0 then
        kind, encoded = 'int', value == 0 and '0' or string.format('%.0f', value)
      else fail('E_STRING', line, 'unsupported value') end
    end
    nodes[#nodes + 1] = node(depth, kind, key, encoded, line)
    if kind == 'map' or kind == 'seq' then
      if ancestors[value] then fail('E_SYNTAX', line, 'cyclic collection') end
      ancestors[value] = true
      local count = dense(value, line)
      for i = 1, count do
        local child = rawget(value, i)
        if kind == 'map' then
          if dense(child, #nodes + 1) ~= 2 then fail('E_SYNTAX', #nodes + 1, 'expected a key/value pair') end
          visit(rawget(child, 2), depth + 1, rawget(child, 1))
        else visit(child, depth + 1, '') end
      end
      ancestors[value] = nil
    end
  end
  visit(root, 0, '')
  check_nodes(nodes)
  return nodes
end
local function nodes_yaml(nodes)
  check_nodes(nodes)
  local out = {}
  for i, n in ipairs(nodes) do
    local container = n.kind == 'map' or n.kind == 'seq'
    local empty = container and not (nodes[i + 1] and nodes[i + 1].depth > n.depth)
    local value = n.value
    if n.kind == 'str' then value = "'" .. value:gsub("'", "''") .. "'"
    elseif n.kind == 'null' then value = 'null'
    elseif container then value = n.kind == 'map' and '{}' or '[]' end
    if n.depth == 0 then
      if empty then out[#out + 1] = value .. '\n' end
    else
      local prefix = string.rep('  ', n.depth - 1) .. (n.key ~= '' and n.key .. ':' or '-')
      out[#out + 1] = prefix .. (container and not empty and '' or ' ' .. value) .. '\n'
    end
  end
  return table.concat(out)
end
function M.parse(text, selected)
  if profile(selected) == 'B' then return tree(yaml_nodes(text)) end
  return parse_minimal(text)
end
function M.validate(text, selected)
  if profile(selected) == 'B' then check_nodes(yaml_nodes(text)) else parse_minimal(text) end
end
function M.generate(value, selected)
  if profile(selected) == 'B' then return nodes_yaml(tree_nodes(value)) end
  minimal(value)
  local out = {}
  for i, entry in ipairs(value) do out[i] = entry[1] .. ": '" .. entry[2] .. "'\n" end
  return table.concat(out)
end
-- Development transports shared by all three CLIs, not general-purpose TSV.
function M.parse_transport(text, selected)
  if profile(selected) == 'B' then return tree(transport_nodes(text)) end
  return parse_minimal(text, true)
end
function M.generate_transport(value, selected)
  local out = {}
  if profile(selected) == 'B' then
    for i, n in ipairs(tree_nodes(value)) do
      out[i] = string.format('%d', n.depth) .. '\t' .. n.kind .. '\t' .. n.key .. '\t' .. n.value .. '\n'
    end
  else
    minimal(value)
    for i, entry in ipairs(value) do out[i] = entry[1] .. '\t' .. entry[2] .. '\n' end
  end
  return table.concat(out)
end
return M
