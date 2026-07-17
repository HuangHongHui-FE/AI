// download_imgs_20260716.js — skill06 方案0：搜狗搜图 + URL去重 + 自动挑选(大文件优先+源多样)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260716';
const CAND_ROOT = '/Users/zcy1/code_self/AI/project/wechat/cache/cand';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const arts = [
  { dir: '01-老公把家里WiFi密码改成了我们认识那天的日期', kws: ['客厅 沙发 手机 夜灯', '卧室 枕头 深夜 手机屏', '厨房 牛奶杯 烟火气'] },
  { dir: '02-我和老公约定每天说一句真话坚持到第七天差点离婚', kws: ['卧室 床头 夫妻 深夜', '客厅 两杯水 沙发', '早晨 豆浆 阳光'] },
  { dir: '03-公司让我整理那个刚被裁同事的工位', kws: ['办公室 空工位 椅子', '办公桌 抽屉 文件', '茶水间 保温杯 离职'] },
  { dir: '04-我决定连续一个月每天扔一件东西', kws: ['旧物 抽屉 整理', '铁盒 旧信 纸张', '客厅 地面 旧衣服'] },
];

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
    r.on('timeout', () => { r.destroy(); resolve(Buffer.alloc(0)); }); // 超时强制销毁，避免hang
    r.on('error', () => resolve(Buffer.alloc(0)));
  });
}

// 从搜狗图片搜索 HTML 提取 picUrl
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
  // 全局黑名单（跨天去重）
  const pkgRoot = '/Users/zcy1/code_self/AI/project/wechat/文章包';
  const blacklist = new Set();
  for (const d of fs.readdirSync(pkgRoot).filter(x => /^\d{8}$/.test(x))) {
    const f = path.join(pkgRoot, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || [];
    m.forEach(u => blacklist.add(u.replace(/"$/,'')));
  }
  console.log(`全局黑名单 URL 数: ${blacklist.size}`);

  const usedLines = [];
  for (const art of arts) {
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
      if (tried++ > 80) break;
      const fp = path.join(candDir, `cand_${cands.length}.jpg`);
      const size = await downloadImg(u, fp);
      if (size) { cands.push({ url: u, size, domain: domainOf(u), idx: cands.length }); console.log(`  ✅ cand_${cands.length-1} ${(size/1024).toFixed(0)}KB ${u.substring(0,55)}`); }
      else fs.existsSync(fp) && fs.unlinkSync(fp);
    }
    if (cands.length < 4) { console.log(`  ❌ 候选不足4张(${cands.length})，需补搜`); continue; }
    // 大文件优先做封面，再按域名多样化挑其余
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
      blacklist.add(c.url); // 当天后续文章也去重
      console.log(`  → ${names[i]} ← cand_${c.idx} (${(c.size/1024).toFixed(0)}KB, ${c.domain})`);
    });
    usedLines.push(`${art.dir}: ${pickedUrls.join(', ')}`);
  }
  fs.writeFileSync(path.join(BATCH_DIR, 'used_images.txt'), usedLines.join('\n') + '\n');
  console.log('\n✅ 全部完成，used_images.txt 已写');
}
main().catch(e => { console.error(e); process.exit(1); });
