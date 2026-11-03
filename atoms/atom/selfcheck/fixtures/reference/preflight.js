import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 推草稿前硬门：grep/正则程序化判定，不靠 LLM 自觉打勾。任一 FAIL 则 exit 1 拒绝推送
// 用法：node src/preflight.js <article.json 路径>

const path = process.argv[2] ? resolve(process.argv[2]) : "article.json";
if (!existsSync(path)) {
  console.error(`✗ 找不到 article.json：${path}`);
  process.exit(2);
}
const a = JSON.parse(readFileSync(path, "utf8"));
const title = a.title || "";
const digest = a.digest || "";
const body = a.body_markdown || "";

// 字数：中文+数字+字母计，去 markdown 符号
const charCount = (s) =>
  (s || "")
    .replace(/[#>*_\-`>!\[\]()|]/g, "")
    .replace(/\s/g, "").length;

const fails = []; // FAIL：硬否决
const warns = []; // WARN：提示不阻断

const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

// === 标题 ===
// 情绪尾正则：2026-09-14 由 darwinian_evolver 在 656 篇历史稿上进化得出
// （旧正则只认 8 个词，漏检 129 篇判罚期坏稿里的「愣住了/想了想/眼眶热了/扎心了」等变体）
const TAIL_RE = /[，,][^，,。！？!?；;]{0,12}(?:愣|想|笑|哭|懵|慌|呆|傻|怔|酸|疼|暖|热|冷|服|乐|气|怂|麻|破防|无语|沉默|感动|激动|头疼|心累|脸红|眼红|眼眶|鼻子|心里|热血|扎心|破房|上头|下头|emo)[^，,。！？!?；;]{0,6}(?:了|着|半天)$/;
if (TAIL_RE.test(title))
  fail(`标题"我X了"情绪尾收尾（被判低创的批次全此格式）：${title}`);
if (charCount(title) > 22) fail(`标题 ${charCount(title)} 字 >22：${title}`);
// 曝光是正当新闻动词（如「央视曝光」是蹭度硬杠杆），不算纯煽动标题党词，故不拦
if (/(震惊|速看|刚刚|突发)/.test(title)) fail(`标题党词：${title}`);

// === 摘要 ===
if (charCount(digest) > 54) fail(`digest ${charCount(digest)} 字 >54`);
if (/[\n\r]/.test(digest)) fail("digest 含换行");
if (/https?:\/\//.test(digest)) fail("digest 含外链");

// === 正文硬门 ===
if (body.includes('"')) fail('body 含 ASCII 双引号"，须改用「」');
if (/\[[^\]]+\]\(https?:\/\//.test(body)) fail("body 含正文超链接，微信会屏蔽");
if (/据传|疑似|据说|有消息称|没法证实|有说法称|有人传/.test(body))
  fail('body 含存疑词（据传/疑似/据说等）——官方"引用存疑数据"低信息量铁证，须删或改可查证事实');

const quoteN = (body.match(/^> /gm) || []).length;
const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
const sixH = [/## 一/, /## 二/, /## 三/, /## 四/, /## 五/, /## 六/].every((r) => r.test(body));

// AI 金句句式计数（进化门与下方 FAIL 共用）
const aiHitsRaw = (s) =>
  [...s.matchAll(/的尽头[是是]/g), ...s.matchAll(/不是[^，。\n]{1,10}是[^，。\n]{1,10}/g), ...s.matchAll(/更(真|重|深)/g)].length;

// 字数
const bc = charCount(body);

// 风格启发式加权门：2026-09-14 由 darwinian_evolver 从 656 篇历史稿进化得出
// 旧「六段全套」用 引言≥3 触发，实测 434 篇坏稿里引言数最多只有 1 → 该检测从未触发过（死代码）
// 现改为加权累加，单条信号不再独立毙稿（进化发现「字数短」单独不该拦）
const STYLE = [
  ["情绪尾标题", TAIL_RE.test(title), 1.6],
  ["六段全套", sixH && quoteN >= 1 && boldN >= 1, 1.4],
  ["正文偏短", bc < 800, 0.8],
  ["正文偏长", bc > 1200, 0.9],
  ["AI金句堆砌", aiHitsRaw(body) >= 3, 1.0],
];
const styleHits = STYLE.filter(([, hit]) => hit);
const styleScore = styleHits.reduce((s, [, , w]) => s + w, 0);
if (styleScore >= 1.1)
  fail(
    `风格分 ${styleScore.toFixed(1)} ≥1.1（${styleHits.map(([n, , w]) => `${n}${w}`).join("+")}）——低创作度/同质化风险`,
  );

// 禁用词
const BAN = [
  "值得注意的是",
  "总而言之",
  "此外",
  "综上所述",
  "综上",
  "在当今社会",
  "在快节奏的",
  "不仅如此",
  "不仅而且",
  "既...又",
  "既...又...",
  "毋庸置疑",
  "众所周知",
  "由此可见",
  "应该说",
  "某种程度上",
];
for (const w of BAN) if (body.includes(w)) fail(`禁用词命中：${w}`);

// === G. 第一人称禁用（2026-09-14 新增，硬 FAIL）===
// 用户决定：完全禁用第一人称。理由——「我认识个朋友」「我觉得」是廉价个人叙事，
// 读者不关心作者的想法；且这些「熟人」本就是虚构/泛化的，拿它自证「个人经验」等于用假证据。
// 替代写法：群体观察（「这类人普遍…」）/ 客观数据事实 / 历史跨行业类比。
// 注：正文里引用的**他人原话**（「他说」「刘先生只说了一句」）不受影响，禁的是作者自我叙述。
// 剔除图片语法（alt 是引用他人/官方的原话，如「我们是冠军!!」，不该算作者第一人称）
const bodyNoImg = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
const FIRST_PERSON = [
  [/我(的)?(一个)?(朋友|认识|身边|同事|亲戚|老哥|大哥|大姐|邻居|同学|战友)/, "「我认识/我朋友…」熟人叙事"],
  [/我们家那位|我老婆|我爱人|我媳妇|我先生|我爸|我妈|我儿子|我女儿/, "家人叙事"],
  [/我(觉得|想|认为|琢磨|寻思|猜|估计)/, "「我觉得/我想」主观包装"],
  [/我(第一反应|当时|心里|一下子|愣了|看着|盯着|刷到|读到|翻|听)/, "「我」的亲历/反应叙述"],
  [/我(的)?(判断|看法|感受|体会|经验|意思|理解)是/, "「我的看法是」主观落点"],
  [/我们(这代人|那会儿|小时候|年轻时|单位|家)/, "「我们这代人」群体代入"],
  [/我(有个|认识个|见过个|身边有)/, "「我有个…」引熟人"],
];
for (const [re, msg] of FIRST_PERSON) {
  const m = bodyNoImg.match(re);
  if (m) fail(`第一人称禁用：${msg}「…${m[0]}…」——改用群体观察/客观数据/历史类比（2026-09-14 用户决定）`);
}
// 「我」字总量兜底：任一形式漏网时限制出现次数（完全禁用=0 容忍，但允许 1 处笔误给个缓冲）
const woCount = (bodyNoImg.match(/我/g) || []).length;
if (woCount > 1)
  fail(`正文出现「我」${woCount} 处（第一人称已全面禁用，最多容忍 1 处）——改用群体观察/客观数据/历史类比`);

// === A. 模板句禁飞区（2026-09-14 新增）===
// 实测 179 篇历史稿：这些句子是「逐字复用」的模板，比句式骨架更能被一眼看穿。
// 用正则匹配「骨架+变体」，不写死单一字符串——否则换个形容词就绕过了。
// 分两级（HARD=重灾区≥10篇复用 / SOFT=轻度）：用户 2026-09-14 决定「全部硬拦」，
// 接受新发文返工率上升（实测历史好稿 47.5% 会被拦）以换取最大差异化。
// 判据：区分「整句模板」（整句复用=低创作度铁证，硬拦）与「词级强调」（正常中文词汇，不拦）。
// 2026-09-14 判断修正：首版把「实打实的/我们这代人/第一反应是」也硬拦了，但查实际用法——
//   「是实打实的市场选择」「我们这代人，离家的离家」「我第一反应是去抱孩子」——都是★正常中文★，
//   拦它们等于否定正常表达。降为 WARN 提示，只在明显扎堆时提醒。
const TEMPLATES_HARD = [
  [/这条新闻[^。]{0,14}(硬事实|能查到|查得到)/, "「这是这条新闻能查到的硬事实」整句模板（27 篇 15% 逐字复用）"],
  [/我(有)?个?[^。，！？\n]{0,16}朋友[^。，！？\n]{0,4}(跟我)?讲过/, "「我有个…朋友讲过」整句模板（22 篇 12%，属廉价虚构经验）"],
  [/我说一句实在的|说句(心里话|实在话|掏心窝)/, "「我说一句实在的/说句心里话」整句套路（17 篇，本就在禁用口头禅列表）"],
  [/搁(在)?谁身上都|换(成)?谁(都|也)(难受|一样|扛不住)/, "「搁谁身上都…」整句套路"],
  [/这不就是[^。]{0,14}吗/, "「这不就是X吗」整句套路反问"],
];
const TEMPLATES_SOFT = [
  [/实打实的/, "「实打实的」用得偏多（16 篇）——正常强调词，注意别每篇都用"],
  [/我们这代人|咱们这代人/, "「我们这代人」用得偏多（15 篇）——正常人称，注意别当万能共鸣开关"],
  [/第一反应是/, "「第一反应是」用得偏多（13 篇）——正常叙述，注意换表达"],
  [/我盯着[^。，！？\n]{0,14}看(了|着)/, "「我盯着…看了」用得偏多"],
];
for (const [re, msg] of TEMPLATES_HARD) {
  const m = body.match(re);
  if (m) fail(`${msg}：…${m[0]}…`);
}
for (const [re, msg] of TEMPLATES_SOFT) {
  const m = body.match(re);
  if (m) warn(`${msg}：…${m[0]}…`);
}

// === F. 段首口语引导词滥用（2026-09-14 新增）===
// 实测 80 篇：60% 用了段首引导词，「说到底」12 篇、我认识/我身边/我有个 21 篇。
// ⚠️ 判断修正：这些词本身是★正常口语表达★（04 还要求「至少 2 处口语表达」），段首也是
// 最自然的位置；「我认识一个人」也可能是真事，不能假定虚构。故**不禁单次使用**，
// 只禁「滥用」——同一篇里反复用同类引导词起段（那才是模板化），以及「说到底」类全篇超限。
const LEAD_SOFT = /^(说到底|说白了|话说回来|说句实在话|说句心里话|退一步说|咋说呢|你别说|说起来|老实说|平心而论|换句话说|我认识|我身边|我有个|我一位|我一个|行里人都知道)/;
const PARAGRAPHS = body.split(/\n\n+/).map((p) => p.trim().replace(/\*\*/g, "")).filter((p) => p && !/^[!>#|:\-*\d]/.test(p));
const leadStarts = PARAGRAPHS.filter((p) => LEAD_SOFT.test(p));
if (leadStarts.length >= 3)
  fail(`段首口语引导词滥用：${leadStarts.length} 段以同类引导词起段（01 要求口语感，但反复用同一套路=模板化，须改用具象场景/细节起段）`);
// 「说到底」类引导词全篇次数上限（含中段——此前只禁结尾，漏了中段大量使用）
const leadCount = (body.match(/(说到底|说白了|归根结底)/g) || []).length;
if (leadCount >= 3)
  fail(`「说到底/说白了/归根结底」全篇 ${leadCount} 次（限 2 次；此前只禁结尾漏了中段）`);

// AI 金句句式 ≥3 已并入上方风格加权门（权重 1.0），此处不再重复独立 FAIL

// === 万能句式禁飞区（2026-09-14 新增，硬 FAIL）===
// 实测近 40 篇：结尾 42% 塌进「说到底/不是X是Y」、开头 62% 塌进「≤8字短句。＋展开」。
// 这些骨架能套任何话题，是「池子抽了但写出来一个样」的元凶。禁的是骨架不是词——
// 把「说到底」换成「归根结底」不算改。
// 只作用于「结尾最后一句」而非整段：整段匹配会把中段的正常用法误杀（首版实踩，特异度掉到 66.8%）
const PARAS = body.split(/\n\n+/).filter((p) => p.trim() && !/^!\[/.test(p.trim()));
const firstP = (PARAS[0] || "").replace(/\*\*/g, "").trim();
const lastFull = (PARAS[PARAS.length - 1] || "").replace(/\*\*/g, "").trim();
// 取结尾最后一句（按中文句末标点切，取最后 1-2 句、上限 60 字）
const sentences = lastFull.split(/(?<=[。！？])/).filter((s) => s.trim());
const lastSent = (sentences.slice(-2).join("") || lastFull).slice(-60);
// 结尾专用禁飞骨架（均限定在末句内）
// 硬 FAIL：只留「最强收敛信号」两条（合计占历史结尾 42%，是元凶）
if (/不是[^，。！？\n]{1,14}[，,](而是)?是[^，。！？\n]{1,14}/.test(lastSent))
  fail(`结尾用「不是X是Y」禁飞骨架（实测 20% 结尾用它=同质化元凶）：…${lastSent.slice(-38)}`);
if (/(说到底|归根结底|说白了|一句话)[，,]/.test(lastSent))
  fail(`结尾用「说到底/归根结底」禁飞引导词（实测 22% 结尾用它）：…${lastSent.slice(-38)}`);
// 全部硬 FAIL（用户 2026-09-14 决定最严）：这些是历史好稿里的弱收敛信号，
// 同样拦——差异化的收益大于返工成本。
if (/(真正|最关键的|更要紧的)[^，。！？\n]{0,10}的?[，,]?\s*是/.test(lastSent))
  fail(`结尾用「真正X的是Y」禁飞骨架：…${lastSent.slice(-38)}`);
if (/[^，。！？\n]{1,12}的(是|从来不是)[^，。！？\n]{1,14}[。！？]?$/.test(lastSent))
  fail(`结尾用「X的是Y」名词化空泛升华：…${lastSent.slice(-38)}`);
if (/(这大概就是|这才是)[^。！？\n]{0,12}(的意思|留给我们的|教给我们的)/.test(lastSent))
  fail(`结尾用「这才是X留给我们的」万能升华句：…${lastSent.slice(-38)}`);
// 开头专用禁飞骨架：≤8字短句 + 句号 起（「635元。这个数字…」「40年。一纸新政…」）
if (/^[^。，？！\n]{2,8}。/.test(firstP) && !/^[「《>]/.test(firstP))
  fail(`开头用「≤8字短句。＋展开」禁飞骨架（实测 62% 开头用它）：${firstP.slice(0, 30)}…`);

// === WARN（不阻断）===
if (boldN > 6) warn(`加粗 ${boldN} 处过多，全篇加粗等于没加粗`);
if (!/我/.test(body)) warn("未见第一人称落点（我/我们家/我朋友）");
if (/我们应该|我们要学会|让我们珍惜|我们要/.test(body)) warn("说教式结尾");
const paras = body.split(/\n\n+/).filter((p) => p.trim());
const lens = paras.map((p) => p.length);
if (paras.length >= 4 && lens.every((l) => Math.abs(l - lens[0]) < 20))
  warn("段落全等长，须长短不齐");

// === B. 事实/情绪占比（2026-09-14 新增，硬 FAIL）===
// 04 要求「事实/资料占比 ≥ 情绪议论」，实测 179 篇实际是反的：FEEL 39.8% vs FACT 21.0%。
// 用粗粒度代理指标：含数字的段落（事实）vs 含心理动词的段落（感受）
const FEEL_RE = /我(觉得|想|琢磨|看着|盯着|想起|心里|当时|一下子)|心里(一|咯噔|不是滋味)|难受|感动|鼻子(一|发)|眼眶/;
const bodyParas = body
  .split(/\n\n+/)
  .map((p) => p.trim().replace(/\*\*/g, ""))
  .filter((p) => p && !/^!\[/.test(p) && !/^[#>|]/.test(p) && !/^[-*\d]/.test(p));
if (bodyParas.length >= 5) {
  const factN = bodyParas.filter((p) => (p.match(/\d/g) || []).length >= 3).length;
  const feelN = bodyParas.filter((p) => FEEL_RE.test(p)).length;
  if (feelN > factN)
    fail(`情绪段 ${feelN} > 事实段 ${factN}（04 要求事实占比 ≥ 情绪，实测历史 39.8% vs 21.0% 是反的）`);
}

// === C. 升华段位置（2026-09-14 新增，WARN——位置集中≠缺陷，靠轮换解决）===
// 实测 56% 的升华段在「倒数第 2 段」+19% 在倒数第 3 段 = 75% 位置雷同，中段其实是固定骨架。
// 升华段 = 不含具体数字、含概括判断的段落
if (bodyParas.length >= 5) {
  const elevIdx = [];
  bodyParas.forEach((p, i) => {
    const hasNum = (p.match(/\d/g) || []).length;
    if (hasNum === 0 && p.length >= 40 && /(说到底|其实|本质|从来|往往|终归|无非|这背后|意味着|说明)/.test(p))
      elevIdx.push(i);
  });
  const n = bodyParas.length;
  for (const i of elevIdx) {
    const fromEnd = n - i;
    // 降为 WARN：实测拦下的全是「升华段(倒数2)+收尾段(末段)」这一正常有效结构，
    // 不是缺陷。位置集中该靠「轮换」解决，不该靠「拦截」——硬拦等于否定好写法。
    if (fromEnd === 2)
      warn(`升华段落在「倒数第 2 段」（56% 历史稿都在这=位置偏集中，下一批可换中段/倒数第4段）`);
  }
}

// === D. 句长节奏（2026-09-14 新增，硬 FAIL）===
// 实测平均句长 37.2 字、标准差仅 6.3（几乎全在中长句），短句占比仅 5% → 节奏单调。
const sents = body
  .replace(/\n/g, "")
  .split(/(?<=[。！？])/)
  .filter((s) => s.trim() && !/^\s*[#|>!]/.test(s) && !/^\s*\d+\./.test(s));
if (sents.length >= 12) {
  const slens = sents.map((s) => s.length);
  const avg = slens.reduce((a, b) => a + b, 0) / slens.length;
  const sd = Math.sqrt(slens.reduce((a, b) => a + (b - avg) ** 2, 0) / slens.length);
  const shortRatio = slens.filter((l) => l <= 12).length / slens.length;
  if (sd < 10) fail(`句长标准差仅 ${sd.toFixed(1)}（实测历史 6.3=节奏单调），须长短句穿插`);
  // 短句占比降为 WARN：历史中位数本就是 5%（P25=0% P50=5%），无区分度——它反映
  // 「节奏可改善」的方向，不是个体缺陷；硬拦会拦掉一半文章（实测 78% 命中）。见 D1 硬拦句长标准差。
  if (shortRatio < 0.08) warn(`短句(≤12字)占比 ${(shortRatio * 100).toFixed(0)}%（历史中位 5%，建议加短句破节奏）`);
}

// === 报告 ===
console.log(`\npreflight：${a.title}`);
console.log(`字数：标题 ${charCount(title)} / 摘要 ${charCount(digest)} / 正文 ${bc}`);
console.log(`加粗 ${boldN} / 引言 ${quoteN} / 段落 ${paras.length}`);
if (warns.length) console.log("\n⚠ WARN：");
for (const w of warns) console.log(`  - ${w}`);
if (fails.length) {
  console.log("\n✗ FAIL（拒推，回炉）：");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ 通过硬门，可推草稿");
