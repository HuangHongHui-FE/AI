#!/usr/bin/env node
// find-image 原子入口：批量找图，下 ≥目标张数到指定目录并写清单
// 用法：
//   node atom/find-image/src/index.mjs --subject "徽剑" --event "反诈博主遇害" --out-dir <目录> [--target 20]
//   node atom/find-image/src/index.mjs --subject "某事件" --history          # 历史事件，关掉新鲜度门
//   node atom/find-image/src/index.mjs --query "热搜原词" --url <图片地址> --out <路径>   # 单张

import { resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { findImages, writeManifestMd } from "./lib/finder.mjs";
import { downloadAsJpeg, saveJpeg } from "./lib/imaging.mjs";
import { bingCandidates } from "./lib/sources.mjs";
import { validateImageManifest } from "../../../_shared/schema/index.mjs";
import { nowIso } from "../../../_shared/time.mjs";

const args = parseArgs();

// 单张模式：只取一张图（封面兜底场景），优先用指定 URL，否则搜第一张
async function singleImage() {
  const query = args.query || args._[0];
  if (!query) fail("单张模式需要 --query 关键词");
  const outPath = args.out ? resolve(String(args.out)) : null;
  if (!outPath) fail("单张模式需要 --out 输出路径");

  let url = args.url ? String(args.url) : null;
  if (!url) {
    const cands = await bingCandidates(String(query), { pages: [1] });
    url = cands[0]?.url;
    if (!url) {
      log("必应未找到候选");
      emit({ ok: false, error: "NO_IMAGE" }, 1);
    }
  }

  const got = await downloadAsJpeg(url, "https://cn.bing.com/");
  if (!got) {
    log(`下载失败：${url}`);
    emit({ ok: false, error: "DOWNLOAD_FAILED", url }, 1);
  }
  saveJpeg(got.buf, resolve(outPath, ".."), outPath.split("/").pop());
  log(`✓ ${outPath} ${got.w}x${got.h}`);
  emit({ ok: true, file: outPath, w: got.w, h: got.h, url });
}

// 批量模式入口
async function batch() {
  const subject = String(args.subject || args._[0] || "");
  const event = String(args.event || args._[1] || "");
  if (!subject) fail("需要 --subject 主体词（如「徽剑」）");

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (!outDir) fail("需要 --out-dir 输出目录");

  const target = Number(args.target || 20);
  const history = Boolean(args.history);
  const maxAgeMonths = Number(args["max-age-months"] || 3);
  const startedAt = nowIso();

  log(`开始找图：主体「${subject}」事件「${event || "无"}」目标 ${target} 张${history ? "（历史模式，不卡新鲜度）" : ""}`);

  const result = await findImages({ subject, event, outDir, target, history, maxAgeMonths });
  const mdPath = result.count ? writeManifestMd(result, outDir) : null;

  // 落结构化清单，供下游 cover-image / wechat-draft 读取
  const manifest = {
    generated_at: nowIso(),
    query: { subject, event, target, history },
    count: result.count,
    images: result.images,
    skipped_no_date: result.skipped_no_date || 0,
    dup_skipped: result.dup_skipped || 0,
    keywords: result.keywords || [],
  };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const v = validateImageManifest(manifest);
  if (!v.ok) log(`⚠ 输出不符合 image manifest 契约：${v.errors.join("; ")}`);

  log(`\n完成：${result.count} 张 → ${outDir}`);
  if (mdPath) log(`清单：${mdPath}`);

  if (result.count === 0) {
    emit({ ...manifest, ok: false, error: "NO_IMAGES_FOUND" }, 1);
  }
  emit({ ...manifest, ok: true, started_at: startedAt });
}

// 单张模式判定：有 --query + --out 且没有 --subject 时走单张
const isSingle = !args.subject && (args.out || args.url);

(isSingle ? singleImage() : batch()).catch((e) => fail(e.message));
