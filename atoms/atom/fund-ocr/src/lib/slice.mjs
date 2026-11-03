// 基金持仓截图切片：按固定高度逐条切，灰度+锐化后交给 OCR
// 源：project/forecast/ocr_strips.js（把 /tmp 路径参数化）
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export async function sliceImage(image, outDir, { stripHeight = 55, overlap = 5, width = 1200, startY = 40 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const meta = await sharp(image).metadata();
  const strips = [];
  let y = startY;
  let i = 0;
  while (y < meta.height - 20) {
    const h = Math.min(stripHeight, meta.height - y);
    const file = join(outDir, `strip-${String(i).padStart(3, "0")}.png`);
    await sharp(image)
      .extract({ left: 0, top: y, width: meta.width, height: h })
      .resize({ width, fit: "inside" })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(file);
    strips.push({ index: i, y, height: h, file });
    i++;
    y += Math.max(1, stripHeight - overlap);
  }
  return { width: meta.width, height: meta.height, strips };
}