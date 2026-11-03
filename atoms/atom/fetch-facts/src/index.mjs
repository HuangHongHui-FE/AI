#!/usr/bin/env node
// fetch-facts：按热点关键词抓新闻事实条目（标题 + 摘要 + 来源），供写作用
// 用法：
//   node atom/fetch-facts/src/index.mjs --query "美舰闯南沙" --out-dir 03-fetch-facts
//   node atom/fetch-facts/src/index.mjs --query "上海抢金" --min 8 --json
// stdout：{ ok, query, count, facts:[{title, abstract, publisher, url}], sources:{} }
// 退出码：0 成功 / 1 一条都没抓到 / 2 参数错误

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { nowIso } from "../../../_shared/time.mjs";
import { toutiaoSearch, ensureUrls, clusterSummary } from "./lib/toutiao.mjs";

const args = parseArgs({ known: ["query", "variants", "min", "out-dir"] });

async function main() {
  const query = String(args.query || args._[0] || "").trim();
  if (!query) fail("需要 --query 热点关键词（如「美舰闯南沙」）");

  const min = Number(args.min || 3);
  if (!Number.isFinite(min) || min < 1) fail("--min 必须是正整数");

  const startedAt = nowIso();
  log(`抓取「${query}」的新闻事实…`);

  // 关键词变体：原词之外补几个常见角度词，提高不同媒体的召回
  // （头条搜索的分页 offset 实测无效，各页内容完全相同，扩召回只能靠换词）
  const variants = args.variants
    ? String(args.variants).split(",").map((s) => s.trim()).filter(Boolean)
    : [`${query} 回应`, `${query} 官方`, `${query} 通报`];

  const rows = await toutiaoSearch(query, { variants });
  const facts = ensureUrls(rows, query);

  // 来源统计：写到输出里，便于判断「是不是只有一家在报」
  const publishers = {};
  for (const f of facts) if (f.publisher) publishers[f.publisher] = (publishers[f.publisher] || 0) + 1;

  // 事件簇：同一事件的多家报道归组，一眼看出「这条新闻有几家在报」
  const clusters = clusterSummary(facts);

  const result = {
    ok: facts.length >= min,
    query,
    count: facts.length,
    min_required: min,
    publishers,
    publisher_count: Object.keys(publishers).length,
    clusters,
    facts,
    started_at: startedAt,
    finished_at: nowIso(),
  };

  log(`✓ 抓到 ${facts.length} 条（来自 ${result.publisher_count} 家媒体 / ${clusters.length} 个事件）`);
  for (const c of clusters) log(`  · [${c.count} 家] ${c.title.slice(0, 40)}${c.sources.length ? `（${c.sources.slice(0, 3).join("、")}）` : ""}`);
  if (facts.length < min) log(`⚠ 少于要求的 ${min} 条，可能需要换关键词或补其他源`);

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "facts-raw.json"), JSON.stringify(result, null, 2) + "\n");
    // 人读版：按来源分组，一眼看出哪几家在报
    const lines = [`# 「${query}」抓取结果（${facts.length} 条 / ${result.publisher_count} 家）`, ""];
    for (const f of facts) {
      lines.push(`## ${f.title}`);
      lines.push(`- 来源：${f.publisher || "未标注"}`);
      lines.push(`- 摘要：${f.abstract}`);
      if (!f.url_is_search) lines.push(`- 链接：${f.url}`);
      lines.push("");
    }
    writeFileSync(join(outDir, "facts.md"), lines.join("\n"));
    log(`已落盘：${join(outDir, "facts-raw.json")} / facts.md`);
  }

  emit(result, result.ok ? EXIT.OK : EXIT.BIZ);
}

main().catch((e) => fail(e.message));
