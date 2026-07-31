import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 项目根目录
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// 手写 .env 加载（不依赖 dotenv，少装一个包）
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const config = {
  root: ROOT,
  author: process.env.AUTHOR_NAME || "",
  embedOriginalImage: process.env.EMBED_ORIGINAL_IMAGE !== "false",
  paths: {
    input: join(ROOT, "input"),
    output: join(ROOT, "output"),
    cache: join(ROOT, "cache"),
    auth: join(ROOT, ".auth"),
  },
};

// 封面比例：头条图文封面推荐 1:1（正方形），兼容信息流卡片
export const COVER = { w: 900, h: 900 };

export async function ensureDirs() {
  for (const p of [config.paths.output, config.paths.cache, config.paths.auth]) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
}
