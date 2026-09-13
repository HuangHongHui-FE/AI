#!/usr/bin/env node
// fetch_cand.cjs — 生活场景类文章候选配图批量抓取（必应图库 + 搜狗图库 + 360）
// 用法: node tools/fetch_cand.cjs "<输出目录>" "<关键词1|关键词2|...>" [目标张数=20]
// 输出: 输出目录下 cand_N.jpg（统一 sniff 转标准 JPEG）+ manifest.json（原始URL/标题/来源，供去重与记录）
// 说明: 复用 wechat-img 的四渠道抓法；头条图源(so.toutiao)对生活场景词已跑偏，故不再走头条
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/zcy1/code_self/AI/project/wechat-img/node_modules/sharp');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1';
const OUT_DIR = process.argv[2];
const KWS = (process.argv[3] || '').split('|').filter(Boolean);
const TARGET = parseInt(process.argv[4], 10) || 20;
const PKG_ROOT = '/Users/zcy1/code_self/AI/project/wechat/文章包';
const MIN_W = 600;   // 最小宽度：小于此值的缩略图弃
const MIN_BYTES = 8000;
// 素材站/设计站域名黑名单：这类站出的是带水印样图，不可用于文章配图
const STOCK_RE = /699pic|nipic|nximg|pngsucai|588ku|huaban|zhitu|tukuppt|lovepik|pngtree|zcool|qiantucdn|ibaotu|redocn|ishare|sd\.xmu|photophoto|veer\.com|gettyimages|shutterstock|dreamstime|istockphoto|adobe|pixnet/i;
// 素材/设计图库类标题关键词：这类是分层素材或模板图，不是真实照片
const STOCK_TITLE_RE = /素材|设计图库|图库|PSD|分层|矢量|模板|壁纸|png图片|透明背景|免抠/i;

// 通用 GET 取文本（自动跟随一次重定向）
function fetchText(url, referer) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'zh-CN,zh;q=0.9' }, timeout: 15000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        const loc = r.headers.location.startsWith('http') ? r.headers.location : new URL(r.headers.location, url).href;
        return fetchText(loc, referer).then(resolve);
      }
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => resolve(Buffer.concat(c)));
      r.on('error', () => resolve(Buffer.alloc(0)));
    });
    req.on('timeout', () => { req.destroy(); resolve(Buffer.alloc(0)); });
    req.on('error', () => resolve(Buffer.alloc(0)));
  });
}

// 下载图片为 Buffer
function fetchBuf(url, referer) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA, Referer: referer, Accept: 'image/*,*/*' }, timeout: 15000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        const loc = r.headers.location.startsWith('http') ? r.headers.location : new URL(r.headers.location, url).href;
        return fetchBuf(loc, referer).then(resolve);
      }
      if (!(r.headers['content-type'] || '').includes('image')) { r.resume(); return resolve(Buffer.alloc(0)); }
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => resolve(Buffer.concat(c)));
      r.on('error', () => resolve(Buffer.alloc(0)));
    });
    req.on('timeout', () => { req.destroy(); resolve(Buffer.alloc(0)); });
    req.on('error', () => resolve(Buffer.alloc(0)));
  });
}

