#!/usr/bin/env node
// 回归：copyright-check 参数校验 / 三项硬指标判定 / JSON 输出
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "cc-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout: 120000 });

// 1. 参数校验
check("缺 --video exit 2", run([]).status === 2);
check("视频不存在 exit 2", run(["--video", join(work, "no.mp4")]).status === 2);
check("未知参数 exit 2", run(["--video", join(work, "no.mp4"), "--foo", "x"]).status === 2);

// 2. 真实视频指标
const probe = spawnSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
const ffmpeg = probe.status === 0 ? probe.stdout.trim() : "";
if (ffmpeg && existsSync(ffmpeg)) {
  const video = join(work, "v.mp4");
  const gen = spawnSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=green:s=160x120:d=3", "-pix_fmt", "yuv420p", video], { encoding: "utf8" });
  check("测试视频生成", gen.status === 0 && existsSync(video), gen.stderr.slice(-80));

  // 原片占比 66% → FAIL
  const bad = run(["--video", video, "--clip", "1,1", "--speech-sec", "2"]);
  check("超占比判失败 exit 1", bad.status === 1);
  const badJson = JSON.parse(bad.stdout);
  check("超占比 ok=false", badJson.ok === false);
  check("识别原片占比", badJson.clip_ratio > 0.6, `${(badJson.clip_ratio * 100).toFixed(1)}%`);
  check("有 FAIL 原因", badJson.fails.some((f) => f.includes("原片占比")));

  // 原片占比 3.3%、解说 66% → PASS
  const good = run(["--video", video, "--clip", "0.1", "--speech-sec", "2"]);
  check("达标判通过 exit 0", good.status === 0, good.stderr.trim().slice(-80));
  const goodJson = JSON.parse(good.stdout);
  check("达标 ok=true", goodJson.ok === true);
  check("最长单镜头", Math.abs(goodJson.longest_clip - 0.1) < 0.001);
  check("无 FAIL", goodJson.fails.length === 0);

  // 不传 clip/speech → WARN，不能算全过
  const partial = run(["--video", video]);
  check("未校验项判失败 exit 1", partial.status === 1);
  check("未校验项记 WARN", JSON.parse(partial.stdout).warns.length >= 2);
} else {
  console.log("（找不到 imageio-ffmpeg / ffmpeg，跳过真实视频判定）");
}

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);