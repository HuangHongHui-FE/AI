#!/usr/bin/env node
// 图片下载：支持批量 + 单张两种模式
//   批量（--batch）：node src/find_img.cjs --batch <主体词> <事件词> <输出目录> [目标张数=20]
//     新闻正文挖图（保新，优先）→ 必应/360 图库补足（保量）→ 下 ≥目标张数到输出目录 + manifest.md
//     关键词须用热点整体（主体+事件），杜绝侧写旧图；真实格式按文件头 sniff 转 JPEG 防 40137
//   必应（默认）：node src/find_img.cjs "关键词" "输出路径.jpg"
//   新闻源（--news）：node src/find_img.cjs --news "热点原词" "输出路径.jpg"
//     抓搜狗新闻正文 HTML，提取 sogoucdn 事件配图（天然带上下文，强相关），过滤小 logo；
//     全失败回退必应 async 搜原词。
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1';

// 解析参数：--news / --wide / --batch 可选
let newsMode = false;
let wideMode = false;
let batchMode = false;
let batchSubject = '';
let batchEvent = '';
let batchOutDir = '';
let batchTarget = 20;
let args = process.argv.slice(2);

// 批量模式独立入口：解析后立即跑 runBatch 并 exit，不进入单张流程
if (args[0] === '--batch') {
  batchMode = true;
  args = args.slice(1);
  batchSubject = args[0] || '';
  batchEvent = args[1] || '';
  batchOutDir = args[2] || '';
  if (args[3]) batchTarget = parseInt(args[3], 10) || 20;
  if (!batchSubject || !batchOutDir) {
    console.error('用法: node src/find_img.cjs --batch <主体词> <事件词> <输出目录> [目标张数=20]');
    process.exit(1);
  }
  runBatch().then(() => process.exit(0)).catch((e) => { console.error('批量找图失败:', e.message); process.exit(1); });
}

// 单张模式参数
if (args[0] === '--news') {
  newsMode = true;
  args = args.slice(1);
}
if (args[0] === '--wide') {
  wideMode = true; // 封面头图用：跳过比例 <1.6 的窄图，保主体完整（封面固定裁 900x383/2.35:1）
  args = args.slice(1);
}
const query = encodeURIComponent(args[0]);
// 命令行漏写引号时（--query 代言 商业价值）outPath 会拼成无扩展名的中文串，兜底补 .jpg 防止根目录堆积残留图
const outPath = /\.[a-z]{3,4}$/i.test(args[1] || '') ? args[1] : `${args[1]}.jpg`;
// 宽图门：封面用图须宽/高>=1.6，否则 2.35:1 硬裁会切掉上下 40%+ 主体
const WIDE_MIN = 1.6;
async function isWideEnough(path) {
  try {
    const { width, height } = await sharp(path).metadata();
    return width / height >= WIDE_MIN;
  } catch {
    return false;
  }
}

function fetch(url, referer) {
  return new Promise((res, rej) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': UA, Referer: referer || 'https://cn.bing.com/' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return fetch(r.headers.location, referer).then(res, rej);
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

function download(url, path, referer) {
  return new Promise((res) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA, Referer: referer || 'https://cn.bing.com/' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return download(r.headers.location, path, referer).then(res);
      const ct = r.headers['content-type'] || '';
      if (!ct.includes('image')) { r.resume(); return res(false); }
      const ws = fs.createWriteStream(path);
      r.pipe(ws);
      ws.on('finish', () => { const sz = fs.statSync(path).size; res(sz > 8000); });
      ws.on('error', () => res(false));
    }).on('error', () => res(false));
    req.setTimeout(15000, () => { req.destroy(); res(false); });
  });
}

