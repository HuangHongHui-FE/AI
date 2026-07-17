// convert_articles_20260705.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260705';
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
  { dir: '01-我和老陈约定每周三晚上不说话第三周他先开口了',
    title: '我和老陈约定每周三晚上不说话，第三周他先开口了',
    digest: '我和老陈一开口就掐。我撂下"今晚开始周三不说话"。第一周他给我倒水，第二周给我调台灯，第三周他先开口了。',
    headerLine: '每天一个真实故事，今天讲一个和老公约定周三晚上不说话、反而重新听见他的妻子',
    footerLine: '让更多一开口就掐、话越说越拧的夫妻看到' },
  { dir: '02-老公失业第二个月我开始每天给他留一张便利贴',
    title: '老公失业第二个月，我开始每天给他留一张便利贴',
    digest: '老公失业第二个月不动了。我在剃须刀旁贴第一张便利贴。第五天他回了铅笔字"知道了"。后来便利贴成了我俩的暗号。',
    headerLine: '每天一个真实故事，今天讲一个靠黄色便利贴把失业老公拉回来的妻子',
    footerLine: '让更多伴侣在低谷里说不动话的人看到' },
  { dir: '03-公司取消免费晚餐那周加班的人突然少了一半',
    title: '公司取消免费晚餐那周，加班的人突然少了一半',
    digest: '公司取消免费晚餐那周，加班的人少了一半。六点电梯口开始排队。晚餐恢复但门槛涨到三小时。人不是怕加班，是怕白加。',
    headerLine: '每天一个真实故事，今天讲一家取消免费晚餐、加班人数瞬间少一半的互联网公司',
    footerLine: '让更多被免费晚餐绑着白加班的人看到' },
  { dir: '04-我开始每天早到公司十分钟只为在车里坐一会',
    title: '我开始每天早到公司十分钟，只为在车里坐一会',
    digest: '36岁我每天早到公司十分钟，在地库车里坐着不上楼。那十分钟是唯一不被任何身份占用的时间。我在地库碰见了老周。',
    headerLine: '每天一个真实故事，今天讲一个每天早到十分钟、在地库车里偷自己的中年人',
    footerLine: '让更多活到36岁没一秒是自己的人看到' },
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
