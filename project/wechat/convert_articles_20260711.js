// convert_articles_20260711.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260711';
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
  { dir: '01-我在老公抽屉里翻到一张我没拍的照片',
    title: '我在老公抽屉里翻到一张我没拍的照片',
    digest: '找螺丝刀翻老林抽屉，翻到一张照片，是我趴桌改卷子睡着。背面一行字：2013年4月，她改卷子改到睡着，我看着三年了。',
    headerLine: '每天一个真实故事，今天讲一个在老公抽屉里翻到自己三年疲惫被悄悄记下的妻子',
    footerLine: '让更多把累当成忙、从没人说一句辛苦的人看到' },
  { dir: '02-我开始每天给老公留一盏灯',
    title: '我开始每天给老公留一盏灯',
    digest: '老林这个月天天加班到深夜。我开始每天给玄关留盏灯。后来才知道，他有好几次就坐楼下抽烟拖到半夜，怕回来吵醒我。',
    headerLine: '每天一个真实故事，今天讲一个给加班老公留灯、才发现对方也在替自己留门的女人',
    footerLine: '让更多家里那盏灯不知道为谁留的人看到' },
  { dir: '03-公司让所有人签一份自愿放弃年假的承诺书',
    title: '公司让所有人签一份自愿放弃年假的承诺书',
    digest: '周五下午组长推来一张自愿放弃年假承诺书。老同事都签了。我笔尖点在纸上没落下，想起去年父亲住院请不出假那七天。',
    headerLine: '每天一个真实故事，今天讲一个在自愿放弃年假那张纸前没签字的职场中年',
    footerLine: '让更多连请假都像偷了东西的人看到' },
  { dir: '04-今年春节三天我收到一百一十二条群发拜年',
    title: '今年春节三天，我收到一百一十二条群发拜年',
    digest: '春节三天收到112条群发拜年。初二老周发来别又熬夜，我妈打电话三句没一句拜年。我把112条删了，留下不到十条。',
    headerLine: '每天一个真实故事，今天讲一个数完112条群发拜年、才发现真正记得自己的人不到十个的人',
    footerLine: '让更多通讯录几百号、能拨出去的电话没几个的人看到' },
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
