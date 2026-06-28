// convert_articles_20260627.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260627';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我和老公分床睡第三十天',
    title: '我和老公分床睡第三十天',
    digest: '5月28号凌晨两点，我把老公的乳胶枕抱到了次卧。他问"你认真的？"我说"认真的。"',
    headerLine: '每天一个真实故事，今天讲一个主动分床睡挽救婚姻的女人',
    footerLine: '让更多在"同床不同步"里熬着的人看到' },
  { dir: '02-35岁那年我主动申请降职',
    title: '35岁那年，我主动申请降职',
    digest: '6月3号早会后我跟领导说，我想从主管转回独立贡献者。他愣了三秒："你确定？"',
    headerLine: '每天一个真实故事，今天讲一个35岁主动申请降职的母亲',
    footerLine: '让更多被"晋升焦虑"绑住的中年人看到' },
  { dir: '03-我开始给五年后的自己写信',
    title: '我开始给"五年后的自己"写信',
    digest: '5月10号晚上我在iPhone备忘录新建了文件夹"给未来的我"。第一封写给2031年的我。',
    headerLine: '每天一个真实故事，今天讲一个给五年后的自己写信的人',
    footerLine: '让更多找不到收件人的人看到' },
  { dir: '04-211毕业的表姐回县城当全职太太',
    title: '211毕业的表姐，回县城当了第三年"全职太太"',
    digest: '2013年考上北京211，2023年回县城当全职太太。今年端午她说"我不怕离婚，怕的是简历写不出"。',
    headerLine: '每天一个真实故事，今天讲一个211毕业回县城当全职太太的女人',
    footerLine: '让更多在小城里"得能走"的人看到' },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

  const sections = md.split(/^---\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const htmlParts = [];
  htmlParts.push(headerBanner(art.headerLine));
  for (let i = 0; i < sections.length; i++) {
    htmlParts.push(`<section style="${STYLE}">${mdToHtml(sections[i])}</section>`);
    if (i < 3) {
      htmlParts.push(`<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${i}}}" style="max-width: 100%;" /></p>`);
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
  console.log(`✅ ${art.dir}/payload_template.json (${sections.length} sections, ${content.length} chars)`);
}

console.log('\n全部完成');
