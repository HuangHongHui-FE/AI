#!/usr/bin/env node
// forecast-dashboard：把预测结果 HTML + 美基星图 snapshot 合成多区域看板
// 用法：
//   node atom/forecast-dashboard/src/index.mjs --report results/20261016-1728.html --snapshot summary.json --out dashboard.html
//   node atom/forecast-dashboard/src/index.mjs --mode dashboard ...
// stdout：{ ok, file, json_file, bytes, mode }

import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const MODES = {
  tables: "build_forecast_tables.py",
  dashboard: "build_forecast_dashboard.py",
};

const args = parseArgs({ known: ["report", "snapshot", "out", "mode", "quiet"] });
const HERE = dirname(fileURLToPath(import.meta.url));

function main() {
  if (!args.report) fail("需要 --report 预测结果 HTML");
  if (!args.snapshot) fail("需要 --snapshot 美基星图 summary.json");

  const report = resolve(String(args.report));
  const snapshot = resolve(String(args.snapshot));
  if (!existsSync(report)) fail(`report 不存在：${report}`);
  if (!existsSync(snapshot)) fail(`snapshot 不存在：${snapshot}`);

  const mode = String(args.mode || "tables");
  if (!MODES[mode]) fail(`--mode 只能是 ${Object.keys(MODES).join(" / ")}`);

  const out = resolve(String(args.out || "dashboard.html"));
  mkdirSync(dirname(out), { recursive: true });

  const script = join(HERE, "py", MODES[mode]);
  const r = spawnSync("python3", [script, "--report", report, "--snapshot", snapshot, "--out", out], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (r.error) fail(`执行 ${MODES[mode]} 失败：${r.error.message}`);
  if (r.status !== 0) fail(`${MODES[mode]} 退出码 ${r.status}：${(r.stderr || "").trim().slice(-300)}`);
  if (r.stdout) log(r.stdout.trim());
  if (!existsSync(out)) fail("脚本未产出 HTML");

  const jsonFile = out.replace(/\.html$/i, "") + ".json";
  emit({ ok: true, file: out, json_file: jsonFile, bytes: statSync(out).size, mode }, 0);
}

main();