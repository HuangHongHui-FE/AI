#!/usr/bin/env node
// video-edit：按 edit.json 计划剪辑任意视频（分段/变速/倒放/定格/转场/分屏/画中画/字幕/调色/音效/导出）。
// 用法：
//   node atom/video-edit/src/index.mjs --plan edit.json --out out.mp4
//   node atom/video-edit/src/index.mjs --plan edit.json --dry-run
//   node atom/video-edit/src/index.mjs --plan edit.json --check
//   node atom/video-edit/src/index.mjs --techniques
// stdout：JSON（ok / out / duration / techniques / commands[dry-run]）

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs, emit, fail, bizFail, log } from "../../../_shared/io.mjs";
import { probe } from "./lib/ffmpeg.mjs";
import { normalizePlan, PlanError } from "./lib/plan.mjs";
import { render } from "./lib/render.mjs";
import { TECHNIQUES, techniqueIds, collectTechniques } from "./lib/techniques.mjs";

const args = parseArgs({
  known: ["plan", "out", "source", "dry-run", "check", "techniques", "keep-work", "work-dir", "quiet"],
});

const quiet = Boolean(args.quiet);
const say = (m) => { if (!quiet) log(m); };

function resolveFrom(baseDir, p) {
  return isAbsolute(p) ? p : resolve(baseDir, p);
}

function main() {
  if (args.techniques) {
    emit({ ok: true, categories: TECHNIQUES, supported: techniqueIds() }, 0);
    return;
  }
  if (!args.plan) fail("需要 --plan <edit.json>");
  const planPath = resolve(String(args.plan));
  if (!existsSync(planPath)) fail(`计划文件不存在：${planPath}`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(planPath, "utf8"));
  } catch (e) {
    fail(`计划不是合法 JSON：${e.message}`);
  }
  const base = dirname(planPath);
  if (args.source) raw.source = String(args.source);
  if (!raw.source) fail("计划缺少 source，或用 --source 覆盖");
  raw.source = resolveFrom(base, String(raw.source));
  if (!existsSync(raw.source)) fail(`源视频不存在：${raw.source}`);
  if (raw.grade?.lut) raw.grade.lut = resolveFrom(base, String(raw.grade.lut));

  const info = probe(raw.source);
  let normalized;
  try {
    normalized = normalizePlan(raw, info);
  } catch (e) {
    if (e instanceof PlanError) fail(`计划校验失败：${e.errors.join("；")}`);
    throw e;
  }
  const plan = normalized.plan;
  for (const w of normalized.warnings) say(`[WARN] ${w}`);

  if (args.check) {
    emit({
      ok: true,
      check: true,
      source: raw.source,
      probe: info,
      plan,
      warnings: normalized.warnings,
      techniques: collectTechniques(plan),
    }, 0);
    return;
  }

  const out = args.out
    ? resolve(String(args.out))
    : raw.out
      ? resolveFrom(base, String(raw.out))
      : null;
  if (!out) fail("需要 --out <mp4>（或在计划里写 out）");
  mkdirSync(dirname(out), { recursive: true });
  const workDir = args["work-dir"] ? resolve(String(args["work-dir"])) : null;
  if (workDir) mkdirSync(workDir, { recursive: true });

  say(`源：${raw.source}（${info.width}x${info.height} / ${info.duration.toFixed(2)}s / ${info.fps}fps）`);
  say(`出：${out}（${plan.output.width}x${plan.output.height} / ${plan.output.fps}fps / ${plan.output.codec}）`);

  let result;
  try {
    result = render(plan, {
      out,
      dryRun: Boolean(args["dry-run"]),
      keepWork: Boolean(args["keep-work"]),
      workDir,
      source: raw.source,
      hasAudio: info.hasAudio,
      srcW: info.width,
      srcH: info.height,
      log: say,
    });
  } catch (e) {
    if (e instanceof PlanError) fail(`计划校验失败：${e.errors.join("；")}`);
    bizFail({ ok: false, out, error: String(e.message || e) }, String(e.message || e));
  }

  if (args["dry-run"]) {
    emit(result, 0);
    return;
  }
  const bytes = statSync(out).size;
  say(`✓ ${out}（${(bytes / 1024 / 1024).toFixed(1)} MB / ${result.duration.toFixed(2)}s）`);
  emit({ ...result, bytes }, 0);
}

main();