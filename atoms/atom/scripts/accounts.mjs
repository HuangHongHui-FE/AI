#!/usr/bin/env node
// 账号管理：列出 / 校验已配置的公众号账号（只显示 appid 前 6 位，不泄露密钥）.
// 用法：node atom/scripts/accounts.mjs [--check <别名>]

import { listAccounts, resolveAccount } from "../../_shared/accounts.mjs";
import { loadEnv } from "../../_shared/env.mjs";
import { parseArgs, emit, log } from "../../_shared/io.mjs";

const args = parseArgs();
loadEnv();

// appid 脱敏展示，避免终端/日志留全量
const mask = (s) => (s ? s.slice(0, 6) + "…" + s.slice(-2) : "");

if (args.check) {
  try {
    const acc = resolveAccount(args.check);
    log(`账号「${args.check}」配置正常：${mask(acc.appId)}`);
    emit({ ok: true, account: acc.alias, appid: mask(acc.appId) });
  } catch (e) {
    log(e.message);
    emit({ ok: false, error: e.message }, 2);
  }
}

const list = listAccounts();
if (!list.length) {
  log("未配置任何具名公众号账号。请在 .env 中按 WECHAT_<别名>_APPID / WECHAT_<别名>_SECRET 配置");
} else {
  log(`已配置 ${list.length} 个公众号账号：`);
  for (const a of list) log(`  - ${a.alias}  ${mask(a.appid)}  密钥${a.hasSecret ? "已配" : "缺失"}`);
}
emit({ accounts: list.map((a) => ({ ...a, appid: mask(a.appid) })) });
