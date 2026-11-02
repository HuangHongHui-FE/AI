// 事实卡校验：先有事实，后有文章。每条时间节点必须自带来源，日期必须可校验
// 设计原则（自 event-thread/src/facts.js 迁入并加强）：
//   - 无来源的节点不许进发布流程
//   - 日期写「近日/近日」这类模糊词一律拒绝——查不实就是没查
//   - 时间线必须单调不减，否则叙事顺序错乱

// 日期精度三档：YYYY-MM（只查到月）/ YYYY-MM-DD / YYYY-MM-DDTHH:mm
// 「只查到月」时不许补 -01 假装精确到日
const DATE_RE = /^\d{4}-\d{2}(-\d{2}(T\d{2}:\d{2})?)?$/;

// 模糊时间词：出现在 date 字段里说明日期没查实，硬拦
const VAGUE_WORDS = [
  "近日", "日前", "最近", "近期", "前不久", "不久前", "某日", "某天",
  "月初", "月末", "上旬", "中旬", "下旬", "年底", "年初", "年中", "当天", "近日来",
];

// 节点重要度：turning/climax 会在渲染时加粗
const LEVELS = ["normal", "major", "turning", "climax"];

// 把不同精度日期归一成可比较 key：缺的补 00，使「2019-09」排在「2019-09-30」之前
export function dateKey(d) {
  const [ymd, hm] = String(d).split("T");
  const parts = ymd.split("-");
  while (parts.length < 3) parts.push("00");
  return `${parts.join("-")}${hm ? `T${hm}` : ""}`;
}

// 校验单个时间节点，返回错误信息数组（空数组 = 通过）
export function validateNode(node, index, today) {
  const errs = [];
  const tag = `节点[${index}]${node.date ? ` ${node.date}` : ""}`;

  if (!node.date) errs.push(`${tag}：缺少 date`);
  else if (!DATE_RE.test(String(node.date))) {
    if (VAGUE_WORDS.some((w) => String(node.date).includes(w)))
      errs.push(`${tag}：date 是模糊时间词「${node.date}」——必须查实到具体日期`);
    else
      errs.push(`${tag}：date 格式须为 YYYY-MM / YYYY-MM-DD / YYYY-MM-DDTHH:mm，实际「${node.date}」`);
  } else if (today && dateKey(node.date).slice(0, 10) > today) {
    errs.push(`${tag}：date 晚于今天（${today}）——事件尚未发生或日期填错`);
  }

  if (!node.title) errs.push(`${tag}：缺少 title`);

  // 来源是硬要求：每个节点至少一条可追溯来源
  if (!Array.isArray(node.sources) || node.sources.length === 0) {
    errs.push(`${tag}：必须有至少一条 sources（无来源的节点不许发布）`);
  } else {
    node.sources.forEach((s, si) => {
      if (!s || !s.title) errs.push(`${tag}：sources[${si}] 缺少 title`);
      if (!s || !s.url) errs.push(`${tag}：sources[${si}] 缺少 url`);
      else if (!/^https?:\/\//.test(String(s.url)))
        errs.push(`${tag}：sources[${si}].url 不是 http(s) 链接：「${s.url}」`);
    });
  }

  if (node.level && !LEVELS.includes(node.level))
    errs.push(`${tag}：level 只能是 ${LEVELS.join("/")}，实际「${node.level}」`);

  return errs;
}

// 校验整张事实卡：返回 { ok, errors, warnings, stats }
// today 用于拦截「日期晚于今天」；不传则跳过该项（纯离线校验场景）
export function validateEvent(ev, today = null) {
  const errors = [];
  const warnings = [];

  if (!ev) return { ok: false, errors: ["事实卡为空"], warnings, stats: {} };

  for (const f of ["slug", "name", "summary"]) {
    if (!ev[f]) errors.push(`顶层缺少字段 ${f}`);
  }
  if (!Array.isArray(ev.nodes) || ev.nodes.length === 0) {
    errors.push("顶层缺少 nodes 或 nodes 为空");
    return { ok: false, errors, warnings, stats: {} };
  }

  ev.nodes.forEach((n, i) => errors.push(...validateNode(n, i, today)));

  // 时间线必须单调不减，否则叙事顺序错乱
  // 只比较格式合法的日期——非法日期（如「近日」）已单独报错，混进来会连带误报
  for (let i = 1; i < ev.nodes.length; i++) {
    const ra = ev.nodes[i - 1].date;
    const rb = ev.nodes[i].date;
    if (!DATE_RE.test(String(ra || "")) || !DATE_RE.test(String(rb || ""))) continue;
    if (dateKey(rb) < dateKey(ra))
      errors.push(`时间线乱序：节点[${i}]（${rb}）早于节点[${i - 1}]（${ra}）`);
  }

  // WARN：来源单一片面（全卡只有 1 家的多条来源）与存疑节点比例
  const publishers = new Set();
  let lowConfidence = 0;
  for (const n of ev.nodes) {
    for (const s of n.sources || []) if (s.publisher) publishers.add(s.publisher);
    if (n.confidence === "low") lowConfidence++;
  }
  if (ev.nodes.length >= 3 && publishers.size === 1)
    warnings.push(`全卡 ${ev.nodes.length} 个节点只有 1 家来源（${[...publishers][0]}），建议补第 2 源`);
  if (lowConfidence)
    warnings.push(`${lowConfidence}/${ev.nodes.length} 个节点标记 confidence=low，正文须体现不确定性`);

  // 日期精度统计：只查到月份的节点占比过高说明核查不够细
  const monthOnly = ev.nodes.filter((n) => DATE_RE.test(String(n.date || "")) && String(n.date).length === 7).length;
  if (monthOnly && monthOnly / ev.nodes.length > 0.5)
    warnings.push(`${monthOnly}/${ev.nodes.length} 个节点只精确到月，建议补到日`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      nodes: ev.nodes.length,
      publishers: publishers.size,
      month_only: monthOnly,
      low_confidence: lowConfidence,
      first_date: ev.nodes[0]?.date || "",
      last_date: ev.nodes[ev.nodes.length - 1]?.date || "",
      ongoing: !ev.ended,
    },
  };
}

// 事件当前是否仍在发展中（ended 为空 = 梳理到最新时间点）
export function isOngoing(ev) {
  return !ev.ended;
}

// 按 parts 定义切分时间线：parts=[{title, until}]，断点落在叙事边界而非节点数均分
// 关键：切完最后一篇时【不能 break】——与最后边界同日的其余节点会被静默丢弃（2026-10-18 实踩）
export function splitByParts(nodes, ev) {
  const parts = ev.parts;
  if (!Array.isArray(parts) || !parts.length) return null;

  const chunks = [];
  let cur = [];
  let pi = 0;
  for (const n of nodes) {
    cur.push(n);
    const until = parts[pi]?.until;
    if (until && dateKey(n.date) >= dateKey(until)) {
      chunks.push({
        nodes: cur,
        title: parts[pi].title,
        digest: parts[pi].digest,
        summary: parts[pi].summary,
        closing: parts[pi].closing,
      });
      cur = [];
      pi++;
      // 不 break：pi 越界后 parts[pi] 为 undefined，until 自然为假，剩余节点累积并入末篇
    }
  }
  if (cur.length) {
    if (chunks.length) chunks[chunks.length - 1].nodes.push(...cur);
    else chunks.push({ nodes: cur, title: parts[0]?.title || "", digest: parts[0]?.digest, summary: parts[0]?.summary, closing: parts[0]?.closing });
  }
  return chunks;
}
