// 扫描根目录下所有项目的 skills/，解析 frontmatter

import { getDir, readFileText, walkFiles, fileMtime } from "./access";
import type { Project, Skill } from "../types";

// 解析 frontmatter：---\nkey: val\n---，取 name / description
function parseFrontmatter(md: string): { name?: string; description?: string; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { body: md };
  const fm = m[1];
  const body = m[2];
  const get = (k: string) => {
    const re = new RegExp(`^${k}:\\s*(.+)$`, "m");
    const mm = fm.match(re);
    return mm ? mm[1].replace(/^["']|["']$/g, "").trim() : undefined;
  };
  return { name: get("name"), description: get("description"), body };
}

// 扫某项目 skills/ 目录，返回该项目的 skill 列表
async function scanProjectSkills(
  root: FileSystemDirectoryHandle,
  projectName: string,
): Promise<Skill[]> {
  const skillsDir = await getDir(root, [projectName, "skills"]);
  if (!skillsDir) return [];
  const files = await walkFiles(skillsDir, ["skills"]);
  const skills: Skill[] = [];
  for (const { segs, fh } of files) {
    if (!segs[segs.length - 1].toLowerCase().endsWith(".md")) continue;
    const relPath = `${projectName}/${segs.join("/")}`;
    const content = await readFileText(root, relPath);
    const fm = parseFrontmatter(content);
    const fileName = segs[segs.length - 1].replace(/\.md$/i, "");
    skills.push({
      project: projectName,
      relPath,
      name: fm.name ?? fileName,
      description: fm.description ?? bodyFirstLine(fm.body),
      content,
      mtime: await fileMtime(fh),
    });
  }
  skills.sort((a, b) => b.mtime - a.mtime);
  return skills;
}

// 取正文首行作为兜底 description
function bodyFirstLine(body: string): string {
  const line = body.split(/\r?\n/).find((l) => l.trim() && !l.startsWith("#"));
  return (line ?? "").slice(0, 80);
}

// 列出根目录下一级目录名（即项目），并扫描每个项目的 skills
export async function scanAllProjects(
  root: FileSystemDirectoryHandle,
): Promise<Project[]> {
  const names: string[] = [];
  // @ts-ignore
  for await (const entry of root.values()) {
    if (entry.kind === "directory") names.push(entry.name);
  }
  names.sort();
  const projects: Project[] = [];
  for (const name of names) {
    // 跳过本 manager 自身与隐藏目录
    if (name === "manager" || name.startsWith(".")) continue;
    const skills = await scanProjectSkills(root, name);
    projects.push({ name, skills, hasSkills: skills.length > 0 });
  }
  return projects;
}
