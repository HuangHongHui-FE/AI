// 日志追加：把本篇实际使用的维度写回当日日志的「## NN | 标题」分节
// 只追加/更新维度行，绝不覆盖已有正文——历史日志是避撞的唯一依据，写坏了轮换就失效

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// 维度键 → 日志里的中文行名（与 LABELS 反向对应，theme/cover 有专用前缀）
const LINE_NAME = {
  title_style: "title_style",
  收口方式: "收口方式",
  收口骨架: "收口骨架",
  收口句式: "收口句式骨架",
  开头钩子: "开头钩子",
  开头骨架: "开头骨架",
  结构配方: "结构配方",
  叙事口吻: "叙事口吻",
  切入角度: "切入角度",
  段间衔接: "段间衔接",
  格式组合: "格式组合",
  theme: "排版 theme",
  cover_style: "封面布局",
  口头禅: "口头禅",
};

// 把 dims 渲染成日志行；备注单独放最后
function renderLines(dims, note) {
  const lines = [];
  for (const [key, name] of Object.entries(LINE_NAME)) {
    if (dims[key] === undefined) continue;
    lines.push(`- ${name}：${dims[key]}`);
  }
  if (note) lines.push(`- 备注：${note}`);
  return lines;
}

// 日志里非文章分节的尾巴段（顺延候选/总结等），新分节必须插在它之前
// 注意：不能写 ^##\s*(?!\d)，\s* 会把前面的换行吃掉导致 ^ 失效
const TAIL_SECTION_RE = /^##\s+(?!\d+\s*\|)/m;

// 追加一篇：date 决定文件名，no 决定分节编号
// 已存在同编号分节时只补缺失的维度行（不覆盖已写内容），返回 { file, action }
export function appendArticle({ logsDir, date, no, title, dims, note = "" }) {
  const file = join(logsDir, `${date}.md`);
  const sectionHeader = `## ${String(no).padStart(2, "0")} | ${title}`;
  let text = existsSync(file) ? readFileSync(file, "utf8") : `# ${date} 发文日志\n`;

  const secIdx = text.indexOf(sectionHeader);
  if (secIdx === -1) {
    // 新分节：插在「顺延次日候选」这类尾巴段之前，否则追加到末尾
    const body = `${sectionHeader}\n\n${renderLines(dims, note).join("\n")}\n`;
    const tail = TAIL_SECTION_RE.exec(text);
    if (tail && tail.index > 0) {
      text = text.slice(0, tail.index).trimEnd() + `\n\n${body}\n` + text.slice(tail.index);
    } else {
      text = text.trimEnd() + `\n\n${body}`;
    }
    writeFileSync(file, text);
    return { file, action: "section-added" };
  }

  // 已有分节：只补缺失维度，不动已写内容
  const start = secIdx + sectionHeader.length;
  const nextSec = text.indexOf("\n## ", start);
  const end = nextSec === -1 ? text.length : nextSec;
  const secBody = text.slice(start, end);

  const missing = [];
  for (const [key, name] of Object.entries(LINE_NAME)) {
    if (dims[key] === undefined) continue;
    if (new RegExp(`^-\\s*${name}\\s*[:：]`, "m").test(secBody)) continue; // 已存在则跳过
    missing.push(`- ${name}：${dims[key]}`);
  }
  if (note && !/^-\s*备注\s*[:：]/m.test(secBody)) missing.push(`- 备注：${note}`);
  if (!missing.length) return { file, action: "no-change" };

  const insertAt = secBody.replace(/\s*$/, "").length + start;
  text = text.slice(0, insertAt) + `\n${missing.join("\n")}` + text.slice(insertAt);
  writeFileSync(file, text);
  return { file, action: "dims-filled", added: missing.length };
}
