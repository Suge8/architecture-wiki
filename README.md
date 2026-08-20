<div align="center">

# Architecture Wiki

**Retire your ARCHITECTURE.md: code changes surface instantly — how did architecture get this clear?**

[中文](./README.zh-CN.md) · [Live Demo (Chinese)](https://suge8.github.io/architecture-wiki/demo/)

<img src="docs/assets/hero.png" width="92%" alt="Isometric city rendered by Architecture Wiki: districts, module buildings, runtime flows, health score and wiki panel">

</div>

Install this skill and your agent builds and maintains `docs/architecture/` for any repo:

- **Humans**: open a webpage for a clear architecture map, playable call chains, module pages and a codebase health report — no more digging through MD files.
- **AI**: every claim carries source files, content hashes and anchored symbols, so it understands the project on first read.
- **The repo**: when code changes, `verify.mjs` names the stale page and shows the diff — syncing doesn't rely on discipline.

<div align="center">
<img src="docs/assets/demo.gif" width="92%" alt="Demo: scenario playback lights up call chains beat by beat; the health report shows score and dead-code findings">
</div>

## Health check

Building the wiki runs a full-repo checkup: unreferenced dead files, dependency cycles, big files that change all the time, broken imports — found in one pass. Every tool finding is reviewed before it enters the report, so false positives don't cry wolf. Troubled modules are flagged on the map; click through to the report.

<div align="center">
<img src="docs/assets/health.png" width="92%" alt="Health report: score gauge with improvement hints, dead-code review reasoning, cycle analysis">
</div>

## How it works

Wherever the wiki cites a file or names a function, it records a **content fingerprint** — change the file and it gets caught. The webpage is just a rendering shell, rebuildable anytime. Staleness isn't judged by the AI's discipline but by a tiny zero-dependency script (node + git).

## Install

Paste this to your agent:

```text
Install the skills from https://github.com/Suge8/architecture-wiki
```

## Usage

The skill is invoked explicitly (a heavyweight workflow, not auto-triggered). Tell your agent:

```text
Use architecture-wiki to build an architecture wiki for this repo
```

After code evolves, or when verify fails in CI:

```text
Use architecture-wiki to sync the architecture wiki
```

Requires Node.js 18+ and git; JS/TS dependency graphs additionally need bun or npm.

## Language support

| Language      | Dependency graph                        | Status                |
| ------------- | --------------------------------------- | --------------------- |
| JS / TS       | built-in oxc code-map                   | battle-tested         |
| Go            | `go list -json`                         | command-table support |
| Rust          | `cargo metadata`                        | command-table support |
| Java / Kotlin | `jdeps`                                 | command-table support |
| Others        | agent reads code, verify guards sources | fallback path         |

## Language

Chinese and English variants both ship in this repo; the installing agent picks one by conversation language, and the generated pages follow ([ADR 0001](docs/adr/0001-bilingual-variants.md)).

## License

[Apache-2.0](./LICENSE); inlined [Phosphor Icons](https://phosphoricons.com) are MIT (see [NOTICE](./NOTICE)).
