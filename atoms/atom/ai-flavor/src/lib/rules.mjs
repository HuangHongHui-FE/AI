// AI 味规则集：每条规则给出 0-1 强度 + 命中证据
// 设计原则：只做「像不像人写的」的软指标（可调阈值），平台红线交给 selfcheck
// 权重后续用朱雀实测反馈校准（--feedback 记录 → --calibrate 出建议）

// 句子切分（保留标点）
export function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 段落切分（去掉 markdown 标题行与图片行）
export function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !/^#{1,6}\s/.test(p) && !/^!\[/.test(p));
}

// 中文计字（与 selfcheck 同口径）
export function charCount(s) {
  return String(s || "")
    .replace(/[#>*_\-`>!\[\]()|]/g, "")
    .replace(/\s/g, "").length;
}

// 每千字命中数 → 0-1 强度（默认 10 次/千字达满分）
function density(hits, chars, full = 10) {
  if (!chars) return 0;
  return Math.min(1, (hits / chars) * 1000 / full);
}

// 规则表：id / 说明 / 权重 / detect(text) → { strength, hits[] }
export const RULES = [
  {
    id: "connector",
    label: "过渡连接词过密",
    weight: 1,
    detect(text) {
      const re = /首先|其次|再次|此外|然而|因此|综上|除此之外|与此同时|更重要的是|值得一提的是|不难看出|由此可见|总的来说|总而言之|换句话说|简而言之/g;
      const hits = [...String(text).matchAll(re)].map((m) => m[0]);
      return { strength: density(hits.length, charCount(text)), hits };
    },
  },
  {
    id: "abstract",
    label: "抽象名词堆叠",
    weight: 1.2,
    detect(text) {
      const re = /维度|底层逻辑|认知|赋能|闭环|抓手|范式|内核|链路|方法论|生态位|顶层设计|底层|本质上是/g;
      const hits = [...String(text).matchAll(re)].map((m) => m[0]);
      return { strength: density(hits.length, charCount(text), 6), hits };
    },
  },
  {
    id: "empty-emotion",
    label: "空泛情绪套话",
    weight: 1.2,
    detect(text) {
      const re = /令人震惊|不禁感叹|深深触动|引人深思|发人深省|令人唏嘘|值得深思|震撼人心|让人不禁|使人不由/g;
      const hits = [...String(text).matchAll(re)].map((m) => m[0]);
      return { strength: Math.min(1, hits.length / 2), hits };
    },
  },
  {
    id: "template-sentence",
    label: "万能句式",
    weight: 1.5,
    detect(text) {
      const re = /不是[^，。！？]{1,14}而是|真正的[^，。！？]{1,12}是|这才是[^，。！？]{1,12}|说到底|归根结底|与其说[^，。]{1,20}不如说/g;
      const hits = [...String(text).matchAll(re)].map((m) => m[0]);
      return { strength: Math.min(1, hits.length / 2), hits };
    },
  },
  {
    id: "uniform-length",
    label: "句长过于均匀",
    weight: 1.3,
    detect(text) {
      const lens = splitSentences(text).map((s) => charCount(s)).filter((n) => n > 0);
      if (lens.length < 10) return { strength: 0, hits: [] };
      const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
      const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
      const cv = mean ? sd / mean : 1; // 变异系数，人写通常 > 0.5
      const strength = cv >= 0.5 ? 0 : (0.5 - cv) / 0.5;
      return { strength, hits: [`句长变异系数 ${cv.toFixed(2)}（<0.5 偏均匀）`] };
    },
  },
  {
    id: "short-lead",
    label: "段首短句模板",
    weight: 1,
    detect(text) {
      const paras = splitParagraphs(text);
      if (paras.length < 4) return { strength: 0, hits: [] };
      // 段首到第一个句号 ≤8 字 = 模板化短句开场
      const short = paras.filter((p) => {
        const first = splitSentences(p)[0] || "";
        return charCount(first) <= 8;
      });
      const ratio = short.length / paras.length;
      return { strength: ratio > 0.4 ? Math.min(1, (ratio - 0.4) / 0.6) : 0, hits: [`${short.length}/${paras.length} 段以 ≤8 字短句开场`] };
    },
  },
  {
    id: "low-info",
    label: "具体信息密度低",
    weight: 1.5,
    detect(text) {
      const t = String(text || "");
      const chars = charCount(t);
      if (!chars) return { strength: 0, hits: [] };
      // 数字 / 引号原话 / 书名号 / 英文专名 / 日期
      const facts = (t.match(/\d+|「[^」]{4,}」|《[^》]+》|[A-Za-z]{2,}|\d{1,2}月\d{1,2}日/g) || []).length;
      const per1k = (facts / chars) * 1000;
      const strength = per1k >= 6 ? 0 : (6 - per1k) / 6;
      return { strength, hits: [`每千字具体信息 ${per1k.toFixed(1)} 处（<6 偏空）`] };
    },
  },
  {
    id: "parallel",
    label: "排比三连",
    weight: 1,
    detect(text) {
      const sents = splitSentences(text);
      const hits = [];
      for (let i = 0; i + 2 < sents.length; i++) {
        const heads = [sents[i], sents[i + 1], sents[i + 2]].map((s) => String(s).slice(0, 2));
        if (heads[0] === heads[1] && heads[1] === heads[2] && heads[0].length === 2) hits.push(heads[0]);
      }
      return { strength: Math.min(1, hits.length / 2), hits };
    },
  },
  {
    id: "no-scene",
    label: "通篇无具体场景",
    weight: 1.2,
    detect(text) {
      const t = String(text || "");
      // 太短的文本谈不上「通篇无场景」，避免空文/标题被误判
      if (charCount(t) < 50) return { strength: 0, hits: [] };
      // 人名/地名/机构/时间的粗代理：无任何数字且无引号原话
      const hasScene = /\d/.test(t) || /「[^」]{4,}」/.test(t) || /[A-Za-z]{2,}/.test(t);
      return { strength: hasScene ? 0 : 1, hits: hasScene ? [] : ["全文无数字、无引号原话、无英文专名"] };
    },
  },
];

// 综合打分：加权平均映射到 0-100，并给出分级
export function scoreText(text) {
  const results = [];
  let weighted = 0;
  let totalWeight = 0;
  for (const r of RULES) {
    const { strength, hits } = r.detect(text);
    weighted += r.weight * strength;
    totalWeight += r.weight;
    if (strength > 0.05) {
      results.push({ id: r.id, label: r.label, strength: Number(strength.toFixed(2)), weight: r.weight, hits: hits.slice(0, 5) });
    }
  }
  const score = Math.round((weighted / totalWeight) * 100);
  // 阈值按 683 篇历史稿实测分布定：真实稿 98% 落在 30 以下，AI 原文约 50+
  const level = score >= 45 ? "high" : score >= 25 ? "medium" : "low";
  // 按「强度×权重」排，最该改的排前面
  results.sort((a, b) => b.strength * b.weight - a.strength * a.weight);
  return { score, level, hits: results, stats: { chars: charCount(text), sentences: splitSentences(text).length } };
}
