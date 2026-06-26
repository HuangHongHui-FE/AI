// convert_articles_20260621.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260621';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

// 统一顶部"蓝字关注"横幅样式（文案 per-article 注入）
// 注意：WeChat API 拒绝 #mp_popup_follow 等 href，改用纯蓝色文字样式
function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

// 统一底部"在看"提醒样式（文案 per-article 注入）
function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我们把家里的Wi-Fi分成两个',
    title: '我们把家里的Wi-Fi分成两个，吵架次数减半了',
    digest: '老公被裁后第三周，每晚外放抖音到凌晨。我第二天改了路由器密码，他反而开始主动找我说话。',
    headerLine: '每天一个真实故事，今天讲一个用分Wi-Fi挽救婚姻的女人',
    footerLine: '让更多在婚姻里"同屋不同频"的人看到' },
  { dir: '02-同事辞职开了家代吵架工作室',
    title: '同事辞职去开了家"代吵架"工作室，月入三万',
    digest: '老周去年9月被裁，发了条朋友圈"代吵架300一次"。我以为他开玩笑，直到他借我200。',
    headerLine: '每天一个真实故事，今天讲一个被裁后开"代吵架"工作室的男人',
    footerLine: '让更多累到不会吵架的人看到' },
  { dir: '03-我开始记录今天没做什么',
    title: '我开始记录"今天没做什么"，焦虑减了一半',
    digest: '5月12号周日，我打开滴答清单看到23条未完成，关掉了。第二天我开了个备忘录叫"今天没做什么"。',
    headerLine: '每天一个真实故事，今天讲一个靠"记录没做什么"治好焦虑的人',
    footerLine: '让更多被待办清单压住的人看到' },
  { dir: '04-00后整顿职场三年后',
    title: '00后整顿职场三年后，他们也开始"安静辞职"了',
    digest: '去年7月公司来了个00后，第二周在群里怼了领导。我以为他活不过试用期。今年三月他换了头像。',
    headerLine: '每天一个真实故事，今天讲一个"安静辞职"的00后',
    footerLine: '让更多在"用力过猛"和"安静撤退"之间的人看到' },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 把一段 markdown 文本转成 HTML <p> 列表
// 处理：**加粗**、空行分段
function mdToHtml(md) {
  const paragraphs = md.trim().split(/\n\s*\n/);
  const ps = paragraphs
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      // 行内合并（去掉段内单换行）
      const text = p.replace(/\n/g, ' ');
      // 处理 **加粗**
      let html = escapeHtml(text);
      // 把 **xxx** 转成 <strong style="color: #be185d">xxx</strong>
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #be185d; font-weight: bold;">$1</strong>');
      return `<p style="margin-bottom: 1em;">${html}</p>`;
    });
  return ps.join('');
}

for (const art of articles) {
  const artDir = path.join(BATCH_DIR, art.dir);
  const md = fs.readFileSync(path.join(artDir, 'article.md'), 'utf8');

  // 用 --- 切分 section（markdown 水平线）
  const sections = md.split(/^---\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const htmlParts = [];
  // 顶部蓝字关注横幅（文案 per-article）
  htmlParts.push(headerBanner(art.headerLine));
  for (let i = 0; i < sections.length; i++) {
    htmlParts.push(`<section style="${STYLE}">${mdToHtml(sections[i])}</section>`);
    // 前3个 section 后插图片占位符（img1, img2, img3）
    if (i < 3) {
      htmlParts.push(`<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${i}}}" style="max-width: 100%;" /></p>`);
    }
  }
  // 底部"在看"提醒（文案 per-article）
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
