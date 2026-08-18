# Architecture HTML 渲染规范

渲染是模板驱动的，保证任何仓库、任何 agent 产出几乎一致的界面：复制 [templates/architecture.html](./templates/architecture.html)，把 `__ARCH_DATA__` 替换为数据 JSON、`__TITLE__` 替换为标题、`__WIKI_DIGEST__` 替换为 `node docs/architecture/verify.mjs --digest` 的输出，写入 `docs/architecture/architecture.html`；数据 JSON 同时存为 `docs/architecture/data.json`（派生产物，随渲染更新，供增量微调与 diff）。视觉语言全部固化在模板里：森纸单主题（暖纸底 + 墨绿主色，分区鼠尾草绿/陶土/雾蓝）、等距城市、总览/多场景切换与白色流光、节点聚焦显示其跨场景数据流、侧边栏分组折叠与过滤、左右两栏整体可收起、平移缩放；体检命中的节点带警示标（楼顶与侧边栏），点击跳体检页对应小节。要改视觉改模板，不逐仓库定制。

**零手写论断**：HTML 中关于代码库的每一句话，要么是嵌入的 wiki 页原文直接渲染，要么由图数据确定性派生（上下游、参与场景、分区/模块/文件的计数与行数）。数据 JSON 里不出现独立撰写的功能/原理文字，也不写界面使用说明（交互靠界面自解释）。内容不够好去改 wiki 页，不在 JSON 里补写。

## 数据 JSON

```jsonc
{
  "meta": {
    "title": "仓库名",
    "lang": "zh",   // 可选；界面词表开关，缺省中文；英文版 skill（architecture-wiki-en）必填 "en"
    "headline": "跨端剪贴板同步服务",   // 面板首屏标题：一句人话说这个系统是什么；说系统不说页面，「架构图/地图/文档」这类界面自述不进标题
    "logo": "<svg class=\"logo\" style=\"fill:currentColor\" ...>",  // 可选；主动找仓库自带 logo（favicon、public//assets//docs/ 里的 svg、README 顶部引用的图），找到就内联（去 style、改 currentColor），没有则留空不自造；页面 favicon 由模板从此字段自动派生，不另配
    "repoUrl": "https://github.com/x/y/blob/main",                  // 可选；有则出处变跳转链接，无则点击复制路径
    "stats": [["语言", "Go · TS"], ["行数", "4.6 万", "源码总行数（code-map 实测）"], ["入口", "4", "外部触发系统的门：HTTP、CLI、定时…"]],  // 全部真实数字；行数/源文件等规模信号优先，第三元素可选，hover 提示一句人话解释
    "sources": ["docs/architecture/wiki/system.md"]
  },
  "wiki": {                                   // 全部 wiki 页原文嵌入（含 frontmatter），键为 wiki/ 相对路径
    "index.md": "…", "system.md": "…", "data-flow.md": "…", "modules/auth.md": "…"
  },
  "health": { "files": 163, "dead": 2, "suspects": 5, "deadExports": 184, "cycles": 0, "breaks": 0 },  // 可选；体检计数全部取自工具输出（见 HEALTH.md），files 为源文件数供密度化评分；公式固化在模板，不手填分数
  "files": { "src/a.ts": 245, "src/b.ts": 88 },   // 可选；全量源文件 → 行数（直接取 code-map 的 loc）。面板据此把模块页 covers 展开成「范围」并统计行数，与「关键出处」（sources）分开展示；粒度是页，同页的多栋楼共享同一范围，分区统计按文件去重
  "districts": [   // 进程/部署边界；按序自动分配暖调低饱和色，可用 tint 覆盖
    { "id": "go", "label": "GO 控制面", "icon": "grid", "r": [1, 2, 3, 4],
      "page": "system.md#控制面" }   // page 可选：分区可点选，面板渲染该小节；不填则只显示图数据派生的区内模块与跨区往来
  ],
  "nodes": [
    { "code": "G2", "district": "go", "name": "auth 域", "short": "认证",  // code 是图上门牌：分区首字母+序号，不自造缩写；short 要能放进地面名牌，一般 2–4 字、最多 6 字（再长相邻名牌会互相挤压）
      "icon": "lock", "form": "box", "x": 6.4, "y": 7.4, "h": 0.8,       // 必填：code/district/name/x/y；可省：w/d 默认 1.1、h 默认 0.8
      "count": 12,                                                        // 仅群组节点（slabs）标数量
      "page": "modules/auth.md",                                          // 面板「介绍」tab 渲染此页；可带 #小节标题 锚点；多节点可指同一页不同锚点
      "sources": ["src/auth/token.ts"],
      "health": ["hotspot"] }                                             // 可选；体检命中类别 dead/cycles/hotspot/breaks，按 HEALTH.md 从 health.md 条目映射，未命中不写
  ],
  "links": [   // 静态结构关系（代码上的依赖，未必有运行时数据流）：覆盖 code-map 聚合后的全部模块级依赖，多条文件级 import 合并为一条；渲染为细虚线（与实线箭头的运行流区分，画布右下角有图例），hover 显示 label
    { "from": "A", "to": "B", "label": "说明", "what": "可选详情", "via": [[1, 2]] }
  ],
  "flows": [   // 多场景运行流：每个真实入口（HTTP API、CLI、队列消费者、定时任务…）至少一条，同类入口可合并；步数由真实调用链决定——一条流程讲一件完整的事，长到一屏看不完先想想是不是两件事；顶部悬浮 tab 切换，点 tab 时面板渲染 page 指向的 data-flow.md 小节
    { "title": "用户下单", "page": "data-flow.md#用户下单（HTTP）", "steps": [
      { "from": "A", "to": "B", "title": "步骤名", "what": "这一步发生了什么",
        "sources": ["src/call-site.ts"], "via": [],   // sources 必填：这一步的调用点证据
        "par": true }   // 可选：与上一步同时发生，播放时同一拍一起点亮。只标真并行（并发 spawn、扇出广播）；顺序执行标了会把先后关系抹掉
    ] }
  ]
}
```

