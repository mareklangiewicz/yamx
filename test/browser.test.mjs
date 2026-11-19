// Headless-browser check of the built page, served under /yamx/ like Pages.
// Not part of scripts/check.sh: CI runs it in its own job after installing
// Playwright's Chromium. Locally: node --test test/browser.test.mjs, optionally
// with YAMX_CHROME=/path/to/chrome to use an installed browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { build } from '../scripts/site.mjs';
import { root } from '../scripts/distribute.mjs';
import { layouts } from '../site/layouts/index.mjs';
import { SECTIONS } from '../site/sections.mjs';
import { LIVE_LIMIT } from '../site/playground.mjs';
import * as M from '../dist/minimal/yamx.mjs';
import * as B from '../dist/balanced/yamx.mjs';

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
let directory, server, origin, browser, data;
const external = [], pageErrors = [];

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'yamx-site-'));
  data = build(join(directory, 'yamx'));
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (!path.startsWith('/yamx/')) { response.writeHead(404).end(); return; }
    let file = join(directory, normalize(path));
    if (!file.startsWith(join(directory, 'yamx'))) { response.writeHead(404).end(); return; }
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.YAMX_CHROME ? { executablePath: process.env.YAMX_CHROME } : {});
});
after(async () => {
  await browser?.close();
  server?.close();
  rmSync(directory, { recursive: true, force: true });
});

