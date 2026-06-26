import { marked } from 'marked';

const COLOR = '#FF6B35';
const COLOR_LIGHT = '#FFE8D9';
const COLOR_BG = '#FFF8F2';
const COLOR_BORDER = '#FFD9BC';
const COLOR_TEXT_DARK = '#1a1a1a';
const COLOR_TEXT_MUTED = '#7a4a2a';
const COLOR_TEXT_GREY = '#999';

const BASE_FONT = `-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif`;

const renderer = new marked.Renderer();

renderer.paragraph = (text) =>
  `<p style="margin:0 0 20px;font-family:${BASE_FONT};font-size:16px;line-height:1.85;color:#3f3f3f;letter-spacing:0.04em;">${text}</p>`;

renderer.heading = (text, level) => {
  if (level === 2) {
    return `<h2 style="font-family:${BASE_FONT};font-size:19px;font-weight:600;color:${COLOR_TEXT_DARK};margin:36px 0 18px;padding:0;display:flex;align-items:center;line-height:1.4;"><span style="display:inline-block;width:4px;height:20px;background:linear-gradient(180deg,${COLOR} 0%,#FF9A6B 100%);border-radius:2px;margin-right:10px;flex-shrink:0;"></span>${text}</h2>`;
  }
  if (level === 3) {
    return `<h3 style="font-family:${BASE_FONT};font-size:17px;font-weight:600;color:${COLOR_TEXT_DARK};margin:28px 0 14px;padding:0;">${text}</h3>`;
  }
  return `<h${level} style="font-family:${BASE_FONT};margin:24px 0 14px;color:${COLOR_TEXT_DARK};">${text}</h${level}>`;
};

renderer.strong = (text) =>
  `<strong style="color:${COLOR};font-weight:600;background:linear-gradient(180deg,transparent 60%,${COLOR_LIGHT} 60%);padding:0 2px;">${text}</strong>`;

renderer.em = (text) =>
  `<em style="font-style:normal;color:${COLOR_TEXT_GREY};font-size:0.95em;">${text}</em>`;

renderer.blockquote = (quote) => {
  const inner = quote.replace(/<p /g, '<p ');
  return `<blockquote style="margin:24px 0;padding:14px 18px;background:${COLOR_BG};border-left:3px solid ${COLOR};border-radius:0 4px 4px 0;color:${COLOR_TEXT_MUTED};font-family:${BASE_FONT};font-size:15.5px;line-height:1.7;">${inner}</blockquote>`;
};

renderer.hr = () =>
  `<div style="text-align:center;color:#ccc;letter-spacing:8px;margin:32px 0;font-size:14px;">· · ·</div>`;

renderer.image = (href, _title, text) =>
  `<figure style="margin:18px 0;text-align:center;"><img src="${href}" alt="${text || ''}" style="max-width:100%;border-radius:6px;display:block;margin:0 auto;"/><figcaption style="margin-top:8px;font-size:13px;color:${COLOR_TEXT_GREY};line-height:1.5;">${text || ''}</figcaption></figure>`;

marked.setOptions({ breaks: true, gfm: true, renderer });

export function markdownToHtml(markdown) {
  return marked.parse(markdown);
}

export function fullPageHtml(title, bodyHtml, ctaHtml) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="background:#f5f5f5;margin:0;padding:24px 0;"><div style="background:#fff;max-width:640px;margin:0 auto;padding:24px 20px 32px;border-radius:4px;">${bodyHtml}${ctaHtml || ''}</div></body></html>`;
}

export function ctaBlock({ question, follow }) {
  const parts = [`<div style="margin:36px 0 0;padding:22px 20px;background:linear-gradient(135deg,#FFF4EC 0%,#FFEEE0 100%);border-radius:10px;border:1px solid ${COLOR_BORDER};text-align:center;font-family:${BASE_FONT};">`];

  if (question) {
    parts.push(`<span style="display:inline-block;font-size:12px;color:${COLOR};letter-spacing:3px;margin-bottom:10px;font-weight:700;padding:3px 10px;background:#fff;border-radius:10px;">留 言 互 动</span>`);
    parts.push(`<p style="font-size:16px;color:${COLOR_TEXT_DARK};font-weight:600;margin:0 0 8px;line-height:1.6;">${escapeHtml(question)}</p>`);
    parts.push(`<p style="font-size:14px;color:${COLOR_TEXT_MUTED};margin:0 0 14px;line-height:1.7;">评论区聊聊，是哪句话戳穿了你？<br/>点赞 + 在看，让更多中年人看见。</p>`);
  }

  parts.push(`<div style="height:1px;background:${COLOR_BORDER};margin:14px auto;width:60%;"></div>`);
  parts.push(`<p style="font-size:13px;color:${COLOR_TEXT_GREY};margin:0 0 10px;letter-spacing:1px;">👇 长按关注，每天一篇中年人的心里话</p>`);
  parts.push(`<span style="display:inline-block;padding:9px 24px;background:linear-gradient(135deg,${COLOR} 0%,#FF9A6B 100%);color:#fff;font-weight:600;font-size:14px;border-radius:20px;letter-spacing:2px;box-shadow:0 3px 8px rgba(255,107,53,0.3);">${escapeHtml(follow || '点 个 关 注 不 迷 路')}</span>`);
  parts.push(`<div style="margin-top:12px;font-size:13px;color:${COLOR_TEXT_GREY};letter-spacing:4px;">❤ 点赞 · 在看 · 转发</div>`);
  parts.push(`</div>`);
  return parts.join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
