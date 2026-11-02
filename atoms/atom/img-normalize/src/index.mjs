#!/usr/bin/env node
// img-normalize：任意图片 → 标准 JPEG；可选按目标比例模糊填充
// 用法：
//   node atom/img-normalize/src/index.mjs --src a.jpg --out b.jpg                    # 单张转 JPEG
//   node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/               # 整目录转 JPEG
//   node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/ --preset tietu-9x16
//   node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/ --width 1080 --height 1920
//   node atom/img-normalize/src/index.mjs --check-dir in/                            # 只检查真实格式，不改文件
// stdout：{ ok, count, mode, images:[], failed:[] }

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { sniffFormat } from "../../../_shared/sniff.mjs";
import { PRESETS, normalizeOne, normalizeDir } from "./lib/normalize.mjs";

const args = parseArgs();

// 解析目标尺寸：--preset 优先，其次 --width/--height 同时给
function resolveTarget() {
  if (args.preset) {
    const p = PRESETS[String(args.preset)];
    if (!p) fail(`未知 preset「${args.preset}」，可选：${Object.keys(PRESETS).join(", ")}`);
    return p;
  }
  if (args.width && args.height) {
    const w = Number(args.width);
    const h = Number(args.height);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) fail("--width/--height 必须是正整数");
    return { w, h };
  }
  return null;
}

// 只检查真实格式：命中「扩展名是 jpg 但实际是 webp/png」的坑
function checkDir(dir) {
  const bad = [];
  const okList = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) continue;
    const fmt = sniffFormat(readFileSync(join(dir, name)));
    const claimed = extname(name).slice(1).toLowerCase().replace("jpeg", "jpg");
    const actual = fmt || "unknown";
    if (actual !== claimed) bad.push({ file: name, claimed, actual });
    else okList.push({ file: name, format: actual });
  }
  return { okList, bad };
}

async function main() {
  const target = resolveTarget();
  const quality = Number(args.quality || 88);

  // --check-dir：只报告，不改文件、不落盘
  if (args["check-dir"]) {
    const dir = resolve(String(args["check-dir"]));
    if (!existsSync(dir)) fail(`目录不存在：${dir}`);
    const { okList, bad } = checkDir(dir);
    if (bad.length) log(`⚠ ${bad.length} 个文件扩展名与实际格式不符（微信会报 40137）：`);
    for (const b of bad) log(`  - ${b.file}：叫 .${b.claimed} 实际是 ${b.actual}`);
    emit({ ok: bad.length === 0, checked: okList.length + bad.length, ok_files: okList.length, mismatched: bad }, bad.length ? EXIT.BIZ : EXIT.OK);
    return;
  }

  // 单张模式
  if (args.src && !args["src-dir"]) {
    const src = resolve(String(args.src));
    if (!existsSync(src)) fail(`源文件不存在：${src}`);
    if (!args.out) fail("单张模式需要 --out 输出路径");
    const out = resolve(String(args.out));
    if (!/\.jpe?g$/i.test(out)) fail("--out 必须是 .jpg");
    const res = await normalizeOne(readFileSync(src), { target, quality });
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, res.buf);
    log(`✓ ${basename(src)} → ${basename(out)} ${res.w}x${res.h} 原格式=${res.srcFormat} 模式=${res.mode}`);
    emit({ ok: true, file: out, w: res.w, h: res.h, src_format: res.srcFormat, mode: res.mode, bytes: res.buf.length }, EXIT.OK);
    return;
  }

  // 目录模式
  if (!args["src-dir"]) fail("需要 --src 单张或 --src-dir 目录");
  const srcDir = resolve(String(args["src-dir"]));
  if (!existsSync(srcDir)) fail(`源目录不存在：${srcDir}`);
  if (!args["out-dir"]) fail("目录模式需要 --out-dir 输出目录");
  const outDir = resolve(String(args["out-dir"]));

  const { items, failed } = await normalizeDir(srcDir, outDir, { target, quality });
  for (const it of items) log(`✓ ${it.file} ${it.w}x${it.h} ${it.srcFormat}→jpg ${it.mode}`);
  for (const f of failed) log(`✗ ${f.file}：${f.error}`);

  const res = {
    ok: failed.length === 0,
    count: items.length,
    preset: args.preset || (target ? `${target.w}x${target.h}` : "none"),
    images: items,
    failed,
  };
  if (args["out-dir"]) writeFileSync(join(outDir, "manifest.json"), JSON.stringify(res, null, 2) + "\n");
  emit(res, failed.length ? EXIT.BIZ : EXIT.OK);
}

main().catch((e) => fail(e.message));
