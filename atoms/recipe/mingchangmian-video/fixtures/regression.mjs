#!/usr/bin/env node
// 回归：mingchangmian-video recipe 参数模板 / dry-run 全链路 / 步骤顺序
// 不联网：dry 模式不会真的剪视频/切 GIF
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDeep } from "../../../_shared/template.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE_DIR = join(HERE, "..");
const RUN = join(RECIPE_DIR, "run.mjs");
const RUNS = join(RECIPE_DIR, "..", "..", "runs", "mingchangmian-video");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ① 模板
const ctx = { runDir: "/tmp/run-x", steps: new Map([["video-cut", "/tmp/run-x/01-video-cut"], ["gif-clip", "/tmp/run-x/02-gif-clip"]]), user: { name: "018-高三八班", speech_sec: "35" }, env: {} };
check("模板：成品路径", resolveDeep("{{step.video-cut}}/final.mp4", ctx) === "/tmp/run-x/01-video-cut/final.mp4");
check("模板：GIF 路径", resolveDeep("{{step.gif-clip}}/{{user.name}}.gif", ctx) === "/tmp/run-x/02-gif-clip/018-高三八班.gif");
check("模板：解说时长", resolveDeep("{{user.speech-sec}}", { ...ctx, user: { "speech-sec": "35" } }) === "35");

// ② dry-run
const before = new Set(existsSync(RUNS) ? readdirSync(RUNS) : []);
const dry = spawnSync(process.execPath, [RUN, "--dry", "--prompt", "回归测试"], { encoding: "utf8" });
check("dry-run exit=0", dry.status === 0, dry.stderr.split("\n").find((l) => l.includes("完成")) || "");
const runId = (dry.stderr.match(/runs\/mingchangmian-video\/(\d{8}-\d{6})/) || [])[1];
check("生成 run 目录", Boolean(runId), runId || "无");

if (runId) {
  const runDir = join(RUNS, runId);
  const spec = JSON.parse(readFileSync(join(RECIPE_DIR, "recipe.json"), "utf8"));
  const missing = [];
  for (let i = 0; i < spec.atoms.length; i++) {
    const dir = join(runDir, `${String(i + 1).padStart(2, "0")}-${spec.atoms[i].id}`);
    if (!existsSync(join(dir, "input.json"))) missing.push(spec.atoms[i].id);
  }
  check("每步都有 input.json", missing.length === 0, missing.join(",") || "全部齐备");
  const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
  check("步骤数 8", manifest.steps.length === 8, `${manifest.steps.length}/8`);
  check(
    "步骤顺序正确",
    manifest.steps.map((s) => s.atom).join(",") === "video-cut,gif-clip,selfcheck,ai-flavor,copyright-check,format-html,cover-image,publish-kit",
  );
  check("没有停手点", manifest.steps.every((s) => !s.stopped_for_user));
  rmSync(runDir, { recursive: true, force: true });
}

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);