// 文稿清理与分块：markdown 转成适合朗读的纯文本，按句尾标点切块
// 分块是必需的——edge-tts 单次请求文本过长会被截断或超时

// markdown → 朗读文本：去掉所有排版符号，保留可读内容
export function cleanScript(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接保留文字
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // 图片整条去掉
    .replace(/:::(info|tip|warning|danger|stat|quote|time)[\s\S]*?:::/g, "") // 自定义块去掉（朗读不出结构）
    .replace(/^#+\s*/gm, "") // 标题符号
    .replace(/^>\s*/gm, "") // 引用符号
    .replace(/```[\s\S]*?```/g, "") // 代码块
    .replace(/`([^`]+)`/g, "$1") // 行内代码
    .replace(/(\*\*|__|\*|_)/g, "") // 加粗/斜体标记
    .replace(/~~([^~]+)~~/g, "$1") // 删除线保留文字
    .replace(/==([^=]+)==/g, "$1") // 高亮保留文字
    .replace(/^\s*[-*+]\s+/gm, "") // 列表符号
    .replace(/^\s*\d+\.\s+/gm, "") // 有序列表符号
    .replace(/^\|.*\|$/gm, "") // 表格行去掉（读不出来的结构）
    .replace(/^---$/gm, "") // 分隔线
    .replace(/"([^"]*)"/g, "「$1」") // ASCII 引号转中文
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// 按中文句尾标点切块，每块不超过 maxChars；句号优先，避免把一句话切断
export function splitScript(text, maxChars = 400) {
  if (!text) return [];
  // 按句尾标点分段（保留标点）
  const sentences = text.split(/(?<=[。！？；\n])/).filter((s) => s.trim());
  const chunks = [];
  let cur = "";

  for (const s of sentences) {
    // 单句就超长（罕见，多半是没有标点的长段落）：按逗号再切
    if (s.length > maxChars) {
      if (cur.trim()) {
        chunks.push(cur.trim());
        cur = "";
      }
      const parts = s.split(/(?<=[，,])/);
      let sub = "";
      for (const p of parts) {
        if ((sub + p).length > maxChars && sub) {
          chunks.push(sub.trim());
          sub = p;
        } else sub += p;
      }
      if (sub.trim()) cur = sub;
      continue;
    }
    if ((cur + s).length > maxChars && cur.trim()) {
      chunks.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
