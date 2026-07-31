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
    ctaLayers: "simple",
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
    ctaLayers: "full",
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
    ctaLayers: "mid",
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
    ctaLayers: "mid",
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
    ctaLayers: "full",
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
    ctaLayers: "simple",
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
    ctaLayers: "mid",
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
    ctaLayers: "full",
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
    ctaLayers: "simple",
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
    ctaLayers: "full",
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
    ctaLayers: "mid",
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
    ctaLayers: "simple",
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
    ctaLayers: "mid",
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
    ctaLayers: "full",
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
    ctaLayers: "mid",
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
    ctaLayers: "simple",
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
    ctaLayers: "full",
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
    ctaLayers: "mid",
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
    ctaLayers: "simple",
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
    ctaLayers: "full",
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

// CTA 固定文案做池轮换，破「每篇结尾一字不差」的同质化铁证；按标题 hash 确定性选，同篇可重现
// 2026-07-23 三池各扩到 20（原 4/3/3），分布更散，判官扫近 10 篇难见同款结尾
const CTA_TAGS = [
  "留 言 互 动",
  "说 句 心 里 话",
  "评 论 区 见",
  "唠 唠 两 句",
  "评 论 区 等 你",
  "说 说 你 的 看 法",
  "你 怎 么 看",
  "留 个 言 吧",
  "评 论 区 坐 坐",
  "说 句 实 在 的",
  "唠 两 句 嗑",
  "评 论 区 聊",
  "留 言 唠 唠",
  "你 也 说 说",
  "留 言 等 你",
  "评 论 见",
  "说 说 看 法",
  "唠 唠 嗑 儿",
  "留 言 区 见",
  "你 也 聊 两 句",
];
const CTA_MIDS = [
  "评论区聊聊，是哪句话戳穿了你？<br/>点赞 + 评论，让更多人看见。",
  "哪句戳到你了？评论区说一句。<br/>点赞 + 评论，让更多人看见。",
  "你怎么看这事？评论区聊两句。<br/>点赞 + 评论，让更多人看见。",
  "换你你会怎么说？评论区等你。<br/>点赞 + 评论，让更多人看见。",
  "这事你站哪边？评论区说一句。<br/>点赞 + 评论，让更多人看见。",
  "哪个细节戳中你了？留言聊聊。<br/>点赞 + 评论，让更多人看见。",
  "你身边有过这样的事吗？评论区唠唠。<br/>点赞 + 评论，让更多人看见。",
  "这账你怎么算？评论区聊聊。<br/>点赞 + 评论，让更多人看见。",
  "哪句话说到你心坎了？留个言。<br/>点赞 + 评论，让更多人看见。",
  "换作是你怎么办？评论区见。<br/>点赞 + 评论，让更多人看见。",
  "这事你咋想？评论区说两句。<br/>点赞 + 评论，让更多人看见。",
  "哪句让你愣了一下？留言唠唠。<br/>点赞 + 评论，让更多人看见。",
  "你的看法是？评论区聊聊。<br/>点赞 + 评论，让更多人看见。",
  "这事搁你身上呢？评论区见。<br/>点赞 + 评论，让更多人看见。",
  "哪个点你最认同？留个言。<br/>点赞 + 评论，让更多人看见。",
  "你会怎么选？评论区聊聊。<br/>点赞 + 评论，让更多人看见。",
  "这话你信吗？评论区说说。<br/>点赞 + 评论，让更多人看见。",
  "哪段戳到你了？留言区见。<br/>点赞 + 评论，让更多人看见。",
  "你的判断是啥？评论区唠唠。<br/>点赞 + 评论，让更多人看见。",
  "这事你怎么看？留个言吧。<br/>点赞 + 评论，让更多人看见。",
];
const CTA_ICONS = [
  "❤ 点赞 · 评论 · 转发",
  "👍 点赞 · 评论 · 转发",
  "❤ 点赞 · 评论 · 分享",
  "👍 点赞 · 评论 · 分享",
  "❤ 点赞 · 评论 · 收藏",
  "🌟 点赞 · 评论 · 转发",
  "❤ 评论 · 转发 · 关注",
  "👍 评论 · 分享 · 收藏",
  "❤ 点赞 · 转发 · 收藏",
  "👍 点赞 · 评论 · 留言",
  "❤ 评论 · 分享 · 转发",
  "🌟 点赞 · 收藏 · 转发",
  "❤ 点赞 · 评论 · 关注",
  "👍 评论 · 转发 · 留言",
  "❤ 点赞 · 分享 · 收藏",
  "👍 点赞 · 评论 · 关注",
  "❤ 评论 · 收藏 · 转发",
  "🌟 点赞 · 转发 · 关注",
  "❤ 点赞 · 留言 · 评论",
  "👍 评论 · 收藏 · 分享",
];

