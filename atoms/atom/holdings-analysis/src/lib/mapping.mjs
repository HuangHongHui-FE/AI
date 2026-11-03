// 基金名称关键词 → 预测板块。源：project/forecast/analyze_holdings.js
export const FUND_MAPPING = [
  { keywords: ["环保主题"], sector: "新能源车" },
  { keywords: ["科创板半导体", "科创半导体"], sector: "半导体" },
  { keywords: ["人工智能主题", "人工智能ETF"], sector: "AI算力/AI" },
  { keywords: ["北证50"], sector: "北证50" },
  { keywords: ["机器人"], sector: "机器人" },
  { keywords: ["产业优选"], sector: "中证500" },
  { keywords: ["科技创新"], sector: "科创50" },
  { keywords: ["科技智选"], sector: "AI算力/AI" },
  { keywords: ["精选灵活配置"], sector: "中证1000" },
  { keywords: ["全球科技先锋"], sector: "QDII全球科技" },
  { keywords: ["恒生科技"], sector: "恒生科技" },
  { keywords: ["绿色电力"], sector: "绿色电力" },
  { keywords: ["体育文化"], sector: "动漫游戏/传媒" },
  { keywords: ["全球高端制造"], sector: "QDII高端制造" },
  { keywords: ["港股通互联网", "港股互联网"], sector: "港股互联网" },
  { keywords: ["黄金"], sector: "黄金" },
  { keywords: ["动漫游戏"], sector: "动漫游戏/传媒" },
  { keywords: ["煤炭"], sector: "煤炭" },
  { keywords: ["传媒"], sector: "动漫游戏/传媒" },
  { keywords: ["畜牧养殖"], sector: "农业/畜牧" },
  { keywords: ["全球精选股票"], sector: "QDII全球" },
  { keywords: ["纳斯达克100"], sector: "QDII纳斯达克" },
  { keywords: ["城镇化"], sector: "房地产" },
  { keywords: ["全球智能科技"], sector: "QDII全球科技" },
  { keywords: ["海外数字经济"], sector: "QDII全球科技" },
  { keywords: ["机床"], sector: "机床" },
  { keywords: ["电池"], sector: "电池" },
  { keywords: ["全球新能源汽车"], sector: "QDII新能源车" },
  { keywords: ["证券ETF"], sector: "券商" },
  { keywords: ["半导体产业ETF", "半导体设备ETF"], sector: "半导体" },
  { keywords: ["创业板人工智能"], sector: "AI算力/AI" },
  { keywords: ["稀土"], sector: "稀土永磁" },
  { keywords: ["全球医药生物"], sector: "QDII医药" },
  { keywords: ["数字经济"], sector: "数字经济" },
  { keywords: ["龙头严选"], sector: "中证500" },
  { keywords: ["通信设备"], sector: "CPO/通信" },
  { keywords: ["香港银行"], sector: "港股金融" },
  { keywords: ["石油天然气", "标普石油"], sector: "石油/油气" },
  { keywords: ["油气产业"], sector: "石油/油气" },
  { keywords: ["光伏产业"], sector: "光伏" },
  { keywords: ["原油"], sector: "石油/油气" },
  { keywords: ["国开行债券", "万债"], sector: "债券" },
];

export function matchSector(fundName) {
  for (const m of FUND_MAPPING) {
    for (const kw of m.keywords) {
      if (fundName.includes(kw)) return m.sector;
    }
  }
  if (fundName.includes("QDII") || fundName.includes("全球")) return "QDII全球";
  if (fundName.includes("混合") || fundName.includes("灵活")) return "中证500";
  return "中证500";
}