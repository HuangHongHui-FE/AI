import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function required(name, value) {
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 .env 中设置。参考 .env.example`);
  }
  return value;
}

export const config = {
  root: ROOT,
  wechat: {
    appId: process.env.WECHAT_APP_ID || process.env.WECHAT_APPID || '',
    appSecret: process.env.WECHAT_APP_SECRET || process.env.WECHAT_APPSECRET || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  },
  author: process.env.AUTHOR_NAME || '',
  embedOriginalImage: process.env.EMBED_ORIGINAL_IMAGE !== 'false',
  paths: {
    input: join(ROOT, 'input'),
    output: join(ROOT, 'output'),
    cache: join(ROOT, 'cache'),
  },
};

export function requireAnthropic() {
  required('ANTHROPIC_API_KEY', config.anthropic.apiKey);
  return config.anthropic;
}

export function requireWechat() {
  required('WECHAT_APP_ID', config.wechat.appId);
  required('WECHAT_APP_SECRET', config.wechat.appSecret);
  return config.wechat;
}

export async function ensureDirs() {
  for (const p of [config.paths.output, config.paths.cache]) {
    if (!existsSync(p)) await mkdir(p, { recursive: true });
  }
}

export async function readCache(name) {
  const file = join(config.paths.cache, name);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function writeCache(name, data) {
  await ensureDirs();
  await writeFile(join(config.paths.cache, name), JSON.stringify(data, null, 2));
}
