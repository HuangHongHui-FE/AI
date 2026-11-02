#!/usr/bin/env node
// write-article：定「这篇该长什么样」——抽维度 + 拼写作 prompt + 校验成稿
// 它不自己写正文（正文由 Claude 写），负责两件事：
//   ① plan  ：给事实 + 避撞清单，产出可直接喂模型的写作 prompt
//   ② verify：把写好的 article.json 按本篇维度 + 硬约束校验
// 用法：
//   node atom/write-article/src/index.mjs --topic "美舰闯南沙" --facts facts-raw.json --dedup dedup.json --out-dir 04-write-article
//   node atom/write-article/src/index.mjs --verify article.json --dims dims.json
// stdout：plan 模式 { ok, prompt, dims, details } / verify 模式 { ok, errors, warns }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { buildPrompt } from "./lib/prompt.mjs";
import { verifyArticle } from "./lib/verify.mjs";

const args = parseArgs();

// 读 JSON 文件；不存在时返回 null（可选输入）
function readJson(p) {
  if (!p) return null;
  const abs = resolve(String(p));
  if (!existsSync(abs)) fail(`文件不存在：${abs}`);
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    fail(`${p} 不是合法 JSON：${e.message}`);
  }
}

async function main() {
  // verify 模式：校验已写好的稿件
  if (args.verify) {
    const article = readJson(args.verify);
    if (!article) fail("--verify 需要稿件路径");
    const dims = readJson(args.dims);
    const res = verifyArticle(article, dims);
    if (!args.quiet) {
      log(`\nwrite-article verify：${article.title || "（无标题）"}`);
      for (const w of res.warns) log(`  ⚠ ${w}`);
      for (const e of res.errors) log(`  ✗ ${e}`);
      log(res.ok ? "\n✓ 稿件符合本篇维度与硬约束" : `\n✗ ${res.errors.length} 处不符合，须回炉`);
    }
    const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "verify.json"), JSON.stringify(res, null, 2) + "\n");
    }
    emit(res, res.ok ? EXIT.OK : EXIT.BIZ);
    return;
  }

  // plan 模式：产出写作 prompt
  const topic = String(args.topic || args._[0] || "").trim();
  if (!topic) fail("需要 --topic 热点主题");

  const factsRaw = readJson(args.facts);
  const facts = factsRaw?.facts || (Array.isArray(factsRaw) ? factsRaw : []);
  const dedupRaw = readJson(args.dedup);

  // dedup 输入可以是 dedup-log 的 result.json（含 dims）或直接含 prompt 的对象
  const dedup = dedupRaw
    ? { dims: dedupRaw.dims || {}, prompt: dedupRaw.prompt || "" }
    : null;

  const images = Number(args.images || 0);
  const { prompt, dims, details } = buildPrompt({
    topic,
    facts,
    dedup,
    images,
    variants: { title: args.title ? String(args.title) : "" },
  });

  log(`✓ 已生成本篇写作 prompt（${facts.length} 条事实 / ${Object.keys(dims).length} 个维度）`);
  for (const [k, v] of Object.entries(details)) log(`  · ${v.label}：${v.name}`);

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "prompt.md"), prompt + "\n");
    writeFileSync(join(outDir, "dims.json"), JSON.stringify({ dims, details }, null, 2) + "\n");
    log(`已落盘：${join(outDir, "prompt.md")} / dims.json`);
  }

  emit({ ok: true, prompt, dims, details }, EXIT.OK);
}

main().catch((e) => fail(e.message));
