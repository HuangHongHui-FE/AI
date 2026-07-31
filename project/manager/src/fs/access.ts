// File System Access API 封装：根目录授权、递归读 skills 子目录、读/写文件、列产物目录

// 浏览器支持探测
export function supportsFsAccess(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

// 弹出目录选择器，返回根目录 handle
export async function pickRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const h = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    return h as FileSystemDirectoryHandle;
  } catch {
    // 用户取消
    return null;
  }
}

// 逐级取子目录 handle，不存在则按 throwOnError 决定是否抛错
export async function getDir(
  root: FileSystemDirectoryHandle,
  path: string[],
  throwOnError = false,
): Promise<FileSystemDirectoryHandle | null> {
  let cur = root;
  for (const seg of path) {
    try {
      cur = await cur.getDirectoryHandle(seg);
    } catch {
      if (throwOnError) throw new Error(`目录不存在: ${path.join("/")}`);
      return null;
    }
  }
  return cur;
}

// 递归遍历目录下所有文件 handle，返回 [relPathSegments, fileHandle]
export async function walkFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string[] = [],
): Promise<{ segs: string[]; fh: FileSystemFileHandle }[]> {
  const out: { segs: string[]; fh: FileSystemFileHandle }[] = [];
  // @ts-ignore asyncIterator 在 lib 里未声明
  for await (const entry of dir.values()) {
    const path = [...prefix, entry.name];
    if (entry.kind === "file") {
      out.push({ segs: path, fh: entry as FileSystemFileHandle });
    } else {
      out.push(...(await walkFiles(entry as FileSystemDirectoryHandle, path)));
    }
  }
  return out;
}

// 读文本文件
export async function readFileText(
  root: FileSystemDirectoryHandle,
  relPath: string,
): Promise<string> {
  const segs = relPath.split("/");
  let dir = root;
  for (let i = 0; i < segs.length - 1; i++) dir = await dir.getDirectoryHandle(segs[i]);
  const fh = await dir.getFileHandle(segs[segs.length - 1]);
  const f = await fh.getFile();
  return await f.text();
}

// 写文本文件（覆盖）
export async function writeFileText(
  root: FileSystemDirectoryHandle,
  relPath: string,
  content: string,
): Promise<void> {
  const segs = relPath.split("/");
  let dir = root;
  for (let i = 0; i < segs.length - 1; i++) dir = await dir.getDirectoryHandle(segs[i], { create: true });
  const fh = await dir.getFileHandle(segs[segs.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

// 取文件 mtime
export async function fileMtime(fh: FileSystemFileHandle): Promise<number> {
  const f = await fh.getFile();
  return f.lastModified;
}
