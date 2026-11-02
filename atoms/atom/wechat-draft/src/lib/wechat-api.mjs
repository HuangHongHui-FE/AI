// 微信 API 客户端：上传永久素材（封面）、上传正文图、写草稿
// token 通过参数注入，本模块不读 env、不碰缓存，只管 API 调用
import { readFileSync } from "node:fs";
import { getAccessToken } from "./token.mjs";

// 接口基址可用 WECHAT_API_BASE 覆盖（离线回归测试用）
const BASE = () => process.env.WECHAT_API_BASE || "https://api.weixin.qq.com/cgi-bin";

// token 失效类错误码：42001 过期、40001 凭据无效，命中后强制刷新重试一次
const TOKEN_ERRCODES = new Set([40001, 42001, 42002, 42007, 42009]);

// 带 token 的调用：首次失败若是 token 问题，刷新 token 后重试一次
async function callWithToken(ctx, path, init) {
  const run = async (token) => {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE()}${path}${sep}access_token=${token}`, init());
    return res.json();
  };
  let token = await getAccessToken(ctx);
  let data = await run(token);
  if (data.errcode && TOKEN_ERRCODES.has(data.errcode)) {
    token = await getAccessToken({ ...ctx, force: true });
    data = await run(token);
  }
  return data;
}

// 构造 multipart 请求体：微信上传接口固定字段名 media
function multipart(buffer, filename, contentType) {
  const boundary = `----atoms${Date.now()}${Math.random().toString(16).slice(2)}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    boundary,
    body: Buffer.concat([Buffer.from(head, "utf8"), Buffer.from(buffer), Buffer.from(tail, "utf8")]),
  };
}

// 依扩展名给 Content-Type；微信对 webp/png 也接受，但实际字节要与声明一致
function contentTypeOf(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

// 上传永久图片素材（封面用），返回 { mediaId, url }
export async function uploadPermanentImage(ctx, filePath, label = "封面素材") {
  const buffer = readFileSync(filePath);
  const filename = filePath.split(/[/\\]/).pop();
  const { boundary, body } = multipart(buffer, filename, contentTypeOf(filename));
  const data = await callWithToken(ctx, "/material/add_material?type=image", () => ({
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  }));
  if (data.errcode) throw new Error(`上传${label}失败：${data.errcode} ${data.errmsg}`);
  return { mediaId: data.media_id, url: data.url };
}

// 上传正文内图（不占永久素材额度），返回可直接放进 <img src> 的微信 CDN URL
export async function uploadArticleImage(ctx, filePath) {
  const buffer = readFileSync(filePath);
  const filename = filePath.split(/[/\\]/).pop();
  const { boundary, body } = multipart(buffer, filename, contentTypeOf(filename));
  const data = await callWithToken(ctx, "/media/uploadimg", () => ({
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  }));
  if (data.errcode) throw new Error(`上传正文图片失败：${data.errcode} ${data.errmsg}`);
  return data.url;
}

// 写草稿箱，返回 media_id
export async function createDraft(ctx, { title, author, digest, content, thumbMediaId }) {
  const payload = {
    articles: [
      {
        title,
        author: author || "",
        digest: digest || "",
        content,
        content_source_url: "",
        thumb_media_id: thumbMediaId,
        need_open_comment: 1,
        only_fans_can_comment: 0,
      },
    ],
  };
  const data = await callWithToken(ctx, "/draft/add", () => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  if (data.errcode) throw new Error(`创建草稿失败：${data.errcode} ${data.errmsg}`);
  return data.media_id;
}

// 校验 token 是否可用：发一条最轻量的接口看 errcode，供推草稿前预检
export async function verifyToken(ctx) {
  const token = await getAccessToken(ctx);
  const res = await fetch(`${BASE()}/get_api_domain_ip?access_token=${token}`);
  const data = await res.json();
  if (data.errcode) return { ok: false, errcode: data.errcode, errmsg: data.errmsg };
  return { ok: true };
}
