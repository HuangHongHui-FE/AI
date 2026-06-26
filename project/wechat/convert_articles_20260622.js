// convert_articles_20260622.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260622';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-35岁我把存款分了三份',
    title: '35岁存款7万2，我把工资卡拆成了三份',
    digest: '我工作11年，账户里只剩7万2。房贷、孩子、婆婆住院都从我账户走。那天下午我去银行拆了卡。',
    headerLine: '每天一个真实故事，今天讲一个35岁把工资卡拆三份的女人',
    footerLine: '让更多在婚姻里"管钱但没钱"的人看到' },
  { dir: '02-面试官问我你父母做什么的',
    title: '面试官问我"你父母做什么的"，我犹豫了三秒',
    digest: '终面HR突然问我父母职业。我说我爸开滴滴，我妈超市收银。她记下之后再没正眼看我。',
    headerLine: '每天一个真实故事，今天讲一个被问"父母做什么"的35岁面试者',
    footerLine: '让更多在面试里被"家底定价"的人看到' },
  { dir: '03-我删掉了所有效率App那一周',
    title: '我删掉了所有效率App那一周',
    digest: '凌晨一点四十七，我卸载了7个效率App。第一个删滴答清单时手抖了一下。然后我20分钟就睡着了。',
    headerLine: '每天一个真实故事，今天讲一个删掉所有效率App的人',
    footerLine: '让更多被"23条未完成"追着跑的人看到' },
  { dir: '04-高考结束那天我妈突然哭了',
    title: '高考结束那天，我妈突然哭了',
    digest: '高考最后一科结束，我妈在校门口蹲下哭了。她说不是为我，是为她自己。她全职陪了我12年。',
    headerLine: '每天一个真实故事，今天讲一个高考结束后突然崩溃的妈妈',
    footerLine: '让更多把"陪读"活成全部人生的妈妈看到' },
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
