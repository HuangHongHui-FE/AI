// build_html.js — 将今天4篇文章转为微信HTML并生成payload_template.json
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/31672/AI/project/wechat/文章包/20260613';

const articles = [
  { dir: '01-分床睡三个月感情反而变好了', imgSlots: [0,1,2,4] },
  { dir: '02-从大厂跳小公司发现表演工作', imgSlots: [0,1,3,4] },
  { dir: '03-带00后徒弟半年开始改简历', imgSlots: [1,3,5,7] },
  { dir: '04-我妈75岁学会网购打乱退休计划', imgSlots: [0,2,4,6] },
];

function mdToWechatHTML(md, imgSlots) {
  const titleMatch = md.match(/## 文章 \d+：(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const bodyMatch = md.match(/### 正文\n\n([\s\S]*?)\n\n### 备选标题/);
  let body = bodyMatch ? bodyMatch[1].trim() : '';

  let digest = body
    .replace(/\*\*/g, '')
    .replace(/[\n\r]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 54);

  const lines = body.split('\n');
  const paragraphs = [];
  let sepIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!line.trim()) {
      paragraphs.push('<p>&nbsp;</p>');
      continue;
    }

    if (line.trim() === '***') {
      const imgN = imgSlots.indexOf(sepIdx);
      if (imgN !== -1) {
        paragraphs.push(`<p style="text-align:center;"><img src="{{IMG${imgN}}}" style="width:100%;" /></p>`);
        paragraphs.push('<p style="font-size:14px;color:#888;text-align:center;">配图</p>');
      }
      paragraphs.push('<p>&nbsp;</p>');
      sepIdx++;
      continue;
    }

    let content = line.trim();
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    paragraphs.push(`<p>${content}</p>`);
  }

  const bodyHTML = paragraphs.join('');
  const html = `<section style="margin:0 16px;font-size:15px;color:#4a4a4a;line-height:1.75;letter-spacing:0.5px;">${bodyHTML}</section>`;

  return { title, digest, html };
}

function buildPayload(title, digest, html) {
  return JSON.stringify({
    articles: [{
      title: title,
      author: "",
      digest: digest,
      content: html,
      content_source_url: "",
      thumb_media_id: "{{THUMB}}",
      need_open_comment: 1,
      only_fans_can_comment: 0
    }]
  }, null, 2);
}

for (const art of articles) {
  const dir = path.join(BASE, art.dir);
  const mdPath = path.join(dir, '文章.md');
  if (!fs.existsSync(mdPath)) {
    console.log(`❌ 找不到 ${mdPath}`);
    continue;
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const { title, digest, html } = mdToWechatHTML(md, art.imgSlots);
  const payload = buildPayload(title, digest, html);

  const outPath = path.join(dir, 'payload_template.json');
  fs.writeFileSync(outPath, payload, 'utf8');
  console.log(`✅ ${art.dir}`);
}

console.log('\n全部 payload_template.json 生成完成');