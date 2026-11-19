// Playground state and evaluation, free of any DOM so `node --test` covers it.
// The page passes in the exact standalone libraries: M input is checked by the
// M file and B input by the B file; nothing here parses YAMX itself.

/** Live validation stops at this many UTF-16 code units; above it the page
 * offers an explicit Validate action so typing never waits on a large parse. */
export const LIVE_LIMIT = 1 << 20;

/** Newline problems the page can fix on request. CRLF is not among them: an
 * HTML textarea converts CRLF and CR to LF in its value before any script sees
 * it, so the page reports that conversion at paste time (pastedLineEndings). */
export function newlineFixes(text) {
  return text !== '' && !text.endsWith('\n') ? ['final-lf'] : [];
}

export function applyNewlineFix(text, fix) {
  if (fix === 'final-lf') return text.endsWith('\n') ? text : text + '\n';
  throw new TypeError(`unknown fix: ${fix}`);
}

/** Line endings in raw pasted text that the editor converts to LF: 'crlf',
 * 'cr' (lone CR) or null. The profiles and their CLIs reject both. */
export function pastedLineEndings(raw) {
  if (raw.includes('\r\n')) return 'crlf';
  return raw.includes('\r') ? 'cr' : null;
}

/** The library message without its repeated "CODE line N: " prefix. */
function diagnostic(error) {
  return { code: error.code, line: error.line,
    message: String(error.message).replace(/^[A-Z_]+ line \d+: /, '') };
}

/**
 * @param {{ libraries: Record<string, { toJSON(text: string): string, YamxError: Function }>,
 *   examples: { id: string, profile: string, label: string, text: string }[], liveLimit?: number }} options
 */
export function createPlayground({ libraries, examples, liveLimit = LIVE_LIMIT }) {
  if (!examples.length) throw new TypeError('the playground needs at least one example');
  const byId = new Map(examples.map(example => [example.id, example]));
  if (byId.size !== examples.length) throw new TypeError('example ids must be unique');
  for (const example of examples) if (!libraries[example.profile]) throw new TypeError(`no library for profile ${example.profile}`);
  const profiles = [...new Set(examples.map(example => example.profile))];
  const drafts = new Map(); // example id -> edited text, in memory only
  const current = new Map(profiles.map(profile => [profile, examples.find(e => e.profile === profile).id]));
  let profile = examples[0].profile;

  const example = () => byId.get(current.get(profile));
  const playground = {
    profiles: () => profiles,
    examplesFor: of => examples.filter(e => e.profile === of),
    get profile() { return profile; },
    get exampleId() { return example().id; },
    get text() { return drafts.get(example().id) ?? example().text; },
    get edited() { return drafts.has(example().id); },
    /** Switch profile, returning to the example last shown for it. */
    selectProfile(next) {
      if (!current.has(next)) throw new TypeError(`unknown profile: ${next}`);
      profile = next;
    },
    selectExample(id) {
      const next = byId.get(id);
      if (!next) throw new TypeError(`unknown example: ${id}`);
      profile = next.profile;
      current.set(profile, id);
    },
    edit(text) {
      if (text === example().text) drafts.delete(example().id);
      else drafts.set(example().id, text);
    },
    reset() { drafts.delete(example().id); },
    applyFix(fix) { playground.edit(applyNewlineFix(playground.text, fix)); },
    /** Evaluate the current text; `force` validates even above the live limit. */
    evaluate(force = false) {
      const text = playground.text;
      if (!force && text.length > liveLimit) return { state: 'deferred', size: text.length };
      const library = libraries[profile];
      try {
        return { state: 'valid', json: library.toJSON(text) };
      } catch (error) {
        if (!(error instanceof library.YamxError)) throw error; // a bug, not a diagnostic
        return { state: 'invalid', diagnostic: diagnostic(error), fixes: newlineFixes(text) };
      }
    },
  };
  return playground;
}

/** Offset of the first character of a one-based line, for placing the cursor. */
export function lineOffset(text, line) {
  let offset = 0;
  for (let n = 1; n < line; n++) {
    const next = text.indexOf('\n', offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return offset;
}
