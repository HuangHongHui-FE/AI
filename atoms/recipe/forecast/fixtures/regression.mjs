#!/usr/bin/env node
// 回归：forecast recipe 的参数模板 / dry-run 全链路 / 续跑跳过已完成
// 用法：node recipe/forecast/fixtures/regression.mjs
// 不联网：market-fetch 在 dry 模式不会真的抓数
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDeep } from "../../../_shared/template.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE_DIR = join(HERE, "..");
const RUN = join(RECIPE_DIR, "run.mjs");
const RUNS = join(RECIPE_DIR, "..", "..", "runs", "forecast");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ① 参数模板
const ctx = { runDir: "/tmp/run-x", steps: new Map([["market-fetch", "/tmp/run-x/01-market-fetch"]]), user: { md: "/tmp/a.md" }, env: {} };
check("模板：step 目录", resolveDeep("{{step.market-fetch}}/quotes.json", ctx) === "/tmp/run-x/01-market-fetch/quotes.json");
check("模板：user.md", resolveDeep("{{user.md}}", ctx) === "/tmp/a.md");
check("模板：未传参数为空串", resolveDeep("{{user.missing}}", ctx) === "");

// ② dry-run
const before = new Set(existsSync(RUNS) ? readdirSync(RUNS) : []);
const dry = spawnSync(process.execPath, [RUN, "--dry", "--prompt", "回归测试"], { encoding: "utf8" });
check("dry-run exit=0", dry.status === 0, dry.stderr.split("\n").find((l) => l.includes("完成")) || "");
const runId = (dry.stderr.match(/runs\/forecast\/(\d{8}-\d{6})/) || [])[1];
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
  check("manifest 步骤数正确", manifest.steps.length === 2, `${manifest.steps.length}/2`);
  check("没有停手点", manifest.steps.every((s) => !s.stopped_for_user));
  check("步骤顺序 market-fetch → result-page", manifest.steps[0].atom === "market-fetch" && manifest.steps[1].atom === "result-page");

  rmSync(runDir, { recursive: true, force: true });
}

// ③ 续跑：第 1 步完成，跳过
const fakeId = "20260101-000000";
const fakeRun = join(RUNS, fakeId);
rmSync(fakeRun, { recursive: true, force: true });
mkdirSync(join(fakeRun, "01-market-fetch"), { recursive: true });
writeFileSync(
  join(fakeRun, "manifest.json"),
  JSON.stringify(
    {
      run_id: `forecast/${fakeId}`,
      recipe: "forecast",
      version: "0.1.0",
      started_at: "2026-01-01T00:00:00+08:00",
      finished_at: null,
      status: "failed",
      trigger: { by: "test", user_prompt: "", cwd: "" },
      env: {},
      steps: [{ seq: 1, atom: "market-fetch", dir: "01-market-fetch", exit_code: 0, outputs: ["quotes.json"], args: {} }],
    },
    null,
    2,
  ),
);
const resume = spawnSync(process.execPath, [RUN, "--resume", fakeId, "--dry"], { encoding: "utf8" });
check("续跑 exit=0", resume.status === 0);
check("续跑跳过已完成步骤", /01-market-fetch ⊘ 已完成，跳过/.test(resume.stderr));
const after = JSON.parse(readFileSync(join(fakeRun, "manifest.json"), "utf8"));
check("续跑后步骤不重复", new Set(after.steps.map((s) => s.dir)).size === after.steps.length);
rmSync(fakeRun, { recursive: true, force: true });

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);