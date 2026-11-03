#!/usr/bin/env node
// fund-ocr：基金持仓截图 → 逐条切片 → OCR 文本
// 用法：
//   node atom/fund-ocr/src/index.mjs --image shot.jpg --out-dir ocr/
//   node atom/fund-ocr/src/index.mjs --image shot.jpg --out-dir ocr/ --plan   # 只切片，不 OCR
// stdout：{ ok, image, width, height, strips, files, ocr }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { sliceImage } from "./lib/slice.mjs";

const args = parseArgs({
  known: ["image", "out-dir", "strip-height", "overlap", "width", "start-y", "lang", "plan", "quiet"],
});

async function main() {
  if (!args.image) fail("需要 --image 截图路径");
  const image = resolve(String(args.image));
  if (!existsSync(image)) fail(`图片不存在：${image}`);

  const outDir = resolve(String(args["out-dir"] || join(process.cwd(), "fund-ocr")));
  mkdirSync(outDir, { recursive: true });

  const sliced = await sliceImage(image, outDir, {
    stripHeight: Number(args["strip-height"] || 55),
    overlap: Number(args.overlap || 5),
    width: Number(args.width || 1200),
    startY: Number(args["start-y"] || 40),
  });
  writeFileSync(join(outDir, "strips.json"), JSON.stringify(sliced, null, 2) + "\n");

  const files = sliced.strips.map((s) => s.file);
  const payload = {
    ok: true,
    image,
    width: sliced.width,
    height: sliced.height,
    strips: sliced.strips.length,
    files,
    ocr: false,
  };

  if (args.plan) {
    if (!args.quiet) log(`✓ 已切 ${sliced.strips.length} 条（--plan，不 OCR）→ ${outDir}`);
    emit(payload, 0);
    return;
  }

  // tesseract.js 是可选依赖：只做 OCR 时才加载
  let Tesseract;
  try {
    const mod = await import("tesseract.js");
    Tesseract = mod.default || mod;
  } catch {
    fail("tesseract.js 未安装：在 atoms 根目录执行 npm install（或先用 --plan 只切片）");
  }

  const lang = String(args.lang || "chi_sim+eng");
  const worker = await Tesseract.createWorker(lang, undefined, { cachePath: join(outDir, ".tessdata") });
  const texts = [];
  try {
    for (const s of sliced.strips) {
      const { data } = await worker.recognize(s.file);
      const text = String(data.text || "").replace(/\s+/g, " ").trim();
      texts.push({ ...s, text });
      if (!args.quiet) process.stderr.write(`\rOCR ${texts.length}/${sliced.strips.length}`);
    }
  } finally {
    await worker.terminate();
  }
  if (!args.quiet) process.stderr.write("\n");

  const nonEmpty = texts.filter((t) => t.text);
  writeFileSync(join(outDir, "ocr.json"), JSON.stringify(texts, null, 2) + "\n");
  writeFileSync(join(outDir, "text.txt"), nonEmpty.map((t) => t.text).join("\n") + "\n");

  if (!args.quiet) {
    log(`✓ OCR ${nonEmpty.length}/${texts.length} 条有文字 → ${outDir}`);
  }
  emit({ ...payload, ocr: true, text_file: join(outDir, "text.txt"), ocr_file: join(outDir, "ocr.json") }, 0);
}

main().catch((e) => fail(e.message));