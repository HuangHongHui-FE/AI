// convert_articles_20260713.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260713';
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
  { dir: '01-结婚第十二年我们第一次一起逛菜市场',
    title: '结婚第十二年，我们第一次一起逛菜市场',
    digest: '他以前从不进菜市场。这周六，他跟我在西红柿摊前站了十分钟，学会挑硬的、软的、放锅里炖的。原来一起挑菜，比一起吃一顿饭难。',
    headerLine: '每天一个真实故事，今天讲一对结婚十二年、才第一次手牵手进菜市场的夫妻',
    footerLine: '让更多在婚姻里各买各的菜、各过各的日子的人看到' },
  { dir: '02-我跟老公约法三章吵架必须当面吵',
    title: '我跟老公约法三章：吵架必须当面吵',
    digest: '我们冷战了四天，全程微信，谁也不看谁。第四天我提了三条规矩：不许微信吵、不许过夜、不许翻旧账。他说第一条最难。',
    headerLine: '每天一个真实故事，今天讲一对把吵架立成规矩、不许冷战的中年夫妻',
    footerLine: '让更多把微信吵架当家常便饭、却从不当面说的人看到' },
  { dir: '03-领导让我把项目让给新人我没让',
    title: '领导让我把项目让给新人，我没让',
    digest: '领导说新人要成长，让我把跟了两年的项目交出去。我说不。会议室安静了五秒。后来那个新人主动来找我，说谢谢。',
    headerLine: '每天一个真实故事，今天讲一个被领导劝着让项目、却第一次说"不"的职场人',
    footerLine: '让更多被劝着"让一让"却忘了自己也是辛苦两年来的人看到' },
  { dir: '04-我决定以后微信只回一次',
    title: '我决定以后微信只回一次',
    digest: '我数了一下，上周同一条消息回了八遍，解释同件事解释了三轮。我给自己立了个规矩：说过的不重复、不秒回、不追聊。第二天我妈说我变了。',
    headerLine: '每天一个真实故事，今天讲一个把"微信只回一次"立成规矩的人',
    footerLine: '让更多在消息列表里被同一句话磨到没脾气的人看到' },
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
