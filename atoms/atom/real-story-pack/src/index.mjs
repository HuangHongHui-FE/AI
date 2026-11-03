#!/usr/bin/env node
// real-story-pack：真人真事包装——给初稿加「真实感滤镜」
//   plan  ：产出包装 prompt（12 类锚点 + 红线），改写由 Claude 做
//   verify：校验包装后的稿件是否命中 ≥8 类锚点、是否踩红线
// 用法：
//   node atom/real-story-pack/src/index.mjs --article draft.json --out-dir 03-real-story-pack
//   node atom/real-story-pack/src/index.mjs --verify packed.json
// stdout：plan { ok, prompt, anchor_ids } / verify { ok, score, anchors, missing, ... }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { buildPackPrompt } from "./lib/prompt.mjs";
import { verifyPack } from "./lib/verify.mjs";

const args = parseArgs({ known: ["article", "verify", "out-dir", "min", "quiet"] });
const MIN = Number(args.min || 8);

// 读稿件：.json 按结构读，其余按纯 markdown 读
function readArticle(p) {
  const abs = resolve(String(p));
  if (!existsSync(abs)) fail(`文件不存在：${abs}`);
  const raw = readFileSync(abs, "utf8");
  if (extname(abs).toLowerCase() !== ".json") return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${p} 不是合法 JSON：${e.message}`);
  }
}

function main() {
  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) mkdirSync(outDir, { recursive: true });

  // verify 模式
  if (args.verify) {
    const res = verifyPack(readArticle(args.verify), { min: MIN });
    if (!args.quiet) {
      log(`\nreal-story-pack verify：命中 ${res.score}/${res.min} 类`);
      for (const a of res.anchors) log(`  ${a.found ? "✓" : "✗"} ${a.name}${a.evidence ? ` — ${a.evidence}` : ""}`);
      for (const w of res.warns) log(`  ⚠ ${w}`);
      for (const a of res.abstract) log(`  ⚠ 抽象表达「${a.text}」：${a.hint}`);
      for (const r of res.red_lines) log(`  ✗ 红线「${r.name}」：${r.evidence}`);
      log(res.ok ? "\n✓ 真实感锚点与红线均通过" : `\n✗ 未通过（缺 ${res.missing.length} 类，红线 ${res.red_lines.length} 处）`);
    }
    if (outDir) writeFileSync(join(outDir, "verify.json"), JSON.stringify(res, null, 2) + "\n");
    emit(res, res.ok ? EXIT.OK : EXIT.BIZ);
    return;
  }

  // plan 模式
  if (!args.article) fail("需要 --article 初稿路径（或 --verify 校验稿件）");
  const { prompt, anchor_ids } = buildPackPrompt(readArticle(args.article), { min: MIN });

  log(`✓ 已生成真人真事包装 prompt（12 类锚点，至少命中 ${MIN} 类）`);
  if (outDir) {
    writeFileSync(join(outDir, "prompt.md"), prompt + "\n");
    writeFileSync(join(outDir, "anchors.json"), JSON.stringify({ min: MIN, anchor_ids }, null, 2) + "\n");
    log(`已落盘：${join(outDir, "prompt.md")} / anchors.json`);
  }

  emit({ ok: true, prompt, anchor_ids }, EXIT.OK);
}

main();