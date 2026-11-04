#!/usr/bin/env node
// recipe 编排器：按 recipe.json 逐步执行 atom，逐步留痕并写 manifest
// 用法：
//   node recipe/<name>/run.mjs --prompt "用户原始指令" [--account xxx] [--dry] [--only a,b]
//   node recipe/<name>/run.mjs --subject "全红婵" --event "全运会夺冠" --query "全红婵夺冠"
// 参数模板：recipe.json 里可用 {{runDir}} {{step.<atom>}} {{outputs.<atom>.<file>}} {{user.xxx}} {{env.NAME}}

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomsRoot } from "../../_shared/paths.mjs";
import { parseArgs, log } from "../../_shared/io.mjs";
import { resolveDeep } from "../../_shared/template.mjs";
import { createRun, beginStep, endStep, finishRun, recordUserDecision, writeJson, stepName } from "../../_shared/run-dir.mjs";

const RECIPE_DIR = dirname(fileURLToPath(import.meta.url));
const RECIPE_NAME = basename(RECIPE_DIR);
const spec = JSON.parse(readFileSync(join(RECIPE_DIR, "recipe.json"), "utf8"));
const args = parseArgs();

// atom 入口路径
const atomEntry = (id) => join(atomsRoot(), "atom", id, "src", "index.mjs");
// 该原子是否已实现
const isImplemented = (id) => existsSync(atomEntry(id));

// 某步骤的参数：atoms[].args（模板）+ overrides[id]（固定覆盖项，优先）
function argsFor(id) {
  const step = spec.atoms.find((a) => a.id === id);
  return { ...(step?.args || {}), ...(spec.overrides?.[id] || {}) };
}

// 扫描步骤目录收集产出（排除元文件）
function collectOutputs(stepDirPath) {
  if (!existsSync(stepDirPath)) return [];
  return readdirSync(stepDirPath, { withFileTypes: true })
    .filter((e) => e.isFile() && !["input.json", "user-decision.json", "error.json", "dry-output.json"].includes(e.name))
    .map((e) => e.name);
}

