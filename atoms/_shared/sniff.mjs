// 真实图片格式判定：按文件头识别，不信任扩展名（防 WebP/PNG 假 .jpg 被微信 40137 拒）.
import { readFileSync } from "node:fs";

// 识别 jpg/png/webp/gif；不是已知图片格式返回 null
export function sniffFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  return null;
}

// 读文件并判定真实格式
export function sniffFile(filePath) {
  return sniffFormat(readFileSync(filePath));
}
