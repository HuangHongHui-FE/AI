import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 推草稿前硬门：grep/正则程序化判定，不靠 LLM 自觉打勾。任一 FAIL 则 exit 1 拒绝推送
// 用法：node src/preflight.js <article.json 路径>

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
  fail(`标题"我X了"情绪尾收尾（被判低创的四篇全此格式）：${title}`);
if (charCount(title) > 22) fail(`标题 ${charCount(title)} 字 >22：${title}`);
// 曝光是正当新闻动词（如「央视曝光」是蹭度硬杠杆），不算纯煽动标题党词，故不拦
if (/(震惊|速看|刚刚|突发)/.test(title)) fail(`标题党词：${title}`);

// === 摘要 ===
if (charCount(digest) > 54) fail(`digest ${charCount(digest)} 字 >54`);
if (/[\n\r]/.test(digest)) fail("digest 含换行");
if (/https?:\/\//.test(digest)) fail("digest 含外链");

// === 正文硬门 ===
if (body.includes('"')) fail('body 含 ASCII 双引号"，须改用「」');
if (/\[[^\]]+\]\(https?:\/\//.test(body)) fail("body 含正文超链接，微信会屏蔽");
if (/据传|疑似|据说|有消息称|没法证实|有说法称|有人传/.test(body))
  fail('body 含存疑词（据传/疑似/据说等）——官方"引用存疑数据"低信息量铁证，须删或改可查证事实');

// 六段全套：## 一~六 全在 + 引言 ≥3 + 加粗 ≥6 → 三件套同框
const sixH = [/## 一/, /## 二/, /## 三/, /## 四/, /## 五/, /## 六/].every((r) => r.test(body));
const quoteN = (body.match(/^> /gm) || []).length;
const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
if (sixH && quoteN >= 3 && boldN >= 6)
  fail(`六段全套（##一~六+引言${quoteN}+加粗${boldN}）——三件套同框=同质化铁证`);

// 字数
const bc = charCount(body);
if (bc < 800) fail(`正文字数 ${bc} <800，须扩写`);
if (bc > 1200) fail(`正文字数 ${bc} >1200，须精简`);

// 禁用词
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
  "既...又",
  "既...又...",
  "毋庸置疑",
  "众所周知",
  "由此可见",
  "应该说",
  "某种程度上",
];
for (const w of BAN) if (body.includes(w)) fail(`禁用词命中：${w}`);

// AI 金句句式 ≥3（保守匹配，命中即统计）
const aiHits = [
  ...body.matchAll(/的尽头[是是]/g),
  ...body.matchAll(/不是[^，。\n]{1,10}是[^，。\n]{1,10}/g),
  ...body.matchAll(/更(真|重|深)/g),
].length;
if (aiHits >= 3) fail(`AI 金句句式 ${aiHits} 处 ≥3——低价值 AIGC`);

// === WARN（不阻断）===
if (boldN > 6) warn(`加粗 ${boldN} 处过多，全篇加粗等于没加粗`);
if (!/我/.test(body)) warn("未见第一人称落点（我/我们家/我朋友）");
if (/我们应该|我们要学会|让我们珍惜|我们要/.test(body)) warn("说教式结尾");
const paras = body.split(/\n\n+/).filter((p) => p.trim());
const lens = paras.map((p) => p.length);
if (paras.length >= 4 && lens.every((l) => Math.abs(l - lens[0]) < 20))
  warn("段落全等长，须长短不齐");

// === 报告 ===
console.log(`\npreflight：${a.title}`);
console.log(`字数：标题 ${charCount(title)} / 摘要 ${charCount(digest)} / 正文 ${bc}`);
console.log(`加粗 ${boldN} / 引言 ${quoteN} / 段落 ${paras.length}`);
if (warns.length) console.log("\n⚠ WARN：");
for (const w of warns) console.log(`  - ${w}`);
if (fails.length) {
  console.log("\n✗ FAIL（拒推，回炉）：");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ 通过硬门，可推草稿");
