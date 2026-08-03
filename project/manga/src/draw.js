// 程序化 SVG 条漫生成器（声明式）：读 article.json 的 panels，渲染 comics/<slug>/NN.jpg
// 用法：node src/draw.js --from-json <article.json> [--slug <slug>]
// panel 结构：{ bg1, bg2, actors:[{type,x,hipY,color?,pose?}], props:[{type,...}], bubbles:[{x,y,w,h,text,px,py}], label }
// 构件库见 ACTORS / PROPS，Claude 只写「舞台调度」不写 SVG
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const W = 480,
  H = 640;

// 火柴人：pose 控制手臂（down 默认 / up 举手 / point 指向 / shrug 耸肩）
function stickman({ x, hipY, color = "#2b2b2b", pose = "down" }) {
  const headR = 22,
    headY = hipY - 90,
    bodyTop = headY + headR,
    bodyBot = hipY,
    armY = bodyTop + 18;
  let arms;
  if (pose === "up") arms = `<line x1="${x}" y1="${armY}" x2="${x - 24}" y2="${armY - 30}"/><line x1="${x}" y1="${armY}" x2="${x + 24}" y2="${armY - 30}"/>`;
  else if (pose === "point") arms = `<line x1="${x}" y1="${armY}" x2="${x - 22}" y2="${armY + 22}"/><line x1="${x}" y1="${armY}" x2="${x + 34}" y2="${armY + 6}"/>`;
  else if (pose === "shrug") arms = `<line x1="${x}" y1="${armY}" x2="${x - 26}" y2="${armY + 18}"/><line x1="${x}" y1="${armY}" x2="${x + 26}" y2="${armY + 18}"/>`;
  else arms = `<line x1="${x}" y1="${armY}" x2="${x - 26}" y2="${armY + 28}"/><line x1="${x}" y1="${armY}" x2="${x + 26}" y2="${armY + 28}"/>`;
  return `<g stroke="${color}" stroke-width="6" stroke-linecap="round" fill="none">
    <circle cx="${x}" cy="${headY}" r="${headR}" fill="${color}" stroke="none"/>
    <line x1="${x}" y1="${bodyTop}" x2="${x}" y2="${bodyBot}"/>
    ${arms}
    <line x1="${x}" y1="${hipY}" x2="${x - 22}" y2="${hipY + 50}"/>
    <line x1="${x}" y1="${hipY}" x2="${x + 22}" y2="${hipY + 50}"/>
  </g>`;
}

// 对话气泡：圆角矩形 + 尖角指向说话人，文字自动换行
function bubble({ x, y, w, h, text, px, py }) {
  const perLine = Math.max(6, Math.floor(w / 26));
  const lines = wrap(text, perLine);
  const fontSize = lines.length > 2 ? 20 : lines.length > 1 ? 24 : 28;
  const startY = y + h / 2 - ((lines.length - 1) * fontSize) / 2;
  const tspans = lines
    .map((l, i) => `<tspan x="${x + w / 2}" y="${startY + i * fontSize}">${l}</tspan>`)
    .join("");
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" stroke="#2b2b2b" stroke-width="3"/>
    <polygon points="${px - 12},${py} ${px + 12},${py} ${px},${py + 22}" fill="#fff" stroke="#2b2b2b" stroke-width="3"/>
    <polygon points="${px - 8},${py + 2} ${px + 8},${py + 2} ${px},${py + 18}" fill="#fff" stroke="none"/>
    <text font-family="Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#1a1a2e" text-anchor="middle" font-weight="600">${tspans}</text>
  </g>`;
}

function wrap(s, n) {
  if (!s) return [""];
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

// 道具库
const PROPS = {
  moon: ({ cx, cy, r = 36 }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f5e6a8"/><circle cx="${cx + r * 0.4}" cy="${cy - r * 0.3}" r="${r * 0.8}" fill="currentColor"/>`,
  pie: ({ cx, cy, r = 90, fill = "#FFD86B", stroke = "#E6A92C" }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="5"/><text x="${cx}" y="${cy + 14}" font-size="26" fill="${stroke}" text-anchor="middle" font-weight="700">饼</text>`,
  desk: ({ x, y, w = 120 }) =>
    `<rect x="${x}" y="${y}" width="${w}" height="10" fill="#8a5a2b"/><line x1="${x + 8}" y1="${y + 10}" x2="${x + 8}" y2="${y + 60}" stroke="#8a5a2b" stroke-width="6"/><line x1="${x + w - 8}" y1="${y + 10}" x2="${x + w - 8}" y2="${y + 60}" stroke="#8a5a2b" stroke-width="6"/>`,
  question: ({ x, y, size = 40, color = "#5a3a6a" }) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="700" font-family="sans-serif">?</text>`,
  heart: ({ cx, cy, r = 18, color = "#e85a71" }) =>
    `<path d="M ${cx} ${cy + r} C ${cx - r * 1.5} ${cy - r * 0.5}, ${cx - r * 0.6} ${cy - r * 1.6}, ${cx} ${cy - r * 0.4} C ${cx + r * 0.6} ${cy - r * 1.6}, ${cx + r * 1.5} ${cy - r * 0.5}, ${cx} ${cy + r} Z" fill="${color}"/>`,
  bulb: ({ cx, cy, r = 26 }) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffe680" stroke="#e6b800" stroke-width="3"/><rect x="${cx - 8}" y="${cy + r}" width="16" height="10" fill="#ccc"/>`,
  rain: ({ x, y, n = 6, color = "#9ec5e8" }) =>
    Array.from({ length: n }, (_, i) => `<line x1="${x + i * 24}" y1="${y}" x2="${x + i * 24 - 10}" y2="${y + 24}" stroke="${color}" stroke-width="3"/>`).join(""),
  star: ({ cx, cy, r = 8, color = "#fff" }) =>
    `<text x="${cx}" y="${cy + r}" font-size="${r * 2.4}" fill="${color}" text-anchor="middle">★</text>`,
};

const ACTORS = { stickman };

function renderPanel(p) {
  let scene = "";
  for (const a of p.actors || []) scene += ACTORS[a.type]?.(a) || "";
  for (const pr of p.props || []) scene += PROPS[pr.type]?.(pr) || "";
  const bubbles = (p.bubbles || []).map((b) => bubble(b)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.bg1}"/><stop offset="100%" stop-color="${p.bg2}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${scene}
    ${bubbles}
    ${p.label ? `<text x="24" y="36" font-family="Microsoft YaHei, sans-serif" font-size="20" fill="#fff" opacity="0.6" font-weight="700">${p.label}</text>` : ""}
  </svg>`;
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
  console.error("✗ article.json 缺 panels 字段（[{bg1,bg2,actors,props,bubbles,label}]）");
  process.exit(1);
}
const slug = args.slug ? String(args.slug) : article.slug || "draft";
const outDir = resolve(join("comics", slug));
await mkdir(outDir, { recursive: true });

for (let i = 0; i < panels.length; i++) {
  const svg = renderPanel(panels[i]);
  const file = join(outDir, `${String(i + 1).padStart(2, "0")}.jpg`);
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(file);
  console.log(`✓ ${file}`);
}
console.log(`共 ${panels.length} 格 → comics/${slug}/`);
