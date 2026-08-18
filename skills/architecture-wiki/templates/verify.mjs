#!/usr/bin/env node
// Architecture wiki verifier. Zero deps; exits 1 on any stale/broken finding.
//
// Lives at docs/architecture/verify.mjs, next to wiki/ and architecture.html.
// Wiki page frontmatter:
//   ---
//   sources:
//     - src/auth.ts 8f3a21bc4d2e validateToken
//   covers:
//     - src/auth/
//   ---
// sources entry: <repo-relative-path> <git blob hash prefix (>=8)> [symbol...]
// covers entry: path prefix this page claims for the coverage ledger.
// index.md additionally: baseline: <commit sha>, plus optional exclude: list
// (ledger exemptions, same prefix syntax). Regenerated pages (health.md) carry
// generated: <command> and generated-at: <commit>; their sources are skipped —
// freshness is "re-run the command", signalled by a lag notice, not hash drift.
//
// Usage: node verify.mjs            # verify; stale sources print a unified diff, exit 0/1
//        node verify.mjs --digest   # print current wiki digest and exit
//        node verify.mjs --sync     # refresh stale hash prefixes + baseline, then verify
//
// Contract for --sync: read the diffs first, fix prose where a claim broke, then sync.
// It only rewrites bookkeeping (hash prefixes, baseline); semantic findings
// (missing symbols, broken links) still fail and must be fixed by hand.
// The digest covers page bodies only, so --sync never invalidates architecture.html.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wikiDir = join(here, "wiki");
const htmlPath = join(here, "architecture.html");
const repoRoot = git("rev-parse", "--show-toplevel").trim();
const errors = [];

