import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 生成前读 logs，吐出近 N 篇各维度已用值 + 调性签名 + 标题情绪尾统计，供 Claude 直接拼进生成 prompt 做轮换去重
// 用法：node src/recent.js [N=5]

const N = Number(process.argv[2]) || 5;

// 各维度日志行标签 → 输出名（覆盖十一维 + 收口句式 + theme）
const DIMS = [
  ["title_style", "标题骨架"],
  ["收口方式", "收口方式"],
  ["收口句式", "收口句式"],
  ["开头钩子", "开头钩子"],
  ["结构配方", "结构配方"],
  ["叙事口吻", "叙事口吻"],
  ["切入角度", "切入角度"],
  ["段间衔接", "段间衔接"],
  ["cta提问类型", "CTA提问类型"],
  ["格式组合", "格式组合"],
  ["cover_style", "封面布局"],
  ["theme", "theme"],
  ["口头禅", "口头禅"],
];

// 标题骨架调性归类（防维度间隐性同质——单维不撞但调性扎堆仍是新公式）
const TONE_RULES = [
  ["反问", [/设问|留账|反问|二选一|归属/]],
  ["对仗", [/对仗|短句对仗/]],
  ["留白", [/留白|省略/]],
  ["转折", [/转折/]],
  ["对照", [/对照|新旧|此彼|对比/]],
  ["递进", [/递进|排比|递推/]],
  ["场景", [/场景|画面|白描/]],
  ["数据", [/数字|数据|stat/]],
  ["断言", [/断言|纠偏|陈述|点评|诊断|旁议/]],
];
function toneOf(val) {
  if (!val) return "—";
  for (const [t, regs] of TONE_RULES)
    if (regs.some((r) => r.test(val))) return t;
  return "其他";
}

// 反应式情绪尾词——被判低创的四篇全中此味，近 N 篇超 2 篇须警示
const EMOTION_TAIL = /看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了$/;

function scan() {
  const dir = "logs";
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
  } catch {
    return [];
  }
  // 通用行：组1=维度标签 组2=编号 组3=值（theme 旧格式是"01cool/02minimal"多值串，单独走专用正则避免误拆）
  const re = /(.{2,12}?)记录\(供下批避撞\)：\s*(\d+)[-－]?\s*([^\n。]+)/g;
  // theme 专用：仅认新格式"38 lavender"（单编号+单值），旧多值串由 index.js 用，此处跳过
  const themeRe = /theme\s*记录\(供下批避撞\)：\s*(\d+)\s+(\S+)/g;
  const rows = []; // {no, dim, val}
  for (const f of files) {
    const txt = readFileSync(join(dir, f), "utf8");
    let m;
    while ((m = re.exec(txt))) {
      if (/theme/.test(m[1])) continue; // theme 走专用正则
      rows.push({
        no: Number(m[2]),
        dim: m[1].trim(),
        val: m[3].trim().replace(/[（）()。].*$/, "").trim(),
      });
    }
    let tm;
    while ((tm = themeRe.exec(txt)))
      rows.push({ no: Number(tm[1]), dim: "theme", val: tm[2].replace(/[。]/g, "").trim() });
  }
  return rows.sort((a, b) => b.no - a.no);
}

function recentNos(rows, n) {
  // 取出现过的最大 n 个编号（不同维度同编号算一篇）
  const nos = [...new Set(rows.map((r) => r.no))].sort((a, b) => b - a);
  return nos.slice(0, n);
}

function main() {
  const rows = scan();
  if (!rows.length) {
    console.log(`（无历史日志，近 ${N} 篇各维 exclude 为空，首篇随机）`);
    return;
  }
  const nos = recentNos(rows, N);
  const usedByDim = {};
  for (const [tag, name] of DIMS) usedByDim[name] = [];
  for (const r of rows) {
    if (!nos.includes(r.no)) continue;
    const hit = DIMS.find(([tag]) => r.dim.includes(tag));
    if (hit) usedByDim[hit[1]].push(`${r.no}:${r.val}`);
  }

  console.log(`## 近 ${nos.length} 篇（编号 ${nos.join("、")}）已用维度——本篇须避开`);
  for (const [, name] of DIMS) {
    const v = usedByDim[name];
    // 同值撞形警示：近 N 篇里同一维度出现重复值，说明已扎堆，本篇该维须强制换
    const dup = {};
    for (const x of v) {
      const key = x.replace(/^\d+:/, "");
      dup[key] = (dup[key] || 0) + 1;
    }
    const dupMark = Object.entries(dup)
      .filter(([, c]) => c >= 2)
      .map(([k]) => `⚠${k}×${dup[k]}`);
    const tag = dupMark.length ? ` 【${dupMark.join("、")}已扎堆，强制换】` : "";
    console.log(`- ${name}：${v.length ? v.join(" | ") : "（无记录）"}${tag}`);
  }

  // 调性签名：取每篇标题骨架归类，统计分布
  const titleRows = rows.filter((r) => r.dim.includes("title_style") && nos.includes(r.no));
  const tones = titleRows.map((r) => toneOf(r.val));
  const dist = {};
  for (const t of tones) dist[t] = (dist[t] || 0) + 1;
  const pile = Object.entries(dist).filter(([, c]) => c >= 3);
  console.log(`\n## 调性签名分布（标题骨架调性）`);
  console.log(`- ${tones.map((t, i) => `${nos[i]}:${t}`).join(" | ")}`);
  if (pile.length)
    console.log(
      `- ⚠ 调性扎堆：${pile.map(([t, c]) => `${t}×${c}`).join("、")}——本篇标题须换到 ${pile.map(([t]) => t).join("/")} 以外的调性`,
    );

  // 标题情绪尾：直接扫日志"标题"列文本
  const tailNos = [];
  for (const f of readdirSync("logs").filter((f) => f.endsWith(".md")).sort().reverse()) {
    const txt = readFileSync(join("logs", f), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\|\s*(\d+)\s*\|[^|]*\|\s*([^|]+)\|/);
      if (m && nos.includes(Number(m[1])) && EMOTION_TAIL.test(m[2]))
        tailNos.push(Number(m[1]));
    }
  }
  console.log(`\n## 反应式情绪尾标题统计`);
  if (tailNos.length >= 2)
    console.log(
      `- ⚠ 近 ${nos.length} 篇有 ${tailNos.length} 篇标题走"我X了"情绪尾（${tailNos.join("、")}），本周已超限，本篇禁用情绪尾`,
    );
  else console.log(`- ${tailNos.length} 篇，未超限（限 2/周）`);
}

main();
