import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { config, ensureDirs, COVER } from "./config.js";
import { generateCover } from "./cover.js";
import { markdownToHtml, ctaBlock, pickRandomThemeName, fullPageHtml } from "./html.js";

// 头条图文编辑页 URL（首版默认，现场 --login 后用 --inspect 确认真实入口）
const EDIT_URL = "https://mp.toutiao.com/profile_v4/graphic/publish";
const HOME_URL = "https://mp.toutiao.com/";
const AUTH_FILE = join(config.paths.auth, "toutiao.json");

// 选择器池：已用 --inspect 现场确认（2026-07-27 头条编辑页 profile_v4/graphic/publish）
const S = {
  titleInput: 'textarea[placeholder*="文章标题"]', // placeholder="请输入文章标题（2～30个字）"
  bodyEditor: ".ProseMirror", // 正文 ProseMirror 富文本编辑器
  coverUpload: 'input[type="file"]', // 封面 file input 隐藏/动态，首版跳过自动上传
};

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) {
      const key = k.slice(2);
      a[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else a._.push(k);
  }
  return a;
}

// 首次登录：有头浏览器扫码，轮询 cookie 检测登录成功后保存 storageState（无需按 Enter）
async function login() {
  await ensureDirs();
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("https://mp.toutiao.com/");
  console.log("\n[登录] 浏览器已打开头条首页。请扫码登录头条号（登录后会跳后台）。");
  console.log("[登录] 登录成功后自动检测 cookie 保存，无需按键，请稍候。");
  let saved = false;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    try {
      const cur = page.url();
      const title = await page.title();
      const cks = await ctx.cookies();
      const leftLogin = !/login|sso|passport|sign/i.test(cur);
      const not404 = !/404|not found/i.test(title);
      const hasLoginCookie = cks.some((c) =>
        /sessionid|sso_uid|login_user|passport_auth|sso_passport|^uid$|^sid$/i.test(c.name)
      );
      if (leftLogin && not404 && cks.length >= 5 && hasLoginCookie) {
        await page.waitForTimeout(2000);
        await ctx.storageState({ path: AUTH_FILE });
        console.log(`[登录] ✓ 登录态已保存到 ${AUTH_FILE}（${cks.length} cookies，URL: ${cur}）`);
        saved = true;
        break;
      }
    } catch {
      // 跨域导航时 title/cookies 可能瞬时抛错，跳过本轮
    }
  }
  if (!saved) {
    console.log("[登录] ⚠ 240秒内未自动检测到登录态。若已登录，回这里按 Enter 手动保存；否则 Ctrl+C 退出。");
    process.stdin.resume();
    await new Promise((r) => process.stdin.once("data", r));
    await ctx.storageState({ path: AUTH_FILE });
    console.log(`[登录] ✓ 登录态已保存到 ${AUTH_FILE}`);
  }
  await browser.close();
}

// 工具：按候选选择器数组找第一个可见的
async function findEl(page, selectors, label) {
  const arr = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of arr) {
    const el = page.locator(sel).first();
    try {
      await el.waitFor({ state: "visible", timeout: 4000 });
      return el;
    } catch {
      // 试下一个
    }
  }
  throw new Error(`找不到「${label}」元素，选择器候选：${arr.join(" | ")}。用 --inspect 现场确认 DOM。`);
}

