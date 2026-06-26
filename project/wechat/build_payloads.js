// build_payloads.js — 为四篇文章构建 payload_template.json
// 用法: node build_payloads.js

const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';

const articles = [
  {
    dir: '02-婆婆搬来第三个月变成讨厌的儿媳',
    title: '婆婆搬来住的第三个月，我发现自己变成了当年最讨厌的那种儿媳妇',
    digest: '当我在厨房数落婆婆不用洗洁精时，突然愣住了——二十年前，我妈也对我说过一模一样的话。',
    imgCount: 5 // cover + 4 inline
  },
  {
    dir: '04-45岁想一个人住一段时间',
    title: '45岁那年我跟老公说"我想一个人住一段时间"，他居然答应了',
    digest: '结婚二十年，我第一次提出要分居。不是为了离开，是为了更好地回来。',
    imgCount: 5
  },
  {
    dir: '07-体制内22年辞职开滴滴',
    title: '在体制内干了二十二年，我决定辞职去开滴滴',
    digest: '四十八岁那年，我从科长变成了网约车司机。不是鼓励辞职，只是说说活成自己想要的样子有多难。',
    imgCount: 5
  },
  {
    dir: '09-46岁学会拒绝第一个拒绝我妈',
    title: '46岁那年我学会了拒绝，第一个拒绝的人是我妈',
    digest: '说"不"的那一刻手在发抖。但说完之后，天没有塌。',
    imgCount: 5
  }
];

const typographyCSS = `
<style>
  .article-body {
    font-size: 15px;
    line-height: 1.75;
    letter-spacing: 0.5px;
    color: #3e3e3e;
    padding: 0 14px;
    text-align: justify;
    word-break: break-all;
  }
  .article-body p {
    margin-bottom: 1em;
  }
  .section-title {
    font-size: 18px;
    font-weight: bold;
    color: #333333;
    margin: 1.5em 0 0.5em 0;
  }
  .accent {
    color: #FF6B35;
    font-weight: bold;
  }
  .separator {
    text-align: center;
    color: #b0b0b0;
    font-size: 14px;
    margin: 1em 0;
    letter-spacing: 4px;
  }
  .footer-note {
    font-size: 14px;
    color: #999999;
    font-style: italic;
    text-align: center;
    margin-top: 2em;
  }
</style>
`;

// Convert markdown article to WeChat HTML
function mdToHTML(md) {
  const lines = md.split('\n');
  let html = '';
  let inBody = false;
  let paraLines = [];
  let imgIdx = 0;

  function flushPara() {
    if (paraLines.length === 0) return;
    let text = paraLines.join('').trim();
    if (!text) { paraLines = []; return; }

    // Handle bold markers **...**
    text = text.replace(/\*\*(.+?)\*\*/g, '<span class="accent">$1</span>');

    // Check if it's a section title (## prefix in markdown, or bold-only line)
    if (text.startsWith('## ')) {
      html += `<p class="section-title">${text.replace(/^## /, '')}</p>\n`;
    } else if (/^[\*\-—]+$/.test(text)) {
      // separator line
      html += `<p class="separator">· · ·</p>\n`;

      // Insert image after separator (every other separator)
      html += `<p><img src="{{IMG${imgIdx}}}" style="width:100%;display:block;margin:1em 0;" /></p>\n`;
      imgIdx++;
    } else {
      html += `<p>${text}</p>\n`;
    }
    paraLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip title line (first # )
    if (line.startsWith('# ') && !inBody) {
      inBody = true;
      continue;
    }

    // Skip 备选标题 section
    if (line.startsWith('**备选标题**') || line.match(/^\d+\.\s+.+（备选标题）/)) {
      // skip until we hit ---
      while (i < lines.length && !lines[i].startsWith('---')) i++;
      inBody = true;
      continue;
    }

    // Skip lines before the article body starts
    if (line.startsWith('**备选标题') || line.startsWith('1. ') && line.includes('备选标题')) {
      while (i < lines.length && lines[i].trim() !== '---') i++;
      continue;
    }

    if (line.trim() === '---') {
      flushPara();
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      continue;
    }

    paraLines.push(line);
  }
  flushPara();

  return typographyCSS + '\n<section class="article-body">\n' + html + '</section>';
}

// Build payload for each article
articles.forEach(art => {
  const mdPath = path.join(baseDir, art.dir, '文章.md');
  if (!fs.existsSync(mdPath)) {
    console.log(`SKIP ${art.dir}: no 文章.md`);
    return;
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const contentHTML = mdToHTML(md);

  const payload = {
    articles: [{
      title: art.title,
      author: '',
      digest: art.digest.substring(0, 64),
      content: contentHTML,
      content_source_url: '',
      thumb_media_id: '{{THUMB}}',
      need_open_comment: 1,
      only_fans_can_comment: 0
    }]
  };

  const outPath = path.join(baseDir, art.dir, 'payload_template.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ ${art.dir}/payload_template.json`);
});

console.log('\n全部 payload_template.json 已生成');