#!/usr/bin/env node
// 回归：video-edit 的计划校验 / dry-run / 真实渲染 / 成片参数 / 手法清单
// 退出码：0 通过 / 1 失败
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findFont } from "../src/lib/font.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "ve-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args, timeout = 300000) =>
  spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout });

// 1. 手法清单
const tech = run(["--techniques"]);
check("--techniques exit 0", tech.status === 0, tech.stderr.trim().slice(-80));
if (tech.status === 0) {
  const j = JSON.parse(tech.stdout);
  check("10 类手法", j.categories.length === 10);
  check("包含 grid/pip", j.supported.includes("grid") && j.supported.includes("pip"));
  check("包含 blurpad/glitch", j.supported.includes("blurpad") && j.supported.includes("glitch"));
  check("包含不支持项（跟踪）", j.categories.flatMap((c) => c.items).some((i) => i.id === "tracking" && !i.supported));
}

// 2. 找 ffmpeg
const probe = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
const ffmpeg = probe.status === 0 ? probe.stdout.trim() : "";
if (!ffmpeg || !existsSync(ffmpeg)) {
  console.log("（缺少 ffmpeg，跳过真实渲染）");
  const failN = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failN}/${results.length} 通过`);
  process.exit(failN ? 1 : 0);
}

const src = join(work, "src.mp4");
const gen = spawnSync(ffmpeg, [
  "-y", "-v", "error",
  "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-shortest", src,
], { encoding: "utf8" });
check("生成测试源", gen.status === 0 && existsSync(src), gen.stderr.slice(-100));

// 3. 非法计划
const bad = join(work, "bad.json");
writeFileSync(bad, JSON.stringify({ source: src, segments: [{ start: 0, end: 1, speed: 10 }] }));
const badRun = run(["--plan", bad, "--out", join(work, "bad.mp4")]);
check("speed=10 exit 2", badRun.status === 2);

// 文字渲染需要中文字体；没有就跳过后续，避免换机器时误报
const cjkFont = findFont();
if (!cjkFont) {
  console.log("（缺少中文字体，跳过计划/渲染；设 VIDEO_EDIT_FONT 或安装 Noto Sans CJK）");
  const failN = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failN}/${results.length} 通过`);
  process.exit(failN ? 1 : 0);
}

// 4. 合法计划
const plan = {
  source: src,
  output: { width: 640, height: 360, fps: 30, crf: 30, preset: "ultrafast" },
  grade: { contrast: 1.1, saturation: 1.2, vignette: true, grain: 1, sharpen: 0.2 },
  overlays: { watermark: "T", progressBar: true },
  audio: { loudnorm: -14, truePeak: -1.2, sfx: true },
  segments: [
    { name: "hook", start: 0, end: 1, zoom: 1.1, text: ["标题"] },
    { name: "rev", start: 1, end: 2, speed: 2, reverse: true, transition: { type: "fade", duration: 0.1 } },
    { name: "freeze", start: 3, end: 3.6, freeze: 0.2, mirror: true, transition: { type: "fadewhite", duration: 0.1 } },
    { name: "still", stillAt: 5, duration: 0.5, text: [{ content: "静帧", typewriter: { step: 0.1 } }], transition: { type: "pixelize", duration: 0.1 } },
    { name: "grid", grid: { cols: 2, rows: 2, cells: [
      { start: 0, end: 0.6 }, { start: 1, end: 1.6 }, { start: 2, end: 2.6 }, { start: 3, end: 3.6 },
    ] }, transition: { type: "cut" } },
    { name: "pip", start: 0, end: 1, pip: { start: 3, end: 4, width: 0.3 }, transition: { type: "dissolve", duration: 0.1 } },
  ],
};
const planPath = join(work, "edit.json");
writeFileSync(planPath, JSON.stringify(plan, null, 2));

const checked = run(["--plan", planPath, "--check"]);
check("--check exit 0", checked.status === 0, checked.stderr.trim().slice(-100));
if (checked.status === 0) {
  const j = JSON.parse(checked.stdout);
  check("--check 归一化 6 段", j.plan.segments.length === 6);
  check("--check 有 warnings 数组", Array.isArray(j.warnings));
}

// 5. dry-run
const dryOut = join(work, "dry.mp4");
const dry = run(["--plan", planPath, "--out", dryOut, "--dry-run"]);
check("--dry-run exit 0", dry.status === 0, dry.stderr.trim().slice(-100));
if (dry.status === 0) {
  const j = JSON.parse(dry.stdout);
  check("dry-run 不落盘", !existsSync(dryOut));
  check("dry-run 有命令", Array.isArray(j.commands) && j.commands.length >= 7, `${j.commands?.length} 条`);
  check("dry-run 报 grid/pip", j.techniques.includes("grid") && j.techniques.includes("pip"));
}

// 6. 真实渲染
const out = join(work, "out.mp4");
const real = run(["--plan", planPath, "--out", out]);
check("真实渲染 exit 0", real.status === 0, real.stderr.trim().slice(-160));
check("产出成片", existsSync(out));
if (existsSync(out)) {
  check("成片非空", statSync(out).size > 1000, `${statSync(out).size} bytes`);
  const info = spawnSync(ffmpeg, ["-hide_banner", "-i", out], { encoding: "utf8" }).stderr;
  const dm = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(info);
  const dur = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
  check("时长在预期内", dur > 2 && dur < 6, `${dur.toFixed(2)}s`);
  check("分辨率 640x360", /Video:.*640x360/.test(info), (info.match(/Video:.*/) || [""])[0].slice(0, 80));
  check("有音轨", /Audio:/.test(info));
  if (real.status === 0) {
    const j = JSON.parse(real.stdout);
    check("stdout 报告 techniques", Array.isArray(j.techniques) && j.techniques.includes("reverse") && j.techniques.includes("sfx"));
  }
}

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);