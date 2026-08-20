<div align="center">

# Architecture Wiki

**让 ARCHITECTURE.md 退休：代码一变立刻发现，架构咋能这么清晰？**

[English](./README.md) · [在线 Demo](https://suge8.github.io/architecture-wiki/demo/)

<img src="docs/assets/hero.png" width="92%" alt="Architecture Wiki 渲染的等距城市：分区、模块建筑、运行流连线、体检评分与 wiki 面板">

</div>

装上这个 skill，你的 agent 会为仓库建立并持续维护 `docs/architecture/`：

- **人**：打开网页，清晰架构地图、可播放的调用链、模块介绍、代码库体检报告，不用再啃 MD 文档。
- **AI**：每条论断都带来源文件、内容哈希和锚定符号，一读就懂项目情况。
- **仓库**：代码变了，`verify.mjs` 指出哪一页过期并打印对应 diff，同步不靠自觉。

<div align="center">
<img src="docs/assets/demo.gif" width="92%" alt="演示：场景播放逐拍点亮调用链，体检报告展示评分与死代码清单">
</div>

## 体检

建档时全仓体检：无引用的死文件、循环依赖、大又常改的高危文件、断掉的 import，一次查清。工具的每条发现都复核过才进报告，不拿误报吓人；问题模块在地图上警示，点击直达报告。

<div align="center">
<img src="docs/assets/health.png" width="92%" alt="体检报告：评分环与优化建议、死代码防误报复核、循环依赖分析">
</div>

## 如何实现

Wiki 代码引用了文件、点名了函数，都记着 **内容指纹**，文件一改就会被查出来。网页只是渲染壳，壳随时重建。判断 Wiki 过期的不是 AI 的自觉，而是一个零依赖小脚本（node + git）。

## 安装

将以下粘贴发送给 Agent：

```text
Install the skills from https://github.com/Suge8/architecture-wiki
```

## 使用

skill 为显式调用设计（重工作流，不自动触发）。对 agent 说：

```text
用 architecture-wiki 给这个仓库建架构 wiki
```

代码演进后，或 CI 里 verify 报错时：

```text
用 architecture-wiki 同步架构 wiki
```

需要 Node.js 18+ 与 git；JS/TS 仓库的依赖图另需 bun 或 npm。

## 语言支持

| 语言          | 依赖图                          | 状态       |
| ------------- | ------------------------------- | ---------- |
| JS / TS       | 内置 oxc code-map               | 实战验证   |
| Go            | `go list -json`                 | 命令表支持 |
| Rust          | `cargo metadata`                | 命令表支持 |
| Java / Kotlin | `jdeps`                         | 命令表支持 |
| 其他          | agent 读码提取，verify 把关出处 | 降级路径   |

## 语言

中英双语变体同仓发布：安装时 agent 按对话语言自动选择，生成页面的界面语言随之切换（[ADR 0001](docs/adr/0001-bilingual-variants.md)）。

## License

[Apache-2.0](./LICENSE)，内联的 [Phosphor Icons](https://phosphoricons.com) 为 MIT（见 [NOTICE](./NOTICE)）。
