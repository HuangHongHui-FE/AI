#!/usr/bin/env node
// title-hook：热点原词 → 合规标题（压缩/补全）+ 硬底线校验 + 与近 N 篇去重
// 用法：
//   node atom/title-hook/src/index.mjs --raw "西藏泥石流已致3人遇难265人失联"
//   node atom/title-hook/src/index.mjs --raw "某原词" --check "我写好的标题"     # 校验候选标题
//   node atom/title-hook/src/index.mjs --raw "..." --event "泥石流" --dedup dedup.json --out-dir 01-title
// stdout：{ ok, raw, final, chars, compressed, expanded, errors, warns, duplicates }

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { checkTitle, compressTitle, expandTitle, charCount, MAX_CHARS } from "./lib/title.mjs";

const args = parseArgs();

// 从 dedup 结果里取近 N 篇的标题原词，判断是否撞车
function findDuplicates(dedupPath, title) {
  if (!dedupPath) return [];
  const p = resolve(String(dedupPath));
  if (!existsSync(p)) fail(`dedup 文件不存在：${p}`);
  const d = JSON.parse(readFileSync(p, "utf8"));
  const words = d?.title_words?.used || [];
  const norm = (s) => String(s || "").replace(/^贴原词-/, "").trim();
  const t = norm(title);
  return words.filter((w) => norm(w.word) === t).map((w) => w.id || w.word);
}

async function main() {
  const raw = String(args.raw || args._[0] || "").trim();
  if (!raw) fail("需要 --raw 热点原词（热榜标题原文）");

  // --check：直接校验候选标题，不做压缩
  if (args.check) {
    const cand = String(args.check);
    const v = checkTitle(cand);
    const dups = findDuplicates(args.dedup, cand);
    if (dups.length) v.errors.push(`与近篇标题原词重复：${dups.join("、")}——须换原词或换压缩方式`);
    v.ok = v.errors.length === 0;

    log(`\n标题校验：${cand}（${charCount(cand)} 字）`);
    for (const w of v.warns) log(`  ⚠ ${w}`);
    for (const e of v.errors) log(`  ✗ ${e}`);
    log(v.ok ? "\n✓ 通过" : "\n✗ 不通过");

    const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "result.json"), JSON.stringify({ ok: v.ok, title: cand, ...v }, null, 2) + "\n");
    }
    emit({ ok: v.ok, title: cand, chars: charCount(cand), errors: v.errors, warns: v.warns, duplicates: dups }, v.ok ? EXIT.OK : EXIT.BIZ);
    return;
  }

  // 正常流程：原词 → 压缩/补全 → 校验 → 去重
  let { title, compressed, note } = compressTitle(raw);
  const exp = expandTitle(title, { event: args.event ? String(args.event) : "" });
  if (exp.expanded) {
    title = exp.title;
    note = exp.note;
  }

  const v = checkTitle(title);
  const dups = findDuplicates(args.dedup, title);
  if (dups.length) v.errors.push(`与近篇标题原词重复：${dups.join("、")}——须换原词或换压缩方式`);

  const ok = v.errors.length === 0;
  log(`\n原词：${raw}（${charCount(raw)} 字）`);
  if (compressed) log(`压缩：${title}（${charCount(title)} 字）—— ${note}`);
  else if (exp.expanded) log(`补全：${title}（${charCount(title)} 字）—— ${note}`);
  else log(`标题：${title}（${charCount(title)} 字）`);
  for (const w of v.warns) log(`  ⚠ ${w}`);
  for (const e of v.errors) log(`  ✗ ${e}`);
  log(ok ? "\n✓ 标题可用" : "\n✗ 标题不合格，须重起");

  const result = {
    ok,
    raw,
    final: title,
    chars: charCount(title),
    max_chars: MAX_CHARS,
    compressed,
    expanded: exp.expanded,
    note,
    errors: v.errors,
    warns: v.warns,
    duplicates: dups,
    // 日志记录用：2026-08-27 起 title_style 固定记「贴原词-<标题>」
    title_style: `贴原词-${title}`,
  };

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "title.json"), JSON.stringify(result, null, 2) + "\n");
  }

  emit(result, ok ? EXIT.OK : EXIT.BIZ);
}

main().catch((e) => fail(e.message));
