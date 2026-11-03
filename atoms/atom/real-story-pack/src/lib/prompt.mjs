// 包装 prompt：把初稿 + 12 类锚点 + 红线 + 输出契约拼成可直接喂给模型的文本
// 原子不自己改写（改写由 Claude 做），只负责把「真实感滤镜」定死
import { ANCHORS, RED_LINES } from "./anchors.mjs";
import { bodyOf } from "./verify.mjs";

export function buildPackPrompt(article, { min = 8 } = {}) {
  const body = bodyOf(article);
  const blocks = [];

  blocks.push("# 真人真事包装任务");
  blocks.push("");
  blocks.push("把下面这篇初稿重新包装成读者会信服「这是真事」的版本。不是改写，是加一层真实感滤镜。");
  blocks.push("核心原则：读者相信一篇文章是真的，不是因为有证据，而是因为有细节。");
  blocks.push("");
  blocks.push("## 初稿");
  blocks.push(body || "（缺少正文）");
  blocks.push("");
  blocks.push(`## 12 类真实感锚点（本篇至少命中 ${min} 类，每类至少 1 个）`);
  ANCHORS.forEach((a, i) => blocks.push(`${i + 1}. **${a.name}**：${a.guide}`));
  blocks.push("");
  blocks.push("## 红线（违反任一条即回炉）");
  RED_LINES.forEach((r) => blocks.push(`- **${r.name}**：${r.guide}`));
  blocks.push("- **不抄袭真实他人经历**：所有细节都是「可能发生在任何人身上」的通用样本。");
  blocks.push("");
  blocks.push("## 包装方法");
  blocks.push("1. 通读初稿，标出「那天 / 我家 / 他说 / 前段时间」这类抽象表达。");
  blocks.push("2. 按 12 类锚点逐段替换，每段最多 2-3 个，避免过载。");
  blocks.push("3. 对话要有停顿和沉默（「……」或「愣了一下」）。");
  blocks.push("4. 数字要具体（「3万2」不是「3万」，「2000」不是「两千」）。");
  blocks.push("5. 朗读一遍，改掉「读起来不像真事」的地方。");
  blocks.push("");
  blocks.push("## 输出（严格按此 JSON）");
  blocks.push("```json");
  blocks.push(
    JSON.stringify(
      {
        title: "标题（沿用或微调）",
        digest: "≤54字摘要",
        body_markdown: "包装后的正文 markdown",
        anchors_used: ANCHORS.map((a) => a.name),
      },
      null,
      2,
    ),
  );
  blocks.push("```");

  return { prompt: blocks.join("\n"), anchor_ids: ANCHORS.map((a) => a.id) };
}