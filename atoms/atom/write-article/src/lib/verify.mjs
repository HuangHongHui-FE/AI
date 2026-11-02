// 稿件校验：按本篇抽中的维度 + 硬约束检查成稿
// 与 selfcheck 的分工：selfcheck 管「通用硬门」（第一人称/模板句/节奏），
// 本文件只管「本篇该有的形状有没有」——抽了「数字定格」结尾就得是数字收尾，
// 抽了「双标题+清单」就得有两个 ##。这是 selfcheck 测不出来的。

import { LENGTH, FACTS } from "../../references/rules.mjs";
import { stripNo } from "./dims.mjs";

// 中文计字（与 selfcheck 同口径）
function charCount(s) {
  return (s || "").replace(/[#>*_\-`>!\[\]()|]/g, "").replace(/\s/g, "").length;
}

// 段落切分（排除图片行）
function paragraphs(body) {
  return body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p && !/^!\[/.test(p));
}

// 取结尾末句（与维度池的判定口径一致）
function endingSentence(body) {
  const ps = paragraphs(body).filter((p) => !/^[#>|]/.test(p));
  const last = (ps[ps.length - 1] || "").replace(/\*\*/g, "").trim();
  const sents = last.split(/(?<=[。！？])/).filter((s) => s.trim());
  return (sents.slice(-2).join("") || last).slice(-60);
}

// 取开头首段
function openingText(body) {
  const ps = paragraphs(body);
  return (ps[0] || "").replace(/\*\*/g, "").trim();
}

// 各骨架的结构判据：抽中骨架后，成稿必须满足对应结构特征
// 这些判据是从池子的「结构要求」列提炼的可机器判定部分，不是全部（人读部分交给自查清单）
const SKELETON_CHECKS = {
  // 结尾骨架
  ending_skeleton: {
    数字定格: (s) => /\d/.test(s),
    具体动作定格: (s) => /[，,。]\s*$|$/.test(s) && /\b(了|着|过)\s*[。]?$/.test(s),
    反问留白: (s) => /[？?]\s*$/.test(s),
    疑问悬置: (s) => /[？?]\s*$/.test(s),
    留白省略: (s) => /……\s*$|\.\.\.\s*$/.test(s),
    时间推进: (s) => /(往后|下一|来年|明年|以后|再过)/.test(s),
    未完成动作: (s) => /(还在|仍在|继续|还没)/.test(s),
    并列短句: (s) => (s.match(/[，,。]/g) || []).length <= 2,
  },
};

// 结构配方判据：抽中配方后核对 ## 数与段落数
// 判据来自池子的 detail（如「##2 + 6 段」「无## + 5 段」），不是配方名
// ——配方名只有「双标题+清单」这种概括，解析不出结构数字
function checkStructure(body, structureDetail, structureName) {
  const errs = [];
  const h2 = (body.match(/^## /gm) || []).length;
  const paras = paragraphs(body).filter((p) => !/^##/.test(p)).length;
  const det = String(structureDetail || "");

  const m = det.match(/##\s*(\d+)/);
  if (m) {
    const want = Number(m[1]);
    if (h2 !== want) errs.push(`结构配方「${structureName}」要求 ${want} 个 ## 小标题（${det}），实际 ${h2} 个`);
  } else if (/无##/.test(det)) {
    if (h2 > 0) errs.push(`结构配方「${structureName}」要求无 ## 小标题，实际 ${h2} 个`);
  }

  const pm = det.match(/(\d+)\s*段/);
  if (pm) {
    const want = Number(pm[1]);
    // 段落数允许 ±1（图片、列表块会让计数有出入）
    if (Math.abs(paras - want) > 1) errs.push(`结构配方「${structureName}」要求约 ${want} 段（${det}），实际 ${paras} 段`);
  }
  return errs;
}

// 主入口：返回 { ok, errors, warns, stats }
export function verifyArticle(article, picked = null) {
  const errors = [];
  const warns = [];
  const body = article.body_markdown || "";
  const dims = picked?.dims || article.dims || {};

  if (!body) {
    return { ok: false, errors: ["缺少 body_markdown"], warns, stats: {} };
  }

  // ── 通用硬约束 ──
  const chars = charCount(body);
  if (chars < LENGTH.min_chars) errors.push(`正文 ${chars} 字 < ${LENGTH.min_chars}，须扩写`);
  if (chars > LENGTH.max_chars) warns.push(`正文 ${chars} 字 > ${LENGTH.max_chars}，建议精简`);

  // 可查证事实：含数字的段落数作为代理指标
  const factParas = paragraphs(body).filter((p) => (p.match(/\d/g) || []).length >= 2).length;
  if (factParas < FACTS.min_verifiable)
    errors.push(`可查证事实不足：仅 ${factParas} 段含具体数字，要求 ≥${FACTS.min_verifiable} 条`);

  // 非纯文字展现形式
  const hasTable = /\|.*\|.*\|/.test(body);
  const hasList = /^[-*\d]+\.?\s+/m.test(body);
  const hasCallout = /:::(info|tip|warning|danger|stat|quote|time)/.test(body);
  if (!hasTable && !hasList && !hasCallout) errors.push("缺少任何非纯文字展现形式（表格/列表/提示框）");

  // ── 维度符合性：抽了什么就得是什么 ──
  if (dims.ending_skeleton) {
    const name = stripNo(dims.ending_skeleton);
    const check = SKELETON_CHECKS.ending_skeleton[name];
    if (check) {
      const last = endingSentence(body);
      if (!check(last)) errors.push(`结尾不符合抽中的骨架「${name}」：…${last.slice(-30)}`);
    }
  }

  if (dims.structure) {
    // 结构判据在 details.structure.detail（如「##2 + 6 段」），名称本身解析不出数字
    const det = picked?.details?.structure?.detail || "";
    errors.push(...checkStructure(body, det, stripNo(dims.structure)));
  }

  // 格式组合：抽中的元素至少要出现一半
  if (dims.format) {
    const want = String(dims.format).split("/").map(stripNo);
    const present = want.filter((n) => {
      const map = {
        二级标题: /^## /m, 三级标题: /^### /m, 加粗: /\*\*[^*]+\*\*/, 斜体: /\*[^*]+\*/,
        高亮: /==[^=]+==/, 引用块: /^> /m, 提示info: /:::info/, 提示tip: /:::tip/,
        提示warning: /:::warning/, 提示danger: /:::danger/, 数据卡: /:::stat/,
        有序列表: /^\d+\. /m, 无序列表: /^- /m, 表格: /\|.*\|.*\|/, 分隔线: /^---$/m,
        图片: /!\[[^\]]*\]\([^)]+\)/, 删除线: /~~[^~]+~~/,
      };
      return map[n] ? map[n].test(body) : true;
    });
    if (present.length < Math.ceil(want.length / 2))
      errors.push(`格式组合符合度不足：抽中 ${want.length} 种，实际出现 ${present.length} 种（${present.join("/") || "无"}）`);
  }

  // 标题情绪尾兜底（selfcheck 也会查，这里早发现）
  if (/[，,][^，,。！？]{0,12}(了|着)$/.test(article.title || ""))
    warns.push(`标题疑似「我X了」情绪尾：${article.title}`);

  return {
    ok: errors.length === 0,
    errors,
    warns,
    stats: {
      chars,
      paragraphs: paragraphs(body).length,
      h2: (body.match(/^## /gm) || []).length,
      fact_paragraphs: factParas,
      ending: endingSentence(body).slice(-30),
      opening: openingText(body).slice(0, 30),
      dims,
    },
  };
}
