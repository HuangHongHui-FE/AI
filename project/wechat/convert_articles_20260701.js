// convert_articles_20260701.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260701';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我在老公手机里翻到他给我存的表情包文件夹',
    title: '我在老公手机里翻到他给我存的表情包文件夹',
    digest: '7月1号晚他洗澡，我替他回微信，相册里翻到一个叫"她"的文件夹。点开全是表情包——他自己截的，我俩聊天里的碎碎念，存了二十多张。',
    headerLine: '每天一个真实故事，今天讲一个在老公手机里翻到"她"文件夹的妻子',
    footerLine: '让更多把日子过成"室友"的人看到' },
  { dir: '02-吵完架我和老公必须一起吃顿火锅',
    title: '吵完架我和老公必须一起吃顿火锅',
    digest: '我和老陈定了个规矩：吵完当天必须一起吃顿火锅，不许看手机不许翻旧账。今年第三年，我俩都胖了，但没一次真想散。',
    headerLine: '每天一个真实故事，今天讲一对吵完架必须一起吃火锅的夫妻',
    footerLine: '让更多冷战到忘了为什么吵的人看到' },
  { dir: '03-我把工位上的全家福收进了抽屉',
    title: '我把工位上的全家福收进了抽屉',
    digest: '7月1号我把工位上摆了八年的全家福收进抽屉。不是躺平，是不再把命绑在一个随时能腾空的位子上。活儿照干，班不瞎加。',
    headerLine: '每天一个真实故事，今天讲一个把工位全家福收进抽屉的中年员工',
    footerLine: '让更多把工位当家的中年人看到' },
  { dir: '04-我妈的朋友圈我三年没点过赞',
    title: '我妈的朋友圈我三年没点过赞',
    digest: '我屏蔽了我妈朋友圈三年。上个月同事说他爸走后朋友圈全是等他回家，我当晚打开屏蔽列表，发现我妈发了一千多天的"丫头爱吃的"。',
    headerLine: '每天一个真实故事，今天讲一个三年没给妈朋友圈点过赞的女儿',
    footerLine: '让更多把父母朋友圈屏蔽了的人看到' },
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
