import { readFile, writeFile } from "node:fs/promises";
import { marked } from "marked";
import { uploadArticleImage, createDraft, getAccessToken } from "./src/wechat.js";
import { config } from "./src/config.js";

const ROOT = "/Users/hongenhuang/code/self/AI/project/wechat-img";
const REPORT_MD =
  "/Users/hongenhuang/code/self/AI/try/bettafish-skill/result/2026-10-27_2304_mbappe/report.md";
const COVER = `${ROOT}/input/20261027-01-姆巴佩事件/028-cover-2.35.jpg`;
const INLINE = `${ROOT}/input/20261027-01-姆巴佩事件/026-bus-ad-clean.jpg`;
const UPDATE_DRAFT_ID =
  "UOp6-P6dC_6DCRmUv1cIoPoSXgHzft6HDrkrDDBei_Cb0ls6uFa9GOWF86cEu1-d";
const COVER_MEDIA_ID =
  "UOp6-P6dC_6DCRmUv1cIoCVIYhn5-yWFkwmkqK_ADvsYLvlrirXFPGSOtfbdieMv";
const DRY = process.argv.includes("--dry");

const S = {
  h1: "font-size:26px;line-height:1.35;color:#0a192f;margin:0 0 14px;font-weight:700;letter-spacing:.5px;",
  h2: "font-size:21px;line-height:1.45;color:#0a192f;margin:38px 0 14px;padding-top:18px;border-top:1px solid #d9c98a;font-weight:700;letter-spacing:.5px;",
  h3: "font-size:17px;line-height:1.5;color:#112240;margin:24px 0 10px;padding-left:10px;border-left:3px solid #c9a227;font-weight:700;",
  p: "margin:0 0 16px;color:#333;font-size:16px;line-height:1.85;text-align:justify;letter-spacing:.3px;",
  bqP: "margin:0;color:#555;font-size:15px;line-height:1.8;text-align:justify;",
  strong: "color:#0a192f;background-color:#fff3cd;padding:0 2px;border-radius:2px;font-weight:700;",
  blockquote: "margin:18px 0;padding:14px 16px;background:#faf7ee;border-left:3px solid #c9a227;",
  ul: "margin:0 0 16px;padding-left:22px;color:#333;",
  ol: "margin:0 0 16px;padding-left:22px;color:#333;",
  li: "margin:0 0 8px;line-height:1.8;font-size:16px;color:#333;",
  table: "width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;line-height:1.6;table-layout:fixed;",
  th: "background:#0a192f;color:#fff;font-weight:600;text-align:left;padding:8px 10px;border:1px solid #0a192f;font-size:13px;",
  td: "padding:8px 10px;border:1px solid #e2dccb;color:#333;vertical-align:top;font-size:13px;word-break:break-word;",
  hr: "border:0;border-top:1px solid #e6e0d2;margin:30px 0;",
  code: "background:#f2efe6;color:#8a6d1d;padding:1px 4px;border-radius:3px;font-size:13px;",
  img: "width:100%;display:block;border-radius:3px;",
};

let md = await readFile(REPORT_MD, "utf8");
// 去掉 Markdown 里的标题和元信息，改用自定义报头
md = md.replace(/^# .*\n\n> .*\n> .*\n\n/, "");
// 去掉会暴露生成流程/AI 工具痕迹的附录与校验表
md = md.replace(/\n## 八、数据附录[\s\S]*$/, "");
md = md.replace(/\n### ForumEngine 三轮校验[\s\S]*?(?=\n## 四、)/, "");
md = md.replace("## 一、报告摘要", "## 一、核心摘要");
md = md.replace(/本报告/g, "本文");
// 涉政表述按公众号规范处理
md = md.replace(/毛泽东/g, "中国领导人");
md = md.replace("片段列为“未核实”。", "该片段目前仍未获独立核实。");
// 在“当前态势”前插入一张内文图占位
md = md.replace(
  "### 当前态势",
  "![印有姆巴佩和补水啦广告的公交车](__INLINE_IMAGE__)\n\n### 当前态势",
);

let html = marked.parse(md, { gfm: true, breaks: false });

const styleTag = (tag, style, attrs = "") => {
  const re = new RegExp(`<${tag}${attrs}>`, "g");
  html = html.replace(re, `<${tag}${attrs} style="${style}">`);
};

// 基础标签内联样式（微信会剥掉 class/style 块，必须内联）
styleTag("h1", S.h1);
styleTag("h2", S.h2);
styleTag("h3", S.h3);
styleTag("p", S.p);
styleTag("strong", S.strong);
styleTag("blockquote", S.blockquote);
styleTag("ul", S.ul);
styleTag("ol", S.ol);
styleTag("li", S.li);
styleTag("table", S.table);
styleTag("th", S.th);
styleTag("td", S.td);
styleTag("hr", S.hr);
styleTag("code", S.code);
html = html.replace(
  /<img([^>]*)>/g,
  (_m, attrs) =>
    attrs.includes("style=") ? `<img${attrs}>` : `<img${attrs} style="${S.img}">`,
);

// 表格 th 可能带 align 属性
html = html.replace(/<th align="([^"]+)">/g, `<th align="$1" style="${S.th}">`);
html = html.replace(/<td align="([^"]+)">/g, `<td align="$1" style="${S.td}">`);

// 引用块内段落用更柔和的样式
html = html.replace(
  /<blockquote style="([^"]*)">([\s\S]*?)<\/blockquote>/g,
  (_m, s, inner) =>
    `<blockquote style="${s}">${inner.replace(
      /<p style="[^"]*">/g,
      `<p style="${S.bqP}">`,
    )}</blockquote>`,
);

