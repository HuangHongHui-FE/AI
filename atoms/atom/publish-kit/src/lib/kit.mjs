// 出物料：把已排版的正文 + 首图 GIF + 封面/成片信息拼成「打开就能复制粘贴」的两份物料
// 源：project/mingchangmian/skill/06-出物料/出物料.py（去掉对 wechat-img 的 --dry-run 依赖）

export const SHORT_ALLOWED_PUNCT = new Set([..."《》「」“”‘’：:+？%℃"]);
export const SHORT_BANNED = new Set([..."，。、；！,.;!·—～~()（）【】[]{}<>/\\|@#$^&*="]);

export function cleanShortTitle(s) {
  const out = [];
  for (const ch of s) {
    if (SHORT_ALLOWED_PUNCT.has(ch)) out.push(ch);
    else if (SHORT_BANNED.has(ch)) out.push(" ");
    else out.push(ch);
  }
  return out.join("").replace(/\s+/g, " ").trim();
}

export function badShortPunct(s) {
  return [...new Set([...s].filter((c) => SHORT_BANNED.has(c) && !SHORT_ALLOWED_PUNCT.has(c)))];
}

const IMG_TAG =
  '<p style="text-align:center;margin:0 0 16px;"><img src="data:image/gif;base64,{b64}" style="max-width:100%;border-radius:4px;" /></p>';

const COPY_PAGE = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:24px 0;background:#fff;">
<div style="max-width:677px;margin:0 auto;padding:0 16px;">{body}</div>
</body></html>`;

export function buildCopyHtml({ title, bodyHtml, gifBase64 }) {
  return COPY_PAGE.replace("{title}", title || "").replace("{body}", IMG_TAG.replace("{b64}", gifBase64) + bodyHtml);
}

const block = (text) => `\`\`\`text\n${text}\n\`\`\``;

export function buildMaterialMd({ article, gifPath, coverName, videoPath, dirName, date }) {
  const t = article.title || "";
  const lines = [
    `# 发布物料 · ${dirName}`,
    "",
    `> 日期 ${date} ｜ 目录 \`${dirName}\``,
    "> 本篇已过自查硬门；物料只准备可复制内容，推送由人手动完成。",
    "",
    "---",
    "",
    "## ① 公众号",
    "",
    "**标题**",
    "",
    block(t),
    "",
    "**摘要**",
    "",
    block(article.digest || ""),
    "",
    "**正文**",
    "",
    "浏览器打开本目录下的 `copy.html` → `Cmd+A` 全选 → `Cmd+C` 复制 → 粘进公众号编辑器。",
    "排版会一起过去，**首图 GIF 已内嵌在正文顶部，不用另外插**。",
    "",
    `首图兜底（万一粘贴掉了图）：\`${gifPath}\``,
    "",
  ];
  if (coverName) {
    lines.push("**封面**", "", `\`${coverName}\`（就在本目录，上传为封面图）`, "");
  }
  lines.push(
    "<details><summary>纯文本兜底（HTML 粘贴失败时用）</summary>",
    "",
    article.body_markdown || "",
    "",
    "</details>",
    "",
  );

  if (videoPath) {
    lines.push("---", "", "## ② 视频（视频号 / 抖音 / 快手）", "", `**成品视频**：\`${videoPath}\``, "");
    if (article.video_short) {
      const bad = badShortPunct(article.video_short);
      lines.push("**视频号 · 短标题**（不加逗号）", "", block(article.video_short), "");
      if (bad.length) {
        lines.push(
          `> ⚠️ 短标题里有平台不接受的标点：\`${bad.join(" ")}\` —— 视频号会**静默不保存**，换成空格。`,
          "",
        );
      }
    }
    if (article.video_desc) {
      lines.push("**视频号 · 描述**", "", block(article.video_desc), "");
    }
    const extra = [
      ["抖音", article.douyin],
      ["快手", article.kuaishou],
    ].filter(([, text]) => text && text !== article.video_desc);
    if (extra.length) {
      for (const [label, text] of extra) lines.push(`**${label} · 文案**`, "", block(text), "");
    } else {
      lines.push("**抖音 / 快手**：复制上面那段描述即可。", "");
    }
    lines.push("> 封面不用管：视频号会自动从视频里抽两张。", "");
  } else {
    lines.push("---", "", "> 本篇没有配套成品视频，只出公众号物料。", "");
  }

  return lines.join("\n");
}