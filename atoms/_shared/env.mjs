// 环境变量加载与校验：atom 只读 process.env，不读自身目录下的 .env，保证换机器行为一致.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { atomsRoot } from "./paths.mjs";

let loaded = false;

// 从 atoms 根加载 .env（只加载一次；已在外部注入的环境变量优先，不被覆盖）
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const file = join(atomsRoot(), ".env");
  if (!existsSync(file)) return;
  try {
    process.loadEnvFile(file); // Node 20.12+ 内置，无需 dotenv
  } catch {
    /* 老版本 Node 无此 API，忽略；此时要求外部注入环境变量 */
  }
}

// 校验必需变量，缺任意一个则抛错并列全部缺失项（一次性告知，免得反复试错）
export function requireEnv(names) {
  loadEnv();
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`缺少环境变量：${missing.join(", ")}（参考 .env.example）`);
  return Object.fromEntries(names.map((n) => [n, process.env[n]]));
}
