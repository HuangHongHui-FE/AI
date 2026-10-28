// 一次性脚本：把纯文本文章推成公众号草稿（封面用蜘蛛原图，正文纯文字）
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadPermanentImage, createDraft } from '../src/wechat.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../output/2026-10-21/01-墙上大黑蜘蛛');
const TITLE = '墙上这只大黑蜘蛛，先别打——它专吃蟑螂，还怕你';
const DIGEST = '它有毒腺，但毒只够对付虫子。它进你家，是因为你家有它的饭。';

// 段落样式：字号偏大、行距放宽，适合中年读者在手机上读
const P_STYLE =
  'font-size:17px;line-height:1.9;color:#333;letter-spacing:.5px;margin:0 0 1.25em 0;text-align:justify;';

// 把纯文本按空行切成段落，转成带样式的微信正文 HTML
function toWechatHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p style="${P_STYLE}">${s.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

const raw = await readFile(join(DIR, 'article.md'), 'utf8');
const body = raw.replace(/^.*\n/, '').trim(); // 去掉首行标题
const html = toWechatHtml(body);

console.log(`正文段落数：${(html.match(/<p /g) || []).length}，纯文字约 ${body.replace(/\s/g, '').length} 字`);

if (process.argv.includes('--dry-run')) {
  console.log('--- HTML 预览（前 300 字）---');
  console.log(html.slice(0, 300));
  process.exit(0);
}

const { mediaId: thumbMediaId } = await uploadPermanentImage(join(DIR, '蜘蛛原图.png'));
console.log(`封面 media_id: ${thumbMediaId}`);

const draftId = await createDraft({ title: TITLE, digest: DIGEST, content: html, thumbMediaId });
console.log(`✓ 草稿已创建，media_id: ${draftId}`);
