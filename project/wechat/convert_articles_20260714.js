// convert_articles_20260714.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260714';
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
  { dir: '01-老公开始每天给我发他中午吃的饭',
    title: '老公开始每天给我发他中午吃的饭',
    digest: '他出差三天都不发消息，最近却每天拍午饭给我。我以为是猫腻，翻他手机，翻到一条搜索记录——胃息肉癌变概率。',
    headerLine: '每天一个真实故事，今天讲一个突然开始拍午饭给老婆看、背后藏着体检单的男人',
    footerLine: '让更多在婚姻里各自扛着、谁也不先开口的人看到' },
  { dir: '02-老公开始替我回我妈的微信',
    title: '老公开始替我回我妈的微信',
    digest: '我妈的微信我回不动，老陈接手替我回。聊了两个月，我妈说"你那个老公比你会说话"。我才反应过来，关系替一阵可以，替一辈子她就不是我闺女了。',
    headerLine: '每天一个真实故事，今天讲一个把回妈微信的活儿外包给老公、差点把妈外包出去的女人',
    footerLine: '让更多在亲妈微信前打退稿、却又不甘心的人看到' },
  { dir: '03-公司让我带教一个比我大十岁的下属',
    title: '公司让我带教一个比我大十岁的下属',
    digest: '领导让我带教一个四十五岁的老员工，我三十五。准备流程讲十分钟，他比我熟。后来我换成"你讲踩过的坑"，他讲了一下午，我成了上课的那个。',
    headerLine: '每天一个真实故事，今天讲一个三十五岁、被公司派去带教四十五岁下属的人',
    footerLine: '让更多被"年龄资历"卡在台上、不知道咋开口带人的人看到' },
  { dir: '04-我把手机通知全关掉的那一周',
    title: '我把手机通知全关掉的那一周',
    digest: '晚上十一点手机震了八下，我没看却睡不着。第二天我把所有App通知全关了。第一周少看了四百条消息，没漏掉一件重要的事。',
    headerLine: '每天一个真实故事，今天讲一个把手机通知全关掉、找回十个小时的人',
    footerLine: '让更多被红点追着跑、一震就心慌的人看到' },
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
