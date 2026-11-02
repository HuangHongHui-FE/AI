#!/usr/bin/env node
// selfcheck：推草稿前硬门。任一 FAIL 则 exit 1（业务失败），由 recipe 决定是否回炉
// 用法：
//   node atom/selfcheck/src/index.mjs --article article.json --ruleset wechat-img --out-dir <步骤目录>
//   node atom/selfcheck/src/index.mjs --article a.json --ruleset podcast --quiet   # 只出 JSON
//   node atom/selfcheck/src/index.mjs --list                                        # 列规则集
// stdout：{ ok, ruleset, fails:[], warns:[], stats:{} }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { RULESETS, RULESET_NAMES } from "../references/rulesets.mjs";
import { selfcheck } from "./lib/engine.mjs";

const args = parseArgs();

async function main() {
  if (args.list) {
    emit({ ok: true, rulesets: RULESET_NAMES, count: RULESET_NAMES.length }, 0);
    return;
  }

  if (!args.article) fail("需要 --article 稿件 json 路径（含 title/digest/body_markdown）");
  const p = resolve(String(args.article));
  if (!existsSync(p)) fail(`稿件不存在：${p}`);

  let article;
  try {
    article = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`稿件不是合法 JSON：${e.message}`);
  }
  if (!article.body_markdown) fail("稿件缺少 body_markdown 字段");

  const name = String(args.ruleset || "wechat-img");
  const ruleset = RULESETS[name];
  if (!ruleset) fail(`未知规则集「${name}」，可选：${RULESET_NAMES.join(", ")}`);

  const res = selfcheck(article, ruleset);

  // 人读报告走 stderr，保持 stdout 只有结构化结果
  if (!args.quiet) {
    log(`\nselfcheck[${res.ruleset}]：${article.title}`);
    log(`字数：标题 ${res.stats.title_chars} / 摘要 ${res.stats.digest_chars} / 正文 ${res.stats.body_chars}`);
    log(`加粗 ${res.stats.bolds} / 引言 ${res.stats.quotes} / 段落 ${res.stats.paragraphs}`);
    if (res.warns.length) {
      log("\n⚠ WARN：");
      for (const w of res.warns) log(`  - ${w.message}`);
    }
    if (res.fails.length) {
      log(`\n✗ FAIL ${res.fails.length} 条（拒推，回炉）：`);
      for (const f of res.fails) log(`  - ${f.message}`);
    } else {
      log("\n✓ 通过硬门，可推草稿");
    }
  }

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(res, null, 2) + "\n");
    // 正文单独落盘：下游 format-html 要的是纯 markdown，不该让它去解析 article.json
    if (article.body_markdown) writeFileSync(join(outDir, "body.md"), article.body_markdown.trim() + "\n");
  }

  emit(res, res.ok ? EXIT.OK : EXIT.BIZ);
}

main().catch((e) => fail(e.message));
