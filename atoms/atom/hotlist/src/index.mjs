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

const args = parseArgs();
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

// 人读打印：终端直接看榜
function printBoard(results, overlaps) {
  for (const r of Object.values(results)) {
    if (!r.ok) {
      log(`\n【${r.label}】✗ ${r.error}`);
      continue;
    }
    const ts = r.meta?.active_time ? `  (榜单时间 ${r.meta.active_time})` : "";
    log(`\n【${r.label}】${r.count} 条${ts}`);
    r.items.slice(0, 12).forEach((it) => {
      log(`  ${String(it.rank).padStart(2)}. ${it.title}${it.heat ? "  🔥" + it.heat : ""}`);
    });
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
