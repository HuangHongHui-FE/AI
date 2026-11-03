#!/usr/bin/env node
// 回归：wechat-browser-draft 参数校验 / Python 脚本可编译 / Playwright 检查
// 不启动浏览器（真实流程要扫码，不能进回归）
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const PY = join(ATOM, "src", "py");
const work = mkdtempSync(join(tmpdir(), "wbd-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout: 60000 });

// 1. 参数校验
check("缺 --mode exit 2", run([]).status === 2);
check("未知 mode exit 2", run(["--mode", "x"]).status === 2);
check("create 缺 --article exit 2", run(["--mode", "create"]).status === 2);
check("create article 不存在 exit 2", run(["--mode", "create", "--article", join(work, "no.json")]).status === 2);
check("fix 缺 --keyword exit 2", run(["--mode", "fix", "--article", join(work, "a.json")]).status === 2);
check("cleanup 缺 --keep exit 2", run(["--mode", "cleanup"]).status === 2);
check("未知参数 exit 2", run(["--mode", "check", "--foo", "x"]).status === 2);

// 2. 四个 Python 脚本可编译
for (const f of ["mp_draft.py", "fix_draft.py", "list_drafts.py", "cleanup_dupes.py"]) {
  const r = spawnSync("python3", ["-m", "py_compile", join(PY, f)], { encoding: "utf8" });
  check(`${f} 可编译`, r.status === 0, (r.stderr || "").trim().slice(-100));
}

// 3. Playwright 检查（不打开浏览器）
const chk = run(["--mode", "check"]);
check("check 模式 exit 0", chk.status === 0, chk.stderr.trim().slice(-80));
if (chk.status === 0) check("报告 playwright ok", /playwright ok/.test(chk.stdout));

// 4. article 合法但 fix 仍缺 keyword（防止误跑）
const art = join(work, "article.json");
writeFileSync(art, JSON.stringify({ title: "测试", body_markdown: "正文" }));
check("fix 有 article 但缺 keyword exit 2", run(["--mode", "fix", "--article", art]).status === 2);

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);