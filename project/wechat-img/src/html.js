import { marked } from "marked";

const BASE_FONT = `-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif`;

// 20 套主题：保留 minimal/warm/cool 兼容旧日志，新增 17 套降饱和非橙配色
// 配色 + CTA 结构（simple 2层 / mid 3层 / full 4层）都不同形，按篇随机轮换去同质化
// CTA 按钮配色全跟 theme 联动，文案池按标题 hash 确定性轮换
const THEMES = {
  minimal: {
    accent: "#1a1a1a",
    btnBg: "#1a1a1a",
    btnText: "#fff",
    text: "#333",
    muted: "#777",
    grey: "#999",
    border: "#e0e0e0",
    bg: "#fff",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  warm: {
    accent: "#3a6b5a",
    accentLight: "#D6E4DC",
    btnBg: "linear-gradient(135deg,#3a6b5a 0%,#5a8a78 100%)",
    btnText: "#fff",
    text: "#3f3f3f",
    muted: "#4a5a52",
    grey: "#999",
    border: "#C9D9CF",
    bg: "#F2F6F3",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  cool: {
    accent: "#2C4A6B",
    accentLight: "#DCE6F0",
    btnBg: "linear-gradient(135deg,#2C4A6B 0%,#4A6B8C 100%)",
    btnText: "#fff",
    text: "#3f3f3f",
    muted: "#3a5a7a",
    grey: "#999",
    border: "#C9D6E5",
    bg: "#EEF2F7",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  ink: {
    // 墨蓝
    accent: "#2B4C8C",
    accentLight: "#D8E0F0",
    btnBg: "linear-gradient(135deg,#2B4C8C 0%,#4A6CAE 100%)",
    btnText: "#fff",
    text: "#3a3f4f",
    muted: "#3a4a6a",
    grey: "#999",
    border: "#C9D2E5",
    bg: "#EEF1F7",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  moss: {
    // 苔藓绿
    accent: "#5B7C5D",
    accentLight: "#DBE6DC",
    btnBg: "linear-gradient(135deg,#5B7C5D 0%,#7A9C7C 100%)",
    btnText: "#fff",
    text: "#3f433f",
    muted: "#4a5a4a",
    grey: "#999",
    border: "#CFDCCF",
    bg: "#F1F5F1",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  slate: {
    // 板岩青灰
    accent: "#5A6B7A",
    accentLight: "#DDE2E8",
    btnBg: "#5A6B7A",
    btnText: "#fff",
    text: "#3a4048",
    muted: "#5a6570",
    grey: "#999",
    border: "#D2D7DD",
    bg: "#F1F3F6",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  plum: {
    // 紫梅
    accent: "#6B4C7A",
    accentLight: "#E2D8E8",
    btnBg: "linear-gradient(135deg,#6B4C7A 0%,#8C6C9E 100%)",
    btnText: "#fff",
    text: "#3f3a44",
    muted: "#5a4a6a",
    grey: "#999",
    border: "#D8CFDD",
    bg: "#F4F1F6",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  sand: {
    // 沙褐
    accent: "#B8956A",
    accentLight: "#EFE4D2",
    btnBg: "linear-gradient(135deg,#B8956A 0%,#D0B088 100%)",
    btnText: "#fff",
    text: "#433f3a",
    muted: "#6a5a4a",
    grey: "#999",
    border: "#E0D6C6",
    bg: "#F7F3EE",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  pine: {
    // 松绿
    accent: "#2F5D4F",
    accentLight: "#D2E0DA",
    btnBg: "#2F5D4F",
    btnText: "#fff",
    text: "#3a403c",
    muted: "#3a5a4f",
    grey: "#999",
    border: "#C9D6CF",
    bg: "#EFF3F0",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  rust: {
    // 铁锈暗红褐（非橙）
    accent: "#8C4A3A",
    accentLight: "#EAD6CE",
    btnBg: "linear-gradient(135deg,#8C4A3A 0%,#AE6A5A 100%)",
    btnText: "#fff",
    text: "#443b38",
    muted: "#6a4a3f",
    grey: "#999",
    border: "#DDCFC8",
    bg: "#F5F0ED",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  ocean: {
    // 海蓝
    accent: "#2A6B8C",
    accentLight: "#D2E2EC",
    btnBg: "linear-gradient(135deg,#2A6B8C 0%,#4A8BAE 100%)",
    btnText: "#fff",
    text: "#383f44",
    muted: "#3a5a6a",
    grey: "#999",
    border: "#C9D8E0",
    bg: "#EFF3F6",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  olive: {
    // 橄榄
    accent: "#6B7A3A",
    accentLight: "#E2E2C9",
    btnBg: "#6B7A3A",
    btnText: "#fff",
    text: "#3f4038",
    muted: "#5a5a3a",
    grey: "#999",
    border: "#D2D6BF",
    bg: "#F3F4EC",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  cocoa: {
    // 可可棕
    accent: "#6A4A3A",
    accentLight: "#E8D8CE",
    btnBg: "linear-gradient(135deg,#6A4A3A 0%,#8A6A5A 100%)",
    btnText: "#fff",
    text: "#433c38",
    muted: "#5a4a3f",
    grey: "#999",
    border: "#DDD2C9",
    bg: "#F5F1ED",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  lavender: {
    // 薰衣草紫
    accent: "#6A5A9C",
    accentLight: "#E0DAF0",
    btnBg: "linear-gradient(135deg,#6A5A9C 0%,#8A7ABE 100%)",
    btnText: "#fff",
    text: "#3c3a44",
    muted: "#5a4a6a",
    grey: "#999",
    border: "#D8D2E0",
    bg: "#F3F1F7",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  sage: {
    // 鼠尾草绿
    accent: "#7A8A6B",
    accentLight: "#E2E6D8",
    btnBg: "linear-gradient(135deg,#7A8A6B 0%,#9AAB8B 100%)",
    btnText: "#fff",
    text: "#3f403a",
    muted: "#5a6a4f",
    grey: "#999",
    border: "#D6DCCE",
    bg: "#F3F5EF",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  cobalt: {
    // 钴蓝
    accent: "#3A5A9C",
    btnBg: "#3A5A9C",
    btnText: "#fff",
    text: "#383c44",
    muted: "#3a4a6a",
    grey: "#999",
    border: "#CDD5E5",
    bg: "#EEF1F7",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  amber: {
    // 琥珀暗黄褐（非橙）
    accent: "#9C7A2A",
    accentLight: "#EFE3C2",
    btnBg: "linear-gradient(135deg,#9C7A2A 0%,#BC9A4A 100%)",
    btnText: "#fff",
    text: "#433c33",
    muted: "#6a5a2a",
    grey: "#999",
    border: "#E0D8C0",
    bg: "#F6F3EA",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  forest: {
    // 林深绿
    accent: "#2A5A3A",
    accentLight: "#CFE0D2",
    btnBg: "linear-gradient(135deg,#2A5A3A 0%,#4A7A5A 100%)",
    btnText: "#fff",
    text: "#383c3a",
    muted: "#3a5a3f",
    grey: "#999",
    border: "#C9D6CC",
    bg: "#EEF3EF",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
  graphite: {
    // 石墨蓝灰
    accent: "#4A5A6A",
    accentLight: "#DCE2E8",
    btnBg: "#4A5A6A",
    btnText: "#fff",
    text: "#383c40",
    muted: "#4a5a6a",
    grey: "#999",
    border: "#D2D7DD",
    bg: "#F0F2F4",
    h2Bar: false,
    strongBg: false,
    quoteBg: false,
  },
  wine: {
    // 酒红
    accent: "#7A3A4A",
    accentLight: "#EAD6DC",
    btnBg: "linear-gradient(135deg,#7A3A4A 0%,#9A5A6A 100%)",
    btnText: "#fff",
    text: "#443a3d",
    muted: "#5a3a4a",
    grey: "#999",
    border: "#DDCFD3",
    bg: "#F4EEF0",
    h2Bar: true,
    strongBg: true,
    quoteBg: true,
  },
};

// 模块级当前主题（marked renderer 单例，靠它取主题）
let currentTheme = THEMES.minimal;

// 选主题：显式指定优先；否则真随机抽一个不在 exclude 里的（去近 5 篇同形）
function pickTheme(name, title, exclude = []) {
  if (name && THEMES[name]) return THEMES[name];
  const keys = Object.keys(THEMES).filter((k) => !exclude.includes(k));
  const pool = keys.length ? keys : Object.keys(THEMES);
  return THEMES[pool[Math.floor(Math.random() * pool.length)]];
}

// 随机选一个主题名：index.js 调一次得到名字，再传给渲染函数保证同篇同主题
export function pickRandomThemeName(exclude = []) {
  const keys = Object.keys(THEMES).filter((k) => !exclude.includes(k));
  const pool = keys.length ? keys : Object.keys(THEMES);
  return pool[Math.floor(Math.random() * pool.length)];
}

// 按 seed 确定性取池中一项，同篇同 seed 永远取同一项（可重现）

const renderer = new marked.Renderer();

renderer.paragraph = (text) =>
  `<p style="margin:0 0 20px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${currentTheme.text};letter-spacing:0.04em;">${text}</p>`;

renderer.heading = (text, level) => {
  const t = currentTheme;
  if (level === 2) {
    const bar = t.h2Bar
      ? `<span style="display:inline-block;width:4px;height:20px;background:linear-gradient(180deg,${t.accent} 0%,${t.accent}cc 100%);border-radius:2px;margin-right:10px;flex-shrink:0;"></span>`
      : `<span style="display:inline-block;width:3px;height:18px;background:${t.border};border-radius:2px;margin-right:10px;flex-shrink:0;"></span>`;
    return `<h2 style="font-family:${BASE_FONT};font-size:19px;font-weight:600;color:${t.accent};margin:36px 0 18px;padding:0;display:flex;align-items:center;line-height:1.4;">${bar}${text}</h2>`;
  }
  if (level === 3) {
    return `<h3 style="font-family:${BASE_FONT};font-size:17px;font-weight:600;color:${currentTheme.accent};margin:28px 0 14px;padding:0;">${text}</h3>`;
  }
  return `<h${level} style="font-family:${BASE_FONT};margin:24px 0 14px;color:${currentTheme.accent};">${text}</h${level}>`;
};

renderer.strong = (text) => {
  const t = currentTheme;
  const bg = t.strongBg
    ? `background:linear-gradient(180deg,transparent 60%,${t.accentLight} 60%);`
    : "";
  return `<strong style="color:${t.accent};font-weight:600;${bg}padding:0 2px;">${text}</strong>`;
};

renderer.em = (text) =>
  // 真斜体（旧版 font-style:normal 没斜体），配色用 muted 区分加粗的 accent
  `<em style="font-style:italic;color:${currentTheme.muted};">${text}</em>`;

renderer.blockquote = (quote) => {
  const t = currentTheme;
  const inner = quote.replace(/<p /g, "<p ");
  const bg = t.quoteBg ? `background:${t.bg};` : "background:transparent;";
  return `<blockquote style="margin:24px 0;padding:10px 18px;${bg}border-left:3px solid ${t.accent};border-radius:0 4px 4px 0;color:${t.muted};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">${inner}</blockquote>`;
};

renderer.hr = () =>
  `<div style="text-align:center;color:${currentTheme.grey};letter-spacing:8px;margin:32px 0;font-size:14px;">· · ·</div>`;

renderer.image = (href, _title, text) =>
  `<figure style="margin:18px 0;text-align:center;"><img src="${href}" alt="${text || ""}" style="max-width:100%;border-radius:6px;display:block;margin:0 auto;"/><figcaption style="margin-top:8px;font-size:13px;color:${currentTheme.grey};line-height:1.5;">${text || ""}</figcaption></figure>`;

marked.setOptions({ breaks: true, gfm: true, renderer });

export function markdownToHtml(markdown, theme) {
  currentTheme = pickTheme(theme, "");
  const t = currentTheme;
  // ==高亮== 语法 → 主题浅底背景色 span（marked 默认不解析 ==，需预处理）
  const hlBg = t.accentLight || "#f0f0f0";
  // 自定义扩展语法预处理（都不是 md 标准，marked 默认不解析，预处理成 HTML 透传）
  const CALLOUT = {
    info: ["#2C4A6B", "#E8F0F7"],
    tip: ["#3a6b5a", "#E8F3EE"],
    warning: ["#E8A87C", "#FFF4EC"],
    danger: ["#D9534F", "#FCEBEA"],
  };
  // emoji shortcode 映射（marked 默认不解析 :name:，常用几十个够用，直接写 emoji 字符也行）
  const EMOJI = {
    ":red:": "❤️",
    ":fire:": "🔥",
    ":warn:": "⚠️",
    ":check:": "✅",
    ":cross:": "❌",
    ":star:": "⭐",
    ":bulb:": "💡",
    ":eye:": "👀",
    ":think:": "🤔",
    ":sad:": "😔",
    ":clock:": "🕐",
    ":pin:": "📌",
  };
  const md = markdown
    .replace(
      /==(.+?)==/g,
      `<span style="background:${hlBg};color:${t.accent};padding:0 3px;border-radius:2px;">$1</span>`,
    )
    // 提示框 callout :::info/tip/warning/danger 内容 :::
    .replace(
      /:::(info|tip|warning|danger)\s+([\s\S]+?)\s*:::/g,
      (_m, t2, c) => {
        const [bd, bg] = CALLOUT[t2];
        return `<div style="margin:18px 0;padding:12px 16px;border-left:4px solid ${bd};background:${bg};border-radius:0 6px 6px 0;color:#333;font-family:${BASE_FONT};font-size:15px;line-height:1.7;">${c}</div>`;
      },
    )
    // 时间线节点 :::time 年份 内容 :::
    .replace(
      /:::time\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<div style="margin:10px 0;padding:4px 0 4px 16px;border-left:3px solid ${t.border};font-family:${BASE_FONT};font-size:15px;line-height:1.8;"><span style="font-weight:700;color:${t.accent};margin-right:12px;">$1</span>$2</div>`,
    )
    // 数据卡片 :::stat 数值 说明 :::
    .replace(
      /:::stat\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<div style="margin:18px 0;padding:14px 18px;background:${t.bg === "#fff" ? "#f8f8f8" : t.bg};border-radius:8px;text-align:center;font-family:${BASE_FONT};"><div style="font-size:26px;font-weight:700;color:${t.accent};line-height:1.2;">$1</div><div style="font-size:13px;color:${t.grey};margin-top:4px;">$2</div></div>`,
    )
    // 引语署名 :::quote 原话 | 署名 :::
    .replace(
      /:::quote\s+([\s\S]+?)\s*\|\s*([^|]+?)\s*:::/g,
      `<blockquote style="margin:18px 0;padding:10px 18px;background:${t.bg};border-left:3px solid ${t.accent};border-radius:0 4px 4px 0;color:${t.muted};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">$1<div style="text-align:right;font-size:13px;color:${t.grey};margin-top:6px;">—— $2</div></blockquote>`,
    )
    // 上标 ^text^ → <sup>（下标中文少用，且 ~ 与删除线 ~~ 冲突，不实现）
    .replace(
      /\^([^\^\n]+?)\^/g,
      `<sup style="font-size:0.75em;vertical-align:super;color:${t.muted};">$1</sup>`,
    )
    // emoji shortcode
    .replace(/:[a-z_]+:/g, (s) => EMOJI[s] || s);
  let html = marked.parse(md);
  // 表格内联样式（微信正文默认无边框会挤成一团），配色跟 theme
  const thBg = t.bg === "#fff" ? "#f5f5f5" : t.bg;
  html = html
    .replace(
      /<table>/g,
      `<table style="border-collapse:collapse;width:100%;margin:18px 0;font-family:${BASE_FONT};font-size:14px;">`,
    )
    .replace(
      /<th>/g,
      `<th style="border:1px solid ${t.border};padding:8px 10px;background:${thBg};color:${t.accent};font-weight:600;text-align:left;">`,
    )
    .replace(
      /<td>/g,
      `<td style="border:1px solid ${t.border};padding:8px 10px;color:${t.text};text-align:left;">`,
    )
    // 列表内联样式（微信正文 ul/ol 默认 bullet/缩进会被吃）
    .replace(
      /<ul>/g,
      `<ul style="margin:12px 0;padding-left:22px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${t.text};">`,
    )
    .replace(
      /<ol>/g,
      `<ol style="margin:12px 0;padding-left:24px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:${t.text};">`,
    )
    .replace(/<li>/g, `<li style="margin:3px 0;">`)
    // 紧凑化列表：微信正文渲染器不折叠 block 间的空白文本节点，
    // <ol>\n<li> 间的换行会被渲染成空行（每项上下出现空白项），去掉标签间换行
    .replace(/(<(?:ol|ul)\b[^>]*>)\s*/g, "$1")
    .replace(/\s*(<\/(?:ol|ul)>)/g, "$1")
    .replace(/(<\/li>)\s*(<li)/g, "$1$2")
    // 行内代码 / 删除线内联样式（marked 默认无样式）
    .replace(
      /<code>/g,
      `<code style="background:#f3f3f3;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.88em;color:${t.text};">`,
    )
    .replace(
      /<del>/g,
      `<del style="text-decoration:line-through;color:${t.grey};">`,
    );
  return html;
}

export function fullPageHtml(title, bodyHtml, ctaHtml, theme) {
  const t = pickTheme(theme, title);
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="background:#f5f5f5;margin:0;padding:24px 0;"><div style="background:${t.bg};max-width:640px;margin:0 auto;padding:24px 20px 32px;border-radius:4px;">${bodyHtml}${ctaHtml || ""}</div></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
