#!/usr/bin/env node
// 赛事分析稿发布：没有封面就用内图裁 900x383 → 传内图 → 推草稿（有 meta.json 则原地更新）
// 用法：node publish.mjs <文章目录> [<文章目录2> ...] [--dry-run]
import dotenv from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 允许在 sportsty/ 目录下直接跑：显式读仓库根的 .env（必须在引入 config/wechat 之前）
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const sharp = (await import("sharp")).default;
const { uploadPermanentImage, uploadArticleImage, createDraft, updateDraft } =
  await import("../src/wechat.js");

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const dirs = args.filter((a) => !a.startsWith("--")).map((d) => resolve(d));
if (!dirs.length) {
  console.error("用法：node publish.mjs <文章目录> [--dry-run]");
  process.exit(1);
}

for (const dir of dirs) {
  const a = JSON.parse(await readFile(join(dir, "article.json"), "utf8"));
  let html = a.html;
  const imgs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);

  // 封面：没有就取 cover_from（默认内图）裁 900x383
  const coverPath = join(dir, a.cover || "cover.jpg");
  if (!existsSync(coverPath)) {
    await sharp(join(dir, a.cover_from || "media.jpg"))
      .resize(900, 383, { fit: "cover", position: "attention" })
      .jpeg({ quality: 90 })
      .toFile(coverPath);
    console.log(`✓ 封面 ${a.cover || "cover.jpg"}（由 ${a.cover_from || "media.jpg"} 裁切）`);
  }

  if (dry) {
    const preview = `<!doctype html><meta charset="utf-8"><title>${a.title}</title>
<body style="margin:0;background:#ededed"><div style="max-width:677px;margin:0 auto;background:#fff;padding:24px 20px;font-family:-apple-system,'PingFang SC',sans-serif">
<h1 style="font-size:22px;line-height:1.4;margin:0 0 20px">${a.title}</h1>${a.html}</div></body>`;
    await writeFile(join(dir, "article.html"), preview, "utf8");
    console.log(`[dry-run] ${join(dir, "article.html")}`);
    continue;
  }

  for (const src of imgs) {
    if (/^https?:/.test(src)) continue;
    const url = await uploadArticleImage(join(dir, src));
    html = html.split(`src="${src}"`).join(`src="${url}"`);
    console.log(`✓ 内文图 ${src}`);
  }

  const metaPath = join(dir, "meta.json");
  const prevId = existsSync(metaPath)
    ? JSON.parse(await readFile(metaPath, "utf8")).media_id
    : null;
  const { mediaId: thumb } = await uploadPermanentImage(coverPath);
  const payload = {
    title: a.title,
    author: a.author || "雨神",
    digest: a.digest,
    content: html,
    thumbMediaId: thumb,
  };
  const mediaId = prevId
    ? await updateDraft({ mediaId: prevId, ...payload })
    : await createDraft(payload);
  await writeFile(
    metaPath,
    JSON.stringify({ media_id: mediaId, title: a.title, pushed_at: new Date().toISOString() }, null, 2),
    "utf8",
  );
  console.log(`✓ 草稿已${prevId ? "更新" : "生成"}：${a.title} → ${mediaId}`);
}
