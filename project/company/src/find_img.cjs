#!/usr/bin/env node
// 图片下载：支持两种模式
//   必应（默认）：node src/find_img.cjs "关键词" "输出路径.jpg"
//   新闻源（--news）：node src/find_img.cjs --news "热点原词" "输出路径.jpg"
//     抓搜狗新闻正文 HTML，提取 sogoucdn 事件配图（天然带上下文，强相关），过滤小 logo；
//     全失败回退必应 async 搜原词。
const https = require('https');
const http = require('http');
const fs = require('fs');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1';

// 解析参数：--news 可选
let newsMode = false;
let args = process.argv.slice(2);
if (args[0] === '--news') {
  newsMode = true;
  args = args.slice(1);
}
const query = encodeURIComponent(args[0]);
const outPath = args[1];

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
    if (ok) { console.log(`OK(新闻) ${u.slice(0, 70)} -> ${path}`); return true; }
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
    if (ok) { console.log(`OK ${u.slice(0, 70)} -> ${path}`); return true; }
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
