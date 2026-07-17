// convert_articles_20260704.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260704';
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
  { dir: '01-我把结婚证锁进抽屉反而不想离了',
    title: '我把结婚证锁进抽屉，反而不想离了',
    digest: '我和老陈吵到"过不下去"卡在嗓子眼，没说出口。我把结婚证锁进抽屉，钥匙扔进茶叶罐。退路没了，吵架反而回到吵架本身。',
    headerLine: '每天一个真实故事，今天讲一个把结婚证锁进抽屉反而踏实了的妻子',
    footerLine: '让更多把"离"当底牌却舍不得走的人看到' },
  { dir: '02-00后实习生问我为什么要装忙',
    title: '00后实习生问我"为什么要装忙"，我答不上来',
    digest: '00后实习生问我"加班是真有事吗"，我答不上来。活早干完了，我坐到九点。六年学会的"看着忙"，被一句干净的话问塌了。',
    headerLine: '每天一个真实故事，今天讲一个被00后实习生问"为什么装忙"的中年职场人',
    footerLine: '让更多用"忙"证明自己还重要的人看到' },
  { dir: '03-我开始每天删一张照片',
    title: '我开始每天删一张照片，删到第30天哭了',
    digest: '我相册4800张，6月3号起每天删一张。第30天点到一张旧截图，删之前哭了。删的不是照片，是那一年的怕。',
    headerLine: '每天一个真实故事，今天讲一个靠每天删一张照片挪出自己的姑娘',
    footerLine: '让更多相册里囤着旧情绪舍不得删的人看到' },
  { dir: '04-40度那天公司空调坏了总监先脱了西装',
    title: '40度那天公司空调坏了，总监第一个脱了西装',
    digest: '7月3号40度，公司空调坏了。总监先脱了西装，拿把景区折扇出来。那两小时整层楼的人被高温逼出原形，短暂平等。',
    headerLine: '每天一个真实故事，今天讲一栋40度空调坏了、总监先脱了西装的写字楼',
    footerLine: '让更多在写字楼里被"体面"绷着的人看到' },
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
