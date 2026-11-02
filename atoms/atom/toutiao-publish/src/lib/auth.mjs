// 头条号登录态：有头浏览器扫码，轮询检测登录成功后保存 storageState
// 检测逻辑为什么这么绕：头条登录跨域跳转多（passport/sso），页面标题和 cookie 会瞬时变化，
// 单次判断不可靠——必须三项同时满足（离开登录页 / 非 404 / 有登录态 cookie）才算登录成功

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const HOME_URL = "https://mp.toutiao.com/";

// 登录态 cookie 特征：头条用 sessionid / sso_uid / passport_auth 等
const LOGIN_COOKIE_RE = /sessionid|sso_uid|login_user|passport_auth|sso_passport|^uid$|^sid$/i;

// 打开有头浏览器等用户扫码；检测到登录态就保存，返回 { saved, cookies, url }
export async function login({ authFile, chromium, timeoutMs = 240000 }) {
  mkdirSync(dirname(authFile), { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(HOME_URL);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    try {
      const url = page.url();
      const title = await page.title();
      const cookies = await ctx.cookies();
      const leftLogin = !/login|sso|passport|sign/i.test(url);
      const not404 = !/404|not found/i.test(title);
      const hasLoginCookie = cookies.some((c) => LOGIN_COOKIE_RE.test(c.name));
      if (leftLogin && not404 && cookies.length >= 5 && hasLoginCookie) {
        await page.waitForTimeout(2000); // 等 cookie 落定再存
        await ctx.storageState({ path: authFile });
        await browser.close();
        return { saved: true, cookies: cookies.length, url };
      }
    } catch {
      // 跨域导航时 title/cookies 可能瞬时抛错，跳过本轮
    }
  }
  await browser.close();
  return { saved: false, reason: `${timeoutMs / 1000} 秒内未检测到登录态` };
}

// 检查登录态文件是否存在且不是空壳（storageState 至少要有 cookies 字段）
export function hasAuth(authFile) {
  if (!existsSync(authFile)) return false;
  try {
    const s = JSON.parse(readFileSync(authFile, "utf8"));
    return Array.isArray(s.cookies) && s.cookies.length > 0;
  } catch {
    return false;
  }
}
