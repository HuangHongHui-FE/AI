// markdown → 微信正文 HTML：主题渲染器 + 非标准扩展语法预处理
// 自 wechat-img/html.js 迁入，去掉 CTA（2026-09-14 用户决定正文结束即结束）
import { marked } from "marked";
import { THEMES, THEME_NAMES } from "../../references/themes.mjs";

const BASE_FONT = `-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif`;

// 模块级当前主题：marked 的 renderer 是单例，靠它让各 render 钩子取到配色
let currentTheme = THEMES.minimal;

// 按名字取主题；名字无效时回落到 minimal
export function themeByName(name) {
  return THEMES[name] || THEMES.minimal;
}

// 随机抽一个不在 exclude 里的主题名（同篇同主题，由调用方抽一次再传）
export function pickRandomThemeName(exclude = []) {
  const pool = THEME_NAMES.filter((k) => !exclude.includes(k));
  const list = pool.length ? pool : THEME_NAMES;
  return list[Math.floor(Math.random() * list.length)];
}

const renderer = new marked.Renderer();

renderer.paragraph = (text) =>
  `<p style="margin:0 0 20px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${currentTheme.text};letter-spacing:0.04em;">${text}</p>`;

// 标题：h2 带左侧色条（主题决定是否用强调色条），h3 纯色
renderer.heading = (text, level) => {
  const t = currentTheme;
  if (level === 2) {
    const bar = t.h2Bar
      ? `<span style="display:inline-block;width:4px;height:20px;background:linear-gradient(180deg,${t.accent} 0%,${t.accent}cc 100%);border-radius:2px;margin-right:10px;flex-shrink:0;"></span>`
      : `<span style="display:inline-block;width:3px;height:18px;background:${t.border};border-radius:2px;margin-right:10px;flex-shrink:0;"></span>`;
    return `<h2 style="font-family:${BASE_FONT};font-size:19px;font-weight:600;color:${t.accent};margin:36px 0 18px;padding:0;display:flex;align-items:center;line-height:1.4;">${bar}${text}</h2>`;
  }
  if (level === 3) {
    return `<h3 style="font-family:${BASE_FONT};font-size:17px;font-weight:600;color:${t.accent};margin:28px 0 14px;padding:0;">${text}</h3>`;
  }
  return `<h${level} style="font-family:${BASE_FONT};margin:24px 0 14px;color:${t.accent};">${text}</h${level}>`;
};

renderer.strong = (text) => {
  const t = currentTheme;
  const bg = t.strongBg ? `background:linear-gradient(180deg,transparent 60%,${t.accentLight} 60%);` : "";
  return `<strong style="color:${t.accent};font-weight:600;${bg}padding:0 2px;">${text}</strong>`;
};

renderer.em = (text) => `<em style="font-style:italic;color:${currentTheme.muted};">${text}</em>`;

renderer.blockquote = (quote) => {
  const t = currentTheme;
  const bg = t.quoteBg ? `background:${t.bg};` : "background:transparent;";
  return `<blockquote style="margin:24px 0;padding:10px 18px;${bg}border-left:3px solid ${t.accent};border-radius:0 4px 4px 0;color:${t.muted};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">${quote}</blockquote>`;
};

renderer.hr = () =>
  `<div style="text-align:center;color:${currentTheme.grey};letter-spacing:8px;margin:32px 0;font-size:14px;">· · ·</div>`;

// 图片：figcaption 用 alt 文本，微信里 alt 不显示所以显式渲染
renderer.image = (href, _title, text) =>
  `<figure style="margin:18px 0;text-align:center;"><img src="${href}" alt="${text || ""}" style="max-width:100%;border-radius:6px;display:block;margin:0 auto;"/><figcaption style="margin-top:8px;font-size:13px;color:${currentTheme.grey};line-height:1.5;">${text || ""}</figcaption></figure>`;

marked.setOptions({ breaks: true, gfm: true, renderer });

// 提示框配色：调用方用 :::info|tip|warning|danger 包裹
const CALLOUT = {
  info: ["#2C4A6B", "#E8F0F7"],
  tip: ["#3a6b5a", "#E8F3EE"],
  warning: ["#E8A87C", "#FFF4EC"],
  danger: ["#D9534F", "#FCEBEA"],
};

// emoji shortcode：marked 不解析 :name:，常用十几个够用，直接写 emoji 也行
const EMOJI = {
  ":red:": "❤️", ":fire:": "🔥", ":warn:": "⚠️", ":check:": "✅", ":cross:": "❌",
  ":star:": "⭐", ":bulb:": "💡", ":eye:": "👀", ":think:": "🤔", ":sad:": "😔",
  ":clock:": "🕐", ":pin:": "📌",
};

