// 多公众号账号配置：每个号一组 WECHAT_<别名>_APPID / WECHAT_<别名>_SECRET，按别名取用.
// 目标：发哪个号由调用方 --account 指定，atom 内永不写死具体公众号。

// 读取 env，按别名列出所有已配置账号（不含密钥值）
export function listAccounts(env = process.env) {
  const names = new Set();
  for (const k of Object.keys(env)) {
    const m = k.match(/^WECHAT_([A-Z0-9_]+)_APPID$/);
    if (m) names.add(m[1]);
  }
  return [...names].sort().map((alias) => ({
    alias,
    appid: env[`WECHAT_${alias}_APPID`],
    hasSecret: Boolean(env[`WECHAT_${alias}_SECRET`] || env[`WECHAT_${alias}_APPSECRET`]),
  }));
}

// 按别名取账号凭据；未传别名时回落到通用 WECHAT_APPID
export function resolveAccount(alias, env = process.env) {
  if (!alias) {
    const appId = env.WECHAT_APPID || env.WECHAT_APP_ID || "";
    const appSecret = env.WECHAT_APPSECRET || env.WECHAT_APP_SECRET || "";
    if (!appId || !appSecret) {
      throw new Error("未指定 --account 且通用 WECHAT_APPID/WECHAT_APPSECRET 未配置");
    }
    return { alias: "default", appId, appSecret };
  }
  const key = String(alias).toUpperCase();
  const appId = env[`WECHAT_${key}_APPID`] || "";
  const appSecret = env[`WECHAT_${key}_SECRET`] || env[`WECHAT_${key}_APPSECRET`] || "";
  if (!appId || !appSecret) {
    const known = listAccounts(env).map((a) => a.alias).join(", ") || "（无）";
    throw new Error(`未找到公众号账号「${alias}」，已配置的有：${known}`);
  }
  return { alias: key, appId, appSecret };
}

// token 按账号隔离缓存，避免不同号互相踩掉（同 appid 并发仍有风险，故串行调用）
export function tokenCacheKey(alias) {
  return `token-${String(alias).toLowerCase()}.json`;
}
