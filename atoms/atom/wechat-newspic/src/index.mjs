#!/usr/bin/env node
// wechat-newspic：把一组图片 + 文案推成公众号「图片消息」（贴图/小绿书）草稿
// 用法：
//   node atom/wechat-newspic/src/index.mjs --title "标题" --images-dir 贴图/20261030/ --body body.md --cover cover.jpg --account dychatimg --out-dir <步骤目录>
//   node atom/wechat-newspic/src/index.mjs --title "标题" --images-dir x/ --body-file b.md --dry-run
// 关键：images 张数由目录里剩下的图决定（用户删图后目录即事实来源），不读草稿 JSON 里的期望数
// stdout：{ ok, media_id, images:[], account }

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { loadEnv } from "../../../_shared/env.mjs";
import { resolveAccount } from "../../../_shared/accounts.mjs";
import { sniffFile } from "../../../_shared/sniff.mjs";
import { nowIso } from "../../../_shared/time.mjs";
import { uploadPermanentImage, createNewspicDraft } from "./lib/api.mjs";

const args = parseArgs();

// 凭据上下文：账号 + token 缓存目录（由参数传入，atom 不自行决定位置）
function buildCtx() {
  loadEnv();
  let account;
  try {
    account = resolveAccount(args.account);
  } catch (e) {
    fail(e.message);
  }
  return {
    appId: account.appId,
    appSecret: account.appSecret,
    alias: account.alias,
    cacheDir: resolve(String(args["cache-dir"] || ".cache/wechat-token")),
  };
}

// 列目录图片：排除隐藏文件与 manifest，按文件名自然排序（001/002/... 顺序即展示顺序）
function listImages(dir) {
  return readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith(".") && !/^manifest\.(json|md)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "zh", { numeric: true }))
    .map((f) => join(dir, f));
}

async function main() {
  const ctx = buildCtx();
  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  const title = String(args.title || "").trim();
  if (!title) fail("需要 --title 标题");

  if (!args["images-dir"]) fail("需要 --images-dir 图片目录");
  const imagesDir = resolve(String(args["images-dir"]));
  if (!existsSync(imagesDir)) fail(`图片目录不存在：${imagesDir}`);

  const files = listImages(imagesDir);
  if (!files.length) fail(`目录里没有图片：${imagesDir}`);

  // §封面：--cover 显式指定，否则取目录第一张（与源实现一致）
  const coverPath = args.cover ? resolve(String(args.cover)) : files[0];
  if (!existsSync(coverPath)) fail(`封面不存在：${coverPath}`);

  // 文案：--body 直接给文本，或 --body-file 读文件
  let body = args.body ? String(args.body) : "";
  if (args["body-file"]) {
    const p = resolve(String(args["body-file"]));
    if (!existsSync(p)) fail(`文案文件不存在：${p}`);
    body = readFileSync(p, "utf8").trim();
  }
  const digest = args.digest ? String(args.digest) : body.slice(0, 54);

  // 格式体检：扩展名 jpg 但实际是 webp/png 会被微信拒（40137）
  const badFormat = files.map((f) => ({ f, fmt: sniffFile(f) })).filter((x) => !x.fmt);
  if (badFormat.length) fail(`${badFormat.length} 张图不是合法图片格式：${badFormat.map((x) => basename(x.f)).join("、")}`);

  if (args["dry-run"]) {
    const result = {
      ok: true,
      dry_run: true,
      account: ctx.alias,
      title,
      digest,
      cover: coverPath,
      images: files.map((f) => basename(f)),
      count: files.length,
      at: nowIso(),
    };
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
    }
    emit(result, EXIT.OK);
    return;
  }

  log(`[1/3] 上传 ${files.length} 张正文图…`);
  const mediaIds = [];
  for (const f of files) {
    const id = await uploadPermanentImage(ctx, f);
    mediaIds.push(id);
    log(`      ✓ ${basename(f)} → ${id}`);
  }

  // 封面若就是正文第一张（默认情况），直接复用已上传的 media_id——
  // 永久素材一次上传即得，重复上传只是白占素材库额度
  const coverIdx = files.indexOf(coverPath);
  let thumb;
  if (coverIdx >= 0) {
    thumb = mediaIds[coverIdx];
    log(`[2/3] 封面复用正文图 ${basename(coverPath)} → ${thumb}`);
  } else {
    log(`[2/3] 上传封面 ${basename(coverPath)}…`);
    thumb = await uploadPermanentImage(ctx, coverPath);
  }

  log(`[3/3] 写图片消息草稿…`);
  const mediaId = await createNewspicDraft(ctx, {
    title,
    digest,
    content: body,
    thumbMediaId: thumb,
    imageMediaIds: mediaIds,
  });
  log(`✓ 草稿已生成：media_id=${mediaId}`);

  const result = {
    ok: true,
    account: ctx.alias,
    title,
    media_id: mediaId,
    thumb_media_id: thumb,
    count: files.length,
    images: files.map((f, i) => ({ file: basename(f), media_id: mediaIds[i] })),
    at: nowIso(),
  };
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
  }
  emit(result, EXIT.OK);
}

main().catch((e) => {
  log(`[ERROR] ${e.message}`);
  process.exit(1);
});
