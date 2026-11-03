#!/usr/bin/env node
// wechat-browser-draft：操作浏览器把稿子推进公众号草稿箱（不走 API，不受 IP 白名单限制）
// 用法：
//   node atom/wechat-browser-draft/src/index.mjs --mode create --article article.json [--head-image x.gif] [--author 署名]
//   node atom/wechat-browser-draft/src/index.mjs --mode fix --keyword "标题关键词" --article article.json
//   node atom/wechat-browser-draft/src/index.mjs --mode list
//   node atom/wechat-browser-draft/src/index.mjs --mode cleanup --keep "标题关键词"
// stdout：{ ok, mode, stdout }

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "py");
const SCRIPTS = {
  create: "mp_draft.py",
  fix: "fix_draft.py",
  list: "list_drafts.py",
  cleanup: "cleanup_dupes.py",
};

const args = parseArgs({
  known: ["mode", "article", "author", "head-image", "keyword", "keep", "shot-dir", "no-save", "profile", "quiet"],
});

const env = { ...process.env };
if (args["shot-dir"]) env.MP_SHOT_DIR = String(args["shot-dir"]);
if (args.profile) env.MP_PROFILE = String(args.profile);

function main() {
  if (!args.mode) fail("需要 --mode create|fix|list|cleanup|check");
  const mode = String(args.mode);

  if (mode === "check") {
    const r = spawnSync("python3", ["-c", "import playwright; print('playwright ok')"], { encoding: "utf8" });
    if (r.status !== 0) fail(`Python playwright 不可用：${(r.stderr || "").trim().slice(-200)}（pip install playwright && playwright install chromium）`);
    log(r.stdout.trim());
    emit({ ok: true, mode, stdout: r.stdout.trim() }, 0);
    return;
  }

  if (!SCRIPTS[mode]) fail("--mode 只能是 create / fix / list / cleanup / check");

  if (mode === "create" || mode === "fix") {
    if (!args.article) fail(`${mode} 模式需要 --article article.json`);
    const article = resolve(String(args.article));
    if (!existsSync(article)) fail(`article.json 不存在：${article}`);
    args.article = article;
    if (mode === "fix" && !args.keyword) fail("fix 模式需要 --keyword 草稿标题关键词");
  }
  if (mode === "cleanup" && !args.keep) fail("cleanup 模式需要 --keep 标题关键词");

  const script = join(PY, SCRIPTS[mode]);
  const cli = [script];
  if (mode === "create") {
    cli.push(String(args.article));
    if (args.author) cli.push("--author", String(args.author));
    if (args["head-image"]) cli.push("--head-image", resolve(String(args["head-image"])));
    if (args["no-save"]) cli.push("--no-save");
  } else if (mode === "fix") {
    cli.push(String(args.keyword), String(args.article));
    if (args["head-image"]) cli.push("--head-image", resolve(String(args["head-image"])));
  } else if (mode === "cleanup") {
    cli.push("--keep", String(args.keep));
  }

  log(`▷ ${mode}：${SCRIPTS[mode]}（会打开浏览器，首次需扫码登录）`);
  const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 3600000, env });
  if (r.stdout) log(r.stdout.trim());
  if (r.stderr && r.status !== 0) log(r.stderr.trim().slice(-500));
  if (r.status !== 0) fail(`${SCRIPTS[mode]} 退出码 ${r.status}`);

  emit({ ok: true, mode, stdout: (r.stdout || "").trim() }, 0);
}

main();