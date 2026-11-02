// access_token 获取与缓存：按账号别名分文件，避免多号互相踩掉；提前 5 分钟过期刷新
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tokenCacheKey } from "../../../../_shared/accounts.mjs";

// 接口基址可用 WECHAT_API_BASE 覆盖（离线回归测试用），生产环境不设置即走官方地址
const BASE = () => process.env.WECHAT_API_BASE || "https://api.weixin.qq.com/cgi-bin";
const EARLY_MS = 5 * 60 * 1000; // 提前 5 分钟视为过期，避免临界点踩空

// 读缓存：不存在/损坏/已临近过期都返回 null
function readCache(cacheDir, alias) {
  const file = join(cacheDir, tokenCacheKey(alias));
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data.expires_at - Date.now() > EARLY_MS ? data.token : null;
  } catch {
    return null;
  }
}

// 落缓存：缓存目录由调用方传入，atom 不自行决定位置
function writeCache(cacheDir, alias, token, expiresInSec) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, tokenCacheKey(alias));
  const payload = { token, expires_at: Date.now() + expiresInSec * 1000 };
  writeFileSync(file, JSON.stringify(payload, null, 2));
}

// 取 token：命中缓存直接返回，否则请求微信并落盘；force=true 强制刷新（42001 重试用）
export async function getAccessToken({ appId, appSecret, alias, cacheDir, force = false }) {
  if (!force) {
    const cached = readCache(cacheDir, alias);
    if (cached) return cached;
  }
  const url = `${BASE()}/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) {
    // 40164 = 出口 IP 不在白名单，给出可执行的处置提示
    const hint = data.errcode === 40164 ? "（出口 IP 不在公众号后台白名单，需登录微信公众平台添加当前 IP）" : "";
    throw new Error(`获取 access_token 失败：${data.errcode} ${data.errmsg}${hint}`);
  }
  writeCache(cacheDir, alias, data.access_token, data.expires_in);
  return data.access_token;
}

// 清掉某账号的 token 缓存（强制下次重新取）
export function clearTokenCache(cacheDir, alias) {
  const file = join(cacheDir, tokenCacheKey(alias));
  if (existsSync(file)) writeFileSync(file, "{}");
  return dirname(file);
}
