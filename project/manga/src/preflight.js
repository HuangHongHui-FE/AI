import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 漫画推草稿前硬门：grep/正则程序化判定，不靠 LLM 自觉打勾。任一 FAIL 则 exit 1 拒推
// 用法：node src/preflight.js <article.json 路径>
// 与 wechat-img/preflight.js 区别：删六段全套门、删 AI 金句门、字数按 A/B 双线、新增图数门与原创可勾判定

const path = process.argv[2] ? resolve(process.argv[2]) : "article.json";
if (!existsSync(path)) {
  console.error(`✗ 找不到 article.json：${path}`);
  process.exit(2);
}
const a = JSON.parse(readFileSync(path, "utf8"));
const title = a.title || "";
const digest = a.digest || "";
const body = a.body_markdown || "";

// 字数：中文+数字+字母计，去 markdown 符号
const charCount = (s) =>
  (s || "")
    .replace(/[#>*_\-`>!\[\]()|]/g, "")
    .replace(/\s/g, "").length;

const fails = []; // FAIL：硬否决
const warns = []; // WARN：提示不阻断
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

// === 标题 ===
if (/(看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了)$/.test(title))
  fail(`标题"我X了"情绪尾收尾（低创铁证）：${title}`);
if (charCount(title) > 22) fail(`标题 ${charCount(title)} 字 >22：${title}`);
if (/(震惊|速看|刚刚|突发|曝光)/.test(title)) fail(`标题党词：${title}`);

// === 摘要 ===
if (charCount(digest) > 54) fail(`digest ${charCount(digest)} 字 >54`);
if (/[\n\r]/.test(digest)) fail("digest 含换行");
if (/https?:\/\//.test(digest)) fail("digest 含外链");

// === 正文硬门 ===
if (body.includes('"')) fail('body 含 ASCII 双引号"，须改用「」');
if (/\[[^\]]+\]\(https?:\/\//.test(body)) fail("body 含正文超链接，微信会屏蔽");
if (/据传|疑似|据说|有消息称|没法证实|有说法称|有人传/.test(body))
  fail('body 含存疑词（据传/疑似/据说等）——须删或改可查证事实');

// 禁用八股词（漫画长文线也避）
const BAN = [
  "值得注意的是",
  "总而言之",
  "此外",
  "综上所述",
  "综上",
  "在当今社会",
  "在快节奏的",
  "不仅如此",
  "不仅而且",
  "毋庸置疑",
  "众所周知",
  "由此可见",
  "应该说",
  "某种程度上",
];
for (const w of BAN) if (body.includes(w)) fail(`禁用词命中：${w}`);

// === 字数门（A/B 双线，与热点号不同）===
// A 线·少字看图（仿 wx1）：10-200 字；B 线·长文叙事（仿 wx2）：300-1500 字
const bc = charCount(body);
const line = a.line === "A" || a.line === "B" ? a.line : bc < 200 ? "A" : "B";
const RANGE = line === "A" ? [10, 200] : [300, 1500];
if (bc < RANGE[0])
  fail(`正文字数 ${bc} <${RANGE[0]}（${line} 线下限），须扩写或转另一线`);
if (bc > RANGE[1])
  fail(`正文字数 ${bc} >${RANGE[1]}（${line} 线上限），须精简或转另一线`);

// === 漫画图数门（新增，漫画至少 3 格才算漫画）===
const imgRefs = (body.match(/!\[[^\]]*\]\([^)]+\)/g) || []).filter((m) =>
  /!\[[^\]]*\]\((?!https?:\/\/)/.test(m),
);
if (imgRefs.length < 3)
  warn(`漫画图仅 ${imgRefs.length} 张 <3——像单图插画非漫画，建议补格`);

// === 原创可勾判定（新增）===
if (a.original_eligible === false)
  warn("此篇 original_eligible=false（搬运/非自绘），不可勾漫画原创，仅常规发表");

// === WARN（不阻断）===
const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
if (boldN > 8) warn(`加粗 ${boldN} 处过多，漫画正文宜少加粗`);
if (!/我/.test(body) && line === "B")
  warn("B 线长文未见第一人称落点（我/我们/我朋友）");
if (/我们应该|我们要学会|让我们珍惜|我们要/.test(body))
  warn("说教式结尾");

// === 报告 ===
console.log(`\npreflight：${a.title}`);
console.log(
  `字数：标题 ${charCount(title)} / 摘要 ${charCount(digest)} / 正文 ${bc}（${line} 线，范围 ${RANGE[0]}-${RANGE[1]}）`,
);
console.log(`漫画图 ${imgRefs.length} 张 / 加粗 ${boldN}`);
if (warns.length) {
  console.log("\n⚠ WARN：");
  for (const w of warns) console.log(`  - ${w}`);
}
if (fails.length) {
  console.log("\n✗ FAIL（拒推，回炉）：");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ 通过硬门，可推草稿");
