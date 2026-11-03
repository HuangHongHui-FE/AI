#!/usr/bin/env node
// result-page：分析结果 markdown → 带方向速览卡片/方向徽章/红涨绿跌的结果页 HTML
// 用法：
//   node atom/result-page/src/index.mjs --md /tmp/forecast.md --out results/20261103-1812.html
// stdout：{ ok, file, bytes }

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const args = parseArgs({ known: ["md", "out", "out-dir", "quiet"] });
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "py", "md2html.py");

async function main() {
  const mdPath = resolve(String(args.md || ""));
  if (!args.md) fail("需要 --md 输入 markdown 路径");
  if (!existsSync(mdPath)) fail(`markdown 不存在：${mdPath}`);

  const outPath = args.out
    ? resolve(String(args.out))
    : args["out-dir"]
      ? join(resolve(String(args["out-dir"])), "report.html")
      : mdPath.replace(/\.md$/i, "") + ".html";
  mkdirSync(dirname(outPath), { recursive: true });

  // 渲染交给 Python 脚本（样式与结果页布局都在里面，改样式改 py 不改这里）
  const r = spawnSync("python3", [SCRIPT, mdPath, outPath], { encoding: "utf8", timeout: 60000 });
  if (r.error) fail(`执行 md2html.py 失败：${r.error.message}`);
  if (r.status !== 0) fail(`md2html.py 退出码 ${r.status}：${(r.stderr || "").trim().slice(-300)}`);
  if (!existsSync(outPath)) fail("md2html.py 未产出 HTML");

  const bytes = statSync(outPath).size;
  const html = readFileSync(outPath, "utf8");
  // 结果页必须带方向卡片——没有说明输入 md 里没有方向表
  const hasDirection = /看涨|看跌|震荡/.test(html);

  log(`✓ 结果页 ${(bytes / 1024).toFixed(1)}KB → ${outPath}${hasDirection ? "" : "（未检测到方向标记，检查输入 md）"}`);
  emit({ ok: true, file: outPath, bytes, has_direction: hasDirection }, 0);
}

main().catch((e) => fail(e.message));