// 打开已有 run 目录续跑：读回 manifest，把已完成步骤记下来
function openRun(recipe, runId) {
  const dir = join(atomsRoot(), "runs", recipe, runId);
  if (!existsSync(join(dir, "manifest.json"))) {
    console.error(`找不到 run：${dir}`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  manifest.status = "running";
  manifest.finished_at = null;
  return { dir, id: runId, manifest };
}

// 从命令行透传的用户输入（--subject 等，供模板 {{user.subject}} 使用）
function collectUserInputs() {
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "_" || k === "prompt" || k === "only" || k === "dry") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

const dry = Boolean(args.dry);
const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;

// 续跑：--resume <时间戳> 复用已有 run 目录（停手点之后必须用这个，否则用户决定会丢在旧目录里）
const run = args.resume ? openRun(RECIPE_NAME, String(args.resume)) : createRun(RECIPE_NAME, { userPrompt: String(args.prompt || "") });
log(`run 目录：${run.dir}${args.resume ? "（续跑）" : ""}`);

// 模板上下文：随步骤推进累积
const ctx = { runDir: run.dir, steps: new Map(), user: collectUserInputs(), env: process.env };

let seq = 0;
let failed = false;
const skipped = [];
const waiting = [];

for (const step of spec.atoms) {
  seq++;

  // 步骤目录先登记，参数里的 {{step.<自己>}} 才能解析出路径（否则会变成 "/xxx"）
  // 必须在 --only 过滤之前登记：只跑后半段时，前半段的产出路径仍要能被模板解析
  const stepPath = join(run.dir, stepName(seq, step.id));
  ctx.steps.set(step.id, stepPath);

  if (only && !only.includes(step.id)) continue;

  // 参数 = 步骤 args（可含模板）+ 配方 overrides + 命令行 --account
  const rawArgs = argsFor(step.id);
  if (args.account) rawArgs.account = String(args.account); // 命令行优先级最高
  const stepArgs = resolveDeep(rawArgs, ctx);

  // 续跑：该步已成功完成则跳过（重跑会覆盖产出，且已有产出被下游依赖）
  const done = run.manifest.steps.find((x) => x.dir === stepName(seq, step.id) && x.exit_code === 0);
  if (done && !only) {
    log(`  ${stepName(seq, step.id)} ⊘ 已完成，跳过`);
    continue;
  }

  const s = beginStep(run, seq, step.id, stepArgs);

  if (dry) {
    writeJson(join(stepPath, "dry-output.json"), { atom: step.id, dry: true });
    endStep(run, s, { exitCode: 0, outputs: ["dry-output.json"] });
    if (step.stopForUser) recordUserDecision(run, s, { dry: true, note: "dry-run 不真实停手" });
    log(`  ${s.dir} ✓ (dry)`);
    continue;
  }

  if (!isImplemented(step.id)) {
    skipped.push(step.id);
    endStep(run, s, { exitCode: null, outputs: [], error: { code: "NOT_IMPLEMENTED", message: `atom/${step.id} 尚未实现` } });
    log(`  ${s.dir} ⊘ 跳过（未实现）`);
    continue;
  }

  // 组装 CLI 参数：--out-dir 恒传；配方里用 out 显式指定主产物路径的也传 --out
  const cliArgs = [atomEntry(step.id), "--out-dir", stepPath];
  const missing = [];
  for (const [k, v] of Object.entries(stepArgs)) {
    if (k === "out-dir" || k === "out" || v === false || v === undefined || v === null) continue;
    if (v === "") {
      missing.push(k); // 模板没解析出值（用户没传），不传给 atom
      continue;
    }
    if (v === true) cliArgs.push(`--${k}`);
    else cliArgs.push(`--${k}`, String(v));
  }
  if (missing.length) log(`      ⚠ 参数未提供：${missing.join(", ")}（模板变量未解析）`);
  // hotlist 的产物要固定文件名，否则下游按名找会落空
  if (step.id === "hotlist") cliArgs.push("--out", stepArgs.out || join(stepPath, "hotlist.json"));
  else if (stepArgs.out) cliArgs.push("--out", stepArgs.out);

  log(`  ▷ ${s.dir}：${step.id}`);
  // 捕获 stdout/stderr 但照样实时打印：失败时要把错误留在 error.json 里，inherit 模式拿不到内容
  const res = spawnSync(process.execPath, cliArgs, { encoding: "utf8" });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  const exitCode = res.status ?? 1;

  if (exitCode !== 0) {
    // 从 stderr 取最后一条 [ERROR]/[FAIL] 行作为错误摘要
    const lines = String(res.stderr || "").split("\n").filter(Boolean);
    const errLine = [...lines].reverse().find((l) => /\[(ERROR|FAIL)\]/.test(l)) || lines[lines.length - 1] || "";
    endStep(run, s, {
      exitCode,
      outputs: collectOutputs(stepPath),
      error: { code: exitCode === 2 ? "ENV_ERROR" : "BIZ_FAIL", message: errLine.replace(/^\[(ERROR|FAIL)\]\s*/, "").trim() },
    });
    failed = true;
    log(`  ${s.dir} ✗ exit ${exitCode}，终止后续步骤`);
    break;
  }

  endStep(run, s, { exitCode, outputs: collectOutputs(stepPath) });
  log(`  ${s.dir} ✓`);

  // 停手点：先跑出产出（榜单/候选图），再等用户在这份产出上做决定
  // 放在 atom 之后而不是之前，否则用户无从选择
  if (step.stopForUser) {
    const decisionPath = join(stepPath, "user-decision.json");
    if (!existsSync(decisionPath)) {
      waiting.push(step.id);
      endStep(run, s, {
        exitCode,
        outputs: collectOutputs(stepPath),
        error: { code: "AWAITING_USER", message: `产出已就绪，等待用户决定，请写入 ${decisionPath}` },
      });
      log(`  ${s.dir} ⏸ 产出已就绪，等待用户决定（${decisionPath}）`);
      failed = true;
      break;
    }
    recordUserDecision(run, s, JSON.parse(readFileSync(decisionPath, "utf8")));
    log(`  ${s.dir} ✓ 已记录用户决定`);
  }
}

finishRun(run, failed ? "failed" : "success", {
  ...(skipped.length ? { skipped_atoms: skipped } : {}),
  ...(waiting.length ? { awaiting_user: waiting } : {}),
});
log(`\n${failed ? "未完成" : "完成"}：${run.dir}/manifest.json`);
if (waiting.length) log(`等待用户决定：${waiting.join(", ")}（写入对应步骤的 user-decision.json 后重跑）`);
if (skipped.length) log(`未实现已跳过：${skipped.join(", ")}`);
process.exit(failed ? 1 : 0);
