# 语言 → 确定性命令表

取事实优先用仓库自己的工具链——它把解析和语义两步都做对了，比任何通用解析器权威。表外语言降级为读码提取关系并逐条引用文件，且在 system.md 注明依赖图为人工提取。

## 依赖图（首建步骤 1）

| 语言 | 命令 | 说明 |
| --- | --- | --- |
| JS/TS | `bun scripts/code-map.mjs <repo-root> [前缀...]`（路径相对本 skill 目录） | oxc 解析 + tsconfig paths；`error`/`unresolved` 字段是断点事实 |
| Go | `go list -json ./...` | Imports/Deps 字段即边 |
| Rust | `cargo metadata --format-version 1` | crate 级依赖图 |
| Java/Kotlin | `jdeps -verbose:class <jar 或 classes>` | JDK 自带 |

**入口对账**：零入度文件/包（没有任何仓内导入者）是入口候选，逐个裁决——真实入口（HTTP、CLI、定时、队列消费者）必须在 data-flow.md 有端到端路径；非入口（脚本、类型声明、配置载体）无需记录。

## 死代码 / 循环依赖（体检步骤，用法见 [HEALTH.md](./HEALTH.md)）

| 语言 | 命令 |
| --- | --- |
| JS/TS | `npx -y knip@5 --reporter json --include files,exports,cycles` |
| Go | `go run golang.org/x/tools/cmd/deadcode@latest ./...` |
| Rust | `cargo +nightly udeps`（未用依赖；死代码由编译器 dead_code 告警承担） |
| Python | `vulture .`（需 pip 安装，先询问用户） |

命令不可用（工具装不上、跑失败）时对应体检小节缺失并注明原因，不阻塞流程。
