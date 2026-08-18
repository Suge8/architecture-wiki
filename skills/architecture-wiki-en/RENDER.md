# Architecture HTML render spec

Rendering is template-driven so any repo, any agent produces a near-identical interface: copy [templates/architecture.html](./templates/architecture.html), replace `__ARCH_DATA__` with the data JSON, `__TITLE__` with the title, `__WIKI_DIGEST__` with the output of `node docs/architecture/verify.mjs --digest`, and write `docs/architecture/architecture.html`; also save the data JSON as `docs/architecture/data.json` (a derived artifact, updated with every render, for incremental tweaks and diffs). The visual language is entirely fixed in the template: warm-paper single theme (paper background + ink-green accent, sage/terracotta/mist-blue districts), isometric city, overview/multi-scenario switching with white light streaks, node focus showing its cross-scenario data flow, sidebar group folding and filtering, both side panels collapsible, pan and zoom; health-flagged nodes carry warning badges (rooftop and sidebar) that jump to the matching health page section. To change visuals, change the template — never customize per repo.

**Zero hand-written claims**: every statement about the codebase in the HTML is either embedded wiki page text rendered directly, or deterministically derived from graph data (upstream/downstream, scenario participation, district/module/file counts and line totals). The data JSON contains no independently written feature/mechanism prose and no UI usage instructions (interaction is self-explanatory). If content isn't good enough, fix the wiki page — never pad the JSON.

## Data JSON

```jsonc
{
  "meta": {
    "title": "repo name",
    "lang": "en",   // REQUIRED for this English skill: switches the interface wordlist; omitting it renders a Chinese UI
    "headline": "Cross-device clipboard sync service",   // one plain sentence saying what the system IS; describe the system, not the page — self-references like "architecture map/docs" never go in the headline
    "logo": "<svg class=\"logo\" style=\"fill:currentColor\" ...>",  // optional; actively look for the repo's own logo (favicon, svgs under public//assets//docs/, the image referenced at the top of the README), inline it if found (strip style, use currentColor), leave empty if none — never invent one; the page favicon derives from this field automatically, no separate config
    "repoUrl": "https://github.com/x/y/blob/main",                  // optional; with it sources become links, without it clicking copies the path
    "stats": [["Lang", "Go · TS"], ["Lines", "46k", "total source lines (measured by code-map)"], ["Entries", "4", "doors where the outside triggers the system: HTTP, CLI, cron…"]],  // all real numbers; scale signals (lines/source files) first; optional third element is a hover tooltip in plain language
    "sources": ["docs/architecture/wiki/system.md"]
  },
  "wiki": {                                   // all wiki pages embedded verbatim (frontmatter included), keyed by wiki/-relative path
    "index.md": "…", "system.md": "…", "data-flow.md": "…", "modules/auth.md": "…"
  },
  "health": { "files": 163, "dead": 2, "suspects": 5, "deadExports": 184, "cycles": 0, "breaks": 0 },  // optional; all counts from tool output (see HEALTH.md), files = source file count for density scoring; the formula is fixed in the template, never hand-filled
  "files": { "src/a.ts": 245, "src/b.ts": 88 },   // optional; full map of source file → line count (straight from code-map loc). The panel expands module-page covers into a Scope section with line totals, shown separately from Key sources; granularity is the page — buildings sharing a page share the scope, district totals dedupe by file
  "districts": [   // process/deployment boundaries; warm low-saturation colors auto-assigned in order, override with tint
    { "id": "go", "label": "GO CONTROL PLANE", "icon": "grid", "r": [1, 2, 3, 4],
      "page": "system.md#control-plane" }   // page optional: districts are selectable, panel renders that section; omit to show only graph-derived module lists and cross-district traffic
  ],
  "nodes": [
    { "code": "G2", "district": "go", "name": "auth domain", "short": "auth",  // code is the map door-plate: district initial + number, no invented abbreviations; short must fit the ground name plate, usually one word (long names make neighboring plates collide)
      "icon": "lock", "form": "box", "x": 6.4, "y": 7.4, "h": 0.8,       // required: code/district/name/x/y; optional: w/d default 1.1, h default 0.8
      "count": 12,                                                        // group nodes (slabs) only: member count
      "page": "modules/auth.md",                                          // the Intro tab renders this page; may carry a #section anchor; multiple nodes may point to different anchors of one page
      "sources": ["src/auth/token.ts"],
      "health": ["hotspot"] }                                             // optional; health categories dead/cycles/hotspot/breaks, mapped from health.md entries per HEALTH.md; omit when clean
  ],
  "links": [   // static structural relations (code dependencies, not necessarily runtime data flow): cover all module-level dependencies after code-map aggregation, multiple file-level imports merge into one edge; rendered as thin dashed lines (legend bottom-right distinguishes them from solid runtime arrows), hover shows label
    { "from": "A", "to": "B", "label": "caption", "what": "optional detail", "via": [[1, 2]] }
  ],
  "flows": [   // multi-scenario runtime flows: at least one per real entry point (HTTP API, CLI, queue consumer, cron…), similar entries may merge; step count follows the real call chain — one flow tells one complete story, if it doesn't fit a screen ask whether it's two stories; floating top tabs switch scenarios, clicking a tab renders the data-flow.md section from page
    { "title": "Place an order", "page": "data-flow.md#place-an-order-http", "steps": [
      { "from": "A", "to": "B", "title": "step name", "what": "what happens in this step",
        "sources": ["src/call-site.ts"], "via": [],   // sources required: the call-site evidence for this step
        "par": true }   // optional: happens simultaneously with the previous step; playback lights them in one beat. Mark only true parallelism (concurrent spawns, fan-out broadcasts) — marking sequential steps erases their ordering
    ] }
  ]
}
```

