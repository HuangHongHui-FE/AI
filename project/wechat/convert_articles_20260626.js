// convert_articles_20260626.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260626';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我把老公的游戏账号改了密码',
    title: '我把老公的游戏账号改了密码',
    digest: '他打了六年《魔兽》，我趁他倒水的半分钟把密码改了。凌晨两点，书房传来一声摔鼠标的闷响。',
    headerLine: '每天一个真实故事，今天讲一个把老公游戏账号改了密码的女人',
    footerLine: '让更多在婚姻里"同屋不同频"的人看到' },
  { dir: '02-同事被裁后开了一家陪诊工作室',
    title: '同事被裁后，开了一家"陪诊"工作室',
    digest: '5月18号，李姐发朋友圈"代陪诊，200一次"。没人当真。直到她找我借三百。',
    headerLine: '每天一个真实故事，今天讲一个被裁后开"陪诊"工作室的女人',
    footerLine: '让更多累到不敢跟父母说"我病了"的人看到' },
  { dir: '03-我开始每周给自己写一封辞职信',
    title: '我开始每周给自己写一封"辞职信"',
    digest: '4月7号周一晚上十一点四十二分，我在备忘录新建了一个文件夹叫"辞职档案"，第一封辞的是"每周日晚上焦虑到失眠的我"。',
    headerLine: '每天一个真实故事，今天讲一个每周给自己写一封辞职信的人',
    footerLine: '让更多被自己给自己加的"岗位"压住的人看到' },
  { dir: '04-中考分流后我侄子主动选了职高',
    title: '中考分流后，我侄子主动选了职高',
    digest: '581分，够得上重点普高，他填了机电职高。6月25号晚9点10分，我哥打电话来，声音抖："你侄子疯了。"',
    headerLine: '每天一个真实故事，今天讲一个中考581分却主动填了职高的少年',
    footerLine: '让更多家里有"够得上普高却选了职高"的小孩的人看到' },
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
