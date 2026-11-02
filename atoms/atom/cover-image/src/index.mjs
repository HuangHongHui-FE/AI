#!/usr/bin/env node
// cover-image：把一张图裁成公众号封面 2.35:1（900x383），默认纯图不叠字
// 用法：
//   node atom/cover-image/src/index.mjs --image 001-主图.jpg --out cover.jpg [--style plain]
//   node atom/cover-image/src/index.mjs --image x.jpg --out cover.jpg --random --exclude plain,vignette
//   node atom/cover-image/src/index.mjs --list     # 列出所有布局
// 输出：stdout 为 { ok, file, style, w, h, mode }

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { COVER_STYLES, pickRandomCoverStyle } from "./lib/layouts.mjs";
import { generateCover } from "./lib/compose.mjs";

const args = parseArgs();

async function main() {
  // --list 只打印布局名，方便 recipe/用户选
  if (args.list) {
    emit({ ok: true, styles: COVER_STYLES, count: COVER_STYLES.length }, 0);
    return;
  }

  if (!args.image) fail("需要 --image 原图路径");
  if (!args.out) fail("需要 --out 封面输出路径（.jpg）");
  const imagePath = resolve(String(args.image));
  if (!existsSync(imagePath)) fail(`原图不存在：${imagePath}`);
  const outPath = resolve(String(args.out));
  if (!/\.jpe?g$/i.test(outPath)) fail("--out 必须是 .jpg/.jpeg（微信封面只收 JPEG）");

  // 布局选择：--random 随机避撞 > --style 显式 > 默认 plain（2026-08-26 起纯图）
  const exclude = args.exclude ? String(args.exclude).split(",").map((s) => s.trim()) : [];
  const style = args.random ? pickRandomCoverStyle(exclude) : String(args.style || "plain");
  if (!COVER_STYLES.includes(style)) {
    log(`⚠ 未知布局「${style}」，回退 plain；可选：${COVER_STYLES.join(", ")}`);
  }

  const res = await generateCover({ imagePath, outPath, style });
  log(`✓ 封面 ${res.w}x${res.h} 布局=${res.style} 模式=${res.mode} → ${res.outPath}`);
  emit({ ok: true, file: res.outPath, style: res.style, w: res.w, h: res.h, mode: res.mode, ratio: (res.w / res.h).toFixed(2) }, 0);
}

main().catch((e) => fail(e.message));
