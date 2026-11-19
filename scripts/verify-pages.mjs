// After a Pages deploy, confirm the live page was built from the expected
// commit. The CDN can lag briefly, so poll for a bounded time.
// Usage: node scripts/verify-pages.mjs PAGE_URL COMMIT [TIMEOUT_SECONDS=180]
const [url, commit, seconds = '180'] = process.argv.slice(2);
if (!url || !/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('usage: node scripts/verify-pages.mjs PAGE_URL COMMIT [TIMEOUT_SECONDS]');
const target = new URL('generated.mjs', url.endsWith('/') ? url : `${url}/`);
const deadline = Date.now() + Number(seconds) * 1000;
let last = 'no response';
for (;;) {
  try {
    const response = await fetch(`${target}?verify=${Date.now()}`, { cache: 'no-store' });
    const text = await response.text();
    const found = /"commit": "([0-9a-f]{40})"/.exec(text)?.[1];
    if (response.ok && found === commit) { console.log(`Live page ${url} is built from ${commit}`); break; }
    last = `HTTP ${response.status}, commit ${found ?? 'missing'}`;
  } catch (error) { last = error.message; }
  if (Date.now() > deadline) { console.error(`Live page not at ${commit} after ${seconds}s: ${last}`); process.exit(1); }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
