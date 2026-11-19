// B · Playground first: a compact opening, a prominent editor, then supporting
// sections side by side.
export const id = 'B';
export const arrange = p => p.hero + p.playground + `<div class="below">${p.profiles}${p.boundaries}</div>` + p.copy;
