// 章节产物生成：books/<slug>/chapters/NN.md → output/日期/NN-标题/{chapter.md,preview.html}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, num, date] = process.argv.slice(2);

if (!slug || !num) {
  console.error('用法: node src/build_output.js <slug> <章号> [日期 YYYY-MM-DD]');
  process.exit(1);
}

const day = date || new Date().toISOString().slice(0, 10);
const srcFile = path.join(ROOT, 'books', slug, 'chapters', `${num}.md`);
const raw = fs.readFileSync(srcFile, 'utf8').trim();
const lines = raw.split('\n');
const title = lines[0].replace(/^#\s*/, '').trim();
const body = lines.slice(1).join('\n').trim();
const words = body.replace(/\s/g, '').length;

const dirName = `${String(num).padStart(2, '0')}-${title.replace(/^第\d+章\s*/, '')}`;
const outDir = path.join(ROOT, 'output', day, dirName);
fs.mkdirSync(outDir, { recursive: true });

// 干净发布稿：标题 + 正文，可直接复制进番茄后台（保留 `# ` 首行，publish.js 靠它取章节标题）
fs.writeFileSync(path.join(outDir, 'chapter.md'), `# ${title}\n\n${body}\n`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraphs = body
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => `<p>${esc(l)}</p>`)
  .join('');

const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'books', slug, 'settings.json'), 'utf8'));
const html = `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{margin:0 auto;max-width:640px;padding:24px 20px 60px;background:#faf8f5;color:#2b2b2b;font-family:-apple-system,'PingFang SC','Hiragino Sans GB',sans-serif;line-height:1.9;font-size:17px}
h1{font-size:21px;text-align:center;margin:12px 0 6px;line-height:1.5}
.meta{text-align:center;color:#999;font-size:13px;margin-bottom:28px}
p{margin:0 0 14px;text-indent:2em}</style></head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">${esc(settings.author)} · ${esc(settings.book)} · 约 ${words} 字</div>
${paragraphs}
</body></html>
`;
fs.writeFileSync(path.join(outDir, 'preview.html'), html);

console.log(`${dirName}  ${words} 字  → ${path.relative(ROOT, outDir)}`);
