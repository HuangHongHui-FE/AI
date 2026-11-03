#!/usr/bin/env node
// publish-kit：已排版正文 + 首图 GIF → copy.html + 发布物料.md
// 用法：
//   node atom/publish-kit/src/index.mjs --article article.json --html content.html --gif first.gif --out-dir 06-publish-kit [--cover cover.jpg] [--video 成品.mp4]
// stdout：{ ok, copy_html, material_md, title, short_bad_punct }

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { badShortPunct, buildCopyHtml, buildMaterialMd } from "./lib/kit.mjs";

const args = parseArgs({ known: ["article", "html", "gif", "cover", "video", "out-dir", "date", "quiet"] });

function main() {
  if (!args.article) fail("需要 --article article.json");
  if (!args.html) fail("需要 --html format-html 产出的 content.html");
  if (!args.gif) fail("需要 --gif 首图 GIF（会内嵌进 copy.html）");

  const articlePath = resolve(String(args.article));
  const htmlPath = resolve(String(args.html));
  const gifPath = resolve(String(args.gif));
  for (const [name, p] of [["article", articlePath], ["html", htmlPath], ["gif", gifPath]]) {
    if (!existsSync(p)) fail(`${name} 不存在：${p}`);
  }

  const outDir = resolve(String(args["out-dir"] || dirname(articlePath)));
  mkdirSync(outDir, { recursive: true });

  let article;
  try {
    article = JSON.parse(readFileSync(articlePath, "utf8"));
  } catch (e) {
    fail(`article.json 不是合法 JSON：${e.message}`);
  }
  const bodyHtml = readFileSync(htmlPath, "utf8");
  const gifBase64 = readFileSync(gifPath).toString("base64");

  const copyHtml = buildCopyHtml({ title: article.title || "", bodyHtml, gifBase64 });
  const copyPath = join(outDir, "copy.html");
  writeFileSync(copyPath, copyHtml);

  const coverName = args.cover && existsSync(resolve(String(args.cover))) ? basename(String(args.cover)) : "";
  const videoPath = args.video ? String(args.video) : article.video || "";
  const date = args.date ? String(args.date) : new Date().toISOString().slice(0, 10);
  const material = buildMaterialMd({
    article,
    gifPath: String(args.gif),
    coverName,
    videoPath,
    dirName: basename(outDir),
    date,
  });
  const materialPath = join(outDir, "发布物料.md");
  writeFileSync(materialPath, material);

  const shortBad = article.video_short ? badShortPunct(article.video_short) : [];
  if (!args.quiet) {
    log(`✓ copy.html ${(statSync(copyPath).size / 1024).toFixed(0)}KB → ${copyPath}`);
    log(`✓ 发布物料.md → ${materialPath}`);
    if (shortBad.length) log(`  ⚠ 短标题含平台不接受的标点：${shortBad.join(" ")}（视频号会静默不保存）`);
  }
  emit({ ok: true, copy_html: copyPath, material_md: materialPath, title: article.title || "", short_bad_punct: shortBad }, 0);
}

main();