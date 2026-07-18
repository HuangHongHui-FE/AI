// build_20260611.js — 为今日4篇文章生成排版HTML + payload_template.json
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260611';

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

function buildBottomSection(keyword) {
  const lines = {
    '退休': '如果这篇文章让你想到了家里那个"多余"的人，点个「在看」，转给TA看看。',
    '架子鼓': '如果你也有一个想了很久但不好意思开始的念头，点个「在看」，给自己一个信号。',
    '女儿': '如果你家里也有一个嘴硬心软的人，点个「在看」，有些温柔不用说出口。',
    '戒掉': '如果你也在戒什么东西——不是烟酒那种——在评论区告诉我，我想听听你的故事。',
  };
  const line = lines[keyword] || '如果这篇文章触动了你，点个「在看」让我知道。';

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
    dir: '01-老公退休后天天在家',
    title: '老公退休后天天在家，结婚三十年我第一次觉得他"多余"',
    digest: '退休第一天他把书房占了，我的瑜伽垫没地方放了。结婚三十年相安无事，退休三个月差点离了。',
    keyword: '退休',
    imageAfter: [
      '我的瑜伽垫被卷起来塞进了储藏室',
      '我们各自端着饭盒，一个在客厅一个在卧室',
      '锅里炖着排骨汤。我调小了火',
    ]
  },
  {
    dir: '05-47岁学架子鼓邻居敲门哭了',
    title: '47岁那年我开始学架子鼓，邻居敲门的那天我哭了——不是因为委屈',
    digest: '报架子鼓班的时候老师说"给你孙子报的吗"。人到中年才学一样没用的东西，是我做过最有用的事。',
    keyword: '架子鼓',
    imageAfter: [
      '进教室的时候，前台看了看我说',
      '每天下班回家敲半小时',
      '打完那一刻我对着空气笑了半天',
    ]
  },
  {
    dir: '06-女儿出嫁老公厕所里哭',
    title: '女儿出嫁那天老公一滴泪没掉，回到家他把自己关在厕所里半小时',
    digest: '婚礼上他笑着把女儿交出去。结婚二十五年没见他哭过，那天厕所的门一直关着。',
    keyword: '女儿',
    imageAfter: [
      '女儿穿着婚纱从花廊那头走过来的时候',
      '厕所门关着。灯亮着。',
      '他吃了两颗，说："挺甜的。"',
    ]
  },
  {
    dir: '09-50岁戒掉攀比解释等别人开口',
    title: '50岁那年我戒掉了三样东西：攀比、解释、等别人先开口',
    digest: '不解释、不讨好、不等待——这是我50岁送自己的礼物。以前活给别人看，以后想活给自己看。',
    keyword: '戒掉',
    imageAfter: [
      '我给自己列了一张清单',
      '后来我退了同学群。不是生气',
      '想说的说了。不想解释的懒得解释',
    ]
  },
];

function mdToParagraphs(md) {
  const lines = md.split('\n');
  const paragraphs = [];
  let current = [];

  // 找正文开始（第一个 # 之后）
  let inBody = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBody) {
      if (line.trim().startsWith('## 文章 ') || line.trim().startsWith('### 正文')) {
        inBody = true;
        continue;
      }
      continue;
    }
    // 遇到备选标题区域停止
    if (line.trim().startsWith('### 备选标题') || line.trim().startsWith('---')) break;

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

    // 分隔线
    if (/^[\*\-—]+$/.test(text.trim())) {
      html += '<p style="text-align:center;color:#cccccc;font-size:14px;letter-spacing:4px;margin:1.2em 0;">&middot; &middot; &middot;</p>\n';
      continue;
    }

    // 加粗标记转 accent color
    text = text.replace(/\*\*(.+?)\*\*/g, `<span style="color:${COLORS.accent};font-weight:bold;">$1</span>`);

    html += `<p style="margin-bottom:1em;">${text}</p>\n`;

    // 检查是否需要在段落后插入图片
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

// 构建每篇文章
articles.forEach(art => {
  const mdPath = path.join(baseDir, art.dir, `文章${art.dir.substring(0,2)}-*.md`);
  // 用 glob 找文件
  const dirPath = path.join(baseDir, art.dir);
  const files = fs.readdirSync(dirPath).filter(f => f.startsWith('文章') && f.endsWith('.md'));
  if (files.length === 0) {
    console.log(`SKIP ${art.dir}: no 文章.md found`);
    return;
  }
  const mdPath2 = path.join(dirPath, files[0]);

  const md = fs.readFileSync(mdPath2, 'utf8');
  const paragraphs = mdToParagraphs(md);
  const bodyHTML = buildBodyHTML(paragraphs, art.imageAfter);
  const bottomHTML = buildBottomSection(art.keyword);

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

  const outPath = path.join(dirPath, 'payload_template.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ ${art.dir}/payload_template.json`);
});

console.log('\n全部 payload 生成完成（Skill 04 排版规范）');