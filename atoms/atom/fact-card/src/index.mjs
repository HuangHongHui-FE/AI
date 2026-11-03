#!/usr/bin/env node
// fact-card：校验事实卡，通过后归一输出 facts.json（供 write-article 消费）
// 用法：
//   node atom/fact-card/src/index.mjs --facts facts/xxx.json --out-dir 03-fact-card
//   node atom/fact-card/src/index.mjs --facts-dir facts/            # 批量校验
//   node atom/fact-card/src/index.mjs --facts x.json --today 2026-10-30   # 指定今天（默认取本地日期）
// stdout：{ ok, errors:[], warnings:[], stats:{} }；FAIL 时 exit 1

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { validateEvent, isOngoing, splitByParts } from "./lib/validate.mjs";

const args = parseArgs({ known: ["facts", "facts-dir", "today", "out-dir", "quiet"] });

// 本地日期 YYYY-MM-DD（不用 toISOString，那是 UTC，凌晨会差一天）
function todayLocal() {
  if (args.today) return String(args.today);
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 校验单张并输出归一结果
function checkOne(file, today) {
  let ev;
  try {
    ev = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { file: basename(file), ok: false, errors: [`不是合法 JSON：${e.message}`], warnings: [], stats: {} };
  }
  const v = validateEvent(ev, today);
  return {
    file: basename(file),
    slug: ev?.slug || "",
    name: ev?.name || "",
    ok: v.ok,
    errors: v.errors,
    warnings: v.warnings,
    stats: v.stats,
    // 附带切篇预览：有 parts 时给出每篇的节点数与标题，便于核对待写几篇
    parts: ev?.parts ? splitByParts(ev.nodes || [], ev).map((c, i) => ({ index: i + 1, title: c.title, nodes: c.nodes.length })) : null,
    ongoing: ev ? isOngoing(ev) : null,
  };
}

async function main() {
  const today = todayLocal();

  // 批量模式：校验目录下所有 json
  if (args["facts-dir"]) {
    const dir = resolve(String(args["facts-dir"]));
    if (!existsSync(dir)) fail(`目录不存在：${dir}`);
    const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (!files.length) fail(`目录下没有 json：${dir}`);
    const results = files.map((f) => checkOne(join(dir, f), today));
    const bad = results.filter((r) => !r.ok);
    for (const r of results) log(`${r.ok ? "✓" : "✗"} ${r.file}${r.ok ? "" : ` — ${r.errors.length} 条错误`}`);
    for (const r of bad) for (const e of r.errors) log(`    ✗ ${e}`);
    emit({ ok: bad.length === 0, today, count: results.length, results }, bad.length ? EXIT.BIZ : EXIT.OK);
    return;
  }

  if (!args.facts) fail("需要 --facts 事实卡路径 或 --facts-dir 目录");
  const file = resolve(String(args.facts));
  if (!existsSync(file)) fail(`事实卡不存在：${file}`);

  const res = checkOne(file, today);

  if (!args.quiet) {
    log(`\nfact-card：${res.name || res.file}（${today}）`);
    if (res.stats.nodes) {
      log(`节点 ${res.stats.nodes} 个 / 来源 ${res.stats.publishers} 家 / ${res.stats.first_date} → ${res.stats.last_date}${res.ongoing ? "（发展中）" : "（已结束）"}`);
    }
    if (res.parts) log(`切篇：${res.parts.map((p) => `第${p.index}篇「${p.title}」${p.nodes}节点`).join(" / ")}`);
    for (const w of res.warnings) log(`  ⚠ ${w}`);
    for (const e of res.errors) log(`  ✗ ${e}`);
    log(res.ok ? "\n✓ 校验通过，可进写作" : "\n✗ 校验未通过，须补来源/日期后再写");
  }

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(res, null, 2) + "\n");
    // 校验通过才落 facts.json 契约（下游 write-article 只读这个）
    if (res.ok) {
      const ev = JSON.parse(readFileSync(file, "utf8"));
      writeFileSync(join(outDir, "facts.json"), JSON.stringify(ev, null, 2) + "\n");
    }
  }

  emit(res, res.ok ? EXIT.OK : EXIT.BIZ);
}

main().catch((e) => fail(e.message));
