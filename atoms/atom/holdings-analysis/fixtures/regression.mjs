#!/usr/bin/env node
// 回归：holdings-analysis 参数校验 / 文本与 JSON 输入 / 板块映射 / 汇总 / 建议
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const HOLDINGS = join(ATOM, "fixtures", "holdings.json");
const FORECAST = join(ATOM, "fixtures", "forecast.json");
const work = mkdtempSync(join(tmpdir(), "ha-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });
const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

// 1. 参数校验
check("缺 --holdings exit 2", run(["--forecast", FORECAST]).status === 2);
check("缺 --forecast exit 2", run(["--holdings", HOLDINGS]).status === 2);
check("未知参数 exit 2", run(["--holdings", HOLDINGS, "--forecast", FORECAST, "--foo", "x"]).status === 2);

// 2. JSON 输入 + 落盘
const outJson = join(work, "result.json");
const outMd = join(work, "report.md");
const r = run(["--holdings", HOLDINGS, "--forecast", FORECAST, "--out", outJson, "--md", outMd]);
check("分析成功 exit 0", r.status === 0, r.stderr.trim().slice(-80));
check("产出 JSON", existsSync(outJson));
check("产出 markdown", existsSync(outMd));

const res = JSON.parse(r.stdout);
check("6 只基金", res.funds.length === 6, `${res.funds.length}`);
check("总金额正确", near(res.totals.amount, 193809.79), `${res.totals.amount}`);
check("累计盈亏正确", near(res.totals.pnl, -14037.5), `${res.totals.pnl}`);
check("今日预估盈亏正确", near(res.totals.today_est_pnl, -3520.19), `${res.totals.today_est_pnl}`);
check("次日预估 = 今日 × 0.6", near(res.totals.next_est_pnl, res.totals.today_est_pnl * 0.6));

// 3. 板块映射
const byName = Object.fromEntries(res.funds.map((f) => [f.name, f.sector]));
check("环保主题 → 新能源车", byName["易方达环保主题灵活配置混合 C"] === "新能源车");
check("科创板半导体 → 半导体", byName["华夏上证科创板半导体材料设备"] === "半导体");
check("人工智能主题 → AI算力/AI", byName["东方人工智能主题混合 C"] === "AI算力/AI");
check("机器人 → 机器人", byName["嘉实中证机器人 ETF 联接 C"] === "机器人");
check("恒生科技 → 恒生科技", byName["易方达恒生科技 ETF 联接 (QDII) C"] === "恒生科技");
check("黄金 → 黄金", byName["国泰黄金 ETF 联接 C"] === "黄金");

// 4. 建议与集中度
check("减仓含半导体", res.advice.reduce.some((s) => s.sector === "半导体"));
check("减仓含 AI算力/AI", res.advice.reduce.some((s) => s.sector === "AI算力/AI"));
check("加仓含黄金", res.advice.add.some((s) => s.sector === "黄金"));
check("前 3 大占比已算", res.concentration.top3.length === 3 && res.concentration.top3_pct > 0);

// 5. 文本输入（名称｜金额｜盈亏｜收益率）
const txt = join(work, "holdings.txt");
writeFileSync(txt, "华夏上证科创板半导体材料设备｜52162.05｜-8019.31｜-13.33%\n国泰黄金 ETF 联接 C｜175.77｜-24.80｜+1.91%\n");
const rt = run(["--holdings", txt, "--forecast", FORECAST]);
check("文本持仓可解析", rt.status === 0);
if (rt.status === 0) {
  const res2 = JSON.parse(rt.stdout);
  check("文本持仓 2 只", res2.funds.length === 2);
  check("收益率去 % 号", near(res2.funds.find((f) => f.name.includes("黄金")).pct, 1.91));
}

const data = JSON.parse(readFileSync(outJson, "utf8"));
check("落盘 JSON 与 stdout 一致", data.totals.amount === res.totals.amount);

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);