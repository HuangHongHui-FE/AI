// convert_articles_20260716.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260716';
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
  { dir: '01-老公把家里WiFi密码改成了我们认识那天的日期',
    title: '老公把家里WiFi密码改成了我们认识那天的日期',
    digest: '冷战十九天没道歉的丈夫，把家里WiFi密码改成了我们认识那天的日期。我输进去，眼泪掉枕头上。二十年他不会嘴上认错，却把密码改回那天等我懂。',
    headerLine: '今天讲一个把WiFi密码改成认识那天的日期、替不肯认错的男人开口的故事',
    footerLine: '让更多在婚姻里背对背耗着、谁也不肯先张嘴的人看到' },
  { dir: '02-我和老公约定每天说一句真话坚持到第七天差点离婚',
    title: '我和老公约定每天说一句真话坚持到第七天差点离婚',
    digest: '中年夫妻全靠"还行随便"撑了十二年。我们约定每天说一句真话，第七天他说"我觉得咱俩过不到老"。吓得我想收拾行李，他怕的恰是再不开口。',
    headerLine: '今天讲一对约定每天说一句真话、第七天差点把家说散了的夫妻',
    footerLine: '让更多在客气里把日子过成圆滑、却快撑不下去的人看到' },
  { dir: '03-公司让我整理那个刚被裁同事的工位',
    title: '公司让我整理那个刚被裁同事的工位',
    digest: '让我去整理昨天还一起吐槽、今天被裁的同事工位。翻到抽屉最底下一个信封，记着谁帮过他。有我一笔——欠我一杯奶茶，记了一年。',
    headerLine: '今天讲一个去整理刚被裁同事工位、翻到一张人情账的人',
    footerLine: '让更多在工位上低头忙活、却没替谁记过一笔小账的人看到' },
  { dir: '04-我决定连续一个月每天扔一件东西',
    title: '我决定连续一个月每天扔一件东西',
    digest: '我决定连续一个月每天扔一件有回忆的旧物。前二十天爽，到一沓我爸写我妈的旧信卡住。扔到最后才懂，要扔的不是东西，是拿过去惩罚现在的自己。',
    headerLine: '今天讲一个连续一个月每天扔一件旧物、扔到最后没敢扔的人',
    footerLine: '让更多什么都留着、连不开心的自己都留着的人看到' },
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
