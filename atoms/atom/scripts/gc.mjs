#!/usr/bin/env node
// runs 清理：按配置的保留天数删除过期运行目录，避免图片堆积占满磁盘.
// 用法：node atom/scripts/gc.mjs [--days 30] [--dry-run]

import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { runsRoot } from "../../_shared/paths.mjs";
import { parseArgs, log, emit } from "../../_shared/io.mjs";

const args = parseArgs();
const keepDays = Number(args.days || process.env.RUNS_KEEP_DAYS || 30);
const dryRun = Boolean(args["dry-run"]);
const cutoff = Date.now() - keepDays * 24 * 3600 * 1000;
const root = runsRoot();

// 目录名形如 20261029-201500，解析成时间用于比较
function dirTime(name) {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

const removed = [];
const kept = [];

// 遍历 runs/<recipe>/<stamp> 两级结构
for (const recipe of readdirSync(root)) {
  const recipeDir = join(root, recipe);
  if (!statSync(recipeDir).isDirectory()) continue;
  for (const run of readdirSync(recipeDir)) {
    const t = dirTime(run);
    if (t === null) continue;
    const full = join(recipeDir, run);
    if (t < cutoff) {
      if (!dryRun) rmSync(full, { recursive: true, force: true });
      removed.push(`${recipe}/${run}`);
    } else kept.push(`${recipe}/${run}`);
  }
}

log(`${dryRun ? "[dry-run] " : ""}保留 ${kept.length} 个，清理 ${removed.length} 个（>${keepDays} 天）`);
emit({ keep_days: keepDays, dry_run: dryRun, removed, kept_count: kept.length });
