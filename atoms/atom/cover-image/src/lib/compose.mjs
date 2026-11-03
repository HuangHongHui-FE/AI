// 封面合成：竖图/窄图先 extract 上移裁切窗口保主体，再按布局叠 SVG 装饰底
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import { COVER_W_H, LAYOUTS, wrapSvg } from "./layouts.mjs";

const { w: W, h: H, ratio: RATIO } = COVER_W_H;

// 某裁切窗口的灰度标准差：过低说明是纯色/空白区域（天花板、白墙），主体不在这里
async function regionStdev(img, width, height, top) {
  try {
    const buf = await img.clone().extract({ left: 0, top, width, height }).greyscale().toBuffer();
    const { channels } = await sharp(buf).stats();
    return channels[0].stdev;
  } catch {
    return 999; // 提取失败时按「有内容」处理，保持原有行为
  }
}

// 封面裁切窗口：横图用 attention 智能取主体；竖图/窄图 extract 上移保头部（人脸/标题多在上方）
async function cropBase(imagePath) {
  const img = sharp(imagePath);
  const meta = await img.metadata();
  const { width: w = 0, height: h = 0 } = meta;
  const cur = w / h;

  // 横图/近方图：用 attention 智能取主体（与源项目 cover.js 行为一致）
  if (cur >= 1.2) {
    const buf = await img.resize(W, H, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toBuffer();
    return { buf, pos: "attention" };
  }

  // 真竖图：默认上移 15% 保头部；若该窗口近乎纯色（天花板/白墙），说明主体在中下部，改取中心
  const cropW = w;
  const cropH = Math.min(h, Math.round(w / RATIO));
  const top15 = Math.round((h - cropH) * 0.15);
  const topCenter = Math.round((h - cropH) * 0.5);
  const lowInfo = (await regionStdev(img, cropW, cropH, top15)) < 40;
  const top = lowInfo ? topCenter : top15;
  const cropped = await img.extract({ left: 0, top, width: cropW, height: cropH }).toBuffer();
  const buf = await sharp(cropped).resize(W, H, { fit: "cover", position: "center" }).jpeg({ quality: 90 }).toBuffer();
  return { buf, pos: lowInfo ? "center-fallback" : "top15" };
}

// 生成封面：返回 { outPath, style, w, h, mode }
export async function generateCover({ imagePath, outPath, style = "plain" }) {
  const key = LAYOUTS[style] ? style : "plain";
  const layout = LAYOUTS[key];
  mkdirSync(dirname(outPath), { recursive: true });

  // 纯色底无图布局：整版 SVG 导出，不读原图（仍记录 mode 便于复盘）
  if (layout.pureColor) {
    const buf = await sharp(Buffer.from(wrapSvg(layout.bg), "utf8")).jpeg({ quality: 90 }).toBuffer();
    writeFileSync(outPath, buf);
    return { outPath, style: key, w: W, h: H, mode: "pure-color", crop: "none" };
  }

  const cropped = await cropBase(imagePath);
  let base = layout.blur
    ? await sharp(cropped.buf).blur(8).jpeg({ quality: 90 }).toBuffer()
    : cropped.buf;

  // 叠 SVG 装饰底；叠加失败（字体/渲染问题）时回退纯图，不中断
  if (layout.bg) {
    try {
      const overlay = Buffer.from(wrapSvg(layout.bg), "utf8");
      base = await sharp(base)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      /* 叠加失败就用裁好的纯图 */
    }
  }

  writeFileSync(outPath, base);
  return { outPath, style: key, w: W, h: H, mode: layout.bg ? "overlay" : "plain", crop: cropped.pos };
}
