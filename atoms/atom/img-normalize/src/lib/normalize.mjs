// 图片归一：真实格式 sniff → 统一转标准 JPEG；可选按目标比例模糊填充（贴图 9:16）
// 为什么必须 sniff：扩展名 .jpg 的文件实际可能是 WebP/PNG，微信推草稿报 40137
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { sniffFormat } from "../../../../_shared/sniff.mjs";

// 目标画布预设：贴图用微信全屏竖图 1080x1920
export const PRESETS = {
  "tietu-9x16": { w: 1080, h: 1920 },
  "cover-2.35": { w: 900, h: 383 },
};

// 模糊填充：原图等比缩到画布内居中，背景 = 原图铺满画布后高斯模糊（不拉伸不变形）
async function blurFill(buf, { w, h }) {
  const fg = await sharp(buf).resize(w, h, { fit: "inside" }).toBuffer();
  const fgMeta = await sharp(fg).metadata();
  const bg = await sharp(buf).resize(w, h, { fit: "cover" }).blur(60).toBuffer();
  const left = Math.round((w - fgMeta.width) / 2);
  const top = Math.round((h - fgMeta.height) / 2);
  return sharp(bg).composite([{ input: fg, left, top }]).toBuffer();
}

// 单张归一：返回 { buf, w, h, srcFormat, mode }
// mode: passthrough（比例已达标，仅转 JPEG）/ blur-fill（模糊填充）
export async function normalizeOne(buf, { target = null, quality = 88 } = {}) {
  const fmt = sniffFormat(buf);
  if (!fmt) throw new Error("不是已知图片格式（jpg/png/webp/gif）");

  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error("无法读取图片尺寸");

  if (!target) {
    const out = await sharp(buf).jpeg({ quality }).toBuffer();
    return { buf: out, w: meta.width, h: meta.height, srcFormat: fmt, mode: "passthrough" };
  }

  const { w, h } = target;
  // 尺寸已完全一致：只转格式，避免无谓的二次编码损失
  if (meta.width === w && meta.height === h) {
    const out = await sharp(buf).jpeg({ quality }).toBuffer();
    return { buf: out, w, h, srcFormat: fmt, mode: "exact" };
  }

  const filled = await blurFill(buf, target);
  const out = await sharp(filled).jpeg({ quality }).toBuffer();
  return { buf: out, w, h, srcFormat: fmt, mode: "blur-fill" };
}

// 目录批量归一：只处理图片文件，同名写出到 outDir
export async function normalizeDir(srcDir, outDir, opts = {}) {
  mkdirSync(outDir, { recursive: true });
  const items = [];
  const failed = [];
  for (const name of readdirSync(srcDir).sort()) {
    if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) continue;
    try {
      const buf = readFileSync(join(srcDir, name));
      const res = await normalizeOne(buf, opts);
      writeFileSync(join(outDir, name), res.buf);
      items.push({ file: name, ...res, buf: undefined, bytes: res.buf.length });
    } catch (e) {
      failed.push({ file: name, error: e.message });
    }
  }
  return { items, failed };
}
