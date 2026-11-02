// 图片过滤规则：素材站黑名单、标题模板图、头像logo、素材类标题
// 这几条是从 wechat/tools/fetch_cand.cjs 迁来的（生活场景词踩坑后的沉淀），全渠道通用

// 素材站/设计站域名：出的是带水印样图，不可用于文章配图
const STOCK_DOMAIN_RE =
  /699pic|nipic|nximg|pngsucai|588ku|huaban|zhitu|tukuppt|lovepik|pngtree|zcool|qiantucdn|ibaotu|redocn|ishare|sd\.xmu|photophoto|veer\.com|gettyimages|shutterstock|dreamstime|istockphoto|adobe|pixnet/i;

// 素材/设计图库类标题：分层素材或模板图，不是真实照片
const STOCK_TITLE_RE = /素材|设计图库|图库|PSD|分层|矢量|模板|壁纸|png图片|透明背景|免抠/i;

// 头像/站点图标/签名图：任何渠道都应剔除
// 关键：sign\.toutiaoimg\.com 必须锚定主机名开头（//sign.），否则会误杀 p11-sign.toutiaoimg.com
// 头条图床的 p11-sign/p3-sign 是可下载的正常图床（2026-10-29 实测），只有 //sign. 开头的才要签名 403
const JUNK_URL_RE =
  /avatar|qb-profile|qb-logo|\/logo|qrcode|xiaochengxu|:\/\/sign\.toutiaoimg\.com|\/w\/32\/|\/h\/32\/|\/w\/(?:40|48|64)\//i;

// 判断候选是否应丢弃；返回丢弃原因，保留则返回 null
export function rejectReason(url, title = "") {
  if (!url || !/^https?:\/\//i.test(url)) return "非法URL";
  if (JUNK_URL_RE.test(url)) return "头像/logo/图标";
  if (STOCK_DOMAIN_RE.test(url)) return "素材站样图";
  if (STOCK_TITLE_RE.test(title)) return "素材/模板类标题";
  if (/\.gif$/i.test(url)) return "GIF不支持";
  return null;
}

// URL 时间戳新鲜度：返回距今月数；近 30 天内为 0，更旧为正数，无法判断为 null
// 用于「保新」——热点配图必须是最新的，不能拿几年前的图
export function urlAgeMonths(u, now = new Date()) {
  const m =
    u.match(/\/(20\d{2})(\d{2})(\d{2})\//) || // /20180527/
    u.match(/\/(20\d{2})\/(\d{2})\//) ||
    u.match(/\/(20\d{2})\/(\d{2})\.[a-z]+\??/) ||
    u.match(/(20\d{2})-(\d{2})/) ||
    u.match(/sinakd(20\d{2})(\d{2})/) ||
    u.match(/(20\d{2})_(\d{2})/) ||
    u.match(/\/(20\d{2})(\d{2})\//); // /202602/
  if (!m) {
    // 兜底：URL 里只有年份（如 ifeng 的 /2024_44/ 周数），跨年即判旧
    const yOnly = u.match(/\/(20\d{2})[_/]/);
    if (yOnly && now.getFullYear() - +yOnly[1] >= 1) return 12;
    return null;
  }
  const y = +m[1];
  const mo = +m[2];
  if (mo < 1 || mo > 12) return (now.getFullYear() - y) * 12; // 月份非法（如周数）按年估算
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
}

// 图片内容指纹：头条图床同一张图有多个尺寸变体（450:294 / 960:720…），
// 路径中的哈希段相同即同一张图，只保留一张（挑下载时体积最大的那张由下载顺序决定）
export function imageFingerprint(url) {
  try {
    const u = new URL(url);
    // 头条/字节图床：/tos-cn-xxx/<32位hash>~tplv-...
    const m = u.pathname.match(/\/([a-f0-9]{20,})~/);
    if (m) return `${u.hostname.split("-")[0]}:${m[1]}`;
    // 其他图床：主机+路径（去掉查询参数，避免签名参数不同被判为不同图）
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

// 实体关键词拆分：把「IG战胜TT」拆成 [IG, TT]，「西藏泥石流」拆成 [西藏, 泥石流]
// 去掉常见动词/介词，避免把这些词当实体去比对
const STOP_WORDS =
  /战胜|击败|击败了|迎战|对决|超越|拿下|晋级|失联|遇难|救援|事故|事件|曝光|回应|最新|进行|相关|部署|调查|通报|官方|突发/g;

export function splitEntities(subject) {
  const parts = String(subject)
    .replace(STOP_WORDS, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 1);
  // 拆完为空（整个主体都是停用词）时回落原词，否则空数组会让「相关性判断」退化成全部通过
  return parts.length ? parts : [String(subject).trim()].filter(Boolean);
}

// 主体词降级：整串「洛阳卤蛋店」在图库里没有对应图时，逐级放宽到可搜到图的核心词
// 规则：
//   1. 先按中文地点前缀剥离（洛阳/北京/上海…），得到「卤蛋店」
//   2. 再剥「店/馆/铺/公司/集团」等机构后缀，得到「卤蛋」
//   3. 最短保留 2 字，再短就失去辨识度
// 返回从严格到宽松的关键词组，供「零结果时逐级重试」
const PLACE_PREFIX = /^(北京|上海|广州|深圳|天津|重庆|杭州|南京|武汉|成都|西安|苏州|长沙|郑州|青岛|沈阳|大连|厦门|福州|济南|合肥|昆明|哈尔滨|长春|石家庄|太原|南昌|贵阳|南宁|兰州|西宁|银川|乌鲁木齐|呼和浩特|拉萨|海口|三亚|洛阳|开封|安阳|南阳|信阳|新乡|许昌|平顶山|焦作|商丘|周口|驻马店|漯河|三门峡|鹤壁|濮阳|驻马店)/;
const ORG_SUFFIX = /(店|馆|铺|厂|公司|集团|企业|品牌|工作室|中心|基地|园区|市场|摊位|小摊|摊)/g;

export function downgradeSubjects(subject) {
  const levels = [];
  const raw = String(subject).trim();
  if (!raw) return levels;
  levels.push(raw);

  // 第一级：剥地点前缀
  let level1 = raw.replace(PLACE_PREFIX, "").trim();
  if (level1 && level1 !== raw && level1.length >= 2) {
    levels.push(level1);
    // 第二级：再剥机构后缀
    const level2 = level1.replace(ORG_SUFFIX, "").trim();
    if (level2 && level2 !== level1 && level2.length >= 2) levels.push(level2);
  } else {
    // 无地点前缀时，直接尝试剥后缀
    const level2 = raw.replace(ORG_SUFFIX, "").trim();
    if (level2 && level2 !== raw && level2.length >= 2) levels.push(level2);
  }

  return [...new Set(levels)];
}

// 相关性判断：多实体须全含（对阵双方都在才是这场比赛），单实体含任一即可
// 单实体须全含的原因是防「TT 车队」「铁三车」这类单字母/短词误伤
export function isRelevant(title, url, keywords) {
  if (!keywords || !keywords.length) return true;
  const hay = `${title || ""} ${safeDecode(url || "")}`;
  const hits = keywords.filter((k) => k && hay.includes(k));
  if (keywords.length >= 2) return hits.length === keywords.length;
  return hits.length >= 1;
}

// 解码 URL（失败时原样返回，避免畸形百分号导致抛错）
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
