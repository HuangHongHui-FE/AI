// 12 类真实感锚点：写作指引 + 可机器检测的弱判据
// 源：project/wechat/skills/04-真人真事包装.md（2026-11 迁移）
// 检测只做「有没有这个类型」的提示，不替代人读；verify 的 ok 以 ≥8 类 + 无红线为准

function found(text, re) {
  const m = text.match(re);
  return m ? { found: true, evidence: m[0].slice(0, 40) } : { found: false, evidence: "" };
}

const CITIES =
  "北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|苏州|天津|长沙|郑州|青岛|厦门|福州|合肥|昆明|济南|沈阳|大连|宁波|无锡|佛山|东莞|石家庄|南昌|贵阳|南宁|太原|长春|哈尔滨|兰州|海口|三亚";

const BRANDS =
  "小米|华为|TP-?Link|滴答清单|Things|微软\\s*To\\s*Do|iPhone|苹果手机|Notion|印象笔记|抖音|视频号|B站|哔哩哔哩|淘宝|拼多多|京东|滴滴|高德|美团|饿了么|微信|支付宝|网易云|QQ音乐|地铁\\s*\\d+\\s*号线";

const JOB = "开发|运营|产品|设计|销售|HR|人事|老师|医生|护士|司机|律师|会计|程序员|码农|公务员|外卖员|快递员|店主|老板|记者|编辑|客服|财务|行政|保安";
const STATUS = "被裁|离职|跳槽|应届|失业|待业|刚毕业|转行|辞职|裸辞";

