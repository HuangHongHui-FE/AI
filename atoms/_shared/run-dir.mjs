// 运行留痕：建 runs/<recipe>/<时间戳>/ 目录，逐步写 input/output/manifest，历史永不覆盖.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runsRoot } from "./paths.mjs";
import { stamp, nowIso } from "./time.mjs";

export { stamp, nowIso };

// 编号前缀 NN-，与执行顺序一致
export function stepName(seq, atom) {
  return `${String(seq).padStart(2, "0")}-${atom}`;
}

// 建一次运行的目录；同秒重名时追加 -b/-c 后缀，绝不覆盖历史
export function createRun(recipe, { userPrompt = "", cwd = process.cwd() } = {}) {
  const base = join(runsRoot(), recipe);
  let id = stamp();
  let dir = join(base, id);
  const letters = "bcdefghijklmnopqrstuvwxyz";
  for (let i = 0; existsSync(dir); i++) {
    id = `${stamp()}-${letters[i] || i}`;
    dir = join(base, id);
  }
  mkdirSync(join(dir, "00-input"), { recursive: true });
  writeJson(join(dir, "00-input", "request.json"), {
    recipe,
    user_prompt: userPrompt,
    cwd,
    created_at: nowIso(),
  });
  const manifest = {
    run_id: `${recipe}/${id}`,
    recipe,
    version: "0.1.0",
    started_at: nowIso(),
    finished_at: null,
    status: "running",
    trigger: { by: "claude", user_prompt: userPrompt, cwd },
    env: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      git_rev: process.env.GIT_REV || null,
    },
    steps: [],
  };
  writeJson(join(dir, "manifest.json"), manifest);
  return { dir, id, manifest };
}

// 某一步的目录：00-input 之外按 01-xxx、02-xxx 递增
export function stepDir(run, seq, atom) {
  const d = join(run.dir, stepName(seq, atom));
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// 记录一步的开始：写该步的 input.json，返回步骤对象供结束时补全
// 续跑时同一步（同 seq+atom）会再次开始：替换旧记录而不是追加，
// 否则 manifest 里会堆积 failed→success 的历史条目，看不出真实执行了几步
export function beginStep(run, seq, atom, args = {}) {
  const dir = stepDir(run, seq, atom);
  writeJson(join(dir, "input.json"), args);
  const step = {
    seq,
    atom,
    version: "0.1.0",
    dir: stepName(seq, atom),
    started_at: nowIso(),
    finished_at: null,
    exit_code: null,
    args,
    outputs: [],
    stopped_for_user: false,
  };
  const prevIdx = run.manifest.steps.findIndex((s) => s.dir === step.dir);
  if (prevIdx >= 0) {
    // 保留历史尝试次数，便于看到「重试过几次」
    step.attempt = (run.manifest.steps[prevIdx].attempt || 1) + 1;
    run.manifest.steps[prevIdx] = step;
  } else {
    run.manifest.steps.push(step);
  }
  saveManifest(run);
  return step;
}

// 记录一步结束：补 exit_code 与产出清单
export function endStep(run, step, { exitCode = 0, outputs = [], error = null } = {}) {
  step.finished_at = nowIso();
  step.exit_code = exitCode;
  step.outputs = outputs;
  if (error) {
    step.error = error;
    writeJson(join(run.dir, step.dir, "error.json"), error);
  }
  saveManifest(run);
  return step;
}

// 记录需要用户拍板的停手点（选热点、筛图等）
export function recordUserDecision(run, step, decision) {
  step.stopped_for_user = true;
  step.user_decision = { at: nowIso(), ...decision };
  writeJson(join(run.dir, step.dir, "user-decision.json"), step.user_decision);
  saveManifest(run);
}

// 收尾：写入最终状态
export function finishRun(run, status = "success", extra = {}) {
  run.manifest.finished_at = nowIso();
  run.manifest.status = status;
  Object.assign(run.manifest, extra);
  saveManifest(run);
  return run.manifest;
}

// 落盘 manifest
export function saveManifest(run) {
  writeJson(join(run.dir, "manifest.json"), run.manifest);
}

// 读回某次运行的 manifest（复盘用）
export function readManifest(runId) {
  const p = join(runsRoot(), runId, "manifest.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

// 写 JSON 的统一出口（自动建父目录）
export function writeJson(filePath, obj) {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}
