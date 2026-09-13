// convert_articles_20260913.js — 从 article.md 生成 payload_template.json（支持每篇不同的内图位置）
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260913';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

// 顶部蓝字关注横幅（格式统一，文案定制）
function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

// 底部在看提醒（格式统一，文案定制）
function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-公司让我给十年老同事做离职面谈',
    title: '公司让我给十年老同事做离职面谈',
    digest: 'HR把离职面谈表推给我："你跟他熟，你去谈。"对面是带了我十年的老周。他为什么走，纸上写了四个字，嘴里说的是另一回事。',
    headerLine: '今天讲一个被公司推去做离职面谈、坐在十年老同事对面的中年人',
    footerLine: '让更多把"个人发展"四个字填进离职表的人被看见',
    insertAfter: [0] },
  { dir: '02-中秋我妈打电话问我回不回来我说看情况',
    title: '中秋我妈打电话问我回不回来，我说看情况',
    digest: '我妈打电话问中秋回不回来。我随口说了句"看情况"。挂了电话才想起来，她这辈子从没对我说过这三个字，她永远说"行"。',
    headerLine: '今天讲一个把"看情况"三个字说给妈妈听的人',
    footerLine: '让更多把"看情况"改回"我回来"的人被看见',
    insertAfter: [0, 4] },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// markdown 段落 → <p>，处理 **加粗**
function mdToHtml(md) {
  const paragraphs = md.trim().split(/\n\s*\n/);
  const ps = paragraphs
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const text = p.replace(/\n/g, ' ');
      let html = escapeHtml(text);
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #be185d; font-weight: bold;">$1</strong>');
      return `<p style="margin-bottom: 1em;">${html}</p>`;
    });
  return ps.join('');
}

for (const art of articles) {
  const artDir = path.join(BATCH_DIR, art.dir);
  const md = fs.readFileSync(path.join(artDir, 'article.md'), 'utf8');

  // 用 --- 分 section，按 insertAfter 指定位置插图占位符
  const sections = md.split(/^---\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const htmlParts = [];
  htmlParts.push(headerBanner(art.headerLine));
  let imgIdx = 0;
  for (let i = 0; i < sections.length; i++) {
    htmlParts.push(`<section style="${STYLE}">${mdToHtml(sections[i])}</section>`);
    if (art.insertAfter.includes(i)) {
      htmlParts.push(`<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${imgIdx}}}" style="max-width: 100%;" /></p>`);
      imgIdx++;
    }
  }
  htmlParts.push(footerReminder(art.footerLine));

  const content = htmlParts.join('\n');
  const payload = {
    articles: [{
      title: art.title,
      author: '',
      digest: art.digest,
      content,
      content_source_url: '',
      thumb_media_id: '{{THUMB}}',
      need_open_comment: 1,
      only_fans_can_comment: 0,
    }],
  };

  fs.writeFileSync(path.join(artDir, 'payload_template.json'), JSON.stringify(payload, null, 2));
  console.log(`✅ ${art.dir}/payload_template.json (${sections.length} sections, ${imgIdx} 内图, ${content.length} chars)`);
}

console.log('\n全部完成');
