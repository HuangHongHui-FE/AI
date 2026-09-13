import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 统一解析 logs/*.md 的写作维度记录，供 recent.js（喂 prompt 做轮换去重）与 index.js（theme 避撞）共用。
// 抽成共享模块是因为原先两个脚本各写一套正则解析同一份日志，格式一变就双双静默失效（2026-08 实况）。
//
// 日志格式经历两代，此处同时兼容：
//   格式A（~2026-08-20）：- 收口方式记录(供下批避撞)：38-2 追问留白式。   ← 机读行，自带文章编号
//   格式B（2026-08-27~ 现行）：## 06 | 标题 分节内写 - 收口方式：2-警示反思式（备注）  ← 编号在分节标题

// 维度标签 → 统一输出名（与日志字段、下游消费方对齐）
const LABELS = {
  title_style: "title_style",
  收口方式: "收口方式",
  收口句式骨架: "收口句式",
  收口句式: "收口句式",
  开头钩子: "开头钩子",
  结构配方: "结构配方",
  叙事口吻: "叙事口吻",
  切入角度: "切入角度",
  段间衔接: "段间衔接",
  cta提问类型: "cta提问类型",
  格式组合: "格式组合",
  "排版 theme": "theme",
  theme: "theme",
  封面布局: "cover_style",
  cover_style: "cover_style",
  口头禅: "口头禅",
};

// 去掉括号备注与句末标点，规范成 "N-名字" 形态；无编号的值原样保留
function normVal(rest) {
  const v = String(rest)
    .split(/[（(]/)[0]
    .trim()
    .replace(/[。；;，,]$/, "")
    .trim();
  const m = v.match(/^(\d+)\s*[-－]\s*(.+)$/);
  return m ? `${m[1]}-${m[2].trim()}` : v;
}

// 从一段文本里抓「- 维度名：值」形态的行（格式B），返回 {维度: 值}
function parseLabeled(text) {
  const dims = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*]\s*([^：:]{2,14}?)\s*[:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const key = LABELS[m[1].trim()];
    if (key && !dims[key]) dims[key] = normVal(m[2]);
  }
  return dims;
}

// 抓格式A的机读行「维度名记录(供下批避撞)：N值」，返回 [{no, dim, val}]
function parseLegacy(text) {
  const re = /(.{2,12}?)记录\s*\(供下批避撞\)\s*[:：]\s*(\d+)\s*[-－]?\s*([^\n。]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const key = LABELS[m[1].trim()];
    if (!key || /theme/i.test(m[1])) continue; // theme 走专用分支（旧格式是多值串）
    out.push({ no: Number(m[2]), dim: key, val: normVal(m[3]) });
  }
  // theme 旧格式是 "01cool/02minimal" 多值串，逐个拆
  const tRe = /theme\s*记录\s*\(供下批避撞\)\s*[:：]\s*([0-9]+[a-zA-Z]+(?:\/[0-9]+[a-zA-Z]+)*)/g;
  while ((m = tRe.exec(text))) {
    for (const part of m[1].split("/")) {
      const pm = part.match(/^(\d+)([a-zA-Z]+)$/);
      if (pm) out.push({ no: Number(pm[1]), dim: "theme", val: pm[2] });
    }
  }
  return out;
}

// 读全部日志，返回按时序倒序的文章数组 [{id, date, no, title, dims}]
export function readArticles() {
  let files = [];
  try {
    files = readdirSync("logs")
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
  } catch {
    return [];
  }

  const articles = [];
  for (const f of files) {
    const date = f.replace(/\.md$/, "");
    let text;
    try {
      text = readFileSync(join("logs", f), "utf8");
    } catch {
      continue;
    }

    // 按 "## NN | 标题" 分节（格式B）
    const secs = [...text.matchAll(/^##\s*(\d+)\s*\|\s*(.+?)\s*$/gm)];
    if (secs.length) {
      secs.forEach((s, i) => {
        const start = s.index + s[0].length;
        const end = i + 1 < secs.length ? secs[i + 1].index : text.length;
        const body = text.slice(start, end);
        const dims = parseLabeled(body);
        for (const r of parseLegacy(body)) dims[r.dim] ??= r.val;
        articles.push({ id: `${date}#${s[1]}`, date, no: Number(s[1]), title: s[2], dims, order: i });
      });
      continue;
    }

    // 无分节则退回格式A，按文章编号归组
    const rows = parseLegacy(text);
    // 旧日志的标题在表格行「| NN | 标题 | 话题 | media_id |」里
    const titles = new Map();
    for (const line of text.split("\n")) {
      const tm = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/);
      if (tm && !/^\s*(#|标题|---)/.test(tm[2])) titles.set(Number(tm[1]), tm[2].trim());
    }
    const byNo = new Map();
    for (const r of rows) {
      if (!byNo.has(r.no)) byNo.set(r.no, {});
      byNo.get(r.no)[r.dim] ??= r.val;
    }
    for (const [no, dims] of byNo)
      articles.push({ id: `${date}#${no}`, date, no, title: titles.get(no) || "", dims, order: no });
  }

  // 时序倒序：日期新→旧，同日按分节顺序倒序（日志按发布顺序写）
  articles.sort((a, b) => (a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1));
  return articles;
}

// 取最近 N 篇用过的 theme，供 index.js 做避撞
export function readRecentThemes(n = 5) {
  return readArticles()
    .slice(0, n)
    .map((a) => a.dims.theme)
    .filter(Boolean);
}
