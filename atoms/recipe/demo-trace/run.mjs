#!/usr/bin/env node
// recipe 编排器骨架：按 recipe.json 逐步执行 atom，逐步留痕并写 manifest.
// 用法：node recipe/<name>/run.mjs [--prompt "用户原始指令"] [--dry] [--only 01,02]

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomsRoot } from "../../_shared/paths.mjs";
import { parseArgs, log } from "../../_shared/io.mjs";
import {
  createRun,
  beginStep,
  endStep,
  finishRun,
  recordUserDecision,
  writeJson,
} from "../../_shared/run-dir.mjs";

const RECIPE_DIR = dirname(fileURLToPath(import.meta.url));
const RECIPE_NAME = RECIPE_DIR.split("/").pop();
const spec = JSON.parse(readFileSync(join(RECIPE_DIR, "recipe.json"), "utf8"));
const args = parseArgs();

// atom 入口路径：atoms/atom/<name>/src/index.mjs
function atomEntry(atomId) {
  return join(atomsRoot(), "atom", atomId, "src", "index.mjs");
}

// 本配方给该 atom 的覆盖参数（ruleset / account 等）
function overrideFor(atomId) {
  return spec.overrides?.[atomId] || {};
}

// demo 模式：Atom 未建，用 --dry 只走留痕流程、不真调
const dry = Boolean(args.dry);

const run = createRun(RECIPE_NAME, { userPrompt: args.prompt || "" });
log(`run 目录：${run.dir}`);

let seq = 0;
let failed = false;
for (const step of spec.atoms) {
  seq++;
  const stepArgs = { ...overrideFor(step.id) };
  if (args.account) stepArgs.account = args.account;
  const s = beginStep(run, seq, step.id, stepArgs);

  if (dry) {
    // dry-run：假装成功，写一份占位输出，用于验证目录结构
    writeJson(join(run.dir, s.dir, `dry-output.json`), { atom: step.id, dry: true });
    endStep(run, s, { exitCode: 0, outputs: ["dry-output.json"] });
    if (step.stopForUser) {
      recordUserDecision(run, s, { dry: true, note: "dry-run 不真实停手" });
    }
    log(`  ${s.dir} ✓ (dry)`);
    continue;
  }

  const res = spawnSync(process.execPath, [atomEntry(step.id), "--run-dir", join(run.dir, s.dir)], {
    stdio: "inherit",
  });
  const exitCode = res.status ?? 1;
  endStep(run, s, { exitCode });
  if (exitCode !== 0) {
    failed = true;
    log(`  ${s.dir} ✗ exit ${exitCode}，终止后续步骤`);
    break;
  }
}

finishRun(run, failed ? "failed" : "success");
log(`${failed ? "失败" : "完成"}：${run.dir}/manifest.json`);
process.exit(failed ? 1 : 0);
