// 下载与图片处理：真实格式 sniff、统一转标准 JPEG、尺寸读取、按比例裁切
// 微信推草稿对格式敏感：扩展名是 .jpg 但实际是 WebP/PNG 会报 40137，必须先 sniff 再转

import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { fetchBuf } from "./http.mjs";
import { sniffFormat } from "../../../../_shared/sniff.mjs";

// 最小体积：低于此值基本是缩略图或占位图
const MIN_BYTES = 30000;

// 下载一张图并统一转成标准 JPEG
// 返回 { buf, w, h, fmt } 或 null（体积过小/非图片/下载失败）
export async function downloadAsJpeg(url, referer) {
  const raw = await fetchBuf(url, referer);
  if (!raw || raw.length < MIN_BYTES) return null;

  const fmt = sniffFormat(raw);
  if (!fmt) return null; // 不是已知图片格式

  try {
    const img = sharp(raw);
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    // 无论原格式是什么，一律转标准 JPEG（PNG/WebP 假 .jpg 会被微信拒）
    const buf = await img.jpeg({ quality: 85 }).toBuffer();
    return { buf, w: meta.width, h: meta.height, fmt };
  } catch {
    return null;
  }
}

// 按目标宽高比裁切（封面 2.35:1 用）
// 竖图/比例不足时，向上偏移裁切窗口，尽量保住主体（不裁掉顶部内容）
export async function cropToRatio(srcPath, ratio, outPath) {
  const img = sharp(srcPath);
  const { width: w, height: h } = await img.metadata();
  const current = w / h;
  if (Math.abs(current - ratio) < 0.01) {
    writeFileSync(outPath, await img.toBuffer()); // 比例已达标，仅复制
    return { w, h, cropped: false };
  }

  let cw = w;
  let ch = Math.round(w / ratio);
  let top = 0;
  if (ch > h) {
    // 图太窄：改成按高度裁宽度
    ch = h;
    cw = Math.round(h * ratio);
    const left = Math.round((w - cw) / 2);
    const buf = await img.extract({ left, top: 0, width: cw, height: ch }).jpeg({ quality: 88 }).toBuffer();
    writeFileSync(outPath, buf);
    return { w: cw, h: ch, cropped: true };
  }

  // 图太高：垂直方向裁。向上偏移到 20% 处，保住顶部主体（人脸/标题通常在上方）
  top = Math.round((h - ch) * 0.2);
  const buf = await img.extract({ left: 0, top, width: cw, height: ch }).jpeg({ quality: 88 }).toBuffer();
  writeFileSync(outPath, buf);
  return { w: cw, h: ch, cropped: true };
}

// 读取目录里已有图片的最大编号（续写时不覆盖）
export function nextIndex(dir) {
  let max = 0;
  try {
    for (const f of readdirSync(dir)) {
      const m = /^(\d+)-/.exec(f) || /^(\d+)\./.exec(f);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {
    /* 目录不存在时从 1 开始 */
  }
  return max + 1;
}

// 把 Buffer 落盘
export function saveJpeg(buf, dir, filename) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, filename);
  writeFileSync(p, buf);
  return p;
}
