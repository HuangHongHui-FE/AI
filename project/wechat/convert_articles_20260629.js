// convert_articles_20260629.js — 通用转换器：从 article.md 生成 payload_template.json
const fs = require('fs');
const path = require('path');

// mac 路径（原 Windows 路径已替换）
const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260629';
const STYLE = 'padding: 0 16px; font-size: 15px; color: #4a4a4a; letter-spacing: 0.5px; line-height: 1.75;';

function headerBanner(line) {
  return `<section style="text-align: center; padding: 10px 16px; margin-bottom: 1.5em; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;"><span>👆 点个</span><span style="color: #576b95; font-weight: bold;">蓝字关注</span><span>，${line}</span></section>`;
}

function footerReminder(line) {
  return `<section style="text-align: center; padding: 14px 16px; margin-top: 2em; background: #fce7f3; border-radius: 6px; font-size: 14px; color: #831843;"><p style="margin: 0 0 4px 0;">如果这个故事戳到你</p><p style="margin: 0;">点个<strong style="color: #be185d;">「在看」</strong>，${line}</p></section>`;
}

const articles = [
  { dir: '01-我录下老公的呼噜声给他听',
    title: '我录下老公的呼噜声给他听',
    digest: '6月25号凌晨两点四十，我又被吵醒。我摸黑举起iPhone，录下他四十七秒呼噜，第二天早饭放给他听。他脸红了。',
    headerLine: '每天一个真实故事，今天讲一个把老公呼噜声录下来放给他听的女人',
    footerLine: '让更多在婚姻里"忍着不说"的人看到' },
  { dir: '02-结婚十二年我第一次自己过生日',
    title: '结婚十二年我第一次自己过生日',
    digest: '6月29号我38岁生日，他在深圳出差。我没等，自己订了蛋糕，备注"不要蜡烛"。下午他发来一句生日快乐，我回了谢谢啊。',
    headerLine: '每天一个真实故事，今天讲一个结婚十二年第一次自己过生日的女人',
    footerLine: '让更多被"期待"绑了十年的人看到' },
  { dir: '03-离职那天我把工位的绿植搬回了家',
    title: '离职那天我把工位的绿植搬回了家',
    digest: '6月27号下午五点办完交接，我抱着那盆跟了三年的绿萝走出公司。它换过三个工位，比我先适应了新家，长出新叶。',
    headerLine: '每天一个真实故事，今天讲一个离职把工位绿萝搬回家的运营',
    footerLine: '让更多在工位和家之间搬来搬去的人看到' },
  { dir: '04-我开始给自己写悼词',
    title: '我开始给自己写悼词',
    digest: '6月20号老领导突然走了，我在备忘录新建"我的悼词"。写了三版才明白，我想被记住的不是工作。那晚对一个追半年的晋升松了手。',
    headerLine: '每天一个真实故事，今天讲一个开始给自己写悼词的人',
    footerLine: '让更多不知道"这辈子图什么"的人看到' },
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
