import { readArticles } from "./logdims.js";

// 生成前读 logs，吐出近 N 篇各维度已用值 + 调性签名 + 标题情绪尾统计，供 Claude 直接拼进生成 prompt 做轮换去重
// 用法：node src/recent.js [N=5]
// 解析统一走 src/logdims.js（原先自带的解析只认旧格式，2026-08 格式变更后静默失效、十一个维度全空）

const N = Number(process.argv[2]) || 5;

// 各维度统一名 → 输出名（覆盖十一维 + 收口句式 + theme）
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

// 标题骨架调性归类——仅对旧「标题骨架」池有效；2026-08-27 起标题改为「贴原词」，
// 该归类恒返回「其他」，故不再输出调性分布，改为检查原词重复（见下）。

// 反应式情绪尾词——被判低创的批次全中此味，近 N 篇超 2 篇须警示
const EMOTION_TAIL = /看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了$/;

function main() {
  const all = readArticles();
  if (!all.length) {
    console.log(`（无历史日志，近 ${N} 篇各维 exclude 为空，首篇随机）`);
    return;
  }
  const recent = all.slice(0, N);

  console.log(`## 近 ${recent.length} 篇（${recent.map((a) => a.id).join("、")}）已用维度——本篇须避开`);
  for (const [key, name] of DIMS) {
    const v = recent.filter((a) => a.dims[key]).map((a) => `${a.no}:${a.dims[key]}`);
    // 撞形警示：近 N 篇里同一维度出现重复值 = 已扎堆，本篇该维须强制换
    // （封面布局自 2026-08-27 起固定 plain，重复属预期，不告警）
    const dup = {};
    for (const x of v) {
      const k = x.replace(/^\d+:/, "");
      dup[k] = (dup[k] || 0) + 1;
    }
    const dupMark =
      name === "封面布局"
        ? []
        : Object.entries(dup)
            .filter(([, c]) => c >= 2)
            .map(([k, c]) => `⚠${k}×${c}`);
    const tag = dupMark.length ? ` 【${dupMark.join("、")}已扎堆，强制换】` : "";
    console.log(`- ${name}：${v.length ? v.join(" | ") : "（无记录）"}${tag}`);
  }

  // 标题贴原词去重：2026-08-27 起标题直接用热榜原词，故查原词是否撞车（替代旧调性分析）
  const words = recent.filter((a) => a.dims.title_style).map((a) => a.dims.title_style.replace(/^贴原词-/, ""));
  const wdup = {};
  for (const w of words) wdup[w] = (wdup[w] || 0) + 1;
  console.log(`\n## 标题原词去重（贴原词规则）`);
  console.log(`- ${words.length ? words.map((w) => w.slice(0, 18)).join(" | ") : "（无记录）"}`);
  const hit = Object.entries(wdup).filter(([, c]) => c >= 2);
  if (hit.length) console.log(`- ⚠ 原词重复：${hit.map(([w, c]) => `${w.slice(0, 16)}×${c}`).join("、")}——本篇须换原词`);

  // 标题情绪尾：扫近 N 篇标题
  const tailNos = recent.filter((a) => EMOTION_TAIL.test(a.title)).map((a) => a.no);
  console.log(`\n## 反应式情绪尾标题统计`);
  if (tailNos.length >= 2)
    console.log(
      `- ⚠ 近 ${recent.length} 篇有 ${tailNos.length} 篇标题走"我X了"情绪尾（${tailNos.join("、")}），本周已超限，本篇禁用情绪尾`,
    );
  else console.log(`- ${tailNos.length} 篇，未超限（限 2/周）`);

  // 覆盖率守门：维度缺失=日志漏写，会把轮换去重变成静默失效，必须显式告警
  const missing = recent
    .map((a) => ({ id: a.id, n: Object.keys(a.dims).length }))
    .filter((x) => x.n < DIMS.length - 2); // 允许 2 个字段天然缺失（如无收口句式/口头禅）
  if (missing.length)
    console.log(
      `\n## ⚠ 日志漏写告警\n- 以下篇目维度记录不足（轮换去重会失效，须补写 logs/ 里对应分节）：\n` +
        missing.map((x) => `  - ${x.id}：仅 ${x.n} 维`).join("\n"),
    );
}

main();
