// convert_articles_20260712.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260712';
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
  { dir: '01-老公买了辆二手车每周末带我去同一个地方',
    title: '老公买了辆二手车之后，每周末都带我去同一个地方',
    digest: '他花八千块买了辆银灰色卡罗拉，每周末拿着钥匙站在门口。河边的石凳、巷子里的面馆、旧书店的《围城》，他把送过货路过的每一个地方都记了下来。',
    headerLine: '每天一个真实故事，今天讲一个用八千块二手车悄悄找回爱情的丈夫',
    footerLine: '让更多在婚姻里把日子过成"中午吃啥随便外卖行"的人看到' },
  { dir: '02-我在老公手机备忘录发现一个文件夹名字叫她说的话',
    title: '我在老公手机备忘录里发现一个文件夹，名字叫"她说过的话"',
    digest: '帮他清旧手机，翻到备忘录里一个文件夹。六七十条，从2019年记到现在——她说想吃酸辣粉、她说同事老公每周买花、她说想换个大冰箱。',
    headerLine: '每天一个真实故事，今天讲一个在老公备忘录里发现自己被偷偷记了六年的人',
    footerLine: '让更多从未注意过另一半备忘录的人看到' },
  { dir: '03-开会领导问谁还有意见我举了手会议室安静十秒',
    title: '开会时领导问谁还有意见，我举了手，会议室安静了十秒',
    digest: '周五周会，组长照例问排期意见。我举了手，二十几个人安静了十秒。从那以后，老赵也开始举手，小陈也开始举手。',
    headerLine: '每天一个真实故事，今天讲一个在会议室第一个举手、然后发现大家都在等这个人的人',
    footerLine: '让更多明明有意见但开会从不开口的人看到' },
  { dir: '04-我决定不再对任何人说没事改说有事',
    title: '我决定不再对任何人说"没事"，改说"有事"',
    digest: '加班到九点半，我妈打电话问我好不好，我说"没事"。挂了电话发现自己在公司厕所哭了五天。我打开备忘录写了一句话，第二天给我妈回了电话。',
    headerLine: '每天一个真实故事，今天讲一个说了二十多年"没事"、终于开始说"有事"的人',
    footerLine: '让更多把"没事"当口头禅、其实扛不住了的人看到' },
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