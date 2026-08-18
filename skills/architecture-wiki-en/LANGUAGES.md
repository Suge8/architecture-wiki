# Language → deterministic command table

Prefer the repo's own toolchain for facts — it gets both parsing and semantics right, more authoritative than any generic parser. Languages outside the table degrade to reading code and extracting relations with per-file citations, noted in system.md as a manually extracted graph.

## Dependency graph (first-build step 1)

| Language | Command | Notes |
| --- | --- | --- |
| JS/TS | `bun scripts/code-map.mjs <repo-root> [prefix...]` (path relative to this skill's directory) | oxc parsing + tsconfig paths; `error`/`unresolved` fields are breakage facts |
| Go | `go list -json ./...` | Imports/Deps fields are the edges |
| Rust | `cargo metadata --format-version 1` | crate-level dependency graph |
| Java/Kotlin | `jdeps -verbose:class <jar or classes>` | ships with the JDK |

**Entry reconciliation**: zero-in-degree files/packages (nothing in the repo imports them) are entry candidates — adjudicate each one. Real entries (HTTP, CLI, cron, queue consumers) must have an end-to-end path in data-flow.md; non-entries (scripts, type declarations, config carriers) need no record.

## Dead code / dependency cycles (health step, usage in [HEALTH.md](./HEALTH.md))

| Language | Command |
| --- | --- |
| JS/TS | `npx -y knip@5 --reporter json --include files,exports,cycles` |
| Go | `go run golang.org/x/tools/cmd/deadcode@latest ./...` |
| Rust | `cargo +nightly udeps` (unused deps; dead code is covered by the compiler's dead_code warnings) |
| Python | `vulture .` (needs pip install — ask the user first) |

When a command is unavailable (tool won't install, run fails), the corresponding health section is omitted with the reason noted; never block the workflow.