function git(...args) {
  return execFileSync("git", args, { cwd: here, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function parsePage(path) {
  const text = readFileSync(path, "utf8");
  const rel = relative(wikiDir, path);
  const page = { path, rel, sources: [], covers: [], exclude: [], baseline: null, generated: null, generatedAt: null, body: text };
  if (!text.startsWith("---")) return page;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return page;
  page.body = text.slice(end + 4);
  let list = null;
  for (const line of text.slice(3, end).split("\n")) {
    const key = line.match(/^(sources|covers|exclude):\s*$/);
    if (key) { list = key[1]; continue; }
    const item = list && line.match(/^\s+-\s+(.+?)\s*$/);
    if (item) {
      if (list === "sources") {
        const s = item[1].match(/^(\S+)\s+(\S+)\s*(.*)$/);
        if (s) page.sources.push({ file: s[1], hash: s[2], symbols: s[3].split(/\s+/).filter(Boolean) });
        else errors.push(`${rel}: malformed sources entry: ${item[1]}`);
      } else {
        page[list].push(item[1]);
      }
      continue;
    }
    const kv = line.match(/^(baseline|generated|generated-at):\s*(.+?)\s*$/);
    if (kv) {
      if (kv[1] === "baseline") page.baseline = kv[2];
      else if (kv[1] === "generated") page.generated = kv[2];
      else page.generatedAt = kv[2];
    }
    if (/^\S/.test(line)) list = null;
  }
  return page;
}

function blobHashes(relPaths) {
  if (!relPaths.length) return new Map();
  const out = execFileSync("git", ["hash-object", "--stdin-paths"], {
    cwd: repoRoot, input: relPaths.join("\n"), encoding: "utf8",
  }).trim().split("\n");
  return new Map(relPaths.map((p, i) => [p, out[i]]));
}

let pages = walk(wikiDir).map(parsePage);

if (process.argv.includes("--sync")) {
  syncBookkeeping(pages);
  pages = walk(wikiDir).map(parsePage);
}

// Wiki digest: identity of the prose only (frontmatter is maintenance bookkeeping),
// embedded into the HTML at render time. Hash refreshes must not force a re-render.
const digest = createHash("sha256")
  .update(pages.map((p) => `${p.rel}\n${p.body}`).sort().join("\0"))
  .digest("hex").slice(0, 12);

/** Rewrite stale source hash prefixes in frontmatter and advance index.md baseline to HEAD. */
function syncBookkeeping(pages) {
  const files = [...new Set(pages.flatMap((p) => p.sources.map((s) => s.file)))]
    .filter((f) => existsSync(join(repoRoot, f)) && !statSync(join(repoRoot, f)).isDirectory());
  const current = blobHashes(files);
  const head = git("rev-parse", "HEAD").trim();
  for (const page of pages) {
    let text = readFileSync(page.path, "utf8");
    let changed = false;
    for (const src of page.sources) {
      const now = current.get(src.file);
      if (!now || now.startsWith(src.hash)) continue;
      text = text.replace(
        new RegExp(`(-\\s+${src.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+)${src.hash}`),
        `$1${now.slice(0, 12)}`,
      );
      changed = true;
    }
    if (page.rel === "index.md" && page.baseline && page.baseline !== head) {
      text = text.replace(/^baseline:.*$/m, `baseline: ${head}`);
      changed = true;
    }
    if (!changed) continue;
    writeFileSync(page.path, text);
    console.log(`synced: ${page.rel}`);
  }
}

/** Unified diff from the recorded blob to the working file; null when the blob is unavailable. */
function sourceDiff(src) {
  let old;
  try {
    old = git("cat-file", "-p", src.hash);
  } catch {
    return null; // recorded blob never committed; nothing to diff against
  }
  const tmp = join(tmpdir(), `wiki-verify-${process.pid}-${src.hash}`);
  writeFileSync(tmp, old);
  try {
    execFileSync("diff", ["-u", "--label", `${src.file}@${src.hash}`, "--label", src.file, tmp, join(repoRoot, src.file)], { encoding: "utf8" });
    return null; // identical content (hash drift from e.g. filters); nothing to show
  } catch (result) {
    return typeof result.stdout === "string" ? result.stdout : null;
  } finally {
    rmSync(tmp, { force: true });
  }
}

const DIFF_CAP = 120;

/** Render a capped diff, tagging pure mechanical drift (no anchored symbol touched). */
function describeDrift(src) {
  const diff = sourceDiff(src);
  if (!diff) return "";
  const lines = diff.trimEnd().split("\n");
  const changedLines = lines.filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const touched = src.symbols.some((sym) => changedLines.some((l) => l.includes(sym)));
  const note = src.symbols.length && !touched
    ? "\n    ⚠ 未触及锚定符号：疑似机械漂移，确认后 --sync 即可"
    : "";
  const body = lines.length > DIFF_CAP
    ? [...lines.slice(0, DIFF_CAP), `… 截断（共 ${lines.length} 行），余下回源码看`]
    : lines;
  return `${note}\n${body.map((l) => `    ${l}`).join("\n")}`;
}

if (process.argv.includes("--digest")) {
  console.log(digest);
  process.exit(0);
}

const notices = [];

// 1. Sources: file exists, hash matches, symbols still present.
// Regenerated pages are exempt — their freshness check is the lag notice below.
const HEALTH_HEADINGS = ["## 死代码", "## 循环依赖", "## 高危热点", "## 断点"];
for (const page of pages) {
  if (page.generated) {
    if (!page.generatedAt) { errors.push(`${page.rel}: generated page missing generated-at: <commit>`); continue; }
    try {
      const lag = git("rev-list", "--count", `${page.generatedAt}..HEAD`).trim();
      if (+lag > 0) notices.push(`${page.rel}: 体检报告落后 ${lag} 个提交，同步时重跑：${page.generated}`);
    } catch {
      errors.push(`${page.rel}: generated-at commit not found: ${page.generatedAt}`);
    }
    if (page.rel === "health.md")
      for (const h of HEALTH_HEADINGS)
        if (!page.body.includes(h)) errors.push(`health.md: missing fixed heading "${h}" (HTML 警示标锚点依赖它)`);
    continue;
  }
  for (const src of page.sources) {
    const abs = join(repoRoot, src.file);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      errors.push(`${page.rel}: source must be a file, not a directory: ${src.file}`);
      src.skip = true;
    }
  }
}
const sourceFiles = [...new Set(pages.filter((p) => !p.generated).flatMap((p) => p.sources.filter((s) => !s.skip).map((s) => s.file)))];
const existing = sourceFiles.filter((f) => existsSync(join(repoRoot, f)));
const hashes = blobHashes(existing);
for (const page of pages) {
  if (page.generated) continue;
  for (const src of page.sources) {
    if (src.skip) continue;
    if (!hashes.has(src.file)) {
      errors.push(`${page.rel}: source missing: ${src.file}`);
      continue;
    }
    if (src.hash.length < 8 || !hashes.get(src.file).startsWith(src.hash)) {
      errors.push(`${page.rel}: source changed since last sync: ${src.file}${describeDrift(src)}`);
      continue;
    }
    const content = readFileSync(join(repoRoot, src.file), "utf8");
    for (const sym of src.symbols) {
      if (!content.includes(sym)) errors.push(`${page.rel}: symbol gone from ${src.file}: ${sym}`);
    }
  }
}

// 2. Coverage ledger: every tracked file is claimed by a page's covers or excluded.
// Built-in exemptions cover what never needs a claim; everything else is explicit,
// so a module growing without documentation fails here instead of going unnoticed.
const LOCKFILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "Cargo.lock", "go.sum", "composer.lock", "Gemfile.lock", "poetry.lock", "uv.lock"]);
const BINARY_RE = /\.(png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot|pdf|mp4|mov|webm|mp3|wav|zip|gz|jar|wasm|node|bin)$/i;
const archPrefix = relative(repoRoot, here).replaceAll("\\", "/") + "/";
const builtinExempt = (f) =>
  f.split("/").some((seg) => seg.startsWith(".")) ||
  LOCKFILES.has(f.slice(f.lastIndexOf("/") + 1)) ||
  BINARY_RE.test(f) || f.startsWith(archPrefix);
