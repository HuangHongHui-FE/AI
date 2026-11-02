// 各平台热榜接口定义：来源、UA、请求头、JSON 字段路径、条目提取器
// 新增平台只在这里加一条，抓取与解析逻辑通用

// 统一把热度数字转成「万」人读形态；非数字返回空串
export function fmtHeat(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 10000 ? `${(v / 10000).toFixed(1).replace(/\.0$/, "")}万` : String(v);
}

// 移动端 UA：百度/抖音对 PC UA 不友好
const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
// PC UA：头条/B站/微博需要
const UA_PC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 平台定义表：key 用于 --platforms 参数
export const PLATFORMS = {
  toutiao: {
    label: "今日头条",
    url: "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc",
    headers: { "User-Agent": UA_PC },
    // 头条：data[] → Title / HotValue / Url
    extract: (json) =>
      (json.data || []).map((it, i) => ({
        rank: i + 1,
        title: it.Title || "",
        heat: fmtHeat(it.HotValue),
        url: it.Url || "",
      })),
  },

  baidu: {
    label: "百度热搜",
    url: "https://top.baidu.com/api/board?platform=wise&tab=realtime",
    headers: { "User-Agent": UA_MOBILE },
    // 百度：data.cards[].content[].content[]，嵌套两层，无稳定热度数字
    extract: (json) => {
      const out = [];
      for (const card of json.data?.cards || []) {
        for (const block of card.content || []) {
          for (const it of block.content || []) {
            if (!it.word) continue;
            out.push({ rank: out.length + 1, title: it.word, heat: String(it.hotScore || ""), url: it.url || "" });
          }
        }
      }
      return out;
    },
  },

  douyin: {
    label: "抖音热榜",
    url: "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/",
    headers: { "User-Agent": UA_MOBILE },
    // 抖音：data.word_list[] → word / hot_value；顶层 active_time 是榜单刷新时间
    meta: (json) => ({ active_time: json.active_time || null }),
    extract: (json) =>
      (json.word_list || []).map((it, i) => ({
        rank: i + 1,
        title: it.word || "",
        heat: fmtHeat(it.hot_value),
        url: `https://www.douyin.com/search/${encodeURIComponent(it.word || "")}`,
      })),
  },

  bilibili: {
    label: "B站热搜",
    url: "https://api.bilibili.com/x/web-interface/search/square?limit=20",
    headers: { "User-Agent": UA_PC },
    // B站：data.trending.list[] → keyword / heat_score
    extract: (json) =>
      (json.data?.trending?.list || []).map((it, i) => ({
        rank: i + 1,
        title: it.keyword || "",
        heat: fmtHeat(it.heat_score),
        url: it.url || "",
      })),
  },

  weibo: {
    label: "微博热搜",
    // PC 端免登录接口；m 端会跳访客系统，不要用
    url: "https://weibo.com/ajax/side/hotSearch",
    headers: { "User-Agent": UA_PC, Referer: "https://weibo.com/" },
    // 微博：data.realtime[]（51 条），num 是真实热度值，label_name 只是「新/沸」标签
    extract: (json) =>
      (json.data?.realtime || []).map((it, i) => ({
        rank: i + 1,
        title: it.word || "",
        heat: fmtHeat(it.num) || it.label_name || it.small_icon_desc || "",
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent("#" + (it.word || "") + "#")}`,
      })),
  },
};
