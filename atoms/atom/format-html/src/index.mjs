#!/usr/bin/env node
// format-html：markdown 正文 → 微信正文 HTML（+ 本地预览页）
// 用法：
//   node atom/format-html/src/index.mjs --md article.md --out-dir <步骤目录> [--theme ocean]
//   node atom/format-html/src/index.mjs --md article.md --out-dir x --random --exclude ocean,warm
//   node atom/format-html/src/index.mjs --list
// 产物：<out-dir>/content.html（推微信的正文）、<out-dir>/preview.html（本地预览）
// stdout：{ ok, theme, content, preview, bytes }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { markdownToHtml, fullPageHtml, pickRandomThemeName } from "./lib/render.mjs";
import { THEME_NAMES } from "../references/themes.mjs";

const args = parseArgs({ known: ["md", "out-dir", "theme", "title", "exclude", "list"] });

// 纯文字提取：用于校验正文非空、统计字数
function plainText(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
}

async function main() {
  if (args.list) {
    emit({ ok: true, themes: THEME_NAMES, count: THEME_NAMES.length }, 0);
    return;
  }

  if (!args.md) fail("需要 --md 正文 markdown 路径");
  const mdPath = resolve(String(args.md));
  if (!existsSync(mdPath)) fail(`正文不存在：${mdPath}`);
  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (!outDir) fail("需要 --out-dir 输出目录");

  const markdown = readFileSync(mdPath, "utf8").trim();
  if (!markdown) fail("正文为空");

  // 主题：显式 --theme 优先；--random 时避开 --exclude 里的；都没有时随机
  const exclude = args.exclude ? String(args.exclude).split(",").map((s) => s.trim()) : [];
  let theme;
  if (args.theme) {
    theme = String(args.theme);
    if (!THEME_NAMES.includes(theme)) log(`⚠ 未知主题「${theme}」，将回落 minimal；可选 ${THEME_NAMES.length} 套`);
  } else {
    theme = pickRandomThemeName(exclude);
  }

  const title = args.title ? String(args.title) : "";
  const content = markdownToHtml(markdown, theme);
  const preview = fullPageHtml(title || "预览", content, theme);

  mkdirSync(outDir, { recursive: true });
  const contentPath = join(outDir, "content.html");
  const previewPath = join(outDir, "preview.html");
  writeFileSync(contentPath, content);
  writeFileSync(previewPath, preview);

  const chars = plainText(content).length;
  log(`✓ 主题=${theme} 正文 ${chars} 字 → ${contentPath}`);

  emit(
    {
      ok: true,
      theme,
      content: contentPath,
      preview: previewPath,
      chars,
      bytes: Buffer.byteLength(content, "utf8"),
      images: (content.match(/<img\b/g) || []).length,
    },
    0
  );
}

main().catch((e) => fail(e.message));
