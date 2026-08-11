// 番茄作家后台扫码登录：在脚本弹出的浏览器里扫码 → 抓 Cookie + CSRF 存 .auth/fanqie.json
// 用法：npm run login（必须在弹窗浏览器里扫码，登录后自动保存）
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ROOT = src 的上一级 = novel 项目根
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUTH_FILE = join(ROOT, ".auth", "fanqie.json");
const HOME = "https://fanqienovel.com/";
// 作家后台：登录后导航到此处会触发 /api/author/* 请求（book_list 等），用于抓鉴权头
const WRITER = "https://fanqienovel.com/main/writer/";

async function login() {
  await mkdir(dirname(AUTH_FILE), { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let auth = null; // { cookie, csrfToken }
  page.on("request", (req) => {
    if (!req.url().includes("/api/author")) return;
    const h = req.headers();
    const cookie = h["cookie"];
    const csrf = h["x-secsdk-csrf-token"];
    if (cookie && csrf && !auth) {
      auth = { cookie, csrfToken: csrf };
      console.log(`[登录] ✓ 已捕获鉴权（cookie ${cookie.length} 字节, csrf ${csrf.length} 字节）`);
    }
  });

  await page.goto(HOME);
  console.log("\n[登录] 已弹出浏览器。请在该浏览器窗口里【扫码登录】番茄作家账号。");
  console.log("[登录] 登录成功后自动保存，无需按键。若浏览器打开了其他页面，请回到番茄后台。");

  const deadline = Date.now() + 360000; // 6 分钟
  let navigatedToWriter = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    try {
      const cur = page.url();
      const loggedIn = !/passport|login|sign|sso/i.test(cur) && cur.startsWith("https://fanqienovel.com");
      // 已登录 & 已抓到鉴权 → 保存收工
      if (auth && loggedIn) {
        await saveAuth(auth, cur);
        await browser.close();
        return;
      }
      // 已登录但还没抓到 → 导航到后台触发 /api/author 请求（只导航一次）
      if (loggedIn && !auth && !navigatedToWriter) {
        navigatedToWriter = true;
        console.log("[登录] 已登录，正在进入作家后台抓取鉴权……");
        try {
          await page.goto(WRITER, { waitUntil: "domcontentloaded", timeout: 20000 });
        } catch { /* 后台无书也忽略 */ }
        continue;
      }
      // 已导航后台但还没抓到 → 主动发起一个 /api/author 请求（后台首页会调 book_list）
      if (loggedIn && !auth && navigatedToWriter) {
        try {
          await page.evaluate(() =>
            fetch("/api/author/book/book_list/v0?aid=2503&app_name=muye_novel&page_index=0&page_count=10", {
              credentials: "include",
            })
          );
        } catch { /* 忽略 */ }
      }
    } catch { /* 跨域/瞬时错误跳过本轮 */ }
  }
  if (auth) {
    await saveAuth(auth, page.url());
    await browser.close();
    return;
  }

  // 兜底：从 cookies 直接拼 Cookie 头 + 找 csrf cookie
  console.log("[登录] ⚠ 未通过请求头抓到鉴权，尝试从 cookie 兜底……");
  const cks = await ctx.cookies();
  const cookie = cks.map((c) => `${c.name}=${c.value}`).join("; ");
  const csrfCookie = cks.find((c) => /csrf|secsdk|token/i.test(c.name));
  if (cookie && csrfCookie) {
    await saveAuth({ cookie, csrfToken: csrfCookie.value }, page.url());
    await browser.close();
    return;
  }
  console.log("[登录] ✗ 未捕获到有效鉴权。请重跑 npm run login，在弹窗浏览器里完成扫码。");
  await browser.close();
}

async function saveAuth(auth, url) {
  await mkdir(dirname(AUTH_FILE), { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify({ ...auth, url, fetchedAt: Date.now() }, null, 2));
  console.log(`[登录] ✓ 鉴权已保存到 ${AUTH_FILE}`);
  console.log("[登录] 之后可直接 npm run publish -- --list 验证连通。");
}

login().catch((e) => {
  console.error("[登录] 出错:", e.message);
  process.exit(1);
});
