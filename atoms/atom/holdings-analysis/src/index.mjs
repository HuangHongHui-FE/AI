#!/usr/bin/env node
// holdings-analysis：基金持仓 × 板块预测 → 逐只/分板块盈亏估算与调仓建议
// 用法：
//   node atom/holdings-analysis/src/index.mjs --holdings holdings.json --forecast forecast.json --out result.json --md report.md
// holdings 支持 JSON 数组，也支持「名称｜金额｜盈亏｜收益率」文本行
// stdout：{ ok, totals, funds, sectors, advice, concentration }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { analyze, renderMarkdown } from "./lib/analyze.mjs";

const args = parseArgs({ known: ["holdings", "forecast", "out", "md", "decay", "next-label", "quiet"] });

function num(v) {
  const n = Number(String(v).replace(/[%,＋+]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalize(h) {
  const name = String(h.name || "").trim();
  if (!name) fail("持仓条目缺少 name");
  return { name, amount: num(h.amount), pnl: num(h.pnl), pct: num(h.pct) };
}

function parseHoldings(raw) {
  const t = raw.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    const j = JSON.parse(t);
    const arr = Array.isArray(j) ? j : j.holdings;
    if (!Array.isArray(arr)) fail("holdings JSON 需要是数组，或 { holdings: [...] }");
    return arr.map(normalize);
  }
  return t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, amount, pnl, pct] = line.split(/[｜|]/);
      if (!name) fail(`持仓行格式不对：${line}`);
      return normalize({ name, amount, pnl, pct });
    });
}

function readJson(p) {
  const abs = resolve(String(p));
  if (!existsSync(abs)) fail(`文件不存在：${abs}`);
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    fail(`${p} 不是合法 JSON：${e.message}`);
  }
}

function main() {
  if (!args.holdings) fail("需要 --holdings 持仓文件");
  if (!args.forecast) fail("需要 --forecast 预测 JSON");

  const holdingsPath = resolve(String(args.holdings));
  if (!existsSync(holdingsPath)) fail(`持仓文件不存在：${holdingsPath}`);
  const holdings = parseHoldings(readFileSync(holdingsPath, "utf8"));
  if (!holdings.length) fail("持仓为空");

  const forecast = readJson(args.forecast);
  if (!forecast || typeof forecast !== "object" || Array.isArray(forecast)) fail("forecast 需要是「板块 → 预测」对象");

  const res = analyze(holdings, forecast, {
    decay: args.decay == null ? 0.6 : Number(args.decay),
    nextLabel: args["next-label"] ? String(args["next-label"]) : "次日",
  });

  if (!args.quiet) {
    log(`✓ ${holdings.length} 只基金 / ${res.sectors.length} 个板块`);
    log(`  今日预估：¥${res.totals.today_est_pnl.toFixed(2)}；${res.totals.next_label}预估：¥${res.totals.next_est_pnl.toFixed(2)}`);
    for (const s of res.sectors) log(`  ${s.dir}${s.conf} ${s.sector} ¥${s.amount.toFixed(0)} → ${s.advice}`);
  }

  if (args.out) {
    const out = resolve(String(args.out));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(res, null, 2) + "\n");
    log(`已落盘：${out}`);
  }
  if (args.md) {
    const md = resolve(String(args.md));
    mkdirSync(dirname(md), { recursive: true });
    writeFileSync(md, renderMarkdown(res));
    log(`已落盘：${md}`);
  }

  emit(res, 0);
}

main();