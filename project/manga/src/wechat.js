import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config, readCache, writeCache, requireWechat } from './config.js';

const BASE = 'https://api.weixin.qq.com/cgi-bin';

export async function getAccessToken() {
  requireWechat();
  const cached = await readCache('token.json');
  const now = Date.now();
  if (cached && cached.expires_at - now > 5 * 60 * 1000) {
    return cached.token;
  }

  const url = `${BASE}/token?grant_type=client_credential&appid=${config.wechat.appId}&secret=${config.wechat.appSecret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`获取 access_token 失败：${data.errcode} ${data.errmsg}`);
  }

  const token = data.access_token;
  const expiresAt = now + data.expires_in * 1000;
  await writeCache('token.json', { token, expires_at: expiresAt });
  return token;
}

function buildMultipart(buffer, filename, contentType) {
  const boundary = `----wechatimg${Date.now()}${Math.random().toString(16).slice(2)}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    boundary,
    body: Buffer.concat([
      Buffer.from(head, 'utf8'),
      Buffer.from(buffer),
      Buffer.from(tail, 'utf8'),
    ]),
  };
}

export async function uploadPermanentImage(filePath) {
  const token = await getAccessToken();
  const buffer = await readFile(filePath);
  const filename = filePath.split(/[/\\]/).pop();
  const ext = filename.split('.').pop().toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const { boundary, body } = buildMultipart(buffer, filename, contentType);
  const url = `${BASE}/material/add_material?access_token=${token}&type=image`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`上传封面素材失败：${data.errcode} ${data.errmsg}`);
  }
  return { mediaId: data.media_id, url: data.url };
}

export async function uploadArticleImage(filePath) {
  const token = await getAccessToken();
  const buffer = await readFile(filePath);
  const filename = filePath.split(/[/\\]/).pop();
  const ext = filename.split('.').pop().toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const { boundary, body } = buildMultipart(buffer, filename, contentType);
  const url = `${BASE}/media/uploadimg?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`上传正文图片失败：${data.errcode} ${data.errmsg}`);
  }
  return data.url;
}

export async function createDraft({ title, author, digest, content, thumbMediaId }) {
  const token = await getAccessToken();
  const url = `${BASE}/draft/add?access_token=${token}`;
  const payload = {
    articles: [
      {
        title,
        author: author || config.author || '',
        digest: digest || '',
        content,
        content_source_url: '',
        thumb_media_id: thumbMediaId,
        need_open_comment: 1,
        only_fans_can_comment: 0,
      },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`创建草稿失败：${data.errcode} ${data.errmsg}`);
  }
  return data.media_id;
}
