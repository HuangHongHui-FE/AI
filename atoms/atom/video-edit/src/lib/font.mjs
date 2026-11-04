// 中文字体定位：显式路径 > VIDEO_EDIT_FONT > 常见系统字体。找不到就报清楚，不硬编码 macOS 路径。
import { existsSync } from "node:fs";
import { join } from "node:path";

const CANDIDATES = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  join("C:", "Windows", "Fonts", "msyh.ttc"),
  join("C:", "Windows", "Fonts", "simhei.ttf"),
];

export function findFont(explicit) {
  if (explicit) return String(explicit);
  if (process.env.VIDEO_EDIT_FONT) return process.env.VIDEO_EDIT_FONT;
  return CANDIDATES.find((p) => existsSync(p)) || null;
}

export function fontExists(path) {
  return Boolean(path) && existsSync(path);
}