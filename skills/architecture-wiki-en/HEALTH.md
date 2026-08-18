# Health check: health.md production spec

The health check is a standard content step of the first build, producing `wiki/health.md` (a regenerated page) and node health badges. All facts come from deterministic commands; you only interpret and file them — no claim without a command source appears on the page. When verify prints "health report is N commits behind", rerun per this doc in the sync session.

## Commands (fixed, no configuration surface)

1. **Dead code / dependency cycles**: run the language's command from the [LANGUAGES.md](./LANGUAGES.md) health table (the table is the source of truth for the exact command; major versions are pinned — CLIs change across majors and @latest would silently change the check's behavior). Non-zero exit = findings, not failure.
2. **Hotspots**: a zero-dependency git pipeline — `git log --since="12 months ago" --name-only --pretty=format: | sort | uniq -c | sort -rn` gives per-file churn; multiply by current line count (`wc -l`); take the top 10 products (or up to an obvious cliff) among source files that still exist.
3. **Broken references**: for JS/TS take the code-map output's `error` (parse failures) and `unresolved` (dangling relative imports); for other languages, dangling references confirmed while reading code, each with its citation. State blind spots honestly: template-string dynamic imports are invisible to static parsing (they appear in neither imports nor unresolved), backstopped by the dead-file review and worker boundary reports; the section ends with a fixed sentence noting this.

## False-positive review (mandatory before any dead file goes on the wall)

For every file knip reports unused, grep the whole repo for string references to its filename and extension-less basename (`rg -l`). Traces found → file it under "Suspected" with the trace locations; clean → only then does it enter the dead-code section proper. Dynamic-reference false positives and truly dead files look identical in knip output; this review is where the section's credibility comes from.

## Page structure (fixed)

Frontmatter has `generated: <the dead-code command verbatim>` and `generated-at: <current HEAD>`, no sources (verify skips hash checks for regenerated pages and only prints a lag notice). The body has four H2s with these exact titles — the HTML warning-badge anchors depend on them:

- `## Dead code`: confirmed entries, plus `### Suspected (dynamic-reference traces, needs human confirmation)`
- `## Circular dependencies`: each cycle with its full path
- `## Hotspots`: top-10 table (file, 12-month change count, lines)
- `## Broken references`: dangling references and parse failures, each pointing back to a file

Every fact gets one plain-language interpretation; if a command category couldn't run, that section says "not run (reason)". Link health.md into index.md navigation.

## Node badges

Map health.md entries to data.json nodes by file ownership (module-page covers): matched nodes get a `health` array with values `dead`/`cycles`/`hotspot`/`breaks` (matching the four sections above). Also fill the top-level `health` count object in data.json (files=source file count, dead/suspects/deadExports/cycles/breaks=entry counts from tool output); the template renders the score ring and improvement hints from it — the (density-based) scoring formula is fixed in the template, never hand-filled. The template renders rooftop and sidebar warning badges from the node fields; clicking jumps to the matching health.md section. Nodes and repos without health fields show no health traces at all. After changing health.md or health fields, re-render the HTML.
