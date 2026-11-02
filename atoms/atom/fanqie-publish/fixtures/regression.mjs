#!/usr/bin/env node
// 离线回归：起本地 mock 番茄接口，验证存草稿三步链路
// 覆盖：list 解析 / 存草稿三步调用顺序 / 绝不调 publish_article / 章节解析 / 无标题拦截 / 缺登录态
// 用法：node atom/fanqie-publish/fixtures/regression.mjs

import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "fq-reg-"));

const authFile = join(work, "fanqie.json");
writeFileSync(authFile, JSON.stringify({ cookie: "sid=abc; csrf=xyz", csrfToken: "tok123" }, null, 2));

const chapterFile = join(work, "ch.md");
writeFileSync(
  chapterFile,
  `# 第 42 章 意外的来客\n\n摊子刚收一半，天就阴了下来。\n\n"明天还来吗？"\n\n包含 <b> 标签和 & 符号。\n`
);

const calls = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls.push({ path: url.pathname, method: req.method, body });
    const send = (obj) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (url.pathname === "/api/author/stats/book_list/v0/") {
      return send({
        code: 0,
        data: { stats_book_list: [{ book_id: "111", book_name: "测试书A", word_number: 5000 }, { book_id: "222", book_name: "测试书B" }] },
      });
    }
    if (url.pathname === "/api/author/article/new_article/v0/") {
      return send({
        code: 0,
        data: { item_id: "item-1", volume_id: "vol-1", volume_data: JSON.stringify([{ volume_id: "vol-1", volume_name: "正文" }]) },
      });
    }
    if (url.pathname === "/api/author/article/cover_article/v0/") return send({ code: 0, data: {} });
    if (url.pathname === "/api/author/article/save_doc_history/v0/") return send({ code: 0, data: {} });
    if (url.pathname === "/api/author/article/publish_article/v0/") return send({ code: 0, data: {} });
    send({ code: -1, message: "unknown" });
  });
});

// 异步跑子进程并注入 mock 基址
function run(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, {
      env: { ...process.env, FANQIE_API_BASE: `http://127.0.0.1:${server.address().port}` },
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (c) => (stdout += c));
    p.stderr.on("data", (c) => (stderr += c));
    p.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await new Promise((r) => server.listen(0, "127.0.0.1", r));

try {
  // 1. list
  const r1 = await run([ENTRY, "--list", "--auth", authFile]);
  const res1 = JSON.parse(r1.stdout || "{}");
  check("list 返回 2 本书", res1.count === 2, String(res1.count));
  check("list 字段归一", res1.books?.[0]?.book_name === "测试书A", res1.books?.[0]?.book_name);

  // 2. 存草稿：验证三步调用顺序
  calls.length = 0;
  const r2 = await run([ENTRY, "--book", "111", "--file", chapterFile, "--auth", authFile]);
  const res2 = JSON.parse(r2.stdout || "{}");
  const paths = calls.map((c) => c.path);
  check("存草稿 exit=0", r2.status === 0, r2.stderr.split("\n").find((l) => l.includes("已存入草稿箱")) || "");
  check("返回 item_id", res2.item_id === "item-1", res2.item_id);
  check("章节标题解析正确", res2.title === "第 42 章 意外的来客", res2.title);

  const iNew = paths.indexOf("/api/author/article/new_article/v0/");
  const iCover = paths.indexOf("/api/author/article/cover_article/v0/");
  const iSave = paths.indexOf("/api/author/article/save_doc_history/v0/");
  check("三步顺序正确", iNew >= 0 && iNew < iCover && iCover < iSave, paths.join(" → "));

  // 3. 最关键：绝不调用发布接口
  const pub = paths.filter((p) => p.includes("publish_article"));
  check("未调用 publish_article", pub.length === 0, pub.join(",") || "无");

  // 4. cover_article 的 payload 检查：正文已转 HTML、特殊字符已转义
  const coverCall = calls.find((c) => c.path.endsWith("cover_article/v0/"));
  const params = new URLSearchParams(coverCall.body);
  const content = params.get("content") || "";
  check("正文转成 <p> 段落", content.includes("<p>") && content.includes("</p>"));
  check("< 号已转义", content.includes("&lt;b&gt;") && !content.includes("<b>"));
  check("& 号已转义", content.includes("&amp;"));
  check("标题行未被写进正文", !content.includes("第 42 章"), "正文里不该再出现标题");

  // 5. 无标题行拦截
  const noTitle = join(work, "no-title.md");
  writeFileSync(noTitle, "只有正文\n");
  const r3 = await run([ENTRY, "--book", "111", "--file", noTitle, "--auth", authFile]);
  check("无标题行 exit=2", r3.status === 2, r3.stderr.trim().split("\n").pop());

  // 6. --title 覆盖标题
  const r4 = await run([ENTRY, "--book", "111", "--file", chapterFile, "--title", "自定义章节名", "--auth", authFile]);
  check("--title 覆盖生效", JSON.parse(r4.stdout || "{}").title === "自定义章节名");

  // 7. 缺登录态
  const r5 = await run([ENTRY, "--book", "111", "--file", chapterFile, "--auth", join(work, "none.json")]);
  check("缺登录态 exit=2", r5.status === 2, r5.stderr.trim().split("\n").pop());
} catch (e) {
  check("执行未抛异常", false, e.message);
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