// 发布到草稿箱
async function publish(args) {
  const outDir = args["out-dir"] ? resolve(String(args["out-dir"])) : join(config.paths.output);
  const articlePath = args["from-json"] ? resolve(String(args["from-json"])) : join(outDir, "article.json");
  if (!existsSync(articlePath)) {
    console.error(`✗ 找不到文章 JSON：${articlePath}`);
    process.exit(1);
  }
  const article = JSON.parse(await readFile(articlePath, "utf8"));
  for (const f of ["title", "digest", "body_markdown"]) {
    if (!article[f]) {
      console.error(`✗ article.json 缺字段：${f}`);
      process.exit(1);
    }
  }

  const imagePath = args.image ? resolve(String(args.image)) : null;
  const dryRun = !!args["dry-run"];
  const inspect = !!args.inspect;

  // 1. 合成封面
  const coverPath = join(outDir, "cover.jpg");
  if (imagePath) {
    console.log(`[1/4] 合成封面...`);
    await generateCover({ imagePath, slogan: article.cover_slogan || "", outPath: coverPath });
  }

  // 2. 转 HTML（封面标语 + 正文 + CTA）
  let theme = article.theme || null;
  if (!theme) theme = pickRandomThemeName([]);
  const bodyMd = article.body_markdown;
  const bodyHtml = markdownToHtml(bodyMd, theme);
  const ctaHtml = ctaBlock(
    {
      question: article.cta_question || "",
      follow: article.cta_follow || "关 注 不 迷 路",
      title: article.title,
    },
    theme,
  );
  const contentHtml = bodyHtml + ctaHtml;
  // 本地预览
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "article.html"), fullPageHtml(article.title, bodyHtml, ctaHtml, theme), "utf8");
  console.log(`[2/4] 正文 HTML 已生成，预览：${join(outDir, "article.html")}`);
  // 纯片段版（无外壳）供手动复制粘贴：浏览器打开→Cmd+A→Cmd+C→头条编辑器 Cmd+V
  const pastePath = join(outDir, "paste.html");
  await writeFile(pastePath, `<!doctype html><html lang="zh"><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 16px;">${contentHtml}</body></html>`, "utf8");
  console.log(`      ✓ 可粘贴片段：${pastePath}`);

  if (dryRun) {
    console.log("\n[dry-run] 跳过发布。本地产物：封面 + 预览 HTML。");
    return;
  }

  if (!existsSync(AUTH_FILE)) {
    console.error(`✗ 未找到登录态 ${AUTH_FILE}，请先跑：npm run login`);
    process.exit(1);
  }

  // 3. 启动浏览器填表
  console.log(`[3/4] 启动浏览器（登录态复用）...`);
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: AUTH_FILE });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://mp.toutiao.com" });
  const page = await ctx.newPage();
  page.on("dialog", async (d) => { await d.accept().catch(() => {}); });
  const reqLog = [];
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const u = req.url();
    if (/\.(js|css|png|jpg|svg|woff|ico)/i.test(u)) return;
    reqLog.push(`${req.method()} ${u.slice(0, 160)}`);
  });
  await page.goto(EDIT_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // 关闭可能弹出的 AI 助手抽屉（遮罩 .byte-drawer-mask 会挡住编辑区点击）
  try {
    const mask = page.locator(".byte-drawer-mask").first();
    if (await mask.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mask.click({ timeout: 1000 }).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
      console.log("      ✓ 关闭 AI 助手抽屉");
    }
  } catch {}

  if (inspect) {
    console.log("[inspect] 探编辑页关键 DOM...");
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const textInputs = [...document.querySelectorAll('input[type="text"],input:not([type])')].map((e) => ({ ph: e.placeholder, id: e.id, cls: (e.className || "").toString().slice(0, 60) }));
      const textareas = [...document.querySelectorAll("textarea")].map((e) => ({ ph: e.placeholder, cls: (e.className || "").toString().slice(0, 60) }));
      const editables = [...document.querySelectorAll('[contenteditable="true"]')].map((e) => ({ cls: (e.className || "").toString().slice(0, 80), ph: e.getAttribute("data-placeholder") || e.getAttribute("placeholder") }));
      const clickables = [...document.querySelectorAll("button,a,span,div")].map((e) => (e.innerText || "").trim()).filter((t) => /草稿|保存|发布|预览|封面|cover|draft|存草|上传/.test(t)).slice(0, 25);
      const fileInputs = [...document.querySelectorAll('input[type="file"]')].length;
      return { url: location.href, textInputs, textareas, editables, clickables, fileInputs };
    });
    console.log(JSON.stringify(info, null, 2));
    await browser.close();
    return;
  }

  // 标题（textarea，用 type 逐字触发 React input 事件，fill 可能不触发）
  const titleEl = await findEl(page, S.titleInput, "标题输入框");
  await titleEl.click();
  await titleEl.fill("");
  await page.keyboard.type(article.title, { delay: 10 });
  console.log(`      ✓ 标题已填：${article.title}`);

  // 正文：真实剪贴板粘贴（grant 权限 + 写 HTML 到 clipboard + Meta+V，让 ProseMirror 的 paste handler 真正处理，state 更新触发自动保存）
  const bodyEl = await findEl(page, S.bodyEditor, "正文 ProseMirror 编辑器");
  await bodyEl.click();
  await page.waitForTimeout(300);
  await page.evaluate(async (html) => {
    const blob = new Blob([html], { type: "text/html" });
    const plain = new Blob([html.replace(/<[^>]+>/g, "")], { type: "text/plain" });
    const item = new ClipboardItem({ "text/html": blob, "text/plain": plain });
    await navigator.clipboard.write([item]);
  }, contentHtml);
  await page.keyboard.press("Meta+V");
  await page.waitForTimeout(2500);
  const textLen = await page.evaluate((el) => (document.querySelector(el)?.innerText || "").length, S.bodyEditor);
  console.log(`      ✓ 正文真实粘贴（编辑器文本 ${textLen} 字符）`);

  // 封面：头条编辑页 file input 隐藏/动态，首版跳过自动上传，草稿无封面也能保存（发布前手动补）
  if (imagePath && existsSync(coverPath)) {
    console.log(`      ℹ 封面已生成 ${coverPath.split("/").pop()}，头条 file input 隐藏，请到草稿箱手动上传`);
  }

  // 半自动：标题+正文已填入编辑器，保持浏览器开 5 分钟，用户手动上传封面 + 点"预览并发布"发布
  console.log(`\n[4/4] 半自动模式：标题+正文已填入编辑器。请在浏览器手动操作：`);
  console.log(`  1) 封面区点「单图」→ 上传 ${coverPath}`);
  console.log(`  2) 点底部「预览并发布」发布`);
  console.log(`  浏览器保持打开 5 分钟供你操作，操作完可手动关浏览器。\n`);
  try {
    await page.waitForTimeout(300000);
  } catch {}
  await browser.close();
}

const args = parseArgs(process.argv.slice(2));
if (args.login) {
  login().catch((e) => {
    console.error("登录失败：", e.message);
    process.exit(1);
  });
} else {
  publish(args).catch((e) => {
    console.error("发布失败：", e.message);
    process.exit(1);
  });
}
