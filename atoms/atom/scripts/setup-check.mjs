#!/usr/bin/env node
// 首次配置检查：验证 Node 版本、必需目录、可选二进制依赖是否就绪，给出人读清单.
// 用法：node atom/scripts/setup-check.mjs

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { atomsRoot } from "../../_shared/paths.mjs";

const ROOT = atomsRoot();
const checks = [];

// 记录一条检查结果
const add = (name, ok, hint = "") => checks.push({ name, ok, hint });

const major = Number(process.version.replace(/^v/, "").split(".")[0]);
add(`Node 版本 ${process.version}`, major >= 22, "需要 Node >= 22（见 .nvmrc）");

add(".env 已创建", existsSync(join(ROOT, ".env")), "cp .env.example .env 后填入凭据");

// 可选外部二进制：缺失不阻断，只提示
const bins = [
  ["ffmpeg", "video-edit / video-cut / gif-clip"],
  ["python3", "evolver 进化脚本 / imageio-ffmpeg"],
];
for (const [bin, why] of bins) {
  let ok = false;
  try {
    execSync(`command -v ${bin}`, { stdio: "ignore" });
    ok = true;
  } catch {}
  add(`${bin} 可用`, ok, `缺失：${why}`);
}

// 视频原子优先用 imageio-ffmpeg 提供的 ffmpeg；没有也可以走 PATH
let imageioOk = false;
for (const py of ["python3", "python"]) {
  try {
    execSync(`${py} -c "import imageio_ffmpeg"`, { stdio: "ignore" });
    imageioOk = true;
    break;
  } catch {}
}
add("imageio-ffmpeg 可用", imageioOk, "pip3 install imageio-ffmpeg（video-edit / video-cut / gif-clip 需要）");
if (imageioOk) {
  const f = checks.find((c) => c.name.startsWith("ffmpeg 可用"));
  if (f) {
    f.ok = true;
    f.name = "ffmpeg 可用（PATH 或 imageio-ffmpeg）";
  }
}

for (const c of checks) {
  process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}${c.ok ? "" : "  → " + c.hint}\n`);
}
const bad = checks.filter((c) => !c.ok).length;
process.stdout.write(bad ? `\n${bad} 项待处理\n` : "\n全部就绪\n");
process.exit(bad ? 1 : 0);
