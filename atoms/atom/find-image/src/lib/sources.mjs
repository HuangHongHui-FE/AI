// 四个图源渠道：必应（带时间过滤）、搜狗图库、360 图库、新闻正文挖图
// 每个渠道只负责「给出候选 URL + 标题」，过滤与相关性判断在 filters.mjs 统一做

import { fetchText, sleep } from "./http.mjs";

// 新闻图床白名单：这些域名的图是新闻正文配图，天然强相关
const NEWS_DOMAINS = [
  "sogoucdn", "n.sinaimg.cn", "k.sinaimg.cn", "p9.itc.cn", "p2.itc.cn",
  "dingyue.ws.126.net", "media.bjnews", "imagecloud.thepaper", "inews.gtimg",
  "puui.qpic", "byteimg", "toutiaoimg",
];

// 必应图库：async 接口；qft 传时间过滤可只取近期图
// 返回 [{url, title, source, referer}]
export async function bingCandidates(query, { timeFilter = "", pages = [1, 36, 71] } = {}) {
  const out = [];
  const seen = new Set();
  for (const first of pages) {
    const qft = timeFilter ? `&qft=+${timeFilter}` : "";
    const url = `https://cn.bing.com/images/async?q=${encodeURIComponent(query)}&first=${first}&count=35&form=IRFLTR${qft}`;
    const html = await fetchText(url, "https://cn.bing.com/");
    if (!html) continue;
    // 每张图：murl 是图地址，紧随其后的 t 字段是标题
    const re = /murl&quot;:&quot;([^&"']+?)&quot;.*?&quot;t&quot;:&quot;([^&"']*?)&quot;/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/&amp;/g, "&");
      if (!/\.(jpg|jpeg|png|webp)/i.test(u) || seen.has(u)) continue;
      seen.add(u);
      out.push({
        url: u,
        title: m[2].replace(/\\\//g, "/").replace(/\\u002F/g, "/"),
        source: "图库-必应",
        referer: "https://cn.bing.com/",
      });
    }
    await sleep(250); // 控速
  }
  return out;
}

// 搜狗图库：picUrl 是原图直链，thumbUrl 是缩略图
export async function sogouCandidates(query) {
  const html = await fetchText(
    `https://pic.sogou.com/pics?query=${encodeURIComponent(query)}&mode=1`,
    "https://pic.sogou.com/"
  );
  if (!html) return [];
  const out = [];
  const seen = new Set();
  const re = /"picUrl":"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/\\u002F/g, "/").replace(/\\"/g, '"');
    if (!/^https?:\/\//i.test(u) || !/\.(jpg|jpeg|png|webp)/i.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, title: "搜狗图库", source: "图库-搜狗", referer: "https://pic.sogou.com/" });
  }
  return out;
}

// 360 图库：JSON 接口，title+desc 可用于相关性判断
export async function qihooCandidates(query) {
  const raw = await fetchText(
    `https://image.so.com/j?q=${encodeURIComponent(query)}&src=tab_www&sn=0&pn=30`,
    "https://image.so.com/"
  );
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  try {
    const data = JSON.parse(raw);
    for (const it of data.list || []) {
      const u = it.img || it.thumb;
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push({
        url: u,
        title: `${it.title || ""} ${it.desc || ""}`.trim(),
        source: "图库-360",
        referer: "https://image.so.com/",
      });
    }
  } catch {
    /* 接口返回非 JSON 时静默跳过（该渠道失效，不影响其他渠道） */
  }
  return out;
}

// 从新闻页 HTML 提取正文配图
// 两种来源：① sogoucdn 缩略图需从 url= 参数解原图；② 直接以图片扩展名结尾的新闻图床
function extractNewsImages(html) {
  const urls = [];
  const seen = new Set();

  // ① sogoucdn 缩略图 → 解出 url 参数里的原图地址
  const sogouRe = /https?:\/\/img\d+\.sogoucdn\.com\/v2\/thumb[^"'\s<>]*/g;
  let m;
  while ((m = sogouRe.exec(html)) !== null) {
    const u = m[0].replace(/&amp;/g, "&");
    if (/\/w\/(32|40|48|64|218|160)\//i.test(u)) continue; // 小图/缩略图弃
    const real = decodeURIComponent((u.match(/[?&]url=([^&]+)/) || [])[1] || "");
    if (real && !seen.has(real)) {
      seen.add(real);
      urls.push(real);
    }
  }

  // ② 新闻图床的直接链接
  const extRe = /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  while ((m = extRe.exec(html)) !== null) {
    const u = m[0].replace(/&amp;/g, "&");
    if (!NEWS_DOMAINS.some((d) => u.includes(d))) continue;
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

// 从头条搜索结果页提取「文章标题 + 配图」配对
// 结构：每个搜索结果是一个 JSON 对象，含 "title" 与 "image_url"（另有 middle/other/cover 等变体）
// 关键：只取 JSON 里的 image_url 字段——页面顶部热搜卡片的 <img src> 是推荐位图，与关键词无关，
//       原实现把所有 toutiaoimg 图都当新闻图，实测抓出寿司图/导航图当配图
function extractToutiaoPairs(html) {
  const seen = new Set();
  const pairs = [];

  // ① 收集标题位置，用于给图片配对
  //    标题有纯文本版和带 <em> 高亮版（<em>…</em>），统一去标签后都收下
  const titles = [];
  const titleRe = /"title":"((?:[^"\\]|\\.){6,120})"/g;
  let tm;
  while ((tm = titleRe.exec(html)) !== null) {
    const t = tm[1]
      .replace(/\\u003c\/?em\\u003e/g, "") // 去掉高亮标记
      .replace(/\\u003c[^>]*?\\u003e/g, "")
      .replace(/\\(.)/g, "$1")
      .trim();
    if (t) titles.push({ text: t, pos: tm.index });
  }

  // ② 只取 JSON 字段里的配图（不含页面 <img> 标签）
  const imgRe = /"(?:image_url|large_image_url|middle_image_url)":"(https:\/\/p\d+-sign\.toutiaoimg\.com\/[^"]+)"/g;
  let im;
  while ((im = imgRe.exec(html)) !== null) {
    const u = im[1].replace(/\\u002F/g, "/");
    if (seen.has(u)) continue;
    seen.add(u);
    const pos = im.index;
    // 取距离最近的标题（可能在图前也可能在图后——实测头条是「标题→配图」顺序，图在图后 250~800 字符）
    let nearest = null;
    let bestDist = Infinity;
    for (const t of titles) {
      const d = Math.abs(t.pos - pos);
      if (d < bestDist) {
        bestDist = d;
        nearest = t;
      }
    }
    // 距离过远（>8000 字符）说明不属于同一结果块，配图不可信，丢掉
    if (!nearest || bestDist > 8000) continue;
    pairs.push({ url: u, title: nearest.text, source: "新闻-头条" });
  }
  return pairs;
}

