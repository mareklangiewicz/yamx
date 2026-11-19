// Gate checks for the page: examples agree with their profiles, the DOM-free
// playground logic, layout purity and the build output. The headless-browser
// checks live in test/browser.test.mjs (a separate CI job).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from '../scripts/distribute.mjs';
import { build, pageExamples, siteData } from '../scripts/site.mjs';
import { content } from '../site/content.mjs';
import { SECTIONS, renderSections } from '../site/sections.mjs';
import { defaultLayout, layouts } from '../site/layouts/index.mjs';
import { applyNewlineFix, createPlayground, lineOffset, newlineFixes, pastedLineEndings } from '../site/playground.mjs';
import * as M from '../dist/minimal/yamx.mjs';
import * as B from '../dist/balanced/yamx.mjs';

const libraries = { M, B };
const commit = 'a'.repeat(40);

test('every page example agrees with its profile', () => {
  const examples = pageExamples();
  assert.ok(examples.some(e => e.profile === 'B' && !e.error) && examples.some(e => e.profile === 'M' && !e.error));
  assert.equal(new Set(examples.map(e => e.id)).size, examples.length);
  for (const example of examples) {
    const library = libraries[example.profile];
    if (!example.error) { assert.doesNotThrow(() => library.validate(example.text), example.id); continue; }
    assert.throws(() => library.validate(example.text), error => error instanceof library.YamxError
      && error.code === example.error.code && error.line === example.error.line, example.id);
  }
});

test('the page leads with a valid B example', () => {
  const [first] = pageExamples();
  assert.equal(first.profile, 'B');
  assert.equal(first.error, undefined);
});

const examples = [
  { id: 'b1', profile: 'B', label: 'one', text: "a: 1\n" },
  { id: 'b2', profile: 'B', label: 'two', text: 'b: "no"\n' },
  { id: 'm1', profile: 'M', label: 'three', text: "a: '1'\n" },
];

test('each profile+example keeps its own draft; reset restores the original', () => {
  const p = createPlayground({ libraries, examples });
  assert.deepEqual([p.profile, p.exampleId, p.text, p.edited], ['B', 'b1', "a: 1\n", false]);
  p.edit("a: 2\n");
  assert.equal(p.edited, true);
  p.selectExample('b2');
  assert.equal(p.text, 'b: "no"\n');
  p.selectProfile('M');
  assert.equal(p.exampleId, 'm1');
  p.selectProfile('B');
  assert.equal(p.exampleId, 'b2', 'a profile returns to the example last shown');
  p.selectExample('b1');
  assert.equal(p.text, "a: 2\n");
  p.edit("a: 1\n");
  assert.equal(p.edited, false, 'editing back to the original is not a draft');
  p.edit('x');
  p.reset();
  assert.deepEqual([p.text, p.edited], ["a: 1\n", false]);
  assert.throws(() => p.selectProfile('X'), TypeError);
  assert.throws(() => p.selectExample('nope'), TypeError);
});

test('evaluation uses the selected profile’s library and its toJSON', () => {
  const p = createPlayground({ libraries, examples });
  assert.deepEqual(p.evaluate(), { state: 'valid', json: B.toJSON("a: 1\n") });
  p.selectProfile('M');
  assert.deepEqual(p.evaluate(), { state: 'valid', json: '{\n  "a": "1"\n}\n' });
  p.edit('a: 1\n'); // plain scalar: valid B, invalid M
  const result = p.evaluate();
  assert.equal(result.state, 'invalid');
  assert.equal(result.diagnostic.line, 1);
  assert.doesNotMatch(result.diagnostic.message, /^E_/, 'the code is not repeated in the message');
  assert.deepEqual(result.fixes, []);
});

