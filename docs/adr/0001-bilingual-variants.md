# 双语变体：中文为源，英文为同步译本

skill 以两个自包含目录发布（`skills/architecture-wiki` 中文、`skills/architecture-wiki-en` 英文）——安装是整目录复制，无法共享文件。漂移风险按内容分工消解：文档是人工译文、模板与脚本是逐字节机械副本（`scripts/sync-variants.sh` 同步并校验）、界面文案在单一模板内由 `meta.lang` 词表切换。中文目录是唯一编辑点。曾考虑只发中文（agent 双语，能执行中文 skill），但生成页面的界面直接面向人类读者，界面语言值得两份。
