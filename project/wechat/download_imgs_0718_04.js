// download_imgs_0718_04.js — 单独补搜第④篇配图（候选不足时用），扩展关键词
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260718';
const CAND_ROOT = '/Users/zcy1/code_self/AI/project/wechat/cache/cand';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const art = { dir: '04-我清空了购物车里所有等以后再买的东西',
  kws: ['购物车 清空 手机界面', '裙子 衣架 商店', '茶具 茶杯 静物 桌', '金饰 坠子 吊坠 首饰', '空 衣橱 衣架 安静', '手机 购物 app 截图', '礼物 盒子 未拆封', '旧物 收纳 整理 桌面', '手机屏幕 夜晚 手指', '购物袋 纸袋 桌面'] };

function httpGet(url, headers) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise(resolve => {
    const r = lib.get(url, { headers, timeout: 15000 }, res => {
      const next = rr => { const c=[]; rr.on('data',x=>c.push(x)); rr.on('end',()=>resolve(Buffer.concat(c))); rr.on('error',()=>resolve(Buffer.alloc(0))); };
      if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')?res.headers.location:new URL(res.headers.location,url).href;
        const l2 = loc.startsWith('https')?https:http;
        l2.get(loc,{headers,timeout:15000},next).on('error',()=>resolve(Buffer.alloc(0)));
      } else next(res);
    });
    r.on('timeout', () => { r.destroy(); resolve(Buffer.alloc(0)); });
    r.on('error', () => resolve(Buffer.alloc(0)));
  });
}

function sogouSearch(kw) {
  return httpGet('https://pic.sogou.com/pics?query='+encodeURIComponent(kw), { 'User-Agent':UA, 'Accept-Language':'zh-CN', Referer:'https://pic.sogou.com/' })
    .then(buf => {
      const html = buf.toString();
      const raw = html.match(/picUrl":"[^"]+"/g) || [];
      return [...new Set(raw.map(s => s.replace(/picUrl":"/,'').replace(/\\u002F/g,'/').replace(/\\u0026/g,'&')).filter(u=>/^https?:\/\//.test(u)))];
    });
}

function downloadImg(url, filepath) {
  const referer = /baidu/.test(url) ? 'https://image.baidu.com/' : /sina/.test(url) ? 'https://www.sina.com.cn/' : 'https://pic.sogou.com/';
  return httpGet(url, { 'User-Agent':UA, Referer:referer }).then(buf => {
    if (buf.length > 30000) { fs.writeFileSync(filepath, buf); return buf.length; }
    return 0;
  });
}

function domainOf(url) { try { return new URL(url).hostname; } catch { return 'x'; } }

async function main() {
  const pkgRoot = '/Users/zcy1/code_self/AI/project/wechat/文章包';
  const blacklist = new Set();
  for (const d of fs.readdirSync(pkgRoot).filter(x => /^\d{8}$/.test(x))) {
    const f = path.join(pkgRoot, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || [];
    m.forEach(u => blacklist.add(u.replace(/"$/,'')));
  }
  console.log(`全局黑名单 URL 数: ${blacklist.size}`);

  const candDir = path.join(CAND_ROOT, art.dir);
  if (fs.existsSync(candDir)) fs.rmSync(candDir, { recursive: true, force: true });
  fs.mkdirSync(candDir, { recursive: true });
  const urlSet = new Set();
  for (const kw of art.kws) (await sogouSearch(kw)).forEach(u => urlSet.add(u));
  const urls = [...urlSet].filter(u => !blacklist.has(u));
  console.log(`\n[${art.dir}] 候选URL(去重后): ${urls.length}`);
  const cands = [];
  let tried = 0;
  for (const u of urls) {
    if (cands.length >= 10) break;
    if (tried++ > 180) break;
    const fp = path.join(candDir, `cand_${cands.length}.jpg`);
    const size = await downloadImg(u, fp);
    if (size) { cands.push({ url: u, size, domain: domainOf(u), idx: cands.length }); console.log(`  ✅ cand_${cands.length-1} ${(size/1024).toFixed(0)}KB ${u.substring(0,55)}`); }
    else fs.existsSync(fp) && fs.unlinkSync(fp);
  }
  if (cands.length < 4) { console.log(`  ❌ 候选仍不足4张(${cands.length})`); process.exit(1); }
  const sorted = [...cands].sort((a,b) => b.size - a.size);
  const cover = sorted[0];
  const rest = sorted.slice(1);
  const picks = [cover];
  const usedDom = new Set([cover.domain]);
  for (const c of rest) { if (picks.length>=4) break; if (!usedDom.has(c.domain)) { picks.push(c); usedDom.add(c.domain); } }
  for (const c of rest) { if (picks.length>=4) break; if (!picks.includes(c)) picks.push(c); }
  const artDir = path.join(BATCH_DIR, art.dir);
  const names = ['cover.jpg','img1.jpg','img2.jpg','img3.jpg'];
  const pickedUrls = [];
  picks.forEach((c, i) => {
    fs.copyFileSync(path.join(candDir, `cand_${c.idx}.jpg`), path.join(artDir, names[i]));
    pickedUrls.push(`${names[i].split('.')[0]}=${c.url}`);
    console.log(`  → ${names[i]} ← cand_${c.idx} (${(c.size/1024).toFixed(0)}KB, ${c.domain})`);
  });
  const usedPath = path.join(BATCH_DIR, 'used_images.txt');
  let old = fs.existsSync(usedPath) ? fs.readFileSync(usedPath, 'utf8') : '';
  fs.writeFileSync(usedPath, old + `${art.dir}: ${pickedUrls.join(', ')}\n`);
  console.log('\n✅ 第④篇配图补搜完成，已追加 used_images.txt');
}
main().catch(e => { console.error(e); process.exit(1); });
