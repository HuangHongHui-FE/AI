#!/usr/bin/env node
// 全量回归：跑所有带 fixtures/regression.mjs 的原子
// 用法：node atom/scripts/test-all.mjs [--with-source] [--only <atom>]
// --with-source 额外跑与源实现的一致性对比（源实现已固化在 fixtures/reference/）

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { atomsRoot } from "../../_shared/paths.mjs";

const args = process.argv.slice(2);
const withSource = args.includes("--with-source");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// 与源实现对比时额外传的参数
// 基准已固化在各自 fixtures/ 下，atoms 不再依赖 ../project/
const SOURCE_ARGS = {
  selfcheck: [
    "--src-root", join(atomsRoot(), "atom", "selfcheck", "fixtures", "samples"),
    "--old-preflight", join(atomsRoot(), "atom", "selfcheck", "fixtures", "reference", "preflight.js"),
  ],
  "cover-image": ["--src-cover", join(atomsRoot(), "atom", "cover-image", "fixtures", "reference", "cover.js")],
  "format-html": ["--src-html", join(atomsRoot(), "atom", "format-html", "fixtures", "reference", "html.js")],
};

// recipe 的回归（编排器：模板/停手点/续跑/manifest）
const recipeRegs = [];
const recipeRoot = join(atomsRoot(), "recipe");
for (const d of readdirSync(recipeRoot)) {
  const f = join(recipeRoot, d, "fixtures", "regression.mjs");
  if (existsSync(f)) recipeRegs.push({ name: `recipe/${d}`, script: f, extra: [] });
}

const atomRoot = join(atomsRoot(), "atom");
const atoms = readdirSync(atomRoot)
  .filter((d) => {
    const f = join(atomRoot, d, "fixtures", "regression.mjs");
    return existsSync(f) && d !== "scripts";
  })
  .filter((d) => !only || d === only)
  .sort();

if (!atoms.length) {
  console.error(only ? `没有名为 ${only} 的回归测试` : "没有找到任何回归测试");
  process.exit(2);
}

const results = [];
for (const r of recipeRegs) {
  console.log(`\n${"─".repeat(60)}\n▶ ${r.name}`);
  const res = spawnSync(process.execPath, [r.script], { stdio: "inherit" });
  results.push({ name: r.name, code: res.status ?? 1 });
}

for (const name of atoms) {
  const script = join(atomRoot, name, "fixtures", "regression.mjs");
  const extra = withSource ? SOURCE_ARGS[name] || [] : [];
  // 源路径不存在时跳过该原子的一致性对比（fixture 自身会打印「跳过」）
  const usable = extra.length === 0 || existsSync(extra[1]);
  const cliArgs = usable ? [script, ...extra] : [script];

  console.log(`\n${"─".repeat(60)}\n▶ ${name}${extra.length && !usable ? "（源路径不存在，跳过对比）" : ""}`);
  const res = spawnSync(process.execPath, cliArgs, { stdio: "inherit" });
  const code = res.status ?? 1;
  results.push({ name, code });
}

console.log(`\n${"═".repeat(60)}`);
const pass = results.filter((r) => r.code === 0);
for (const r of results) console.log(`${r.code === 0 ? "✓" : "✗"} ${r.name}`);
console.log(`\n${pass.length}/${results.length} 项回归通过`);
process.exit(pass.length === results.length ? 0 : 1);
