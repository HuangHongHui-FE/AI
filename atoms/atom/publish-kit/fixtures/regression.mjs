#!/usr/bin/env node
// 回归：publish-kit 参数校验 / copy.html 内嵌 GIF / 发布物料.md / 短标题标点检查
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { badShortPunct, cleanShortTitle } from "../src/lib/kit.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ATOM = join(HERE, "..");
const ENTRY = join(ATOM, "src", "index.mjs");
const ARTICLE = join(ATOM, "fixtures", "article.json");
const HTML = join(ATOM, "fixtures", "content.html");
const GIF = join(ATOM, "fixtures", "first.gif");
const work = mkdtempSync(join(tmpdir(), "pk-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

// 1. 参数校验
check("缺 --article exit 2", run(["--html", HTML, "--gif", GIF]).status === 2);
check("缺 --html exit 2", run(["--article", ARTICLE, "--gif", GIF]).status === 2);
check("缺 --gif exit 2", run(["--article", ARTICLE, "--html", HTML]).status === 2);
check("文件不存在 exit 2", run(["--article", join(work, "no.json"), "--html", HTML, "--gif", GIF]).status === 2);
check("未知参数 exit 2", run(["--article", ARTICLE, "--html", HTML, "--gif", GIF, "--foo", "x"]).status === 2);

// 2. 正常出物料
const out = join(work, "01-吕子乔");
const r = run(["--article", ARTICLE, "--html", HTML, "--gif", GIF, "--video", "名场面/成品/024-吕子乔.mp4", "--out-dir", out]);
check("出物料 exit 0", r.status === 0, r.stderr.trim().slice(-80));
check("产出 copy.html", existsSync(join(out, "copy.html")));
check("产出 发布物料.md", existsSync(join(out, "发布物料.md")));
if (existsSync(join(out, "copy.html"))) {
  const html = readFileSync(join(out, "copy.html"), "utf8");
  check("copy.html 内嵌 base64 首图", html.includes("data:image/gif;base64,"));
  check("copy.html 含正文", html.includes("吕子乔") && html.includes("<h2>"));
}
if (existsSync(join(out, "发布物料.md"))) {
  const md = readFileSync(join(out, "发布物料.md"), "utf8");
  check("物料含标题", md.includes("吕子乔卖肾宝"));
  check("物料含摘要", md.includes("爱情公寓里最狠"));
  check("物料含视频段", md.includes("视频号 · 短标题"));
  check("物料含短标题警告", md.includes("静默不保存"));
}
const j = JSON.parse(r.stdout);
check("返回短标题非法标点", j.short_bad_punct.includes("，"), j.short_bad_punct.join(""));

// 3. 短标题函数
check("逗号转空格", cleanShortTitle("高三，八班！") === "高三 八班");
check("白名单标点保留", cleanShortTitle("《测试》：+1") === "《测试》：+1");
check("非法标点识别", badShortPunct("a，b").includes("，"));

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);