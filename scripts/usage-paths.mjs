// The standalone usage paths, each with the complete runtime file set it needs.
// Size measurements, the isolated gate directories and the copy guide all read
// this one list, so a documented file set is also the tested file set.
const shellUtilities = '`od`, `awk`, `sort`, `cat`, `mkdir`, `rm`; private temporary storage';
export const usagePaths = [
  { key: 'shell', usage: 'shell CLI', label: 'Shell CLI', files: ['yamx.sh'],
    runtime: `POSIX shell (dash, Bash, native zsh, BusyBox ash); ${shellUtilities}` },
  { key: 'js-library', usage: 'JS library', label: 'JavaScript library', files: ['yamx.mjs'],
    runtime: 'Native ES modules and language builtins' },
  { key: 'js', usage: 'JS CLI', label: 'JavaScript CLI', files: ['yamx.mjs', 'cli.mjs'],
    runtime: 'Node 24+; Node builtins' },
  { key: 'lua-library', usage: 'Lua library', label: 'Lua library', files: ['yamx.lua'],
    runtime: 'Lua 5.1/LuaJIT or newer; builtins only' },
  { key: 'lua', usage: 'Lua CLI', label: 'Lua CLI', files: ['yamx.lua', 'cli.lua'],
    runtime: 'Lua plus POSIX sh/test for regular-file checks' },
];
export const profileFolders = { M: 'minimal', B: 'balanced' };
