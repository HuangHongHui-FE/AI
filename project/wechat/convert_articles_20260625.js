// convert_articles_20260625.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

const BATCH_DIR = 'C:/Users/31672/AI/project/wechat/文章包/20260625';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-老公失业半年才发现他每月给我妈转2000',
    title: '老公失业半年，我才发现他每月给我妈转2000',
    digest: '失业第182天，我帮老公充话费顺手看了他账单。每月15号一笔2000，收款人备注"妈"——是我妈。',
    headerLine: '每天一个真实故事，今天讲一个老公失业半年偷偷给她妈转钱的男人',
    footerLine: '让更多在婚姻里"互相扛着不吭声"的人看到' },
  { dir: '02-38岁被裁那天HR问我去不去隔壁组',
    title: '38岁被裁那天，HR问我"要不要去隔壁组"',
    digest: '裁员会议室里，HR推来两张表。一张是解除协议，一张是隔壁组的岗位表。隔壁组leader是我三年前带的下属。',
    headerLine: '每天一个真实故事，今天讲一个38岁被裁当场被问要不要去前下属手下的女人',
    footerLine: '让更多在38岁被"分流"却没敢说出口的人看到' },
  { dir: '03-三个月没说应该之后我跟妈的关系变了',
    title: '三个月没说一句"应该"之后，我跟妈的关系变了',
    digest: '3月12号我妈电话里"嗯"一声挂了，挂前还叫我"妈"。我当晚在备忘录写下"戒应该90天"。',
    headerLine: '每天一个真实故事，今天讲一个戒掉"应该"这个词90天的人',
    footerLine: '让更多跟父母通话只剩"应该"的人看到' },
  { dir: '04-高考出分那天我表弟消失了三天',
    title: '高考出分那天，我表弟消失了三天',
    digest: '6月25号晚9点14分，舅妈打来电话。表弟582分，过了一本线70分。他发了一条全黑朋友圈，三个字"对不起"，关了手机。',
    headerLine: '每天一个真实故事，今天讲一个高考582分却消失72小时的少年',
    footerLine: '让更多家里有"考得不差也消失"的小孩的人看到' },
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
