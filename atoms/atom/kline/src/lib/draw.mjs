// K 线图绘制：SVG 折线 → JPEG（900x420）
// 自 company/src/kline.cjs 迁入，支持日/周/月三种周期 + 可选中文标题
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const W = 900;
const H = 420;
// 画布边距：右侧留 76 给价格轴标签，底部留 58 给日期轴
const PAD = { l: 40, r: 76, t: 76, b: 58 };
const DARK = "#1a1a2e";
const UP = "#FF6B35"; // 起点价之上（涨）
const DOWN = "#2EC4B6"; // 起点价之下（跌）
const GRID = "#2b2b48";
const DIM = "#8a8aa0";

// 文本转义：标题里的 & < > 会破坏 SVG
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 日期轴标签：跨年只显示年份，同年显示月-日
function dateFmt(d0, d1) {
  const crossYear = String(d0).slice(0, 4) !== String(d1).slice(0, 4);
  return crossYear ? (d) => String(d).slice(0, 4) : (d) => String(d).slice(5, 10);
}

// 画 K 线折线图：rows = [{date, close}]，至少 2 个点
export async function drawKline({ rows, title, outPath, currency = "¥" }) {
  if (!rows || rows.length < 2) throw new Error("K 线数据点不足（至少 2 个）");

  const prices = rows.map((r) => r.close);
  const mn = Math.min(...prices);
  const mx = Math.max(...prices);
  const span = mx - mn || 1;
  const plotL = PAD.l;
  const plotR = W - PAD.r;
  const plotT = PAD.t;
  const plotB = H - PAD.b;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  const xs = rows.map((_, i) => plotL + (i / (rows.length - 1)) * plotW);
  const ys = prices.map((p) => plotB - ((p - mn) / span) * plotH);
  const poly = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  const first = prices[0];
  const last = prices[prices.length - 1];
  const pct = ((last - first) / first) * 100;
  const sym = pct >= 0 ? "+" : "";
  const baseY = ys[0]; // 起点价基准线：以上画涨色、以下画跌色

  // 最高/最低点：打点 + 价格与日期标注；靠右翻转、贴边下移，避免压线与出界
  let iMax = 0;
  let iMin = 0;
  prices.forEach((p, i) => {
    if (p > prices[iMax]) iMax = i;
    if (p < prices[iMin]) iMin = i;
  });
  const mark = (i, color, up) => {
    const flip = xs[i] > plotR - 96;
    const tx = flip ? xs[i] - 9 : xs[i] + 9;
    const anchor = flip ? "end" : "start";
    const want = ys[i] + (up ? -11 : 19);
    // 贴近底/顶时把标签推到内侧，避免压住折线或出画
    const ty = Math.min(Math.max(want, plotT + 12), plotB - 8);
    return (
      `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4" fill="${color}"/>` +
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-size="13" font-weight="600" fill="${color}">${currency}${prices[i].toFixed(2)} · ${String(rows[i].date).slice(0, 7)}</text>`
    );
  };

  // 价格轴：4 等分网格线 + 右侧刻度标签
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = mn + (span * i) / 4;
    const y = plotB - (i / 4) * plotH;
    return (
      `<line x1="${plotL}" y1="${y.toFixed(1)}" x2="${plotR}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>` +
      `<text x="${plotR + 8}" y="${(y + 4).toFixed(1)}" font-size="12" fill="${DIM}">${currency}${v.toFixed(2)}</text>`
    );
  }).join("");

  // 日期轴：5 个等距刻度，首尾对齐边界
  const fmt = dateFmt(rows[0].date, rows[rows.length - 1].date);
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const idx = Math.round((i / 4) * (rows.length - 1));
    const anchor = i === 0 ? "start" : i === 4 ? "end" : "middle";
    return `<text x="${xs[idx].toFixed(1)}" y="${plotB + 24}" text-anchor="${anchor}" font-size="12" fill="${DIM}">${fmt(rows[idx].date)}</text>`;
  }).join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">
<rect width="${W}" height="${H}" fill="${DARK}"/>
<defs>
  <clipPath id="up"><rect x="0" y="0" width="${W}" height="${baseY.toFixed(1)}"/></clipPath>
  <clipPath id="dn"><rect x="0" y="${baseY.toFixed(1)}" width="${W}" height="${(H - baseY).toFixed(1)}"/></clipPath>
</defs>
${title ? `<text x="${W / 2}" y="30" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">${esc(title)}</text>` : ""}
<text x="${PAD.l}" y="58" font-size="12" fill="${DIM}">${rows[0].date} → ${rows[rows.length - 1].date}</text>
<text x="${plotR}" y="60" text-anchor="end" font-size="17" font-weight="700" fill="${pct >= 0 ? UP : DOWN}">${sym}${pct.toFixed(1)}%</text>
${grid}
<line x1="${plotL}" y1="${baseY.toFixed(1)}" x2="${plotR}" y2="${baseY.toFixed(1)}" stroke="${DIM}" stroke-width="1" stroke-dasharray="5 5" opacity="0.55"/>
<polyline points="${poly}" fill="none" stroke="${UP}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#up)"/>
<polyline points="${poly}" fill="none" stroke="${DOWN}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#dn)"/>
${mark(iMax, UP, true)}
${mark(iMin, DOWN, true)}
${xTicks}
<text x="${PAD.l}" y="${H - 12}" font-size="13" fill="${DIM}">起 ${currency}${first.toFixed(2)}</text>
<text x="${plotR}" y="${H - 12}" text-anchor="end" font-size="13" fill="${pct >= 0 ? UP : DOWN}">现 ${currency}${last.toFixed(2)}</text>
</svg>`;

  mkdirSync(dirname(outPath), { recursive: true });
  const buf = await sharp(Buffer.from(svg, "utf8")).jpeg({ quality: 90 }).toBuffer();
  writeFileSync(outPath, buf);
  return { outPath, w: W, h: H, points: rows.length, first, last, pct: Number(pct.toFixed(2)) };
}
