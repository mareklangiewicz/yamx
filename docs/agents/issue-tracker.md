# Issue tracker: GitHub

Issues and specs live in mareklangiewicz/yamx on GitHub.
Use the gh CLI from this clone.

## Operations

- Before the first issue creation in a session, verify the target with
  `gh repo view --json nameWithOwner`. It must be mareklangiewicz/yamx.
- Create: `gh issue create --title "..." --body-file <file>`.
  Write multiline bodies to a file first.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels,assignees`,
  with appropriate filters.
- Comment: `gh issue comment <number> --body-file <file>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."`
  or `--remove-label "..."`. Read triage-labels.md for role mappings.
- Close: post the explanation as a comment, then `gh issue close <number>`.
  Post the comment separately even when the issue is already closed.

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read its issue and comments.

## Parent issues and blockers

Use native GitHub sub-issues and issue dependencies where supported.
Use the installed gh CLI's supported commands or gh api.

For REST sub-issue links, pass the child's numeric database id as
sub_issue_id. For blocked_by dependencies, pass the blocker's numeric
database id as issue_id. Obtain ids with:
`gh api repos/mareklangiewicz/yamx/issues/<number> --jq .id`.

If native links are unavailable, put `Part of #<parent>` and
`Blocked by: #<number>, ...` at the top of the child body, and maintain
a child task list in the parent. A ticket is startable only when all
blockers are closed.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding

A map is one issue labelled wayfinder:map, containing Notes,
Decisions-so-far, and Fog. Link child tickets as sub-issues, with labels
wayfinder:research, wayfinder:prototype, wayfinder:grilling, or
wayfinder:task as appropriate.

Choose the first open, unassigned, unblocked child in map order.
Claim it with `gh issue edit <number> --add-assignee @me`.
Resolve it by posting the answer, closing the child, and appending
a gist and link to the map's Decisions-so-far.