test('a missing final LF is offered as an explicit fix, never applied silently', () => {
  const p = createPlayground({ libraries, examples });
  p.edit('a: 1');
  const result = p.evaluate();
  assert.deepEqual([result.state, result.diagnostic.code, result.fixes], ['invalid', 'E_NEWLINE', ['final-lf']]);
  assert.equal(p.text, 'a: 1');
  p.applyFix('final-lf');
  assert.equal(p.text, 'a: 1\n');
  assert.equal(p.evaluate().state, 'valid');
  assert.deepEqual(newlineFixes(''), []);
  assert.equal(applyNewlineFix('a\n', 'final-lf'), 'a\n');
  assert.throws(() => applyNewlineFix('a', 'crlf'), TypeError);
});

test('pasted CR and CRLF are reported because the editor converts them', () => {
  assert.equal(pastedLineEndings('a\r\nb'), 'crlf');
  assert.equal(pastedLineEndings('a\rb'), 'cr');
  assert.equal(pastedLineEndings('a\nb'), null);
});

test('input above the live limit waits for an explicit validation', () => {
  const p = createPlayground({ libraries, examples, liveLimit: 8 });
  p.edit("long: '123456'\n");
  assert.deepEqual(p.evaluate(), { state: 'deferred', size: 15 });
  assert.equal(p.evaluate(true).state, 'valid');
});

test('non-YAMX errors are bugs, not diagnostics', () => {
  const broken = { toJSON() { throw new RangeError('bug'); }, YamxError: B.YamxError };
  const p = createPlayground({ libraries: { B: broken }, examples: [examples[0]] });
  assert.throws(() => p.evaluate(), RangeError);
  assert.throws(() => createPlayground({ libraries, examples: [] }), TypeError);
  assert.throws(() => createPlayground({ libraries: { B }, examples }), /no library for profile M/);
});

test('lineOffset finds where a one-based line starts', () => {
  assert.deepEqual([1, 2, 3, 9].map(n => lineOffset('ab\ncd\n', n)), [0, 3, 6, 6]);
});

// Sentinel parts make anything a layout adds itself visible.
test('every layout renders every section exactly once and has no text of its own', () => {
  const parts = Object.fromEntries([...SECTIONS, 'guide'].map(id => [id, `<x-${id}></x-${id}>`]));
  assert.ok(layouts.some(l => l.id === defaultLayout));
  assert.equal(new Set(layouts.map(l => l.id)).size, layouts.length);
  for (const layout of layouts) {
    const html = layout.arrange(parts);
    for (const id of SECTIONS) assert.equal(html.split(`<x-${id}>`).length - 1, 1, `${layout.id}: ${id}`);
    assert.ok(html.split('<x-guide>').length <= 2, `${layout.id}: guide at most once`);
    assert.equal(html.replace(/<[^>]*>/g, '').trim(), '', `${layout.id} adds text`);
    assert.ok(content.layouts[layout.id], `${layout.id} has a picker label`);
  }
});

test('the build pins links and data to the commit and ships the exact libraries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yamx-site-build-'));
  try {
    const data = build(join(directory, 'out'), root, siteData(root, { commit, dirty: false }));
    for (const folder of ['minimal', 'balanced'])
      assert.equal(readFileSync(join(directory, 'out/lib', folder, 'yamx.mjs'), 'utf8'), readFileSync(join(root, 'dist', folder, 'yamx.mjs'), 'utf8'));
    for (const name of ['index.html', 'page.mjs', 'generated.mjs', 'styles.css', 'layouts/index.mjs']) assert.ok(existsSync(join(directory, 'out', name)), name);
    assert.match(data.copyExample, new RegExp(`/yamx/${commit}/dist/balanced\\n`));
    const parts = renderSections(content, data);
    assert.match(parts.copy, new RegExp(`raw\\.githubusercontent\\.com/mareklangiewicz/yamx/${commit}/dist/minimal/yamx\\.sh`));
    assert.match(parts.copy, new RegExp(`/blob/${commit}/spec/balanced_spec\\.sh`));
    assert.doesNotMatch(Object.values(parts).join(''), /\/(blob|yamx)\/main\//, 'only history links follow main');
    for (const p of data.profiles) assert.ok(parts.copy.includes(p.revision.slice(0, 12)));
    assert.throws(() => siteData(root, { commit: 'main', dirty: false }), /full commit id/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
