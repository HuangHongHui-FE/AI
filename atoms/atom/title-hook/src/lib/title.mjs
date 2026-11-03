// 标题处理：贴热点原词 + 压缩/补全 + 硬底线校验
// 2026-08-27 起规则简化：标题直接用热榜原词，最多微调，不套骨架、不抽池子
// 理由：蹭流量的核心是「标题里就是用户正在搜的那句话」；同质化风险靠正文十维轮换去破

// 标题硬底线上限（超过这个字数微信后台也会截断）
export const MAX_CHARS = 22;

// 「我X了」情绪尾正则：2026-09-14 由 darwinian_evolver 在 656 篇历史稿上进化
// 旧版只认 8 个词，漏检「愣住了/想了想/眼眶热了/扎心了」等变体
const EMO_TAIL =
  /[，,][^，,。！？!?；;]{0,12}(?:愣|想|笑|哭|懵|慌|呆|傻|怔|酸|疼|暖|热|冷|服|乐|气|怂|麻|破防|无语|沉默|感动|激动|头疼|心累|脸红|眼红|眼眶|鼻子|心里|热血|扎心|破房|上头|下头|emo)[^，,。！？!?；;]{0,6}(?:了|着|半天)$/;

// 标题党词：曝光放行——「央视曝光」是正当新闻动词，是蹭度硬杠杆
const CLICKBAIT = /震惊|速看|刚刚|突发/;

// 计字（与 selfcheck 同口径，去标点符号）
export function charCount(s) {
  return String(s || "").replace(/[#>*_\-`>!\[\]()|]/g, "").replace(/\s/g, "").length;
}

// 单条标题校验：返回 { ok, errors, warns, chars }
export function checkTitle(title) {
  const errors = [];
  const warns = [];
  const t = String(title || "").trim();

  if (!t) return { ok: false, errors: ["标题为空"], warns, chars: 0 };

  const c = charCount(t);
  if (c > MAX_CHARS) errors.push(`标题 ${c} 字 > ${MAX_CHARS}，须压缩`);
  if (c < 6) warns.push(`标题仅 ${c} 字，太短可能缺信息点`);

  if (EMO_TAIL.test(t)) errors.push(`标题用「我X了」情绪尾收尾（被判低创的批次全此格式）：${t}`);
  if (CLICKBAIT.test(t)) errors.push(`标题党词（震惊/速看/刚刚/突发）：${t}`);

  // 标题须含一个具体信息点：人名/地名/数字/机构/动作词
  // 权威媒体主体也算（「央视曝光…」不该因为央视不在机构后缀表里就报缺辨识度）
  const AUTHORITY = /央视|新华社|人民日报|政法委|最高法|最高检|公安部|教育部|卫健委|工信部|应急管理部/;
  const hasInfo = /\d|[一-龥]{2,}(?:部|局|委|院|公司|集团|大学|医院|舰|机|车)/.test(t) || AUTHORITY.test(t);
  if (!hasInfo) warns.push("标题未见具体信息点（数字/机构/主体），可能缺辨识度");

  return { ok: errors.length === 0, errors, warns, chars: c };
}

// 压缩：原词超 22 字时，保留「权威主体 + 动作原词 + 关键数字/实体」
// 做法不是智能摘要，而是按优先级保留片段——宁可粗糙也不能超过 22 字
export function compressTitle(raw) {
  const t = String(raw || "").trim();
  if (charCount(t) <= MAX_CHARS) return { title: t, compressed: false, note: "" };

  // 去掉修饰性成分：书名号、引号内的补充说明、括号内容
  let s = t
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/《[^》]*》/g, (m) => m.slice(1, -1))
    .replace(/「[^」]*」/g, (m) => m.slice(1, -1))
    .replace(/【[^】]*】/g, "")
    .trim();

  if (charCount(s) <= MAX_CHARS) return { title: s, compressed: true, note: "去掉括注/书名号" };

  // 还超：按逗号切，优先保留前半（主体+动作通常在前）与含数字的片段
  const parts = s.split(/[，,]/).map((p) => p.trim()).filter(Boolean);
  const head = parts.slice(0, 2);
  const nums = parts.filter((p) => /\d/.test(p) && !head.includes(p));
  const joinParts = (arr) => arr.filter(Boolean).join("，");
  // 逐级退化：前半+数字 > 前半1+数字 > 前半，保证数字片段优先于后半
  const picked = [
    joinParts([...head, ...nums]),
    joinParts([head[0], ...nums]),
    joinParts(head),
  ].find((x) => charCount(x) <= MAX_CHARS);
  s = picked || parts[0] || s;

  // 仍超：硬截断到 22 字（保证不超限，宁可断句不完整）
  if (charCount(s) > MAX_CHARS) {
    let out = "";
    for (const ch of s) {
      if (charCount(out + ch) > MAX_CHARS) break;
      out += ch;
    }
    s = out;
  }

  return { title: s, compressed: true, note: "保留主体+动作+数字片段，超长硬截断" };
}

// 补全：原词太短时补一个信息点（如「运-20赴西藏救援」→「运-20赴西藏救援泥石流」）
// 只能补原词里隐含的、不能编造新的权威主体或动作
export function expandTitle(raw, { topic = "", event = "" } = {}) {
  const t = String(raw || "").trim();
  if (charCount(t) >= 12 || !event) return { title: t, expanded: false, note: "" };
  const cand = `${t}${event}`;
  if (charCount(cand) <= MAX_CHARS) return { title: cand, expanded: true, note: `补事件词「${event}」` };
  return { title: t, expanded: false, note: "补全后超字数，保持原词" };
}
