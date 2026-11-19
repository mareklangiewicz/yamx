// Every visible text of the page, shared by all layouts. Layouts only arrange
// the sections rendered from this; they contain no text of their own. Strings
// marked `html` may contain trusted inline markup; everything else is text.

export const content = {
  notice: 'Experimental · Your input stays in your browser',
  brand: { name: 'YAMX', tagline: 'Small YAML profiles' },
  nav: [['profiles', 'Profiles'], ['playground', 'Try it'], ['copy', 'Copy']],
  github: 'GitHub ↗',
  layoutLabel: 'Layout',
  layouts: { A: 'Guided', B: 'Playground', C: 'Reference' },
  theme: { toLight: 'Light theme', toDark: 'Dark theme' },
  skip: 'Skip to content',

  hero: {
    eyebrow: 'YAM(X) · A family of YAML subsets',
    title: ['Readable data.', 'Small tools.'],
    lead: 'Keep the YAML features you need. Leave the rest out. YAMX defines small, explicit profiles that independent shell, JavaScript and Lua tools can validate, parse and generate.',
    primary: ['playground', 'Edit an example ↓'],
    secondary: ['profiles', 'Meet the profiles'],
    fine: 'Experimental · Two implemented profiles · Copy one readable file · No runtime packages',
  },

  profiles: {
    title: 'Two profiles. Explicit boundaries.',
    intro: 'Choose the features your data needs. B includes M and preserves its meanings; the specifications define that relationship.',
    list: [
      { id: 'B', name: 'YAM(B) — Balanced', tag: 'Start here', summary: 'Nested collections, readable values and comments.',
        sample: 'name: YAMX\nactive: true\nitems:\n  - shell\n  - javascript\n',
        points: ['Maps and sequences, indented two spaces', 'Strings, safe integers, booleans and null', 'Comments and single-quoted strings'] },
      { id: 'M', name: 'YAM(M) — Minimal', tag: 'Current default', summary: 'A tiny flat mapping. Every value is a string.',
        sample: "name: 'yamx'\nactive: 'true'\ntool: 'shell'\n",
        points: ['Identifier keys and single-quoted strings', 'No nesting, comments or implicit types', 'A deliberately small grammar'] },
    ],
    fine: 'Command-line tools and libraries default to M today; select B explicitly. Profile names describe feature bundles; they do not define an inclusion hierarchy.',
  },

  playground: {
    title: 'Try the boundaries.',
    intro: 'Edit an example or paste your own data. See what the selected profile accepts, then take the decoded data to JSON.',
    profile: 'Profile',
    profileNames: { B: 'B · Balanced', M: 'M · Minimal' },
    example: 'Example',
    reset: 'Reset example',
    input: 'YAMX input',
    edited: 'edited',
    original: 'example',
    output: 'JSON output',
    copy: 'Copy JSON',
    copied: 'Copied',
    copySelected: 'Selected: press Ctrl+C',
    valid: profile => `✓ Valid YAM(${profile}) · JSON ready`,
    lineHint: 'Show this line in the input',
    fixes: { 'final-lf': 'Add final newline' },
    pasted: { crlf: 'The pasted text used CRLF line endings. This editor converted them to LF; YAMX files must use LF, and the command-line tools and libraries reject CRLF.',
      cr: 'The pasted text contained CR characters. This editor converted them to LF; YAMX files must use LF, and the command-line tools and libraries reject CR.' },
    deferred: size => `Large input (${size.toLocaleString('en-US')} characters): live checking is paused so typing stays responsive.`,
    validate: 'Validate',
    footnotes: ['Your input stays in this page. Nothing is uploaded or stored.', 'Printable ASCII · LF line endings · Final LF required'],
  },

  copy: {
    title: 'Copy one readable file.',
    intro: 'Choose a profile and a language, read the whole implementation, then copy it into your project. Each library is one complete file: no YAMX installation, repository checkout, package or build step.',
    head: 'Profile',
    languages: [['shell', 'Shell'], ['js-library', 'JavaScript'], ['lua-library', 'Lua']],
    profileNames: { M: 'YAM(M) — Minimal', B: 'YAM(B) — Balanced' },
    download: 'download',
    sizes: 'Sizes count every byte and line you copy, including the license header. The optional JavaScript and Lua CLIs add <code>cli.mjs</code> or <code>cli.lua</code> beside their library and load it, so a CLI file alone is incomplete.',
    runtime: 'Runtime',
    curl: '<code>curl</code> is only the download step.',
    license: 'MIT licensed: keep each file’s header. These links are pinned to the revision this page was built from; each file’s <code>Source revision (SHA-256)</code> line identifies its assembly.',
    latest: 'Later versions',
    evidence: 'A small file is easier to read, but its size does not prove it is correct. Each profile’s executable specification runs against these exact files.',
    specs: 'Specifications',
    ci: 'CI results',
    full: 'Complete file sets and examples ↗',
  },

  boundaries: {
    title: 'Small by design.',
    predictable: ['Predictable data', 'Explicit grammar keeps the tooling manageable. Both profiles reject unsupported syntax. B leaves out anchors, tags, double-quoted and multiline strings, and nonempty flow collections.',
      'B limits node depth to 32 and numbers to safe decimal integers. Both profiles currently accept overlong keys beyond YAML’s implicit-key limit; see the profile specifications.'],
    bridge: ['A bridge to other tools', 'Export accepted documents as JSON while preserving their decoded data. JSON export is one-way. Parsing and generation within YAMX use its own documented representations.',
      'Shell uses POSIX utilities. JavaScript uses standard ES modules. Lua uses only builtins. None of them needs a runtime package.'],
    command: '# JSON export with the standalone B shell file\nsh yamx.sh json catalog.yaml\n',
    specB: 'Read B’s specification ↗',
    specM: 'Read M’s specification ↗',
  },

  guide: {
    eyebrow: 'Field guide',
    items: [['hero', '01 · The idea'], ['profiles', '02 · Choose a profile'], ['playground', '03 · Try an example'],
      ['copy', '04 · Copy a file'], ['boundaries', '05 · Limits & tools']],
    fine: ['Experimental.', 'Small grammars.', 'Independent tools.'],
  },

  footer: {
    built: 'Built from',
    dirty: 'with uncommitted changes',
    revisions: 'standalone revisions',
    source: 'Source',
  },
};
