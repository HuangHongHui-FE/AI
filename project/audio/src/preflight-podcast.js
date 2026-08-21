import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 字数：中文+数字+字母计，去 markdown 符号
const charCount = (s) =>
  (s || "")
    .replace(/[#>*_\-`>!\[\]()|]/g, "")
    .replace(/\s/g, "").length;

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

const DOUBTFUL = /据传|疑似|据说|有消息称|没法证实|有说法称|有人传/;
const CLICKBAIT = /震惊|速看|刚刚|突发|曝光/;
const EMOTION_TAIL = /(看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了)$/;

function main() {
  const path = process.argv[2] ? resolve(process.argv[2]) : "article.json";
  if (!existsSync(path)) {
    console.error(`✗ 找不到 article.json：${path}`);
    process.exit(2);
  }

  const a = JSON.parse(readFileSync(path, "utf8"));
  const fails = [];
  const warns = [];
  const fail = (m) => fails.push(m);

  // 标题
  const title = a.title || "";
  if (!title.trim()) fail("缺少 title");
  if (charCount(title) > 22) fail(`标题 ${charCount(title)} 字 >22：${title}`);
  if (CLICKBAIT.test(title)) fail(`标题党词：${title}`);
  if (EMOTION_TAIL.test(title)) fail(`标题情绪尾：${title}`);

  // 摘要
  const digest = a.digest || "";
  if (!digest.trim()) fail("缺少 digest");
  if (charCount(digest) > 54) fail(`digest ${charCount(digest)} 字 >54`);
  if (/[\n\r]/.test(digest)) fail("digest 含换行");
  if (/https?:\/\//.test(digest)) fail("digest 含外链");

  // 封面标语
  const slogan = a.cover_slogan || "";
  if (!slogan.trim()) fail("缺少 cover_slogan");
  if (charCount(slogan) > 12) fail(`cover_slogan ${charCount(slogan)} 字 >12`);

  // CTA
  if (!(a.cta_question || "").trim()) fail("缺少 cta_question");
  if (!(a.cta_follow || "").trim()) fail("缺少 cta_follow");

  // 正文（shownotes）
  const body = a.body_markdown || "";
  if (!body.trim()) fail("缺少 body_markdown");
  if (body.includes('"')) fail('body 含 ASCII 双引号"，须改用「」');
  if (/\[[^\]]+\]\(https?:\/\//.test(body)) fail("body 含正文超链接");
  if (DOUBTFUL.test(body)) fail("body 含存疑词");
  const bc = charCount(body);
  if (bc < 800) fail(`正文 ${bc} 字 <800，须扩写`);
  if (bc > 1200) fail(`正文 ${bc} 字 >1200，须精简`);

  const sixH = [/## 一/, /## 二/, /## 三/, /## 四/, /## 五/, /## 六/].every((r) => r.test(body));
  const quoteN = (body.match(/^> /gm) || []).length;
  const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
  if (sixH && quoteN >= 3 && boldN >= 6)
    fail(`六段全套（##一~六+引言${quoteN}+加粗${boldN}）——同质化铁证`);

  for (const w of BAN) if (body.includes(w)) fail(`正文禁用词：${w}`);

  // 脚本（完整音频稿）
  const script = a.script || "";
  if (!script.trim()) fail("缺少 script（完整音频稿）");
  const sc = charCount(script);
  if (sc < 1800) fail(`script ${sc} 字 <1800，音频会过短`);
  if (sc > 2200) fail(`script ${sc} 字 >2200，音频会超过 10 分钟`);
  if (script.includes('"')) fail('script 含 ASCII 双引号"，须改用「」');
  if (/[#*_`\[\]!]/.test(script)) warn("script 可能含 markdown 符号，朗读前会被清理");

  // 报告
  console.log(`\npreflight-podcast：${title}`);
  console.log(`字数：标题 ${charCount(title)} / 摘要 ${charCount(digest)} / 正文 ${bc} / 脚本 ${sc}`);
  if (warns.length) {
    console.log("\n⚠ WARN：");
    for (const w of warns) console.log(`  - ${w}`);
  }
  if (fails.length) {
    console.log("\n✗ FAIL（拒推，回炉）：");
    for (const f of fails) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n✓ 通过播客硬门，可推草稿");
}

main();
