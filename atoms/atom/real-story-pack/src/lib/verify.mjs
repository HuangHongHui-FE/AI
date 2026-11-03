// 校验：12 类锚点覆盖 + 红线 + 抽象表达提示
// ok 判据：命中 ≥min（默认 8）类锚点，且没有红线
import { ANCHORS, ABSTRACT_PATTERNS, RED_LINES } from "./anchors.mjs";

export function bodyOf(article) {
  if (typeof article === "string") return article;
  return article?.body_markdown || article?.body || article?.content || "";
}

export function verifyPack(article, { min = 8 } = {}) {
  const body = bodyOf(article);
  if (!body.trim()) {
    return { ok: false, score: 0, min, anchors: [], missing: ANCHORS.map((a) => a.name), abstract: [], red_lines: [], warns: ["缺少正文（body_markdown）"] };
  }

  const anchors = ANCHORS.map((a) => ({ id: a.id, name: a.name, ...a.detect(body) }));
  const found = anchors.filter((a) => a.found);
  const missing = anchors.filter((a) => !a.found).map((a) => a.name);

  const warns = [];
  for (const a of found) if (a.note) warns.push(`${a.name}：${a.note}`);

  const abstract = [];
  for (const p of ABSTRACT_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(body))) abstract.push({ text: m[0], hint: p.hint });
  }

  const redLines = RED_LINES.map((r) => ({ id: r.id, name: r.name, ...r.detect(body) })).filter((r) => r.found);

  return {
    ok: found.length >= min && redLines.length === 0,
    score: found.length,
    min,
    anchors,
    missing,
    abstract,
    red_lines: redLines,
    warns,
  };
}