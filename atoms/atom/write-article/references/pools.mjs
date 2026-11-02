// 写作维度池：自 project/wechat-img/skills/04-writing-pools.md 抽取（2026-10-30）
// banned 非 null 的池项与新规则冲突（第一人称已全面禁用等），抽取时自动跳过

export const ENDING_SKELETON = [
  {
    "no": 1,
    "name": "具体动作定格",
    "detail": "以某人的**一个动作**收尾，无判断",
    "banned": null
  },
  {
    "no": 2,
    "name": "具象物件定格",
    "detail": "以**一个实物**收尾",
    "banned": null
  },
  {
    "no": 3,
    "name": "当事人原话",
    "detail": "直接引一句原话，不加评论",
    "banned": null
  },
  {
    "no": 4,
    "name": "数字定格",
    "detail": "以一个**具体数字**收尾，不解释",
    "banned": null
  },
  {
    "no": 5,
    "name": "时间推进",
    "detail": "以**时间状语**收尾（下一轮/往后/来年）",
    "banned": null
  },
  {
    "no": 6,
    "name": "场景白描",
    "detail": "一个画面，不带情绪词",
    "banned": null
  },
  {
    "no": 7,
    "name": "反问留白",
    "detail": "以问号收尾，**不下判断**",
    "banned": null
  },
  {
    "no": 8,
    "name": "并列短句",
    "detail": "两个短句并置，**不用「不是…是…」**",
    "banned": null
  },
  {
    "no": 9,
    "name": "未完成动作",
    "detail": "以「还在/仍在/继续」收尾",
    "banned": null
  },
  {
    "no": 10,
    "name": "回到开头物件",
    "detail": "回扣**开头出现过**的具体物/词",
    "banned": null
  },
  {
    "no": 11,
    "name": "旁观引述",
    "detail": "第三方口吻，**不加自己判断**",
    "banned": null
  },
  {
    "no": 12,
    "name": "感官细节",
    "detail": "声音/光线/温度收尾",
    "banned": null
  },
  {
    "no": 13,
    "name": "疑问悬置",
    "detail": "抛出一个**具体**未解问题",
    "banned": null
  },
  {
    "no": 14,
    "name": "对话截断",
    "detail": "以一句**没说完的话**收尾",
    "banned": null
  },
  {
    "no": 15,
    "name": "状态描述",
    "detail": "以**某人正处于什么状态**收尾",
    "banned": null
  },
  {
    "no": 16,
    "name": "地点定格",
    "detail": "以**地点**收尾",
    "banned": null
  },
  {
    "no": 17,
    "name": "习俗/惯例",
    "detail": "以**一件以后还会重复的事**收尾",
    "banned": null
  },
  {
    "no": 18,
    "name": "数据对比",
    "detail": "两个数字并置（**不解释含义**）",
    "banned": null
  },
  {
    "no": 19,
    "name": "旁枝细节",
    "detail": "以一个**看似无关的细节**收尾",
    "banned": null
  },
  {
    "no": 20,
    "name": "留白省略",
    "detail": "省略号断句",
    "banned": null
  }
];

export const OPENING_SKELETON = [
  {
    "no": 1,
    "name": "引语直起",
    "detail": "以引号内的话开篇，**前面不加任何字**",
    "banned": null
  },
  {
    "no": 2,
    "name": "场景+人",
    "detail": "地点＋一个具体的人在做具体事",
    "banned": null
  },
  {
    "no": 3,
    "name": "当事人视角",
    "detail": "以「他/她」的一个具体行为起",
    "banned": null
  },
  {
    "no": 4,
    "name": "对话起",
    "detail": "以一句对话开篇",
    "banned": null
  },
  {
    "no": 5,
    "name": "时间+事件",
    "detail": "时间状语**直接接事件**（不先抛短句）",
    "banned": null
  },
  {
    "no": 6,
    "name": "悬念物件",
    "detail": "一个物件起，不说它意味着什么",
    "banned": null
  },
  {
    "no": 7,
    "name": "设问",
    "detail": "一个问题起（**问具体事，不问抽象**）",
    "banned": null
  },
  {
    "no": 8,
    "name": "身份+处境",
    "detail": "某类人＋他们此刻的具体处境",
    "banned": null
  },
  {
    "no": 9,
    "name": "反向事实",
    "detail": "先给一个**与预期相反的事实**",
    "banned": null
  },
  {
    "no": 10,
    "name": "数字+对象",
    "detail": "数字**紧跟它所修饰的具体对象**（不单独成句）",
    "banned": null
  },
  {
    "no": 11,
    "name": "地点白描",
    "detail": "从地点环境起",
    "banned": null
  },
  {
    "no": 12,
    "name": "日常动作",
    "detail": "一个**日常小动作**起",
    "banned": null
  }
];

