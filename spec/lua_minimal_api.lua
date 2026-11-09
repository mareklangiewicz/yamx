-- Executed with only the standalone module in its library directory.
local y = dofile(arg[1])
local function rejects(code, line, fn)
  local ok, e = pcall(fn)
  assert(not ok and y.is_error(e), tostring(e))
  assert(e.code == code and e.line == line, tostring(e))
end
local text = "z: ''\na: '  x  '\n"
local entries = y.parse(text)
assert(entries[1][1] == 'z' and entries[1][2] == '')
assert(entries[2][1] == 'a' and entries[2][2] == '  x  ')
assert(y.generate(entries) == text and y.validate(text) == nil)
assert(y.generate_transport(entries) == 'z\t\na\t  x  \n')
assert(y.generate(y.parse_transport('a\tx\n')) == "a: 'x'\n")
for byte = 0, 255 do
  local c = string.char(byte)
  local allowed = byte >= 32 and byte <= 126 and byte ~= 39
  local ok, value = pcall(y.parse, "value: '" .. c .. "'\n")
  assert(ok == allowed, 'byte ' .. byte)
  if ok then assert(value[1][2] == c) end
end
rejects('E_DUPLICATE', 2, function() y.parse("a: 'x'\na: 'y'\n") end)
rejects('E_CHARACTER', 2, function() y.validate("a: 'x'\nb: '\0'\n") end)
rejects('E_NEWLINE', 2, function() y.parse("a: 'x'\nb: 'y'") end)
rejects('E_EMPTY', 1, function() y.generate({}) end)
rejects('E_SYNTAX', 1, function() y.generate({[2] = {'a', 'x'}}) end)
-- A hole after a valid entry must be diagnosed at the collection, rather than
-- slipping through to a later missing-pair check with a different line.
rejects('E_SYNTAX', 1, function() y.generate({{'a', 'x'}, [3] = {'b', 'y'}}) end)
rejects('E_SYNTAX', 1, function() y.generate({{'a', 'x', 'extra'}}) end)
rejects('E_STRING', 1, function() y.generate({{'a', "can't"}}) end)
rejects('E_DUPLICATE', 2, function() y.generate({{'a', 'x'}, {'a', 'y'}}) end)
local fake = setmetatable({}, { __index = function() error('unexpected __index') end })
rejects('E_SYNTAX', 1, function() y.generate({fake}) end)
for _, fn in ipairs({y.parse, y.validate, y.generate, y.parse_transport, y.generate_transport}) do
  assert(not pcall(fn, {}, 'B'))
  assert(not pcall(fn, {}, 'X'))
end
assert(y.map == nil and y.seq == nil and y.null == nil)
print('Standalone Lua Minimal contracts passed')
