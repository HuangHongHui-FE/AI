// convert_articles_20260710.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260710';
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
  { dir: '01-老公开始记账后我才发现这十年我花了多少',
    title: '老公开始记账后，我才发现这十年我花了多少',
    digest: '老林突然在手机上记账，记了一个月。月底拉出一张表，我名下花销是他的两倍。我以为他要嫌我花得多，他说是想省下来给我换净水器。',
    headerLine: '每天一个真实故事，今天讲一个被老公一张账单照见这十年隐形付出的妻子',
    footerLine: '让更多把家填满却从没人问一句累不累的人看到' },
  { dir: '02-公司让大家匿名互评我收到了三条',
    title: '公司让大家匿名互评，我收到了三条',
    digest: '公司年终匿名互评，我收到三条。第三条写"跟她搭档心累，她什么都自己扛"。我盯了五分钟，才认下这十年我把负责活成了自私。',
    headerLine: '每天一个真实故事，今天讲一个被一句匿名评价问穿"什么都自己扛"的职场中年',
    footerLine: '让更多把什么都自己扛、扛成别人心累的人看到' },
  { dir: '03-我决定不再跟老公解释我为什么哭',
    title: '我决定不再跟老公解释，我为什么哭',
    digest: '我哭十几年，每次都得给老林摆清楚原因。有次我说就是想哭一会，他没追问，倒了杯水。我才懂我一直在给眼泪找资格。',
    headerLine: '每天一个真实故事，今天讲一个不再为哭找理由、把情绪的资格还给自己的人',
    footerLine: '让更多连哭都要证明有资格的人看到' },
  { dir: '04-我把手机屏幕调成黑白用了一周',
    title: '我把手机屏幕调成黑白，用了一周',
    digest: '看文章说彩屏刺激多巴胺，我把手机调成黑白。刷手机的冲动先矮了一截。我才懂我刷的不是内容，是那点不用动脑的颜色。',
    headerLine: '每天一个真实故事，今天讲一个给手机褪了色、才发现被颜色牵走多远的人',
    footerLine: '让更多被那点颜色牵着走的人看到' },
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