// 非标准扩展语法预处理：高亮 ==、提示框、时间线、数据卡、引语署名、上标、emoji
function preprocess(markdown, t) {
  const hlBg = t.accentLight || "#f0f0f0";
  return markdown
    .replace(/==(.+?)==/g, `<span style="background:${hlBg};color:${t.accent};padding:0 3px;border-radius:2px;">$1</span>`)
    .replace(/:::(info|tip|warning|danger)\s+([\s\S]+?)\s*:::/g, (_m, kind, c) => {
      const [bd, bg] = CALLOUT[kind];
      return `<div style="margin:18px 0;padding:12px 16px;border-left:4px solid ${bd};background:${bg};border-radius:0 6px 6px 0;color:#333;font-family:${BASE_FONT};font-size:15px;line-height:1.7;">${c}</div>`;
    })
    .replace(
      /:::time\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<div style="margin:10px 0;padding:4px 0 4px 16px;border-left:3px solid ${t.border};font-family:${BASE_FONT};font-size:15px;line-height:1.8;"><span style="font-weight:700;color:${t.accent};margin-right:12px;">$1</span>$2</div>`
    )
    .replace(
      /:::stat\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<div style="margin:18px 0;padding:14px 18px;background:${t.bg === "#fff" ? "#f8f8f8" : t.bg};border-radius:8px;text-align:center;font-family:${BASE_FONT};"><div style="font-size:26px;font-weight:700;color:${t.accent};line-height:1.2;">$1</div><div style="font-size:13px;color:${t.grey};margin-top:4px;">$2</div></div>`
    )
    .replace(
      /:::quote\s+([\s\S]+?)\s*\|\s*([^|]+?)\s*:::/g,
      `<blockquote style="margin:18px 0;padding:10px 18px;background:${t.bg};border-left:3px solid ${t.accent};border-radius:0 4px 4px 0;color:${t.muted};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">$1<div style="text-align:right;font-size:13px;color:${t.grey};margin-top:6px;">—— $2</div></blockquote>`
    )
    .replace(
      /\^([^\^\n]+?)\^/g,
      `<sup style="font-size:0.75em;vertical-align:super;color:${t.muted};">$1</sup>`
    )
    .replace(/:[a-z_]+:/g, (s) => EMOJI[s] || s);
}

// 给 marked 输出的裸标签补内联样式：微信正文不吃外链 CSS，表格/列表/代码必须逐标签写
function inlineStyles(html, t) {
  const thBg = t.bg === "#fff" ? "#f5f5f5" : t.bg;
  return html
    .replace(/<table>/g, `<table style="border-collapse:collapse;width:100%;margin:18px 0;font-family:${BASE_FONT};font-size:14px;">`)
    .replace(/<th>/g, `<th style="border:1px solid ${t.border};padding:8px 10px;background:${thBg};color:${t.accent};font-weight:600;text-align:left;">`)
    .replace(/<td>/g, `<td style="border:1px solid ${t.border};padding:8px 10px;color:${t.text};text-align:left;">`)
    .replace(/<ul>/g, `<ul style="margin:12px 0;padding-left:22px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${t.text};">`)
    .replace(/<ol>/g, `<ol style="margin:12px 0;padding-left:24px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${t.text};">`)
    .replace(/<li>/g, `<li style="margin:3px 0;">`)
    // 紧凑化列表：微信渲染器不折叠块间空白文本节点，<ol>\n<li> 会渲染成空行
    .replace(/(<(?:ol|ul)\b[^>]*>)\s*/g, "$1")
    .replace(/\s*(<\/(?:ol|ul)>)/g, "$1")
    .replace(/(<\/li>)\s*(<li)/g, "$1$2")
    .replace(/<code>/g, `<code style="background:#f3f3f3;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.88em;color:${t.text};">`)
    .replace(/<del>/g, `<del style="text-decoration:line-through;color:${t.grey};">`);
}

// 主入口：markdown → 微信正文 HTML（可直接作为草稿 content）
export function markdownToHtml(markdown, themeName) {
  currentTheme = themeByName(themeName);
  const t = currentTheme;
  const html = marked.parse(preprocess(String(markdown), t));
  return inlineStyles(html, t);
}

// 本地预览页：外层套灰色底 + 白卡片，模拟手机阅读效果（不推给微信）
export function fullPageHtml(title, bodyHtml, themeName) {
  const t = themeByName(themeName);
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="background:#f5f5f5;margin:0;padding:24px 0;"><div style="background:${t.bg};max-width:640px;margin:0 auto;padding:24px 20px 32px;border-radius:4px;">${bodyHtml}</div></body></html>`;
}

// HTML 文本转义
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
