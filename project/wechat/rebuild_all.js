// rebuild_all.js — 严格按 Skill 04 排版规范重建全部 payload
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';

// Skill 04 配色方案C — 情感故事风
const COLORS = {
  body: '#4a4a4a',
  title: '#be185d',
  accent: '#9d174d',
  quoteBg: '#fce7f3',
  caption: '#888888',
  muted: '#999999',
};

const TOP_GUIDE = `
<table style="width:100%;margin-bottom:20px;">
  <tr><td style="text-align:center;padding:16px 0;">
    <p style="font-size:13px;color:#999999;letter-spacing:2px;margin:0;">—— 点击上方蓝字关注，每天一起聊聊生活 ——</p>
  </td></tr>
</table>
`;

function buildBottomSection(title) {
  const engagementLines = {
    '婆婆': '如果这篇文章让你想起了家里的某个人，点个「在看」，转发给那个你想说"谢谢"的人。',
    '独居': '如果这篇文章让你重新思考了婚姻的样子，点个「在看」，也欢迎转发给你的另一半看看。',
    '滴滴': '如果你也在人生的某个路口犹豫过，点个「在看」，让我知道不是只有我一个人。',
    '拒绝': '如果你也有一个想说"不"却一直没敢说出口的人，点个「在看」，给自己一点勇气。',
  };

  let key = '婆婆';
  if (title.includes('独居') || title.includes('一个人住')) key = '独居';
  else if (title.includes('滴滴') || title.includes('体制')) key = '滴滴';
  else if (title.includes('拒绝')) key = '拒绝';

  const line = engagementLines[key];

  return `
<table style="width:100%;margin-top:32px;">
  <tr><td style="text-align:center;padding:24px 0;">
    <p style="font-size:14px;color:#9d174d;line-height:2;margin:0 0 16px 0;">${line}</p>
    <p style="font-size:13px;color:#999999;margin:0 0 24px 0;">👇 点击下方卡片关注，不错过每天的故事</p>
    <p style="font-size:12px;color:#bbbbbb;margin:0;">#情感故事 #中年生活 #婚姻经营</p>
  </td></tr>
</table>
`;
}

const articles = [
  {
    dir: '02-婆婆搬来第三个月变成讨厌的儿媳',
    title: '婆婆搬来住的第三个月，我发现自己变成了当年最讨厌的那种儿媳妇',
    digest: '当我在厨房数落婆婆不用洗洁精时，突然愣住了——二十年前，我妈也对我说过一模一样的话。',
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
    digest: '四十八岁那年，我从科长变成了网约车司机。人生后半场，我想按自己的导航走。',
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

function mdToParagraphs(md) {
  const lines = md.split('\n');
  const paragraphs = [];
  let current = [];
  let inBody = false;
  let skipMode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBody) {
      if (line.startsWith('# ') || line.startsWith('**备选标题**') || line.match(/^\d+\.\s+.+备选/)) {
        skipMode = true;
        continue;
      }
      if (skipMode && line.trim() === '---') { skipMode = false; inBody = true; continue; }
      if (skipMode) continue;
      if (line.trim() === '---') { inBody = true; continue; }
    }

    if (line.trim() === '') {
      if (current.length > 0) { paragraphs.push(current.join('')); current = []; }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current.join(''));
  return paragraphs;
}

function buildBodyHTML(paragraphs, imageAfter) {
  let html = '';
  let imgIdx = 0;

  for (const para of paragraphs) {
    let text = para.trim();
    if (!text) continue;

    if (/^[\*\-—]+$/.test(text.trim())) {
      html += '<p style="text-align:center;color:#cccccc;font-size:14px;letter-spacing:4px;margin:1.2em 0;">· · ·</p>\n';
      continue;
    }

    // Bold markers → accent color
    text = text.replace(/\*\*(.+?)\*\*/g, `<span style="color:${COLORS.accent};font-weight:bold;">$1</span>`);

    // Section title (## prefix)
    if (text.startsWith('## ')) {
      html += `<p style="font-size:17px;font-weight:bold;color:${COLORS.title};margin:1.5em 0 0.5em 0;">${text.replace(/^## /, '')}</p>\n`;
      continue;
    }

    html += `<p style="margin-bottom:1em;">${text}</p>\n`;

    // Insert image after matching paragraph
    for (const marker of imageAfter) {
      if (text.includes(marker)) {
        html += `<p style="text-align:center;margin:1.2em 0 0.2em 0;"><img src="{{IMG${imgIdx}}}" style="width:100%;display:block;border-radius:4px;" /></p>\n`;
        html += `<p style="font-size:13px;color:${COLORS.caption};text-align:center;margin:0.3em 0 1.2em 0;">△ 图片来源于网络</p>\n`;
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
  const paragraphs = mdToParagraphs(md);
  const bodyHTML = buildBodyHTML(paragraphs, art.imageAfter);
  const bottomHTML = buildBottomSection(art.title);

  const fullHTML =
`<style>
  .article-body { font-size: 15px; line-height: 1.75; letter-spacing: 0.5px; color: ${COLORS.body}; padding: 0 16px; text-align: justify; word-break: break-all; }
  .article-body p { margin: 0; }
</style>
${TOP_GUIDE}
<section class="article-body">
<h2 style="font-size:20px;font-weight:bold;color:#333333;text-align:center;margin:0 0 1.2em 0;line-height:1.4;">${art.title}</h2>
${bodyHTML}
</section>
${bottomHTML}`;

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
  try {
    JSON.parse(jsonStr);
  } catch(e) {
    console.log(`❌ ${art.dir}: JSON error - ${e.message}`);
    return;
  }

  const outPath = path.join(baseDir, art.dir, 'payload_template.json');
  fs.writeFileSync(outPath, jsonStr, 'utf8');
  console.log(`✅ ${art.dir}/payload_template.json`);
});

console.log('\n全部重建完成（Skill 04 排版规范）');