// convert_articles_20260630.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260630';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我把老公的电话备注改成了他的名字',
    title: '我把老公的电话备注改成了他的名字',
    digest: '6月28号晚十一点，他睡了。我把通讯录里"老公"改成他的名字周明远。第二天他看见，脸红了：我也好几年没叫过你名字了。',
    headerLine: '每天一个真实故事，今天讲一个把老公备注改回真名的女人',
    footerLine: '让更多把伴侣过成"功能"的人看到' },
  { dir: '02-我数了一下这一年我们说了三十七句话',
    title: '我数了一下，这一年我们说了三十七句话',
    digest: '6月29号晚我翻遍一年聊天记录，跟老公正经说过三十七句。数完那晚心里发空。第二天他突然说：我前天体检有个指标不太好。',
    headerLine: '每天一个真实故事，今天讲一个数出跟老公一年只说三十七句话的女人',
    footerLine: '让更多在"挺好的"底下懒得开口的人看到' },
  { dir: '03-开会时我第一次说我不知道',
    title: '开会时我第一次说了"我不知道"',
    digest: '6月26号季度复盘，领导点我名。我张口说了句"我不知道"，会议室静了半秒。装了八年不敢示弱的老员工，第一次卸下话术。',
    headerLine: '每天一个真实故事，今天讲一个开会第一次敢说"我不知道"的老员工',
    footerLine: '让更多靠"靠谱"硬撑、不敢示弱的人看到' },
  { dir: '04-我把愿望清单从五十条删到了三条',
    title: '我把愿望清单从五十条删到了三条',
    digest: '6月30号凌晨我把备忘录里攒了十年的五十条愿望删到只剩三条。删完才看清，一大半是别人说"你该有"的。三条都不花钱不赶时间。',
    headerLine: '每天一个真实故事，今天讲一个把愿望清单从五十条删到三条的人',
    footerLine: '让更多被"想要更多"压住的人看到' },
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
