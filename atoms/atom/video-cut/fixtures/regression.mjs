#!/usr/bin/env node
// 回归：video-cut 参数校验 / 批量文件名解析 / 单条真实剪辑
// 退出码：0 通过 / 1 失败
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "vc-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout: 300000 });

// 1. 参数校验
check("缺 --source exit 2", run(["--title", "t", "--hook-range", "1-2"]).status === 2);
check("缺 --title exit 2", run(["--source", "x.mp4", "--hook-range", "1-2"]).status === 2);
check("缺 --hook-range exit 2", run(["--source", "x.mp4", "--title", "t"]).status === 2);
check("未知 mode exit 2", run(["--mode", "x"]).status === 2);

// 2. 批量 --plan：只解析文件名，不需要真实视频
const media = join(work, "media");
mkdirSync(join(media, "素材"), { recursive: true });
writeFileSync(join(media, "素材", "001-测试标题-1-2.mp4"), "");
writeFileSync(join(media, "素材", "bad-name.mp4"), "");
const plan = run(["--mode", "batch", "--media-root", media, "--plan"]);
check("批量 --plan exit 0", plan.status === 0, plan.stderr.trim().slice(-80));
check("识别 1 条待剪", /待剪 1 条/.test(plan.stdout), plan.stdout.split("\n")[0]);
check("成品名去掉钩子段", /001-测试标题\.mp4/.test(plan.stdout));
check("跳过缺钩子秒数的文件", /bad-name/.test(plan.stdout) === false);

// 3. 单条真实剪辑（需要 ffmpeg + 字体）
const probe = spawnSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
const ffmpeg = probe.status === 0 ? probe.stdout.trim() : "";
const font = "/System/Library/Fonts/PingFang.ttc";
if (ffmpeg && existsSync(ffmpeg) && existsSync(font)) {
  mkdirSync(join(media, "素材"), { recursive: true });
  const src = join(media, "素材", "001-测试标题-1-2.mp4");
  const cta = join(media, "成品", "004-关注卡.mp4");
  mkdirSync(join(media, "成品"), { recursive: true });
  const gen = (out, d) =>
    spawnSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=blue:s=320x240:d=${d}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${d}`, "-pix_fmt", "yuv420p", "-shortest", out], { encoding: "utf8" });
  const g1 = gen(src, 4);
  const g2 = gen(cta, 2);
  check("测试视频生成", g1.status === 0 && g2.status === 0, (g1.stderr + g2.stderr).slice(-100));

  const single = run(["--mode", "single", "--media-root", media, "--source", "素材/001-测试标题-1-2.mp4", "--title", "测试标题", "--hook-range", "1-2", "--cta", "成品/004-关注卡.mp4", "--out", "成品/001-测试标题.mp4"]);
  check("单条剪辑 exit 0", single.status === 0, single.stderr.trim().slice(-120));
  const outFile = join(media, "成品", "001-测试标题.mp4");
  check("产出成品", existsSync(outFile));
  if (existsSync(outFile)) {
    check("成品非空", statSync(outFile).size > 1000, `${statSync(outFile).size} bytes`);
    const j = JSON.parse(single.stdout);
    check("stdout 报告成品", j.ok === true && j.file === outFile);
  }
} else {
  console.log("（缺少 ffmpeg 或 PingFang 字体，跳过真实剪辑）");
}

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);