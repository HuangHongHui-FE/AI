#!/usr/bin/env node
// 回归：real-story-pack 参数校验 / plan 产物 / 锚点覆盖 / 红线拦截
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "rsp-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });
const writeJson = (name, obj) => {
  const p = join(work, name);
  writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
};

const ABSTRACT = {
  title: "那天晚上",
  body_markdown:
    "那天晚上加班回来，老公在沙发上刷短视频，声音外放。我有个同事去年被裁了，开了个工作室。他的工作室很小，一张桌子一台电脑。他说了一段话，我解释了一下。",
};

const PACKED = {
  title: "上周三，我把他的手机还了回去",
  body_markdown: `上周三晚上十一点半，北京东五环外一个89平的老破小里，我老公还瘫在沙发上刷抖音。声音外放。

他35岁，前端开发，上个月被裁。

我问他：「你声音能不能小点？」

他愣了一下，没说话。

后来才知道，他那天刚投完第20份简历。

我闺蜜给我发微信，她回：「别理他。」

以前他十点就睡，现在凌晨一点还盯着手机。

他把手机递给我看，备忘录标题叫「别真生气」。

我合上电脑，把凉掉的咖啡拿去洗了杯子。`,
};

const REDLINE = {
  title: "被裁那天",
  body_markdown: "我在字节跳动上班，上个月被裁，同事都觉得意外。",
};

// 1. 参数校验
check("缺 --article 报错 exit 2", run([]).status === 2);
check("未知参数 exit 2", run(["--article", "x", "--foo", "y"]).status === 2);
check("文件不存在 exit 2", run(["--article", join(work, "nope.json")]).status === 2);

// 2. plan
const abstractPath = writeJson("abstract.json", ABSTRACT);
const outDir = join(work, "plan");
const plan = run(["--article", abstractPath, "--out-dir", outDir]);
check("plan 成功 exit 0", plan.status === 0, plan.stderr.trim().slice(-60));
check("plan 落盘 prompt.md", existsSync(join(outDir, "prompt.md")));
check("plan 落盘 anchors.json", existsSync(join(outDir, "anchors.json")));
if (existsSync(join(outDir, "prompt.md"))) {
  const prompt = readFileSync(join(outDir, "prompt.md"), "utf8");
  check("prompt 含 12 类锚点", prompt.includes("12 类真实感锚点"));
  check("prompt 含最少命中数", /至少命中\s*8\s*类/.test(prompt));
  check("prompt 含红线", prompt.includes("红线"));
}
const planJson = JSON.parse(plan.stdout);
check("plan 输出 anchor_ids 12 个", Array.isArray(planJson.anchor_ids) && planJson.anchor_ids.length === 12);

// 3. verify：抽象初稿应不通过
const packedPath = writeJson("packed.json", PACKED);
const redlinePath = writeJson("redline.json", REDLINE);
const v1 = run(["--verify", abstractPath]);
check("抽象初稿判不通过 exit 1", v1.status === 1);
const v1Json = JSON.parse(v1.stdout);
check("抽象初稿命中不足 8 类", v1Json.score < 8, `命中 ${v1Json.score}`);
check("抽象初稿缺时间戳", v1Json.missing.includes("时间戳"));
check("抽象初稿提示抽象表达", v1Json.abstract.length > 0);

// 4. verify：包装后应通过
const v2 = run(["--verify", packedPath]);
check("包装稿通过 exit 0", v2.status === 0, v2.stderr.trim().slice(-80));
const v2Json = JSON.parse(v2.stdout);
check("包装稿命中 ≥ 8 类", v2Json.score >= 8, `命中 ${v2Json.score}`);
check("包装稿无红线", v2Json.red_lines.length === 0);

// 5. verify：红线应拦截
const v3 = run(["--verify", redlinePath]);
check("红线稿判不通过 exit 1", v3.status === 1);
const v3Json = JSON.parse(v3.stdout);
check("识别公司名红线", v3Json.red_lines.some((r) => r.id === "company"));

// 6. markdown 输入
const mdPath = join(work, "draft.md");
writeFileSync(mdPath, ABSTRACT.body_markdown);
check("markdown 初稿可 plan", run(["--article", mdPath]).status === 0);

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);