const claims = (p) => f => f === p || f.startsWith(p.endsWith("/") ? p : p + "/");
{
  // -z: NUL-separated raw paths — non-ASCII filenames would otherwise arrive quoted/escaped.
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" }).split("\0").filter(Boolean);
  const entries = [
    ...pages.flatMap((p) => p.covers.map((c) => ({ owner: p.rel, kind: "covers", match: claims(c), raw: c }))),
    ...(pages.find((p) => p.rel === "index.md")?.exclude ?? []).map((c) => ({ owner: "index.md", kind: "exclude", match: claims(c), raw: c })),
  ];
  for (const p of pages)
    if (p.rel !== "index.md" && p.exclude.length)
      errors.push(`${p.rel}: exclude belongs in index.md frontmatter only (move it there)`);
  const hit = new Set();
  const unclaimed = [];
  for (const f of tracked) {
    if (builtinExempt(f)) continue;
    let claimed = false;
    for (const e of entries) if (e.match(f)) { claimed = true; hit.add(e); }
    if (!claimed) unclaimed.push(f);
  }
  if (unclaimed.length) {
    const shown = unclaimed.slice(0, 30);
    errors.push(`coverage: ${unclaimed.length} file(s) unclaimed — add to a page's covers or index.md exclude:\n${shown.map((f) => `    ${f}`).join("\n")}${unclaimed.length > 30 ? `\n    … and ${unclaimed.length - 30} more` : ""}`);
  }
  for (const e of entries) {
    if (!hit.has(e)) errors.push(`${e.owner}: stale ${e.kind} entry matches no tracked file: ${e.raw}`);
  }
}

// 3. Relative links resolve; every page except index.md has an inbound link.
const inbound = new Set();
for (const page of pages) {
  for (const m of page.body.matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|\/)/.test(target)) continue;
    const abs = resolve(dirname(page.path), decodeURIComponent(target));
    if (!existsSync(abs)) {
      errors.push(`${page.rel}: broken link: ${target}`);
    } else if (abs.startsWith(wikiDir)) {
      inbound.add(relative(wikiDir, abs));
    }
  }
}
for (const page of pages) {
  if (page.rel !== "index.md" && !inbound.has(page.rel)) {
    errors.push(`${page.rel}: orphan page (no inbound wiki link)`);
  }
}

// 4. index.md baseline is a valid commit.
const index = pages.find((p) => p.rel === "index.md");
if (!index) {
  errors.push("wiki/index.md missing");
} else if (!index.baseline) {
  errors.push("index.md: missing `baseline: <commit sha>` in frontmatter");
} else {
  try {
    git("cat-file", "-e", `${index.baseline}^{commit}`);
  } catch {
    errors.push(`index.md: baseline commit not found: ${index.baseline}`);
  }
}

// 5. architecture.html exists and was rendered from the current wiki.
if (!existsSync(htmlPath)) {
  errors.push("architecture.html missing (run render)");
} else {
  const m = readFileSync(htmlPath, "utf8").match(/name="wiki-digest"\s+content="([0-9a-f]+)"/);
  if (!m) errors.push('architecture.html: missing <meta name="wiki-digest">');
  else if (m[1] !== digest) errors.push(`architecture.html: stale (digest ${m[1]} != wiki ${digest}), re-render`);
}