export const ANCHORS = [
  {
    id: "time",
    name: "时间戳",
    guide: "「那天晚上」→「上周三晚上十一点半」；精确到星期几、日期、时刻。",
    detect: (t) =>
      found(
        t,
        /(周[一二三四五六日天]|星期[一二三四五六日天])|(\d{1,2}\s*月\s*\d{1,2}\s*[号日])|((凌晨|早上|上午|中午|下午|傍晚|晚上|半夜)\s*[一二三四五六七八九十两\d]{1,3}\s*点(半|[一二三四五六七八九十\d]{1,3}\s*分)?)|(\d{1,2}\s*点\s*(半|\d{1,2}\s*分))/,
      ),
  },
  {
    id: "place",
    name: "地理锚点",
    guide: "「我家」→「北京东五环外一个89平的老破小」；城市 + 区域 + 户型/地标，不编具体小区名。",
    detect: (t) =>
      found(
        t,
        new RegExp(`(${CITIES})[^。\\n]{0,20}(区|环|路|街|小区|写字楼|平|号院)|([东西南北]?\\d+\\s*环)|\\d+\\s*平(米)?`),
      ),
  },
  {
    id: "identity",
    name: "身份/职业细节",
    guide: "「我老公」→「我老公，35岁，前端开发，上个月被裁」；年龄 + 工龄/行业 + 当前状态。",
    detect: (t) => {
      const age = /\d{2}\s*岁/.test(t);
      const job = new RegExp(JOB).test(t);
      const status = new RegExp(STATUS).test(t);
      const hits = [age && "年龄", job && "职业", status && "状态"].filter(Boolean);
      return hits.length >= 2
        ? { found: true, evidence: hits.join("+") }
        : { found: false, evidence: hits.join("+") };
    },
  },
  {
    id: "brand",
    name: "品牌/工具名",
    guide: "嵌入大众都在用的工具/品牌，让读者觉得「我也用这个」；别用小众竞品。",
    detect: (t) => found(t, new RegExp(BRANDS)),
  },
  {
    id: "dialogue",
    name: "对话还原",
    guide: "直接还原对话，包括停顿和沉默（「……」或「愣了一下」）；不要写「他说了一段话」。",
    detect: (t) => {
      const quote = t.match(/「[^」]{2,}」|“[^”]{2,}”|"[^"]{2,}"/);
      if (!quote) return { found: false, evidence: "" };
      const pause = /……|\.{3,}|愣了一下|沉默|没说话/.test(t);
      return {
        found: true,
        evidence: quote[0].slice(0, 40),
        note: pause ? "" : "对话有了，但缺少停顿/沉默（「……」或「愣了一下」）",
      };
    },
  },
  {
    id: "number",
    name: "具体数字",
    guide: "「押金没退」→「2000押金，理由是墙上有钉子眼」；数字 + 来源/凭证暗示。",
    detect: (t) =>
      found(
        t,
        /(\d+(\.\d+)?\s*(万|千|百|块|元|平|岁|年|个月|天|小时|分钟|次|人|单|斤|公里|份))|([+-]?\d+(\.\d+)?%)|(\d+万\d)/,
      ),
  },
  {
    id: "sensory",
    name: "感官细节",
    guide: "每个场景给一个五感锚点（视觉/听觉/触觉/嗅觉/味觉），不要堆。",
    detect: (t) => found(t, /(味|声音|凉|热|冷|雨|风|灯|汗|烟|咸|甜|苦|香|吵|安静|湿|干|刺眼|扎手|烫|硬|软)/),
  },
  {
    id: "reveal",
    name: "「后来才知道」揭秘",
    guide: "先抛细节，过几段再揭秘，制造「事后回看」的真实感。",
    detect: (t) => found(t, /后来才知道|后来才明白|事后才知道|很久以后|直到后来/),
  },
  {
    id: "witness",
    name: "第三方见证",
    guide: "加一个在场的人，说具体的话，最好带点质疑或反驳。",
    detect: (t) => found(t, /(闺蜜|朋友|我妈|我爸|我姐|我哥|同事|邻居|室友|同学|老婆|老公|对象|老板|工友)[^。！？\n]{0,40}[「“"]/),
  },
  {
    id: "contrast",
    name: "前后对照",
    guide: "「以前vs现在」两个状态都要具体，不要「以前焦虑现在不焦虑」这种空话。",
    detect: (t) => {
      const before = t.match(/以前|之前/);
      const after = t.match(/现在|如今|后来/);
      if (!before || !after) return { found: false, evidence: "" };
      const gap = Math.abs(t.indexOf(before[0]) - t.indexOf(after[0]));
      return gap <= 120
        ? { found: true, evidence: `${before[0]}…${after[0]}` }
        : { found: false, evidence: `${before[0]}…${after[0]}（相隔过远）` };
    },
  },
  {
    id: "evidence",
    name: "凭证暗示",
    guide: "提到截图、聊天记录、便利贴、备忘录标题等「可被验证」的物件。",
    detect: (t) => found(t, /(截图|聊天记录|备忘录|便利贴|短信|转账记录|朋友圈|工牌|收据|发票|订单|录音)/),
  },
  {
    id: "echo",
    name: "收尾呼应",
    guide: "结尾回到一个具体的小动作或小物件，暗示「时间过去了」。",
    detect: (t) => {
      const tail = t.slice(-150);
      const obj = tail.match(/(面馆|咖啡|灯|杯|门|手机|雨|风|路|车|钥匙|伞|饭|碗|电脑|窗|沙发|地铁)/);
      const action = /(了|着|过)/.test(tail);
      return obj && action
        ? { found: true, evidence: obj[0] }
        : { found: false, evidence: obj ? `${obj[0]}（缺动作）` : "" };
    },
  },
];

// 抽象表达：出现时只提示，不直接判失败
export const ABSTRACT_PATTERNS = [
  { re: /那天(晚上|早上|下午|中午)?/g, hint: "改成具体日期 + 星期 + 时刻" },
  { re: /有一天/g, hint: "改成具体日期" },
  { re: /前段时间/g, hint: "改成具体月份/日期" },
  { re: /前几天/g, hint: "改成具体日期" },
  { re: /我家/g, hint: "改成城市 + 区域 + 户型" },
  { re: /公司里/g, hint: "改成公司类型 + 位置" },
  { re: /(他说|她说)(了一段话)?/g, hint: "直接还原对话，带停顿" },
  { re: /(后来)(?!才知道|才明白)/g, hint: "尽量给具体时间推进" },
];

// 红线：命中即 fail
export const RED_LINES = [
  {
    id: "company",
    name: "可被核实的公司名",
    guide: "不用真实公司名当主角雇主，改「某互联网中厂」「朝阳区某个老破小写字楼」。",
    detect: (t) =>
      found(t, /(字节跳动|腾讯|阿里巴巴|百度|美团|京东|拼多多|网易|滴滴|快手|小红书|华为|小米)[^。\n]{0,20}(公司|上班|就职|被裁|同事|领导|HR|辞职)/),
  },
  {
    id: "community",
    name: "具体小区名",
    guide: "用类型描述（「东五环89平老破小」），不编具体小区名。",
    detect: (t) => found(t, /[一-龥]{2,}(花园|小区|家园|苑|府|湾|城)(?=[，。、\s]|$)/),
  },
  {
    id: "public-event",
    name: "编造公共事件细节",
    guide: "不要把虚构故事挂到具体日期的公共事件上。",
    detect: (t) =>
      found(t, /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日[^。\n]{0,30}(事件|事故|爆炸|地震|疫情|发布会)/),
  },
];