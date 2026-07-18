import { marked } from 'marked';

const BASE_FONT = `-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif`;

// 三套主题：minimal 极简黑白 / warm 暖色降饱和 / cool 冷色藏青
// 配色 + CTA 结构都不同形，按篇轮换去同质化（见 wechat-daily.md「排版主题轮换」）
const THEMES = {
  minimal: {
    accent: '#1a1a1a', btnBg: '#FF6B35', btnText: '#fff',
    text: '#333', muted: '#777', grey: '#999', border: '#e0e0e0', bg: '#fff',
    h2Bar: false, strongBg: false, quoteBg: false,
    ctaLayers: 'simple',
  },
  warm: {
    accent: '#3a6b5a', accentLight: '#D6E4DC', btnBg: 'linear-gradient(135deg,#3a6b5a 0%,#5a8a78 100%)', btnText: '#fff',
    text: '#3f3f3f', muted: '#4a5a52', grey: '#999', border: '#C9D9CF', bg: '#F2F6F3',
    h2Bar: true, strongBg: true, quoteBg: true,
    ctaLayers: 'full',
  },
  cool: {
    accent: '#2C4A6B', accentLight: '#DCE6F0', btnBg: 'linear-gradient(135deg,#2C4A6B 0%,#4A6B8C 100%)', btnText: '#fff',
    text: '#3f3f3f', muted: '#3a5a7a', grey: '#999', border: '#C9D6E5', bg: '#EEF2F7',
    h2Bar: true, strongBg: true, quoteBg: true,
    ctaLayers: 'mid',
  },
};

// 模块级当前主题（marked renderer 单例，靠它取主题）
let currentTheme = THEMES.minimal;

// 选主题：显式指定优先；否则按标题 hash 确定性选（同篇可重现、不同篇分布开）
function pickTheme(name, title) {
  if (name && THEMES[name]) return THEMES[name];
  const keys = Object.keys(THEMES);
  let h = 0;
  for (const c of (title || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return THEMES[keys[h % keys.length]];
}

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
  const bg = t.strongBg ? `background:linear-gradient(180deg,transparent 60%,${t.accentLight} 60%);` : '';
  return `<strong style="color:${t.accent};font-weight:600;${bg}padding:0 2px;">${text}</strong>`;
};

renderer.em = (text) =>
  `<em style="font-style:normal;color:${currentTheme.grey};font-size:0.95em;">${text}</em>`;

renderer.blockquote = (quote) => {
  const t = currentTheme;
  const inner = quote.replace(/<p /g, '<p ');
  const bg = t.quoteBg ? `background:${t.bg};` : 'background:transparent;';
  return `<blockquote style="margin:24px 0;padding:10px 18px;${bg}border-left:3px solid ${t.accent};border-radius:0 4px 4px 0;color:${t.muted};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">${inner}</blockquote>`;
};

renderer.hr = () =>
  `<div style="text-align:center;color:${currentTheme.grey};letter-spacing:8px;margin:32px 0;font-size:14px;">· · ·</div>`;

renderer.image = (href, _title, text) =>
  `<figure style="margin:18px 0;text-align:center;"><img src="${href}" alt="${text || ''}" style="max-width:100%;border-radius:6px;display:block;margin:0 auto;"/><figcaption style="margin-top:8px;font-size:13px;color:${currentTheme.grey};line-height:1.5;">${text || ''}</figcaption></figure>`;

marked.setOptions({ breaks: true, gfm: true, renderer });

export function markdownToHtml(markdown, theme) {
  currentTheme = pickTheme(theme, '');
  return marked.parse(markdown);
}

export function fullPageHtml(title, bodyHtml, ctaHtml, theme) {
  const t = pickTheme(theme, title);
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="background:#f5f5f5;margin:0;padding:24px 0;"><div style="background:${t.bg};max-width:640px;margin:0 auto;padding:24px 20px 32px;border-radius:4px;">${bodyHtml}${ctaHtml || ''}</div></body></html>`;
}

export function ctaBlock({ question, follow }, theme) {
  const t = pickTheme(theme, '');
  const parts = [`<div style="margin:36px 0 0;padding:22px 20px;background:${t.bg};border-radius:10px;border:1px solid ${t.border};text-align:center;font-family:${BASE_FONT};`];
  const questionHtml = question
    ? `<p style="font-size:16px;color:${t.accent};font-weight:600;margin:0 0 8px;line-height:1.6;">${escapeHtml(question)}</p>`
    : '';
  const btn = `<span style="display:inline-block;padding:9px 24px;background:${t.btnBg};color:${t.btnText};font-weight:600;font-size:14px;border-radius:20px;letter-spacing:2px;box-shadow:0 3px 8px rgba(0,0,0,0.12);">${escapeHtml(follow || '点 个 关 注 不 迷 路')}</span>`;
  const divider = `<div style="height:1px;background:${t.border};margin:14px auto;width:60%;"></div>`;
  const guide = `<p style="font-size:13px;color:${t.grey};margin:0 0 10px;letter-spacing:1px;">👇 长按关注，每天一篇心里话</p>`;
  const icons = `<div style="margin-top:12px;font-size:13px;color:${t.grey};letter-spacing:4px;">❤ 点赞 · 在看 · 转发</div>`;
  const tag = `<span style="display:inline-block;font-size:12px;color:${t.accent};letter-spacing:3px;margin-bottom:10px;font-weight:700;padding:3px 10px;background:#fff;border-radius:10px;">留 言 互 动</span>`;
  const guideMid = `<p style="font-size:14px;color:${t.muted};margin:0 0 14px;line-height:1.7;">评论区聊聊，是哪句话戳穿了你？<br/>点赞 + 在看，让更多人看见。</p>`;

  if (t.ctaLayers === 'simple') {
    // minimal：2 层（提问 + 按钮），极简
    parts.push(questionHtml, btn);
  } else if (t.ctaLayers === 'mid') {
    // cool：3 层（标签 + 提问 + 按钮），中间
    parts.push(tag, questionHtml, btn);
  } else {
    // warm：4 层（提问 + 引导 + 分隔 + 按钮 + 图标），全留降饱和
    parts.push(questionHtml, guideMid, divider, btn, icons);
  }
  parts.push(`</div>`);
  return parts.join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
