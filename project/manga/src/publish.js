import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { config, ensureDirs } from "./config.js";
import { markdownToHtml, fullPageHtml, ctaBlock, pickRandomThemeName } from "../../wechat-img/src/html.js";
import { uploadPermanentImage, uploadArticleImage, createDraft } from "./wechat.js";

// 漫画推草稿入口：读 article.json + 扫 body_markdown 多图上传 + 封面 + createDraft
// 复用 wechat-img 的 html.js（无状态），wechat.js 已拷到本目录（token 缓存隔离到 manga/cache）
// 用法见 --help

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
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
    console.log(`用法：node src/publish.js --image <封面图> --from-json <article.json> [选项]

--image <path>         封面图路径（必填，通常 comics/<slug>/01.jpg）
--from-json <path>     文章 JSON 路径（必填，由 Claude 会话生成）
--out-dir <path>       输出目录（默认 output/YYYY-MM-DD/NN-slug/）
--dry-run              只产预览 HTML，不调微信 API
--author "<name>"      覆盖 .env 里的署名
--embed-image          在正文头部嵌入首图（默认不嵌，漫画首格即首图，避免重复）

article.json 结构：
{
  "title": "...",
  "digest": "...",
  "slug": "<slug>",               // comics/<slug>/ 出图目录名
  "panels": [...],                // 分镜，draw.js 渲染成 comics/<slug>/01..NN.jpg（见 src/draw.js 构件库）
  "body_markdown": "引子\\n\\n![第1格](comics/<slug>/01.jpg)\\n\\n...\\n\\n收口",
  "line": "A|B",                  // A=少字看图(10-200字) B=长文叙事(300-1500字)
  "theme": "主题名",              // 可选，不填则随机抽（避同质化）
  "cta_question": "...",
  "cta_follow": "...",
  "original_eligible": true      // false=搬运/非自绘，仅常规发表不可勾原创
}`);
    process.exit(0);
  }

  const imagePath = args.image ? resolve(String(args.image)) : null;
  if (!imagePath || !existsSync(imagePath)) {
    console.error("错误：缺少 --image 参数或文件不存在");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outDir = args["out-dir"]
    ? resolve(String(args["out-dir"]))
    : join(config.paths.output, today, args.slug ? String(args.slug) : "draft");
  await mkdir(outDir, { recursive: true });

  const articlePath = args["from-json"]
    ? resolve(String(args["from-json"]))
    : join(outDir, "article.json");
  if (!existsSync(articlePath)) {
    console.error(`错误：缺少文章 JSON：${articlePath}，先让 Claude 生成。`);
    process.exit(1);
  }

  const article = JSON.parse(await readFile(articlePath, "utf8"));
  for (const f of ["title", "digest", "body_markdown"]) {
    if (!article[f]) {
      console.error(`错误：文章 JSON 缺少字段 ${f}`);
      process.exit(1);
    }
  }

  // 推草稿前硬门：内嵌 preflight，FAIL 拒推（物理跳不过，仿 wechat-img index.js:135-149）
  const pfPath = resolve("src/preflight.js");
  if (!existsSync(pfPath)) {
    console.error(`✗ 找不到 preflight 脚本：${pfPath}`);
    process.exit(1);
  }
  const pfRes = spawnSync(process.execPath, [pfPath, articlePath], { stdio: "inherit" });
  if (pfRes.status !== 0) {
    console.error("\n✗ preflight 硬门未过，拒推草稿——回炉改对应段落再扫。");
    process.exit(1);
  }
  console.log("      ✓ preflight 硬门已过，进入推送流程");

  const author = args.author ? String(args.author) : config.author;
  const dryRun = !!args["dry-run"];
  // 漫画默认不嵌首图（首格即首图，重复嵌会双图）；需嵌则显式 --embed-image
  const embedImage = args["embed-image"] === true;

  await ensureDirs();
  console.log(`[1/4] 文章已加载：${article.title}`);
  console.log(`      线：${article.line || "(未指定，preflight 按 B 线判)"} / 摘要：${article.digest}`);

  // 主题：显式优先；否则随机（避同质化，复用热点号主题池）
  const theme = article.theme || pickRandomThemeName([]);
  console.log(`[2/4] 主题：${theme}`);

  // 内文漫画图：扫 body_markdown 的本地图片路径，按顺序上传为微信正文图 URL 替换
  let bodyMd = article.body_markdown;
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const inlineImgs = [];
  let mm;
  while ((mm = imgRe.exec(bodyMd))) {
    if (/^https?:\/\//.test(mm[2])) continue; // 网络 URL 不处理
    const abs = resolve(mm[2]);
    if (existsSync(abs)) inlineImgs.push({ orig: mm[0], path: abs, alt: mm[1] });
  }
  if (!dryRun && inlineImgs.length) {
    console.log(`      漫画图 ${inlineImgs.length} 张待上传`);
    for (const u of inlineImgs) {
      try {
        const url = await uploadArticleImage(u.path);
        bodyMd = bodyMd.replace(u.orig, `![${u.alt}](${url})`);
        console.log(`      ✓ ${u.path.split("/").pop()} 已上传`);
      } catch (e) {
        console.warn(`      图上传失败 ${u.path.split("/").pop()}: ${e.message}`);
      }
    }
  }

  console.log(`[3/4] 转 HTML + 写本地预览...`);
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

  if (dryRun) {
    console.log(`\n[dry-run] 跳过微信 API。本地产物：`);
    console.log(`  - 预览：${join(outDir, "article.html")}`);
    return;
  }

  console.log(`[4/4] 上传封面 + 写草稿箱...`);
  const { mediaId: thumbMediaId } = await uploadPermanentImage(imagePath);
  console.log(`      thumb_media_id: ${thumbMediaId}`);

  let finalContent = bodyHtml + ctaHtml;
  if (embedImage) {
    try {
      const articleImgUrl = await uploadArticleImage(imagePath);
      finalContent =
        `<p style="text-align:center;margin:0 0 16px;"><img src="${articleImgUrl}" style="max-width:100%;border-radius:4px;" /></p>` +
        finalContent;
    } catch (e) {
      console.warn(`      首图嵌入失败，跳过：${e.message}`);
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
  if (article.original_eligible !== false)
    console.log(`  ★ 此篇可勾「漫画」原创：发布时勾原创声明并选漫画类目（API 不支持，须人手点）。`);
}

main().catch((e) => {
  console.error("执行失败：", e.message);
  process.exit(1);
});
