// convert_articles_20260703.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260703';
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
  { dir: '01-我把家里的钟都调慢了五分钟',
    title: '我把家里所有的钟都调慢了五分钟',
    digest: '我和老陈又因"谁在拖"吵架。第二天他出差，我把家里四个钟都拨慢五分钟。他看钟紧张反而少了，我俩吵架少了一半。',
    headerLine: '每天一个真实故事，今天讲一个把家里钟都调慢五分钟、把婚姻也调松了的妻子',
    footerLine: '让更多被时间催着互相绑架的夫妻看到' },
  { dir: '02-被裁后去前司楼下吃面遇到接我工位的人',
    title: '被裁第三天，我在前司楼下面馆撞见接我工位的人',
    digest: '被裁第三天我去前司楼下吃面，撞见接我工位的新人。他点了一样的面，打电话说"原来那个人走了，留了个绿萝"。我那盆绿萝。',
    headerLine: '每天一个真实故事，今天讲一个被裁后去前司楼下吃面、撞见接替工位新人的前端',
    footerLine: '让更多被裁后还在回望前司的人看到' },
  { dir: '03-35岁我把微信好友从800删到80',
    title: '35岁，我把微信好友从800删到了80',
    digest: '35岁，我把微信好友从800删到80。删到第80个是前男友，盯了三分钟。删完才明白，我也只是别人列表里的占位。',
    headerLine: '每天一个真实故事，今天讲一个把微信好友从800删到80、删出轻松的姑娘',
    footerLine: '让更多被通讯录里几百个陌生人耗着的人看到' },
  { dir: '04-表妹填志愿那天全家围着一本厚书坐了三小时',
    title: '表妹填志愿那天，全家围着一本厚书坐了三小时',
    digest: '表妹考了583，全家六个人围着一本志愿指南坐了三小时。每人翻到自己想支持的那页，答案却不在那本书里。',
    headerLine: '每天一个真实故事，今天讲一个全家围着志愿指南坐三小时替表妹做主的下午',
    footerLine: '让更多被"过来人"替你做过主的人看到' },
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
