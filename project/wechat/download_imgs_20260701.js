// download_imgs_20260701.js — skill06 方案0：搜狗搜图 + URL去重 + 自动挑选(大文件优先+源多样)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260701';
const CAND_ROOT = '/Users/zcy1/code_self/AI/project/wechat/cache/cand';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const arts = [
  { dir: '01-我在老公手机里翻到他给我存的表情包文件夹', kws: ['女人 沙发 看手机 深夜', '手机 聊天 截图'] },
  { dir: '02-吵完架我和老公必须一起吃顿火锅', kws: ['火锅 鸳鸯锅 沸腾', '夫妻 火锅店 就餐'] },
  { dir: '03-我把工位上的全家福收进了抽屉', kws: ['办公桌 工位 全家福相框', '办公室 绿植 工位'] },
  { dir: '04-我妈的朋友圈我三年没点过赞', kws: ['母女 手机 微信', '老人 手机 朋友圈'] },
];

function httpGet(url, headers) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise(resolve => {
    lib.get(url, { headers, timeout: 30000 }, res => {
      const next = r => { const c=[]; r.on('data',x=>c.push(x)); r.on('end',()=>resolve(Buffer.concat(c))); r.on('error',()=>resolve(Buffer.alloc(0))); };
      if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')?res.headers.location:new URL(res.headers.location,url).href;
        const l2 = loc.startsWith('https')?https:http;
        l2.get(loc,{headers,timeout:30000},next).on('error',()=>resolve(Buffer.alloc(0)));
      } else next(res);
    }).on('error',()=>resolve(Buffer.alloc(0)));
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
  // 加载全局黑名单（跨天去重）
  const pkgRoot = '/Users/zcy1/code_self/AI/project/wechat/文章包';
  const blacklist = new Set();
  for (const d of fs.readdirSync(pkgRoot).filter(x => /^\d{8}$/.test(x))) {
    const f = path.join(pkgRoot, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || [];
    m.forEach(u => blacklist.add(u));
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
      if (tried++ > 50) break;
      const fp = path.join(candDir, `cand_${cands.length}.jpg`);
      const size = await downloadImg(u, fp);
      if (size) { cands.push({ url: u, size, domain: domainOf(u), idx: cands.length }); console.log(`  ✅ cand_${cands.length-1} ${(size/1024).toFixed(0)}KB ${u.substring(0,55)}`); }
      else fs.existsSync(fp) && fs.unlinkSync(fp);
    }
    if (cands.length < 4) { console.log(`  ❌ 候选不足4张(${cands.length})，需补搜`); continue; }
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
