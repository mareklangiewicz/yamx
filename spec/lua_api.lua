-- Public API contracts, executed unchanged on Lua 5.1, LuaJIT and Lua 5.4.
local standalone = arg[1] ~= nil
local y = dofile(arg[1] or 'src/yamx.lua')
local function rejects(code, line, fn)
  local ok, e = pcall(fn)
  assert(not ok, 'expected rejection')
  assert(y.is_error(e), tostring(e))
  assert(e.code == code, tostring(e))
  if line then assert(e.line == line, tostring(e)) end
  assert(tostring(e):match('^' .. code .. ' line %d+:'))
end
local function badvalue(value, code)
  rejects(code or 'E_STRING', nil, function() y.generate(value, 'B') end)
end
if not standalone then
  local parsed = y.parse("z: ''\na: '  x  '\n")
  assert(parsed[1][1] == 'z' and parsed[1][2] == '')
  assert(parsed[2][1] == 'a' and parsed[2][2] == '  x  ')
  assert(y.generate(parsed) == "z: ''\na: '  x  '\n")
  assert(y.validate("a: 'x'\n") == nil)
  assert(y.generate_transport(parsed) == 'z\t\na\t  x  \n')
  assert(y.generate(y.parse_transport('a\tx\n')) == "a: 'x'\n")
end
local doc = "z: null\na:\n  - false\n  - []\n  - {}\n  - 'can''t'\nnumber: 9007199254740991\nnegative: -9007199254740991\nzero: -0\n"
local b = y.parse(doc, 'B')
assert(y.kind(b) == 'map' and b[1][1] == 'z' and b[1][2] == y.null)
assert(y.kind(b[2][2]) == 'seq' and b[2][2][1] == false)
assert(y.kind(b[2][2][2]) == 'seq' and y.kind(b[2][2][3]) == 'map')
assert(b[2][2][4] == "can't")
assert(b[3][2] == 9007199254740991 and b[4][2] == -9007199254740991 and b[5][2] == 0)
local expected = doc:gsub('zero: %-0', 'zero: 0')
assert(y.generate(b, 'B') == expected)
assert(y.validate(doc, 'B') == nil)
assert(y.generate(y.seq({ y.null, false, y.map(), y.seq() }), 'B') == '- null\n- false\n- {}\n- []\n')
assert(y.generate(y.parse('[]\n', 'B'), 'B') == '[]\n')
assert(y.generate(y.parse('{}\n', 'B'), 'B') == '{}\n')
local shared = y.map({ { 'name', 'x' } })
assert(y.generate(y.seq({ shared, shared }), 'B') == '-\n  name: \'x\'\n-\n  name: \'x\'\n')
assert(y.generate(y.map({ {'kind', 'x'}, {'null_value', y.null} }), 'B') == "kind: 'x'\nnull_value: null\n")
-- Every byte: independently expected scalar acceptance, preservation, and
-- rejection in comments too (the byte gate precedes comment skipping).
for byte = 0, 255 do
  local c = string.char(byte)
  local printable = byte >= 32 and byte <= 126
  local quoted = byte == 39 and "''" or c
  local input = "value: '" .. quoted .. "'\n"
  local ok, result = pcall(y.parse, input, 'B')
  assert(ok == printable, 'B byte ' .. byte)
  if ok then assert(result[1][2] == c) end
  if not standalone then
    local m = "value: '" .. c .. "'\n"
    ok, result = pcall(y.parse, m)
    assert(ok == (printable and byte ~= 39), 'M byte ' .. byte)
    if ok then assert(result[1][2] == c) end
  end
  if not printable and byte ~= 10 then
    rejects('E_CHARACTER', 2, function() y.validate('a: x\n# ' .. c .. '\n', 'B') end)
  end
end
rejects('E_DUPLICATE', 4, function() y.parse('# comment\na: 1\n\na: 2\n', 'B') end)
rejects('E_NEWLINE', 2, function() y.parse('a: x\nb: x', 'B') end)
if not standalone then
  rejects('E_EMPTY', 1, function() y.generate({}) end)
  rejects('E_SYNTAX', 1, function() y.generate({[2] = {'a', 'x'}}) end)
  rejects('E_SYNTAX', 1, function() y.generate({{'a', 'x', 'extra'}}) end)
  rejects('E_STRING', 1, function() y.generate({{'a', "can't"}}) end)
  rejects('E_DUPLICATE', 2, function() y.generate({{'a', 'x'}, {'a', 'y'}}) end)
end
badvalue({})
badvalue(y.null, 'E_SYNTAX')
badvalue('x', 'E_SYNTAX')
badvalue(y.seq({ 1.5 }))
badvalue(y.seq({ 0/0 }))
badvalue(y.seq({ math.huge }))
badvalue(y.seq({ 9007199254740992 }))
badvalue(y.seq({ function() end }))
badvalue(y.seq({ '\t' }))
badvalue(y.map({ { 'true', 'x' } }), 'E_KEY')
badvalue(y.map({ { 1, 'x' } }), 'E_KEY')
badvalue(y.map({ { 'a', 'x' }, { 'a', 'y' } }), 'E_DUPLICATE')
badvalue(y.map({ { 'a' } }), 'E_SYNTAX')
badvalue(y.seq({[2] = 'hole'}), 'E_SYNTAX')
badvalue(y.seq({field = 'extra'}), 'E_SYNTAX')
local cycle = y.seq(); cycle[1] = cycle
badvalue(cycle, 'E_SYNTAX')
local mapcycle = y.map(); mapcycle[1] = { 'self', mapcycle }
badvalue(mapcycle, 'E_SYNTAX')
local too_deep = 'leaf'
for _ = 1, 33 do too_deep = y.seq({ too_deep }) end
badvalue(too_deep, 'E_DEPTH')
-- Metamethods must not manufacture missing values or execute during generation.
local fake = setmetatable({}, { __index = function() error('unexpected __index') end })
badvalue(fake)
if not standalone then rejects('E_SYNTAX', nil, function() y.generate({fake}) end) end
for _, fn in ipairs({y.parse, y.validate, y.generate, y.parse_transport, y.generate_transport}) do
  assert(not pcall(fn, {}, 'X'))
end
assert(not pcall(y.parse, {}))
assert(not pcall(y.map, 'x'))
assert(not pcall(y.seq, y.map()))
if standalone then
  local b = y.parse("a: false\n")
  assert(y.kind(b) == 'map' and b[1][2] == false)
  assert(y.generate(b) == "a: false\n")
  for _, fn in ipairs({y.parse, y.validate, y.generate, y.parse_transport, y.generate_transport}) do
    assert(not pcall(fn, {}, 'M'))
  end
end
print('Lua API contracts passed')
