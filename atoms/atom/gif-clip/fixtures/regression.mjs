#!/usr/bin/env node
// 回归：gif-clip 参数校验 / 本地视频切片 / GIF 产出
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "gc-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout: 120000 });

// 1. 参数校验
check("缺 --source exit 2", run(["--start", "0", "--end", "1"]).status === 2);
check("缺 --start exit 2", run(["--source", "/tmp/x.mp4", "--end", "1"]).status === 2);
check("缺 --end exit 2", run(["--source", "/tmp/x.mp4", "--start", "0"]).status === 2);
check("本地文件不存在 exit 2", run(["--source", join(work, "no.mp4"), "--start", "0", "--end", "1"]).status === 2);
check("未知参数 exit 2", run(["--source", join(work, "no.mp4"), "--start", "0", "--end", "1", "--foo", "x"]).status === 2);

// 2. 真实本地切片（需要 ffmpeg）
const probe = spawnSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
const ffmpeg = probe.status === 0 ? probe.stdout.trim() : "";
if (ffmpeg && existsSync(ffmpeg)) {
  const video = join(work, "test.mp4");
  const gen = spawnSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=320x240:d=2", "-pix_fmt", "yuv420p", video], { encoding: "utf8" });
  check("测试视频生成", gen.status === 0 && existsSync(video), gen.stderr.slice(-80));

  const outDir = join(work, "clips");
  const r = run(["--source", video, "--start", "0", "--end", "1", "--name", "test", "--out-dir", outDir, "--width", "160"]);
  check("本地切片 exit 0", r.status === 0, r.stderr.trim().slice(-100));
  const gif = join(outDir, "test.gif");
  check("产出 GIF", existsSync(gif));
  if (existsSync(gif)) {
    check("GIF 非空", statSync(gif).size > 100, `${statSync(gif).size} bytes`);
    const j = JSON.parse(r.stdout);
    check("stdout 报告文件与大小", j.ok === true && j.file === gif && j.bytes > 100);
  }
} else {
  console.log("（找不到 imageio-ffmpeg / ffmpeg，跳过真实切片）");
}

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);