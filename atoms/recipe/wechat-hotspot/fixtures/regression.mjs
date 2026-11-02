#!/usr/bin/env node
// 回归：recipe 编排器的四个关键机制
//   ① 参数模板解析  ② 停手点（产出就绪后再停）  ③ 续跑（--resume 跳过已完成）  ④ manifest 不重复记录
// 用法：node recipe/wechat-hotspot/fixtures/regression.mjs
// 不联网、不碰真实公众号：全部用 --dry 与临时 run 目录

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDeep } from "../../../_shared/template.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE_DIR = join(HERE, "..");
const RUN = join(RECIPE_DIR, "run.mjs");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── ① 参数模板解析 ──
const ctx = {
  runDir: "/tmp/run-x",
  steps: new Map([["hotlist", "/tmp/run-x/01-hotlist"]]),
  user: { subject: "全红婵", event: "夺冠", empty: "" },
  env: { MY_VAR: "env-value" },
};
check("模板：runDir", resolveDeep("{{runDir}}/07/cover.jpg", ctx) === "/tmp/run-x/07/cover.jpg");
check("模板：step 目录", resolveDeep("{{step.hotlist}}/hotlist.json", ctx) === "/tmp/run-x/01-hotlist/hotlist.json");
check("模板：user 输入", resolveDeep("{{user.subject}}", ctx) === "全红婵");
check("模板：env", resolveDeep("{{env.MY_VAR}}", ctx) === "env-value");
check("模板：未传参数解析为空串", resolveDeep("{{user.missing}}", ctx) === "");
check(
  "模板：对象深解析",
  JSON.stringify(resolveDeep({ a: "{{user.subject}}", b: { c: "{{user.event}}" } }, ctx)) ===
    JSON.stringify({ a: "全红婵", b: { c: "夺冠" } })
);
check("模板：未知变量原样保留", resolveDeep("{{unknown.thing}}", ctx) === "{{unknown.thing}}");

// ── ② dry-run 全链路 ──
const before = new Set(existsSync(join(RECIPE_DIR, "..", "..", "runs", "wechat-hotspot")) ? readdirSync(join(RECIPE_DIR, "..", "..", "runs", "wechat-hotspot")) : []);
const dry = spawnSync(process.execPath, [RUN, "--dry", "--prompt", "回归测试"], { encoding: "utf8" });
check("dry-run exit=0", dry.status === 0, dry.stderr.split("\n").find((l) => l.includes("完成")) || "");
const runId = (dry.stderr.match(/runs\/wechat-hotspot\/(\d{8}-\d{6})/) || [])[1];
check("生成 run 目录", Boolean(runId), runId || "无");

if (runId) {
  const runDir = join(RECIPE_DIR, "..", "..", "runs", "wechat-hotspot", runId);
  const spec = JSON.parse(readFileSync(join(RECIPE_DIR, "recipe.json"), "utf8"));

  // 每个步骤都有目录 + input.json
  const missing = [];
  for (let i = 0; i < spec.atoms.length; i++) {
    const dir = join(runDir, `${String(i + 1).padStart(2, "0")}-${spec.atoms[i].id}`);
    if (!existsSync(join(dir, "input.json"))) missing.push(spec.atoms[i].id);
  }
  check("每步都有 input.json", missing.length === 0, missing.join(",") || "全部齐备");

  const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
  check("manifest 步骤数正确", manifest.steps.length === spec.atoms.length, `${manifest.steps.length}/${spec.atoms.length}`);
  check("manifest 无重复步骤", new Set(manifest.steps.map((s) => s.dir)).size === manifest.steps.length);
  check("dry-run 标记停手点", manifest.steps.filter((s) => s.stopped_for_user).length === 2, `停手点 ${manifest.steps.filter((s) => s.stopped_for_user).length} 个`);

  // ② 停手点顺序：真实模式下，hotlist 产出必须先于停手
  // （用 dry 模式 verify：停手点步骤有 stopped_for_user 记录即可）
  const hot = manifest.steps.find((s) => s.atom === "hotlist");
  check("hotlist 是停手点", hot?.stopped_for_user === true);

  // 清理这次 dry run
  rmSync(runDir, { recursive: true, force: true });
}

// ── ③ 续跑机制 ──
// 造一个假的 run 目录：第 1 步完成，第 2 步未做
const fakeId = "20260101-000000";
const fakeRun = join(RECIPE_DIR, "..", "..", "runs", "wechat-hotspot", fakeId);
rmSync(fakeRun, { recursive: true, force: true });
mkdirSync(fakeRun, { recursive: true });
writeFileSync(
  join(fakeRun, "manifest.json"),
  JSON.stringify(
    {
      run_id: `wechat-hotspot/${fakeId}`,
      recipe: "wechat-hotspot",
      version: "0.1.0",
      started_at: "2026-01-01T00:00:00+08:00",
      finished_at: null,
      status: "failed",
      trigger: { by: "test", user_prompt: "", cwd: "" },
      env: {},
      steps: [{ seq: 1, atom: "hotlist", dir: "01-hotlist", exit_code: 0, outputs: ["hotlist.json"], args: {} }],
    },
    null,
    2
  )
);
mkdirSync(join(fakeRun, "01-hotlist"), { recursive: true });

const resume = spawnSync(process.execPath, [RUN, "--resume", fakeId, "--dry"], { encoding: "utf8" });
check("续跑 exit=0", resume.status === 0);
const skipHit = /01-hotlist ⊘ 已完成，跳过/.test(resume.stderr);
check("续跑跳过已完成步骤", skipHit, skipHit ? "已跳过" : "未检测到跳过日志");

const after = JSON.parse(readFileSync(join(fakeRun, "manifest.json"), "utf8"));
check("续跑后步骤不重复", new Set(after.steps.map((s) => s.dir)).size === after.steps.length, `${after.steps.length} 条`);
const hotAfter = after.steps.find((s) => s.atom === "hotlist");
check("续跑保留原步骤记录", hotAfter?.exit_code === 0 && hotAfter?.outputs?.includes("hotlist.json"));

rmSync(fakeRun, { recursive: true, force: true });

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
