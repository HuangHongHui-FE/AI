/**
 * 事件事实卡（facts/<slug>.json）的结构定义与校验。
 *
 * 设计原则：先有事实，后有文章。
 *   - 每个时间节点必须自带来源，无来源的节点不许进发布流程
 *   - 时间必须写成可校验的 ISO 形式（YYYY-MM-DD 或 YYYY-MM-DDTHH:mm）
 *   - 存疑的内容强制标 confidence="low" + note，范文里必须体现不确定性
 *   - 文章正文由本文件渲染生成，不手写——避免正文与事实卡脱节
 *
 * 渲染采用确定性方式（非 LLM 再生成），进一步保证发布内容 = 已核查内容。
 */

import { markdownToHtml } from './html.js';

// 日期精度分三档，都允许：
//   YYYY-MM              仅查到月份（如 2019-09）——不许用 -01 假装精确到日
//   YYYY-MM-DD           精确到日
//   YYYY-MM-DDTHH:mm     精确到分钟
const DATE_RE = /^\d{4}-\d{2}(-\d{2}(T\d{2}:\d{2})?)?$/;

// 把不同精度的日期归一成可比较的 key：缺的部分补 00，使「2019-09」排在「2019-09-30」之前
function dateKey(d) {
  const [ymd, hm] = String(d).split('T');
  const parts = ymd.split('-');
  while (parts.length < 3) parts.push('00');
  return `${parts.join('-')}${hm ? `T${hm}` : ''}`;
}

// 模糊时间词：出现在 date 字段里说明日期没查实，硬拦
const VAGUE_WORDS = [
  '近日',
  '日前',
  '最近',
  '近期',
  '前不久',
  '不久前',
  '某日',
  '某天',
  '月初',
  '月末',
  '上旬',
  '中旬',
  '下旬',
  '年底',
  '年初',
  '年中',
];

const LEVELS = ['normal', 'major', 'turning', 'climax'];