// 搜狗新闻配图：抓 news.sogou.com 正文 HTML，提 sogoucdn 图，过滤小 logo，按尺寸优先
async function trySogouNews(enc, path) {
  let html;
  try {
    html = await fetch(`https://news.sogou.com/news?query=${enc}&mode=sort`, 'https://news.sogou.com/');
  } catch {
    return false;
  }
  // 提所有 sogoucdn 图 URL
  const urls = [];
  const re = /https?:\/\/img\d+\.sogoucdn\.com[^"'\s<>]+/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[0].replace(/&amp;/g, '&');
    if (urls.includes(u)) continue;
    // 过滤小 logo / 图标（32x32、qb-logo、png icon）
    if (/\/w\/32\/|\/h\/32\/|qb-logo|\.png/i.test(u)) continue;
    urls.push(u);
  }
  // 按尺寸优先：宽越大越靠前
  urls.sort((a, b) => {
    const wa = /\/w\/(\d+)\//.exec(a)?.[1] || 0;
    const wb = /\/w\/(\d+)\//.exec(b)?.[1] || 0;
    return wb - wa;
  });
  for (const u of urls) {
    const ok = await download(u, path, 'https://pic.sogou.com/');
    if (ok) {
      if (wideMode && !(await isWideEnough(path))) { fs.unlinkSync(path); console.log(`skip窄图 ${u.slice(0, 70)}`); continue; }
      console.log(`OK(新闻) ${u.slice(0, 70)} -> ${path}`); return true;
    }
    else console.log(`fail ${u.slice(0, 70)}`);
  }
  return false;
}

// 必应图片 async：提取 murl（HTML 实体编码），逐张试下
async function tryBing(enc, path) {
  const html = await fetch(`https://cn.bing.com/images/async?q=${enc}&first=1&count=35&form=IRFLTR`, 'https://cn.bing.com/');
  const urls = [];
  const re = /murl&quot;:&quot;([^&]+?)&quot;/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/&amp;/g, '&');
    if (!urls.includes(u)) urls.push(u);
  }
  for (const u of urls) {
    const ok = await download(u, path);
    if (ok) {
      if (wideMode && !(await isWideEnough(path))) { fs.unlinkSync(path); console.log(`skip窄图 ${u.slice(0, 70)}`); continue; }
      console.log(`OK ${u.slice(0, 70)} -> ${path}`); return true;
    }
    else console.log(`fail ${u.slice(0, 70)}`);
  }
  return false;
}

(async () => {
  let ok = false;
  if (newsMode) ok = await trySogouNews(query, outPath);
  if (!ok) ok = await tryBing(query, outPath);
  if (!ok) { console.error('NO IMAGE'); process.exit(1); }
})();

