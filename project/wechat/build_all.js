// build_all.js — 一步完成：Markdown→HTML→插入图片占位符→输出合法JSON
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';

const articles = [
  {
    dir: '02-婆婆搬来第三个月变成讨厌的儿媳',
    title: '婆婆搬来住的第三个月，我发现自己变成了当年最讨厌的那种儿媳妇',
    digest: '当我在厨房数落婆婆不用洗洁精时，突然愣住了——二十年前，我妈也对我说过一模一样的话。',
    // 在哪些段落后插入图片（段落结束文本标记）
    imageAfter: [
      '现在，我成了那个站在厨房里数落别人的人。',
      '这种感觉一旦露头，就很难收回去。',
      '她给我留了饭菜，用盘子扣着保温。',
      '其实她不是不讲理。只是需要有人好好地跟她说。',
    ]
  },
  {
    dir: '04-45岁想一个人住一段时间',
    title: '45岁那年我跟老公说"我想一个人住一段时间"，他居然答应了',
    digest: '结婚二十年，我第一次提出要分居。不是为了离开，是为了更好地回来。',
    imageAfter: [
      '就是什么呢？我当时也说不太清楚。',
      '就做我自己。',
      '安静得我有点慌。',
      '二十年了，他第一次用商量的语气跟我说话。',
    ]
  },
  {
    dir: '07-体制内22年辞职开滴滴',
    title: '在体制内干了二十二年，我决定辞职去开滴滴',
    digest: '四十八岁那年，我从科长变成了网约车司机。不是鼓励辞职，只是说说活成自己想要的样子有多难。',
    imageAfter: [
      '那封信在我抽屉里已经放了半年了。',
      '我试过对着镜子练那种笑，练不出来。',
      '答案让我后背发凉。',
      '我坐车里笑了好几分钟。',
    ]
  },
  {
    dir: '09-46岁学会拒绝第一个拒绝我妈',
    title: '46岁那年我学会了拒绝，第一个拒绝的人是我妈',
    digest: '说"不"的那一刻手在发抖。但说完之后，天没有塌。',
    imageAfter: [
      '心跳得像做了亏心事。',
      '站在家门口不敢进去。',
      '比你听过的任何一句\'我爱你\'都重。',
      '我们之间出现了一个以前没有的东西：余地。',
    ]
  },
];

function mdToHTML(md) {
  const lines = md.split('\n');
  const paragraphs = [];
  let current = [];
  let inBody = false;
  let skipMode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip title and metadata
    if (!inBody) {
      if (line.startsWith('# ') || line.startsWith('**备选标题**') || line.match(/^\d+\.\s+.+备选/)) {
        skipMode = true;
        continue;
      }
      if (skipMode && line.trim() === '---') {
        skipMode = false;
        inBody = true;
        continue;
      }
      if (skipMode) continue;
      if (line.trim() === '---') { inBody = true; continue; }
    }

    if (line.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current.join(''));
        current = [];
      }
      continue;
    }

    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current.join(''));

  return paragraphs;
}

function buildHTML(paragraphs, imageAfter) {
  let html = '';
  let imgIdx = 0;

  for (const para of paragraphs) {
    let text = para.trim();
    if (!text) continue;

    // Handle bold markers
    text = text.replace(/\*\*(.+?)\*\*/g, '<span class="accent">$1</span>');

    // Handle separator lines
    if (/^[\*\-—]+$/.test(text.trim())) {
      html += '<p class="separator">· · ·</p>\n';
      continue;
    }

    // Check if this is a section title (## prefix)
    if (text.startsWith('## ')) {
      html += `<p class="section-title">${text.replace(/^## /, '')}</p>\n`;
      continue;
    }

    html += `<p>${text}</p>\n`;

    // Check if we should insert an image after this paragraph
    for (const marker of imageAfter) {
      if (text.includes(marker)) {
        html += `<p><img src="{{IMG${imgIdx}}}" style="width:100%;display:block;margin:1em 0;" /></p>\n`;
        imgIdx++;
        break;
      }
    }
  }

  return html;
}

// Build payload for each article
articles.forEach(art => {
  const mdPath = path.join(baseDir, art.dir, '文章.md');
  if (!fs.existsSync(mdPath)) {
    console.log(`SKIP ${art.dir}: no 文章.md`);
    return;
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const paragraphs = mdToHTML(md);
  const bodyHTML = buildHTML(paragraphs, art.imageAfter);

  const fullHTML =
`<style>
  .article-body { font-size: 15px; line-height: 1.75; letter-spacing: 0.5px; color: #3e3e3e; padding: 0 14px; text-align: justify; word-break: break-all; }
  .article-body p { margin-bottom: 1em; }
  .section-title { font-size: 18px; font-weight: bold; color: #333333; margin: 1.5em 0 0.5em 0; }
  .accent { color: #FF6B35; font-weight: bold; }
  .separator { text-align: center; color: #b0b0b0; font-size: 14px; margin: 1em 0; letter-spacing: 4px; }
</style>
<section class="article-body">
${bodyHTML}</section>`;

  const payload = {
    articles: [{
      title: art.title,
      author: '',
      digest: art.digest.substring(0, 64),
      content: fullHTML,
      content_source_url: '',
      thumb_media_id: '{{THUMB}}',
      need_open_comment: 1,
      only_fans_can_comment: 0
    }]
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  // Verify it's valid JSON
  try {
    JSON.parse(jsonStr);
  } catch(e) {
    console.log(`❌ ${art.dir}: JSON invalid - ${e.message}`);
    return;
  }

  const outPath = path.join(baseDir, art.dir, 'payload_template.json');
  fs.writeFileSync(outPath, jsonStr, 'utf8');
  console.log(`✅ ${art.dir}/payload_template.json`);
});

console.log('\n全部 payload_template.json 已重新生成（合法JSON）');