每条 flow 必须对应 data-flow.md 已写的端到端路径；每个步骤必须有真实调用点，找不到调用点的步骤不得画入。每个节点至少被一条 link 或 flow 触及——孤立节点要么补上真实关系，要么并入群组，要么不该单独成楼（verify 会硬性检查）。

图标名取自模板内置 symbol 集（`ic-*`，内联的 Phosphor Icons regular，MIT）：globe、sliders、gateway、lock、user、card、calendar、target、shield、cube、coin、book、bridge、grid、users、chat、layers、file、cpu、server、wrench、plug、db、bolt、folder、sparkle、bell；按语义选最近的。要扩图标集就从 Phosphor 同一 weight 取新 symbol 内联进模板（保持 viewBox 256 与 stroke-width 20），不引外部资源——单文件自包含是硬约束。

## 形态语义

- `box` 普通域；`tall`（h 1.6–1.8）编排者、闸口等关键枢纽；`stack` 数据库；`cylinder` 缓存/对象存储；`slabs`（w 1.9 + count）同类模块群；`external` 仓库之外的系统（虚线盒：定位它是外部依赖，不写 page/covers，行数天然为零，面板会单独计为“外部系统”而不计入模块数）。外部节点的 name 要写具体是什么（“模型 API”而不是“外部”）。
- 地面名牌（icon + code + short）自动放在建筑前方并避让重叠；全名在侧边栏和面板。楼数由模块页粒度自然决定，密度由 verify 几何红线兜底（挤不下会直接报错）；装不下的模块进群组节点如实计数，一个 wiki 页可对应多栋楼（同一职责域的不同侧面），多个 wiki 页也可映射到同一栋楼的不同锚点。

## 布局几何（等距投影约束）

- 地面坐标系：x 向右下，y 向左下。footprint 1.1 时**列距 ≥ 2.6、行距 ≥ 2.4**，否则等距投影下相邻建筑互相重叠、名牌挤压。verify 以略宽松的红线硬性把关（xgap ≥ 1.3 或 ygap ≥ 1.1），不过关 exit 1。
- 分区矩形互不重叠，之间留 ≥ 1.5 格通道（verify 硬检）；节点必须落在所属分区矩形内（verify 硬检）。构图尽量方（宽高比 ≤ 1.9），入口区放西侧，外部供应商放东侧，数据放南侧，主流程大致自西向东。
- **主流程沿 x 递增铺开，y 保持在同一条带内**；分区切忌 x、y 同时递增——那在等距投影下会堆成对角线，跨区连线必然长距离斜穿、互相交叉。副线域（支撑、工具、外部）放主带南北两侧。
- `via` 航点让连线走分区间通道和行/列间隙，不穿建筑 footprint；模板会把线端裁到建筑边缘，同对节点的平行边自动错道。

## 完成检查

`node docs/architecture/verify.mjs` 通过即完成——数据侧问题（图完整性、几何红线、穿楼、认领对账、健康字段合法性）全部由 verify 硬检，逐仓库产出不需要浏览器验证。

## 模板维护（仅改 templates/architecture.html 时）

改完先跑 `node scripts/render-smoke.mjs`（路径相对本 skill 目录，需本机 Chrome）：注入最小数据无头真渲染，专抓脚本半路崩掉类回归——语法检查测不到运行时初始化错误，必须真跑。烟测只保证「活着」，界面行为是模板不变量，仍需浏览器过一遍：场景播放与单步、节点聚焦与面板锚点跳转、边缘把手收起展开、分组折叠与过滤、警示标点击跳转、平移缩放与 reduced-motion；窄屏视口（≤820px）验抽屉滑入滑出与双指捿合。
