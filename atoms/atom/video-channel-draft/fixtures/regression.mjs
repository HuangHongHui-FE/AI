#!/usr/bin/env node
// 回归：video-channel-draft 参数校验 / 短标题清洗与长度拦截 / Python 可编译
// 不启动浏览器
// 退出码：0 通过 / 1 失败
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const PY = join(ATOM, "src", "py", "vh_draft.py");
const work = mkdtempSync(join(tmpdir(), "vcd-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", timeout: 60000 });

// 1. 参数校验
check("缺 --video exit 2", run(["--desc", "d"]).status === 2);
check("缺 --desc exit 2", run(["--video", "x.mp4"]).status === 2);
check("视频不存在 exit 2", run(["--video", join(work, "no.mp4"), "--desc", "d"]).status === 2);
check("未知参数 exit 2", run(["--video", join(work, "no.mp4"), "--desc", "d", "--foo", "x"]).status === 2);

// 2. Python 可编译
const comp = spawnSync("python3", ["-m", "py_compile", PY], { encoding: "utf8" });
check("vh_draft.py 可编译", comp.status === 0, (comp.stderr || "").trim().slice(-100));

// 3. 短标题清洗函数
const pyTest = spawnSync("python3", ["-c", `
import importlib.util
spec = importlib.util.spec_from_file_location("vh", ${JSON.stringify(PY)})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(m.clean_short_title("高三，八班！全体起立"))
print(m.clean_short_title("标题《测试》：+1"))
`], { encoding: "utf8" });
check("短标题清洗可导入", pyTest.status === 0, (pyTest.stderr || "").trim().slice(-100));
if (pyTest.status === 0) {
  const [a, b] = pyTest.stdout.trim().split("\n");
  check("逗号/感叹号转空格", a === "高三 八班 全体起立", a);
  check("白名单标点保留", b === "标题《测试》：+1", b);
}

// 4. 超过 16 字直接拦（不会启动浏览器）
const video = join(work, "dummy.mp4");
writeFileSync(video, "");
const long = run(["--video", video, "--desc", "d", "--short", "一二三四五六七八九十一二三四五六七"]);
check("短标题 17 字判失败", long.status !== 0);
check("提示超限", /超过平台 16 字上限/.test(long.stderr), long.stderr.trim().slice(-60));

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);