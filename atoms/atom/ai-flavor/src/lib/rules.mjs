// AI 味规则集：每条规则给出 0-1 强度 + 命中证据 + 改写指令
// 设计原则：只做「像不像人写的」的软指标（可调阈值），平台红线交给 selfcheck
// 权重后续用朱雀实测反馈校准（--feedback 记录 → --calibrate 出建议）
// 规则来源：朱雀/知网实测经验 + 开源 humanizer（参考见 SKILL.md 末尾）

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

// 连接词表：单个规则内复用，避免 g 标志的 lastIndex 副作用
const CONNECTOR_WORDS =
  "首先|其次|再次|此外|然而|因此|从而|进而|由此|所以|综上|除此之外|与此同时|更重要的是|值得一提的是|不难看出|由此可见|总的来说|总而言之|换句话说|简而言之";
const CONNECTOR_RE = new RegExp(CONNECTOR_WORDS, "g");
const CONNECTOR_TEST = new RegExp(CONNECTOR_WORDS);

// 规则表：id / 说明 / 权重 / 改法 / detect(text) → { strength, hits[] }
export const RULES = [
  {
    id: "connector",
    label: "过渡连接词过密",
    weight: 1,
    advice: "删掉大半连接词，靠语序和事实衔接；连续两句都带连接词的，至少删一个",
    detect(text) {
      const t = String(text);
      const hits = [...t.matchAll(CONNECTOR_RE)].map((m) => m[0]);
      const sents = splitSentences(t);
      // 连续两句都带连接词 = 朱雀高发的「链条感」
      let chain = 0;
      for (let i = 1; i < sents.length; i++) {
        if (CONNECTOR_TEST.test(sents[i]) && CONNECTOR_TEST.test(sents[i - 1])) chain++;
      }
      const strength = Math.min(1, density(hits.length, charCount(t)) + chain * 0.15);
      return { strength, hits: chain ? [...hits, `${chain} 处连续两句带连接词`] : hits };
    },
  },
  {
    id: "abstract",
    label: "抽象名词堆叠",
    weight: 1.2,
    advice: "把「底层逻辑/认知/闭环/抓手」换成具体动作和对象，说清谁在什么时间做了什么",
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
    advice: "删掉「令人震惊/引人深思」，换成一个具体画面或一句当事人的原话",
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
    advice: "「不是X而是Y」「真正的X是Y」「说到底」这类对仗句只留一处，其余改平常话",
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
    advice: "每 150 字至少放一个 6 字以内的短句；长句只留给真需要一口气说完的地方",
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
    advice: "别每段都用三五个字起头；直接进事实、场景或人物的动作",
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
    advice: "每段补一个能核实的细节：数字、日期、地名、人名、原话、型号",
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
    advice: "连续三句同开头的，拆掉两句，改成不同主语或不同长度",
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
    advice: "开篇落到一个具体时间、地点、人物动作上，别从概念讲起",
    detect(text) {
      const t = String(text || "");
      // 太短的文本谈不上「通篇无场景」，避免空文/标题被误判
      if (charCount(t) < 50) return { strength: 0, hits: [] };
      // 人名/地名/机构/时间的粗代理：无任何数字且无引号原话
      const hasScene = /\d/.test(t) || /「[^」]{4,}」/.test(t) || /[A-Za-z]{2,}/.test(t);
      return { strength: hasScene ? 0 : 1, hits: hasScene ? [] : ["全文无数字、无引号原话、无英文专名"] };
    },
  },
  {
    id: "hedge",
    label: "模糊限定词过多",
    weight: 1.3,
    advice: "删掉「较为/一定程度上/某种程度上/往往」这类软限定，直接下判断；真不确定就写出条件",
    detect(text) {
      const re = /较为|一定程度上|某种程度上|从某种意义上|相对而言|总体来说|总体来看|一般而言|通常来说|往往|或多或少/g;
      const hits = [...String(text).matchAll(re)].map((m) => m[0]);
      return { strength: density(hits.length, charCount(text), 8), hits };
    },
  },
  {
    id: "punct",
    label: "分号过密",
    weight: 0.8,
    advice: "把分号改成句号，一句话只说一件事",
    detect(text) {
      const t = String(text);
      const hits = [...t.matchAll(/；/g)].map((m) => m[0]);
      // 中文稿里「——」是常见习惯，不算 AI 特征；分号 ≥3 才计，避免误伤
      return { strength: hits.length >= 3 ? density(hits.length, charCount(t), 6) : 0, hits };
    },
  },
  {
    id: "enumeration",
    label: "分点/列表化叙事",
    weight: 1.1,
    advice: "把「第一/第二/几个方面」改成连贯叙述；真要列举，用具体事实代替编号",
    detect(text) {
      const t = String(text);
      const re = /第一[，、,]|第二[，、,]|第三[，、,]|一方面[^。]{0,40}另一方面|首先[^。]{0,50}其次|几个方面|三个层面|两个维度|以下几点/g;
      const hits = [...t.matchAll(re)].map((m) => m[0]);
      const listLines = t.split("\n").filter((l) => /^\s*\d+[.、)]\s/.test(l)).length;
      const n = hits.length + Math.max(0, listLines - 2);
      return { strength: Math.min(1, n / 3), hits: [...hits, ...(listLines > 2 ? [`${listLines} 行编号列表`] : [])] };
    },
  },
  {
    id: "safe-ending",
    label: "结尾总结/展望套话",
    weight: 1.2,
    advice: "结尾别总结、别展望，落在一个具体画面或一句具体判断上",
    detect(text) {
      const paras = splitParagraphs(text);
      if (paras.length < 2) return { strength: 0, hits: [] };
      const tail = paras.slice(-2).join("\n");
      const re = /综上所述|总而言之|总的来说|总之|未来可期|拭目以待|最后我想说|希望[^。]{0,10}(能|可以)/g;
      const hits = [...tail.matchAll(re)].map((m) => m[0]);
      return { strength: Math.min(1, hits.length / 2), hits };
    },
  },
];

// 分级阈值（按历史稿实测分布定：683 篇真实稿最高 28 分，AI 原文约 35+）
export const LEVEL_MEDIUM = 25;
export const LEVEL_HIGH = 35;

// 综合打分：加权平均映射到 0-100，并给出分级与改写指令
export function scoreText(text) {
  const results = [];
  let weighted = 0;
  let totalWeight = 0;
  for (const r of RULES) {
    const { strength, hits } = r.detect(text);
    weighted += r.weight * strength;
    totalWeight += r.weight;
    if (strength > 0.05) {
      results.push({ id: r.id, label: r.label, strength: Number(strength.toFixed(2)), weight: r.weight, advice: r.advice, hits: hits.slice(0, 5) });
    }
  }
  const score = Math.round((weighted / totalWeight) * 100);
  const level = score >= LEVEL_HIGH ? "high" : score >= LEVEL_MEDIUM ? "medium" : "low";
  // 按「强度×权重」排，最该改的排前面
  results.sort((a, b) => b.strength * b.weight - a.strength * a.weight);
  return { score, level, hits: results, stats: { chars: charCount(text), sentences: splitSentences(text).length } };
}