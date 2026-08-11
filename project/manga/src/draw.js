// 程序化 SVG 条漫生成器（声明式）：读 article.json 的 panels，渲染 comics/<slug>/strip.jpg（长条漫）+ NN.jpg（单格）
// 用法：node src/draw.js --from-json <article.json> [--slug <slug>] [--no-strip] [--no-panels]
// 画布 720×1280 高清竖版（手机条漫），大头Q版角色（头大身小细节足），场景构件适配大画布
// panel 结构：{ bg1, bg2, scene:[背景], actors:[{type,x,hipY,emo,pose}], props:[前景], bubbles:[], label }
// 建议每格 1-2 人站C位，人物大而饱满；人多则人物小（skill 会提示）
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const W = 720,
  H = 1280,
  OUTW = 900; // 输出宽：720→900 高清

// ===== 表情 =====
// emo: happy/sad/angry/surprised/crying/calm —— 眉毛+眼睛高光+嘴+腮红+鼻子，适配大头 headR=68
function face(x, cy, emo = "calm", blush = true) {
  const eyeY = cy + 8;
  const e = {
    happy: {
      eyes: `<circle cx="${x - 26}" cy="${eyeY}" r="9" fill="#1a1a2e"/><circle cx="${x + 26}" cy="${eyeY}" r="9" fill="#1a1a2e"/><circle cx="${x - 30}" cy="${eyeY - 3}" r="3.4" fill="#fff"/><circle cx="${x + 22}" cy="${eyeY - 3}" r="3.4" fill="#fff"/>`,
      brow: `<path d="M ${x - 36} ${eyeY - 20} Q ${x - 26} ${eyeY - 25} ${x - 15} ${eyeY - 19}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M ${x + 36} ${eyeY - 20} Q ${x + 26} ${eyeY - 25} ${x + 15} ${eyeY - 19}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      mouth: `<path d="M ${x - 20} ${cy + 36} Q ${x} ${cy + 50} ${x + 20} ${cy + 36}" stroke="#1a1a2e" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M ${x - 12} ${cy + 41} Q ${x} ${cy + 46} ${x + 12} ${cy + 41}" stroke="#c0392b" stroke-width="3" fill="none" opacity="0.6"/>`,
    },
    sad: {
      eyes: `<circle cx="${x - 26}" cy="${eyeY}" r="8.6" fill="#1a1a2e"/><circle cx="${x + 26}" cy="${eyeY}" r="8.6" fill="#1a1a2e"/><circle cx="${x - 30}" cy="${eyeY - 3}" r="3" fill="#fff"/><circle cx="${x + 22}" cy="${eyeY - 3}" r="3" fill="#fff"/>`,
      brow: `<path d="M ${x - 36} ${eyeY - 18} Q ${x - 26} ${eyeY - 24} ${x - 15} ${eyeY - 18}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M ${x + 36} ${eyeY - 18} Q ${x + 26} ${eyeY - 24} ${x + 15} ${eyeY - 18}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      mouth: `<path d="M ${x - 20} ${cy + 42} Q ${x} ${cy + 30} ${x + 20} ${cy + 42}" stroke="#1a1a2e" stroke-width="5.5" fill="none" stroke-linecap="round"/>`,
      tear: `<path d="M ${x + 34} ${eyeY + 6} Q ${x + 40} ${eyeY + 14} ${x + 35} ${eyeY + 24}" stroke="#7fb3e0" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    },
    angry: {
      eyes: `<circle cx="${x - 26}" cy="${eyeY}" r="8.6" fill="#1a1a2e"/><circle cx="${x + 26}" cy="${eyeY}" r="8.6" fill="#1a1a2e"/><circle cx="${x - 30}" cy="${eyeY - 3}" r="3" fill="#fff"/><circle cx="${x + 22}" cy="${eyeY - 3}" r="3" fill="#fff"/>`,
      brow: `<line x1="${x - 40}" y1="${eyeY - 18}" x2="${x - 12}" y2="${eyeY - 8}" stroke="#1a1a2e" stroke-width="6" stroke-linecap="round"/><line x1="${x + 40}" y1="${eyeY - 18}" x2="${x + 12}" y2="${eyeY - 8}" stroke="#1a1a2e" stroke-width="6" stroke-linecap="round"/>`,
      mouth: `<path d="M ${x - 18} ${cy + 44} L ${x} ${cy + 36} L ${x + 18} ${cy + 44}" stroke="#1a1a2e" stroke-width="6" fill="none" stroke-linecap="round"/>`,
      vein: `<path d="M ${x + 38} ${eyeY - 30} L ${x + 38} ${eyeY - 14} M ${x + 30} ${eyeY - 22} L ${x + 46} ${eyeY - 22}" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>`,
    },
    surprised: {
      eyes: `<circle cx="${x - 26}" cy="${eyeY}" r="11" fill="#fff" stroke="#1a1a2e" stroke-width="5"/><circle cx="${x + 26}" cy="${eyeY}" r="11" fill="#fff" stroke="#1a1a2e" stroke-width="5"/><circle cx="${x - 26}" cy="${eyeY}" r="4.6" fill="#1a1a2e"/><circle cx="${x + 26}" cy="${eyeY}" r="4.6" fill="#1a1a2e"/>`,
      brow: `<line x1="${x - 34}" y1="${eyeY - 22}" x2="${x - 18}" y2="${eyeY - 22}" stroke="#1a1a2e" stroke-width="5" stroke-linecap="round"/><line x1="${x + 18}" y1="${eyeY - 22}" x2="${x + 34}" y2="${eyeY - 22}" stroke="#1a1a2e" stroke-width="5" stroke-linecap="round"/>`,
      mouth: `<ellipse cx="${x}" cy="${cy + 40}" rx="10" ry="14" fill="#1a1a2e"/>`,
    },
    crying: {
      eyes: `<path d="M ${x - 26} ${eyeY} L ${x - 18} ${eyeY + 10} L ${x - 10} ${eyeY - 7} Z" fill="#1a1a2e"/><path d="M ${x + 10} ${eyeY - 7} L ${x + 18} ${eyeY + 10} L ${x + 26} ${eyeY} Z" fill="#1a1a2e"/>`,
      brow: `<path d="M ${x - 36} ${eyeY - 18} Q ${x - 26} ${eyeY - 24} ${x - 15} ${eyeY - 18}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M ${x + 36} ${eyeY - 18} Q ${x + 26} ${eyeY - 24} ${x + 15} ${eyeY - 18}" stroke="#1a1a2e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      mouth: `<path d="M ${x - 18} ${cy + 44} Q ${x} ${cy + 54} ${x + 18} ${cy + 44}" stroke="#1a1a2e" stroke-width="6" fill="none" stroke-linecap="round"/>`,
      tear: `<path d="M ${x - 34} ${eyeY + 6} Q ${x - 40} ${eyeY + 14} ${x - 34} ${eyeY + 26}" stroke="#7fb3e0" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M ${x + 34} ${eyeY + 6} Q ${x + 40} ${eyeY + 14} ${x + 34} ${eyeY + 26}" stroke="#7fb3e0" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    },
  }[emo] || {
    eyes: `<circle cx="${x - 26}" cy="${eyeY}" r="9" fill="#1a1a2e"/><circle cx="${x + 26}" cy="${eyeY}" r="9" fill="#1a1a2e"/><circle cx="${x - 30}" cy="${eyeY - 3}" r="3.4" fill="#fff"/><circle cx="${x + 22}" cy="${eyeY - 3}" r="3.4" fill="#fff"/>`,
    brow: `<line x1="${x - 34}" y1="${eyeY - 20}" x2="${x - 18}" y2="${eyeY - 20}" stroke="#1a1a2e" stroke-width="5" stroke-linecap="round"/><line x1="${x + 18}" y1="${eyeY - 20}" x2="${x + 34}" y2="${eyeY - 20}" stroke="#1a1a2e" stroke-width="5" stroke-linecap="round"/>`,
    mouth: `<line x1="${x - 15}" y1="${cy + 38}" x2="${x + 15}" y2="${cy + 38}" stroke="#1a1a2e" stroke-width="5.5" stroke-linecap="round"/>`,
  };
  const nose = `<path d="M ${x} ${cy + 12} L ${x} ${cy + 20} L ${x + 5} ${cy + 20}" stroke="#c98a5a" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  const blushSvg = blush
    ? `<ellipse cx="${x - 42}" cy="${cy + 26}" rx="13" ry="8" fill="#f5a3a3" opacity="0.6"/><ellipse cx="${x + 42}" cy="${cy + 26}" rx="13" ry="8" fill="#f5a3a3" opacity="0.6"/>`
    : "";
  return `${e.brow}${e.eyes}${e.mouth}${e.tear || ""}${e.vein || ""}${nose}${blushSvg}`;
}

// 手臂动作 + 手：down/up/point/shrug/hug/phone/think
function arms(pose, x, armY) {
  const skin = '#f7d9b8';
  const sw = 'stroke="#1a1a2e" stroke-width="10" stroke-linecap="round" fill="none"';
  const hand = (hx, hy, r = 8) => `<circle cx="${hx}" cy="${hy}" r="${r}" fill="${skin}" stroke="#1a1a2e" stroke-width="3.4"/>`;
  const p = {
    up: `<line x1="${x}" y1="${armY}" x2="${x - 42}" y2="${armY - 50}" ${sw}/>${hand(x - 42, armY - 50)}<line x1="${x}" y1="${armY}" x2="${x + 42}" y2="${armY - 50}" ${sw}/>${hand(x + 42, armY - 50)}`,
    point: `<line x1="${x}" y1="${armY}" x2="${x - 48}" y2="${armY + 38}" ${sw}/>${hand(x - 48, armY + 38)}<line x1="${x}" y1="${armY}" x2="${x + 54}" y2="${armY + 10}" ${sw}/><circle cx="${x + 54}" cy="${armY + 10}" r="6" fill="${skin}" stroke="#1a1a2e" stroke-width="3"/>`,
    shrug: `<line x1="${x}" y1="${armY}" x2="${x - 48}" y2="${armY + 36}" ${sw}/>${hand(x - 48, armY + 36)}<line x1="${x}" y1="${armY}" x2="${x + 48}" y2="${armY + 36}" ${sw}/>${hand(x + 48, armY + 36)}`,
    hug: `<path d="M ${x - 14} ${armY} Q ${x - 50} ${armY + 12} ${x - 44} ${armY + 46}" ${sw}/>${hand(x - 44, armY + 46)}<path d="M ${x + 14} ${armY} Q ${x + 50} ${armY + 12} ${x + 44} ${armY + 46}" ${sw}/>${hand(x + 44, armY + 46)}`,
    phone: `<line x1="${x}" y1="${armY}" x2="${x + 48}" y2="${armY + 28}" ${sw}/><rect x="${x + 44}" y="${armY + 20}" width="18" height="32" rx="4" fill="#fff" stroke="#1a1a2e" stroke-width="4"/><line x1="${x + 46}" y1="${armY + 26}" x2="${x + 60}" y2="${armY + 26}" stroke="#1a1a2e" stroke-width="3"/><line x1="${x + 46}" y1="${armY + 34}" x2="${x + 58}" y2="${armY + 34}" stroke="#1a1a2e" stroke-width="3"/><line x1="${x + 46}" y1="${armY + 42}" x2="${x + 55}" y2="${armY + 42}" stroke="#1a1a2e" stroke-width="3"/><circle cx="${x + 48}" cy="${armY + 52}" r="5" fill="${skin}"/>`,
    think: `<line x1="${x}" y1="${armY}" x2="${x - 40}" y2="${armY - 34}" ${sw}/>${hand(x - 40, armY - 34)}<line x1="${x}" y1="${armY}" x2="${x + 44}" y2="${armY + 40}" ${sw}/>${hand(x + 44, armY + 40)}`,
  }[pose] || `<line x1="${x}" y1="${armY}" x2="${x - 48}" y2="${armY + 52}" ${sw}/>${hand(x - 48, armY + 52)}<line x1="${x}" y1="${armY}" x2="${x + 48}" y2="${armY + 52}" ${sw}/>${hand(x + 48, armY + 52)}`;
  return p;
}

// ===== 角色底座（大头Q版，headR=68，头大身小） =====
function lineCharacter({ x, hipY = 1160, emo = "calm", pose = "down", hair, shirt, pants, shoe, pattern, extra, blush = true }) {
  const headR = 68,
    headY = hipY - 232,
    cx = x,
    headCy = headY + 4,
    bodyTop = headY + headR, // = hipY-164
    bodyBot = hipY,
    armY = bodyTop + 26,
    skinC = "#f7d9b8",
    shirtC = shirt || "#6a8fd4",
    pantsC = pants || "#4a4a5a",
    shoeC = shoe || "#3a3a4a";
  return `<g stroke-linecap="round">
    <!-- 鞋 -->
    <ellipse cx="${cx - 26}" cy="${bodyBot + 78}" rx="22" ry="13" fill="${shoeC}" stroke="#1a1a2e" stroke-width="4.4"/>
    <ellipse cx="${cx + 26}" cy="${bodyBot + 78}" rx="22" ry="13" fill="${shoeC}" stroke="#1a1a2e" stroke-width="4.4"/>
    <!-- 腿（短粗） -->
    <line x1="${cx - 24}" y1="${bodyBot}" x2="${cx - 25}" y2="${bodyBot + 66}" stroke="${pantsC}" stroke-width="17" stroke-linecap="round"/>
    <line x1="${cx + 24}" y1="${bodyBot}" x2="${cx + 25}" y2="${bodyBot + 66}" stroke="${pantsC}" stroke-width="17" stroke-linecap="round"/>
    <!-- 身体（圆润胶囊）+ 衣服纹理 -->
    <path d="M ${cx - 34} ${bodyTop + 4} Q ${cx - 40} ${(bodyTop + bodyBot) / 2} ${cx - 34} ${bodyBot - 6} L ${cx + 34} ${bodyBot - 6} Q ${cx + 40} ${(bodyTop + bodyBot) / 2} ${cx + 34} ${bodyTop + 4} Z" fill="${shirtC}" stroke="#1a1a2e" stroke-width="5"/>
    ${pattern || ""}
    <!-- 领口 V + 领带/领结 -->
    <path d="M ${cx - 16} ${bodyTop + 2} L ${cx} ${bodyTop + 20} L ${cx + 16} ${bodyTop + 2}" stroke="#1a1a2e" stroke-width="4" fill="none"/>
    <!-- 纽扣 -->
    <circle cx="${cx}" cy="${bodyBot - 32}" r="4" fill="#1a1a2e" opacity="0.65"/>
    <circle cx="${cx}" cy="${bodyBot - 16}" r="4" fill="#1a1a2e" opacity="0.65"/>
    <!-- 手臂 -->
    ${arms(pose, cx, armY)}
    <!-- 脖子 -->
    <rect x="${cx - 10}" y="${headCy + headR - 16}" width="20" height="18" fill="${skinC}" stroke="#1a1a2e" stroke-width="3.6"/>
    <!-- 头（大） -->
    <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="${skinC}" stroke="#1a1a2e" stroke-width="5.5"/>
    ${face(cx, headCy, emo, blush)}
    ${hair}
    ${extra || ""}
  </g>`;
}

// ===== 角色构件（特征固定 + 细节足） =====
function zhoujianguo(a) {
  const c = a.x, h = a.hipY - 232;
  const hair = `<path d="M ${c - 48} ${h - 10} Q ${c - 50} ${h - 60} ${c} ${h - 64} Q ${c + 50} ${h - 60} ${c + 48} ${h - 10} Z" fill="#2a2a3a" stroke="#1a1a2e" stroke-width="4"/><path d="M ${c - 22} ${h - 46} L ${c - 22} ${h - 22} M ${c - 4} ${h - 56} L ${c - 4} ${h - 22} M ${c + 16} ${h - 50} L ${c + 16} ${h - 22} M ${c + 32} ${h - 40} L ${c + 32} ${h - 20}" stroke="#1a1a2e" stroke-width="3.4" opacity="0.45"/>`;
  const extra = `<circle cx="${c - 26}" cy="${h + 8}" r="13" fill="none" stroke="#1a1a2e" stroke-width="4.4"/><circle cx="${c + 26}" cy="${h + 8}" r="13" fill="none" stroke="#1a1a2e" stroke-width="4.4"/><line x1="${c - 13}" y1="${h + 8}" x2="${c + 13}" y2="${h + 8}" stroke="#1a1a2e" stroke-width="4.4"/>`;
  const pattern = Array.from({ length: 4 }, (_, i) =>
    `<line x1="${c - 36 + i * 18}" y1="${a.hipY - 150}" x2="${c - 28 + i * 18}" y2="${a.hipY - 16}" stroke="#5a6a80" stroke-width="2.6" opacity="0.55"/>`
  ).join("") + Array.from({ length: 4 }, (_, i) =>
    `<line x1="${c - 36}" y1="${a.hipY - 132 + i * 30}" x2="${c + 36}" y2="${a.hipY - 108 + i * 30}" stroke="#5a6a80" stroke-width="2.6" opacity="0.55"/>`
  ).join("");
  return lineCharacter({ ...a, hair, shirt: "#8aa5c0", pants: "#5a5a70", shoe: "#3a3a4a", pattern, extra });
}

function linxiao(a) {
  const c = a.x, h = a.hipY - 232;
  const hair = `<path d="M ${c - 48} ${h - 10} Q ${c - 50} ${h - 60} ${c} ${h - 64} Q ${c + 50} ${h - 60} ${c + 48} ${h - 10} L ${c + 48} ${h + 16} Q ${c + 24} ${h + 6} ${c} ${h + 12} Q ${c - 24} ${h + 6} ${c - 48} ${h + 16} Z" fill="#4a3a2a" stroke="#1a1a2e" stroke-width="4"/><path d="M ${c - 20} ${h - 52} L ${c - 20} ${h - 14} M ${c - 2} ${h - 58} L ${c - 2} ${h - 14} M ${c + 18} ${h - 50} L ${c + 18} ${h - 14}" stroke="#1a1a2e" stroke-width="3.4" opacity="0.6"/>`;
  const extra = `<circle cx="${c - 26}" cy="${h + 8}" r="11" fill="none" stroke="#1a1a2e" stroke-width="3.4"/><circle cx="${c + 26}" cy="${h + 8}" r="11" fill="none" stroke="#1a1a2e" stroke-width="3.4"/><line x1="${c - 15}" y1="${h + 8}" x2="${c + 15}" y2="${h + 8}" stroke="#1a1a2e" stroke-width="3.4"/>`;
  const pattern = Array.from({ length: 3 }, (_, i) =>
    `<line x1="${c - 36}" y1="${a.hipY - 128 + i * 34}" x2="${c + 36}" y2="${a.hipY - 108 + i * 34}" stroke="#d46a6a" stroke-width="3" opacity="0.5"/>`
  ).join("");
  return lineCharacter({ ...a, hair, shirt: "#e8a8a0", pants: "#8a6a5a", shoe: "#6a4a3a", pattern, extra });
}

function zhouxiaoman(a) {
  const c = a.x, h = a.hipY - 232;
  const hair = `<path d="M ${c - 48} ${h - 10} Q ${c - 50} ${h - 60} ${c} ${h - 64} Q ${c + 50} ${h - 60} ${c + 48} ${h - 10} Z" fill="#5a3a2a" stroke="#1a1a2e" stroke-width="4"/><path d="M ${c - 44} ${h - 6} Q ${c - 76} ${h + 8} ${c - 64} ${h + 62}" stroke="#5a3a2a" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M ${c + 44} ${h - 6} Q ${c + 76} ${h + 8} ${c + 64} ${h + 62}" stroke="#5a3a2a" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="${c - 64}" cy="${h + 66}" r="8" fill="#e85a71" stroke="#1a1a2e" stroke-width="3"/><circle cx="${c + 64}" cy="${h + 66}" r="8" fill="#e85a71" stroke="#1a1a2e" stroke-width="3"/><path d="M ${c - 34} ${h - 10} L ${c - 30} ${h - 26} L ${c - 22} ${h - 12} Z" fill="#e85a71" opacity="0.9"/>`;
  return lineCharacter({ ...a, hair, shirt: "#e85a71", pants: "#e85a71", shoe: "#d84a5a", blush: true });
}

function zhouyeye(a) {
  const c = a.x, h = a.hipY - 232;
  const hair = `<path d="M ${c - 48} ${h - 10} Q ${c - 50} ${h - 62} ${c} ${h - 66} Q ${c + 50} ${h - 62} ${c + 48} ${h - 10} Z" fill="#ececec" stroke="#1a1a2e" stroke-width="4"/><path d="M ${c - 30} ${h - 56} L ${c - 30} ${h - 16} M ${c - 10} ${h - 62} L ${c - 10} ${h - 16} M ${c + 12} ${h - 58} L ${c + 12} ${h - 16}" stroke="#b0b0b0" stroke-width="3.4" opacity="0.7"/>`;
  const extra = `<circle cx="${c - 26}" cy="${h + 8}" r="13" fill="none" stroke="#1a1a2e" stroke-width="4"/><circle cx="${c + 26}" cy="${h + 8}" r="13" fill="none" stroke="#1a1a2e" stroke-width="4"/><line x1="${c - 13}" y1="${h + 8}" x2="${c + 13}" y2="${h + 8}" stroke="#1a1a2e" stroke-width="4"/>`;
  const wrinkle = `<path d="M ${c - 40} ${h + 34} Q ${c - 34} ${h + 38} ${c - 28} ${h + 34}" stroke="#c98a5a" stroke-width="2.6" fill="none" opacity="0.7"/><path d="M ${c + 28} ${h + 34} Q ${c + 34} ${h + 38} ${c + 40} ${h + 34}" stroke="#c98a5a" stroke-width="2.6" fill="none" opacity="0.7"/>`;
  return lineCharacter({ ...a, hair, shirt: "#f0f0f0", pants: "#5a6a7a", shoe: "#3a3a4a", extra: extra + wrinkle, blush: false });
}

function wangayi(a) {
  const c = a.x, h = a.hipY - 232;
  const curls = [-44, -26, -8, 10, 28, 46].map((ox) =>
    `<circle cx="${c + ox}" cy="${h - 24}" r="11" fill="#3a2a2a" stroke="#1a1a2e" stroke-width="3.4"/>`
  ).join("");
  const hair = `<path d="M ${c - 48} ${h - 14} Q ${c - 50} ${h - 56} ${c} ${h - 60} Q ${c + 50} ${h - 56} ${c + 48} ${h - 14} L ${c + 48} ${h + 4} L ${c - 48} ${h + 4} Z" fill="#3a2a2a" stroke="#1a1a2e" stroke-width="4"/>${curls}`;
  const pattern = Array.from({ length: 12 }, (_, i) =>
    `<circle cx="${c - 32 + (i % 6) * 13}" cy="${a.hipY - 130 + Math.floor(i / 6) * 56}" r="3" fill="#e85a71" opacity="0.75"/>`
  ).join("");
  return lineCharacter({ ...a, hair, shirt: "#e8d0e8", pants: "#8a7a6a", shoe: "#6a4a3a", pattern, blush: true });
}

const ACTORS = { zhoujianguo, linxiao, zhouxiaoman, zhouyeye, wangayi };

// ===== 对话气泡 =====
function bubble({ x, y, w, h, text, px, py }) {
  const perLine = Math.max(6, Math.floor(w / 40));
  const lines = wrap(text, perLine);
  const fontSize = lines.length > 2 ? 26 : lines.length > 1 ? 32 : 40;
  const startY = y + h / 2 - ((lines.length - 1) * fontSize) / 2;
  const tspans = lines
    .map((l, i) => `<tspan x="${x + w / 2}" y="${startY + i * fontSize}">${l}</tspan>`)
    .join("");
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#fff" stroke="#2b2b2b" stroke-width="4"/>
    <polygon points="${px - 18},${py} ${px + 18},${py} ${px},${py + 32}" fill="#fff" stroke="#2b2b2b" stroke-width="4"/>
    <polygon points="${px - 12},${py + 3} ${px + 12},${py + 3} ${px},${py + 26}" fill="#fff" stroke="none"/>
    <text font-family="Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#1a1a2e" text-anchor="middle" font-weight="600">${tspans}</text>
  </g>`;
}

function wrap(s, n) {
  if (!s) return [""];
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

// ===== 场景背景构件（适配 720×1280） =====
const SCENES = {
  floor: ({ y = 1040, wall = "#f7f0e6", floor = "#d8c9a8" }) =>
    `<rect x="0" y="0" width="720" height="${y}" fill="${wall}"/><rect x="0" y="${y}" width="720" height="${1280 - y}" fill="${floor}"/><line x1="0" y1="${y}" x2="720" y2="${y}" stroke="#b8a888" stroke-width="5"/>`,
  sofa: ({ x = 80, y = 1000, w = 400 }) => {
    const h = 150;
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="#c9a86c" stroke="#1a1a2e" stroke-width="5.5"/>
      <rect x="${x - 22}" y="${y + 20}" width="${w + 44}" height="${h - 20}" rx="20" fill="#b8915a" stroke="#1a1a2e" stroke-width="5.5"/>
      <rect x="${x + 12}" y="${y + 34}" width="80" height="86" rx="16" fill="#8a5a2b" opacity="0.4"/>
      <rect x="${x + 110}" y="${y + 34}" width="80" height="86" rx="16" fill="#8a5a2b" opacity="0.4"/>
      <rect x="${x + 208}" y="${y + 34}" width="80" height="86" rx="16" fill="#8a5a2b" opacity="0.4"/>
      <rect x="${x + 306}" y="${y + 34}" width="80" height="86" rx="16" fill="#8a5a2b" opacity="0.4"/>
      <rect x="${x + 26}" y="${y - 54}" width="${w - 52}" height="54" rx="16" fill="#c9a86c" stroke="#1a1a2e" stroke-width="5.5"/>
      <circle cx="${x + w + 8}" cy="${y + 40}" r="10" fill="#c9a86c" stroke="#1a1a2e" stroke-width="5"/>
    </g>`;
  },
  window: ({ x = 500, y = 180, w = 160, night = false }) => {
    const sky = night ? "#1a2a4a" : "#a8d0f0";
    const moon = night ? `<circle cx="${x + w - 34}" cy="${y + 34}" r="22" fill="#f5e6a8" stroke="#e6c84a" stroke-width="3"/><circle cx="${x + w - 40}" cy="${y + 28}" r="18" fill="${sky}"/>` : `<circle cx="${x + w - 34}" cy="${y + 34}" r="18" fill="#fff"/><path d="M ${x + w - 44} ${y + 44} Q ${x + w - 26} ${y + 54} ${x + w - 54} ${y + 66}" stroke="#fff" stroke-width="4" fill="none" opacity="0.8"/>`;
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="190" rx="8" fill="${sky}" stroke="#1a1a2e" stroke-width="6"/>
      ${moon}
      <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + 190}" stroke="#1a1a2e" stroke-width="6"/>
      <line x1="${x}" y1="${y + 95}" x2="${x + w}" y2="${y + 95}" stroke="#1a1a2e" stroke-width="6"/>
      <rect x="${x - 8}" y="${y + 190}" width="${w + 16}" height="14" fill="#8a5a2b" stroke="#1a1a2e" stroke-width="3"/>
    </g>`;
  },
  lamp: ({ x = 110, y = 1000 }) =>
    `<g>
      <rect x="${x - 6}" y="${y - 90}" width="12" height="90" fill="#8a7a5a" stroke="#1a1a2e" stroke-width="4"/>
      <path d="M ${x - 46} ${y - 90} Q ${x} ${y - 138} ${x + 46} ${y - 90} L ${x + 34} ${y - 80} L ${x - 34} ${y - 80} Z" fill="#ffe680" stroke="#1a1a2e" stroke-width="4.5"/>
      <line x1="${x - 20}" y1="${y - 94}" x2="${x - 12}" y2="${y - 106}" stroke="#e6a92c" stroke-width="4"/>
      <line x1="${x + 20}" y1="${y - 94}" x2="${x + 12}" y2="${y - 106}" stroke="#e6a92c" stroke-width="4"/>
      <ellipse cx="${x}" cy="${y}" rx="34" ry="8" fill="#8a7a5a" stroke="#1a1a2e" stroke-width="4"/>
    </g>`,
  plant: ({ x = 620, y = 1060 }) =>
    `<g>
      <path d="M ${x} ${y} Q ${x - 26} ${y - 40} ${x - 12} ${y - 80} Q ${x - 4} ${y - 52} ${x} ${y - 46} Q ${x + 4} ${y - 52} ${x + 12} ${y - 80} Q ${x + 26} ${y - 40} ${x} ${y}" fill="#6a9a4a" stroke="#1a1a2e" stroke-width="4"/>
      <path d="M ${x} ${y - 8} Q ${x - 38} ${y - 22} ${x - 24} ${y - 66} Q ${x - 12} ${y - 32} ${x} ${y - 30}" fill="#7aae5a" stroke="#1a1a2e" stroke-width="4"/>
      <path d="M ${x} ${y - 8} Q ${x + 38} ${y - 22} ${x + 24} ${y - 66} Q ${x + 12} ${y - 32} ${x} ${y - 30}" fill="#7aae5a" stroke="#1a1a2e" stroke-width="4"/>
      <path d="M ${x - 24} ${y - 10} L ${x + 24} ${y - 10} L ${x + 21} ${y + 4} L ${x - 21} ${y + 4} Z" fill="#a96a4a" stroke="#1a1a2e" stroke-width="4"/>
      <rect x="${x - 26}" y="${y + 4}" width="52" height="40" rx="8" fill="#c9805a" stroke="#1a1a2e" stroke-width="4.5"/>
    </g>`,
  bookshelf: ({ x = 50, y = 300, w = 160 }) =>
    `<g>
      <rect x="${x}" y="${y}" width="${w}" height="300" fill="#8a5a2b" stroke="#1a1a2e" stroke-width="5"/>
      <line x1="${x}" y1="${y + 100}" x2="${x + w}" y2="${y + 100}" stroke="#1a1a2e" stroke-width="5"/>
      <line x1="${x}" y1="${y + 200}" x2="${x + w}" y2="${y + 200}" stroke="#1a1a2e" stroke-width="5"/>
      <rect x="${x + 12}" y="${y + 12}" width="42" height="82" fill="#c94a4a"/><rect x="${x + 60}" y="${y + 20}" width="38" height="74" fill="#4a7ac9"/><rect x="${x + 104}" y="${y + 12}" width="44" height="82" fill="#6aae4a"/>
      <rect x="${x + 12}" y="${y + 112}" width="38" height="82" fill="#c9a44a"/><rect x="${x + 56}" y="${y + 120}" width="44" height="74" fill="#7a4ac9"/><rect x="${x + 106}" y="${y + 112}" width="42" height="82" fill="#4aa8c9"/>
      <rect x="${x + 16}" y="${y + 212}" width="58" height="76" fill="#c97a4a"/><rect x="${x + 82}" y="${y + 218}" width="66" height="70" fill="#8a6a3a"/>
    </g>`,
  tv: ({ x = 200, y = 960, w = 340 }) =>
    `<g>
      <rect x="${x}" y="${y - 170}" width="${w}" height="170" fill="#2a2a3a" stroke="#1a1a2e" stroke-width="5"/>
      <rect x="${x + 14}" y="${y - 150}" width="${w - 28}" height="132" rx="6" fill="#4a8ac9" stroke="#1a1a2e" stroke-width="4"/>
      <path d="M ${x + 24} ${y - 140} L ${x + 110} ${y - 60} L ${x + 60} ${y - 40} L ${x + 30} ${y - 100} Z" fill="#7ac94a" opacity="0.9"/>
      <line x1="${x + 150}" y1="${y - 140}" x2="${x + 260}" y2="${y - 140}" stroke="#3a6a9a" stroke-width="5" opacity="0.8"/>
      <rect x="${x}" y="${y}" width="${w}" height="54" rx="8" fill="#6a4a2a" stroke="#1a1a2e" stroke-width="5"/>
      <circle cx="${x + w - 30}" cy="${y + 27}" r="9" fill="#c94a4a"/>
      <circle cx="${x + 24}" cy="${y + 27}" r="5" fill="#4aae4a"/>
    </g>`,
  clock: ({ x = 560, y = 140, r = 40 }) =>
    `<g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1a1a2e" stroke-width="5.5"/>
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y - r + 14}" stroke="#1a1a2e" stroke-width="4.5"/>
      <line x1="${x}" y1="${y}" x2="${x + r - 16}" y2="${y}" stroke="#1a1a2e" stroke-width="4"/>
      <circle cx="${x}" cy="${y}" r="4" fill="#1a1a2e"/>
    </g>`,
  rug: ({ x = 90, y = 1120, w = 540 }) =>
    `<rect x="${x}" y="${y}" width="${w}" height="44" rx="18" fill="#c9a86c" opacity="0.8" stroke="#a8884a" stroke-width="4.5"/><rect x="${x + 18}" y="${y + 10}" width="${w - 36}" height="24" rx="12" fill="#d8bc84" opacity="0.6"/>`,
  door: ({ x = 560, y = 380, w = 130 }) =>
    `<g>
      <rect x="${x}" y="${y}" width="${w}" height="300" rx="6" fill="#a9724a" stroke="#1a1a2e" stroke-width="5"/>
      <rect x="${x + 12}" y="${y + 14}" width="${w - 44}" height="110" rx="4" fill="#c08a5a" stroke="#1a1a2e" stroke-width="3.6"/>
      <circle cx="${x + w - 24}" cy="${y + 150}" r="6" fill="#e6c84a" stroke="#1a1a2e" stroke-width="3"/>
    </g>`,
  table: ({ x = 300, y = 1100, r = 110 }) =>
    `<g>
      <ellipse cx="${x}" cy="${y}" rx="${r}" ry="32" fill="#b8915a" stroke="#1a1a2e" stroke-width="5"/>
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}" stroke="#8a5a2b" stroke-width="11"/>
      <ellipse cx="${x}" cy="${y + 4}" rx="${r - 16}" ry="20" fill="none" stroke="#8a5a2b" stroke-width="2.4" opacity="0.5"/>
      <circle cx="${x - 28}" cy="${y - 14}" r="13" fill="#fff" stroke="#1a1a2e" stroke-width="3"/>
      <circle cx="${x + 30}" cy="${y - 8}" r="13" fill="#fff" stroke="#1a1a2e" stroke-width="3"/>
    </g>`,
  frame: ({ x = 120, y = 160, w = 90, h = 110 }) =>
    `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#e8d8b8" stroke="#1a1a2e" stroke-width="4"/><rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="#a8c0d8"/><circle cx="${x + w / 2}" cy="${y + 34}" r="12" fill="#f7d9b8" stroke="#1a1a2e" stroke-width="2.6"/><path d="M ${x + w / 2 - 16} ${y + h - 12} Q ${x + w / 2} ${y + 52} ${x + w / 2 + 16} ${y + h - 12} Z" fill="#7aaec8" stroke="#1a1a2e" stroke-width="2.6"/></g>`,
};

