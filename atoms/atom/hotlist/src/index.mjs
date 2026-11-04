#!/usr/bin/env node
// hotlist 原子入口：抓多平台实时热榜，输出 hotlist.json（含跨榜重叠）
// 用法：node atom/hotlist/src/index.mjs [--out hotlist.json] [--platforms toutiao,baidu] [--limit 20]

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { fetchHotlist } from "./lib/fetch.mjs";
import { findOverlap } from "./lib/overlap.mjs";
import { PLATFORMS } from "./lib/platforms.mjs";
import { validateHotlist } from "../../../_shared/schema/index.mjs";
import { nowIso } from "../../../_shared/time.mjs";

const args = parseArgs({ known: ["limit", "out", "out-dir", "platforms"] });
const allKeys = Object.keys(PLATFORMS);
const keys = args.platforms ? String(args.platforms).split(",").map((s) => s.trim()) : allKeys;
const limit = Number(args.limit || 20);
// 输出路径：--out 优先，其次 --out-dir（recipe 约定）里默认写 hotlist.json
const outPath = args.out
  ? resolve(String(args.out))
  : args["out-dir"]
    ? resolve(String(args["out-dir"]), "hotlist.json")
    : null;

// 每榜只保留前 limit 条，避免 JSON 过大
function trim(r) {
  return { ...r, items: (r.items || []).slice(0, limit) };
}

// 「1960.6万」→ 数值，用于比较和画热度条
function heatNum(heat) {
  const m = String(heat || "").match(/^([\d.]+)(万)?$/);
  if (!m) return 0;
  return Number(m[1]) * (m[2] ? 10000 : 1);
}

// 中文字符占两列，直接 padEnd 会歪；按显示宽度补空格
function pad(s, width) {
  const w = [...s].reduce((n, c) => n + (c.charCodeAt(0) >= 0x2e80 ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, width - w));
}

// 人读打印：先平台总览（有哪些榜、各多少条、最高热度多少），再各榜明细带热度条
function printBoard(results, overlaps) {
  const all = Object.values(results);
  const ok = all.filter((r) => r.ok);
  const total = ok.reduce((n, r) => n + r.items.length, 0);

  log(`\n【平台总览】${ok.length} 个平台可用，共 ${total} 条`);
  for (const r of ok) {
    // 榜首按热度取最大，不是按 rank——置顶条目常常不是最热的
    const top = [...r.items].sort((a, b) => heatNum(b.heat) - heatNum(a.heat))[0] || {};
    log(`  ${pad(r.label, 10)} ${String(r.items.length).padStart(2)} 条   最高 ${pad(top.heat || "—", 10)} ${top.title || ""}`);
  }
  for (const r of all.filter((x) => !x.ok)) log(`  ${r.label}  ✗ ${r.error}`);

  for (const r of ok) {
    const max = Math.max(...r.items.map((it) => heatNum(it.heat)), 0);
    const ts = r.meta?.active_time ? `  榜单时间 ${r.meta.active_time}` : "";
    log(`\n【${r.label}】${r.items.length} 条${ts}`);
    for (const it of r.items) {
      const h = heatNum(it.heat);
      // 热度条按该平台最热一条归一，只能横向比同榜，跨平台热度不可比
      const bar = max > 0 && h > 0 ? "█".repeat(Math.max(1, Math.round((h / max) * 12))) : "";
      log(`  ${String(it.rank).padStart(2)}. ${pad(it.heat || "—", 10)} ${pad(bar, 13)} ${it.title}`);
    }
  }

  if (overlaps.length) {
    log(`\n【跨榜重叠】${overlaps.length} 个话题被多榜同时收录（重叠=真热）`);
    overlaps.slice(0, 8).forEach((o) => {
      log(`  · ${o.title}  ← ${o.labels.join(" / ")}`);
    });
  }
}

async function main() {
  const fetchedAt = nowIso();
  const raw = await fetchHotlist(keys);
  const results = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, trim(v)]));
  const overlaps = findOverlap(results);

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const payload = {
    generated_at: fetchedAt,
    platforms_requested: keys,
    platforms_ok: okCount,
    platforms_failed: keys.length - okCount,
    sources: results,
    overlaps,
  };

  // 契约校验：保证下游拿到的结构稳定
  const v = validateHotlist({
    generated_at: payload.generated_at,
    items: Object.values(results).flatMap((r) => (r.ok ? r.items.map((it) => ({ platform: r.label, title: it.title })) : [])),
  });
  if (!v.ok) fail(`输出不符合 hotlist 契约：${v.errors.join("; ")}`);

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
    log(`\n已写入 ${outPath}`);
  }

  printBoard(results, overlaps);

  // 全部平台失败才算业务失败（exit 1），部分失败仅提示
  if (okCount === 0) emit({ ...payload, ok: false }, 1);
  emit({ ...payload, ok: true });
}

main().catch((e) => fail(e.message));
