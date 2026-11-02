#!/usr/bin/env node
// 回归：把 project 历史稿逐篇跑新引擎与旧 preflight，对比 FAIL 判定是否一致
// 用法：node atom/selfcheck/fixtures/regression.mjs [--limit 200] [--verbose]
// 退出码：0 = 所有稿件判定一致；1 = 存在不一致（逐条打印差异）

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selfcheck } from "../src/lib/engine.mjs";
import { RULESETS } from "../references/rulesets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// 旧实现位置由参数传入，不写死——本仓库约束是 atom 内零业务路径
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};

const SRC_ROOT = argOf("src-root", "");
const OLD_PREFLIGHT = argOf("old-preflight", "");
const LIMIT = Number(argOf("limit", "0"));
const VERBOSE = args.includes("--verbose");

// 无源项目参数时跑内嵌用例（自带稿件 + 期望判定），保证 CI/新机器也能验证规则
const SELF_MODE = !SRC_ROOT || !OLD_PREFLIGHT;

// 递归收集所有 article.json
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (name === "article.json") out.push(p);
  }
  return out;
}

// 跑旧 preflight：exit 1 = FAIL，exit 0 = PASS
function oldVerdict(file) {
  const res = spawnSync(process.execPath, [OLD_PREFLIGHT, file], { encoding: "utf8" });
  return { fail: res.status === 1, out: res.stdout + res.stderr };
}

if (SELF_MODE) {
  runSelfCases();
} else {
  runAgainstSource();
}

// ── 内嵌用例：每条规则一组「应拦 / 应放行」，不依赖外部数据 ──
function runSelfCases() {
  const ruleset = RULESETS["wechat-img"];
  // 基线：一篇合规稿（用 .repeat 撑到 800 字以上，句长有长短变化）
  const goodBody = [
    "10月20日凌晨，南沙群岛仙宾礁附近海域，一艘美国军舰驶了进来。",
    "通报很短。",
    "南部战区用了不到百字：未经中国政府允许，冲闯中国领海，海军组织兵力依法依规跟踪监视。",
    "当天中午，发言人尹刚海军大校就此事发表谈话。",
    "这型舰满载排水量约3100吨。",
    "它2019年在南卡罗来纳州服役，属于独立级濒海战斗舰，主打近海机动。",
    "数据显示，近十年美方舰机在南海的活动频次有公开记录可查。",
    "2023年的一次类似事件中，中方处置方式与这次几乎一致。",
    "跟踪监视。",
    "海军研究人士指出，措辞的稳定性恰恰降低了海上误判空间，因为海上相遇的每一个动作都可能被放大解读。",
    "规则的价值不在于强硬，而在于可预期。",
    "1962年的古巴导弹危机，美苏舰艇在封锁线上多次近距离接触，双方事后都承认，正是事先约定的处置规则避免了擦枪走火。",
    "冷战四十年，美苏海军在地中海的相遇次数以千计。",
    "真正升级为冲突的屈指可数。",
    "这些经验，对今天的南海同样适用。",
    "仙宾礁的海面上，留下一道航迹。",
    "很快就散了。",
  ].join("\n\n");

  const base = { title: "美舰冲闯南沙仙宾礁，南部战区回应", digest: "10月20日凌晨相关海域发生一起冲闯事件。", body_markdown: goodBody };

  const cases = [
    ["基线合规稿", base, true],
    ["标题超22字", { ...base, title: "美舰冲闯中国南沙群岛仙宾礁附近海域南部战区海军组织兵力跟踪监视" }, false],
    ["标题情绪尾", { ...base, title: "美舰闯南沙，我看懵了" }, false],
    ["标题党词", { ...base, title: "震惊！美舰闯南沙" }, false],
    ["摘要超54字", { ...base, digest: "一二三四五六七八九十".repeat(6) }, false],
    ["正文含ASCII引号", { ...base, body_markdown: goodBody + '\n\n他说"这不对"。' }, false],
    ["正文含外链", { ...base, body_markdown: goodBody + "\n\n[链接](https://x.com)" }, false],
    ["正文含存疑词", { ...base, body_markdown: goodBody + "\n\n据传此事另有隐情。" }, false],
    ["第一人称熟人", { ...base, body_markdown: goodBody + "\n\n我认识个跑船的朋友讲过。" }, false],
    ["第一人称超量", { ...base, body_markdown: goodBody + "\n\n我看了，我想了，我认为。" }, false],
    ["整句模板", { ...base, body_markdown: goodBody + "\n\n这不就是明摆着的事吗" }, false],
    ["结尾不是X是Y", { ...base, body_markdown: goodBody + "\n\n这不是强硬，而是克制。" }, false],
    ["结尾说到底", { ...base, body_markdown: goodBody + "\n\n说到底，规则比强硬重要。" }, false],
    ["开头短句起", { ...base, body_markdown: "凌晨三点。海面上起了雾。\n\n" + goodBody }, false],
    ["句长过 Uniform", { ...base, body_markdown: Array(12).fill("这是一句长度完全相同用于测试节奏单调的中文句子。").join("") }, false],
  ];

  let pass = 0;
  for (const [name, article, expectOk] of cases) {
    const r = selfcheck(article, ruleset);
    const ok = r.ok === expectOk;
    if (ok) pass++;
    console.log(`${ok ? "✓" : "✗"} ${name}（期望 ${expectOk ? "通过" : "拦截"}，实际 ${r.ok ? "通过" : "拦截"}）`);
    if (!ok && r.fails.length) console.log(`    判据：${r.fails.map((f) => f.id).join(", ")}`);
  }
  console.log(`\n内嵌用例 ${pass}/${cases.length} 通过`);
  // 外部源对比作为可选增强，缺失时不判失败
  console.log("（未提供 --src-root/--old-preflight，跳过 668 篇历史稿对比）");
  process.exit(pass === cases.length ? 0 : 1);
}

