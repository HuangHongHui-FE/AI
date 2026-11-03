#!/usr/bin/env node
// market-fetch：顺序跑 9 个 Python 抓数脚本，把行情/资金/外盘/情绪/财报落盘到 --out-dir
// 用法：
//   node atom/market-fetch/src/index.mjs --out-dir cache/20261103
//   node atom/market-fetch/src/index.mjs --out-dir out --only quote,flow
// stdout：{ ok, out_dir, date, scripts:[{id,ok,ms,files}], files:[] }
// 退出码：0 成功 / 1 关键数据缺失 / 2 参数或环境错误

import { mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

// 抓数顺序与原 run_forecast.sh 一致；critical 的脚本失败直接判整体失败
const SCRIPTS = [
  { id: "quote", file: "fetch_quote.py", critical: true },
  { id: "history", file: "fetch_history.py" },
  { id: "overseas", file: "fetch_overseas.py" },
  { id: "env", file: "fetch_env.py" },
  { id: "flow", file: "fetch_flow.py" },
  { id: "flow_intraday", file: "fetch_flow_intraday.py" },
  { id: "sentiment", file: "fetch_sentiment.py" },
  { id: "earnings", file: "fetch_earnings.py" },
  { id: "news", file: "fetch_news.py" },
];

const args = parseArgs({ known: ["out-dir", "only", "quiet", "timeout"] });
const HERE = dirname(fileURLToPath(import.meta.url));
const PY_DIR = join(HERE, "py");
const timeout = Number(args.timeout || 120000);

// 本地日期 YYYYMMDD（脚本内部按同一天写文件名）
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// 列出输出目录里新增的文件，便于确认每个脚本真的落了盘
function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

async function main() {
  const outDir = resolve(String(args["out-dir"] || join(process.cwd(), "cache", today())));
  mkdirSync(outDir, { recursive: true });

  // 环境检查：没有 python3 直接失败
  const probe = spawnSync("python3", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) fail("找不到 python3，market-fetch 依赖 Python 3 运行抓数脚本");

  const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;
  const list = only ? SCRIPTS.filter((s) => only.includes(s.id)) : SCRIPTS;
  if (!list.length) fail(`--only 没有匹配的脚本：${args.only}`);

  const results = [];
  for (const s of list) {
    const script = join(PY_DIR, s.file);
    if (!existsSync(script)) {
      results.push({ id: s.id, ok: false, ms: 0, files: [], error: `脚本不存在：${s.file}` });
      continue;
    }
    const before = new Set(filesIn(outDir));
    const t0 = Date.now();
    // 输出目录通过环境变量传给脚本（脚本内 MARKET_OUT 优先）
    const r = spawnSync("python3", [script], {
      encoding: "utf8",
      timeout,
      env: { ...process.env, MARKET_ROOT: outDir, MARKET_OUT: outDir },
    });
    const ms = Date.now() - t0;
    const added = filesIn(outDir).filter((f) => !before.has(f));
    const ok = r.status === 0;
    results.push({ id: s.id, ok, ms, files: added, error: ok ? "" : (r.stderr || "").trim().slice(-200) });
    log(`${ok ? "✓" : "✗"} ${s.id}${added.length ? ` → ${added.join(", ")}` : ""}（${ms}ms）${ok ? "" : " 降级跳过"}`);
  }

  const failed = results.filter((r) => !r.ok);
  const criticalFailed = results.some((r) => !r.ok && SCRIPTS.find((s) => s.id === r.id)?.critical);
  const ok = !criticalFailed;

  const payload = {
    ok,
    out_dir: outDir,
    date: today(),
    scripts: results,
    files: filesIn(outDir),
    failed: failed.map((f) => f.id),
  };
  if (!ok) log(`\n关键脚本失败（${failed.map((f) => f.id).join(", ")}），行情数据不可用`);
  else log(`\n数据就绪：${outDir}（${filesIn(outDir).length} 个文件）`);

  emit(payload, ok ? 0 : 1);
}

main().catch((e) => fail(e.message));
