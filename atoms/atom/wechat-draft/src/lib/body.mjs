// 正文 HTML 处理：提取本地图片引用、上传替换成微信 CDN URL、拦截缺图与封面撞脸
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { log } from "../../../../_shared/io.mjs";
import { uploadArticleImage } from "./wechat-api.mjs";

// 本地路径判定：排除 http(s)/data/协议相对，其余一律当本地文件
const isLocal = (src) => !/^(https?:|data:|\/\/)/i.test(src);

// 从 HTML 里收集所有 img 的 src（保留原始标签，便于整体替换）
export function collectImages(html) {
  const out = [];
  const re = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (!isLocal(src)) continue;
    out.push({ tag: m[0], src, abs: resolve(decodeURIComponent(src)) });
  }
  return out;
}

// 缺图硬拦截：引用了但文件不存在时静默跳过会推出没有内文的文章，必须报错
export function findMissing(images) {
  return images.filter((it) => !existsSync(it.abs)).map((it) => it.src);
}

// 封面撞脸拦截：正文引用封面同文件 = 开局首图与封面重复
export function findCoverClash(images, coverPath) {
  const coverAbs = resolve(coverPath);
  const coverBase = basename(coverAbs);
  return images.filter((it) => it.abs === coverAbs || basename(it.abs) === coverBase);
}

// 上传所有本地图并就地替换成微信 URL；单张失败只告警不中断（与原实现一致）
export async function uploadAndReplace(ctx, html, images) {
  let out = html;
  let uploaded = 0;
  const failed = [];
  for (const it of images) {
    try {
      const url = await uploadArticleImage(ctx, it.abs);
      out = out.replace(it.tag, it.tag.replace(it.src, url));
      uploaded++;
      log(`      ✓ 内文图已上传：${basename(it.abs)}`);
    } catch (e) {
      failed.push({ file: basename(it.abs), error: e.message });
      log(`      ⚠ 内文图上传失败 ${basename(it.abs)}：${e.message}`);
    }
  }
  return { html: out, uploaded, failed };
}

// 拼接正文顶部大图（可选，默认不用：封面已用同图会重复）
export function prependCoverImage(url) {
  return `<p style="text-align:center;margin:0 0 16px;"><img src="${url}" style="max-width:100%;border-radius:4px;" /></p>`;
}

// 转义 HTML 文本（标题/摘要写入草稿时防注入）
export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
