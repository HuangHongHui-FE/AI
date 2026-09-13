// convert_articles_20260904.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260904';
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
  { dir: '01-我从不在吵架后先开口除非对方说了这句话',
    title: '我从不在吵架后先开口，除非对方说了这句话',
    digest: '吵架我从不先开口，把他当输。上周冷战到深夜，他一句"你小时候是不是也这样"，戳破我八年的死撑——我不是不想认输，是没人教过我，怎么把"我难过"说出口。',
    headerLine: '今天讲一个把"先开口"当输、冷战八年不肯低头的妻子',
    footerLine: '让更多在关系里把"先低头"当成认输的人看到' },
  { dir: '02-我发烧39度那晚老公在客厅打了整夜游戏',
    title: '我发烧39度那晚，老公在客厅打了整夜游戏',
    digest: '发烧39度那晚，他在客厅打了整夜游戏。清晨他蜷在地板睡着，手机停在"39度要不要去医院"的搜索，时间是凌晨3点17分。他不会说爱你，只会把爱藏在你没看见的地方。',
    headerLine: '今天讲一个高烧39度那晚、在客厅打了一整夜游戏守夜的丈夫',
    footerLine: '让更多把爱藏进凌晨的额温枪和搜索记录里、不声不响的人被看见' },
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
  // 只插 1 个内图占位（各篇仅 1 张 img1.jpg），放在第 1 个 section 后
  for (let i = 0; i < sections.length; i++) {
    htmlParts.push(`<section style="${STYLE}">${mdToHtml(sections[i])}</section>`);
    if (i === 0) {
      htmlParts.push(`<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG0}}" style="max-width: 100%;" /></p>`);
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
