#!/usr/bin/env node
// ai-flavor：文章 AI 味本地预检——在贴朱雀等检测工具之前先过一遍，标出最像 AI 的地方
// 用法：
//   node atom/ai-flavor/src/index.mjs --article article.json
//   node atom/ai-flavor/src/index.mjs --text "正文"
//   node atom/ai-flavor/src/index.mjs --feedback --article a.json --label ai --zhuque 0.87
//   node atom/ai-flavor/src/index.mjs --calibrate
// stdout：{ ok, score, level, hits[], stats }

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, emit, fail, log } from "../../../_shared/io.mjs";
import { scoreText, RULES, charCount } from "./lib/rules.mjs";

const args = parseArgs({
  known: ["article", "text", "out-dir", "json", "quiet", "feedback", "label", "zhuque", "note", "feedback-file", "calibrate"],
});

const HERE = dirname(fileURLToPath(import.meta.url));
// 反馈数据跟着原子走，累积后可 --calibrate 校准规则权重
const FEEDBACK_FILE = resolve(String(args["feedback-file"] || join(HERE, "..", "data", "feedback.jsonl")));

// 读正文：优先 article.json 的 body_markdown，其次 --text
function loadText() {
  if (args.article) {
    const p = resolve(String(args.article));
    if (!existsSync(p)) fail(`稿件不存在：${p}`);
    const a = JSON.parse(readFileSync(p, "utf8"));
    const body = a.body_markdown || a.body || "";
    if (!body) fail("article.json 里没有 body_markdown 字段");
    return { text: body, title: a.title || "" };
  }
  if (args.text) return { text: String(args.text), title: "" };
  fail("需要 --article 稿件路径 或 --text 正文");
}

// 记录一次朱雀实测结果，供后续 --calibrate 校准
function recordFeedback(text) {
  const label = String(args.label || "").toLowerCase();
  if (!["ai", "human"].includes(label)) fail("--feedback 需要 --label ai|human（朱雀判定的结果）");
  const zhuque = args.zhuque === undefined ? null : Number(args.zhuque);
  if (zhuque !== null && (Number.isNaN(zhuque) || zhuque < 0 || zhuque > 1)) fail("--zhuque 是朱雀 AI 概率，取值 0~1");

  const r = scoreText(text);
  const snap = {};
  for (const h of r.hits) snap[h.id] = h.strength;
  const row = {
    at: new Date().toISOString(),
    label,
    zhuque,
    local_score: r.score,
    title: args.article ? JSON.parse(readFileSync(resolve(String(args.article)), "utf8")).title || "" : "",
    note: args.note ? String(args.note) : "",
    rules: snap,
  };
  mkdirSync(dirname(FEEDBACK_FILE), { recursive: true });
  appendFileSync(FEEDBACK_FILE, JSON.stringify(row) + "\n");
  log(`✓ 已记录反馈：label=${label} 朱雀=${zhuque ?? "-"} 本地分=${r.score} → ${FEEDBACK_FILE}`);
  return row;
}

// 用已记录的反馈算每条规则的区分度（AI 样本均值 − 人写样本均值），给出权重建议
function calibrate() {
  if (!existsSync(FEEDBACK_FILE)) fail(`还没有反馈数据：${FEEDBACK_FILE}\n先跑 --feedback --label ai|human --zhuque <分>`);
  const rows = readFileSync(FEEDBACK_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const ai = rows.filter((r) => r.label === "ai");
  const human = rows.filter((r) => r.label === "human");
  if (!ai.length || !human.length) fail(`需要两类样本都有：当前 ai=${ai.length} / human=${human.length}，各攒 ≥5 条再校准`);

  const mean = (arr, id) => {
    const vals = arr.map((r) => r.rules[id] || 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const out = RULES.map((rule) => {
    const a = mean(ai, rule.id);
    const h = mean(human, rule.id);
    const sep = a - h; // 区分度：AI 样本明显更高说明该规则有效
    return {
      id: rule.id,
      label: rule.label,
      cur_weight: rule.weight,
      ai_mean: Number(a.toFixed(2)),
      human_mean: Number(h.toFixed(2)),
      separation: Number(sep.toFixed(2)),
      // 区分度为正才加权；负值说明该规则在反向指认，建议下调
      suggest_weight: Number(Math.max(0.3, rule.weight * (1 + sep * 2)).toFixed(1)),
    };
  }).sort((x, y) => y.separation - x.separation);

  log(`\n样本：AI ${ai.length} 篇 / 人写 ${human.length} 篇`);
  log("规则".padEnd(16) + "AI均值  人写均值  区分度  现权重 → 建议");
  for (const r of out) {
    log(
      `${r.label.padEnd(14)} ${String(r.ai_mean).padEnd(7)} ${String(r.human_mean).padEnd(9)} ${String(r.separation).padEnd(7)} ${r.cur_weight} → ${r.suggest_weight}`,
    );
  }
  const hitRate = rows.filter((r) => (r.local_score >= 30) === (r.label === "ai")).length / rows.length;
  log(`\n当前阈值（≥30 判 AI）与本批实测的一致率：${(hitRate * 100).toFixed(1)}%`);
  return { samples: { ai: ai.length, human: human.length }, rules: out, agreement: Number(hitRate.toFixed(3)) };
}

async function main() {
  if (args.calibrate) {
    const res = calibrate();
    emit({ ok: true, step: "calibrate", ...res });
    return;
  }

  const { text, title } = loadText();

  if (args.feedback) {
    const row = recordFeedback(text);
    emit({ ok: true, step: "feedback", recorded: row }, 0);
    return;
  }

  const r = scoreText(text);
  if (!args.quiet) {
    log(`\nAI 味预检：${title || "（无标题）"}（${r.stats.chars} 字 / ${r.stats.sentences} 句）`);
    log(`得分 ${r.score}/100 → ${r.level === "high" ? "高（大概率被检测出 AI）" : r.level === "medium" ? "中（建议润色）" : "低（接近人写）"}`);
    for (const h of r.hits) log(`  · [${h.strength}] ${h.label}${h.hits.length ? `：${h.hits[0]}` : ""}`);
    log("\n提示：这是本地预检，最终以朱雀实测为准；实测后可 --feedback 记录，--calibrate 校准规则权重");
  }

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "ai-flavor.json"), JSON.stringify({ ok: true, title, ...r }, null, 2) + "\n");
  }

  emit({ ok: true, title, ...r }, 0);
}

main().catch((e) => fail(e.message));
