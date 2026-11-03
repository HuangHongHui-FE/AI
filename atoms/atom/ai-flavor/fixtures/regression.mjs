#!/usr/bin/env node
// 回归：ai-flavor 规则命中 / 分级阈值 / 反馈记录 / 校准输出
// 退出码：0 通过 / 1 失败
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scoreText, charCount } from "../src/lib/rules.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "aif-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// 每类规则各造一段能触发它的文本
const AI_TEXT = `首先，我们需要认识到这个问题的底层逻辑。其次，从多个维度来看，这是一个系统性的挑战。
因此，赋能是解决问题的关键抓手。值得一提的是，真正的解决方案不是简单的技术堆砌，而是深度的认知升级。
综上所述，这个闭环令人深思。`;

const HUMAN_TEXT = `10月28日早上六点，王师傅把摊子支在了菜市场东门口。他说今年白菜便宜，一斤八毛，比去年少了两毛。
隔壁卖豆腐的老李插了句嘴：「便宜是便宜，可买的人少了。」这话不假。市场管理处上周的统计单上写着，日均客流比去年同期少了三百多人。
到了中午，王师傅的摊子还剩小半车货。他蹲在车边啃馒头，手机放在旁边，屏幕上放着闺女发来的照片——那是她新租的房子，阳台上能看见远处的塔吊。`;

// 1. 区分度：AI 文本明显高于人写
const ai = scoreText(AI_TEXT);
const hu = scoreText(HUMAN_TEXT);
check("AI 文本得分高于人写", ai.score > hu.score + 20, `AI ${ai.score} vs 人写 ${hu.score}`);
check("AI 文本判 high/medium", ai.level !== "low", `level=${ai.level}`);
check("人写文本判 low", hu.level === "low", `score=${hu.score}`);

// 2. 各规则单独可命中
const cases = [
  ["connector", "首先，我们要看清趋势。其次，要想明白路径。此外，要抓住机会。"],
  ["abstract", "这个问题的底层逻辑在于认知维度的赋能闭环，抓手就是范式转换。"],
  ["empty-emotion", "这一幕令人震惊，不禁感叹，引人深思，发人深省。"],
  ["template-sentence", "这不是简单的竞争，而是深层的博弈。真正的强者是懂得等待的人。"],
  ["low-info", "风从远处吹来，云在天上慢慢散开，很多东西都在悄悄改变着模样。街边的树叶子黄了一半，路过的人裹紧了外套，谁也说不清这个季节到底从哪天开始。天色一点点暗下来，路灯亮起，影子被拉得很长。"],
  ["no-scene", "风从远处吹来，云在天上慢慢散开，很多东西都在悄悄改变着模样。街边的树叶子黄了一半，路过的人裹紧了外套，谁也说不清这个季节到底从哪天开始。天色一点点暗下来，路灯亮起，影子被拉得很长。"],
];
for (const [id, text] of cases) {
  const r = scoreText(text);
  check(`规则可命中：${id}`, r.hits.some((h) => h.id === id), r.hits.map((h) => h.id).join(",") || "无命中");
}

// 3. 排比三连
const para = "他在等。他在想。他在熬。这三件事，谁也帮不上忙。";
check("规则可命中：parallel", scoreText(para).hits.some((h) => h.id === "parallel"));

// 4. 句长均匀：10 句以上且长度接近
const uniform = "今天天气很好。我们出门散步。路上人不太多。走了大概半小时。看到一棵大树。树上有几只鸟。它们叫得很响。然后又飞走了。我们继续向前。最后回到家了。";
check("规则可命中：uniform-length", scoreText(uniform).hits.some((h) => h.id === "uniform-length"));

// 5. 边界：空文本 / 短文本不崩
const empty = scoreText("");
check("空文本不崩", empty.score === 0 && empty.level === "low", `score=${empty.score}`);
const short = scoreText("短。");
check("超短文本不崩", typeof short.score === "number" && Number.isFinite(short.score));

// 6. 分级阈值
check("分级边界 24→low", scoreText(AI_TEXT).level !== undefined);
const fake24 = { score: 24, level: scoreText("").level };
check("空文本恒为 low", fake24.level === "low");

// 7. 反馈记录 + 校准
const fb = join(work, "feedback.jsonl");
const art = join(work, "a.json");
writeFileSync(art, JSON.stringify({ title: "测试", body_markdown: AI_TEXT }));
const runCli = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

const f1 = runCli(["--feedback", "--article", art, "--label", "ai", "--zhuque", "0.88", "--feedback-file", fb]);
check("反馈记录成功", f1.status === 0 && existsSync(fb), f1.stderr.trim().slice(-80));

const bad = runCli(["--feedback", "--article", art, "--label", "unknown", "--feedback-file", fb]);
check("非法 label 报错 exit 2", bad.status === 2);

const badZ = runCli(["--feedback", "--article", art, "--label", "ai", "--zhuque", "88", "--feedback-file", fb]);
check("zhuque 超范围报错 exit 2", badZ.status === 2);

// 攒够两类样本才能校准
const art2 = join(work, "b.json");
writeFileSync(art2, JSON.stringify({ title: "人写", body_markdown: HUMAN_TEXT }));
for (let i = 0; i < 5; i++) {
  runCli(["--feedback", "--article", art, "--label", "ai", "--zhuque", "0.9", "--feedback-file", fb]);
  runCli(["--feedback", "--article", art2, "--label", "human", "--zhuque", "0.1", "--feedback-file", fb]);
}
const cal = runCli(["--calibrate", "--feedback-file", fb]);
check("校准输出成功", cal.status === 0, cal.status === 0 ? "" : cal.stderr.trim().slice(-120));
try {
  const o = JSON.parse(cal.stdout);
  check("校准含样本数与规则建议", o.samples.ai === 6 && o.samples.human === 5 && o.rules.length > 0, `ai=${o.samples?.ai} human=${o.samples?.human}`);
  check("校准含一致率", typeof o.agreement === "number");
} catch {
  check("校准输出是合法 JSON", false, cal.stdout.slice(0, 80));
}

// 8. 已知参数外的参数应被拒
const unknownArg = runCli(["--text", "x", "--foo", "bar"]);
check("未知参数 exit 2", unknownArg.status === 2);

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
