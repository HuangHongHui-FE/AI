#!/usr/bin/env node
// toutiao-publish：把文章填入今日头条编辑器（半自动——发布由人工点）
// 为什么半自动：头条没有草稿 API，且 a_bogus 反爬验签使直接调接口不可行，只能驱动真实浏览器
// 用法：
//   node atom/toutiao-publish/src/index.mjs --login                                  # 首次扫码登录
//   node atom/toutiao-publish/src/index.mjs --article article.json --html body.html --cover c.jpg
//   node atom/toutiao-publish/src/index.mjs --article a.json --html b.html --inspect # 探 DOM
//   node atom/toutiao-publish/src/index.mjs --article a.json --html b.html --dry-run # 只做本地准备
// stdout：{ ok, mode, title, body_chars, notes }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { nowIso } from "../../../_shared/time.mjs";
import { login, hasAuth } from "./lib/auth.mjs";

const args = parseArgs({ known: ["article", "html", "cover", "out-dir", "dry-run", "login", "inspect", "auth-dir", "hold-sec"] });

// 动态导入 playwright：--dry-run / --login 检测失败时应给出明确提示，而不是模块加载错
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    fail("缺少依赖 playwright，请先运行 npm install，并执行 npx playwright install chromium");
  }
}

// 登录态文件路径：环境变量优先，其次参数指定的 auth 目录
function authFile() {
  const dir = args["auth-dir"] ? resolve(String(args["auth-dir"])) : process.env.TOUTIAO_AUTH_DIR || ".cache/toutiao";
  return join(dir, "toutiao.json");
}

async function main() {
  // --login：首次扫码
  if (args.login) {
    const { chromium } = await loadPlaywright();
    log("打开浏览器，请扫码登录头条号…");
    const r = await login({ authFile: authFile(), chromium });
    if (!r.saved) fail(r.reason);
    log(`✓ 登录态已保存：${authFile()}（${r.cookies} cookies）`);
    emit({ ok: true, mode: "login", auth_file: authFile(), cookies: r.cookies }, EXIT.OK);
    return;
  }

  // 读稿件
  if (!args.article) fail("需要 --article 稿件 json（含 title / body_markdown）");
  const articlePath = resolve(String(args.article));
  if (!existsSync(articlePath)) fail(`稿件不存在：${articlePath}`);
  const article = JSON.parse(readFileSync(articlePath, "utf8"));
  if (!article.title) fail("稿件缺 title");

  // 正文 HTML：优先用 format-html 的产物，否则从 markdown 现场转
  let bodyHtml = "";
  if (args.html) {
    const p = resolve(String(args.html));
    if (!existsSync(p)) fail(`HTML 不存在：${p}`);
    bodyHtml = readFileSync(p, "utf8");
  } else if (article.body_markdown) {
    // 头条也吃 markdown 转的 HTML；复用 format-html 的渲染器需跨原子 import，
    // 这里做最小转换：段落 + 换行，复杂排版请先用 format-html 生成 --html
    bodyHtml = article.body_markdown
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</p>`)
      .join("");
    log("⚠ 未提供 --html，用最小转换生成正文（复杂排版建议先跑 format-html）");
  } else fail("稿件缺 body_markdown，且未提供 --html");

  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : null;
  const coverPath = args.cover ? resolve(String(args.cover)) : null;

  // dry-run：只落可粘贴片段，不开浏览器
  if (args["dry-run"]) {
    const result = { ok: true, mode: "dry-run", title: article.title, html_bytes: bodyHtml.length, cover: coverPath, at: nowIso() };
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "paste.html"), wrapPaste(bodyHtml));
      writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
      log(`✓ 可粘贴片段：${join(outDir, "paste.html")}`);
    }
    emit(result, EXIT.OK);
    return;
  }

  // 登录态检查：没有就直接报错，不启动浏览器干等
  if (!hasAuth(authFile())) fail(`未找到登录态 ${authFile()}，请先跑 --login`);

  const { chromium } = await loadPlaywright();
  const { fillEditor, inspectPage, SELECTORS } = await import("./lib/editor.mjs");

  // --inspect：只探 DOM，验证选择器是否还有效
  if (args.inspect) {
    const browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({ storageState: authFile() });
    const page = await ctx.newPage();
    await page.goto("https://mp.toutiao.com/profile_v4/graphic/publish", { waitUntil: "domcontentloaded" });
    const info = await inspectPage(page);
    await browser.close();
    log(JSON.stringify(info, null, 2));
    emit({ ok: true, mode: "inspect", selectors: SELECTORS, dom: info }, EXIT.OK);
    return;
  }

  // 正常流程：填编辑器
  const holdMs = Number(args["hold-sec"] || 300) * 1000;
  log("启动浏览器并填充编辑器…");
  const res = await fillEditor({
    chromium,
    authFile: authFile(),
    title: article.title,
    bodyHtml,
    coverPath,
    holdMs,
  });
  for (const n of res.notes) log(`  · ${n}`);

  const result = { ...res, mode: "fill", at: nowIso() };
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
    writeFileSync(join(outDir, "paste.html"), wrapPaste(bodyHtml));
  }
  emit(result, EXIT.OK);
}

// 包一层最小外壳，浏览器打开后 Cmd+A/Cmd+C 可整段复制到头条编辑器
function wrapPaste(html) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 16px;">${html}</body></html>`;
}

main().catch((e) => fail(e.message));
