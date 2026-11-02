// 避撞分析：近 N 篇各维度已用值 + 扎堆警示 + 排除列表
import { readArticles, DIMENSIONS, EMOTION_TAIL } from "./logdims.mjs";

// 单个维度的重复统计：同值出现 ≥2 次即「扎堆」，本篇须强制换
function duplication(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].filter(([, c]) => c >= 2).map(([k, c]) => ({ value: k, count: c }));
}

// 主分析：返回结构化避撞结果，供 recipe 拼 prompt 或直接读
export function analyze(logsDir, n = 5) {
  const all = readArticles(logsDir);
  const recent = all.slice(0, n);

  // 逐维度：已用值列表 + 扎堆项 + 本篇应排除的值
  const dims = {};
  for (const [key, label] of DIMENSIONS) {
    const used = recent.filter((a) => a.dims[key]).map((a) => ({ id: a.id, no: a.no, value: a.dims[key] }));
    // 封面布局自 2026-08-27 起固定 plain，重复属预期，不告警也不排除
    const dup = key === "cover_style" ? [] : duplication(used.map((u) => u.value));
    dims[key] = { label, used, crowded: dup, exclude: [...new Set(used.map((u) => stripNo(u.value)))] };
  }

  // 标题贴原词去重：2026-08-27 起标题直接用热榜原词，查原词是否撞车
  const words = recent
    .filter((a) => a.dims.title_style)
    .map((a) => ({ id: a.id, word: a.dims.title_style.replace(/^贴原词-/, "") }));
  const wordDup = duplication(words.map((w) => w.word));

  // 标题情绪尾：近 N 篇超 2 篇即本周超限
  const emoTails = recent.filter((a) => EMOTION_TAIL.test(a.title)).map((a) => a.no);

  // 覆盖率守门：维度缺失=日志漏写，会让轮换变静默失效，必须显式告警
  const missing = recent
    .map((a) => ({ id: a.id, count: Object.keys(a.dims).length }))
    .filter((x) => x.count < DIMENSIONS.length - 2); // 允许 2 个字段天然缺失（无收口句式/口头禅）

  return {
    ok: true,
    total_articles: all.length,
    window: recent.map((a) => ({ id: a.id, title: a.title })),
    dims,
    title_words: { used: words, duplicated: wordDup },
    emotion_tail: { hits: emoTails, over_limit: emoTails.length >= 2 },
    coverage_warnings: missing,
  };
}

// 去掉值里的 "N-" 编号前缀，只留名字（排除列表按名字比，不按编号）
function stripNo(v) {
  return String(v || "").replace(/^\d+\s*-\s*/, "").trim();
}

// 渲染成可直接拼进写作 prompt 的文本
export function renderPrompt(res, n) {
  const lines = [];
  if (!res.total_articles) {
    lines.push(`（无历史日志，近 ${n} 篇各维 exclude 为空，首篇随机）`);
    return lines.join("\n");
  }
  lines.push(`## 近 ${res.window.length} 篇（${res.window.map((w) => w.id).join("、")}）已用维度——本篇须避开`);
  for (const [key, d] of Object.entries(res.dims)) {
    const vals = d.used.map((u) => `${u.no}:${u.value}`);
    const mark = d.crowded.length ? ` 【${d.crowded.map((c) => `⚠${c.value}×${c.count}`).join("、")}已扎堆，强制换】` : "";
    lines.push(`- ${d.label}：${vals.length ? vals.join(" | ") : "（无记录）"}${mark}`);
  }

  lines.push(`\n## 标题原词去重（贴原词规则）`);
  lines.push(`- ${res.title_words.used.length ? res.title_words.used.map((w) => w.word.slice(0, 18)).join(" | ") : "（无记录）"}`);
  if (res.title_words.duplicated.length)
    lines.push(`- ⚠ 原词重复：${res.title_words.duplicated.map((d) => `${d.value.slice(0, 16)}×${d.count}`).join("、")}——本篇须换原词`);

  lines.push(`\n## 反应式情绪尾标题统计`);
  lines.push(
    res.emotion_tail.over_limit
      ? `- ⚠ 近 ${res.window.length} 篇有 ${res.emotion_tail.hits.length} 篇走"我X了"情绪尾（${res.emotion_tail.hits.join("、")}），本周已超限，本篇禁用情绪尾`
      : `- ${res.emotion_tail.hits.length} 篇，未超限（限 2/周）`
  );

  if (res.coverage_warnings.length) {
    lines.push(`\n## ⚠ 日志漏写告警\n- 以下篇目维度记录不足（轮换去重会失效，须补写日志对应分节）：`);
    for (const w of res.coverage_warnings) lines.push(`  - ${w.id}：仅 ${w.count} 维`);
  }
  return lines.join("\n");
}
