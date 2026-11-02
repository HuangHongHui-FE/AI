// 维度抽取：从各池随机抽一个，排除近 N 篇已用值与禁用项
// 抽的是「骨架/结构」不是抽象标签——这是 2026-09-14 的教训：
// 池子抽抽象标签时，模型会用自己最顺手的句式去实现它，标签不同句式仍收敛

import { DIMENSION_POOLS, FORMAT } from "../../references/pools.mjs";

// 规范成日志里记的形态："N-名字"，供 dedup-log 跨篇比对
export function dimValue(item) {
  return `${item.no}-${item.name}`;
}

// 从原始值里剥出名字（"14-递归回扣式" → "递归回扣式"），用于与排除列表比对
export function stripNo(v) {
  return String(v || "").replace(/^\d+\s*-\s*/, "").trim();
}

// 随机抽一个不在 exclude 里、且未被禁用的池项
// exclude 形状：["递归回扣式", "结构观察", ...]（去编号的名字）
export function pickOne(pool, exclude = []) {
  const blocked = new Set(exclude.map(stripNo));
  const usable = pool.filter((it) => !it.banned && !blocked.has(it.name));
  // 全被排除时放开 exclude（但禁用项永远不抽），避免无解返回空
  const list = usable.length ? usable : pool.filter((it) => !it.banned);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// 抽格式组合：从 17 种里挑 4-6 种，避开近 N 篇的组合
// 已有组合形状：["3-加粗/6-引用块/11-数据卡", ...]
export function pickFormats(exclude = [], count = null) {
  const n = count || 4 + Math.floor(Math.random() * 3); // 4~6 种
  // 已有组合的元素名集合，用于算重合度
  const used = exclude.map((x) => new Set(String(x).split("/").map((s) => stripNo(s))));

  for (let attempt = 0; attempt < 30; attempt++) {
    const shuffled = [...FORMAT].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, n);
    const names = picked.map((p) => p.name);
    // 与任一历史组合重合 ≥80% 视为撞车，重抽
    const clash = used.some((u) => {
      const hit = names.filter((x) => u.has(x)).length;
      return hit / Math.min(names.length, u.size) >= 0.8;
    });
    if (!clash) return picked;
  }
  // 抽不到不撞的（池子小 + 排除多），退回随机
  return [...FORMAT].sort(() => Math.random() - 0.5).slice(0, n);
}

// 主入口：一次抽齐本篇所有维度
// used 是 dedup-log 的 dims（{维度键: {used:[{value}], crowded:[...], exclude:[...]}}）
export function pickAllDims(used = {}) {
  const dims = {};
  const details = {};

  for (const [key, { pool, label }] of Object.entries(DIMENSION_POOLS)) {
    const exclude = used?.[key]?.exclude || [];
    const item = pickOne(pool, exclude);
    if (!item) continue;
    dims[key] = dimValue(item);
    details[key] = { label, name: item.name, no: item.no, requirement: item.detail };
  }

  // 格式组合单独抽（多选而非单选）
  const fmtExclude = used?.format?.exclude || [];
  const formats = pickFormats(fmtExclude);
  dims.format = formats.map((f) => `${f.no}-${f.name}`).join("/");
  details.format = {
    label: "格式组合",
    name: formats.map((f) => f.name).join("+"),
    requirement: formats.map((f) => `${f.name}：${f.detail}`).join("；"),
  };

  return { dims, details };
}

// 渲染成写作 prompt 里的「本篇维度」段
export function renderDimsPrompt({ details }, extra = {}) {
  const lines = ["## 本篇写作维度（必须按此结构写，不许换成自己顺手的句式）", ""];
  const order = ["opening_skeleton", "opening_hook", "structure", "tone", "angle", "transition", "ending_skeleton", "ending_style", "format"];
  for (const key of order) {
    const d = details[key];
    if (!d) continue;
    lines.push(`- **${d.label}**：${d.name}${d.requirement ? ` —— ${d.requirement}` : ""}`);
  }
  if (extra.images != null) lines.push(`- **内文图**：${extra.images} 张`);
  return lines.join("\n");
}