const hero = `
<section style="font-family:-apple-system,BlinkMacSystemFont,'Songti SC','Noto Serif SC',Georgia,serif;color:#2c3440;font-size:16px;line-height:1.85;letter-spacing:.3px;max-width:100%;margin:0 auto;padding:0 2px;">
  <div style="font-size:11px;letter-spacing:3px;color:#b8860b;text-transform:uppercase;margin-bottom:12px;">PUBLIC OPINION REPORT · 2026-10-27</div>
  <h1 style="${S.h1}margin-bottom:12px;">姆巴佩涉华言论事件：48小时危机全景</h1>
  <p style="font-size:15px;color:#5b6472;line-height:1.8;margin:0 0 18px;text-align:justify;">一段在海外平台流传的播客片段，在48小时内触发微博6.21亿阅读、30余个热搜、8家以上品牌解约、央视停播与足协交涉；最终以本人中英法三语道歉、西甲联盟致歉收束——而皇家马德里至今未作正式回应。</p>
  <div style="border-top:1px solid #d9c98a;border-bottom:1px solid #d9c98a;padding:8px 0;font-size:12px;color:#7a8394;letter-spacing:.5px;">2026年10月27日 · 事件复盘</div>
</section>`;

const kpi = `
<table style="width:100%;border-collapse:collapse;margin:22px 0 6px;table-layout:fixed;">
  <tr>
    <td style="width:50%;padding:12px;background:#faf7ee;border:1px solid #eee5cf;vertical-align:top;">
      <div style="font-size:24px;line-height:1.2;color:#b8860b;font-weight:700;">6.21亿</div>
      <div style="font-size:12px;color:#7a8394;margin-top:4px;">微博相关话题全站阅读量</div>
    </td>
    <td style="width:50%;padding:12px;background:#faf7ee;border:1px solid #eee5cf;vertical-align:top;">
      <div style="font-size:24px;line-height:1.2;color:#b8860b;font-weight:700;">30+</div>
      <div style="font-size:12px;color:#7a8394;margin-top:4px;">微博热搜话题，前十一半相关</div>
    </td>
  </tr>
  <tr>
    <td style="padding:12px;background:#faf7ee;border:1px solid #eee5cf;vertical-align:top;">
      <div style="font-size:24px;line-height:1.2;color:#b8860b;font-weight:700;">48h</div>
      <div style="font-size:12px;color:#7a8394;margin-top:4px;">从片段流出到三语道歉</div>
    </td>
    <td style="padding:12px;background:#faf7ee;border:1px solid #eee5cf;vertical-align:top;">
      <div style="font-size:24px;line-height:1.2;color:#b8860b;font-weight:700;">~38%</div>
      <div style="font-size:12px;color:#7a8394;margin-top:4px;">中国市场占其全球商业收入</div>
    </td>
  </tr>
</table>`;

const footer = `
<div style="margin-top:36px;padding-top:14px;border-top:1px solid #e6e0d2;font-size:12px;color:#9aa2b1;line-height:1.7;">
  数据截至 2026年10月27日（北京时间）。
</div>`;

let content = hero + kpi + html + footer;

function wrapInlineImage(content) {
  const imgStart = content.indexOf('<img src="__INLINE_IMAGE__"');
  if (imgStart === -1) return content;
  const pStart = content.lastIndexOf("<p ", imgStart);
  const pEnd = content.indexOf("</p>", imgStart) + 4;
  const imgEnd = content.indexOf(">", imgStart) + 1;
  const imgTag = content.slice(imgStart, imgEnd);
  const fig = `<div style="margin:18px 0;padding:0;">${imgTag}<p style="font-size:12px;color:#9aa2b1;text-align:center;margin:6px 0 0;line-height:1.6;">印有姆巴佩和「补水啦」广告的公交车</p></div>`;
  return content.slice(0, pStart) + fig + content.slice(pEnd);
}

// 内文图：先上传再替换占位
if (!DRY) {
  const inlineUrl = await uploadArticleImage(INLINE);
  content = content.replace(/__INLINE_IMAGE__/g, inlineUrl);
}
content = wrapInlineImage(content);

const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff;">${content}</body></html>`;
await writeFile("/tmp/mbappe_report_wx.html", page, "utf8");

if (DRY) {
  console.log("dry: /tmp/mbappe_report_wx.html");
  process.exit(0);
}

const TITLE = "姆巴佩涉华言论事件：48小时危机全景";
const DIGEST =
  "一段在海外平台流传的播客片段，48小时内触发6.21亿阅读、8家品牌解约、央视停播；本人三语道歉，皇马仍未回应。";

const token = await getAccessToken();
const updateRes = await fetch(
  `https://api.weixin.qq.com/cgi-bin/draft/update?access_token=${token}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_id: UPDATE_DRAFT_ID,
      index: 0,
      articles: {
        title: TITLE,
        author: config.author || "",
        digest: DIGEST,
        content,
        content_source_url: "",
        thumb_media_id: COVER_MEDIA_ID,
        need_open_comment: 1,
        only_fans_can_comment: 0,
      },
    }),
  },
);
const updateData = await updateRes.json();
console.log("draft update:", JSON.stringify(updateData));

if (updateData.errcode) {
  // 更新失败则新建，再删掉旧草稿
  const newId = await createDraft({
    title: TITLE,
    author: undefined,
    digest: DIGEST,
    content,
    thumbMediaId: COVER_MEDIA_ID,
  });
  console.log("new draft media_id:", newId);
  const del = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/delete?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: UPDATE_DRAFT_ID }),
    },
  );
  console.log("old draft delete:", JSON.stringify(await del.json()));
} else {
  console.log("updated draft media_id:", UPDATE_DRAFT_ID);
}
