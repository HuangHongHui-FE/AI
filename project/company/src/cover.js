import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const COVER_W = 900;
const COVER_H = 383;
const FONT = 'Microsoft YaHei, 微软雅黑, sans-serif';
const DARK = '#1a1a2e'; // 色块/纯色底深色
const ACCENT = '#FF6B35'; // 印章/强调色

// 20 种封面布局（越不一样越好）。每项 = { withText, pureColor?, blur?, bg, text:{x,y,anchor,fill,stroke?,maxW} }
// bg 是叠在裁剪底图上的 SVG inner；text 是标语文字参数；无字布局 withText=false
const LAYOUTS = {
  // 1 底部黑纵向渐变 + 居中白字（原版基准）
  'bottom-gradient-center': {
    withText: true,
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="60%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>`,
    text: { x: 450, y: 333, anchor: 'middle', fill: '#fff', maxW: 760 },
  },
  // 2 顶部黑渐变 + 底部居中字（靠阴影不靠渐变托底）
  'top-gradient-bottom-text': {
    withText: true,
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="55%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>`,
    text: { x: 450, y: 333, anchor: 'middle', fill: '#fff', shadow: true, maxW: 760 },
  },
  // 3 左侧黑横向渐变 + 左下字
  'left-gradient-left-text': {
    withText: true,
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.85"/><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>`,
    text: { x: 40, y: 333, anchor: 'start', fill: '#fff', maxW: 560 },
  },
  // 4 右侧黑横向渐变 + 右下字
  'right-gradient-right-text': {
    withText: true,
    bg: `<defs><linearGradient id="g" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.85"/><stop offset="60%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>`,
    text: { x: 860, y: 333, anchor: 'end', fill: '#fff', maxW: 560 },
  },
  // 5 全图半透黑 + 居中字
  'full-darken-center': {
    withText: true,
    bg: `<rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="#000" opacity="0.45"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#fff', maxW: 760 },
  },
  // 6 左右双侧渐变（中间亮两头暗）+ 居中字
  'double-side-gradient': {
    withText: true,
    bg: `<defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="40%" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="gr" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="40%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#gl)"/><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#gr)"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#fff', maxW: 620 },
  },
  // 7 径向暗角，纯图无字
  vignette: {
    withText: false,
    bg: `<defs><radialGradient id="g" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="70%" stop-color="#000" stop-opacity="0.5"/><stop offset="100%" stop-color="#000" stop-opacity="0.8"/></radialGradient></defs><rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="url(#g)"/>`,
  },
  // 8 无渐变，居中描边字（裸图托字）
  'no-gradient-outline': {
    withText: true,
    bg: ``,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#fff', stroke: '#000', maxW: 760 },
  },
  // 9 左半图 + 右半纯色块，字在右块左对齐
  'left-half-block': {
    withText: true,
    bg: `<rect x="450" y="0" width="450" height="${COVER_H}" fill="${DARK}"/>`,
    text: { x: 480, y: 200, anchor: 'start', fill: '#fff', maxW: 380 },
  },
  // 10 右半图 + 左半色块，字在左块右对齐
  'right-half-block': {
    withText: true,
    bg: `<rect x="0" y="0" width="450" height="${COVER_H}" fill="${DARK}"/>`,
    text: { x: 420, y: 200, anchor: 'end', fill: '#fff', maxW: 380 },
  },
  // 11 上图 + 下色块分栏，字在下块居中
  'top-bottom-split': {
    withText: true,
    bg: `<rect x="0" y="258" width="${COVER_W}" height="125" fill="${DARK}"/>`,
    text: { x: 450, y: 333, anchor: 'middle', fill: '#fff', maxW: 760 },
  },
  // 12 斜切色块，字在左下
  'diagonal-split': {
    withText: true,
    bg: `<polygon points="0,383 900,210 900,383" fill="${DARK}"/>`,
    text: { x: 40, y: 350, anchor: 'start', fill: '#fff', maxW: 560 },
  },
  // 13 全图微压暗 + 中央圆角半透白卡，卡内黑字
  'rounded-card-center': {
    withText: true,
    bg: `<rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="#000" opacity="0.25"/><rect x="150" y="120" width="600" height="143" rx="12" fill="#fff" opacity="0.92"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#1a1a1a', maxW: 540 },
  },
  // 14 整图高斯模糊底 + 中央白卡（blur 在 generateCover 特殊处理）
  'blur-bg-card': {
    withText: true,
    blur: true,
    bg: `<rect x="150" y="120" width="600" height="143" rx="12" fill="#fff" opacity="0.95"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#1a1a1a', maxW: 540 },
  },
  // 15 十字网格四块，纯图无字
  'grid-split': {
    withText: false,
    bg: `<rect x="0" y="0" width="450" height="191" fill="#000" opacity="0.35"/><rect x="450" y="191" width="450" height="192" fill="#000" opacity="0.35"/><line x1="450" y1="0" x2="450" y2="${COVER_H}" stroke="#fff" stroke-width="2" opacity="0.4"/><line x1="0" y1="191" x2="${COVER_W}" y2="191" stroke="#fff" stroke-width="2" opacity="0.4"/>`,
  },
  // 16 纯色底无图，居中白字（generateCover 特殊处理：不读原图）
  'pure-color-no-image': {
    withText: true,
    pureColor: true,
    bg: `<rect x="0" y="0" width="${COVER_W}" height="${COVER_H}" fill="${DARK}"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#fff', maxW: 760 },
  },
  // 17 顶部纯色条 + 下裸图，字在顶条
  'top-bar-text': {
    withText: true,
    bg: `<rect x="0" y="0" width="${COVER_W}" height="70" fill="${DARK}"/>`,
    text: { x: 450, y: 47, anchor: 'middle', fill: '#fff', maxW: 820 },
  },
  // 18 底部纯色实条（非渐变），字在条内
  'bottom-bar-solid': {
    withText: true,
    bg: `<rect x="0" y="293" width="${COVER_W}" height="90" fill="${DARK}"/>`,
    text: { x: 450, y: 348, anchor: 'middle', fill: '#fff', maxW: 820 },
  },
  // 19 右上角小色块印章，印章内白字小号，主体图裸露
  'corner-stamp': {
    withText: true,
    bg: `<rect x="700" y="20" width="180" height="60" rx="4" fill="${ACCENT}"/>`,
    text: { x: 790, y: 57, anchor: 'middle', fill: '#fff', maxW: 160, fixed: 20 },
  },
  // 20 三竖栏色块，中栏留图压暗 + 中栏字
  'split-thirds': {
    withText: true,
    bg: `<rect x="0" y="0" width="300" height="${COVER_H}" fill="${DARK}"/><rect x="600" y="0" width="300" height="${COVER_H}" fill="${DARK}"/><rect x="300" y="0" width="300" height="${COVER_H}" fill="#000" opacity="0.35"/>`,
    text: { x: 450, y: 200, anchor: 'middle', fill: '#fff', maxW: 260 },
  },
};

// 20 个布局名，供随机抽
export const COVER_STYLES = Object.keys(LAYOUTS);

// 随机抽一个不在 exclude 里的布局（仿 pickRandomThemeName）
export function pickRandomCoverStyle(exclude = []) {
  const keys = COVER_STYLES.filter((k) => !exclude.includes(k));
  const pool = keys.length ? keys : COVER_STYLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 生成封面：裁剪原图到 900x383，按 style 叠 SVG 布局。style 可选，默认原版基准
export async function generateCover({ imagePath, slogan, outPath, style = 'bottom-gradient-center' }) {
  const layout = LAYOUTS[style] || LAYOUTS['bottom-gradient-center'];

  // #16 纯色底无图：直接 SVG 整版导出，不读原图
  if (layout.pureColor) {
    const svg = wrapSvg(buildInner(layout, slogan));
    const buf = await sharp(Buffer.from(svg, 'utf8')).jpeg({ quality: 90 }).toBuffer();
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
    return outPath;
  }

  // 1. 裁剪原图到封面比例
  let base = await sharp(imagePath)
    .resize(COVER_W, COVER_H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90 })
    .toBuffer();

  // #14 高斯模糊底
  if (layout.blur) {
    base = await sharp(base).blur(8).jpeg({ quality: 90 }).toBuffer();
  }

  // 2. 叠 SVG 布局
  let withOverlay = base;
  try {
    const overlay = Buffer.from(wrapSvg(buildInner(layout, slogan)), 'utf8');
    withOverlay = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
  } catch (e) {
    console.warn(`[cover] SVG 叠加失败（中文字体可能未正确渲染），回退到无文字封面：${e.message}`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, withOverlay);
  return outPath;
}

// 拼布局 bg + 文字为 SVG inner
function buildInner(layout, slogan) {
  let inner = layout.bg || '';
  if (layout.withText && slogan) {
    inner += buildText(slogan, layout.text);
  }
  return inner;
}

// 标语文字 SVG
function buildText(slogan, cfg) {
  const size = cfg.fixed || fitFontSize(slogan, cfg.maxW);
  const text = escapeXml(slogan);
  const shadow = cfg.shadow ? ' style="text-shadow: 0 2px 8px rgba(0,0,0,0.6);"' : '';
  const stroke = cfg.stroke
    ? ` stroke="${cfg.stroke}" stroke-width="3" paint-order="stroke"`
    : '';
  return `<text x="${cfg.x}" y="${cfg.y}" text-anchor="${cfg.anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${cfg.fill}"${stroke}${shadow}>${text}</text>`;
}

// 包 SVG 外壳
function wrapSvg(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">${inner}</svg>`;
}

// 字号自适应：slogan 字数 * size <= maxWidth，从 56 降到 24
function fitFontSize(text, maxWidth) {
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
