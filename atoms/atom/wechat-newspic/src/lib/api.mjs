// 微信 API：token 获取/缓存、图片上传（永久素材）、写图片消息草稿
// 与 wechat-draft 的接口层几乎相同，但原子之间禁止互相 import——
// 各自维护一份最小实现是有意的：newspic 只需要「上传图 + 写图文草稿」，不需要正文图替换那套逻辑

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tokenCacheKey } from "../../../../_shared/accounts.mjs";

const BASE = () => process.env.WECHAT_API_BASE || "https://api.weixin.qq.com/cgi-bin";
const EARLY_MS = 5 * 60 * 1000;

// token 缓存读：临近过期（<5 分钟）视为失效
function readCache(cacheDir, alias) {
  const file = join(cacheDir, tokenCacheKey(alias));
  if (!existsSync(file)) return null;
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    return d.expires_at - Date.now() > EARLY_MS ? d.token : null;
  } catch {
    return null;
  }
}

// 取 access_token：命中缓存直接返回，否则请求并落盘；force 用于 42001 重试
export async function getAccessToken({ appId, appSecret, alias, cacheDir, force = false }) {
  if (!force) {
    const c = readCache(cacheDir, alias);
    if (c) return c;
  }
  const url = `${BASE()}/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) {
    const hint = data.errcode === 40164 ? "（出口 IP 不在白名单，需在公众平台添加当前 IP）" : "";
    throw new Error(`获取 access_token 失败：${data.errcode} ${data.errmsg}${hint}`);
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    join(cacheDir, tokenCacheKey(alias)),
    JSON.stringify({ token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 }, null, 2)
  );
  return data.access_token;
}

const TOKEN_ERRCODES = new Set([40001, 42001]);

// 带 token 的 JSON POST；token 失效自动刷新重试一次
async function postJson(ctx, path, payload) {
  const post = async (token) => {
    const res = await fetch(`${BASE()}${path}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };
  let token = await getAccessToken(ctx);
  let data = await post(token);
  if (data.errcode && TOKEN_ERRCODES.has(data.errcode)) {
    token = await getAccessToken({ ...ctx, force: true });
    data = await post(token);
  }
  return data;
}

// 上传图片为永久素材，返回 media_id（贴图的正文图必须走永久素材，普通 uploadimg 的 URL 不能用于 newspic）
export async function uploadPermanentImage(ctx, filePath) {
  const buffer = readFileSync(filePath);
  const filename = filePath.split(/[/\\]/).pop();
  const boundary = `----atoms${Date.now()}${Math.random().toString(16).slice(2)}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head, "utf8"), buffer, Buffer.from(tail, "utf8")]);

  const call = async (token) => {
    const res = await fetch(`${BASE()}/material/add_material?access_token=${token}&type=image`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    return res.json();
  };
  let token = await getAccessToken(ctx);
  let data = await call(token);
  if (data.errcode && TOKEN_ERRCODES.has(data.errcode)) {
    token = await getAccessToken({ ...ctx, force: true });
    data = await call(token);
  }
  if (data.errcode) throw new Error(`上传图片失败（${filename}）：${data.errcode} ${data.errmsg}`);
  return data.media_id;
}

// 写图片消息（newspic）草稿；article_type=newspic 即微信的「图片/小绿书」消息
export async function createNewspicDraft(ctx, { title, digest, content, thumbMediaId, imageMediaIds }) {
  const payload = {
    articles: [
      {
        article_type: "newspic",
        title,
        author: "",
        digest,
        content,
        content_source_url: "",
        thumb_media_id: thumbMediaId,
        show_cover_pic: 0,
        need_open_comment: 1,
        only_fans_can_comment: 0,
        image_info: { image_list: imageMediaIds.map((id) => ({ image_media_id: id })) },
      },
    ],
  };
  const data = await postJson(ctx, "/draft/add", payload);
  if (data.errcode) throw new Error(`创建图片消息草稿失败：${data.errcode} ${data.errmsg}`);
  return data.media_id;
}
