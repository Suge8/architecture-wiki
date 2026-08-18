# Fan-out: parallel page production

The reason to parallelize is context, not speed: a mid-sized repo's hundreds of files with imports/exports/line counts don't fit one session — an orchestrator that reads it all has no room left to write. On first build, split into a single orchestrator-worker wave: each worker carries only its one module's context; the orchestrator keeps the global view for reconciliation and the overview pages. Workers can't see each other; cross-module claims are yours to consolidate.

## Dispatch

Split modules by code-map output (granularity per SKILL.md: re-check any page over 20 files or 6000 lines — can its responsibility be stated in one sentence?), then give each worker a task card:

- Goal: produce one complete `docs/architecture/wiki/modules/<name>.md` with sources and covers frontmatter (covers = the assigned path scope) and the four fixed sections from SKILL.md (Responsibility, Public interface, How data flows, Change guide), written directly to that file.
- Prefilled facts: the module's file list with per-file imports/exports/loc summaries, sliced from code-map output into the card; the worker starts reading code from there, not from zero.
- Boundaries: read only assigned files plus their one-hop imports; write only your own page; page files never overlap.
- Output contract: every claim in the body points to a concrete file; every named symbol confirmed to exist in the cited file; every sources line's hash from an actual `git hash-object` run. At the end of the reply, a boundary report: files outside the assignment that have import relations with this module (file + one-line relation), or "none"; the report is not written into the page.

Task cards don't mention rendering, lint or later steps. All workers launch in one wave with no inter-task dependencies; worker models are the orchestrator's tier or one below.

## Consolidation

After all workers return, you do the rest:

1. Reconcile: first digest boundary reports — unassigned files get added to some page's covers or a new page; then check each page — claimed dependencies and exports match the code-map edges, every claim points to a file, depth carries the Responsibility section. Any failing page goes to a fresh worker for rewrite, with the original card, the page, and the specific defects attached.
2. Write index.md, system.md and data-flow.md yourself — cross-module claims need the global view; having reconciled all module pages, you can write directly.
3. Return to SKILL.md step 3 for the health check and step 4 for verify; error pages also go to fresh workers (rework always goes to a new worker — finished workers get no follow-up messages). Consolidation is done when verify passes.
