// convert_articles_20260708.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260708';
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
  { dir: '01-我和老公约定吵架不过夜第三十七天他抱被子去了沙发',
    title: '我和老公约定吵架不过夜，第三十七天他抱被子去了沙发',
    digest: '结婚十一年我俩定规矩：吵架不过夜。第三十七天他抱被子去了沙发。后来我把规矩改成——谁想自己待会儿，就待会儿。',
    headerLine: '每天一个真实故事，今天讲一个给婚姻立规矩、第三十七天反而松了绑的妻子',
    footerLine: '让更多在婚姻里端着规矩不敢先低头的人看到' },
  { dir: '02-老公在饭桌上说我们这日子是过给谁看的',
    title: '老公在饭桌上说：我们这日子，是过给谁看的',
    digest: '老方饭桌上突然说：我们这日子是过给谁看的。他刷到同学九张三亚图，却记起我俩那天你吐了两次。',
    headerLine: '每天一个真实故事，今天讲一个被同学的朋友圈戳破、开始少发多待的丈夫',
    footerLine: '让更多日子过成了习惯性汇报的人看到' },
  { dir: '03-前同事寄来一个U盘里面是我五年前删掉的辞职信',
    title: '前同事寄来一个U盘，里面是我五年前删掉的辞职信',
    digest: '前同事寄来U盘，里面是我五年前删掉的辞职信。那时不敢走，熬到现在。我把信又删了一次——当年那个怕的人不在了。',
    headerLine: '每天一个真实故事，今天讲一个收到五年前自己写的辞职信、把它再删一次的人',
    footerLine: '让更多当年不敢递信、现在不用递的人看到' },
  { dir: '04-我把家里所有镜子都用布盖上了',
    title: '我把家里所有镜子，都用布盖上了',
    digest: '我把家里所有镜子都用布盖上。照了二十年，越照越觉得自己老。盖一个月后，我反而更敢出门了。',
    headerLine: '每天一个真实故事，今天讲一个把家里镜子全盖上、反而放过自己的人',
    footerLine: '让更多天天照镜子越照越焦虑的人看到' },
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