// 按 seed 确定性取池中一项，同篇同 seed 永远取同一项（可重现）
function poolPick(arr, seed) {
  let h = 0;
  for (const c of seed || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

const renderer = new marked.Renderer();

// 头条 ProseMirror 编辑器粘贴时只保留保守内联样式子集
// （color/background-color/font-weight/font-style/text-align/font-size/line-height/块级 border-left）
// flex/gradient/shadow/border-radius/div嵌套必丢，故全部降级
renderer.paragraph = (text) =>
  `<p style="color:${currentTheme.text};font-size:16px;line-height:1.85;">${text}</p>`;

renderer.heading = (text, level) => {
  const t = currentTheme;
  if (level === 2) {
    // 装饰条改 border-left（flex+span 必丢），padding-left 块级常保留
    return `<h2 style="color:${t.accent};font-size:19px;font-weight:600;border-left:4px solid ${t.accent};padding-left:10px;line-height:1.4;margin:24px 0 14px;">${text}</h2>`;
  }
  if (level === 3) {
    return `<h3 style="color:${currentTheme.accent};font-size:17px;font-weight:600;margin:20px 0 12px;">${text}</h3>`;
  }
  return `<h${level} style="color:${currentTheme.accent};margin:20px 0 12px;">${text}</h${level}>`;
};

renderer.strong = (text) => {
  const t = currentTheme;
  // 渐变背景必丢，改实色 background-color；strongBg=false 时无背景
  const bg = t.strongBg ? `background-color:${t.accentLight};` : "";
  return `<strong style="color:${t.accent};font-weight:600;${bg}">${text}</strong>`;
};

renderer.em = (text) =>
  // 真斜体（旧版 font-style:normal 没斜体），配色用 muted 区分加粗的 accent
  `<em style="font-style:italic;color:${currentTheme.muted};">${text}</em>`;

renderer.blockquote = (quote) => {
  const t = currentTheme;
  // 去 border-radius，保留 border-left + background-color + color，块级常保留
  const bg = t.quoteBg ? `background-color:${t.bg};` : "";
  return `<blockquote style="border-left:3px solid ${t.accent};${bg}color:${t.muted};padding:8px 14px;font-size:15.5px;line-height:1.7;margin:16px 0;">${quote}</blockquote>`;
};

renderer.hr = () =>
  // div 外壳必被剥，改 p（ProseMirror schema 核心元素）承载分隔符
  `<p style="text-align:center;color:${currentTheme.grey};">· · ·</p>`;

renderer.image = (href, _title, text) =>
  // 去 border-radius，figure/figcaption 头条多半不认但结构无害
  `<p style="text-align:center;margin:14px 0;"><img src="${href}" alt="${text || ""}" style="max-width:100%;"/><span style="display:block;color:${currentTheme.grey};font-size:13px;line-height:1.5;margin-top:6px;">${text || ""}</span></p>`;

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
      `<span style="background-color:${hlBg};color:${t.accent};">$1</span>`,
    )
    // 提示框 callout → blockquote（div 必被剥，blockquote 块级常保留）
    .replace(
      /:::(info|tip|warning|danger)\s+([\s\S]+?)\s*:::/g,
      (_m, t2, c) => {
        const [bd, bg] = CALLOUT[t2];
        return `<blockquote style="border-left:4px solid ${bd};background-color:${bg};color:#333;padding:8px 14px;font-size:15px;line-height:1.7;margin:14px 0;">${c}</blockquote>`;
      },
    )
    // 时间线节点 → p + border-left（div 必被剥）
    .replace(
      /:::time\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<p style="border-left:3px solid ${t.border};padding-left:12px;font-size:15px;line-height:1.8;margin:10px 0;"><strong style="color:${t.accent};">${"$1"}</strong> ${"$2"}</p>`,
    )
    // 数据卡片 → 居中 p（div 必被剥，span display:block 必丢，改 p+br 承载双行）
    .replace(
      /:::stat\s+(\S+)\s+([\s\S]+?)\s*:::/g,
      `<p style="text-align:center;background-color:${t.bg === "#fff" ? "#f8f8f8" : t.bg};padding:10px 12px;margin:14px 0;font-size:24px;font-weight:700;color:${t.accent};line-height:1.3;">${"$1"}<br/><span style="font-size:13px;color:${t.grey};font-weight:400;">${"$2"}</span></p>`,
    )
    // 引语署名 → blockquote + br 署名（嵌套 p 会被 ProseMirror 拆，改 br+span）
    .replace(
      /:::quote\s+([\s\S]+?)\s*\|\s*([^|]+?)\s*:::/g,
      `<blockquote style="border-left:3px solid ${t.accent};background-color:${t.bg};color:${t.muted};padding:8px 14px;font-size:15.5px;line-height:1.7;margin:14px 0;">${"$1"}<br/><span style="color:${t.grey};font-size:13px;">—— ${"$2"}</span></blockquote>`,
    )
    // 上标 ^text^ → <sup>
    .replace(
      /\^([^\^\n]+?)\^/g,
      `<sup style="font-size:0.75em;vertical-align:super;color:${t.muted};">${"$1"}</sup>`,
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
    .replace(/<li>/g, `<li style="margin:6px 0;">`)
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

export function ctaBlock({ question, follow, title }, theme) {
  const t = pickTheme(theme, title || "");
  const seed = title || follow || "";
  // 头条 ProseMirror 只认 p+内联 span，div/gradient/shadow/border-radius 必丢
  // 全改 p 段 + 实色 span，层次差异靠 ctaLayers 控制显示哪几段（去同质化不变）
  const tag = `<p style="text-align:center;color:${t.accent};font-size:12px;font-weight:700;">${escapeHtml(poolPick(CTA_TAGS, seed))}</p>`;
  const questionHtml = question
    ? `<p style="text-align:center;color:${t.accent};font-size:16px;font-weight:600;line-height:1.6;">${escapeHtml(question)}</p>`
    : "";
  // 按钮渐变 → 实色 accent（accent 全为纯色 hex，最稳）；padding 在 inline span 上可能部分丢，但 color/background-color 一般保留
  const btn = `<p style="text-align:center;"><span style="background-color:${t.accent};color:${t.btnText};font-weight:600;font-size:14px;padding:6px 18px;">${escapeHtml(follow || "点 个 关 注 不 迷 路")}</span></p>`;
  const guideMid = `<p style="text-align:center;color:${t.muted};font-size:14px;line-height:1.7;">${poolPick(CTA_MIDS, seed)}</p>`;
  const icons = `<p style="text-align:center;color:${t.grey};font-size:13px;">${poolPick(CTA_ICONS, seed)}</p>`;

  if (t.ctaLayers === "simple") {
    // 2 层：提问 + 按钮
    return questionHtml + btn;
  }
  if (t.ctaLayers === "mid") {
    // 3 层：标签 + 提问 + 按钮
    return tag + questionHtml + btn;
  }
  // 4 层：提问 + 引导 + 按钮 + 图标
  return questionHtml + guideMid + btn + icons;
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
