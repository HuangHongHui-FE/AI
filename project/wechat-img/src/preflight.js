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
// 情绪尾正则：2026-09-14 由 darwinian_evolver 在 656 篇历史稿上进化得出
// （旧正则只认 8 个词，漏检 129 篇判罚期坏稿里的「愣住了/想了想/眼眶热了/扎心了」等变体）
const TAIL_RE = /[，,][^，,。！？!?；;]{0,12}(?:愣|想|笑|哭|懵|慌|呆|傻|怔|酸|疼|暖|热|冷|服|乐|气|怂|麻|破防|无语|沉默|感动|激动|头疼|心累|脸红|眼红|眼眶|鼻子|心里|热血|扎心|破房|上头|下头|emo)[^，,。！？!?；;]{0,6}(?:了|着|半天)$/;
if (TAIL_RE.test(title))
  fail(`标题"我X了"情绪尾收尾（被判低创的批次全此格式）：${title}`);
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

const quoteN = (body.match(/^> /gm) || []).length;
const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
const sixH = [/## 一/, /## 二/, /## 三/, /## 四/, /## 五/, /## 六/].every((r) => r.test(body));

// AI 金句句式计数（进化门与下方 FAIL 共用）
const aiHitsRaw = (s) =>
  [...s.matchAll(/的尽头[是是]/g), ...s.matchAll(/不是[^，。\n]{1,10}是[^，。\n]{1,10}/g), ...s.matchAll(/更(真|重|深)/g)].length;

// 字数
const bc = charCount(body);

// 风格启发式加权门：2026-09-14 由 darwinian_evolver 从 656 篇历史稿进化得出
// 旧「六段全套」用 引言≥3 触发，实测 434 篇坏稿里引言数最多只有 1 → 该检测从未触发过（死代码）
// 现改为加权累加，单条信号不再独立毙稿（进化发现「字数短」单独不该拦）
const STYLE = [
  ["情绪尾标题", TAIL_RE.test(title), 1.6],
  ["六段全套", sixH && quoteN >= 1 && boldN >= 1, 1.4],
  ["正文偏短", bc < 800, 0.8],
  ["正文偏长", bc > 1200, 0.9],
  ["AI金句堆砌", aiHitsRaw(body) >= 3, 1.0],
];
const styleHits = STYLE.filter(([, hit]) => hit);
const styleScore = styleHits.reduce((s, [, , w]) => s + w, 0);
if (styleScore >= 1.1)
  fail(
    `风格分 ${styleScore.toFixed(1)} ≥1.1（${styleHits.map(([n, , w]) => `${n}${w}`).join("+")}）——低创作度/同质化风险`,
  );

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

// AI 金句句式 ≥3 已并入上方风格加权门（权重 1.0），此处不再重复独立 FAIL

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