export const OPENING_HOOK = [
  {
    "no": 1,
    "name": "场景代入",
    "detail": "一个具体场景起",
    "banned": null
  },
  {
    "no": 2,
    "name": "数据冲击",
    "detail": "关键数字起",
    "banned": null
  },
  {
    "no": 3,
    "name": "反常识断言",
    "detail": "一句反常识",
    "banned": null
  },
  {
    "no": 4,
    "name": "原话开场",
    "detail": "当事人一句起",
    "banned": null
  },
  {
    "no": 5,
    "name": "提问起",
    "detail": "抛一个问题",
    "banned": null
  },
  {
    "no": 6,
    "name": "时间锚点",
    "detail": "时间切入",
    "banned": null
  },
  {
    "no": 7,
    "name": "身份代入",
    "detail": "某类人切入",
    "banned": null
  },
  {
    "no": 8,
    "name": "矛盾呈现",
    "detail": "反差起",
    "banned": null
  },
  {
    "no": 9,
    "name": "悬念缺口",
    "detail": "留个缺口",
    "banned": null
  },
  {
    "no": 10,
    "name": "对照新旧",
    "detail": "老新对照起",
    "banned": null
  },
  {
    "no": 11,
    "name": "冷知识起",
    "detail": "揭底层",
    "banned": null
  },
  {
    "no": 12,
    "name": "旁观点评",
    "detail": "第三方视角起",
    "banned": null
  },
  {
    "no": 13,
    "name": "第一人称困惑",
    "detail": "「我」的困惑（非纯情绪）",
    "banned": "第一人称已全面禁用（2026-09-14）"
  },
  {
    "no": 14,
    "name": "结果前置",
    "detail": "先结果后追溯",
    "banned": null
  },
  {
    "no": 15,
    "name": "设问起",
    "detail": "设问",
    "banned": null
  },
  {
    "no": 16,
    "name": "画面白描",
    "detail": "画面起",
    "banned": null
  },
  {
    "no": 17,
    "name": "递进追问",
    "detail": "递进",
    "banned": null
  },
  {
    "no": 18,
    "name": "转折起",
    "detail": "转折",
    "banned": null
  },
  {
    "no": 19,
    "name": "对仗起",
    "detail": "对仗短句",
    "banned": null
  },
  {
    "no": 20,
    "name": "留白起",
    "detail": "留白省略",
    "banned": null
  }
];

export const STRUCTURE = [
  {
    "no": 1,
    "name": "双标题+清单",
    "detail": "##2 + 6 段",
    "banned": null
  },
  {
    "no": 2,
    "name": "纯自然段",
    "detail": "无## + 6 段",
    "banned": null
  },
  {
    "no": 3,
    "name": "三标题+表格",
    "detail": "##3 + 7 段",
    "banned": null
  },
  {
    "no": 4,
    "name": "单标题+警示",
    "detail": "##1 + 5 段",
    "banned": null
  },
  {
    "no": 5,
    "name": "短段密集",
    "detail": "无## + 8 短段",
    "banned": null
  },
  {
    "no": 6,
    "name": "双标题+对照",
    "detail": "##2 + 6 段",
    "banned": null
  },
  {
    "no": 7,
    "name": "时间线",
    "detail": "无## + 按时间",
    "banned": null
  },
  {
    "no": 8,
    "name": "问答体",
    "detail": "##问题作小标题3",
    "banned": null
  },
  {
    "no": 9,
    "name": "清单体",
    "detail": "有序为主 + 5 段",
    "banned": null
  },
  {
    "no": 10,
    "name": "故事起承转合",
    "detail": "无## + 4 段",
    "banned": null
  },
  {
    "no": 11,
    "name": "观点先行",
    "detail": "##2（判断/验证）",
    "banned": null
  },
  {
    "no": 12,
    "name": "数据驱动",
    "detail": "stat 开篇 + ##2",
    "banned": null
  },
  {
    "no": 13,
    "name": "人物主线",
    "detail": "##2（人物/观察）",
    "banned": null
  },
  {
    "no": 14,
    "name": "对比双线",
    "detail": "##2（此/彼）",
    "banned": null
  },
  {
    "no": 15,
    "name": "三标题+引言0",
    "detail": "##3 + 6 段",
    "banned": null
  },
  {
    "no": 16,
    "name": "自然段+提示",
    "detail": "无## + 5 段",
    "banned": null
  },
  {
    "no": 17,
    "name": "双标题+表格",
    "detail": "##2 + 6 段",
    "banned": null
  },
  {
    "no": 18,
    "name": "长自然段",
    "detail": "无## + 7 段",
    "banned": null
  },
  {
    "no": 19,
    "name": "三标题+警示",
    "detail": "##3 + 7 段",
    "banned": null
  },
  {
    "no": 20,
    "name": "自然段+对照",
    "detail": "无## + 6 段",
    "banned": null
  }
];