// ================= 批量模式（--batch）=================
// 新闻正文挖图（保新优先）：抓搜狗新闻 + 头条搜索 HTML，提取当日新闻正文配图
function extractNewsImages(html, domains) {
  const urls = [];
  const seen = new Set();
  // ① sogoucdn 缩略图 URL：从 url= 参数解出原图（当日新闻正文配图真实地址）
  const sogouRe = /https?:\/\/img\d+\.sogoucdn\.com\/v2\/thumb[^"'\s<>]*/g;
  let m;
  while ((m = sogouRe.exec(html)) !== null) {
    const u = m[0].replace(/&amp;/g, '&');
    // 过滤小 logo（w/32/h/32）与缩略图（w/218 之类），收大图
    if (/\/w\/(32|40|48|64|218|160)\//i.test(u)) continue;
    const real = decodeURIComponent((u.match(/[?&]url=([^&]+)/) || [])[1] || '');
    if (real && !seen.has(real)) { seen.add(real); urls.push(real); }
  }
  // ② 直接以图片扩展名结尾的 URL（sina/gtimg/网易等新闻图床）
  const extRe = /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  while ((m = extRe.exec(html)) !== null) {
    const u = m[0].replace(/&amp;/g, '&');
    if (!domains.some((d) => u.includes(d))) continue;
    if (/logo|avatar|banner|qrcode|icon|\.gif|w\/32\/|h\/32\//i.test(u)) continue;
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

// 真实格式 sniff：按文件头识别 jpg/png/webp，返回扩展名；不是图返 null
function sniffFormat(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  return null;
}

// 下载候选图到临时文件，sniff 真实格式转标准 JPEG，返回 {path, w, h} 或 null
async function downloadAsJpeg(url, tmpPath, referer) {
  if (!/^https?:\/\//i.test(url)) return null; // 非法 URL 直接弃
  let ok;
  try {
    ok = await download(url, tmpPath, referer);
  } catch { return null; }
  if (!ok) return null;
  let buf;
  try { buf = fs.readFileSync(tmpPath); } catch { return null; }
  if (buf.length < 30000) { fs.unlinkSync(tmpPath); return null; } // <30KB 缩略图弃
  const fmt = sniffFormat(buf);
  if (!fmt) { fs.unlinkSync(tmpPath); return null; }
  try {
    const meta = await sharp(tmpPath).metadata();
    if (!meta.width || !meta.height) { fs.unlinkSync(tmpPath); return null; }
    // 统一转标准 JPEG（PNG/WebP 假 jpg 会被微信 40137 拒）
    if (fmt !== 'jpg' || true) {
      await sharp(tmpPath).jpeg({ quality: 85 }).toBuffer().then((b) => fs.writeFileSync(tmpPath, b));
    }
    return { path: tmpPath, w: meta.width, h: meta.height };
  } catch { fs.unlinkSync(tmpPath); return null; }
}

// 编号写目录：接续已有最大号，主图候选命名 001-主图.jpg
function nextIndex(outDir) {
  let max = 0;
  try {
    for (const f of fs.readdirSync(outDir)) {
      const m = /^(\d+)-/.exec(f);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {}
  return max + 1;
}

// 360 图片候选：json list[].img + title + width/height，强相关判标题含主体+事件
async function fetch360Candidates(enc, subject, event) {
  const out = [];
  try {
    const html = await fetch(`https://image.so.com/j?q=${enc}&src=tab_www&sn=0&pn=30`, 'https://image.so.com/');
    const data = JSON.parse(html);
    for (const it of data.list || []) {
      const title = (it.title || '') + ' ' + (it.desc || '');
      const strong = subject && event && title.includes(subject) && title.includes(event);
      out.push({ url: it.img || it.thumb, title, strong });
    }
  } catch {}
  return out;
}

// 必应 async 候选：murl/mediaurl 双正则 + 提取 t 标题字段做相关判断，支持 qft 时间过滤 + first 翻页
async function fetchBingCandidates(enc, qft, first = 1) {
  const out = [];
  try {
    const html = await fetch(`https://cn.bing.com/images/async?q=${enc}&first=${first}&count=35&form=IRFLTR${qft ? `&qft=${qft}` : ''}`, 'https://cn.bing.com/');
    // 每张图：murl 图URL + 后续 t 标题字段
    const re = /murl&quot;:&quot;([^&"']+?)&quot;.*?&quot;t&quot;:&quot;([^&"']*?)&quot;/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/&amp;/g, '&');
      const t = m[2].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
      if (/\.(jpg|jpeg|png|webp)/i.test(u) && !out.some((o) => o.url === u)) out.push({ url: u, title: t, strong: false });
    }
  } catch {}
  return out;
}

// 搜狗图库图片：抓 pic.sogou.com/pics 普通页 HTML，提取 "picUrl" 原图直链（2026-08-29 实测可用）
async function fetchSogouPics(enc, subject, event) {
  const out = [];
  try {
    const html = await fetch(`https://pic.sogou.com/pics?query=${enc}&mode=1`, 'https://pic.sogou.com/');
    // picUrl 是原图直链（含 / 转义），thumbUrl 是缩略图
    const re = /"picUrl":"([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/\\u002F/g, '/').replace(/\\"/g, '"');
      if (!/^https?:\/\//i.test(u)) continue;
      if (/\.(jpg|jpeg|png|webp)/i.test(u) && !out.some((o) => o.url === u)) {
        const strong = subject && event && u.includes(encodeURIComponent(subject));
        out.push({ url: u, title: '搜狗图库', strong });
      }
    }
  } catch {}
  return out;
}

// URL 时间戳新鲜度：返回距今月数（近 days 天=0，旧=正数，无法判断=null）
function urlFresh(u, days = 30) {
  const now = new Date();
  let m = u.match(/\/(20\d{2})(\d{2})(\d{2})\//) // 8位连续日期 /20180527/
    || u.match(/\/(20\d{2})\/(\d{2})\//)
    || u.match(/\/(20\d{2})\/(\d{2})\.[a-z]+\??/)
    || u.match(/(20\d{2})-(\d{2})/)
    || u.match(/sinakd(20\d{2})(\d{2})/)
    || u.match(/(20\d{2})_(\d{2})/)
    || u.match(/\/(20\d{2})(\d{2})\//); // 6位年月 /202602/
  if (!m) {
    // 兜底：URL 里出现的 20xx 年份（如 ifeng 的 /2024_44/）距今 >3 月也判旧图，防月份非法时漏放
    const yOnly = u.match(/\/(20\d{2})[_/]/);
    if (yOnly && now.getFullYear() - +yOnly[1] >= 1) return 12;
    return null;
  }
  const y = +m[1], mo = +m[2];
  if (mo < 1 || mo > 12) {
    // 月份非法（如周数 44），退回按年份估算
    return (now.getFullYear() - y) * 12;
  }
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
}

// 相关判断：title 或 url 含实体关键词即相关。拆出 ≥2 个实体词（如 IG 战胜 TT→[IG,TT]）时须全含（对阵双方都在才是这场），
// 否则含任一个即可。防「TT 车队/铁三车」这类单实体误伤。
function isRelevant(title, url, kws) {
  if (!kws || !kws.length) return true;
  const lower = (title || '') + ' ' + decodeURIComponent(url || '');
  const hits = kws.filter((k) => k.length >= 1 && lower.includes(k));
  if (kws.length >= 2) return hits.length === kws.length; // 多实体须全含
  return hits.length >= 1;
}

// 批量主流程
async function runBatch() {
  fs.mkdirSync(batchOutDir, { recursive: true });
  const subject = batchSubject;
  const event = batchEvent;
  // 主体词拆实体关键词（去常见动词/介词），用于相关判断：如「IG战胜TT」→[IG,TT]，「西藏泥石流」→[西藏,泥石流]
  const subjectKeywords = subject.split(/[战胜|击败|击败了|迎战|对决|击败|超越|拿下|晋级|失联|遇难|救援|灾|事故|事件|曝光|回应|最新|进行|相关|部署|调查]+/).map((s) => s.trim()).filter((s) => s.length >= 1);
  const cands = []; // {url, title, strong, source}
  const seen = new Set();

  // ① 图库候选，必应时间过滤优先（保新）：近7天 + 近24h 双查询，URL 时间戳强过滤
  //    多渠道：必应（时间过滤）+ 搜狗图库 + 360，尽力凑够 20
  const libQueries = [`${subject} ${event}`, subject, `${subject} ${event} 现场`, `${subject} ${event} 战报`, `${subject} 最新`, `${subject} ${event} 比赛`];
  const bingTimeFilters = ['filterui:age-lt604800', 'filterui:age-lt86400']; // 近7天 / 近24h
  for (const q of libQueries) {
    const enc = encodeURIComponent(q);
    // 必应带时间过滤（最新优先），翻 5 页凑量
    for (const tf of bingTimeFilters) {
      for (const first of [1, 36, 71, 106, 141]) {
        try {
          const bing = await fetchBingCandidates(enc, `+${tf}`, first);
          for (const c of bing) {
            if (seen.has(c.url)) continue;
            if (/sign\.toutiaoimg\.com|avatar|qb-profile|logo|qrcode|xiaochengxu|Upload\/.*\.png$/i.test(c.url)) continue; // 签名图/头像/站点logo弃
            // 强相关判断：标题或 URL 含任一实体关键词才算相关（必应混入无关图的关键过滤）
            const strong = isRelevant(c.title, c.url, subjectKeywords);
            const age = urlFresh(c.url);
            if (age !== null && age > 3) continue; // URL 时间戳 >3月前的旧图弃（保新，可调）
            seen.add(c.url); cands.push({ url: c.url, title: c.title || q, strong, source: '图库-必应' });
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 300)); // 控速
      }
    }
    // 搜狗图库（新增，2026-08-29 打通）
    try {
      const sgp = await fetchSogouPics(enc, subject, event);
      for (const c of sgp) {
        if (seen.has(c.url)) continue;
        if (/sign\.toutiaoimg\.com|avatar|qb-profile|logo|qrcode|xiaochengxu/i.test(c.url)) continue;
        const age = urlFresh(c.url);
        if (age !== null && age > 3) continue;
        seen.add(c.url); cands.push({ url: c.url, title: c.title || q, strong: c.strong, source: '图库-搜狗' });
      }
    } catch {}
    // 360 补足（保量，标题含主体+事件判强相关）
    try {
      const s360 = await fetch360Candidates(enc, subject, event);
      for (const c of s360) {
        if (seen.has(c.url)) continue;
        if (/sign\.toutiaoimg\.com|avatar|qb-profile|logo|qrcode|xiaochengxu/i.test(c.url)) continue;
        const age = urlFresh(c.url);
        if (age !== null && age > 3) continue; // URL 时间戳 >3月前的旧图弃（保新，可调）
        seen.add(c.url); cands.push({ url: c.url, title: c.title || q, strong: c.strong, source: '图库-360' });
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 450)); // 360 控速防封 IP
  }

  // ② 新闻正文挖图（保新补充）：搜狗新闻/头条新闻正文配图（多为缩略图，仅作内图补充）
  //    头条图床 byteimg/toutiaoimg 免签可下（2026-08-29 打通）；sign.toutiaoimg 403 需签名弃
  const newsDomains = ['sogoucdn', 'n.sinaimg.cn', 'k.sinaimg.cn', 'p9.itc.cn', 'p2.itc.cn', 'dingyue.ws.126.net', 'media.bjnews', 'imagecloud.thepaper', 'inews.gtimg', 'puui.qpic', 'byteimg', 'toutiaoimg'];
  for (const q of libQueries) {
    const enc = encodeURIComponent(q);
    try {
      const sg = await fetch(`https://news.sogou.com/news?query=${enc}&mode=sort`, 'https://news.sogou.com/');
      for (const u of extractNewsImages(sg, newsDomains)) {
        if (seen.has(u)) continue;
        if (/avatar|qb-profile|sign\.toutiaoimg\.com/.test(u)) continue; // 头像/签名图弃
        seen.add(u); cands.push({ url: u, title: q, strong: true, source: '新闻-搜狗' });
      }
    } catch {}
    // 头条搜索约 1/3 请求返全量含图，须重试 3 次合并去重
    for (let t = 0; t < 3; t++) {
      try {
        const tt = await fetch(`https://so.toutiao.com/search?dvpf=pc&keyword=${enc}`, 'https://so.toutiao.com/');
        for (const u of extractNewsImages(tt, newsDomains)) {
          if (seen.has(u)) continue;
          if (/avatar|qb-profile|sign\.toutiaoimg\.com/.test(u)) continue; // 头像/签名图弃
          seen.add(u); cands.push({ url: u, title: q, strong: true, source: '新闻-头条' });
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400)); // 头条控速防封
    }
  }

  // 强相关优先排序（新闻正文/标题含主体+事件 靠前），去重
  cands.sort((a, b) => (b.strong ? 1 : 0) - (a.strong ? 1 : 0));
  console.log(`候选总数: ${cands.length}（新闻正文保新 ${cands.filter((c) => c.source.startsWith('新闻')).length} 张）`);

  // ③ 批量下载到目录：分两轮，第一轮下强相关（多实体全含），不足目标再下 partial（含任一实体），最后补新闻图
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'findimg-'));
  const items = []; // {file, w, h, title, source}
  let idx = nextIndex(batchOutDir);
  let skippedNoDate = 0;

  // 分类候选：strong(全含) / partial(含任一实体) / news(新闻正文图，保新)
  const strongCands = [], partialCands = [], newsCands = [];
  for (const c of cands) {
    const isNews = c.source.startsWith('新闻');
    const fullMatch = subjectKeywords.length >= 2
      ? subjectKeywords.every((k) => k.length >= 1 && (c.title || '').includes(k))
      : isRelevant(c.title, c.url, subjectKeywords);
    if (isNews) newsCands.push(c);
    else if (c.strong || fullMatch) strongCands.push(c);
    else if (isRelevant(c.title, c.url, subjectKeywords)) partialCands.push(c);
    else skippedNoDate++;
  }
  console.log(`强相关 ${strongCands.length} · 部分相关 ${partialCands.length} · 新闻 ${newsCands.length}`);

  // 逐类下载直到凑够目标（顺序：强相关 → 部分相关 → 新闻）
  for (const bucket of [strongCands, partialCands, newsCands]) {
    for (const c of bucket) {
      if (items.length >= batchTarget) break;
      // 无日期戳的非新闻图库图弃（保新底线；头条/搜狗图库可能无日期戳但相关性高，放宽强相关）
      const isNews = c.source.startsWith('新闻');
      if (!isNews && urlFresh(c.url) === null && !c.strong) { skippedNoDate++; continue; }
      // Referer 按来源区分（头条图床须头条系 Referer，否则 403）
      let referer = 'https://cn.bing.com/';
      if (c.source.includes('头条')) referer = 'https://so.toutiao.com/';
      else if (c.source.includes('搜狗图库')) referer = 'https://pic.sogou.com/';
      else if (c.source.includes('搜狗') || c.source.includes('新闻')) referer = 'https://news.sogou.com/';
      const tmp = path.join(tmpDir, `cand-${idx}-${Math.random().toString(36).slice(2, 6)}.jpg`);
      const got = await downloadAsJpeg(c.url, tmp, referer);
      if (got) {
        const file = `${String(idx).padStart(3, '0')}.jpg`;
        const finalPath = path.join(batchOutDir, file);
        fs.renameSync(tmp, finalPath);
        items.push({ file, w: got.w, h: got.h, title: c.title || c.source, source: c.source });
        console.log(`✓ ${file} ${got.w}x${got.h} ${c.source} ${c.url.slice(0, 60)}`);
        idx++;
      }
    }
  }

  // ④ 主图命名：最宽（比例最大）一张固定为 001-主图.jpg（封面候选），其余重新编号 002.jpg、003.jpg...
  if (items.length > 0) {
    const widest = items.reduce((a, b) => (a.w / a.h > b.w / b.h ? a : b));
    // 全部先改临时名，避免目标名覆盖冲突（001→002 覆盖已有 002）
    const renames = []; // [{from, to}]
    const widestOld = widest.file;
    renames.push({ from: path.join(batchOutDir, widestOld), to: path.join(batchOutDir, '001-主图.jpg') });
    widest.file = '001-主图.jpg';
    const rest = items.filter((it) => it !== widest).sort((a, b) => a.file.localeCompare(b.file));
    let n = 2;
    for (const it of rest) {
      const target = `${String(n).padStart(3, '0')}.jpg`;
      if (it.file !== target) renames.push({ from: path.join(batchOutDir, it.file), to: path.join(batchOutDir, target) });
      it.file = target;
      n++;
    }
    // 第一步：全部改名到唯一临时名
    for (let i = 0; i < renames.length; i++) fs.renameSync(renames[i].from, `${renames[i].from}.tmp${i}`);
    // 第二步：临时名落地到目标名
    for (let i = 0; i < renames.length; i++) fs.renameSync(`${renames[i].from}.tmp${i}`, renames[i].to);
    items.sort((a, b) => a.file.localeCompare(b.file));
  }

  // ⑤ manifest.md
  if (items.length > 0) {
    const lines = ['# 候选图清单', '', `> 批量找图 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 主体「${subject}」· 事件「${event}」· 共 ${items.length} 张`, ''];
    for (const it of items) {
      const ratio = (it.w / it.h).toFixed(2);
      const use = it.file === '001-主图.jpg' ? '【封面主图】' : Number(ratio) >= 1.6 ? '可做封面/内图' : '内图';
      const title = it.title.slice(0, 40);
      lines.push(`- ${it.file} — ${it.w}x${it.h} ${it.source} ${use} ${title}`);
    }
    fs.writeFileSync(path.join(batchOutDir, 'manifest.md'), lines.join('\n') + '\n');
    console.log(`\n完成: ${items.length} 张 -> ${batchOutDir}`);
    console.log(`manifest: ${path.join(batchOutDir, 'manifest.md')}`);
    if (skippedNoDate > 0) console.log(`跳过无日期戳旧图 ${skippedNoDate} 张`);
  } else {
    console.log('未下到任何图');
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
