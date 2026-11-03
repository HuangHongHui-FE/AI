#!/usr/bin/env node
// 回归：forecast-dashboard 参数校验 / 两种版式产物 / JSON 侧车
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const REPORT = join(ATOM, "fixtures", "report.html");
const SNAPSHOT = join(ATOM, "fixtures", "summary.json");
const work = mkdtempSync(join(tmpdir(), "fd-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

// 1. 参数校验
check("缺 --report exit 2", run(["--snapshot", SNAPSHOT]).status === 2);
check("缺 --snapshot exit 2", run(["--report", REPORT]).status === 2);
check("文件不存在 exit 2", run(["--report", join(work, "no.html"), "--snapshot", SNAPSHOT]).status === 2);
check("未知 mode exit 2", run(["--report", REPORT, "--snapshot", SNAPSHOT, "--mode", "x"]).status === 2);

// 2. tables 版式
const out1 = join(work, "tables.html");
const r1 = run(["--report", REPORT, "--snapshot", SNAPSHOT, "--out", out1]);
check("tables 渲染成功 exit 0", r1.status === 0, r1.stderr.trim().slice(-80));
check("tables 产出 HTML", existsSync(out1));
check("tables 产出 JSON 侧车", existsSync(join(work, "tables.json")));
if (existsSync(out1)) {
  const html = readFileSync(out1, "utf8");
  check("tables 是完整页面", /<!doctype html>|<html/i.test(html));
  const j = JSON.parse(r1.stdout);
  check("stdout 报告 mode=tables", j.mode === "tables" && j.bytes > 1000, `${j.bytes} bytes`);
}

// 3. dashboard 版式
const out2 = join(work, "dash.html");
const r2 = run(["--report", REPORT, "--snapshot", SNAPSHOT, "--out", out2, "--mode", "dashboard"]);
check("dashboard 渲染成功 exit 0", r2.status === 0, r2.stderr.trim().slice(-80));
check("dashboard 产出 HTML", existsSync(out2));
if (existsSync(out2)) check("dashboard 体积合理", statSync(out2).size > 1000);

// 4. 默认输出名
const r3 = spawnSync(process.execPath, [ENTRY, "--report", REPORT, "--snapshot", SNAPSHOT], {
  encoding: "utf8",
  cwd: work,
});
check("默认输出 dashboard.html", r3.status === 0 && existsSync(join(work, "dashboard.html")));

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);