// 扫描各项目 results/ output/ logs/ cache/ 下的产物文件，按 mtime 倒序

import { getDir, walkFiles, fileMtime } from "./access";
import type { HistoryItem } from "../types";

const PRODUCT_DIRS = ["results", "output", "logs", "cache"];

function kindOf(name: string): HistoryItem["kind"] {
  const n = name.toLowerCase();
  if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
  if (n.endsWith(".md")) return "md";
  if (n.endsWith(".json")) return "json";
  if (/\.(png|jpg|jpeg|gif|webp|bmp)$/.test(n)) return "image";
  if (/\.(txt|js|ts|css|csv|log|sh|py)$/.test(n)) return "text";
  return "other";
}

export async function scanProjectHistory(
  root: FileSystemDirectoryHandle,
  projectName: string,
): Promise<HistoryItem[]> {
  const items: HistoryItem[] = [];
  for (const dirName of PRODUCT_DIRS) {
    const dir = await getDir(root, [projectName, dirName]);
    if (!dir) continue;
    const files = await walkFiles(dir, [dirName]);
    for (const { segs, fh } of files) {
      items.push({
        project: projectName,
        dir: dirName,
        relPath: `${projectName}/${segs.join("/")}`,
        name: segs[segs.length - 1],
        mtime: await fileMtime(fh),
        kind: kindOf(segs[segs.length - 1]),
      });
    }
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}
