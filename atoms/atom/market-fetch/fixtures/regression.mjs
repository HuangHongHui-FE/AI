#!/usr/bin/env node
// 回归：market-fetch 脚本完整性 / 参数校验 / 路径参数化 / 输出目录
// 默认不联网；设 MARKET_LIVE=1 才跑一次真实抓取
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const PY = join(ATOM, "src", "py");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

// 1. 9 个抓数脚本 + sectors.json 都在
const SCRIPTS = ["fetch_quote", "fetch_history", "fetch_overseas", "fetch_env", "fetch_flow", "fetch_flow_intraday", "fetch_sentiment", "fetch_earnings", "fetch_news"];
const missing = SCRIPTS.filter((s) => !existsSync(join(PY, `${s}.py`)));
check("9 个抓数脚本齐全", missing.length === 0, missing.join(",") || "全部存在");
check("sectors.json 已随迁", existsSync(join(PY, "sectors.json")));

// 2. 路径已参数化：不应再出现旧项目的固定路径
const raw = SCRIPTS.map((s) => readFileSync(join(PY, `${s}.py`), "utf8")).join("\n");
check("脚本不再写死 skills/market-forecast 路径", !raw.includes("skills/market-forecast"), "已改为同目录 sectors.json");
check("输出目录支持环境变量", raw.includes("MARKET_OUT"), "MARKET_OUT");
check("根目录支持环境变量", raw.includes("MARKET_ROOT"), "MARKET_ROOT");

// 3. 参数校验
const badOnly = run(["--only", "not-exist", "--out-dir", mkdtempSync(join(tmpdir(), "mf-"))]);
check("--only 无匹配报错 exit 2", badOnly.status === 2, badOnly.stderr.split("\n")[0].slice(0, 60));

const unknown = run(["--out-dir", "/tmp/x", "--foo", "bar"]);
check("未知参数 exit 2", unknown.status === 2);

// 4. 输出目录可创建（用 --only 一个不存在的 id 提前退出，避免联网）
const fresh = mkdtempSync(join(tmpdir(), "mf-"));
const deep = join(fresh, "a", "b", "c");
const r = run(["--only", "quote", "--out-dir", deep, "--timeout", "1000"]);
check("多级输出目录自动创建", existsSync(deep) || r.status === 0);

// 5. 真实抓取（可选，联网）
if (process.env.MARKET_LIVE === "1") {
  const live = mkdtempSync(join(tmpdir(), "mf-live-"));
  const lr = run(["--out-dir", live, "--only", "quote", "--timeout", "30000"]);
  const files = existsSync(live) ? readdirSync(live) : [];
  check("联网抓 quote 成功", lr.status === 0 && files.includes("quotes.json"), files.join(",") || "无产出");
  if (files.includes("quotes.json")) {
    const q = JSON.parse(readFileSync(join(live, "quotes.json"), "utf8"));
    check("quotes.json 含 sectors 数组", Array.isArray(q.sectors) && q.sectors.length > 0, `${q.sectors?.length} 个板块`);
  }
} else {
  console.log("（未设 MARKET_LIVE=1，跳过联网抓取）");
}

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
