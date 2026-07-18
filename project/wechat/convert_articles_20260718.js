// convert_articles_20260718.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260718';
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
  { dir: '01-我把老公微信备注从昵称改回他全名那天',
    title: '我把老公微信备注从昵称改回他全名那天',
    digest: '冷战十一天赌气把老公微信备注改回全名。改完愣在删除键上——十年六个备注全是我起的字，删的不是他，是我替他安的十年。他一句"煎了俩"，墙塌了一块。',
    headerLine: '今天讲一个把老公微信备注改回全名、改完愣在删除键上的女人',
    footerLine: '让更多在婚姻里赌气改备注、改的其实是自己写下的十年的人看到' },
  { dir: '02-老公开始每晚悄悄进来给我盖被子',
    title: '老公开始每晚悄悄进来给我盖被子',
    digest: '分房冷战十八天，从地垫脚印发现他每晚悄悄进来给我掖被子。装睡那一夜看他弯腰掖被角。他从没说过对不起，可一晚没落过。',
    headerLine: '今天讲一个分房冷战、却每晚悄悄进来给妻子掖被子的丈夫',
    footerLine: '让更多背对背冷战、却一夜不落地替对方掖被子的人被看见' },
  { dir: '03-我替离职同事删掉了他没发出去的那封邮件',
    title: '我替离职同事删掉了他没发出去的那封邮件',
    digest: '清理离职同事电脑，草稿箱一封写一半没发、收件人全组的信。读到第三段他说怕自己只是"能被随时替换的那个谁"。替他删了，送行那天他谢我什么都没说。',
    headerLine: '今天讲一个替离职同事删掉草稿箱里发不出去那封信的人',
    footerLine: '让更多把所有的事咽进草稿箱、笑呵呵接活的人被看见' },
  { dir: '04-我清空了购物车里所有等以后再买的东西',
    title: '我清空了购物车里所有等以后再买的东西',
    digest: '购物车躺三年四十七件，今天全删了。删每件想起一个借口。删到金坠子"等他开口"，妈去年走了。明白等的不是打折，是活到那个"以后"的自己。',
    headerLine: '今天讲一个清空购物车里四十七件"等以后再买"的人',
    footerLine: '让更多购物车里躺着"等以后"的人，问问那个以后自己来不来' },
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
