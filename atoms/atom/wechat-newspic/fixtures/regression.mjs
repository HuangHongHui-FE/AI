#!/usr/bin/env node
// 离线回归：起本地 mock 微信 API，验证图片消息草稿的完整链路
// 覆盖：图片按名自然排序 / 张数由目录决定 / 封面默认取第一张 / 草稿 payload 结构 / 空目录拦截
// 用法：node atom/wechat-newspic/fixtures/regression.mjs

import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");

const work = mkdtempSync(join(tmpdir(), "wn-reg-"));
const imgDir = join(work, "images");
mkdirSync(imgDir, { recursive: true });

// 极小合法 JPEG 头（mock 只校验非空，不解析像素）
const JPEG = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc2000b080001000101011100ffc40014000100000000000000000000000000000009ffda0008010100003f00d2cf20ffd9",
  "hex"
);

// 故意用非零填充的文件名顺序测试自然排序：1, 2, 10 应排成 1,2,10 而不是 1,10,2
for (const name of ["001.jpg", "002.jpg", "010.jpg"]) writeFileSync(join(imgDir, name), JPEG);

const state = { uploads: [], drafts: [] };

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (obj) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (url.pathname === "/cgi-bin/token") return send({ access_token: "tok", expires_in: 7200 });
  if (url.pathname === "/cgi-bin/material/add_material") {
    let n = 0;
    req.on("data", (c) => (n += c.length));
    req.on("end", () => {
      state.uploads.push(n);
      send({ media_id: `media-${state.uploads.length}` });
    });
    return;
  }
  if (url.pathname === "/cgi-bin/draft/add") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      state.drafts.push(JSON.parse(raw));
      send({ media_id: `draft-${state.drafts.length}` });
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

// 异步跑子进程：spawnSync 会阻塞事件循环卡死同进程内的 mock
function run(args, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { env });
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
process.env.WECHAT_API_BASE = `http://127.0.0.1:${server.address().port}/cgi-bin`;
process.env.WECHAT_APPID = "fake";
process.env.WECHAT_APPSECRET = "fake";

try {
  // 1. 完整推送：3 张图 + 默认封面（第一张）
  const r1 = await run(
    [ENTRY, "--title", "回归标题", "--images-dir", imgDir, "--body", "这是正文文案", "--digest", "摘要", "--out-dir", join(work, "out"), "--cache-dir", join(work, "cache")],
    process.env
  );
  const res1 = JSON.parse(r1.stdout || "{}");
  check("推送 exit=0", r1.status === 0, r1.stderr.split("\n").find((l) => l.includes("草稿已生成")) || "");
  check("返回 media_id", res1.media_id === "draft-1", res1.media_id);

  const d = state.drafts[0].articles[0];
  check("article_type=newspic", d.article_type === "newspic", d.article_type);
  check("图片数=目录张数 3", d.image_info.image_list.length === 3, String(d.image_info.image_list.length));
  check("正文文案原样传入", d.content === "这是正文文案");
  check("摘要正确", d.digest === "摘要");
  check("封面默认取第一张", res1.thumb_media_id === "media-1", res1.thumb_media_id);

  // 自然排序：001 应在 010 之前（若按字典序 010 会排在 002 前）
  const order = res1.images.map((x) => x.file);
  check("图片按自然序排列", JSON.stringify(order) === JSON.stringify(["001.jpg", "002.jpg", "010.jpg"]), order.join(","));

  // 2. 用户删图后只剩 1 张：张数应跟着变
  const thinDir = join(work, "thin");
  mkdirSync(thinDir);
  writeFileSync(join(thinDir, "001.jpg"), JPEG);
  const r2 = await run(
    [ENTRY, "--title", "只剩一张", "--images-dir", thinDir, "--body", "x", "--out-dir", join(work, "out2"), "--cache-dir", join(work, "cache")],
    process.env
  );
  const res2 = JSON.parse(r2.stdout || "{}");
  check("删图后张数跟随目录", res2.count === 1, String(res2.count));

  // 3. 空目录拦截
  const emptyDir = join(work, "empty");
  mkdirSync(emptyDir);
  const r3 = await run(
    [ENTRY, "--title", "空目录", "--images-dir", emptyDir, "--cache-dir", join(work, "cache")],
    process.env
  );
  check("空目录 exit=2", r3.status === 2, r3.stderr.trim().split("\n").pop());

  // 4. dry-run 不调 API
  const before = state.uploads.length;
  const r4 = await run(
    [ENTRY, "--title", "试运行", "--images-dir", imgDir, "--dry-run", "--cache-dir", join(work, "cache")],
    process.env
  );
  check("dry-run 不调 API", r4.status === 0 && state.uploads.length === before);
  check("dry-run 报告图片数", JSON.parse(r4.stdout || "{}").count === 3);
} catch (e) {
  check("执行未抛异常", false, e.message);
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
