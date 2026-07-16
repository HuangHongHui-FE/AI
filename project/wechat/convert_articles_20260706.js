// convert_articles_20260706.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260706';
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
  { dir: '01-老公学会网购后给我买了三件一模一样的裙子',
    title: '老公学会网购后给我买了三件一模一样的裙子',
    digest: '老陈四十岁第一次网购，给我买了三件同款不同色的裙子。他不会选色，干脆都买。那张教他注册淘宝的纸，我留着。',
    headerLine: '每天一个真实故事，今天讲一个四十岁才学会网购、给老婆买重三件裙子的笨丈夫',
    footerLine: '让更多在婚姻里很久没被认真对待过的女人看到' },
  { dir: '02-婆婆来住三个月走那天给我留了一坛咸菜',
    title: '婆婆来住三个月，走那天给我留了一坛咸菜',
    digest: '婆婆来住三个月，我俩较着劲没说几句软话。走那天她留下一坛咸菜，说她腌了几十年，只腌给自家人。',
    headerLine: '每天一个真实故事，今天讲一个跟婆婆较劲三个月、最后被一坛咸菜说软了的儿媳',
    footerLine: '让更多跟婆婆住成一个屋里陌生人的女人看到' },
  { dir: '03-公司让我们写五年规划我交了一张白纸',
    title: '公司让我们写五年规划，我交了一张白纸',
    digest: '35岁公司让写五年规划，我对着模板发呆两天，交了一张白纸。不是摆烂，是终于不再骗自己。',
    headerLine: '每天一个真实故事，今天讲一个在公司五年规划里交了张白纸的35岁中层',
    footerLine: '让更多对着模板写不出一个真心目标的人看到' },
  { dir: '04-我在医院走廊和一个保安聊了两个小时',
    title: '我在医院走廊和一个保安聊了两个小时',
    digest: '陪护我爸那晚，我在医院走廊和一个同龄夜班保安聊到天亮。一个月二十个夜班的他，跟挣得更多的我，其实一个样。',
    headerLine: '每天一个真实故事，今天讲一个在医院走廊跟夜班保安聊到天亮的中年人',
    footerLine: '让更多也活在一个走不出去的走廊里的人看到' },
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

  // 用 --- 分 section，前 3 个 section 后插图占位符
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
