#!/usr/bin/env node
// video-channel-draft：把成片推进微信视频号草稿箱（浏览器自动化，只存草稿，绝不发表）
// 用法：
//   node atom/video-channel-draft/src/index.mjs --video 成品.mp4 --desc "描述" --short "短标题"
// stdout：{ ok, video, short, stdout }

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "py", "vh_draft.py");
const args = parseArgs({ known: ["video", "desc", "short", "profile", "shot-dir", "quiet"] });

function main() {
  if (!args.video) fail("需要 --video 成片路径");
  if (!args.desc) fail("需要 --desc 描述");
  const video = resolve(String(args.video));
  if (!existsSync(video)) fail(`成片不存在：${video}`);

  const env = { ...process.env };
  if (args["shot-dir"]) env.VH_SHOT_DIR = String(args["shot-dir"]);

  const cli = [SCRIPT, video, "--desc", String(args.desc)];
  if (args.short) cli.push("--short", String(args.short));
  if (args.profile) cli.push("--profile", String(args.profile));

  log("▷ 发视频号草稿（会打开浏览器，首次需扫码登录）");
  const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 3600000, env });
  if (r.stdout) log(r.stdout.trim());
  if (r.stderr && r.status !== 0) log(r.stderr.trim().slice(-500));
  if (r.status !== 0) fail(`vh_draft.py 退出码 ${r.status}`);

  emit({ ok: true, video, short: args.short ? String(args.short) : "", stdout: (r.stdout || "").trim() }, 0);
}

main();