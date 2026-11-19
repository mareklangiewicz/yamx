// Render each content section to an HTML string. The layouts receive these
// parts and only arrange them. `data` is the build output: the commit the page
// was built from, the standalone files' facts and the page examples.

export const SECTIONS = ['hero', 'profiles', 'playground', 'copy', 'boundaries'];

export const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const code = text => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
const number = n => n.toLocaleString('en-US');

/** Links pinned to the built commit, so they describe exactly what is served. */
export function links(data) {
  const at = `${data.repository}/blob/${data.commit}`;
  return {
    blob: path => `${at}/${path}`,
    raw: path => `https://raw.githubusercontent.com/${data.repository.replace('https://github.com/', '')}/${data.commit}/${path}`,
    history: path => `${data.repository}/commits/main/${path}`,
    commit: `${data.repository}/commit/${data.commit}`,
    ci: `${data.repository}/actions/workflows/test.yml`,
  };
}

export function renderSections(content, data) {
  const at = links(data);
  const c = content;
  const hero = `<section class="section hero" id="hero"><div class="hero-copy"><div class="eyebrow">${escape(c.hero.eyebrow)}</div>`
    + `<h1>${c.hero.title.map(escape).join('<br>')}</h1><p class="lead">${escape(c.hero.lead)}</p>`
    + `<div class="hero-actions"><a class="cta" href="#${c.hero.primary[0]}">${escape(c.hero.primary[1])}</a>`
    + `<a class="secondary" href="#${c.hero.secondary[0]}">${escape(c.hero.secondary[1])}</a></div>`
    + `<p class="fine">${escape(c.hero.fine)}</p></div></section>`;

  const profiles = `<section class="section" id="profiles"><div class="section-intro"><h2>${escape(c.profiles.title)}</h2>`
    + `<p>${escape(c.profiles.intro)}</p></div><div class="profile-pair">`
    + c.profiles.list.map(p => `<article class="profile"><h3>${escape(p.name)} <span class="tag">${escape(p.tag)}</span></h3>`
      + `<p>${escape(p.summary)}</p><pre>${escape(p.sample)}</pre><ul>${p.points.map(x => `<li>${escape(x)}</li>`).join('')}</ul></article>`).join('')
    + `</div><p class="fine">${escape(c.profiles.fine)}</p></section>`;

  const g = c.playground;
  const profileNames = [...new Set(data.examples.map(e => e.profile))];
  const playground = `<section class="section playground" id="playground"><div class="play-header"><div><h2>${escape(g.title)}</h2>`
    + `<p>${escape(g.intro)}</p></div></div><div class="controls">`
    + `<label>${escape(g.profile)}<select id="profile">${profileNames.map(p => `<option value="${p}">${escape(g.profileNames[p])}</option>`).join('')}</select></label>`
    + `<label>${escape(g.example)}<select id="example"></select></label>`
    + `<button type="button" id="reset" class="quiet">${escape(g.reset)}</button></div>`
    + `<div class="editors"><div class="editor"><div class="editor-head"><label for="source">${escape(g.input)}</label><span id="edited"></span></div>`
    + `<textarea id="source" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="status"></textarea></div>`
    + `<div class="editor"><div class="editor-head"><span id="json-label">${escape(g.output)}</span><button type="button" id="copy-json">${escape(g.copy)}</button></div>`
    + `<pre id="output" aria-labelledby="json-label" tabindex="0"></pre></div></div>`
    + `<div class="status-row"><div id="status" class="status" role="status" aria-live="polite"></div><div id="actions" class="actions"></div></div><p id="pasted" class="fine pasted" role="status" hidden></p>`
    + `<div class="footnotes">${g.footnotes.map(x => `<span>${escape(x)}</span>`).join('')}</div></section>`;

  const k = c.copy;
  const facts = data.profiles;
  const cell = (p, key, language) => {
    const path = p.paths.find(x => x.key === key), file = path.files.at(-1), where = `dist/${p.folder}/${file}`;
    return `<div><span class="lang">${escape(language)}</span><a href="${at.blob(where)}"><code>${escape(file)}</code></a> · `
      + `<a href="${at.raw(where)}">${escape(k.download)}</a><span class="size">${number(path.bytes)} B · ${number(path.lines)} lines</span></div>`;
  };
  const clis = p => p.paths.filter(x => x.files.length > 1).map(x => `${escape(x.label)} ${number(x.bytes)} B`).join(', ');
  const b = facts.find(p => p.profile === 'B') ?? facts[0];
  const runtime = key => code(b.paths.find(x => x.key === key).runtime);
  const copy = `<section class="section copy" id="copy"><div class="section-intro"><h2>${escape(k.title)}</h2><p>${escape(k.intro)}</p></div>`
    + `<div class="copy-grid"><div class="head">${escape(k.head)}</div>${k.languages.map(([, l]) => `<div class="head">${escape(l)}</div>`).join('')}`
    + facts.map(p => `<div class="row-head">${escape(k.profileNames[p.profile])}</div>${k.languages.map(([key, l]) => cell(p, key, l)).join('')}`).join('')
    + `</div><p class="fine">${k.sizes} ${facts.map(p => `${p.profile}: ${clis(p)}.`).join(' ')}</p>`
    + `<pre class="command">${escape(data.copyExample)}</pre>`
    + `<p class="fine">${escape(k.runtime)}: ${k.languages.map(([key, l]) => `${escape(l)} — ${runtime(key)}`).join('. ')}. ${k.curl}</p>`
    + `<p class="fine">${k.license} ${facts.map(p => `${p.profile} <code>${p.revision.slice(0, 12)}…</code>`).join(', ')}. `
    + `${escape(k.latest)}: ${facts.map(p => `<a href="${at.history(`dist/${p.folder}`)}">${p.profile}</a>`).join(', ')}.</p>`
    + `<p class="fine">${escape(k.evidence)} ${escape(k.specs)}: ${facts.map(p => `<a href="${at.blob(`spec/${p.folder}_spec.sh`)}">${p.profile}</a>`).join(', ')}. `
    + `<a href="${at.ci}">${escape(k.ci)}</a> · <a href="${at.blob('docs/distributions.md')}">${escape(k.full)}</a></p></section>`;

  const d = c.boundaries;
  const column = ([title, ...paragraphs], extra = '') => `<div><h3>${escape(title)}</h3>${paragraphs.map((x, i) => `<p>${escape(x)}</p>${i === 0 ? extra : ''}`).join('')}</div>`;
  const boundaries = `<section class="section" id="boundaries"><h2>${escape(d.title)}</h2><div class="boundary">`
    + column(d.predictable) + column(d.bridge, `<pre class="command">${escape(d.command)}</pre>`) + `</div>`
    + `<p><a href="${at.blob('docs/balanced.md')}">${escape(d.specB)}</a> · <a href="${at.blob('docs/minimal.md')}">${escape(d.specM)}</a></p></section>`;

  const guide = `<div class="eyebrow">${escape(c.guide.eyebrow)}</div>`
    + c.guide.items.map(([id, label]) => `<a href="#${id}">${escape(label)}</a>`).join('')
    + `<p class="fine">${c.guide.fine.map(escape).join('<br>')}</p>`;

  return { hero, profiles, playground, copy, boundaries, guide };
}

export function renderFooter(content, data) {
  const at = links(data), f = content.footer;
  return `${escape(f.built)} <a href="${at.commit}"><code>${escape(data.commit.slice(0, 12))}</code></a>`
    + (data.dirty ? ` ${escape(f.dirty)}` : '')
    + ` · ${escape(f.revisions)} ${data.profiles.map(p => `${p.profile} <code>${p.revision.slice(0, 12)}</code>`).join(', ')}`
    + ` · <a href="${data.repository}">${escape(f.source)}</a>`;
}
