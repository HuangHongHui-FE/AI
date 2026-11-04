// ffmpeg 定位、探测、执行。优先环境变量，其次 imageio-ffmpeg，最后 PATH。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

let cached = null;

export function ffmpegPath() {
  if (cached) return cached;
  const env = process.env.FFMPEG_PATH;
  if (env && existsSync(env)) return (cached = env);
  for (const python of ["python3", "python"]) {
    const py = spawnSync(
      python,
      ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
      { encoding: "utf8" }
    );
    if (py.status === 0) {
      const p = py.stdout.trim();
      if (p && existsSync(p)) return (cached = p);
    }
  }
  const which = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (which.status === 0) return (cached = "ffmpeg");
  throw new Error("找不到 ffmpeg：请安装 imageio-ffmpeg，或把 ffmpeg 放进 PATH，或设 FFMPEG_PATH");
}

export function hasFilter(name) {
  const p = spawnSync(ffmpegPath(), ["-hide_banner", "-filters"], { encoding: "utf8" });
  const text = `${p.stdout || ""}\n${p.stderr || ""}`;
  return new RegExp(`\\b${name}\\b`).test(text);
}

export function hasEncoder(name) {
  const p = spawnSync(ffmpegPath(), ["-hide_banner", "-encoders"], { encoding: "utf8" });
  return (p.stdout || "").includes(` ${name} `);
}

export function run(args, { timeout = 3600000, label = "ffmpeg" } = {}) {
  const p = spawnSync(ffmpegPath(), ["-y", "-hide_banner", ...args], {
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (p.error) throw new Error(`${label} 执行失败：${p.error.message}`);
  if (p.status !== 0) {
    const tail = (p.stderr || "").trim().slice(-1500);
    throw new Error(`${label} 退出码 ${p.status}：${tail}`);
  }
  return p;
}

export function probe(file) {
  const p = spawnSync(ffmpegPath(), ["-hide_banner", "-i", file], { encoding: "utf8" });
  const s = p.stderr || "";
  if (!/Input #0/.test(s)) throw new Error(`无法读取媒体：${file}`);
  const dm = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
  const vm = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(s);
  const fm = /(\d+(?:\.\d+)?)\s+fps/.exec(s);
  if (!dm || !vm) throw new Error(`缺少视频流：${file}`);
  const duration = Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]);
  return {
    duration,
    width: Number(vm[1]),
    height: Number(vm[2]),
    fps: fm ? Number(fm[1]) : 30,
    hasAudio: /Audio:/.test(s),
    hasVideo: true,
  };
}

export function atempoChain(speed) {
  const parts = [];
  let s = speed;
  while (s > 2.0) {
    parts.push("atempo=2.0");
    s /= 2.0;
  }
  while (s < 0.5) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  parts.push(`atempo=${s.toFixed(6)}`);
  return parts.join(",");
}