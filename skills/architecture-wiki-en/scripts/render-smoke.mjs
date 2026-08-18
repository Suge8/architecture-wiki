#!/usr/bin/env node
// 模板烟测：注入最小数据用无头 Chrome 真实渲染，中英各跑一轮，只回答「脚本有没有半路崩掉、词表有没有生效」。
// 语法检查抓不到运行时初始化错误（如 TDZ），必须真跑；好不好看仍靠 RENDER.md 的人工交互清单。
// 用法：node render-smoke.mjs [模板路径]（默认本 skill 的 templates/architecture.html）
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const tplPath = process.argv[2] ||
  join(dirname(fileURLToPath(import.meta.url)), "../templates/architecture.html");

const baseData = lang => ({
  meta: { title: "烟测", headline: lang === "en" ? "Smoke system" : "烟测系统", lang,
    stats: [[lang === "en" ? "Lines" : "行数", "1k"]],
    logo: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="">' },
  health: { files: 100, dead: 2, suspects: 3, deadExports: 10, cycles: 0, breaks: 0 },
  wiki: { "index.md": "# 索引", "system.md": "# 系统", "health.md": "# 体检\n正文" },
  districts: [{ id: "a", label: "分区A", icon: "cube", r: [0, 0, 8, 6] }],
  nodes: [
    { code: "N1", district: "a", name: "节点一", short: "节一", icon: "lock", x: 1, y: 1 },
    { code: "N2", district: "a", name: "节点二", short: "节二", icon: "db", x: 4.5, y: 3.5 },
  ],
  links: [{ from: "N1", to: "N2", label: "依赖" }],
  flows: [{ title: "烟测流", steps: [{ from: "N1", to: "N2", title: "调用", what: "冒烟", sources: ["src/a.ts"] }] }],
});

const chrome = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].filter(Boolean).find(existsSync);
if (!chrome) { console.error("烟测失败：未找到 Chrome（可用环境变量 CHROME 指定路径）"); process.exit(1); }

// 每个断言对应一条独立渲染管线：导航/建筑、体检按钮与分数、分区名牌、场景条、面板首屏、logo 派生的 favicon、UI 词表
const runs = [
  { lang: "zh", musts: ['data-code="N1"', 'id="btnHealth"', 'class="score">', "分区A", 'data-f="0"', "烟测系统", 'rel="icon"', ">总览<"] },
  { lang: "en", musts: ['data-code="N1"', 'id="btnHealth"', 'class="score">', "分区A", 'data-f="0"', "Smoke system", 'rel="icon"', ">Overview<", "Health report"] },
];
let failed = false;
for (const { lang, musts } of runs) {
  const page = join(tmpdir(), `arch-wiki-smoke-${lang}.html`);
  writeFileSync(page, readFileSync(tplPath, "utf8")
    .replace("__ARCH_DATA__", JSON.stringify(baseData(lang)))
    .replace("__TITLE__", "smoke").replace("__WIKI_DIGEST__", "smoke"));
  const r = spawnSync(chrome, ["--headless", "--disable-gpu", "--dump-dom",
    "--enable-logging=stderr", "--virtual-time-budget=2000", "file://" + page], { encoding: "utf8" });
  const dom = (r.stdout || "").replace(/<script>[\s\S]*?<\/script>/g, "");
  const uncaught = ((r.stderr || "").match(/"Uncaught[^\n]*/g) || []);
  const missing = musts.filter((m) => !dom.includes(m));
  for (const e of uncaught) console.error(`[${lang}] 控制台错误：` + e);
  for (const m of missing) console.error(`[${lang}] DOM 缺失：` + m);
  if (missing.length || uncaught.length) failed = true;
}
if (failed) process.exit(1);
console.log("烟测通过：中英两轮渲染完整，无未捕获错误");
