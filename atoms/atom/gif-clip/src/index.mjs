#!/usr/bin/env node
// gif-clip：视频 URL/本地文件 + 时间段 → GIF（yt-dlp 下载片段 / ffmpeg 两遍调色板）
// 用法：
//   node atom/gif-clip/src/index.mjs --source "https://www.bilibili.com/video/BV..." --start 47 --end 53 --name 018-高三八班 --out-dir input/clips
//   node atom/gif-clip/src/index.mjs --source ./素材.mp4 --start 01:35 --end 01:41 --out-dir out
// stdout：{ ok, file, bytes }

import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "py", "gif_clip.py");

const args = parseArgs({
  known: ["source", "start", "end", "name", "out-dir", "fps", "width", "cookies-from-browser", "cookies", "quiet"],
});

function main() {
  if (!args.source) fail("需要 --source 视频 URL 或本地文件");
  if (args.start == null) fail("需要 --start 开始时间（秒 / MM:SS / HH:MM:SS）");
  if (args.end == null) fail("需要 --end 结束时间");

  const source = String(args.source);
  const isUrl = /^https?:\/\//i.test(source);
  if (!isUrl && !existsSync(resolve(source))) fail(`本地视频不存在：${resolve(source)}`);

  const outDir = resolve(String(args["out-dir"] || process.cwd()));
  mkdirSync(outDir, { recursive: true });
  const name = String(args.name || "clip");
  const gif = join(outDir, `${name}.gif`);

  const cli = [SCRIPT, source, String(args.start), String(args.end), name, "--out-dir", outDir];
  if (args.fps) cli.push("--fps", String(args.fps));
  if (args.width) cli.push("--width", String(args.width));
  if (args["cookies-from-browser"]) cli.push("--cookies-from-browser", String(args["cookies-from-browser"]));
  if (args.cookies) cli.push("--cookies", String(args.cookies));

  const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 600000 });
  if (r.error) fail(`执行 gif_clip.py 失败：${r.error.message}`);
  if (r.stdout) log(r.stdout.trim());
  if (r.status !== 0) fail(`gif_clip.py 退出码 ${r.status}：${(r.stderr || "").trim().slice(-300)}`);
  if (!existsSync(gif)) fail(`未产出 GIF：${gif}`);

  const bytes = statSync(gif).size;
  log(`✓ ${gif}（${(bytes / 1024).toFixed(0)} KB）`);
  emit({ ok: true, file: gif, bytes }, 0);
}

main();