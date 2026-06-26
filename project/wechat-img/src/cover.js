import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';

const COVER_W = 900;
const COVER_H = 383;

export async function generateCover({ imagePath, slogan, outPath }) {
  // 1. 裁剪原图到封面比例
  const base = await sharp(imagePath)
    .resize(COVER_W, COVER_H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90 })
    .toBuffer();

  // 2. 底部渐变层 + 文字
  let withOverlay = base;
  try {
    if (slogan) {
      const overlay = buildTextOverlay(slogan);
      withOverlay = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
    }
  } catch (e) {
    console.warn(`[cover] SVG 文字叠加失败（中文字体可能未正确渲染），回退到无文字封面：${e.message}`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, withOverlay);
  return outPath;
}

function buildTextOverlay(slogan) {
  const fontSize = fitFontSize(slogan, COVER_W - 80);
  const text = escapeXml(slogan);

  const gradient = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="60%" stop-color="#000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>
  `;

  const textBlock = `
    <text x="${COVER_W / 2}" y="${COVER_H - 50}" text-anchor="middle"
          font-family="Microsoft YaHei, 微软雅黑, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          fill="#ffffff"
          style="text-shadow: 0 2px 8px rgba(0,0,0,0.6);">${text}</text>
  `;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
  ${gradient}
  ${textBlock}
</svg>`;

  return Buffer.from(svg, 'utf8');
}

function fitFontSize(text, maxWidth) {
  // 微软雅黑 大致 1 字宽 = 字号 * 1.0
  let size = 56;
  while (size > 24 && text.length * size > maxWidth) {
    size -= 2;
  }
  return size;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
