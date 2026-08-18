# Agents Guide

本仓库是 architecture-wiki skill 的事实源，含两个语言变体 / This repo ships two language variants of the architecture-wiki skill:

- `skills/architecture-wiki/` — 中文版（源 / source）
- `skills/architecture-wiki-en/` — English variant (translated docs; templates and scripts are byte-identical copies)

## Install

只装一个变体，跟随用户与你对话的语言：中文对话装 `skills/architecture-wiki/`，英文装 `skills/architecture-wiki-en/`；判断不了才问一句。整目录复制进 agent 的 skills 目录（如 `~/.agents/skills/` 或 `~/.claude/skills/`），无构建步骤。

Install exactly one variant, matching the language the user speaks to you: Chinese conversation → `skills/architecture-wiki/`, English → `skills/architecture-wiki-en/`; ask only when you can't tell. Copy the whole directory into the agent's skills folder (e.g. `~/.agents/skills/` or `~/.claude/skills/`); no build step.

## Contributing

中文目录是唯一编辑点：skill 文档先改中文、再同步英文译文；templates/scripts 只改中文目录，改完跑 `scripts/sync-variants.sh` 刷新英文侧机械副本（脚本自带逐字节校验）。改模板后先跑 `skills/architecture-wiki/scripts/render-smoke.mjs`（中英双语烟测），再按 RENDER.md 的人工清单过交互。决策记录在 `docs/adr/`。
