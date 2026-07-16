// convert_articles_20260707.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260707';
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
  { dir: '01-我和老公分房睡半年昨晚他把枕头搬回了主卧',
    title: '我和老公分房睡半年，昨晚他把枕头搬回了主卧',
    digest: '跟老公分房半年，起因是打呼加赌气。他感冒那晚我熬了一宿。昨晚他抱着枕头站卧室门口，说：我回来睡。',
    headerLine: '每天一个真实故事，今天讲一个跟老公分房半年、最后被一句话说软的妻子',
    footerLine: '让更多在婚姻里同屋不同频、却都说不出口的人看到' },
  { dir: '02-我在老公旧手机里翻到一个备注叫老地方的号码',
    title: '我在老公旧手机里，翻到一个备注叫"老地方"的号码',
    digest: '老公旧手机里有个备注叫"老地方"的号，通话四秒。我打过去是个修鞋大爷。那是九年前我俩避雨的地方。',
    headerLine: '每天一个真实故事，今天讲一个在老公旧手机里翻到"老地方"、差点闹乌龙的妻子',
    footerLine: '让更多在婚姻里疑神疑鬼、又轻易被一句话说软的人看到' },
  { dir: '03-新来的总监第一天把我工位上那盆绿萝搬走了',
    title: '新来的总监第一天，把我工位上那盆绿萝搬走了',
    digest: '新总监上任第一天，把我养了三年的绿萝搬走，说统一形象。一句"工位不是你家阳台"，把我治清醒了。',
    headerLine: '每天一个真实故事，今天讲一个被新总监搬走工位绿萝、反倒想通了的中年人',
    footerLine: '让更多把工位当家布置、其实只是在自我感动的人看到' },
  { dir: '04-四十岁生日那天我数了数能拨出去的电话只有三个',
    title: '四十岁生日那天，我数了数能拨出去的电话，只有三个',
    digest: '四十岁生日，通讯录四百个号，能拨出去的只有三个：妈、发小、一个前同事。朋友圈很大，说话的圈子很小。',
    headerLine: '每天一个真实故事，今天讲一个四十岁生日数了数能拨出去的电话只有三个的人',
    footerLine: '让更多通讯录塞满、却找不到一个能拨出去的号的人看到' },
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
