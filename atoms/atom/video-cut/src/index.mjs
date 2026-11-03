#!/usr/bin/env node
// video-cut：名场面固定四段剪辑（钩子段 → 标题卡 → 正文 → 关注卡）
// 用法：
//   node atom/video-cut/src/index.mjs --mode single --source 素材/018.mp4 --title "高三八班、全体起立" --hook-range 47-53 --cta 成品/004-xxx.mp4 --media-root 名场面
//   node atom/video-cut/src/index.mjs --mode batch --media-root 名场面 [--only 019,020] [--force] [--plan]
// stdout：{ ok, mode, file? , stdout }

import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SINGLE = join(HERE, "py", "剪辑模板.py");
const BATCH = join(HERE, "py", "批量剪.py");

const args = parseArgs({
  known: ["mode", "source", "title", "hook-range", "cta", "out", "out-dir", "media-root", "music", "font", "only", "force", "plan", "quiet"],
});

const mediaRoot = resolve(String(args["media-root"] || process.cwd()));
const env = { ...process.env, VIDEO_CUT_MEDIA_ROOT: mediaRoot };
if (args.font) env.VIDEO_CUT_FONT = String(args.font);

function resolveMedia(p) {
  return isAbsolute(p) ? p : join(mediaRoot, p);
}

function main() {
  const mode = String(args.mode || "single");

  if (mode === "batch") {
    mkdirSync(join(mediaRoot, "成品"), { recursive: true });
    const cli = [BATCH];
    if (args.only) cli.push("--only", String(args.only));
    if (args.force) cli.push("--force");
    if (args.plan) cli.push("--plan");
    const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 3600000, env });
    if (r.stdout) log(r.stdout.trim());
    if (r.status !== 0) fail(`批量剪退出码 ${r.status}：${(r.stderr || "").trim().slice(-300)}`);
    emit({ ok: true, mode: "batch", media_root: mediaRoot, plan: Boolean(args.plan), stdout: (r.stdout || "").trim() }, 0);
    return;
  }

  if (mode !== "single") fail("--mode 只能是 single / batch");
  if (!args.source) fail("需要 --source 源视频");
  if (!args.title) fail("需要 --title 标题卡文字");
  if (!args["hook-range"]) fail("需要 --hook-range 钩子段（如 47-53）");

  const src = resolveMedia(String(args.source));
  if (!existsSync(src)) fail(`源视频不存在：${src}`);
  const cta = args.cta ? resolveMedia(String(args.cta)) : null;
  if (cta && !existsSync(cta)) fail(`关注卡视频不存在：${cta}`);

  const out = args.out
    ? resolveMedia(String(args.out))
    : join(mediaRoot, "成品", basename(src));
  mkdirSync(dirname(out), { recursive: true });

  const cli = [SINGLE, src, String(args.title), out, "--hook-range", String(args["hook-range"])];
  if (cta) cli.push("--cta", cta);
  if (args.music) cli.push("--music", resolveMedia(String(args.music)));

  const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 3600000, env });
  if (r.stdout) log(r.stdout.trim());
  if (r.status !== 0) fail(`剪辑模板退出码 ${r.status}：${(r.stderr || "").trim().slice(-300)}`);
  if (!existsSync(out)) fail(`未产出成品：${out}`);

  const bytes = statSync(out).size;
  log(`✓ ${out}（${(bytes / 1024 / 1024).toFixed(1)} MB）`);
  emit({ ok: true, mode: "single", file: out, bytes }, 0);
}

main();