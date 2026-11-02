#!/usr/bin/env node
// tts-audio：文稿 → mp3 音频（edge-tts，微软免费接口，无需 key）
// 用法：
//   node atom/tts-audio/src/index.mjs --text-file script.md --out audio.mp3
//   node atom/tts-audio/src/index.mjs --text "直接给的文稿" --out audio.mp3 --voice zh-CN-YunxiNeural
//   node atom/tts-audio/src/index.mjs --json article.json --out audio.mp3   # 读 article.script
//   node atom/tts-audio/src/index.mjs --plan script.md                      # 只估算分块与时长
// stdout：{ ok, out, chunks, bytes, est_duration_sec, voice }

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { cleanScript, splitScript } from "./lib/script.mjs";
import { concatMp3, estimateDurationSec } from "./lib/concat.mjs";

const args = parseArgs();

// 取文稿：--json 读 article.script/body_markdown，--text-file 读文件，--text 直接给
function loadScript() {
  if (args.json) {
    const p = resolve(String(args.json));
    if (!existsSync(p)) fail(`JSON 不存在：${p}`);
    const a = JSON.parse(readFileSync(p, "utf8"));
    const s = a.script || a.body_markdown || "";
    if (!s.trim()) fail("JSON 里既没有 script 也没有 body_markdown");
    return { raw: s, voice: a.voice || null, title: a.title || "" };
  }
  if (args["text-file"]) {
    const p = resolve(String(args["text-file"]));
    if (!existsSync(p)) fail(`文稿不存在：${p}`);
    return { raw: readFileSync(p, "utf8"), voice: null, title: "" };
  }
  if (args.text) return { raw: String(args.text), voice: null, title: "" };
  fail("需要 --text / --text-file / --json 之一");
}

async function main() {
  const { raw, voice: jsonVoice, title } = loadScript();
  const maxChunk = Number(args["max-chunk"] || 400);

  const script = cleanScript(raw);
  if (!script) fail("清理后文稿为空（可能只有图片/表格，没有可朗读文字）");
  const chunks = splitScript(script, maxChunk);

  const voice = String(args.voice || jsonVoice || process.env.TTS_VOICE || "zh-CN-XiaoxiaoNeural");
  const rate = String(args.rate || process.env.TTS_RATE || "default");
  const format = String(args.format || process.env.TTS_FORMAT || "audio-24khz-96kbitrate-mono-mp3");

  log(`文稿 ${script.length} 字 → ${chunks.length} 段（每段 ≤${maxChunk} 字）`);
  log(`音色 ${voice} / 语速 ${rate}`);

  // --plan：只报告分块情况，不生成音频（估算时长按中文播报约 4.5 字/秒）
  if (args.plan) {
    const est = Math.round(script.length / 4.5);
    for (let i = 0; i < Math.min(chunks.length, 5); i++) log(`  段${i + 1}（${chunks[i].length} 字）：${chunks[i].slice(0, 40)}…`);
    if (chunks.length > 5) log(`  …共 ${chunks.length} 段`);
    emit({ ok: true, plan: true, chars: script.length, chunks: chunks.length, est_duration_sec: est, voice }, EXIT.OK);
    return;
  }

  if (!args.out) fail("需要 --out 输出 mp3 路径");
  const outPath = resolve(String(args.out));
  mkdirSync(dirname(outPath), { recursive: true });

  // 动态导入：node-edge-tts 是可选依赖，--plan 模式下不该强制加载
  let EdgeTTS;
  try {
    ({ EdgeTTS } = await import("node-edge-tts"));
  } catch {
    fail("缺少依赖 node-edge-tts，请先运行 npm install");
  }

  const tts = new EdgeTTS({
    voice,
    lang: String(args.lang || "zh-CN"),
    rate,
    pitch: String(args.pitch || "default"),
    volume: String(args.volume || "default"),
    outputFormat: format,
    proxy: process.env.HTTPS_PROXY || process.env.https_proxy || undefined,
    timeout: Number(process.env.TTS_TIMEOUT || 30000),
  });

  // 分块生成临时文件：任何一段失败都整体失败，不产出半截音频
  const tmpDir = join(tmpdir(), `tts-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const parts = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const partPath = join(tmpDir, `part-${String(i).padStart(3, "0")}.mp3`);
      log(`  第 ${i + 1}/${chunks.length} 段…`);
      await tts.ttsPromise(chunks[i], partPath);
      parts.push(partPath);
    }
    const { bytes } = concatMp3(parts, outPath);
    const est = estimateDurationSec(bytes);
    log(`✓ 音频已生成：${outPath}（${(bytes / 1024 / 1024).toFixed(2)} MB，约 ${Math.floor(est / 60)} 分 ${est % 60} 秒）`);

    // 顺便把清理后的朗读稿落盘，便于人工核对「读到的是不是想要的」
    const scriptPath = outPath.replace(/\.mp3$/i, "") + ".script.txt";
    writeFileSync(scriptPath, script + "\n");

    emit({ ok: true, out: outPath, script: scriptPath, chunks: chunks.length, bytes, est_duration_sec: est, voice, title }, EXIT.OK);
  } finally {
    // 无论成败都清理临时分块
    for (const p of parts) {
      try {
        unlinkSync(p);
      } catch {
        /* 已被清理 */
      }
    }
  }
}

main().catch((e) => fail(e.message));
