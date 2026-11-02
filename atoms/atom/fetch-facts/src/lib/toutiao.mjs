// 头条搜索抓取：返回「标题 + 摘要 + 来源媒体 + 原文链接 + 发布时间」
// 头条搜索是当前最稳的国内新闻源（百度 m 站/搜狗 news/必应 cn 在部分网络下都被拦）
//
// 页面结构（2026-10 实测）：每个搜索结果是一个无损 JSON script 块
//   <script data-druid-card-data-id="..." type="application/json">{"data":{...}}</script>
// 块内含 title / abstract / summary / source / article_url / datetime 等字段。
// ⚠️ 不能直接对整页跑「title 到 abstract」的非贪婪正则——一个结果块里的 abstract 出现
//    在 title 之前（highlight.abstract 在前），跨块匹配会把 N 条结果吞成 1 条（实测 19 条只出 4 条）。

import { fetchText, sleep, stripTags } from "./http.mjs";

// 从 JS 字符串字面量里反转义：<em> 高亮标记要去掉，其余转义还原
function unescapeJs(s) {
  return String(s || "")
    .replace(/\\u003c\/?em\\u003e/g, "")
    .replace(/\\u003c[^>]*?\\u003e/g, "")
    .replace(/\\u002F/g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\(.)/g, "$1");
}

// 把一条原始记录的多个字段按优先级取第一个非空值
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v && typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// 单条记录 → 事实条目；无摘要或无标题的丢弃（多半是推荐位/热搜卡片）
function toFact(raw, origin) {
  const title = stripTags(unescapeJs(pick(raw, ["title"])));
  // summary 常比 abstract 完整；两者都取，优先 abstract（更短更聚焦）
  const abstract = stripTags(unescapeJs(pick(raw, ["abstract", "summary"])));
  if (!title || !abstract) return null;
  if (abstract.length < 8) return null;

  const url = pick(raw, ["article_url", "open_url", "item_source_url", "seo_url"]);
  const publisher = stripTags(unescapeJs(pick(raw, ["source", "media_name", "user_name"])));
  // 时间戳可能是秒级字符串或 "YYYY-MM-DD HH:mm:ss"
  const dt = pick(raw, ["datetime", "publish_time", "create_time"]);
  let published_at = "";
  if (/^\d{10}$/.test(dt)) published_at = new Date(Number(dt) * 1000).toISOString().slice(0, 10);
  else if (/^\d{4}-\d{2}-\d{2}/.test(dt)) published_at = dt.slice(0, 10);

  return {
    title,
    abstract,
    publisher,
    url: /^https?:\/\//.test(url) ? url : "",
    published_at,
    origin,
  };
}

// 遍历所有内嵌 JSON 块，收集能组成事实条目的记录
export function parseToutiao(html) {
  const out = [];
  const seen = new Set();

  // 只取 type="application/json" 的 script 块——正文 HTML 里的内联脚本不含这些字段
  const blockRe = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw.includes('"abstract"') && !raw.includes('"summary"')) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue; // 非 JSON 或截断的块跳过
    }
    // 记录可能在 data 下，也可能就是顶层
    for (const cand of [data?.data, data]) {
      if (!cand || typeof cand !== "object") continue;
      const fact = toFact(cand, "头条搜索");
      if (!fact || seen.has(fact.title)) continue;
      seen.add(fact.title);
      out.push(fact);
    }
  }
  return out;
}

// 标题相似度去重：同一事件会被 N 家媒体用几乎相同的标题报道，全收进来只会刷屏
// 判定：去标点后做 2 字滑窗，重合率 ≥ 0.4 视为同一事件
// 阈值是网格搜索出来的：2-gram 在 0.30~0.50 区间对 3 对同事件全命中、3 对不同事件全分开；
// 取 0.4 落在安全区中部（用 3-gram 则同事件只能命中 1/3，召回太差）
function similarTitle(a, b) {
  const norm = (s) => String(s).replace(/[^一-龥a-zA-Z0-9]/g, "");
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return false;
  if (A === B) return true;
  // 短串是长串的子串（最常见：加了个「凌晨！」前缀或「全网刷屏」后缀）
  if (A.length <= B.length ? B.includes(A) : A.includes(B)) return true;
  const grams = (s) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const ga = grams(A);
  const gb = grams(B);
  if (!ga.size || !gb.size) return false;
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return hit / Math.min(ga.size, gb.size) >= 0.4;
}

// 抓头条搜索：多关键词变体 + 多页（分页 offset 实测无效，各页内容相同，靠关键词变体扩召回）
// variants 由调用方提供；不传则只搜原词
export async function toutiaoSearch(query, { variants = [], retries = 2 } = {}) {
  const queries = [`${query}`, ...variants].map((q) => `${q} 最新`).flatMap((q) => [q, q.replace(" 最新", "")]);
  const uniq = [...new Set(queries)].filter(Boolean);
  const out = [];
  const seen = new Set();

  for (const q of uniq) {
    const enc = encodeURIComponent(q);
    for (let t = 0; t < retries; t++) {
      const html = await fetchText(`https://so.toutiao.com/search?dvpf=pc&keyword=${enc}`, "https://so.toutiao.com/");
      const rows = parseToutiao(html);
      // 抓到就没必要重试（头条偶发空页时才补一次）
      if (rows.length) {
        for (const f of rows) {
          // 同一家媒体同一标题才跳过；不同媒体报同一事件要全收——
          // 各家摘要含的细节不同，正是要多源核对的理由
          const key = `${f.title}|${f.publisher}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ ...f, matched_query: q });
        }
        break;
      }
      await sleep(600);
    }
    await sleep(400); // 关键词之间控速
    if (out.length >= 30) break;
  }

  // 标记事件簇：同一事件的多家报道归为一组，下游可优先挑「最高等级媒体 + 细节最全」
  const clusters = [];
  for (const f of out) {
    let c = clusters.find((cl) => similarTitle(cl.title, f.title));
    if (!c) {
      c = { id: clusters.length + 1, title: f.title, members: [] };
      clusters.push(c);
    }
    c.members.push(f);
    f.cluster = c.id;
  }
  return out;
}

// 事件簇汇总：每簇给代表标题 + 报道该事件的媒体列表
export function clusterSummary(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.cluster)) map.set(r.cluster, { id: r.cluster, titles: [], publishers: [] });
    const c = map.get(r.cluster);
    c.titles.push(r.title);
    if (r.publisher) c.publishers.push(r.publisher);
  }
  return [...map.values()].map((c) => ({
    id: c.id,
    title: c.titles[0],
    sources: [...new Set(c.publishers)],
    count: c.titles.length,
  }));
}

// 给缺 URL 的结果补搜索页链接（仍可点开核对，但标记出来不是原文）
export function ensureUrls(rows, query) {
  const q = encodeURIComponent(query);
  return rows.map((r) => ({
    ...r,
    url: r.url || `https://so.toutiao.com/search?keyword=${q}`,
    url_is_search: !r.url,
  }));
}
