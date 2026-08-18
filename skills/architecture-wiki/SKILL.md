---
name: architecture-wiki
disable-model-invocation: true
description: 在目标仓库建立并维护 docs/architecture/：Markdown wiki 事实源 + 自包含可视化 + verify 过期检查接入 lint/CI，附死代码/循环依赖/热点体检页。
compatibility: 需要 Node.js 18+ 与 git；JS/TS 仓库的依赖图另需 bun 或 npm。
---

# Architecture Wiki

代码是事实源，wiki 是持续维护的压缩理解，HTML 是派生的可视化界面。三条边界定死：

- wiki 只写有出处的事实：每页 frontmatter 记录来源文件与内容哈希。
- architecture.html 永远可删可重建，只从 wiki 渲染，不承载独立知识。
- 过期判断交给确定性脚本 verify.mjs；LLM 只负责理解与更新内容，程序负责判断是否需要更新。

全语言适用：verify 只依赖 git 哈希与文本检查。依赖图优先用语言自己的工具链（[LANGUAGES.md](./LANGUAGES.md) 命令表：JS/TS 用本 skill 的 oxc code-map，Go/Rust/Java 用官方命令）；表外语言由你读码提取关系并逐条引用文件，verify 仍确定性把关来源。

## 目标仓库布局

```
docs/architecture/
├── architecture.html   # 派生可视化，嵌 wiki-digest
├── verify.mjs          # 从本 skill templates/ 复制，零依赖
└── wiki/
    ├── index.md        # 导航目录 + baseline commit + 豁免清单
    ├── system.md       # 系统总览：模块、职责、边界
    ├── data-flow.md    # 端到端数据流与 payload
    ├── health.md       # 体检再生页：死代码/循环/热点/断点
    └── modules/<name>.md
```

## Frontmatter 约定

每个 wiki 页：

```
---
sources:
  - src/auth/token.ts 8f3a21bc4d2e validateToken refreshToken
---
```

每行 `<仓库相对路径> <git blob 哈希前缀（≥8 位）> [关键 symbol...]`。sources 必须是文件不能是目录，挑支撑页面论断的关键文件而非穷举，控制误报面。哈希来自 `git hash-object <path>`，取前 12 位。symbol 是页面正文点名的函数/类型/路由名，verify 会检查它仍存在于该文件。index.md 额外一行 `baseline: <commit sha>`。

模块页另有 `covers:` 列表——认领的路径前缀（目录以 `/` 结尾）或单个文件。sources 是支撑论断的锚点（参与哈希漂移检查），covers 是责任田边界（参与认领对账），职责不同。index.md 可有 `exclude:` 列表（豁免清单，同前缀语法）；verify 内置常识豁免（点文件/点目录、lockfile、二进制资产、docs/architecture 自身），其余 `git ls-files` 里的每个文件必须被某页 covers 或 exclude 覆盖。体检页 health.md 是再生页：frontmatter 写 `generated:`（生成命令）与 `generated-at:`（生成时 commit），不写 sources。

verify 检查：来源文件存在且哈希一致（不一致时直接打印记录版本 → 工作区的 unified diff，未触及锚定 symbol 的标「疑似机械漂移」；记录的 blob 未入对象库时无 diff 可出，退回纯文件名报错）、symbol 仍在、认领对账（未认领文件与匹配不到文件的腐烂条目都报错）、页间相对链接可达、无孤儿页（除 index 外每页有入链）、HTML digest 与 wiki 正文一致（digest 只算正文，frontmatter 是维护簿记，纯刷哈希不影响 HTML）。再生页跳过来源检查，只在落后于 HEAD 时打印重跑提示（不计入失败）。任一失败退出码 1，报告列出具体页面和文件。

## 首次建立（仓库无 docs/architecture/ 时）

