// build_payloads_20260618.js — 20260618 markdown → payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260618';
const SECTION_STYLE = 'padding: 0 16px; font-size: 15px; color: #3f3f3f; letter-spacing: 0.5px; line-height: 1.75;';
const P_STYLE = 'margin-bottom: 1em;';
const IMG_HTML = (slot) =>
  `<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${slot}}}" style="max-width: 100%;" /></p>`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseArticle(md) {
  const lines = md.split(/\r?\n/);
  let title = '';
  const bodyLines = [];
  let inTitles = false, inBody = false;
  for (const line of lines) {
    if (line.startsWith('# ')) { title = line.replace(/^#\s+/, '').trim(); continue; }
    if (/^##\s+备选标题/.test(line)) { inTitles = true; continue; }
    if (/^##\s+正文\s*$/.test(line)) { inTitles = false; inBody = true; continue; }
    if (line.startsWith('## ')) { inTitles = false; continue; }
    if (!inTitles && inBody) bodyLines.push(line);
  }
  const sections = [];
  let current = [];
  for (const line of bodyLines) {
    if (/^-{3,}$/.test(line.trim())) {
      if (current.length) sections.push(current);
      current = [];
    } else current.push(line);
  }
  if (current.length) sections.push(current);
  return {
    title,
    sections: sections.map(lines => lines.map(l => l.trim()).filter(Boolean)).filter(s => s.length),
  };
}

function toParagraphs(lines) {
  return lines.map(l => `<p style="${P_STYLE}">${escapeHtml(l)}</p>`).join('');
}

function buildPayload(dirName, digest) {
  const mdPath = path.join(BATCH_DIR, dirName, '文章.md');
  const md = fs.readFileSync(mdPath, 'utf8');
  const { title, sections } = parseArticle(md);
  const totalSections = sections.length;
  const chunkCount = 4;
  const perChunk = Math.max(1, Math.floor(totalSections / chunkCount));
  const chunks = [];
  let idx = 0;
  for (let c = 0; c < chunkCount; c++) {
    const take = (c === chunkCount - 1) ? totalSections - idx : perChunk;
    const slice = sections.slice(idx, idx + take);
    if (slice.length) chunks.push(slice.flat());
    idx += take;
  }
  let html = '';
  chunks.forEach((lines, i) => {
    html += `<section style="${SECTION_STYLE}">${toParagraphs(lines)}</section>`;
    if (i < 3) html += IMG_HTML(i);
  });
  const payload = {
    articles: [{
      title, author: '', digest, content: html,
      content_source_url: '', thumb_media_id: '{{THUMB}}',
      need_open_comment: 1, only_fans_can_comment: 0,
    }],
  };
  fs.writeFileSync(path.join(BATCH_DIR, dirName, 'payload_template.json'),
    JSON.stringify(payload, null, 2));
  console.log(`✅ ${dirName} → ${html.length} 字符 HTML`);
}

buildPayload('01-结婚那天我妈塞给我一张银行卡',
  '结婚那天我妈来房间把门关上，从包里掏出一张建行卡塞给我。她说拿着，应急用。我说妈我有钱。她说拿着。');

buildPayload('02-面试官比我小八岁',
  '那天面试，HR把我带进会议室。里面坐着个戴副眼镜的白衬衫。他抬头问我，李哥是吧，我27。那一刻我没接话。');

buildPayload('03-我决定不再发新年计划了',
  '去年元旦，我没发任何东西。不发朋友圈，不写计划本。我老婆问我今年怎么这么佛。我说累了。她说真的？我说真的。');

buildPayload('04-和老公吵了三天我突然笑场了',
  '跟老公吵了三天。起因特别小。谁洗碗。我说我做的饭你洗，他说今天我加班。那三天我们没说话，碗留在水池里。');
