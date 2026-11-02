#!/usr/bin/env node
// 离线回归：起一个本地 mock 微信 API，跑通 token 缓存 / 42001 重试 / 上传 / 写草稿 /
// 缺图拦截 / 封面撞脸拦截 六条链路。不联网、不碰真公众号。
// 用法：node atom/wechat-draft/fixtures/regression.mjs
// 退出码：0 全部通过；1 有用例失败

import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getAccessToken } from "../src/lib/token.mjs";
import { uploadArticleImage, createDraft, verifyToken } from "../src/lib/wechat-api.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");

const work = mkdtempSync(join(tmpdir(), "wd-reg-"));
const cacheDir = join(work, "cache");
const outDir = join(work, "out");
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// 极小的合法 JPEG（含 SOI/APP0/EOI，微信上传 mock 只校验非空，不解析像素）
const JPEG = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc2000b080001000101011100ffc40014000100000000000000000000000000000009ffda0008010100003f00d2cf20ffd9",
  "hex"
);
const imgPath = join(work, "inner.jpg");
const coverPath = join(work, "cover.jpg");
writeFileSync(imgPath, JPEG);
writeFileSync(coverPath, JPEG);

// mock 服务器状态：记录调用次数，可切换「第二次调用才过期」以触发重试路径
const state = { tokenCalls: 0, uploads: 0, drafts: [], failFirstUpload: true, expiredOnce: false };

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (obj) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === "/cgi-bin/token") {
    state.tokenCalls++;
    return send({ access_token: `tok-${state.tokenCalls}`, expires_in: 7200 });
  }
  // 第一次调用返回 42001 模拟 token 过期，验证自动刷新重试
  if (url.pathname === "/cgi-bin/media/uploadimg") {
    if (state.failFirstUpload && !state.expiredOnce) {
      state.expiredOnce = true;
      return send({ errcode: 42001, errmsg: "access_token expired" });
    }
    state.uploads++;
    return send({ url: `https://mmbiz.qpic.cn/mock/inner-${state.uploads}.jpg` });
  }
  if (url.pathname === "/cgi-bin/material/add_material") {
    state.uploads++;
    return send({ media_id: `thumb-${state.uploads}`, url: "https://mmbiz.qpic.cn/mock/cover.jpg" });
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
  if (url.pathname === "/cgi-bin/get_api_domain_ip") return send({ ip_list: ["127.0.0.1"] });
  res.writeHead(404);
  res.end("not found");
});

// 异步跑子进程：spawnSync 会阻塞事件循环，把同一进程内的 mock 服务器卡死
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
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/cgi-bin`;
process.env.WECHAT_API_BASE = base;
// 测试自带假凭据：不依赖外部 .env，任何人 clone 下来都能直接跑
process.env.WECHAT_APPID = "fake-appid";
process.env.WECHAT_APPSECRET = "fake-secret";

const ctx = { appId: "ak", appSecret: "sk", alias: "TEST", cacheDir };

try {
  // 1. token 获取 + 缓存：第二次应命中缓存，不再请求
  const t1 = await getAccessToken(ctx);
  const t2 = await getAccessToken(ctx);
  const before = state.tokenCalls;
  await getAccessToken(ctx);
  check("token 首次获取", t1 === "tok-1", t1);
  check("token 命中缓存不重复请求", t2 === t1 && state.tokenCalls === before, `调用 ${state.tokenCalls} 次`);

  // 2. 42001 自动刷新重试
  state.uploads = 0;
  const imgUrl = await uploadArticleImage(ctx, imgPath);
  check("42001 触发 token 刷新并重试成功", imgUrl.includes("mock/inner-1"), imgUrl);

  // 3. 上传正文图、封面、写草稿
  const draftId = await createDraft(ctx, {
    title: "回归标题",
    digest: "摘要",
    content: "<p>正文</p>",
    thumbMediaId: "thumb-x",
  });
  check("写草稿返回 media_id", draftId === "draft-1", draftId);
  check("草稿 payload 带封面 media_id", state.drafts[0].articles[0].thumb_media_id === "thumb-x");

  // 4. verifyToken
  const v = await verifyToken(ctx);
  check("verifyToken 通过", v.ok === true);

  // 5. 缺图拦截：正文引用不存在的图，应以 exit 2 拒绝
  const bodyWithMissing = `<p><img src="${join(work, "nope.jpg")}"></p>`;
  const htmlMissing = join(work, "missing.html");
  writeFileSync(htmlMissing, bodyWithMissing);
  const r1 = await run(
    [ENTRY, "--html", htmlMissing, "--cover", coverPath, "--title", "t", "--out-dir", outDir],
    process.env
  );
  check("缺图硬拦 exit=2", r1.status === 2, (r1.stderr || "").split("\n").find((l) => l.includes("不存在的图")) || "");

  // 6. 封面撞脸拦截：正文引用封面同一文件
  const htmlClash = join(work, "clash.html");
  writeFileSync(htmlClash, `<p><img src="${coverPath}"></p>`);
  const r2 = await run(
    [ENTRY, "--html", htmlClash, "--cover", coverPath, "--title", "t", "--out-dir", outDir],
    process.env
  );
  check("封面撞脸硬拦 exit=2", r2.status === 2, (r2.stderr || "").split("\n").find((l) => l.includes("撞脸")) || "");

  // 7. 完整推草稿：正文带 1 张真实存在的内图
  const htmlOk = join(work, "ok.html");
  writeFileSync(htmlOk, `<p>正文</p><p><img src="${imgPath}" alt="内图"></p>`);
  const r3 = await run(
    [ENTRY, "--html", htmlOk, "--cover", coverPath, "--title", "回归标题", "--digest", "回归摘要", "--out-dir", outDir],
    process.env
  );
  const res3 = JSON.parse(r3.stdout || "{}");
  check("完整推送 exit=0", r3.status === 0, r3.stderr.split("\n").find((l) => l.includes("草稿已生成")) || "");
  check("内图已替换成 CDN URL", res3.images_uploaded === 1 && state.drafts.at(-1).articles[0].content.includes("mmbiz.qpic.cn"));
  const resultFile = join(outDir, "result.json");
  check("result.json 已落盘", readFileSync(resultFile, "utf8").includes("draft_media_id"));
} catch (e) {
  check("执行未抛异常", false, e.message);
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
