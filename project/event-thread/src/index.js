#!/usr/bin/env node
/**
 * 事件梳理 → 公众号草稿箱。
 *
 * 用法：
 *   node src/index.js --facts facts/<slug>.json --image <封面图> [--parts 3] [--dry-run]
 *
 * 流程：
 *   [1] 读事实卡 → 跑 preflight 事实核查硬门（不过直接退，不许推）
 *   [2] 由事实卡确定性渲染正文（不重新生成 = 发布内容就是已核查内容）
 *   [3] 按节点切分单篇/多篇，多篇推成独立草稿，标题带（上/中/下）
 *   [4] 合成封面 + 上传内文图 + 写草稿箱
 *
 * 配图与封面复用 wechat-img 的 cover.js / wechat.js（零改动拷贝）。
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { config } from "./config.js";
import { generateCover } from "./cover.js";
import { markdownToHtml } from "./html.js";
import { renderTimeline, splitPhases, splitByParts, partSuffix, buildPartTitle, validateEvent, PART_LABELS } from "./facts.js";
import {
  uploadPermanentImage,
  uploadArticleImage,
  createDraft,
  getAccessToken,
} from "./wechat.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    } else args._.push(a);
  }
  return args;
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 单篇正文：本篇概述 + 本篇时间线 + 结尾。
// 2026-09-30 定：不写任何导航语（「本文是第X篇」「时间跨度」「本篇时间范围」都不写），
// 结尾也不写「以上为……截止X的进展，事件仍在发展中」这类模板套话。
// 每篇的结尾由 parts[].closing 手写——针对这段内容做的总结、或一句有分量的话，
// 而不是代码拼出来的、放到任何事件上都成立的空话。
function buildBody(ev, nodes, partIdx, totalParts, partSummary, partClosing, theme) {
  const out = [];

  // 分篇时用 parts[].summary（本篇概述）；单篇或没写时退回全事件 summary
  const intro = totalParts > 1 ? partSummary : ev.summary;
  if (intro) {
    out.push(intro);
    out.push("");
    out.push("---", "");
  }

  out.push(renderTimeline(nodes, theme));

  // 结尾：优先用手写的 closing；没有就宁可不写，也不套模板话
  const closing = partClosing || (totalParts <= 1 ? ev.closing : "");
  if (closing) {
    out.push("");
    out.push("---");
    out.push("");
    out.push(closing);
  }
  return out.join("\n");
}

// 摘要。分篇时优先用 parts[].digest（每篇专属，读者在列表里能分辨是哪一篇）；
// 没写就用总摘要截断——但三篇会雷同，仅在实在没有专属摘要时兜底
function buildDigest(ev, nodes, partIdx, totalParts, partDigest) {
  if (partDigest) return partDigest.replace(/\s+/g, " ").slice(0, 120);
  const base = ev.summary.replace(/\s+/g, " ").slice(0, 100);
  return totalParts > 1 ? `第${partIdx + 1}/${totalParts}篇：${base}` : base;
}

// 把 markdown 里的本地图片路径上传到微信，替换成微信 URL。
// wechat-img 的 index.js 有这一步，移植时漏了——导致正文内文图全是本地相对路径，
// 微信读不到，草稿里只有手动嵌的封面首图能显示（2026-09-30 实踩）。
//
// 另外：封面图会被自动嵌到正文顶部，正文里若再引用同一张，开局就重复。
// 命中 coverPath 的图直接从正文移除（封面已在顶部展示，内容不丢）。
async function uploadInlineImages(bodyMd, coverPath) {
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const inline = [];
  const missing = [];
  let out = bodyMd;
  let dupCount = 0;
  let m;
  while ((m = imgRe.exec(bodyMd))) {
    if (/^https?:\/\//.test(m[2])) continue; // 已是网络图，跳过
    const abs = resolve(m[2]);
    if (!existsSync(abs)) {
      missing.push(m[2]);
      continue;
    }
    // 与封面同图 → 从正文剔除（连同其后空行），避免开局首图重复
    if (coverPath && abs === coverPath) {
      out = out.replace(new RegExp(`${escapeRe(m[0])}\\n*`), "");
      dupCount++;
      continue;
    }
    inline.push({ orig: m[0], path: abs, alt: m[1] });
  }

  for (const u of inline) {
    try {
      const url = await uploadArticleImage(u.path);
      out = out.replace(u.orig, `![${u.alt}](${url})`);
      console.log(`      ✓ 内文图已上传: ${u.path.split("/").pop()}`);
    } catch (e) {
      console.warn(`      内文图上传失败 ${u.path.split("/").pop()}: ${e.message}`);
    }
  }
  return { bodyMd: out, count: inline.length, missing, dupCount };
}

// 正则转义：图片 markdown 里的 ( ) [ ] 都是元字符，直接拼进 RegExp 会出错
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 取一篇里第一张存在的内文图绝对路径，用作该篇封面（用户 2026-09-30 定：每篇封面不同）。
// 逐节点按顺序找，返回第一个文件真实存在的；都找不到返回 null，由调用方兜底
function firstImageOf(nodes) {
  for (const n of nodes) {
    for (const im of n.images || []) {
      const abs = resolve(im.src);
      if (existsSync(abs)) return abs;
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`用法：node src/index.js --facts <facts/<slug>.json> --image <封面图> [选项]

  --facts <path>       事实卡 JSON（必填）
  --image <path>       封面图（必填）
  --parts <n>          分几篇推（默认 1；长事件可 2-3，标题自动加【上】【中】【下】前缀）
  --part <n>           只推第 n 篇（1 起）。默认全部推。用于分篇逐篇确认后发
  --out-dir <path>     输出目录（默认 result/YYYY-MM-DD/<slug>/）
  --dry-run            只核查 + 生成预览，不调微信 API
  --author "<name>"    覆盖署名
  --theme <name>       指定主题配色（默认 cool）

事实卡结构见 skills/ 与 facts/_template.json。`);
    process.exit(0);
  }

  const factsPath = args.facts ? resolve(String(args.facts)) : null;
  if (!factsPath || !existsSync(factsPath)) {
    console.error("错误：缺少 --facts 参数或文件不存在");
    process.exit(1);
  }
  const imagePath = args.image ? resolve(String(args.image)) : null;
  if (!imagePath || !existsSync(imagePath)) {
    console.error("错误：缺少 --image 参数或封面图不存在");
    process.exit(1);
  }

  const ev = JSON.parse(await readFile(factsPath, "utf8"));
  const today = todayStr();

  // [1] 事实核查硬门：spawn 独立进程，物理跳不过
  console.log(`[1/5] 事实核查（${ev.name || factsPath}）...`);
  const pfRes = spawnSync(process.execPath, [join(ROOT, "src/preflight.js"), factsPath], {
    stdio: "inherit",
  });
  if (pfRes.status !== 0) {
    console.error("\n✗ 事实核查未通过，拒推草稿。补齐来源或修正日期后重跑。");
    process.exit(1);
  }

  const parts = Math.max(1, parseInt(args.parts || "1", 10));
  // 优先用事实卡里定义的 parts（按叙事边界切，带专属标题）；没有才退回按节点数均分
  const byParts = splitByParts(ev.nodes, ev);
  const chunks = byParts || splitPhases(ev.nodes, parts).map((nodes) => ({ nodes, title: null }));
  if (!byParts && chunks.length < parts) {
    console.warn(
      `⚠ 只切出 ${chunks.length} 篇（请求 ${parts} 篇）——节点仅 ${ev.nodes.length} 个，不够均分。先补节点或减少 --parts。`,
    );
  }
  const date = today;
  const outDir = args["out-dir"]
    ? resolve(String(args["out-dir"]))
    : join(ROOT, "result", date, ev.slug);
  await mkdir(outDir, { recursive: true });
  const dryRun = !!args["dry-run"];
  const author = args.author ? String(args.author) : config.author;
  const theme = args.theme ? String(args.theme) : ev.theme || "cool";

  console.log(`[2/5] 由事实卡渲染正文（确定性，不重新生成）...`);
  console.log(`      共 ${ev.nodes.length} 个节点 → 切成 ${chunks.length} 篇`);

  // [3] 逐篇生成封面：每篇用它自己正文里的第一张图，不再全篇共用一个封面。
  // 取图顺序：分篇时用该篇首图；找不到就退回 --image（单篇或该篇无图时兜底）
  console.log(`[3/5] 逐篇合成封面...`);
  for (let i = 0; i < chunks.length; i++) {
    const first = firstImageOf(chunks[i].nodes);
    const src = first || imagePath;
    const cp = join(outDir, `cover-${i + 1}.jpg`);
    await generateCover({ imagePath: src, slogan: "", outPath: cp, style: "plain" });
    console.log(`      第 ${i + 1} 篇封面：${src.replace(ROOT + "/", "")}${first ? "" : "（该篇无图，用 --image 兜底）"}`);
  }

  console.log("[4/5] 渲染分篇正文...");
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const title = buildPartTitle(ev, chunk.title, i, chunks.length);
    const bodyMd = buildBody(ev, chunk.nodes, i, chunks.length, chunk.summary, chunk.closing, theme);
    const digest = buildDigest(ev, chunk.nodes, i, chunks.length, chunk.digest);
    const articlePath = join(outDir, `article-${i + 1}.json`);
    await writeFile(
      articlePath,
      JSON.stringify({ title, digest, body_markdown: bodyMd, theme }, null, 2),
      "utf8",
    );
    const bodyHtml = markdownToHtml(bodyMd, theme);
    await writeFile(join(outDir, `article-${i + 1}.html`), bodyHtml, "utf8");
    results.push({ idx: i, title, digest, bodyMd, bodyHtml, articlePath });
    console.log(`      第 ${i + 1} 篇：${title}（${chunk.nodes.length} 节点）`);
  }

  if (dryRun) {
    console.log(`\n[dry-run] 跳过微信 API。本地产物：`);
    console.log(`  - 封面：${coverPath}`);
    for (const r of results) console.log(`  - 预览：${join(outDir, `article-${r.idx + 1}.html`)}`);
    console.log(`  登录前可用浏览器打开预览核对时间线与排版。`);
    return;
  }

  // 只推指定篇（--part N）：其余篇仍照常渲染落盘，只是不进草稿箱。
  // 用于分篇逐篇确认的场景——先推第 1 篇看效果，满意再推后面
  let toPush = results;
  if (args.part) {
    const want = parseInt(String(args.part), 10);
    const hit = results.find((r) => r.idx + 1 === want);
    if (!hit) {
      console.error(`错误：--part ${args.part} 超出范围（共 ${results.length} 篇）`);
      process.exit(1);
    }
    toPush = [hit];
    console.log(`      仅推第 ${want} 篇（其余 ${results.length - 1} 篇已落盘但不上传）`);
  }

  // [5] 推草稿：多篇 = 多个独立草稿（用户 2026-09-29 定）
  console.log(`[5/5] 上传封面 + 写草稿箱...`);
  await getAccessToken(); // 提前取 token，失败时不必等封面传完

  for (const r of toPush) {
    // 每篇用自己的封面（第 r.idx+1 张）
    const myCover = join(outDir, `cover-${r.idx + 1}.jpg`);
    if (!existsSync(myCover)) {
      console.error(`✗ 找不到第 ${r.idx + 1} 篇的封面：${myCover}`);
      process.exit(1);
    }
    const { mediaId: thumbMediaId } = await uploadPermanentImage(myCover);

    // 内文图上传：把 markdown 里的本地路径换成微信 URL 后再转 HTML。
    // 本地 article-N.html 保留相对路径（浏览器能直接打开），推给微信的用这套替换后的 HTML。
    // coverPath 传 null：封面不再是正文里的某张图，无需去重（正文不嵌封面图了）
    const up = await uploadInlineImages(r.bodyMd, null);
    if (up.missing.length) {
      console.error(`\n✗ 硬拦截：第 ${r.idx + 1} 篇正文引用了 ${up.missing.length} 张不存在的图：`);
      for (const p of up.missing) console.error(`    - ${p}`);
      console.error(`  多半是用户删图后事实卡的 images 没重新对齐。请 ls 该目录确认后重跑。\n`);
      process.exit(1);
    }
    if (up.count) console.log(`      第 ${r.idx + 1} 篇内文图 ${up.count} 张`);

    // 正文不再自动嵌入封面首图（用户 2026-09-30 定：文章不以图片开头）。
    // 封面只作公众号列表页的缩略图，正文直接从文字/概述进内容
    const content = markdownToHtml(up.bodyMd, theme);

    const draftId = await createDraft({
      title: r.title,
      author,
      digest: r.digest,
      content,
      thumbMediaId,
    });
    // 进度按「本次要推的总数」计，而非全部分篇数——只推第 1 篇时不应显示 1/3
    console.log(`      ✓ 草稿 ${toPush.indexOf(r) + 1}/${toPush.length}：${r.title}  media_id: ${draftId}`);
  }

  // 报数用 toPush.length（本次实际推送数），不用 results.length（渲染总数）——两者在 --part 下不等
  console.log(`\n✓ 本次推送 ${toPush.length} 篇草稿，登录 mp.weixin.qq.com → 草稿箱 查看。`);
  if (results.length > toPush.length) {
    console.log(`  另有 ${results.length - toPush.length} 篇已渲染落盘但未上传（本次用了 --part）。`);
  }
  if (results.length > 1) {
    console.log(`  提示：分篇草稿是独立的，发布时按（上/中/下）顺序逐篇发，草稿箱里可长按调整。`);
  }
}

main().catch((e) => {
  console.error("执行失败：", e.message);
  process.exit(1);
});
