#!/usr/bin/env node
// kline：抓股票/指数 K 线数据，可选直接出图
// 用法：
//   node atom/kline/src/index.mjs --code 300750 --period month --json          # 只要数据（JSON）
//   node atom/kline/src/index.mjs --code 600519 --period day --limit 60 --out chart.jpg --title "茅台近60日"
//   node atom/kline/src/index.mjs --code 00700 --source tencent --json          # 强制走腾讯源
// stdout：{ ok, source, code, period, count, rows:[...], chart? }
// 退出码：0 成功 / 1 两个源都失败 / 2 参数错误

import { resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { fetchKline } from "./lib/sources.mjs";
import { drawKline } from "./lib/draw.mjs";

const args = parseArgs({ known: ["code", "period", "limit", "source", "out", "title", "json", "currency", "out-dir"] });

async function main() {
  const code = String(args.code || args._[0] || "").trim();
  if (!code) fail("需要 --code 股票代码（600519 / 300750 / 00700 / AAPL / 1.600519）");

  const period = String(args.period || "month");
  if (!["day", "week", "month"].includes(period)) fail(`--period 只能是 day/week/month，实际「${period}」`);

  const limit = Number(args.limit || 0);
  if (limit < 0) fail("--limit 不能为负");

  const source = String(args.source || "auto");
  if (!["auto", "eastmoney", "tencent"].includes(source)) fail(`--source 只能是 auto/eastmoney/tencent`);

  let data;
  try {
    data = await fetchKline(code, { period, limit, source });
  } catch (e) {
    fail(e.message);
  }

  if (data.fallback_errors?.length) log(`⚠ ${data.fallback_errors.join("；")}，已回落 ${data.source}`);

  const result = {
    ok: true,
    source: data.source,
    code: data.code,
    period,
    count: data.rows.length,
    first_date: data.rows[0]?.date,
    last_date: data.rows[data.rows.length - 1]?.date,
    last_close: data.rows[data.rows.length - 1]?.close,
    rows: args.json ? data.rows : data.rows.slice(-10), // 默认只回传最近 10 根，避免刷屏
  };

  // 出图（可选）
  if (args.out) {
    const outPath = resolve(String(args.out));
    const chart = await drawKline({
      rows: data.rows,
      title: args.title ? String(args.title) : "",
      outPath,
      currency: args.currency ? String(args.currency) : "¥",
    });
    result.chart = chart;
    log(`✓ K线图 ${chart.points} 个点 ${chart.first.toFixed(2)} → ${chart.last.toFixed(2)}（${chart.pct >= 0 ? "+" : ""}${chart.pct}%）→ ${outPath}`);
  }

  log(`✓ ${data.source} ${data.code} ${period}：${data.rows.length} 根，${result.first_date} → ${result.last_date}`);
  emit(result, EXIT.OK);
}

main().catch((e) => fail(e.message));
