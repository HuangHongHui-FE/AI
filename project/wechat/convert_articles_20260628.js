// convert_articles_20260628.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260628';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我把结婚照从客厅摘了下来',
    title: '我把结婚照从客厅摘了下来',
    digest: '6月3号下午两点半，我搬了把椅子踩上去，把客厅那张1.2米的结婚照摘了。他下班回来看了一眼墙，没说话。',
    headerLine: '每天一个真实故事，今天讲一个主动摘下客厅结婚照的女人',
    footerLine: '让更多在"婚姻仪式感"里熬着的人看到' },
  { dir: '02-我主动放弃了今年的年终评优',
    title: '我主动放弃了今年的年终评优',
    digest: '38岁，工作11年，6月17号下午我给领导发飞书："今年评优我不参加了。"他十分钟后回电话："你确定？"',
    headerLine: '每天一个真实故事，今天讲一个38岁主动放弃年终评优的母亲',
    footerLine: '让更多被"晋升焦虑"绑住的中年人看到' },
  { dir: '03-我开始给情绪打分',
    title: '我开始给情绪打分',
    digest: '5月14号晚上十一点，我在iPhone备忘录新建了"情绪日记"。第一条："今天情绪：4分。"我以为4分是还行。',
    headerLine: '每天一个真实故事，今天讲一个靠给情绪打分治好"还行感"的人',
    footerLine: '让更多被"还行"两个字盖住的人看到' },
  { dir: '04-我妈58岁开始学AI画图',
    title: '我妈58岁开始学AI画图',
    digest: '6月8号我妈58岁生日，让我教她用即梦画图。她画的第一张全家福，挑了一张最不像自己的——"这是我想长的样子。"',
    headerLine: '每天一个真实故事，今天讲一个58岁开始学AI画图的妈妈',
    footerLine: '让更多怕"妈妈被时代甩开"的中年人看到' },
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
