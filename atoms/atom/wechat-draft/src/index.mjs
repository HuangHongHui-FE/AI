#!/usr/bin/env node
// wechat-draft：把一段已排好版的微信正文 HTML + 封面图推成公众号草稿
// 用法：
//   node atom/wechat-draft/src/index.mjs --html body.html --cover cover.jpg --title "标题" \
//        --account wechatimg --out-dir <步骤目录> [--dry-run] [--digest 摘要] [--author 署名]
//   node atom/wechat-draft/src/index.mjs --html body.html --cover cover.jpg --title "标题" --verify   # 只验 token
// 输出：<out-dir>/result.json（media_id / 上传明细）；stdout 打印同一份 JSON

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { loadEnv } from "../../../_shared/env.mjs";
import { resolveAccount } from "../../../_shared/accounts.mjs";
import { nowIso } from "../../../_shared/time.mjs";
import { uploadPermanentImage, createDraft, verifyToken } from "./lib/wechat-api.mjs";
import { collectImages, findMissing, findCoverClash, uploadAndReplace, prependCoverImage } from "./lib/body.mjs";
import { clearTokenCache } from "./lib/token.mjs";

const args = parseArgs({ known: ["html", "cover", "title", "digest", "author", "account", "out-dir", "dry-run", "verify", "clear-token", "cache-dir", "allow-missing-img", "embed-cover"] });

// 凭据上下文：账号、缓存目录（由参数传入，atom 不自行决定位置）
// 只在真正要调微信接口时才调用——dry-run 与缺图/撞脸等本地校验不需要凭据
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

// 读必需文件，缺失以 exit 2 结束（环境/参数错误，不是业务失败）
function requireFile(p, label) {
  const abs = resolve(String(p));
  if (!existsSync(abs)) fail(`${label} 不存在：${abs}`);
  return abs;
}

// 把结果落 result.json 并输出
function finish(outDir, result, code) {
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
  }
  emit(result, code);
}

async function main() {
  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;

  // --verify：只验证 token 可用性，供发布前预检（42001 过期、40164 IP 白名单）
  // 这里必须凭据，所以单独解析
  if (args.verify) {
    const ctx = buildCtx();
    const v = await verifyToken(ctx);
    finish(outDir, { ok: v.ok, account: ctx.alias, step: "verify-token", ...v, at: nowIso() }, v.ok ? 0 : 1);
    return;
  }

  // --clear-token：清掉该账号的 token 缓存后退出
  if (args["clear-token"]) {
    const ctx = buildCtx();
    clearTokenCache(ctx.cacheDir, ctx.alias);
    finish(outDir, { ok: true, account: ctx.alias, step: "clear-token", at: nowIso() }, 0);
    return;
  }

  const htmlPath = requireFile(args.html, "--html 正文 HTML");
  const coverPath = requireFile(args.cover, "--cover 封面图");
  const title = String(args.title || "").trim();
  if (!title) fail("需要 --title 标题（草稿标题不能为空）");

  const html = readFileSync(htmlPath, "utf8");
  const images = collectImages(html);

  // 封面撞脸硬拦：正文不得引用封面同一文件
  const clash = findCoverClash(images, coverPath);
  if (clash.length) {
    fail(
      `正文引用了封面文件（${clash.map((c) => basename(c.abs)).join("、")}）——封面已用该图，正文再引=开局首图撞脸，请删掉正文里的对应引用`
    );
  }

  // 缺图硬拦：用户删图后未重新对齐会命中此处（静默跳过会推出无内文文章）
  const missing = findMissing(images);
  if (missing.length && !args["allow-missing-img"]) {
    fail(`正文引用了 ${missing.length} 张不存在的图：${missing.join("、")}（确认后用 --allow-missing-img 跳过）`);
  }
  const present = images.filter((it) => existsSync(it.abs));

  const dryRun = Boolean(args["dry-run"]);
  const embedCover = Boolean(args["embed-cover"]);

  if (dryRun) {
    finish(
      outDir,
      {
        ok: true,
        dry_run: true,
        // dry-run 不解析凭据，账号名仅用于回显
        account: String(args.account || "default"),
        title,
        cover: coverPath,
        images: present.map((it) => basename(it.abs)),
        missing: missing.length,
        at: nowIso(),
      },
      0
    );
    return;
  }

  // 真推才解析凭据：缺图/撞脸/dry-run 都在此之前完成，新环境可先验本地链路
  const ctx = buildCtx();

  log(`[1/3] 上传正文图 ${present.length} 张…`);
  const up = await uploadAndReplace(ctx, html, present);
  let content = up.html;
  if (embedCover) {
    const { url } = await uploadPermanentImage(ctx, coverPath, "封面图");
    content = prependCoverImage(url) + content;
  }

  log(`[2/3] 上传封面素材…`);
  const cover = await uploadPermanentImage(ctx, coverPath);

  log(`[3/3] 写草稿箱…`);
  const mediaId = await createDraft(ctx, {
    title,
    author: args.author ? String(args.author) : undefined,
    digest: args.digest ? String(args.digest) : undefined,
    content,
    thumbMediaId: cover.mediaId,
  });
  log(`✓ 草稿已生成：media_id=${mediaId}`);

  finish(
    outDir,
    {
      ok: true,
      account: ctx.alias,
      title,
      draft_media_id: mediaId,
      thumb_media_id: cover.mediaId,
      cover_url: cover.url,
      images_uploaded: up.uploaded,
      images_failed: up.failed,
      at: nowIso(),
    },
    0
  );
}

main().catch((e) => {
  log(`[ERROR] ${e.message}`);
  process.exit(1);
});