export const TONE = [
  {
    "no": 1,
    "name": "亲历第一人称",
    "detail": "「我」亲历/旁观切入",
    "banned": "第一人称已全面禁用（2026-09-14）"
  },
  {
    "no": 2,
    "name": "第二人称对话",
    "detail": "「你」代入对话",
    "banned": null
  },
  {
    "no": 3,
    "name": "第三人称观察",
    "detail": "「他/当事人」客观记述",
    "banned": null
  },
  {
    "no": 4,
    "name": "群体代词",
    "detail": "「我们/我们这代人」共鸣",
    "banned": "「我们这代人」属群体代入，已禁"
  },
  {
    "no": 5,
    "name": "无主语客观",
    "detail": "直接陈述事实不挂主语",
    "banned": null
  },
  {
    "no": 6,
    "name": "唠嗑口语",
    "detail": "「咱/咱就说」口语",
    "banned": null
  },
  {
    "no": 7,
    "name": "旁观记录者",
    "detail": "「据…/有人…」转述",
    "banned": null
  },
  {
    "no": 8,
    "name": "设问自答",
    "detail": "自问自答推进",
    "banned": null
  },
  {
    "no": 9,
    "name": "回忆口吻",
    "detail": "「那时候…」回溯",
    "banned": null
  },
  {
    "no": 10,
    "name": "推演口吻",
    "detail": "「要是…就…」假设推演",
    "banned": null
  },
  {
    "no": 11,
    "name": "对话体",
    "detail": "引号来回对白",
    "banned": null
  },
  {
    "no": 12,
    "name": "诊断式",
    "detail": "「这事其实是…」下切",
    "banned": null
  },
  {
    "no": 13,
    "name": "类比式",
    "detail": "「像…一样」类比",
    "banned": null
  },
  {
    "no": 14,
    "name": "递归回扣",
    "detail": "回扣开头一句",
    "banned": null
  },
  {
    "no": 15,
    "name": "倾听者",
    "detail": "「听老人讲…」转述口传",
    "banned": null
  },
  {
    "no": 16,
    "name": "同行评议",
    "detail": "「行里人都知道…」业内口",
    "banned": null
  },
  {
    "no": 17,
    "name": "当事人代入",
    "detail": "「换我是…」换位",
    "banned": null
  },
  {
    "no": 18,
    "name": "时代旁白",
    "detail": "「这年头…」时代感",
    "banned": null
  },
  {
    "no": 19,
    "name": "冷峻断言",
    "detail": "「说到底…」克制定论",
    "banned": null
  },
  {
    "no": 20,
    "name": "留白口吻",
    "detail": "不评判只呈现",
    "banned": null
  }
];

export const ANGLE = [
  {
    "no": 1,
    "name": "人物故事",
    "detail": "聚焦一个人物命运",
    "banned": null
  },
  {
    "no": 2,
    "name": "行业职业",
    "detail": "拉到某行当讲",
    "banned": null
  },
  {
    "no": 3,
    "name": "结构观察",
    "detail": "揭底层结构/机制",
    "banned": null
  },
  {
    "no": 4,
    "name": "历史纵深",
    "detail": "放回历史脉络",
    "banned": null
  },
  {
    "no": 5,
    "name": "个人经验类比",
    "detail": "我/身边人亲历类比",
    "banned": "「我/身边人亲历」属第一人称叙事，已禁"
  },
  {
    "no": 6,
    "name": "利益相关方",
    "detail": "谁得利/谁受损",
    "banned": null
  },
  {
    "no": 7,
    "name": "反常识切入",
    "detail": "先抛反直觉",
    "banned": null
  },
  {
    "no": 8,
    "name": "时空对照",
    "detail": "今昔/城乡/中外",
    "banned": null
  },
  {
    "no": 9,
    "name": "因果追问",
    "detail": "为什么会这样",
    "banned": null
  },
  {
    "no": 10,
    "name": "边界定义",
    "detail": "这事到底算什么",
    "banned": null
  },
  {
    "no": 11,
    "name": "趋势预判",
    "detail": "往哪走",
    "banned": null
  },
  {
    "no": 12,
    "name": "类比迁移",
    "detail": "拿另一域规律套",
    "banned": null
  },
  {
    "no": 13,
    "name": "代价账",
    "detail": "得与失",
    "banned": null
  },
  {
    "no": 14,
    "name": "代际视角",
    "detail": "父辈 vs 我们",
    "banned": null
  },
  {
    "no": 15,
    "name": "地域视角",
    "detail": "地方性",
    "banned": null
  },
  {
    "no": 16,
    "name": "阶层视角",
    "detail": "哪类人",
    "banned": null
  },
  {
    "no": 17,
    "name": "技术视角",
    "detail": "技术如何改变",
    "banned": null
  },
  {
    "no": 18,
    "name": "规则视角",
    "detail": "潜规则/明规则",
    "banned": null
  },
  {
    "no": 19,
    "name": "情感锚点",
    "detail": "一种情绪入手",
    "banned": null
  },
  {
    "no": 20,
    "name": "价值取舍",
    "detail": "两难选哪个",
    "banned": null
  }
];

