> **Superseded.** The production page is built from [`site/` on main](https://github.com/mareklangiewicz/yamx/tree/main/site)
> (issue #11) and deployed by `.github/workflows/pages.yml`. This branch is kept
> as the record of the A/B/C layout review; its preview is no longer published.

# Introduction prototype

Question: which introductory story and page layout helps new visitors understand
YAM(X), compare M/B and start exploring examples?

Open `introduction-prototype.html` directly in a browser. It is self-contained;
no server, package installation or build step is needed. From this checkout:

```sh
xdg-open prototypes/introduction-prototype.html
```

The floating arrows (or left/right keys outside editing controls) switch among:

- `?variant=A`: guided introduction with a larger opening and two-column editor.
- `?variant=B`: playground first, with compact introductory text and supporting
  profile/limits sections side by side below the editor.
- `?variant=C`: compact reference, with section navigation and profiles before
  the stacked editor/output.

Input and profile state stay in memory while switching layouts. Dark is the default theme in every layout; the header button switches to light.
The theme and editor state are kept in memory. Nothing is persisted or uploaded. Profile/example changes load fresh examples; that behavior
is provisional and is not the interaction decision this prototype resolves.

Keep all three layouts available until Marek explicitly chooses a direction;
he plans to review them later across devices. Layout choice and theme are
independent. The editors, controls and switcher have responsive small-screen
styles, including stacked panes, larger touch targets and safe-area spacing.

The HTML includes an isolated snapshot of the existing JS parser at c0c4de5.
Its JSON adapter is prototype-only. JSON export (`json FILE`, `toJSON`, Lua
`to_json`) has since landed on main, but the page does not use it yet (#4, #5).
The profile specification links in "Small by design" target the prototype
source branch.

The "Copy one readable file" section (issue #10) appears in all three layouts.
Its links point to the standalone files on `main`. Its sizes and revisions are
embedded `copyGuide` data: the output of `node scripts/copy-guide.mjs --json` on
the main commit named in the page. Refresh that data whenever `dist/` changes on
main. The README and `docs/distributions.md` on main hold the drift-checked copy.

This is throwaway source retained on `prototype/pages-introduction`, not main.
Do not merge it as the production site. Await Marek's visual/content feedback
before closing the decision ticket.

Checks performed: JS syntax and parser snapshot smoke check. No browser was
available through the session's UI tools, so visual layout, controls, clipboard
and direct-file behavior have not been browser-verified. The revised theme
JavaScript also passed syntax verification.

Marek authorized publishing this multi-layout preview to GitHub Pages and
explicitly making yamx public to enable Pages on the Free plan. The site is
published from the root of the gh-pages branch: index.html is a copy of this
self-contained HTML file, alongside .nojekyll and a source-pointer README.
Update that copy when changing the preview. Keep all three layouts live for
later cross-device review; publication does not close the presentation decision.
