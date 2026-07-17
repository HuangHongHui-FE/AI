// convert_articles_20260709.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260709';
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
  { dir: '01-老公开始每天问我今天累不累我反而想逃',
    title: '老公开始每天问我“今天累不累”，我反而想逃',
    digest: '老林突然每天下班问我累不累。我受宠若惊后又开始紧张，查手机、翻记录。后来他说只是看我脸色差。我才发自己已经不会被人平常地关心了。',
    headerLine: '每天一个真实故事，今天讲一个被老公突然的关心吓到、开始自我审视的妻子',
    footerLine: '让更多被吓大、不会接住关心的人看到' },
  { dir: '02-新来的实习生叫我姐我愣了三秒',
    title: '新来的实习生叫我“姐”，我愣了三秒',
    digest: '新来实习生叫我姐，我手里笔停了三秒。想起自己二十六也这么叫过刘姐。后来发现我怕的不是被叫姐，是开始急着证明自己不老。',
    headerLine: '每天一个真实故事，今天讲一个被一声“姐”炸出年龄焦虑、又坐稳这岁数的职场女人',
    footerLine: '让更多被叫一声姐就咯噔一下的人看到' },
  { dir: '03-我把老公的微信备注从老公改回了他的全名',
    title: '我把老公的微信备注，从“老公”改回了他的全名',
    digest: '有天翻通讯录，差点忘了老公全名。我把备注改回“徐长青”，打字得一个字一个字选。改完我俩说话都不一样了。',
    headerLine: '每天一个真实故事，今天讲一个把老公备注改回全名、重新看见他这个人的妻子',
    footerLine: '让更多把彼此叫成身份、快忘了名字的夫妻看到' },
  { dir: '04-我把衣柜里十年没穿的衣服全送了人',
    title: '我把衣柜里十年没穿的衣服，全送了人',
    digest: '换季整理衣柜，一半衣服十年没动。每件都挂着“瘦下来能穿”“有场合能穿”。我才懂留的不是衣服，是十年没兑现的自己。全送了。',
    headerLine: '每天一个真实故事，今天讲一个把柜子里十年没穿的衣服全送人、先松开柜子的人',
    footerLine: '让更多把好衣服都留给“以后的我”、委屈现在的人看到' },
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