export const TRANSITION = [
  {
    "no": 1,
    "name": "场景跳接",
    "detail": "下段直接换场景",
    "banned": null
  },
  {
    "no": 2,
    "name": "时间顺推",
    "detail": "接着时间往下",
    "banned": null
  },
  {
    "no": 3,
    "name": "因果钩",
    "detail": "上果→下因/上因→下果",
    "banned": null
  },
  {
    "no": 4,
    "name": "反问转",
    "detail": "上段抛问下段答",
    "banned": null
  },
  {
    "no": 5,
    "name": "对比转",
    "detail": "下段反例对照",
    "banned": null
  },
  {
    "no": 6,
    "name": "数据引出",
    "detail": "下段用数据接",
    "banned": null
  },
  {
    "no": 7,
    "name": "引语接",
    "detail": "下段引语承",
    "banned": null
  },
  {
    "no": 8,
    "name": "递进",
    "detail": "更/进而",
    "banned": null
  },
  {
    "no": 9,
    "name": "转折",
    "detail": "可/但",
    "banned": null
  },
  {
    "no": 10,
    "name": "设问承",
    "detail": "下段自问自答",
    "banned": null
  },
  {
    "no": 11,
    "name": "画面接",
    "detail": "下段画面续",
    "banned": null
  },
  {
    "no": 12,
    "name": "细节放大",
    "detail": "上段提一句下段展开",
    "banned": null
  },
  {
    "no": 13,
    "name": "旁议插入",
    "detail": "夹一句评议",
    "banned": null
  },
  {
    "no": 14,
    "name": "回扣",
    "detail": "回指前文",
    "banned": null
  },
  {
    "no": 15,
    "name": "列举",
    "detail": "下段展开几条",
    "banned": null
  },
  {
    "no": 16,
    "name": "类比过渡",
    "detail": "拿类比连",
    "banned": null
  },
  {
    "no": 17,
    "name": "假设转",
    "detail": "如果…",
    "banned": null
  },
  {
    "no": 18,
    "name": "让步转",
    "detail": "固然…但",
    "banned": null
  },
  {
    "no": 19,
    "name": "收束过渡",
    "detail": "总结式但换说法",
    "banned": null
  },
  {
    "no": 20,
    "name": "留白跳接",
    "detail": "下段不接上段直接跳",
    "banned": null
  }
];

export const FORMAT = [
  {
    "no": 1,
    "name": "二级标题",
    "detail": "语法 `## 文`，用途 色条分章",
    "banned": null
  },
  {
    "no": 2,
    "name": "三级标题",
    "detail": "语法 `### 文`，用途 accent 小标题",
    "banned": null
  },
  {
    "no": 3,
    "name": "加粗",
    "detail": "语法 `**文**`，用途 accent 色浅底",
    "banned": null
  },
  {
    "no": 4,
    "name": "斜体",
    "detail": "语法 `*文*`，用途 真斜体 muted",
    "banned": null
  },
  {
    "no": 5,
    "name": "高亮",
    "detail": "语法 `==文==`，用途 浅底 accent 字",
    "banned": null
  },
  {
    "no": 6,
    "name": "引用块",
    "detail": "语法 `> 文`，用途 左条+底",
    "banned": null
  },
  {
    "no": 7,
    "name": "提示info",
    "detail": "语法 `:::info 文 :::`，用途 冷蓝（定义/政策）",
    "banned": null
  },
  {
    "no": 8,
    "name": "提示tip",
    "detail": "语法 `:::tip 文 :::`，用途 墨绿（技巧/操作）",
    "banned": null
  },
  {
    "no": 9,
    "name": "提示warning",
    "detail": "语法 `:::warning 文 :::`，用途 橙（警示）",
    "banned": null
  },
  {
    "no": 10,
    "name": "提示danger",
    "detail": "语法 `:::danger 文 :::`，用途 红（否决/红线）",
    "banned": null
  },
  {
    "no": 11,
    "name": "数据卡",
    "detail": "语法 `:::stat 数值 说明 :::`，用途 大数字+小字说明",
    "banned": null
  },
  {
    "no": 12,
    "name": "有序列表",
    "detail": "语法 `1. 文`，用途 编号",
    "banned": null
  },
  {
    "no": 13,
    "name": "无序列表",
    "detail": "语法 `- 文`，用途 圆点",
    "banned": null
  },
  {
    "no": 14,
    "name": "表格",
    "detail": "语法 |a|b|，用途 边框表",
    "banned": null
  },
  {
    "no": 15,
    "name": "分隔线",
    "detail": "语法 `---`，用途 章节分隔",
    "banned": null
  },
  {
    "no": 16,
    "name": "图片",
    "detail": "语法 `![说明](url)`，用途 图+figcaption",
    "banned": null
  },
  {
    "no": 17,
    "name": "删除线",
    "detail": "语法 `~~文~~`，用途 line-through 灰",
    "banned": null
  }
];

