// build_payloads_20260619.js — 把 markdown 转成微信 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260619';

const SECTION_STYLE = 'padding: 0 16px; font-size: 15px; color: #3f3f3f; letter-spacing: 0.5px; line-height: 1.75;';
const P_STYLE = 'margin-bottom: 1em;';
const IMG_HTML = (slot) =>
  `<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${slot}}}" style="max-width: 100%;" /></p>`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 解析 markdown：剥离标题区和备选标题，提取正文，按 --- 拆分节
function parseArticle(md) {
  const lines = md.split(/\r?\n/);
  let title = '';
  const bodyLines = [];
  let inTitles = false;
  let inBody = false;
  for (const line of lines) {
    if (line.startsWith('# ')) { title = line.replace(/^#\s+/, '').trim(); continue; }
    if (/^##\s+备选标题/.test(line)) { inTitles = true; continue; }
    if (/^##\s+正文\s*$/.test(line)) { inTitles = false; inBody = true; continue; }
    if (line.startsWith('## ')) { inTitles = false; continue; }
    if (!inTitles && inBody) bodyLines.push(line);
  }
  // 按 --- 拆段
  const sections = [];
  let current = [];
  for (const line of bodyLines) {
    if (/^-{3,}$/.test(line.trim())) {
      if (current.length) sections.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) sections.push(current);
  // 每个 section 再按空行/换行拆段
  return {
    title,
    sections: sections.map(lines => {
      return lines.map(l => l.trim()).filter(Boolean);
    }).filter(s => s.length),
  };
}

// 把每段（一行或多行）转成 <p>
function toParagraphs(lines) {
  return lines.map(l => `<p style="${P_STYLE}">${escapeHtml(l)}</p>`).join('');
}

function buildPayload(dirName, digest) {
  const mdPath = path.join(BATCH_DIR, dirName, '文章.md');
  const md = fs.readFileSync(mdPath, 'utf8');
  const { title, sections } = parseArticle(md);

  // 把 sections 分成 4 块：开头 → IMG0 → 中1 → IMG1 → 中2 → IMG2 → 结尾
  // 简单分配：尽量均匀切分
  const totalSections = sections.length;
  // 决定每个块包含多少 section（至少 1）
  // 块数 = 4，图片 = 3 张，按比例切
  const chunkCount = 4;
  const perChunk = Math.max(1, Math.floor(totalSections / chunkCount));
  const chunks = [];
  let idx = 0;
  for (let c = 0; c < chunkCount; c++) {
    const take = (c === chunkCount - 1)
      ? totalSections - idx
      : perChunk;
    const slice = sections.slice(idx, idx + take);
    if (slice.length) chunks.push(slice.flat());
    idx += take;
  }

  // 组装 HTML
  let html = '';
  chunks.forEach((lines, i) => {
    html += `<section style="${SECTION_STYLE}">${toParagraphs(lines)}</section>`;
    if (i < 3) html += IMG_HTML(i); // IMG0/IMG1/IMG2 三张图
  });

  const payload = {
    articles: [{
      title,
      author: '',
      digest,
      content: html,
      content_source_url: '',
      thumb_media_id: '{{THUMB}}',
      need_open_comment: 1,
      only_fans_can_comment: 0,
    }],
  };

  const outPath = path.join(BATCH_DIR, dirName, 'payload_template.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`✅ ${dirName} → payload_template.json (${html.length} 字符 HTML)`);
}

buildPayload('01-结婚七年我们开始说谢谢',
  '桌上放着一碗面，还热着。我老婆问好吃吗，我说好吃，谢谢。她愣了一下。结婚七年，我们之间从来没说过谢谢。');

buildPayload('02-公司让我培训接替我的新人',
  'HR把新人带到我面前，说要让我把所有经验传给他。我教了三个月，小张越认真我越知道这是真的。最后一天他请我吃饭。');

buildPayload('03-我开始允许自己一整天什么都不做',
  '上周六我请了一天假。没出门没约人没刷手机，就是待着。我今年33，从大学开始就停不下来。直到那天我才看清楚自己。');

buildPayload('04-离婚冷静期第29天他做了顿饭',
  '冷静期第29天晚上十一点，门铃响了。他拎着两个袋子，里面是菜和牛腩。他在厨房忙了一个小时，切胡萝卜切得很慢，像第一次做饭。');