Every flow must correspond to an end-to-end path already written in data-flow.md; every step must have a real call site — steps without one must not be drawn. Every node must be touched by at least one link or flow — an isolated node either gets its real relation added, joins a group node, or shouldn't be a building at all (verify hard-checks this).

Icon names come from the template's built-in symbol set (`ic-*`, inlined Phosphor Icons regular, MIT): globe, sliders, gateway, lock, user, card, calendar, target, shield, cube, coin, book, bridge, grid, users, chat, layers, file, cpu, server, wrench, plug, db, bolt, folder, sparkle, bell; pick the closest by meaning. To extend the set, inline new symbols from Phosphor at the same weight (keep viewBox 256 and stroke-width 20) — never reference external resources; single-file self-containment is a hard constraint.

## Form semantics

- `box` ordinary domain; `tall` (h 1.6–1.8) orchestrators, gateways and other key hubs; `stack` databases; `cylinder` caches/object storage; `slabs` (w 1.9 + count) groups of similar modules; `external` systems outside the repo (dashed box: positions it as an external dependency, no page/covers, line count naturally zero, the panel counts it as "external system" not module). External nodes' name says what it concretely is ("model API", not "external").
- Ground name plates (icon + code + short) sit in front of buildings and auto-avoid overlaps; full names live in the sidebar and panel. Building count follows module-page granularity; density is backstopped by verify's geometry red lines (overcrowding errors out). Modules that don't fit become group nodes with honest counts; one wiki page may map to several buildings (facets of one domain), several pages may map to anchors of one building.

## Layout geometry (isometric constraints)

- Ground coordinates: x runs down-right, y runs down-left. At footprint 1.1, **column gap ≥ 2.6, row gap ≥ 2.4** — closer and buildings overlap in isometric projection, plates collide. verify hard-checks slightly looser red lines (xgap ≥ 1.3 or ygap ≥ 1.1), exit 1 on violation.
- District rectangles must not overlap, with ≥ 1.5 cells of corridor between them (verify hard-checks); nodes must sit inside their district rectangle (verify hard-checks). Keep the composition near-square (aspect ≤ 1.9), entries on the west, external vendors east, data south, main flow roughly west→east.
- **The main flow spreads along increasing x, staying in one y band**; never let a district grow in x and y simultaneously — in isometric projection that stacks a diagonal, forcing long slanted crossing edges. Side domains (support, tooling, external) go north and south of the main band.
- `via` waypoints route edges through district corridors and row/column gaps, never through building footprints; the template clips line ends to building edges, and parallel edges between the same pair auto-offset.

## Completion check

`node docs/architecture/verify.mjs` passing = done — data-side problems (graph integrity, geometry red lines, building collisions, claim reconciliation, health field validity) are all hard-checked; per-repo output needs no browser validation.

## Template maintenance (only when changing templates/architecture.html)

Run `node scripts/render-smoke.mjs` first (path relative to this skill's directory, needs local Chrome): it injects minimal data and truly renders headless in both languages, catching script-crash regressions — syntax checks can't see runtime initialization errors. The smoke only guarantees "alive"; interface behavior is a template invariant, still walk it in a browser: scenario playback and stepping, node focus and panel anchor jumps, edge handle collapse/expand, group folding and filtering, warning badge jumps, pan/zoom and reduced-motion; at narrow viewports (≤820px) verify drawer slide and two-finger pinch.