async function open(query = '', viewport = { width: 1280, height: 900 }, context) {
  context ??= await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('request', request => { if (!request.url().startsWith(`${origin}/`)) external.push(request.url()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.goto(`${origin}/yamx/${query}`);
  await page.waitForSelector('#status:not(:empty)');
  return page;
}
const status = page => page.textContent('#status');
const output = page => page.textContent('#output');
async function choose(page, example) {
  await page.selectOption('#profile', example.profile);
  await page.selectOption('#example', example.id);
}

test('every layout renders every section once without horizontal overflow', async () => {
  for (const { id } of layouts) for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await open(`?layout=${id}`, viewport);
    const label = `${id} ${viewport.width}px`;
    assert.equal(await page.getAttribute('main', 'class'), `layout-${id}`, label);
    for (const section of SECTIONS) assert.equal(await page.locator(`#${section}`).count(), 1, `${label}: #${section}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`);
    await page.context().close();
  }
});

test('examples produce the libraries’ JSON or their diagnostics', async () => {
  const page = await open();
  const first = data.examples[0];
  assert.equal(await page.inputValue('#source'), first.text);
  for (const example of data.examples) {
    await choose(page, example);
    const library = example.profile === 'M' ? M : B;
    let expected;
    try { expected = { json: library.toJSON(example.text) }; } catch (error) { expected = { error }; }
    if (expected.json) {
      await page.waitForFunction(json => document.querySelector('#output').textContent === json, expected.json);
      assert.equal(await page.isDisabled('#copy-json'), false, example.id);
    } else {
      await page.waitForFunction(() => document.querySelector('#status.bad'));
      assert.equal(await output(page), '', example.id);
      assert.match(await status(page), new RegExp(`^${expected.error.code} · line ${expected.error.line} · `), example.id);
      assert.equal(await page.isDisabled('#copy-json'), true, example.id);
    }
  }
  await page.context().close();
});

test('edits survive profile, example and layout switches; reset restores', async () => {
  const page = await open('?layout=A');
  const [b1, b2] = data.examples.filter(e => e.profile === 'B');
  await choose(page, b1);
  await page.fill('#source', "edited: 'yes'\n");
  await page.waitForFunction(() => document.querySelector('#output').textContent.includes('edited'));
  await choose(page, b2);
  assert.equal(await page.inputValue('#source'), b2.text);
  await page.selectOption('#profile', 'M');
  await page.selectOption('#profile', 'B');
  assert.equal(await page.inputValue('#example'), b2.id);
  await page.selectOption('#example', b1.id);
  assert.equal(await page.inputValue('#source'), "edited: 'yes'\n");
  await page.click('#layout-picker button[data-layout="C"]');
  assert.equal(await page.getAttribute('main', 'class'), 'layout-C');
  assert.match(page.url(), /[?&]layout=C\b/);
  assert.equal(await page.inputValue('#source'), "edited: 'yes'\n");
  await page.click('#reset');
  assert.equal(await page.inputValue('#source'), b1.text);
  assert.equal(await page.isDisabled('#reset'), true);
  await page.context().close();
});

test('invalid input clears the output and offers explicit newline fixes', async () => {
  const page = await open();
  await page.selectOption('#profile', 'B');
  for (const [text, fix] of [['a: 1', 'Add final newline']]) {
    await page.fill('#source', text);
    await page.waitForFunction(() => document.querySelector('#status.bad'));
    assert.equal(await output(page), '');
    assert.equal(await page.inputValue('#source'), text, 'never repaired silently');
    await page.click(`#actions button:has-text("${fix}")`);
    await page.waitForFunction(() => document.querySelector('#output').textContent.startsWith('{'));
    assert.equal(await page.inputValue('#source'), text + '\n');
  }
  // The diagnostic places the cursor on its line.
  await page.fill('#source', 'a: 1\nb: "x"\n');
  await page.waitForFunction(() => document.querySelector('#status.bad'));
  await page.click('#status button');
  assert.deepEqual(await page.evaluate(() => [document.activeElement.id, document.activeElement.selectionStart]), ['source', 5]);
  await page.context().close();
});

test('Copy puts the JSON on the clipboard', async () => {
  const page = await open();
  await page.click('#copy-json');
  await page.waitForFunction(() => document.querySelector('#copy-json').textContent === 'Copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await output(page));
  await page.context().close();
});

test('theme and layout are remembered; nothing else is stored', async () => {
  const context = await browser.newContext();
  let page = await open('', undefined, context);
  assert.equal(await page.getAttribute('body', 'data-theme'), 'dark');
  assert.equal(await page.getAttribute('main', 'class'), 'layout-A');
  await page.click('#theme');
  await page.click('#layout-picker button[data-layout="B"]');
  await page.fill('#source', "draft: 'not stored'\n");
  await page.close();
  page = await open('', undefined, context);
  assert.equal(await page.getAttribute('body', 'data-theme'), 'light');
  assert.equal(await page.getAttribute('main', 'class'), 'layout-B');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['yamx.layout', 'yamx.theme']);
  assert.equal(await page.inputValue('#source'), data.examples[0].text);
  await context.close();
});

test('large input defers live checking; measured parse times', async () => {
  const page = await open();
  await page.selectOption('#profile', 'B');
  const lines = n => Array.from({ length: n }, (_, i) => `key${i}: value ${i}\n`).join('');
  const timings = await page.evaluate(async sizes => {
    const lib = await import('./lib/balanced/yamx.mjs');
    const result = {};
    for (const [label, text] of sizes) {
      const start = performance.now();
      lib.toJSON(text);
      result[label] = Math.round(performance.now() - start);
    }
    return result;
  }, [['1 MiB', lines(60000)], ['4 MiB', lines(240000)]].map(([l, t]) => [l, t]));
  console.log(`B toJSON in Chromium (ms): ${JSON.stringify(timings)}`);
  const big = lines(Math.ceil(LIVE_LIMIT / 14));
  assert.ok(big.length > LIVE_LIMIT);
  // Playwright's fill types too slowly for a megabyte; set it as a paste would.
  await page.evaluate(text => {
    const source = document.querySelector('#source');
    source.value = text;
    source.dispatchEvent(new Event('input', { bubbles: true }));
  }, big);
  await page.waitForFunction(() => document.querySelector('#actions button'));
  assert.match(await status(page), /live checking is paused/);
  assert.equal(await output(page), '');
  await page.click('#actions button');
  await page.waitForFunction(() => document.querySelector('#output').textContent.startsWith('{'), null, { timeout: 15000 });
  await page.context().close();
});

test('pasted CRLF is converted by the editor and the page says so', async () => {
  const page = await open();
  await page.selectOption('#profile', 'B');
  await page.fill('#source', '');
  await page.focus('#source');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'a: 1\r\nb: 2\r\n');
    document.querySelector('#source').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  assert.equal(await page.isVisible('#pasted'), true);
  assert.match(await page.textContent('#pasted'), /CRLF/);
  await page.selectOption('#example', data.examples.find(e => e.profile === 'B').id);
  assert.equal(await page.isVisible('#pasted'), false);
  await page.context().close();
});

test('no request leaves the page’s own origin and no script errors occur', () => {
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
});