// ── 与源项目历史稿对比 ──
function runAgainstSource() {
  const ruleset0 = RULESETS["wechat-img"];
  void ruleset0;
const files = collect(SRC_ROOT).sort();
const sample = LIMIT > 0 ? files.slice(0, LIMIT) : files;
console.log(`历史稿 ${files.length} 篇，本轮对比 ${sample.length} 篇\n`);

const ruleset = RULESETS["wechat-img"];
let same = 0;
let diff = 0;
const diffs = [];

for (const file of sample) {
  let article;
  try {
    article = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  if (!article.body_markdown) continue;

  const mine = selfcheck(article, ruleset);
  const old = oldVerdict(file);
  if (mine.ok !== !old.fail) {
    diff++;
    diffs.push({ file, mineFail: !mine.ok, oldFail: old.fail, mine, oldOut: old.out });
    if (VERBOSE) {
      console.log(`✗ ${file.slice(SRC_ROOT.length)} — 新=${mine.ok ? "PASS" : "FAIL"} 旧=${old.fail ? "FAIL" : "PASS"}`);
      console.log(`  新判据: ${mine.fails.map((f) => f.id).join(", ") || "（无）"}`);
    }
  } else same++;
}

console.log(`\n一致 ${same} / 不一致 ${diff}（一致率 ${((same / (same + diff)) * 100).toFixed(1)}%）`);

// 归类不一致原因：新判 FAIL 旧判 PASS 多为新增规则；反之为漏检
let newStricter = 0;
let newLooser = 0;
const byRule = new Map();
for (const d of diffs) {
  if (d.mineFail) {
    newStricter++;
    for (const f of d.mine.fails) byRule.set(f.id, (byRule.get(f.id) || 0) + 1);
  } else newLooser++;
}
console.log(`  新更严（新增拦截）: ${newStricter}`);
console.log(`  新更松（漏检）: ${newLooser}`);
if (byRule.size) {
  console.log(`\n新增拦截按规则分：`);
  for (const [id, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${id}`);
}
if (VERBOSE && diffs.filter((d) => !d.mineFail).length) {
  console.log(`\n漏检样例：`);
  for (const d of diffs.filter((d) => !d.mineFail).slice(0, 5)) {
    console.log(`  ${d.file.slice(SRC_ROOT.length)}`);
    console.log(`    旧判据: ${d.oldOut.split("\n").filter((l) => l.trim().startsWith("-")).join(" | ").slice(0, 200)}`);
  }
}

process.exit(diff === 0 ? 0 : 1);
}
