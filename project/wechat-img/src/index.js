import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config, ensureDirs } from './config.js';
import { generateCover } from './cover.js';
import { markdownToHtml, fullPageHtml, ctaBlock } from './html.js';
import { uploadPermanentImage, uploadArticleImage, createDraft } from './wechat.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
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
    console.log(`用法：node src/index.js --image <path> [--from-json <path>] [--out-dir <path>] [--dry-run] [--author "<name>"] [--no-embed-image]

  --image <path>         原图路径（必填）
  --from-json <path>     文章 JSON 路径（默认 <out-dir>/article.json，由 Claude 在会话里生成）
  --out-dir <path>       输出目录（默认 output/）；每日 3 篇建议传 output/YYYY-MM-DD/NN-slug/
  --dry-run              只生成封面 + HTML 预览，不调微信 API
  --author "<name>"      覆盖 .env 里的署名
  --no-embed-image       不在正文头部嵌入原图

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

  const imagePath = args.image ? resolve(String(args.image)) : null;
  if (!imagePath || !existsSync(imagePath)) {
    console.error('错误：缺少 --image 参数或文件不存在');
    process.exit(1);
  }

  const outDir = args['out-dir'] ? resolve(String(args['out-dir'])) : join(config.paths.output);
  await mkdir(outDir, { recursive: true });

  const articlePath = args['from-json']
    ? resolve(String(args['from-json']))
    : join(outDir, 'article.json');
  if (!existsSync(articlePath)) {
    console.error(`错误：缺少文章 JSON。请先在会话里让 Claude 生成并写入 ${articlePath}，再跑此脚本。`);
    console.error(`       或用 --from-json <path> 指定其他路径。`);
    process.exit(1);
  }

  const article = JSON.parse(await readFile(articlePath, 'utf8'));
  for (const f of ['title', 'digest', 'body_markdown']) {
    if (!article[f]) {
      console.error(`错误：文章 JSON 缺少字段 ${f}`);
      process.exit(1);
    }
  }

  const author = args.author ? String(args.author) : config.author;
  const dryRun = !!args['dry-run'];
  const embedImage = args['embed-image'] !== false && config.embedOriginalImage;

  await ensureDirs();

  console.log(`[1/4] 文章已加载：${article.title}`);
  console.log(`      摘要：${article.digest}`);
  console.log(`      封面标语：${article.cover_slogan || '(无)'}`);

  console.log(`[2/4] 合成封面图...`);
  const coverPath = join(outDir, 'cover.jpg');
  await generateCover({ imagePath, slogan: article.cover_slogan || '', outPath: coverPath });

  console.log(`[3/4] 转 HTML + 写本地预览...`);
  const bodyHtml = markdownToHtml(article.body_markdown);
  const ctaHtml = ctaBlock({
    question: article.cta_question || article.cta || '',
    follow: article.cta_follow || '点 个 关 注 不 迷 路',
  });

  const previewHtml = fullPageHtml(article.title, bodyHtml, ctaHtml);
  await writeFile(join(outDir, 'article.html'), previewHtml);

  // 推到微信的内容 = 正文 + CTA（不包含外层 page 包装，微信会自己套壳）
  const contentHtml = bodyHtml + ctaHtml;

  if (dryRun) {
    console.log(`\n[dry-run] 跳过微信 API。本地产物：`);
    console.log(`  - 封面：${coverPath}`);
    console.log(`  - 文章预览：${join(outDir, 'article.html')}`);
    return;
  }

  console.log(`[4/4] 上传封面 + 写草稿箱...`);
  const { mediaId: thumbMediaId } = await uploadPermanentImage(coverPath);
  console.log(`      thumb_media_id: ${thumbMediaId}`);

  let finalContent = contentHtml;
  if (embedImage) {
    try {
      const articleImgUrl = await uploadArticleImage(imagePath);
      finalContent = `<p style="text-align:center;margin:0 0 16px;"><img src="${articleImgUrl}" style="max-width:100%;border-radius:4px;" /></p>` + finalContent;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

main().catch((e) => {
  console.error('执行失败：', e.message);
  process.exit(1);
});
