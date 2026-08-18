#!/usr/bin/env bun
// Deterministic JS/TS import graph via oxc (parser + resolver, tsconfig-aware).
// Usage: bun code-map.mjs <repo-root> [path-prefix...]
// Prints JSON: { root, files: { "src/a.ts": { loc, exports, imports, packages, unresolved? } } }
// Breakage is first-class data: parse failures become { error }, relative imports
// that resolve to nothing land in `unresolved` — both feed the health page's 断点 section.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { ResolverFactory } from "oxc-resolver";

const root = resolve(process.argv[2] ?? ".");
const prefixes = process.argv.slice(3);
const exts = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const files = execFileSync("git", ["ls-files", "--", ...exts.map((e) => `*${e}`)], {
  cwd: root, encoding: "utf8",
}).trim().split("\n").filter(Boolean)
  .filter((f) => !f.endsWith(".d.ts"))
  .filter((f) => !prefixes.length || prefixes.some((p) => f.startsWith(p)));

const resolver = new ResolverFactory({
  extensions: [...exts, ".json"],
  extensionAlias: { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"], ".cjs": [".cts", ".cjs"] },
});

const out = {};
for (const file of files.sort()) {
  const abs = join(root, file);
  const text = readFileSync(abs, "utf8");
  const { module: mod, errors } = parseSync(abs, text);
  if (errors.length) {
    out[file] = { error: errors[0].message };
    continue;
  }
  const specifiers = [
    ...mod.staticImports.map((i) => i.moduleRequest.value),
    ...mod.staticExports.flatMap((e) => e.entries.map((en) => en.moduleRequest?.value).filter(Boolean)),
    ...mod.dynamicImports.map((d) => {
      const raw = text.slice(d.moduleRequest.start, d.moduleRequest.end);
      const m = raw.match(/^(["'])(.*)\1$/s);
      return m?.[2];
    }).filter(Boolean),
  ];
  const imports = new Set();
  const packages = new Set();
  const unresolved = new Set();
  for (const spec of specifiers) {
    const res = resolver.resolveFileSync(abs, spec);
    if (res.path && res.path.startsWith(root) && !res.path.includes("node_modules")) {
      imports.add(relative(root, res.path));
    } else if (!res.path && spec.startsWith(".")) {
      unresolved.add(spec);
    } else if (!spec.startsWith(".") && !spec.startsWith("node:")) {
      packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  }
  const exports = [...new Set(mod.staticExports.flatMap((e) =>
    e.entries.map((en) => en.exportName?.name ?? "default"),
  ))];
  out[file] = {
    loc: text.split("\n").length,
    exports,
    imports: [...imports].sort(),
    packages: [...packages].sort(),
    ...(unresolved.size && { unresolved: [...unresolved].sort() }),
  };
}

console.log(JSON.stringify({ root, files: out }, null, 1));