// 6. data.json (when present): graph completeness + geometry red lines.
const NODE_M = 0.18;   // 穿楼判定的收缩量：宁漏报不误报
const rectOf = (n, m = NODE_M) => [n.x + m, n.y + m, n.x + (n.w ?? 1.1) - m, n.y + (n.d ?? 1.1) - m];

const HEALTH_KEYS = new Set(["dead", "cycles", "hotspot", "breaks"]);
const dataPath = join(here, "data.json");
if (existsSync(dataPath)) {
  let d = null;
  try { d = JSON.parse(readFileSync(dataPath, "utf8")); }
  catch (e) { errors.push(`data.json: invalid JSON (${e.message})`); }
  if (d) checkData(d);
}
function checkData(d) {
  if (d.health)
    for (const [k, v] of Object.entries(d.health))
      if (typeof v !== "number" || v < 0) errors.push(`data.json: health.${k} must be a non-negative number`);
  const nodes = d.nodes || [], districts = d.districts || [];
  const flows = d.flows || [];
  // 分区矩形是后面所有几何检查的地基：它不合法时给可读报错，而不是让后续解构崩掉
  const badR = new Set();
  for (const dd of districts)
    if (!Array.isArray(dd.r) || dd.r.length !== 4 || dd.r.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      errors.push(`data.json: district ${dd.id} needs r: [x, y, w, h] with four finite numbers`);
      badR.add(dd.id);
    }
  const geo = districts.filter((dd) => !badR.has(dd.id));
  if (d.files && (typeof d.files !== "object" || Array.isArray(d.files) ||
      Object.values(d.files).some((v) => typeof v !== "number" || v < 0)))
    errors.push("data.json: files must be an object mapping repo-relative path -> line count");
  for (const dd of districts)
    if (dd.page && !existsSync(join(wikiDir, dd.page.split("#")[0])))
      errors.push(`data.json: district ${dd.id} page not found: ${dd.page.split("#")[0]}`);
  const codes = new Set(nodes.map((n) => n.code));
  const touched = new Set();
  for (const l of d.links || []) {
    touched.add(l.from); touched.add(l.to);
    if (!codes.has(l.from) || !codes.has(l.to))
      errors.push(`data.json: link ${l.from}→${l.to} references unknown node`);
  }
  for (const f of flows) {
    if (f.page && !existsSync(join(wikiDir, f.page.split("#")[0])))
      errors.push(`data.json: flow "${f.title}" page not found: ${f.page.split("#")[0]}`);
    (f.steps || []).forEach((s, i) => {
      touched.add(s.from); touched.add(s.to);
      if (!codes.has(s.from) || !codes.has(s.to))
        errors.push(`data.json: flow "${f.title}" step "${s.title}" references unknown node`);
      if (!s.sources?.length)
        errors.push(`data.json: flow "${f.title}" step "${s.title}" missing sources (call-site evidence)`);
      if (s.par !== undefined && typeof s.par !== "boolean")
        errors.push(`data.json: flow "${f.title}" step "${s.title}" par must be boolean`);
      if (s.par && i === 0)
        errors.push(`data.json: flow "${f.title}" first step cannot be par (nothing to run alongside)`);
    });
  }
  for (const n of nodes) {
    // 坐标没有合理默认值：缺了会算出 NaN，SVG 会静默丢弃图形而不报错
    for (const k of ["x", "y"])
      if (typeof n[k] !== "number" || !Number.isFinite(n[k]))
        errors.push(`data.json: node ${n.code} missing numeric ${k}`);
    for (const k of ["w", "d", "h"])
      if (n[k] !== undefined && (typeof n[k] !== "number" || !(n[k] > 0)))
        errors.push(`data.json: node ${n.code} invalid ${k} (must be a positive number)`);
    if (!n.name) errors.push(`data.json: node ${n.code} missing name`);
    if (!touched.has(n.code))
      errors.push(`data.json: orphan node ${n.code} (no link or flow touches it)`);
    if (n.page && !existsSync(join(wikiDir, n.page.split("#")[0])))
      errors.push(`data.json: node ${n.code} page not found: ${n.page.split("#")[0]}`);
    if (n.health) {
      if (!Array.isArray(n.health) || n.health.some((h) => !HEALTH_KEYS.has(h)))
        errors.push(`data.json: node ${n.code} invalid health (allowed: ${[...HEALTH_KEYS].join("/")})`);
      else if (!existsSync(join(wikiDir, "health.md")))
        errors.push(`data.json: node ${n.code} has health but wiki/health.md is missing`);
    }
    const dd = districts.find((x) => x.id === n.district);
    if (!dd) { errors.push(`data.json: node ${n.code} unknown district ${n.district}`); continue; }
    if (badR.has(dd.id)) continue;
    const [x, y, w, h] = dd.r, nw = n.w ?? 1.1, nd = n.d ?? 1.1;
    if (n.x < x || n.y < y || n.x + nw > x + w || n.y + nd > y + h)
      errors.push(`data.json: node ${n.code} outside district ${dd.id}`);
  }
  if (geo.length) { checkCrossings(d, nodes, geo); checkAisles(d, nodes, geo); }
  // Geometry red lines (slightly looser than RENDER.md recommendations).
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const xg = Math.max(a.x - (b.x + (b.w ?? 1.1)), b.x - (a.x + (a.w ?? 1.1)));
      const yg = Math.max(a.y - (b.y + (b.d ?? 1.1)), b.y - (a.y + (a.d ?? 1.1)));
      if (xg < 1.3 && yg < 1.1)
        errors.push(`data.json: nodes ${a.code}/${b.code} too close (xgap ${xg.toFixed(1)}, ygap ${yg.toFixed(1)}; need xgap>=1.3 or ygap>=1.1)`);
    }
  for (let i = 0; i < geo.length; i++)
    for (let j = i + 1; j < geo.length; j++) {
      const [ax, ay, aw, ah] = geo[i].r, [bx, by, bw, bh] = geo[j].r;
      const xg = Math.max(ax - (bx + bw), bx - (ax + aw));
      const yg = Math.max(ay - (by + bh), by - (ay + ah));
      if (xg < 1.5 && yg < 1.5)
        errors.push(`data.json: districts ${geo[i].id}/${geo[j].id} need a >=1.5 aisle`);
    }
}

