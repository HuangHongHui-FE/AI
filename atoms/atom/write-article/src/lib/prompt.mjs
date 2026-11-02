// 写作 prompt 组装：把「维度 + 事实 + 去重清单 + 硬约束」拼成可直接喂给模型的文本
// write-article 不自己生成正文——正文由 Claude 写，本原子负责把「这篇该长什么样」定死

import { pickAllDims, renderDimsPrompt } from "./dims.mjs";
import { BANNED_WORDS, BANNED_TICS, BANNED_SKELETONS, FIRST_PERSON_BAN, LENGTH, FACTS, ENRICHMENT, FORMAT_FLOOR, SELF_CHECK_ORDER } from "../../references/rules.mjs";

// 事实条目 → prompt 里的事实清单（标题 + 摘要 + 来源 + 链接 + 事件簇）
function renderFacts(facts = []) {
  if (!facts.length) return "（未提供事实，写作前必须先抓 ≥3 条可查证事实）";
  const lines = [];
  facts.forEach((f, i) => {
    lines.push(`${i + 1}. 【${f.publisher || "来源未标注"}】${f.title}`);
    if (f.abstract) lines.push(`   摘要：${f.abstract}`);
    if (f.url && !f.url_is_search) lines.push(`   链接：${f.url}`);
    if (f.cluster != null) lines.push(`   事件簇：#${f.cluster}`);
  });
  return lines.join("\n");
}

// 组装完整写作 prompt
// input: { topic, facts, dedup(可空), images(可空), extraDims }
export function buildPrompt({ topic, facts = [], dedup = null, images = 0, variants = {} }) {
  const picked = pickAllDims(dedup?.dims || {});
  const blocks = [];

  blocks.push(`# 写作任务：${topic}`);
  blocks.push("");

  // 1. 事实（先看事实，再看怎么写）
  blocks.push("## 可用事实（必须全部用上，且至少 3 条可查证）");
  blocks.push(renderFacts(facts));
  blocks.push("");

  // 2. 本篇维度（核心：结构约束）
  blocks.push(renderDimsPrompt(picked, { images }));
  blocks.push("");

  // 3. 近 N 篇已用维度（避撞）
  if (dedup?.prompt) {
    blocks.push("## 近篇已用维度（本篇须避开，⚠ 标记的强制换）");
    blocks.push(dedup.prompt);
    blocks.push("");
  }

  // 4. 硬约束
  blocks.push("## 硬约束（违反任一条即回炉）");
  blocks.push(`- **全文禁用第一人称**：「我」字 ≤${FIRST_PERSON_BAN.max_chars} 处。${FIRST_PERSON_BAN.caveat}`);
  for (const f of FIRST_PERSON_BAN.forms) blocks.push(`  - 禁：${f.form}（${f.example}）`);
  for (const r of FIRST_PERSON_BAN.replacements) blocks.push(`  - 改：${r.from} → ${r.to}`);
  blocks.push(`- **字数**：${LENGTH.min_chars}-${LENGTH.max_chars} 字`);
  blocks.push(`- **三件套至多用两件**：编号小标题 / 每段引言 / 每段加粗（三个全上=AI 痕迹，禁）`);
  blocks.push(`- **至少 ${FORMAT_FLOOR.min_non_text} 种非纯文字展现**：${FORMAT_FLOOR.options.join(" / ")}（${FORMAT_FLOOR.caution}）`);
  blocks.push(`- **≥${FACTS.min_verifiable} 条可查证事实**：人名/数字/时间/地点/当事人原话`);
  blocks.push(`- **事实段 ≥ 情绪段**；开头 1-2 段先讲清事件，分析放后面`);
  blocks.push(`- **升华段 ≥3 句**（从具体热点拔到普遍/历史/时代意义）`);
  blocks.push(`- **禁用词**：${BANNED_WORDS.join("、")}`);
  blocks.push(`- **禁用口头禅**（一周内不重复）：${BANNED_TICS.join("、")}`);
  blocks.push(`- **禁飞骨架**（换同义词不算改，必须换结构）：`);
  for (const s of BANNED_SKELETONS) blocks.push(`  - ${s.pattern} —— ${s.why} → ${s.fix}`);
  if (variants.title) blocks.push(`- **标题**：直接采用热点原词「${variants.title}」，≤22 字，非「我X了」情绪尾`);
  blocks.push("");

  // 5. 输出格式
  blocks.push("## 输出（严格按此 JSON）");
  blocks.push("```json");
  blocks.push(JSON.stringify({
    title: "≤22字，贴热点原词",
    digest: "≤54字摘要",
    body_markdown: "正文 markdown",
    theme: picked.dims.theme || "（由 format-html 抽）",
    dims: picked.dims,
  }, null, 2));
  blocks.push("```");
  blocks.push("");

  // 6. 自查顺序
  blocks.push("## 交稿前自查（按序过）");
  SELF_CHECK_ORDER.forEach((s, i) => blocks.push(`${i + 1}. ${s}`));

  return { prompt: blocks.join("\n"), dims: picked.dims, details: picked.details };
}
