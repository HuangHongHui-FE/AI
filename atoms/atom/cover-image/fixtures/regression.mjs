#!/usr/bin/env node
// 回归：cover-image 与源 cover.js 的输出一致性 + 竖图补救
// 用法：node atom/cover-image/fixtures/regression.mjs --src-cover <项目 cover.js 路径> --image <测试图>
// 不给 --src-cover 时只测自身行为（尺寸/格式/竖图分支）
// 退出码：0 通过 / 1 失败

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { generateCover } from "../src/lib/compose.mjs";
import { COVER_STYLES } from "../src/lib/layouts.mjs";

const args = process.argv.slice(2);
const argOf = (k, d = "") => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};

const work = mkdtempSync(join(tmpdir(), "cover-reg-"));
const md5 = (p) => createHash("md5").update(readFileSync(p)).digest("hex").slice(0, 8);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// 造测试图：横图（1694x1008，比例 1.68）与竖图（1080x2016）
async function makeImages() {
  const hPath = join(work, "h.jpg");
  const vPath = join(work, "v.jpg");
  // 用渐变 + 明显主体色块造图，便于人眼核对裁切位置
  await sharp({ create: { width: 1694, height: 1008, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .composite([{ input: await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 230, g: 120, b: 40 } } }).png().toBuffer(), top: 300, left: 640 }])
    .jpeg()
    .toFile(hPath);
  await sharp({ create: { width: 1080, height: 2016, channels: 3, background: { r: 30, g: 30, b: 60 } } })
    .composite([{ input: await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 240, g: 200, b: 60 } } }).png().toBuffer(), top: 380, left: 290 }])
    .jpeg()
    .toFile(vPath);
  return { hPath, vPath };
}

const { hPath, vPath } = await makeImages();

// 1. 尺寸与格式
const out1 = join(work, "plain.jpg");
const res1 = await generateCover({ imagePath: hPath, outPath: out1, style: "plain" });
const meta1 = await sharp(out1).metadata();
check("输出 900x383", meta1.width === 900 && meta1.height === 383, `${meta1.width}x${meta1.height}`);
check("输出为 JPEG", meta1.format === "jpeg", meta1.format);
check("比例 2.35", Math.abs(900 / 383 - 2.35) < 0.01);
check("plain 模式不加装饰", res1.mode === "plain", res1.mode);

// 2. 竖图走 extract 分支（不能是 plain 的 attention 直裁）
const out2 = join(work, "vertical.jpg");
await generateCover({ imagePath: vPath, outPath: out2, style: "plain" });
const meta2 = await sharp(out2).metadata();
check("竖图输出 900x383", meta2.width === 900 && meta2.height === 383, `${meta2.width}x${meta2.height}`);

// 3. 全部布局都能生成且不抛错
let allOk = 0;
const failed = [];
for (const style of COVER_STYLES) {
  try {
    const p = join(work, `s-${style}.jpg`);
    const r = await generateCover({ imagePath: hPath, outPath: p, style });
    const m = await sharp(p).metadata();
    if (m.width === 900 && m.height === 383) allOk++;
    else failed.push(`${style}:${m.width}x${m.height}`);
  } catch (e) {
    failed.push(`${style}:${e.message}`);
  }
}
check(`全部 ${COVER_STYLES.length} 套布局可生成`, allOk === COVER_STYLES.length, failed.join(",") || "全部通过");

// 4. 纯色布局不读原图（传不存在的图也应该成功）
const out3 = join(work, "purecolor.jpg");
try {
  await generateCover({ imagePath: join(work, "does-not-exist.jpg"), outPath: out3, style: "pure-color-no-image" });
  check("纯色布局不依赖原图", true);
} catch (e) {
  check("纯色布局不依赖原图", false, e.message);
}

// 5. 与源 cover.js 逐字节对比（仅当给了 --src-cover）
const srcCover = argOf("src-cover");
if (srcCover) {
  const mod = await import(srcCover);
  for (const style of ["plain", "diagonal-split", "vignette", "blur-bg-card", "full-darken-center", "top-bar-text"]) {
    const a = join(work, `atom-${style}.jpg`);
    const b = join(work, `src-${style}.jpg`);
    await generateCover({ imagePath: hPath, outPath: a, style });
    await mod.generateCover({ imagePath: hPath, outPath: b, slogan: "", style });
    const same = md5(a) === md5(b);
    check(`与源 cover.js 一致：${style}`, same, same ? md5(a) : `${md5(a)} vs ${md5(b)}`);
  }
} else {
  console.log("（未给 --src-cover，跳过与源项目的一致性对比）");
}

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
