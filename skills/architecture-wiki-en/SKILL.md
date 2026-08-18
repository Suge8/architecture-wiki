---
name: architecture-wiki-en
disable-model-invocation: true
description: Build and maintain docs/architecture/ in a target repo — a Markdown wiki as the source of truth + a self-contained visualization + a staleness check wired into lint/CI, with a dead-code/cycles/hotspots health page.
compatibility: Requires Node.js 18+ and git; JS/TS dependency graphs additionally need bun or npm.
---

# Architecture Wiki

Code is the source of truth, the wiki is a continuously maintained compressed understanding, and the HTML is a derived visual interface. Three boundaries are fixed:

- The wiki only states sourced facts: every page's frontmatter records source files and content hashes.
- architecture.html is always disposable and rebuildable, rendered purely from the wiki; it carries no independent knowledge.
- Staleness is decided by the deterministic script verify.mjs; the LLM only understands and updates content, the program decides when an update is needed.

Works for any language: verify relies only on git hashes and text checks. For dependency graphs prefer the language's own toolchain ([LANGUAGES.md](./LANGUAGES.md) command table: JS/TS uses this skill's oxc code-map, Go/Rust/Java use official commands); for languages outside the table you read the code, extract relations and cite files line by line — verify still deterministically guards the sources.

## Target repo layout

```
docs/architecture/
├── architecture.html   # derived visualization, embeds wiki-digest
├── verify.mjs          # copied from this skill's templates/, zero-dependency
└── wiki/
    ├── index.md        # navigation + baseline commit + exemption list
    ├── system.md       # system overview: modules, responsibilities, boundaries
    ├── data-flow.md    # end-to-end data flows and payloads
    ├── health.md       # regenerated health page: dead code/cycles/hotspots/breakages
    └── modules/<name>.md
```

## Frontmatter conventions

Every wiki page:

```
---
sources:
  - src/auth/token.ts 8f3a21bc4d2e validateToken refreshToken
---
```

Each line is `<repo-relative path> <git blob hash prefix (≥8 chars)> [key symbols...]`. Sources must be files, not directories; pick the key files that support the page's claims rather than exhaustive lists, to control the false-positive surface. Hashes come from `git hash-object <path>`, first 12 chars. Symbols are function/type/route names the prose names explicitly; verify checks they still exist in that file. index.md additionally has a `baseline: <commit sha>` line.

Module pages also carry a `covers:` list — claimed path prefixes (directories end with `/`) or single files. sources are anchors supporting claims (checked for hash drift), covers are the page's territory (checked in claim reconciliation); different jobs. index.md may have an `exclude:` list (exemptions, same prefix syntax); verify has built-in common-sense exemptions (dotfiles/dot-directories, lockfiles, binary assets, docs/architecture itself), and every other file in `git ls-files` must be covered by some page's covers or excluded. health.md is a regenerated page: its frontmatter has `generated:` (the generating command) and `generated-at:` (the commit at generation time), no sources.

