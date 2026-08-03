import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config, ensureDirs } from "./config.js";
import { generateCover, pickRandomCoverStyle } from "./cover.js";
import { markdownToHtml, fullPageHtml, ctaBlock, pickRandomThemeName } from "./html.js";
import {
  uploadPermanentImage,
  uploadArticleImage,
  createDraft,
} from "./wechat.js";

// 纯文字封面布局（无底图时用，cover.js #16）
const PURE_TEXT_COVER = "pure-color-no-image";

// 读 logs 取近 N 篇已用 theme，供随机去重
function readRecentThemes(n = 5) {
  const dir = "logs";
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
  } catch {
    return [];
  }
  const re = /theme\s*记录[^：]*：\s*([0-9]+[a-zA-Z]+(?:\/[0-9]+[a-zA-Z]+)*)/g;
  const all = [];
  for (const f of files) {
    try {
      const txt = readFileSync(join(dir, f), "utf8");
      let m;
      while ((m = re.exec(txt))) {
        all.push(...m[1].split("/").map((s) => s.replace(/^[0-9]+/, "")));
      }
    } catch {
      // 单文件读失败跳过
    }
    if (all.length >= n) break;
  }
  return all.slice(-n);
}

// 读 logs 取近 N 篇已用封面布局，供随机去重
function readRecentCoverStyles(n = 5) {
  const dir = "logs";
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
  } catch {
    return [];
  }
  const re = /cover_style\s*记录\(供下批避撞\)：\s*\d+\s+(\S+)/g;
  const all = [];
  for (const f of files) {
    try {
      const txt = readFileSync(join(dir, f), "utf8");
      let m;
      while ((m = re.exec(txt))) all.push(m[1].replace(/[。].*$/, ""));
    } catch {
      // 单文件读失败跳过
    }
    if (all.length >= n) break;
  }
  return all.slice(-n);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`用法：node src/index.js [--image <path>] [--subject "<公司名>"] [--from-json <path>] [--out-dir <path>] [--dry-run] [--author "<name>"] [--no-embed-image]

  --subject "<公司名>"  公司名（信息性，正文来自 article.json）
  --image <path>        封面底图路径（可选；无图时封面走纯文字布局）
  --from-json <path>    文章 JSON 路径（默认 <out-dir>/article.json，由 Claude 在会话里生成）
  --out-dir <path>      输出目录（默认 output/）
  --dry-run             只生成封面 + HTML 预览，不调微信 API
  --author "<name>"     覆盖 .env 里的署名
  --no-embed-image      不在正文头部嵌图

JSON 结构：
  {
    "title": "...",
    "digest": "...",
    "cover_slogan": "...",
    "body_markdown": "...",
    "cta_question": "...",
    "cta_follow": "..."
  }`);
    process.exit(0);
  }

  // 封面底图可选：无图走纯文字封面
  const imagePath = args.image ? resolve(String(args.image)) : null;
  if (imagePath && !existsSync(imagePath)) {
    console.error(`错误：--image 文件不存在：${imagePath}`);
    process.exit(1);
  }
  const hasCoverImage = !!imagePath;

  const outDir = args["out-dir"]
    ? resolve(String(args["out-dir"]))
    : join(config.paths.output);
  await mkdir(outDir, { recursive: true });

  const articlePath = args["from-json"]
    ? resolve(String(args["from-json"]))
    : join(outDir, "article.json");
  if (!existsSync(articlePath)) {
    console.error(
      `错误：缺少文章 JSON。请先在会话里让 Claude 按 skills/intro-publish.md 生成并写入 ${articlePath}，再跑此脚本。`,
    );
    console.error(`       或用 --from-json <path> 指定其他路径。`);
    process.exit(1);
  }

  const article = JSON.parse(await readFile(articlePath, "utf8"));
  for (const f of ["title", "digest", "body_markdown"]) {
    if (!article[f]) {
      console.error(`错误：文章 JSON 缺少字段 ${f}`);
      process.exit(1);
    }
  }

  // 推草稿前硬门：强制内嵌 preflight，FAIL 拒推
  const { spawnSync } = await import("node:child_process");
  const pfPath = resolve("src/preflight.js");
  if (!existsSync(pfPath)) {
    console.error(`✗ 找不到 preflight 脚本：${pfPath}`);
    process.exit(1);
  }
  const pfRes = spawnSync(process.execPath, [pfPath, articlePath], {
    stdio: "inherit",
  });
  if (pfRes.status !== 0) {
    console.error(
      "\n✗ preflight 硬门未过，拒推草稿——回炉改对应段落再扫，不可跳过。",
    );
    process.exit(1);
  }
  console.log("      ✓ preflight 硬门已过，进入推送流程");

  const author = args.author ? String(args.author) : config.author;
  const dryRun = !!args["dry-run"];
  const embedImage = hasCoverImage && args["embed-image"] !== false && config.embedOriginalImage;

  await ensureDirs();

  console.log(`[1/4] 文章已加载：${article.title}`);
  console.log(`      摘要：${article.digest}`);
  console.log(`      封面标语：${article.cover_slogan || "(无)"}`);
  console.log(`      封面底图：${hasCoverImage ? imagePath : "(无，走纯文字封面)"}`);

  console.log(`[2/4] 合成封面图...`);
  const coverPath = join(outDir, "cover.jpg");
  // 封面布局：无底图强制纯文字；有图则显式指定优先，否则随机抽避开近 5 篇
  let coverStyle = article.cover_style || null;
  if (!hasCoverImage) {
    coverStyle = PURE_TEXT_COVER;
    console.log(`      纯文字封面布局：${coverStyle}`);
  } else if (!coverStyle) {
    const exclude = readRecentCoverStyles(5);
    coverStyle = pickRandomCoverStyle(exclude);
    console.log(
      `      随机封面布局：${coverStyle}${exclude.length ? `（避开近 ${exclude.length} 篇 ${exclude.join("/")}）` : ""}`,
    );
  }
  await generateCover({
    imagePath: imagePath || "",
    slogan: article.cover_slogan || "",
    outPath: coverPath,
    style: coverStyle,
  });

  console.log(`[3/4] 转 HTML + 写本地预览...`);
  // 主题：显式指定优先；否则随机抽避开近 5 篇已用（去同质化）
  let theme = article.theme || null;
  if (!theme) {
    const exclude = readRecentThemes(5);
    theme = pickRandomThemeName(exclude);
    console.log(
      `      随机主题：${theme}${exclude.length ? `（避开近 ${exclude.length} 篇 ${exclude.join("/")}` : ""}`,
    );
  }
  // 把随机抽到的 theme/cover_style 写回 article.json，供 Claude 写日志记实际所用值
  await writeFile(articlePath, JSON.stringify({ ...article, theme, cover_style: coverStyle }, null, 2), "utf8");

  // 内文插图：扫描 body_markdown 里的本地图片路径，上传为微信正文图 URL 替换
  let bodyMd = article.body_markdown;
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let mm;
  const inlineImgs = [];
  while ((mm = imgRe.exec(bodyMd))) {
    if (/^https?:\/\//.test(mm[2])) continue; // 网络 URL 不处理
    const abs = resolve(outDir, mm[2]);
    if (existsSync(abs))
      inlineImgs.push({ orig: mm[0], path: abs, alt: mm[1] });
  }
  if (!dryRun && inlineImgs.length) {
    console.log(`      内文图 ${inlineImgs.length} 张待上传`);
    for (const u of inlineImgs) {
      try {
        const url = await uploadArticleImage(u.path);
        bodyMd = bodyMd.replace(u.orig, `![${u.alt}](${url})`);
        console.log(`      ✓ 内文图已上传: ${u.path.split("/").pop()}`);
      } catch (e) {
        console.warn(
          `      内文图上传失败 ${u.path.split("/").pop()}: ${e.message}`,
        );
      }
    }
  }

  const bodyHtml = markdownToHtml(bodyMd, theme);
  const ctaHtml = ctaBlock(
    {
      question: article.cta_question || article.cta || "",
      follow: article.cta_follow || "点 个 关 注 不 迷 路",
      title: article.title || "",
    },
    theme,
  );

  const previewHtml = fullPageHtml(article.title, bodyHtml, ctaHtml, theme);
  await writeFile(join(outDir, "article.html"), previewHtml);

  // 推到微信的内容 = 正文 + CTA（不包含外层 page 包装，微信会自己套壳）
  const contentHtml = bodyHtml + ctaHtml;

  if (dryRun) {
    console.log(`\n[dry-run] 跳过微信 API。本地产物：`);
    console.log(`  - 封面：${coverPath}`);
    console.log(`  - 文章预览：${join(outDir, "article.html")}`);
    return;
  }

  console.log(`[4/4] 上传封面 + 写草稿箱...`);
  const { mediaId: thumbMediaId } = await uploadPermanentImage(coverPath);
  console.log(`      thumb_media_id: ${thumbMediaId}`);

  let finalContent = contentHtml;
  if (embedImage) {
    try {
      const articleImgUrl = await uploadArticleImage(imagePath);
      finalContent =
        `<p style="text-align:center;margin:0 0 16px;"><img src="${articleImgUrl}" style="max-width:100%;border-radius:4px;" /></p>` +
        finalContent;
    } catch (e) {
      console.warn(`      正文图片上传失败，跳过：${e.message}`);
    }
  }

  const draftMediaId = await createDraft({
    title: article.title,
    author,
    digest: article.digest,
    content: finalContent,
    thumbMediaId,
  });
  console.log(`\n✓ 草稿已生成。media_id: ${draftMediaId}`);
  console.log(`  登录 mp.weixin.qq.com → 草稿箱 查看并发布。`);
}

main().catch((e) => {
  console.error("执行失败：", e.message);
  process.exit(1);
});
