// 21 套封面布局：纯 SVG 装饰底（渐变/色块/暗角），不再叠任何文字（2026-08-24 起）
// 自 cover.js 迁入；plain 为默认——直接裁原图不加装饰
const COVER_W = 900;
const COVER_H = 383;
const DARK = "#1a1a2e";
const ACCENT = "#FF6B35";

const W = COVER_W;
const H = COVER_H;

export const LAYOUTS = {
  "bottom-gradient-center": {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="60%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  "top-gradient-bottom-text": {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="55%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  "left-gradient-left-text": {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.85"/><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  "right-gradient-right-text": {
    bg: `<defs><linearGradient id="g" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.85"/><stop offset="60%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  "full-darken-center": {
    bg: `<rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity="0.45"/>`,
  },
  "double-side-gradient": {
    bg: `<defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="40%" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="gr" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="#000" stop-opacity="0.7"/><stop offset="40%" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#gl)"/><rect x="0" y="0" width="${W}" height="${H}" fill="url(#gr)"/>`,
  },
  vignette: {
    bg: `<defs><radialGradient id="g" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="70%" stop-color="#000" stop-opacity="0.5"/><stop offset="100%" stop-color="#000" stop-opacity="0.8"/></radialGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  "no-gradient-outline": { bg: "" },
  "left-half-block": {
    bg: `<rect x="450" y="0" width="450" height="${H}" fill="${DARK}"/>`,
  },
  "right-half-block": {
    bg: `<rect x="0" y="0" width="450" height="${H}" fill="${DARK}"/>`,
  },
  "top-bottom-split": {
    bg: `<rect x="0" y="258" width="${W}" height="125" fill="${DARK}"/>`,
  },
  "diagonal-split": {
    bg: `<polygon points="0,${H} ${W},210 ${W},${H}" fill="${DARK}"/>`,
  },
  "rounded-card-center": {
    bg: `<rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity="0.25"/><rect x="150" y="120" width="600" height="143" rx="12" fill="#fff" opacity="0.92"/>`,
  },
  "blur-bg-card": {
    blur: true,
    bg: `<rect x="150" y="120" width="600" height="143" rx="12" fill="#fff" opacity="0.95"/>`,
  },
  "grid-split": {
    bg: `<rect x="0" y="0" width="450" height="191" fill="#000" opacity="0.35"/><rect x="450" y="191" width="450" height="192" fill="#000" opacity="0.35"/><line x1="450" y1="0" x2="450" y2="${H}" stroke="#fff" stroke-width="2" opacity="0.4"/><line x1="0" y1="191" x2="${W}" y2="191" stroke="#fff" stroke-width="2" opacity="0.4"/>`,
  },
  "pure-color-no-image": {
    pureColor: true,
    bg: `<rect x="0" y="0" width="${W}" height="${H}" fill="${DARK}"/>`,
  },
  "top-bar-text": {
    bg: `<rect x="0" y="0" width="${W}" height="70" fill="${DARK}"/>`,
  },
  "bottom-bar-solid": {
    bg: `<rect x="0" y="293" width="${W}" height="90" fill="${DARK}"/>`,
  },
  "corner-stamp": {
    bg: `<rect x="700" y="20" width="180" height="60" rx="4" fill="${ACCENT}"/>`,
  },
  "start-split-thirds": {
    bg: `<rect x="0" y="0" width="300" height="${H}" fill="${DARK}"/><rect x="600" y="0" width="300" height="${H}" fill="${DARK}"/><rect x="300" y="0" width="300" height="${H}" fill="#000" opacity="0.35"/>`,
  },
  // 纵向渐变半色块：底部强渐变但不含文字（替代 53402 报错的横向渐变/白卡布局）
  "vertical-soft-gradient": {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0.05"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`,
  },
  // 纯原图：裁到封面比例，不叠任何装饰（2026-08-26 起默认）
  plain: { bg: "" },
};

export const COVER_STYLES = Object.keys(LAYOUTS);
export const COVER_W_H = { w: COVER_W, h: COVER_H, ratio: COVER_W / COVER_H };

// 随机抽一个不在 exclude 里的布局名
export function pickRandomCoverStyle(exclude = []) {
  const pool = COVER_STYLES.filter((k) => !exclude.includes(k));
  const list = pool.length ? pool : COVER_STYLES;
  return list[Math.floor(Math.random() * list.length)];
}

// 包 SVG 外壳
export function wrapSvg(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">${inner}</svg>`;
}