// 校验单个时间节点，返回错误信息数组（空数组 = 通过）
export function validateNode(node, index, today) {
  const errs = [];
  const tag = `节点[${index}]${node.date ? ` ${node.date}` : ''}`;

  if (!node.date) errs.push(`${tag}：缺少 date`);
  else if (!DATE_RE.test(node.date)) {
    if (VAGUE_WORDS.some((w) => node.date.includes(w)))
      errs.push(`${tag}：date 是模糊时间词「${node.date}」——必须查实到具体日期`);
    else errs.push(`${tag}：date 格式须为 YYYY-MM / YYYY-MM-DD / YYYY-MM-DDTHH:mm，实际「${node.date}」`);
  } else if (today && dateKey(node.date).slice(0, 10) > today) {
    errs.push(`${tag}：date 晚于今天（${today}）——事件尚未发生或日期填错`);
  }

  if (!node.title) errs.push(`${tag}：缺少 title`);

  // 来源是硬要求：每个节点至少一条可追溯来源
  if (!Array.isArray(node.sources) || node.sources.length === 0) {
    errs.push(`${tag}：必须有至少一条 sources（无来源的节点不许发布）`);
  } else {
    node.sources.forEach((s, si) => {
      if (!s || !s.title) errs.push(`${tag}：sources[${si}] 缺少 title`);
      if (!s || !s.url) errs.push(`${tag}：sources[${si}] 缺少 url`);
      else if (!/^https?:\/\//.test(s.url))
        errs.push(`${tag}：sources[${si}].url 不是 http(s) 链接：「${s.url}」`);
    });
  }

  if (node.level && !LEVELS.includes(node.level))
    errs.push(`${tag}：level 只能是 ${LEVELS.join('/')}，实际「${node.level}」`);

  if (node.quote) {
    if (!node.quote.text) errs.push(`${tag}：quote 缺少 text`);
    if (!node.quote.speaker) errs.push(`${tag}：quote 缺少 speaker（引语必须注明谁说的）`);
  }

  // 存疑节点必须写明存疑点，不允许悄悄降低把握
  if (node.confidence === 'low' && !node.note)
    errs.push(`${tag}：confidence=low 时必须写 note 说明分歧或不确定之处`);

  return errs;
}

// 校验整张事实卡
export function validateEvent(ev, today) {
  const errs = [];
  if (!ev) return ['事实卡为空'];
  for (const f of ['slug', 'name', 'summary']) {
    if (!ev[f]) errs.push(`顶层缺少字段 ${f}`);
  }
  if (!Array.isArray(ev.nodes) || ev.nodes.length === 0) {
    errs.push('顶层缺少 nodes 或 nodes 为空');
    return errs;
  }

  ev.nodes.forEach((n, i) => errs.push(...validateNode(n, i, today)));

  // 时间线必须单调不减，否则叙事顺序错乱。
  // 只比较格式合法的日期——非法日期（如「近日」）已单独报错，混进来会连累本项误报
  // 用 dateKey 归一（月份精度补 00），使「2019-09」正确排在「2019-09-30」之前
  for (let i = 1; i < ev.nodes.length; i++) {
    const ra = ev.nodes[i - 1].date;
    const rb = ev.nodes[i].date;
    if (!DATE_RE.test(ra || '') || !DATE_RE.test(rb || '')) continue;
    const a = dateKey(ra);
    const b = dateKey(rb);
    if (b < a) errs.push(`时间线乱序：节点[${i}]（${rb}）早于节点[${i - 1}]（${ra}）`);
  }

  return errs;
}

// 事件当前是否仍在发展中（ended 为空 = 梳理到最新时间点）
export function isOngoing(ev) {
  return !ev.ended;
}

/**
 * 按事实卡的 parts 定义切分时间线。
 * parts: [{ title, until }] —— 每篇的专属标题 + 本篇最后一个节点日期（含）。
 * 这样断点落在叙事边界上，而不是按节点数机械均分。
 * 没定义 parts 时退回均分。
 */
export function splitByParts(nodes, ev) {
  const parts = ev.parts;
  if (!Array.isArray(parts) || !parts.length) return null;

  const chunks = [];
  let cur = [];
  let pi = 0;
  for (const n of nodes) {
    cur.push(n);
    // 当前节点日期达到本篇边界（含）就切一篇
    const until = parts[pi]?.until;
    if (until && dateKey(n.date) >= dateKey(until)) {
      chunks.push({ nodes: cur, title: parts[pi].title, digest: parts[pi].digest, summary: parts[pi].summary, closing: parts[pi].closing });
      cur = [];
      pi++;
      if (pi >= parts.length) break;
    }
  }
  // 剩余节点并入最后一篇
  if (cur.length) {
    if (chunks.length) chunks[chunks.length - 1].nodes.push(...cur);
    else chunks.push({ nodes: cur, title: parts[0]?.title || '', digest: parts[0]?.digest, summary: parts[0]?.summary, closing: parts[0]?.closing });
  }
  return chunks;
}

// 单条来源渲染成一行文字
function sourceLine(s) {
  const bits = [s.publisher, s.title].filter(Boolean).join('｜');
  return `[${bits}](${s.url})`;
}

// 节点渲染成 markdown（时间线主体）。细节密度靠这里堆：事实/细节/引语/数据分列
//
// 注意两件事（都是 2026-09-30 实踩）：
//  1. html.js 的扩展语法正则都是「非贪婪到最近一个 :::」，各块之间【不能嵌套】
//  2. 扩展语法在 marked.parse() 之前处理，替换出的 HTML 会原样透传——
//     所以 :::time 块【内部不能放图片】，markdown 图片语法不会被解析成 <img>。
//     图片一律放块外（node.images 字段），按节点位置插在 time 块之前
// 把节点的 detail/facts 先渲染成 HTML，再塞进 :::time。
//
// 为什么必须预渲染（2026-09-30 实踩，三个 bug 同一个根因）：
// html.js 的 ::: 扩展语法在 marked.parse() 之前就替换成 HTML，块内的 markdown 解析不可靠——
//   · `**加粗**` 原样输出（星号裸露在正文里）
//   · `- 列表项` 被 marked 的 HTML 块规则挤出 div，列表前多出空行
// 预渲染成 HTML 后块内不再有 markdown 语法，两个问题同时消失。
// 压成单行是必需的：marked 的 HTML 块遇空行会断开，换行会让 :::time 的 div 被拆散。
function renderInner(node, theme) {
  const md = [];
  if (node.detail) md.push(node.detail);
  if (Array.isArray(node.facts) && node.facts.length) {
    md.push('');
    for (const f of node.facts) md.push(`- ${f}`);
  }
  if (!md.length) return '';
  const html = markdownToHtml(md.join('\n'), theme).replace(/\n+/g, '');
  // 最后一个段落去掉 20px 下边距——卡片本身已有 padding，再留一段空白会显得虚
  return html.replace(/([\s\S]*)margin:0 0 20px/, '$1margin:0');
}

// 节点渲染。时间线主体由「日期 + 标题 + 叙述 + 细节清单」构成
export function renderNode(node, theme = 'cool') {
  const out = [];

  // 图片放在 :::time 块之前（块内不解析 markdown）
  if (Array.isArray(node.images) && node.images.length) {
    for (const img of node.images) out.push(`![${img.alt || ''}](${img.src})`);
  }

  // 日期只显示到月（用户 2026-09-30 定）。
  // 精确到日的日期不展示日，统一成 YYYY-MM——事实卡里仍存完整精度，
  // 供核查与排序用，只是不呈现给读者
  const dateText = node.date.slice(0, 7);
  // 加粗用 <strong> 而非 markdown 的 ** —— 块内不解析 markdown，星号会原样显示。
  // 标题后接 <br> 独立成行，否则会与胶囊后面的正文挤在同一行
  const title =
    node.level === 'turning' ? `<strong>${node.title}</strong><br>` : `${node.title}<br>`;

  const inner = renderInner(node, theme);
  out.push(`:::time ${dateText} ${title}${inner ? ` ${inner}` : ''} :::`);

  // 以下块各自单行闭合，互不嵌套
  if (Array.isArray(node.data) && node.data.length) {
    for (const d of node.data) out.push(`:::stat ${d.value} ${d.label} :::`);
  }

  if (node.quote) out.push(`:::quote ${node.quote.text} | ${node.quote.speaker} :::`);

  // confidence:"low" 的 note 不渲染进正文（用户 2026-09-30 定）。
  // 那是【内部工作批注】——记录这条为何存疑、口径分歧在哪，给作者自己看的。
  // 正文里冒出一句「此处说法存在分歧……」等于把备忘录印在报纸上。
  // 存疑改为：写 detail 时就把措辞写准（用「他称」「据其表述」），而不是先写死再打免责声明。
  // note 仍留在事实卡里供核查，preflight 照旧强制 confidence:"low" 必须有 note。
  return out.join('\n');
}

// 渲染整条时间线。节点之间必须空行——否则图片/块会紧贴上一个 HTML 块被当成延续而不解析
export function renderTimeline(nodes, theme) {
  return nodes.map((n) => renderNode(n, theme)).join('\n\n');
}

// 按节点数把时间线切成 N 篇，返回每篇的节点数组
export function splitPhases(nodes, parts) {
  if (parts <= 1) return [nodes];
  const size = Math.ceil(nodes.length / parts);
  const chunks = [];
  for (let i = 0; i < nodes.length; i += size) chunks.push(nodes.slice(i, i + size));
  return chunks;
}

export const PART_LABELS = ['上', '中', '下'];

// 分篇标题后缀。2 篇是「上/下」（不是上/中），3 篇才是「上/中/下」，超过 3 篇退回「第N篇」
export function partSuffix(idx, total) {
  if (total <= 1) return '';
  if (total === 2) return `（${idx === 0 ? '上' : '下'}）`;
  if (total === 3) return `（${PART_LABELS[idx]}）`;
  return `（第${idx + 1}篇）`;
}

// 生成某篇的完整标题：序号统一前置「【上】标题」/「【中】标题」/「【下】标题」
//
// 2026-09-30 定：分篇序号一律放最前面，形式统一，三篇一眼能排上序。
// 自定义标题里若已写了篇序字样（「（上）」「第2篇」），去掉后再统一加前缀，避免出现两次。
export function buildPartTitle(ev, customTitle, idx, total) {
  const label = PART_LABELS[idx] || `第${idx + 1}篇`;
  const base = customTitle || `${ev.name}全过程梳理`;
  if (total <= 1) return base;
  // 剥掉标题里自带的篇序（含「蔡磊确诊渐冻症（上）：...」这类中段写法），避免重复
  const cleaned = base
    .replace(/[（(【\[]\s*(上|中|下)\s*[）)】\]]/g, "")
    .replace(/^第\s*\d+\s*篇[：:]\s*/, "")
    .replace(/[（(【\[]\s*第\s*\d+\s*篇\s*[）)】\]]/g, "")
    .replace(/^[：:]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return `【${label}】${cleaned}`;
}
