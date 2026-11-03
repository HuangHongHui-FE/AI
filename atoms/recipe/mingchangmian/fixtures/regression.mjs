#!/usr/bin/env node
// 回归：mingchangmian recipe 参数模板 / dry-run 全链路 / 续跑
// 不联网：dry 模式不会真的切 GIF
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDeep } from "../../../_shared/template.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE_DIR = join(HERE, "..");
const RUN = join(RECIPE_DIR, "run.mjs");
const RUNS = join(RECIPE_DIR, "..", "..", "runs", "mingchangmian");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ① 模板
const ctx = { runDir: "/tmp/run-x", steps: new Map([["gif-clip", "/tmp/run-x/01-gif-clip"]]), user: { name: "024-我靠袁华", article: "/tmp/a.json", md: "/tmp/b.md" }, env: {} };
check("模板：GIF 路径", resolveDeep("{{step.gif-clip}}/{{user.name}}.gif", ctx) === "/tmp/run-x/01-gif-clip/024-我靠袁华.gif");
check("模板：article", resolveDeep("{{user.article}}", ctx) === "/tmp/a.json");
check("模板：未传参数为空串", resolveDeep("{{user.missing}}", ctx) === "");

// ② dry-run
const before = new Set(existsSync(RUNS) ? readdirSync(RUNS) : []);
const dry = spawnSync(process.execPath, [RUN, "--dry", "--prompt", "回归测试"], { encoding: "utf8" });
check("dry-run exit=0", dry.status === 0, dry.stderr.split("\n").find((l) => l.includes("完成")) || "");
const runId = (dry.stderr.match(/runs\/mingchangmian\/(\d{8}-\d{6})/) || [])[1];
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
  check("步骤数 6", manifest.steps.length === 6, `${manifest.steps.length}/6`);
  check("步骤顺序正确", manifest.steps.map((s) => s.atom).join(",") === "gif-clip,selfcheck,ai-flavor,format-html,cover-image,publish-kit");
  check("没有停手点", manifest.steps.every((s) => !s.stopped_for_user));
  rmSync(runDir, { recursive: true, force: true });
}

// ③ 续跑
const fakeId = "20260101-000000";
const fakeRun = join(RUNS, fakeId);
rmSync(fakeRun, { recursive: true, force: true });
mkdirSync(join(fakeRun, "01-gif-clip"), { recursive: true });
writeFileSync(join(fakeRun, "manifest.json"), JSON.stringify({
  run_id: `mingchangmian/${fakeId}`, recipe: "mingchangmian", version: "0.1.0",
  started_at: "2026-01-01T00:00:00+08:00", finished_at: null, status: "failed",
  trigger: { by: "test", user_prompt: "", cwd: "" }, env: {},
  steps: [{ seq: 1, atom: "gif-clip", dir: "01-gif-clip", exit_code: 0, outputs: ["x.gif"], args: {} }],
}, null, 2));
const resume = spawnSync(process.execPath, [RUN, "--resume", fakeId, "--dry"], { encoding: "utf8" });
check("续跑 exit=0", resume.status === 0);
check("续跑跳过 gif-clip", /01-gif-clip ⊘ 已完成，跳过/.test(resume.stderr));
rmSync(fakeRun, { recursive: true, force: true });

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);