1. 取事实：按 [LANGUAGES.md](./LANGUAGES.md) 命令表取确定性依赖图（JS/TS 运行本 skill 的 code-map，oxc 依赖装在 scripts/ 目录里不碰目标仓库，缺失时直接在 scripts/ 下 `bun install`，无 bun 则 `npm install`，不需征求同意；表外语言读代码提取关系）。完成标准：接下来 wiki 里每个节点、每条边都能指回具体文件；依赖图的零入度文件逐个裁决过（真入口必有流程，见 LANGUAGES.md 入口对账）；运行流每一步都找到真实调用点（入口、RPC 定义、队列生产/消费点），找不到调用点的步骤不画。
2. 写 wiki：按上面布局，模块页一页一个职责域，按职责聚合不按文件铺开。

   **粒度**：单页认领超过 20 个文件或 6000 行就停下复查——这一页的职责能否用一句话说清？说不清就按子职责拆开。数字是复查信号，一句话说得清才是裁决标准；页数随规模自然增长（页多时 index.md 按子系统分组导航）。

   **模块页固定四节**：职责、对外接口、数据怎么流、改动指南。前两人话后两技术：职责与数据怎么流用人话写业务行为，非作者一读就懂，不出现代码标识符；文件名、函数名集中在对外接口与改动指南，写「auth 域只暴露 `validateToken`/`refreshToken`（`src/auth/token.ts`）」这种句子，坑写在改动指南。

   **data-flow.md 按入口铺全**：每个真实入口（HTTP API、CLI、队列消费者、定时任务…）至少一条端到端路径，写清入口 → 处理 → 存储与 payload 形态。

   frontmatter 按上面的约定填齐。完成标准：抽两页自测——读完能答「这模块负责什么、谁在用它、改它先看哪个文件」，答不上的页重写。模块页 ≥3 且 subagents 可用时，读 [FANOUT.md](./FANOUT.md) 并行派工，总览页自己写。
3. 体检：读 [HEALTH.md](./HEALTH.md)，跑命令、复核、产出 wiki/health.md 与节点 health 字段。
4. 复制 [templates/verify.mjs](./templates/verify.mjs) 到 `docs/architecture/verify.mjs`，运行一次直到通过。
5. 渲染 HTML：读 [RENDER.md](./RENDER.md)，用 templates/architecture.html 模板注入数据 JSON，不手写界面。完成标准：verify 通过（数据侧问题全由 verify 硬检，不需浏览器验证）。通过后 `open docs/architecture/architecture.html` 把成品打开给用户（仅首建；同步不自动打开）。
6. 接入 lint：在仓库现有检查入口（package.json scripts / justfile / Makefile / CI workflow）追加 `node docs/architecture/verify.mjs`，与现有 lint、typecheck 并列一起跑；不塞进 linter 插件内部。仓库 linter 扫全仓时把 `docs/architecture` 加进其忽略清单——派生产物与零依赖脚本不受项目代码风格约束，接入后跑一次完整检查确认不互咬。仓库完全没有检查入口时，新建最小入口只跑 verify（如 package.json 加 `"lint": "node docs/architecture/verify.mjs"`，或 CI 加一步）；verify 零依赖，只需 node + git。

## 同步（代码变更后，或 verify 报错时）

1. 跑 `node docs/architecture/verify.mjs`：过期来源会直接打印记录版本 → 工作区的 unified diff，标「疑似机械漂移」的可快速略过；无 diff 可出时（记录的 blob 未入对象库，如上次 sync 时改动尚未提交）退回 `git diff <baseline>.. -- <file>` 自查。
2. 按 diff 逐页二选一：页面论断受影响 → 改正文；确认不受影响（注释、格式、不改变论断的实现细节）→ 正文不动。新增文件被认领对账报出时，归入某页 covers 或说明理由进 exclude。verify 提示体检报告落后时，按 [HEALTH.md](./HEALTH.md) 重跑刷新 health.md 与节点标记。禁止未读 diff 就进入下一步——--sync 即签字“已审阅这些变更”。
3. `node docs/architecture/verify.mjs --sync`：一次性刷新全部过期哈希前缀并把 baseline 推进到当前 HEAD；symbol 消失、断链等语义问题不会被自动修，照常报错手工处理。
4. 改过正文才需重渲染 architecture.html（digest 只算正文，纯刷哈希不影响；digest 取 `node docs/architecture/verify.mjs --digest`）。跑 verify 通过后结束。
