#!/usr/bin/env node
// dedup-log：读历史发文日志，算近 N 篇各维度的避撞清单；也可把本篇维度追加回日志
// 用法：
//   node atom/dedup-log/src/index.mjs --logs <日志目录> [--n 5]
//   node atom/dedup-log/src/index.mjs --logs <目录> --n 5 --out-dir <步骤目录>   # 同时落 result.json + prompt.md
//   node atom/dedup-log/src/index.mjs --logs <目录> --exclude-only              # 只输出排除列表
//   node atom/dedup-log/src/index.mjs --logs <目录> --append dims.json         # 把本篇维度写回日志
// stdout：{ ok, dims:{维度:{used,crowded,exclude}}, title_words, emotion_tail, ... }
// stderr：可直接拼进写作 prompt 的人读文本

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { analyze, renderPrompt } from "./lib/analyze.mjs";
import { appendArticle } from "./lib/append.mjs";

const args = parseArgs();

// 追加模式：dims.json = { date, no, title, dims:{...}, note? }
function doAppend(logsDir) {
  const p = resolve(String(args.append));
  if (!existsSync(p)) fail(`维度文件不存在：${p}`);
  let payload;
  try {
    payload = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`维度文件不是合法 JSON：${e.message}`);
  }
  for (const k of ["date", "no", "title", "dims"]) {
    if (!payload[k]) fail(`维度文件缺少 ${k}`);
  }
  const res = appendArticle({
    logsDir,
    date: String(payload.date),
    no: Number(payload.no),
    title: String(payload.title),
    dims: payload.dims,
    note: payload.note || "",
  });
  log(`✓ 追加：${res.file}（${res.action}${res.added ? `，补 ${res.added} 行` : ""}）`);
  emit({ ok: true, mode: "append", ...res }, 0);
}

function main() {
  if (!args.logs) fail("需要 --logs 历史日志目录");
  const logsDir = resolve(String(args.logs));
  if (!existsSync(logsDir)) fail(`日志目录不存在：${logsDir}`);

  if (args.append) {
    doAppend(logsDir);
    return;
  }

  const n = Number(args.n || 5);
  if (!Number.isInteger(n) || n < 1) fail("--n 必须是正整数");

  const res = analyze(logsDir, n);

  // --exclude-only：最小输出，只要各维度的排除值（recipe 拼参数时用）
  if (args["exclude-only"]) {
    const exclude = Object.fromEntries(Object.entries(res.dims).map(([k, d]) => [k, d.exclude]));
    emit({ ok: true, n, exclude, emotion_tail_over: res.emotion_tail.over_limit, title_words_used: res.title_words.used.map((w) => w.word) }, 0);
    return;
  }

  const prompt = renderPrompt(res, n);
  log(prompt);

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(res, null, 2) + "\n");
    writeFileSync(join(outDir, "prompt.md"), prompt + "\n");
    log(`\n已落盘：${join(outDir, "result.json")} / prompt.md`);
  }

  emit(res, 0);
}

try {
  main();
} catch (e) {
  fail(e.message);
}
