#!/usr/bin/env node
// 防回潮 lint：拦截硬编码绝对路径、跨 atom import、内嵌密钥三类问题.
// 用法：node atom/scripts/lint-paths.mjs [--fix-hint]

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { atomsRoot } from "../../_shared/paths.mjs";

const ROOT = atomsRoot();
const SKIP_DIRS = new Set(["node_modules", ".git", "runs", "fixtures", "cache"]);

// 规则表：命中即报错
const RULES = [
  {
    id: "abs-path",
    re: /['"`](\/Users\/|\/home\/[a-z]|[A-Z]:[\\/])/,
    msg: "硬编码绝对路径，应改为 CLI 参数或 paths.mjs 推导",
  },
  {
    id: "hardcoded-secret",
    re: /(sk-ant-[A-Za-z0-9]|ACCESS_TOKEN\s*=\s*['"][A-Za-z0-9_-]{60,})/,
    msg: "疑似内嵌密钥/token，应从 process.env 读取",
  },
  {
    id: "cwd-literal",
    re: /['"`]\.\/(output|input|cache)\//,
    msg: "写死业务目录，应由 --out / --out-dir 传入",
  },
];

// 递归收集待检源码文件
function collect(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) collect(p, acc);
    else if (/\.(mjs|cjs|js|ts|py)$/.test(name)) acc.push(p);
  }
  return acc;
}

// 检查跨 atom import（atom 之间禁止代码依赖）
function checkCrossAtom(file, text) {
  if (!file.includes(`${join(ROOT, "atom")}`)) return null;
  const m = text.match(/from\s+['"`][^'"`]*\/atom\/([a-z0-9-]+)\//);
  if (m) return `跨 atom import（引用了 atom/${m[1]}），组合应只在 recipe 层发生`;
  return null;
}

const files = collect(ROOT);
const problems = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = relative(ROOT, f);
  for (const rule of RULES) {
    text.split("\n").forEach((line, i) => {
      if (rule.re.test(line)) problems.push({ file: rel, line: i + 1, id: rule.id, msg: rule.msg });
    });
  }
  const cross = checkCrossAtom(f, text);
  if (cross) problems.push({ file: rel, line: 0, id: "cross-atom", msg: cross });
}

if (problems.length) {
  process.stderr.write(`lint-paths: 发现 ${problems.length} 处问题\n`);
  for (const p of problems) process.stderr.write(`  ${p.file}:${p.line} [${p.id}] ${p.msg}\n`);
  process.exit(1);
}
process.stdout.write(`lint-paths: 通过（检查 ${files.length} 个文件）\n`);
