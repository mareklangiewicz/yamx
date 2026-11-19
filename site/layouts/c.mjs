// C · Reference: section navigation beside a stacked article.
export const id = 'C';
export const arrange = p => `<aside class="sidebar">${p.guide}</aside>`
  + `<article>${p.hero}${p.profiles}${p.playground}${p.copy}${p.boundaries}</article>`;
