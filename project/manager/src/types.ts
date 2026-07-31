// 类型定义

// File System Access API 在部分 TS lib 里类型不全，这里收窄用
export type FsDirHandle = FileSystemDirectoryHandle;
export type FsFileHandle = FileSystemFileHandle;

export interface Skill {
  project: string; // 项目目录名，如 wechat-img
  relPath: string; // 相对项目根的路径，如 skills/wechat-daily.md
  name: string; // frontmatter name 或文件名去后缀
  description: string; // frontmatter description 或首段
  content: string; // .md 全文
  mtime: number; // 修改时间戳
}

export interface Project {
  name: string;
  skills: Skill[];
  hasSkills: boolean;
}

export interface HistoryItem {
  project: string;
  dir: string; // results / output / logs / cache
  relPath: string; // 相对项目根
  name: string;
  mtime: number;
  kind: "html" | "md" | "json" | "image" | "text" | "other";
}

export type RunStatus = "idle" | "streaming" | "done" | "error";

// 已知项目目录（/Users/zcy1/code_self/AI/project 下的 skill 项目）
// 授权前 select 也要有选项，故硬编码；授权后会用扫描结果校验
export const KNOWN_PROJECTS = [
  "dy-chat-img",
  "forecast",
  "mingchangmian",
  "tt-redian-text",
  "wechat",
  "wechat-img",
  "video",
  "play",
];