export const ENDING_STYLE = [
  {
    "no": 1,
    "name": "金句判断式",
    "detail": "一句点睛判断收尾",
    "banned": null
  },
  {
    "no": 2,
    "name": "追问留白式",
    "detail": "反问收尾，不下判断",
    "banned": null
  },
  {
    "no": 3,
    "name": "场景画面式",
    "detail": "一个画面定格，不下判断",
    "banned": null
  },
  {
    "no": 4,
    "name": "反例对照式",
    "detail": "拿另一件事对照收尾",
    "banned": null
  },
  {
    "no": 5,
    "name": "数据收束式",
    "detail": "关键数字定格收尾",
    "banned": null
  },
  {
    "no": 6,
    "name": "原话署名式",
    "detail": "当事人/权威一句收尾",
    "banned": null
  },
  {
    "no": 7,
    "name": "时间线收尾式",
    "detail": "按时间顺序收束",
    "banned": null
  },
  {
    "no": 8,
    "name": "预言推测式",
    "detail": "推测走向，不下定",
    "banned": null
  },
  {
    "no": 9,
    "name": "矛盾悬置式",
    "detail": "矛盾留着不解",
    "banned": null
  },
  {
    "no": 10,
    "name": "身份共鸣式",
    "detail": "某类人感受收尾",
    "banned": "示例含「新能源的中年人」尚可，但易滑向群体代入，需人工确认"
  },
  {
    "no": 11,
    "name": "因果归因式",
    "detail": "一句归因收尾",
    "banned": null
  },
  {
    "no": 12,
    "name": "对仗短句式",
    "detail": "两短句对仗定格",
    "banned": null
  },
  {
    "no": 13,
    "name": "留白省略式",
    "detail": "省略号不点破",
    "banned": null
  },
  {
    "no": 14,
    "name": "递归回扣式",
    "detail": "回扣开头一句",
    "banned": null
  },
  {
    "no": 15,
    "name": "冷知识揭底式",
    "detail": "揭一个底层事实收尾",
    "banned": null
  },
  {
    "no": 16,
    "name": "旁观引述式",
    "detail": "第三方口吻收尾",
    "banned": null
  },
  {
    "no": 17,
    "name": "画面+轻判断式",
    "detail": "画面后一句轻判断",
    "banned": null
  },
  {
    "no": 18,
    "name": "设问自答式",
    "detail": "自问自答给个轻答",
    "banned": null
  },
  {
    "no": 19,
    "name": "情感白描式",
    "detail": "一个情绪动作不评判",
    "banned": null
  },
  {
    "no": 20,
    "name": "排比递推式",
    "detail": "三句排比推到结尾",
    "banned": null
  }
];

// 维度键 → 池常量 + 中文名，供抽取与日志记录共用
export const DIMENSION_POOLS = {
  ending_skeleton: { pool: ENDING_SKELETON, label: "收口骨架" },
  opening_skeleton: { pool: OPENING_SKELETON, label: "开头骨架" },
  ending_style: { pool: ENDING_STYLE, label: "收口方式" },
  opening_hook: { pool: OPENING_HOOK, label: "开头钩子" },
  structure: { pool: STRUCTURE, label: "结构配方" },
  tone: { pool: TONE, label: "叙事口吻" },
  angle: { pool: ANGLE, label: "切入角度" },
  transition: { pool: TRANSITION, label: "段间衔接" },
};