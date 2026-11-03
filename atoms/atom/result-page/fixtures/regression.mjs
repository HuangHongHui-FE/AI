#!/usr/bin/env node
// 回归：result-page 参数校验 / 渲染产物 / 方向卡片识别
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "rp-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

const MD = `# 预测 20261103-2016

| 板块 | 方向 | 依据 |
|---|---|---|
| 半导体 | ▼看跌 | 机构派发 |
| 银行 | ▲看涨 | 防御流入 |
| 黄金 | △震荡 | 利率走平 |
`;
const mdPath = join(work, "t.md");
writeFileSync(mdPath, MD);

// 1. 参数校验
check("缺 --md 报错 exit 2", run([]).status === 2);
check("md 不存在报错 exit 2", run(["--md", join(work, "nope.md")]).status === 2);
check("未知参数 exit 2", run(["--md", mdPath, "--foo", "x"]).status === 2);

// 2. 正常渲染
const outPath = join(work, "out.html");
const r = run(["--md", mdPath, "--out", outPath]);
check("渲染成功 exit 0", r.status === 0, r.stderr.trim().slice(-60));
check("产出 HTML 文件", existsSync(outPath));
if (existsSync(outPath)) {
  const html = readFileSync(outPath, "utf8");
  check("HTML 带方向标记", /看涨/.test(html) && /看跌/.test(html) && /震荡/.test(html));
  check("HTML 是完整页面", /<!doctype html>|<html/i.test(html));
  check("判出 has_direction", JSON.parse(r.stdout).has_direction === true);
}

// 3. 默认输出路径（同名 .html）
const r2 = run(["--md", mdPath]);
check("默认输出同名 .html", r2.status === 0 && existsSync(join(work, "t.html")));

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