// 新闻正文挖图：搜狗新闻 + 头条搜索
// 头条每次约 3 篇文章配图，须靠翻页（offset）累积到目标张数
export async function newsCandidates(query, { retries = 3, pages = [0, 10, 20] } = {}) {
  const out = [];
  const seen = new Set();
  const enc = encodeURIComponent(query);

  // 搜狗新闻（老版正文 HTML 提取，保留作为兜底）
  const sg = await fetchText(`https://news.sogou.com/news?query=${enc}&mode=sort`, "https://news.sogou.com/");
  for (const u of extractNewsImages(sg)) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, title: query, source: "新闻-搜狗", referer: "https://news.sogou.com/" });
  }

  // 头条搜索：翻页 + 重试合并（接口偶发返回不含图，多请求几次提高命中）
  for (const offset of pages) {
    for (let t = 0; t < retries; t++) {
      const url = `https://so.toutiao.com/search?dvpf=pc&keyword=${enc}${offset ? `&offset=${offset}` : ""}`;
      const tt = await fetchText(url, "https://so.toutiao.com/");
      for (const p of extractToutiaoPairs(tt)) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        out.push({ ...p, referer: "https://so.toutiao.com/" });
      }
      await sleep(400); // 头条控速防封
      if (out.length >= 40) break; // 够用即停，别把接口打爆
    }
    if (out.length >= 40) break;
  }

  return out;
}