// 必应图库：async 接口，murl=图URL + t=标题
async function bingCands(q) {
  const out = [];
  for (const first of [1, 36, 71]) {
    const html = (await fetchText(`https://cn.bing.com/images/async?q=${encodeURIComponent(q)}&first=${first}&count=35&form=IRFLTR`, 'https://cn.bing.com/')).toString();
    const re = /murl&quot;:&quot;([^&"']+?)&quot;.*?&quot;t&quot;:&quot;([^&"']*?)&quot;/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[1].replace(/&amp;/g, '&');
      if (!/\.(jpg|jpeg|png|webp)/i.test(u)) continue;
      if (out.some(o => o.url === u)) continue;
      out.push({ url: u, title: m[2].replace(/\\\//g, '/'), source: '必应' });
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return out;
}

// 搜狗图库：picUrl 为原图直链
async function sogouCands(q) {
  const html = (await fetchText(`https://pic.sogou.com/pics?query=${encodeURIComponent(q)}&mode=1`, 'https://pic.sogou.com/')).toString();
  const out = [];
  const re = /"picUrl":"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/\\u002F/g, '/').replace(/\\"/g, '"');
    if (!/^https?:\/\//i.test(u) || !/\.(jpg|jpeg|png|webp)/i.test(u)) continue;
    if (out.some(o => o.url === u)) continue;
    out.push({ url: u, title: '搜狗图库', source: '搜狗' });
  }
  return out;
}

// 360 图库：image.so.com JSON 接口
async function qihooCands(q) {
  const raw = (await fetchText(`https://image.so.com/j?q=${encodeURIComponent(q)}&src=tab_www&sn=0&pn=30`, 'https://image.so.com/')).toString();
  const out = [];
  try {
    const data = JSON.parse(raw);
    for (const it of data.list || []) {
      const u = it.img || it.thumb;
      if (!u || out.some(o => o.url === u)) continue;
      out.push({ url: u, title: `${it.title || ''} ${it.desc || ''}`, source: '360' });
    }
  } catch {}
  return out;
}

// 读取历史已用图 URL 黑名单（跨全部文章包）
function loadBlacklist() {
  const set = new Set();
  for (const d of fs.readdirSync(PKG_ROOT).filter(x => /^\d{8}$/.test(x))) {
    const f = path.join(PKG_ROOT, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    (fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || []).forEach(u => set.add(u.replace(/"$/, '')));
  }
  return set;
}

// 主流程：多关键词抓候选 → 过滤黑名单 → 下载 → sniff 转 JPEG → 落盘 + manifest
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const blacklist = loadBlacklist();
  console.log(`黑名单 ${blacklist.size} 条`);

  const seen = new Set();
  const cands = [];
  for (const kw of KWS) {
    for (const fn of [bingCands, sogouCands, qihooCands]) {
      let list = [];
      try { list = await fn(kw); } catch (e) { /* 单渠道失败不阻塞 */ }
      for (const c of list) {
        if (seen.has(c.url) || blacklist.has(c.url)) continue;
        if (/avatar|qb-profile|logo|qrcode|xiaochengxu|sign\.toutiaoimg/i.test(c.url)) continue;
        if (STOCK_RE.test(c.url)) continue;   // 素材站样图弃
        if (STOCK_TITLE_RE.test(c.title || '')) continue;   // 分层素材/模板类标题弃
        seen.add(c.url); c.keyword = kw; cands.push(c);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`「${kw}」累计候选 ${cands.length}`);
  }

  const manifest = [];
  let idx = 0;
  for (const c of cands) {
    if (manifest.length >= TARGET) break;
    const buf = await fetchBuf(c.url, 'https://cn.bing.com/');
    if (buf.length < MIN_BYTES) continue;
    const tmp = path.join(OUT_DIR, `cand_${idx}.jpg`);
    try {
      const img = sharp(buf);
      const meta = await img.metadata();
      if (!meta.width || meta.width < MIN_W) continue;
      await img.jpeg({ quality: 85 }).toFile(tmp);   // 统一转标准 JPEG，防微信 40137
      manifest.push({ file: path.basename(tmp), url: c.url, title: c.title, source: c.source, keyword: c.keyword, w: meta.width, h: meta.height });
      console.log(`  ✅ ${path.basename(tmp)} ${meta.width}x${meta.height} [${c.source}]`);
      idx++;
    } catch { fs.existsSync(tmp) && fs.unlinkSync(tmp); }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ 完成 ${manifest.length} 张 → ${OUT_DIR}`);
}
main().catch(e => { console.error(e); process.exit(1); });
