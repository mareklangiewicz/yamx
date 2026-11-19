// The available layouts, in picker order. Removing one is deleting its module,
// its line here and its CSS block; content and logic stay unchanged.
import * as A from './a.mjs';
import * as B from './b.mjs';
import * as C from './c.mjs';

export const layouts = [A, B, C];
export const defaultLayout = 'A';