verify checks: source files exist and hashes match (on mismatch it prints a unified diff from the recorded version to the worktree; drift that doesn't touch anchored symbols is tagged "likely mechanical drift"; when the recorded blob isn't in the object store no diff is possible and it falls back to a filename-only error), symbols still exist, claim reconciliation (unclaimed files and rotten entries matching no files are both errors), inter-page relative links resolve, no orphan pages (every page except index has an inbound link), and the HTML digest matches the wiki body (the digest covers body text only; frontmatter is maintenance bookkeeping, so hash refreshes alone don't touch the HTML). Regenerated pages skip source checks and only get a rerun notice when behind HEAD (not a failure). Any failure exits 1 with a report naming pages and files.

## First build (when the repo has no docs/architecture/)

1. Gather facts: get the deterministic dependency graph per the [LANGUAGES.md](./LANGUAGES.md) table (for JS/TS run this skill's code-map; its oxc dependencies live in the skill's scripts/ directory and never touch the target repo — if missing, run `bun install` there, or `npm install` without bun; no need to ask permission. For languages outside the table, read code and extract relations). Done when: every node and edge in the wiki you're about to write can point back to a concrete file; every zero-in-degree file in the graph has been adjudicated (true entry points must have flows — see the entry reconciliation in LANGUAGES.md); every runtime-flow step has a real call site (entry, RPC definition, queue producer/consumer) — steps without one don't get drawn.
2. Write the wiki per the layout above; one responsibility domain per module page, aggregated by responsibility rather than spread by file.

   **Granularity**: stop and re-check any page claiming more than 20 files or 6000 lines — can this page's responsibility be stated in one sentence? If not, split by sub-responsibility. The numbers are re-check signals; the one-sentence test is the verdict. Page count grows naturally with repo size (with many pages, group index.md navigation by subsystem).

   **Module pages have four fixed sections**: Responsibility, Public interface, How data flows, Change guide. First two in plain language, last two technical: Responsibility and How data flows describe business behavior a non-author understands on first read, with no code identifiers; file and function names concentrate in Public interface and Change guide, in sentences like "the auth domain only exposes `validateToken`/`refreshToken` (`src/auth/token.ts`)"; gotchas go in the Change guide.

   **data-flow.md covers every entry point**: each real entry (HTTP API, CLI, queue consumer, cron…) gets at least one end-to-end path — entry → processing → storage, with payload shapes.

   Fill frontmatter per the conventions above. Done when: spot-check two pages — after reading you can answer "what does this module do, who uses it, which file do I read first to change it"; rewrite pages that fail. With ≥3 module pages and subagents available, read [FANOUT.md](./FANOUT.md) and parallelize; write the overview pages yourself.
3. Health check: read [HEALTH.md](./HEALTH.md), run the commands, review, produce wiki/health.md and node health fields.
4. Copy [templates/verify.mjs](./templates/verify.mjs) to `docs/architecture/verify.mjs`, run it until it passes.
5. Render the HTML: read [RENDER.md](./RENDER.md), inject the data JSON into templates/architecture.html — never hand-write the interface. The data JSON must set `meta.lang: "en"`. Done when: verify passes (data-side problems are all hard-checked by verify; no browser validation needed). Then `open docs/architecture/architecture.html` to show the user (first build only; sync doesn't auto-open).
6. Wire into lint: append `node docs/architecture/verify.mjs` to the repo's existing check entry (package.json scripts / justfile / Makefile / CI workflow), alongside existing lint and typecheck; don't embed it inside a linter plugin. If the repo's linter scans the whole tree, add `docs/architecture` to its ignore list — derived artifacts and the zero-dependency script aren't subject to project code style. Run the full check once to confirm they don't fight. If the repo has no check entry at all, create a minimal one that only runs verify (e.g. `"lint": "node docs/architecture/verify.mjs"` in package.json, or one CI step); verify is zero-dependency, needing only node + git.

## Sync (after code changes, or when verify fails)

1. Run `node docs/architecture/verify.mjs`: stale sources print a recorded-version → worktree unified diff; entries tagged "likely mechanical drift" can be skimmed. When no diff is possible (recorded blob not in the object store, e.g. changes from last sync were never committed), fall back to `git diff <baseline>.. -- <file>`.
2. For each page rule on the diff, one of two: page claims affected → edit the body; confirmed unaffected (comments, formatting, implementation details that change no claims) → leave the body alone. New files reported by claim reconciliation get added to some page's covers, or into exclude with a stated reason. When verify says the health report is behind, rerun it per [HEALTH.md](./HEALTH.md) to refresh health.md and node badges. Never advance to the next step without reading the diff — running --sync is signing "these changes have been reviewed".
3. `node docs/architecture/verify.mjs --sync`: refreshes all stale hash prefixes in one pass and advances baseline to current HEAD; semantic problems (vanished symbols, broken links) are never auto-fixed and still error for manual handling.
4. Re-render architecture.html only if you changed body text (the digest covers body only; hash refreshes don't count; get the digest from `node docs/architecture/verify.mjs --digest`). Finish by running verify to green.