// Edge-through-building red line. Deliberately loose (footprints shrunk) so the
// template's edge bowing never triggers false alarms — misses beat false positives.
function segHitsRect(ax, ay, bx, by, x0, y0, x1, y1) {
  const inside = (px, py) => px > x0 && px < x1 && py > y0 && py < y1;
  if (inside(ax, ay) || inside(bx, by)) return true;
  const cross = (ox, oy, px, py, qx, qy) => (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const segsIntersect = (p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) => {
    const d1 = cross(p3x, p3y, p4x, p4y, p1x, p1y), d2 = cross(p3x, p3y, p4x, p4y, p2x, p2y);
    const d3 = cross(p1x, p1y, p2x, p2y, p3x, p3y), d4 = cross(p1x, p1y, p2x, p2y, p4x, p4y);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const sides = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
  return sides.some(([sx, sy, ex, ey]) => segsIntersect(ax, ay, bx, by, sx, sy, ex, ey));
}
/* 没有航点却横穿无关分区的连线：不阻断，但提示——这是布局排成对角线的典型信号 */
function checkAisles(d, nodes, districts) {
  const NM = {}; nodes.forEach((n) => NM[n.code] = n);
  const center = (n) => [n.x + (n.w ?? 1.1) / 2, n.y + (n.d ?? 1.1) / 2];
  const edges = [
    ...(d.links || []).map((l) => ({ ...l, tag: `${l.from}→${l.to}` })),
    ...(d.flows || []).flatMap((f) => (f.steps || []).map((s) => ({ ...s, tag: `${f.title}/${s.from}→${s.to}` }))),
  ];
  const hits = [];
  for (const e of edges) {
    if (e.via?.length) continue;   // 已经手工路由过的不管
    const a = NM[e.from], b = NM[e.to];
    if (!a || !b) continue;
    const [p, q] = [center(a), center(b)];
    let crossed = 0;
    for (const dd of districts) {
      if (dd.id === a.district || dd.id === b.district) continue;
      const [x, y, w, h] = dd.r;
      if (segHitsRect(p[0], p[1], q[0], q[1], x, y, x + w, y + h)) crossed++;
    }
    if (crossed >= 2) hits.push(`${e.tag}（穿 ${crossed} 区）`);   // 穿一个区是正常跨区，穿两个以上才是斜贯全图
  }
  if (hits.length)
    notices.push(`${hits.length} 条连线斜贯多个无关分区（加 via 航点走通道，或把分区沿 x 重排不要堆成对角线）：${hits.slice(0, 5).join("、")}${hits.length > 5 ? " …" : ""}`);
}
/* 绕行航点建议：避障是几何计算，不该让写 wiki 的人手算坐标。
   候选取各楼四边中点与四角的外侧，选两段都不穿楼、绕路最短的那个。*/
function suggestVia(p, q, nodes, skip, districts) {
  const G = 0.9;
  // 航点可以走分区之间的通道（通道就在分区外），但不能飘到整张图外面
  const bx0 = Math.min(...districts.map((dd) => dd.r[0])) - 0.5;
  const by0 = Math.min(...districts.map((dd) => dd.r[1])) - 0.5;
  const bx1 = Math.max(...districts.map((dd) => dd.r[0] + dd.r[2])) + 0.5;
  const by1 = Math.max(...districts.map((dd) => dd.r[1] + dd.r[3])) + 0.5;
  const inBounds = (m) => m[0] >= bx0 && m[0] <= bx1 && m[1] >= by0 && m[1] <= by1;
  const cands = [];
  for (const n of nodes) {
    const [x0, y0, x1, y1] = rectOf(n, 0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cands.push([cx, y0 - G], [cx, y1 + G], [x0 - G, cy], [x1 + G, cy],
      [x0 - G, y0 - G], [x1 + G, y0 - G], [x0 - G, y1 + G], [x1 + G, y1 + G]);
  }
  const blocked = (a, b) => nodes.some((n) => {
    if (skip.has(n.code)) return false;
    const [x0, y0, x1, y1] = rectOf(n);
    return segHitsRect(a[0], a[1], b[0], b[1], x0, y0, x1, y1);
  });
  const insideAny = (m) => nodes.some((n) => {
    const [x0, y0, x1, y1] = rectOf(n, -0.3);
    return m[0] > x0 && m[0] < x1 && m[1] > y0 && m[1] < y1;
  });
  let best = null, bestCost = Infinity;
  for (const m of cands) {
    if (!inBounds(m) || insideAny(m) || blocked(p, m) || blocked(m, q)) continue;
    const cost = Math.hypot(m[0] - p[0], m[1] - p[1]) + Math.hypot(q[0] - m[0], q[1] - m[1]);
    if (cost < bestCost) { bestCost = cost; best = m; }
  }
  return best;
}
function checkCrossings(d, nodes, districts) {
  const NM = {}; nodes.forEach((n) => NM[n.code] = n);
  const center = (n) => [n.x + (n.w ?? 1.1) / 2, n.y + (n.d ?? 1.1) / 2];
  const edges = [
    ...(d.links || []).map((l) => ({ ...l, tag: `link ${l.from}→${l.to}` })),
    ...(d.flows || []).flatMap((f) => (f.steps || []).map((s) => ({ ...s, tag: `flow "${f.title}" step "${s.title}"` }))),
  ];
  for (const e of edges) {
    const a = NM[e.from], b = NM[e.to];
    if (!a || !b) continue;
    const pts = [center(a), ...(e.via || []), center(b)];
    const hit = [];
    for (const n of nodes) {
      if (n.code === e.from || n.code === e.to) continue;
      const [x0, y0, x1, y1] = rectOf(n);
      for (let i = 0; i < pts.length - 1; i++)
        if (segHitsRect(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x0, y0, x1, y1)) { hit.push(n.code); break; }
    }
    if (!hit.length) continue;
    const via = suggestVia(center(a), center(b), nodes, new Set([e.from, e.to]), districts);
    errors.push(`data.json: ${e.tag} crosses ${hit.join("/")} footprint — ` + (via
      ? `改成 "via": [[${via[0].toFixed(1)}, ${via[1].toFixed(1)}]]`
      : `周围无可行绕路，需重排节点`));
  }
}

for (const n of notices) console.log(`notice: ${n}`);
const uniq = [...new Set(errors)];
if (uniq.length) {
  console.error(`Architecture wiki verify failed (${uniq.length}):`);
  for (const e of uniq) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`Architecture wiki OK: ${pages.length} pages, digest ${digest}`);
