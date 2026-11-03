#!/usr/bin/env node
// 回归：comic-draw 参数校验 / 单格与长条漫产物 / 输出目录
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const SAMPLE = join(HERE, "sample-panels.json");
const work = mkdtempSync(join(tmpdir(), "cd-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

// 1. 参数校验
check("缺 --from-json 且无默认文件 → exit 2", run(["--out-dir", work]).status === 2);
check("文件不存在 → exit 2", run(["--from-json", join(work, "nope.json")]).status === 2);
check("未知参数 exit 2", run(["--from-json", SAMPLE, "--out-dir", work, "--foo", "x"]).status === 2);

// 2. 缺 panels 字段
const bad = join(work, "bad.json");
writeFileSync(bad, JSON.stringify({ slug: "x" }));
check("缺 panels 字段 → exit 2", run(["--from-json", bad, "--out-dir", work]).status === 2);

// 3. 正常渲染：2 格 → 2 张单格 + 1 张长条
const out = join(work, "out");
const r = run(["--from-json", SAMPLE, "--out-dir", out]);
check("渲染成功 exit 0", r.status === 0, r.stderr.trim().slice(-80));
if (existsSync(out)) {
  const files = readdirSync(out).sort();
  check("生成 2 张单格", files.includes("01.jpg") && files.includes("02.jpg"), files.join(","));
  check("生成长条漫", files.includes("strip.jpg"));
  try {
    const o = JSON.parse(r.stdout);
    check("回传 panels 数与文件清单", o.panels === 2 && o.files.length === 3, `${o.panels} 格 / ${o.files.length} 文件`);
  } catch {
    check("stdout 是合法 JSON", false);
  }
}

// 4. 只出单格 / 只出长条
const out2 = join(work, "out2");
run(["--from-json", SAMPLE, "--out-dir", out2, "--no-strip"]);
check("--no-strip 不产长条漫", existsSync(out2) && !readdirSync(out2).includes("strip.jpg"));

const out3 = join(work, "out3");
run(["--from-json", SAMPLE, "--out-dir", out3, "--no-panels"]);
check("--no-panels 只产长条漫", existsSync(out3) && readdirSync(out3).join(",") === "strip.jpg", existsSync(out3) ? readdirSync(out3).join(",") : "无");

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