// ===== 前景道具库 =====
const PROPS = {
  moon: ({ cx, cy, r = 54 }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f5e6a8" stroke="#e6c84a" stroke-width="4"/><circle cx="${cx + r * 0.4}" cy="${cy - r * 0.3}" r="${r * 0.8}" fill="#ffe680"/>`,
  pie: ({ cx, cy, r = 130, fill = "#FFD86B", stroke = "#E6A92C" }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="7"/><text x="${cx}" y="${cy + 20}" font-size="38" fill="${stroke}" text-anchor="middle" font-weight="700">饼</text>`,
  desk: ({ x, y, w = 180 }) =>
    `<rect x="${x}" y="${y}" width="${w}" height="16" fill="#8a5a2b" stroke="#1a1a2e" stroke-width="4"/><line x1="${x + 12}" y1="${y + 16}" x2="${x + 12}" y2="${y + 90}" stroke="#8a5a2b" stroke-width="10"/><line x1="${x + w - 12}" y1="${y + 16}" x2="${x + w - 12}" y2="${y + 90}" stroke="#8a5a2b" stroke-width="10"/>`,
  question: ({ x, y, size = 70, color = "#5a3a6a" }) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="700" font-family="sans-serif">?</text>`,
  heart: ({ cx, cy, r = 30, color = "#e85a71" }) =>
    `<path d="M ${cx} ${cy + r} C ${cx - r * 1.5} ${cy - r * 0.5}, ${cx - r * 0.6} ${cy - r * 1.6}, ${cx} ${cy - r * 0.4} C ${cx + r * 0.6} ${cy - r * 1.6}, ${cx + r * 1.5} ${cy - r * 0.5}, ${cx} ${cy + r} Z" fill="${color}"/>`,
  bulb: ({ cx, cy, r = 40 }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffe680" stroke="#e6b800" stroke-width="4.5"/><rect x="${cx - 12}" y="${cy + r}" width="24" height="14" fill="#ccc"/>`,
  rain: ({ x, y, n = 8, color = "#9ec5e8" }) =>
    Array.from({ length: n }, (_, i) => `<line x1="${x + i * 30}" y1="${y}" x2="${x + i * 30 - 12}" y2="${y + 30}" stroke="${color}" stroke-width="4.5"/>`).join(""),
  star: ({ cx, cy, r = 12, color = "#fff" }) =>
    `<text x="${cx}" y="${cy + r}" font-size="${r * 2.4}" fill="${color}" text-anchor="middle">★</text>`,
};

// ===== 渲染 =====
function panelSvg(p, gradId) {
  let scene = "";
  for (const s of p.scene || []) scene += SCENES[s.type]?.(s) || "";
  for (const a of p.actors || []) scene += ACTORS[a.type]?.(a) || "";
  for (const pr of p.props || []) scene += PROPS[pr.type]?.(pr) || "";
  const bubbles = (p.bubbles || []).map((b) => bubble(b)).join("");
  return `<rect width="720" height="1280" fill="url(#${gradId})"/>
    ${scene}
    ${bubbles}
    ${p.label ? `<text x="34" y="52" font-family="Microsoft YaHei, sans-serif" font-size="30" fill="#fff" opacity="0.6" font-weight="700">${p.label}</text>` : ""}`;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else a._.push(argv[i]);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const jsonPath = args["from-json"] ? resolve(String(args["from-json"])) : "article.json";
if (!existsSync(jsonPath)) {
  console.error(`✗ 找不到 article.json：${jsonPath}`);
  process.exit(1);
}
const article = JSON.parse(await readFile(jsonPath, "utf8"));
const panels = article.panels;
if (!Array.isArray(panels) || !panels.length) {
  console.error("✗ article.json 缺 panels 字段（[{bg1,bg2,scene,actors,props,bubbles,label}]）");
  process.exit(1);
}
const slug = args.slug ? String(args.slug) : article.slug || "draft";
const outDir = resolve(join("comics", slug));
await mkdir(outDir, { recursive: true });

const noStrip = !!args["no-strip"];
const noPanels = !!args["no-panels"];
const GAP = 30;

if (!noPanels) {
  for (let i = 0; i < panels.length; i++) {
    const gradId = `bgp${i}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTW}" height="${(OUTW / W) * H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${panels[i].bg1 || "#fff"}"/><stop offset="100%" stop-color="${panels[i].bg2 || "#fff"}"/></linearGradient></defs>${panelSvg(panels[i], gradId)}</svg>`;
    const file = join(outDir, `${String(i + 1).padStart(2, "0")}.jpg`);
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(file);
    console.log(`✓ ${file}`);
  }
}

if (!noStrip) {
  const stripH = panels.length * H + (panels.length - 1) * GAP;
  const defs = panels.map((p, i) => {
    const gid = `bgs${i}`;
    return `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.bg1 || "#fff"}"/><stop offset="100%" stop-color="${p.bg2 || "#fff"}"/></linearGradient>`;
  }).join("");
  const body = panels.map((p, i) => {
    const gid = `bgs${i}`;
    const offsetY = i * (H + GAP);
    let scene = "";
    for (const s of p.scene || []) scene += SCENES[s.type]?.(s) || "";
    for (const a of p.actors || []) scene += ACTORS[a.type]?.(a) || "";
    for (const pr of p.props || []) scene += PROPS[pr.type]?.(pr) || "";
    const bubbles = (p.bubbles || []).map((b) => bubble(b)).join("");
    return `<g transform="translate(0, ${offsetY})">
      <rect width="720" height="1280" fill="url(#${gid})"/>
      ${scene}
      ${bubbles}
      ${p.label ? `<text x="34" y="52" font-family="Microsoft YaHei, sans-serif" font-size="30" fill="#fff" opacity="0.6" font-weight="700">${p.label}</text>` : ""}
    </g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTW}" height="${(OUTW / W) * stripH}" viewBox="0 0 ${W} ${stripH}"><defs>${defs}</defs>${body}</svg>`;
  const stripFile = join(outDir, "strip.jpg");
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(stripFile);
  console.log(`✓ ${stripFile}（长条漫 ${panels.length} 格，${OUTW}x${Math.round((OUTW / W) * stripH)}）`);
}
console.log(`完成 → comics/${slug}/`);
