#!/usr/bin/env node
// 必应图片下载：cn.bing.com/images/async 提取 murl（HTML实体编码），逐张试下到指定路径，成功即退
// 用法：node src/find_img.js "关键词" "输出路径.jpg"
const https = require('https');
const http = require('http');
const fs = require('fs');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1';
const query = encodeURIComponent(process.argv[2]);
const outPath = process.argv[3];

function fetch(url) {
  return new Promise((res, rej) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': UA, Referer: 'https://cn.bing.com/' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return fetch(r.headers.location).then(res, rej);
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

function download(url, path) {
  return new Promise((res) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA, Referer: 'https://cn.bing.com/' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return download(r.headers.location, path).then(res);
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

(async () => {
  const html = await fetch(`https://cn.bing.com/images/async?q=${query}&first=1&count=35&form=IRFLTR`);
  const urls = [];
  const re = /murl&quot;:&quot;([^&]+?)&quot;/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/&amp;/g, '&');
    if (!urls.includes(u)) urls.push(u);
  }
  for (const u of urls) {
    const ok = await download(u, outPath);
    if (ok) { console.log(`OK ${u.slice(0, 70)} -> ${outPath}`); process.exit(0); }
    else console.log(`fail ${u.slice(0, 70)}`);
  }
  console.error('NO IMAGE'); process.exit(1);
})();
