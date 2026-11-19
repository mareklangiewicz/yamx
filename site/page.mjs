// DOM wiring only: state and evaluation live in playground.mjs, texts in
// content.mjs, section markup in sections.mjs and arrangement in layouts/.
import data from './generated.mjs';
import { content } from './content.mjs';
import { escape, renderFooter, renderSections } from './sections.mjs';
import { defaultLayout, layouts } from './layouts/index.mjs';
import { createPlayground, lineOffset, pastedLineEndings } from './playground.mjs';
import * as minimal from './lib/minimal/yamx.mjs';
import * as balanced from './lib/balanced/yamx.mjs';

const $ = selector => document.querySelector(selector);
const playground = createPlayground({ libraries: { M: minimal, B: balanced }, examples: data.examples });
const parts = renderSections(content, data);
const g = content.playground;

// Only the chosen layout and theme are remembered; storage may be unavailable.
const stored = key => { try { return localStorage.getItem(`yamx.${key}`); } catch { return null; } };
const store = (key, value) => { try { localStorage.setItem(`yamx.${key}`, value); } catch { /* not remembered */ } };
const known = id => layouts.some(layout => layout.id === id);
const params = new URLSearchParams(location.search);
const requested = params.get('layout') ?? params.get('variant'); // preview links used ?variant=
let layoutId = [requested, stored('layout'), defaultLayout].find(known);
let theme = ['dark', 'light'].includes(stored('theme')) ? stored('theme') : 'dark';

function chrome() {
  $('#skip').textContent = content.skip;
  $('#notice').textContent = content.notice;
  $('#brand').innerHTML = `${escape(content.brand.name)}<span>${escape(content.brand.tagline)}</span>`;
  $('#nav').innerHTML = content.nav.map(([id, label]) => `<a href="#${id}">${escape(label)}</a>`).join('')
    + `<a href="${data.repository}">${escape(content.github)}</a><button type="button" class="theme-button" id="theme"></button>`;
  $('#layout-picker').innerHTML = `<span id="layout-label">${escape(content.layoutLabel)}</span>`
    + layouts.map(({ id }) => `<button type="button" data-layout="${id}">${escape(content.layouts[id])}</button>`).join('');
  $('#footer').innerHTML = renderFooter(content, data);
  $('#theme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store('theme', theme); applyTheme(); });
  for (const button of document.querySelectorAll('#layout-picker button'))
    button.addEventListener('click', () => chooseLayout(button.dataset.layout));
  applyTheme();
}

function applyTheme() {
  document.body.dataset.theme = theme;
  $('#theme').textContent = theme === 'dark' ? content.theme.toLight : content.theme.toDark;
  $('#theme').setAttribute('aria-pressed', String(theme === 'light'));
}

function chooseLayout(id) {
  if (!known(id) || id === layoutId) return;
  layoutId = id;
  store('layout', id);
  const url = new URL(location.href);
  url.searchParams.set('layout', id);
  url.searchParams.delete('variant');
  history.replaceState(null, '', url);
  renderLayout();
}

function renderLayout() {
  const layout = layouts.find(l => l.id === layoutId);
  const main = $('#main');
  main.className = `layout-${layout.id}`;
  document.body.dataset.layout = layout.id;
  main.innerHTML = layout.arrange(parts);
  for (const button of document.querySelectorAll('#layout-picker button'))
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout.id));
  bindPlayground();
}

let timer;
function bindPlayground() {
  const source = $('#source');
  $('#profile').addEventListener('change', event => { playground.selectProfile(event.target.value); sync(); });
  $('#example').addEventListener('change', event => { playground.selectExample(event.target.value); sync(); });
  $('#reset').addEventListener('click', () => { playground.reset(); sync(); });
  source.addEventListener('input', () => { playground.edit(source.value); markEdited(); schedule(); });
  // The textarea converts CRLF/CR to LF on paste; say so instead of hiding it.
  source.addEventListener('paste', event => {
    const endings = pastedLineEndings(event.clipboardData?.getData('text/plain') ?? '');
    if (endings) notePaste(endings);
  });
  $('#copy-json').addEventListener('click', copyJson);
  sync();
}

function sync() {
  $('#profile').value = playground.profile;
  $('#example').innerHTML = playground.examplesFor(playground.profile)
    .map(e => `<option value="${escape(e.id)}">${escape(e.label)}</option>`).join('');
  $('#example').value = playground.exampleId;
  if ($('#source').value !== playground.text) $('#source').value = playground.text;
  $('#pasted').hidden = true;
  markEdited();
  evaluate();
}

function notePaste(endings) {
  const note = $('#pasted');
  note.textContent = g.pasted[endings];
  note.hidden = false;
}

function markEdited() {
  $('#edited').textContent = playground.edited ? g.edited : g.original;
  $('#reset').disabled = !playground.edited;
}

function schedule() { clearTimeout(timer); timer = setTimeout(evaluate, 150); }

function button(label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'quiet';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function evaluate(force = false) {
  clearTimeout(timer);
  show(playground.evaluate(force));
}

function show(result) {
  const status = $('#status'), output = $('#output'), actions = $('#actions'), copy = $('#copy-json');
  status.className = 'status';
  status.replaceChildren();
  actions.replaceChildren();
  copy.textContent = g.copy;
  copy.disabled = result.state !== 'valid';
  output.textContent = result.state === 'valid' ? result.json : '';
  if (result.state === 'valid') status.textContent = g.valid(playground.profile);
  if (result.state === 'deferred') {
    status.textContent = g.deferred(result.size);
    actions.append(button(g.validate, () => evaluate(true)));
  }
  if (result.state === 'invalid') {
    const { code, line, message } = result.diagnostic;
    status.className = 'status bad';
    status.append(button(`${code} · line ${line} · ${message}`, () => showLine(line)));
    status.firstChild.className = '';
    status.firstChild.title = g.lineHint;
    for (const fix of result.fixes) actions.append(button(g.fixes[fix], () => { playground.applyFix(fix); sync(); }));
  }
}

function showLine(line) {
  const source = $('#source'), start = lineOffset(source.value, line);
  const end = source.value.indexOf('\n', start);
  source.focus();
  source.setSelectionRange(start, end < 0 ? source.value.length : end);
}

async function copyJson() {
  const copy = $('#copy-json'), output = $('#output');
  try {
    await navigator.clipboard.writeText(output.textContent);
    copy.textContent = g.copied;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(output);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    copy.textContent = g.copySelected;
  }
  setTimeout(() => { copy.textContent = g.copy; }, 2000);
}

chrome();
renderLayout();
