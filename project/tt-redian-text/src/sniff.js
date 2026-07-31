import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { markdownToHtml, ctaBlock } from "./html.js";

// 抓包：打开编辑页，自动填标题+正文，监听所有非统计 POST，用户手动触发保存，捕获端点+payload
// 用法：node src/sniff.js <article.json> （后台跑，浏览器开，用户手动操作触发保存）

const AUTH = join(config.paths.auth, "toutiao.json");
const EDIT_URL = "https://mp.toutiao.com/profile_v4/graphic/publish";
const jsonPath = process.argv[2] || "output/2026-07-26/01-九寨沟泥石流游客滞留/article.json";

if (!existsSync(AUTH)) { console.error("未登录，先 npm run login"); process.exit(1); }
const article = JSON.parse(await readFile(jsonPath, "utf8"));
const bodyHtml = markdownToHtml(article.body_markdown, "ocean");
const ctaHtml = ctaBlock({ question: article.cta_question || "", follow: "关 注", title: article.title }, "ocean");
const contentHtml = bodyHtml + ctaHtml;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: AUTH });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://mp.toutiao.com" });
const page = await ctx.newPage();
page.on("dialog", async (d) => { await d.accept().catch(() => {}); });

// 统计类请求过滤
const STAT = /mcs\.zijieapi|monitor_browser|gipsec|security\.zijieapi|mssdk|ttwid|metrics\/emit|notice\/boxes|sentry|report\/log/i;
let captureN = 0;
page.on("request", (req) => {
  if (req.method() !== "POST" || STAT.test(req.url())) return;
  let body = "";
  try { body = req.postData() || ""; } catch {}
  captureN++;
  console.log(`\n[捕获${captureN}] POST ${req.url()}`);
  if (body) console.log(`  payload: ${body.slice(0, 1200)}`);
});
page.on("response", async (res) => {
  const u = res.url();
  const req = res.request();
  if (req.method() !== "POST" || STAT.test(u)) return;
  try {
    const t = await res.text().catch(() => "");
    console.log(`  ← resp ${res.status()}: ${t.slice(0, 400)}`);
  } catch {}
});

await page.goto(EDIT_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
// 关 AI 抽屉
try {
  const mask = page.locator(".byte-drawer-mask").first();
  if (await mask.isVisible({ timeout: 1000 }).catch(() => false)) {
    await mask.click({ timeout: 1000 }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    console.log("✓ 关闭 AI 抽屉");
  }
} catch {}

// 填标题
const titleEl = page.locator('textarea[placeholder*="文章标题"]').first();
await titleEl.click();
await page.keyboard.type(article.title, { delay: 10 });
console.log("✓ 标题已填");

// 填正文（真实剪贴板粘贴）
const bodyEl = page.locator(".ProseMirror").first();
await bodyEl.click();
await page.waitForTimeout(300);
await page.evaluate(async (html) => {
  const blob = new Blob([html], { type: "text/html" });
  const plain = new Blob([html.replace(/<[^>]+>/g, "")], { type: "text/plain" });
  await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": plain })]);
}, contentHtml);
await page.keyboard.press("Meta+V");
await page.waitForTimeout(2500);
const textLen = await page.evaluate(() => document.querySelector(".ProseMirror")?.innerText.length || 0);
console.log(`✓ 正文已粘贴（${textLen} 字符）`);

console.log("\n========================================");
console.log("内容已填好。请在浏览器里手动操作触发草稿保存：");
console.log("  · 点 [预览] 按钮（预览前可能先存草稿）");
console.log("  · 或点封面 [单图] 上传 cover.jpg（可能触发保存）");
console.log("  · 或干脆等几分钟看自动保存");
console.log("  · 别点 [预览并发布]（那是真发布）");
console.log("我在监听所有非统计 POST，抓到保存请求会打印端点+payload。");
console.log("操作完回终端，或等 5 分钟自动结束。");
console.log("========================================\n");

// 监听 5 分钟自动结束
await page.waitForTimeout(300000);
console.log(`\n[结束] 共捕获 ${captureN} 个非统计 POST 请求`);
await browser.close();
