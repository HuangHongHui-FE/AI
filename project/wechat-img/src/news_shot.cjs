// 渲染新闻正文为手机新闻截图配图
// 用法: node src/news_shot.cjs <标题> <正文文件> <输出.jpg> [来源] [副题]
const sharp = require('sharp');
const fs = require('fs');

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 按每行字数折行
function wrap(text, maxLen) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(cur); cur=''; continue; }
    cur += ch;
    if (cur.length >= maxLen) { lines.push(cur); cur=''; }
  }
  if (cur) lines.push(cur);
  return lines;
}

(async () => {
  const [,, title, bodyFile, out, source, sub] = process.argv;
  if (!title || !bodyFile || !out) { console.error('参数不足'); process.exit(1); }
  let body = fs.readFileSync(bodyFile, 'utf8').replace(/\s+/g,'').slice(0, 780); // 去空白防断行
  const src = source || '新闻来源';

  const W = 750, PAD = 44;
  const titleLines = wrap(title, 15);
  const bodyLines = wrap(body, 26);
  const lineH = 46;
  // 顶部标题区 + 来源 + 分割线 + 正文
  const H = 120 + titleLines.length*58 + 40 + bodyLines.length*lineH + 110;
  const titleY = 130;

  const bodySvg = bodyLines.map((ln, i) =>
    `<text x="${PAD}" y="${titleY+titleLines.length*58+80+i*lineH}" font-family="PingFang SC" font-size="25" fill="#2a2a2a">${esc(ln)}</text>`
  ).join('\n');
  const titleSvg = titleLines.map((ln, i) =>
    `<text x="${W/2}" y="${titleY+i*58}" font-family="PingFang SC" font-size="34" font-weight="bold" fill="#111" text-anchor="middle">${esc(ln)}</text>`
  ).join('\n');

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f7f7f7"/>
  <rect x="0" y="0" width="${W}" height="${H-0}" fill="#fff"/>
  ${titleSvg}
  <text x="${W/2}" y="${titleY+titleLines.length*58+20}" font-family="PingFang SC" font-size="20" fill="#c0392b" text-anchor="middle">${esc(src)} · ${sub||'新闻截图'}</text>
  <line x1="${PAD}" y1="${titleY+titleLines.length*58+50}" x2="${W-PAD}" y2="${titleY+titleLines.length*58+50}" stroke="#e8e8e8" stroke-width="2"/>
  ${bodySvg}
  <rect x="${W/2-60}" y="${H-85}" width="120" height="46" rx="23" fill="#1a73e8"/>
  <text x="${W/2}" y="${H-53}" font-family="PingFang SC" font-size="20" fill="#fff" text-anchor="middle">查看全文</text>
</svg>`;

  await sharp(Buffer.from(svg)).jpeg({quality:88}).toFile(out);
  console.log('已生成新闻截图:', out, `${W}x${H}`);
})();
