// download_imgs_20260718.js — 4篇批量配图下载（搜狗图片，全局黑名单去重）
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260718';
const CAND_ROOT = '/Users/zcy1/code_self/AI/project/wechat/cache/cand';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 每篇关键词，贴情节、不撞主题
const ARTICLES = [
  { dir: '01-我把老公微信备注从昵称改回他全名那天',
    kws: ['手机 微信 通讯录 夜晚', '床边 手机 屏幕 黑暗', '夫妻 客厅 沙发 夜晚 冷战', '手机 微信 备注 截图', '夫妻 背对背 床 黑暗', '客厅 牛奶 杯子 早晨'] },
  { dir: '02-老公开始每晚悄悄进来给我盖被子',
    kws: ['床边 地垫 脚印 夜晚', '被子 掖被角 卧室 暖', '卧室 床 夜晚 灯光', '夫妻 分房 单人床 客房', '床边 弯腰 盖被子', '卧室 月光 安静 夜'] },
  { dir: '03-我替离职同事删掉了他没发出去的那封邮件',
    kws: ['办公室 电脑 屏幕 邮件', '工位 抽屉 文件 旧', '写字楼 工位 黄昏 空', '电脑 草稿 邮箱 屏幕', '办公桌 茶杯 凉茶', '办公室 走廊 空 安静'] },
  { dir: '04-我清空了购物车里所有等以后再买的东西',
    kws: ['手机 购物车 界面 截图', '裙子 衣架 s码 商店', '茶具 茶杯 桌面 静物', '金饰 坠子 吊坠 首饰', '购物车 清空 手机 屏幕', '衣架 空衣橱 安静'] },
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

// 给单篇选 cover+img1~3：按size排序，域名去重，凑足4张
async function pickForArticle(art, blacklist) {
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
    if (tried++ > 140) break;
    const fp = path.join(candDir, `cand_${cands.length}.jpg`);
    const size = await downloadImg(u, fp);
    if (size) { cands.push({ url: u, size, domain: domainOf(u), idx: cands.length }); console.log(`  ✅ cand_${cands.length-1} ${(size/1024).toFixed(0)}KB ${u.substring(0,55)}`); }
    else fs.existsSync(fp) && fs.unlinkSync(fp);
  }
  if (cands.length < 4) { console.log(`  ❌ 候选不足4张(${cands.length})`); return null; }
  const sorted = [...cands].sort((a,b) => b.size - a.size);
  const cover = sorted[0];
  const rest = sorted.slice(1);
  const picks = [cover];
  const usedDom = new Set([cover.domain]);
  for (const c of rest) { if (picks.length>=4) break; if (!usedDom.has(c.domain)) { picks.push(c); usedDom.add(c.domain); } }
  for (const c of rest) { if (picks.length>=4) break; if (!picks.includes(c)) picks.push(c); }
  return picks;
}

async function main() {
  const pkgRoot = '/Users/zcy1/code_self/AI/project/wechat/文章包';
  const blacklist = new Set();
  for (const d of fs.readdirSync(pkgRoot).filter(x => /^\d{8}$/.test(x) && x !== '20260718')) {
    const f = path.join(pkgRoot, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || [];
    m.forEach(u => blacklist.add(u.replace(/"$/,'')));
  }
  console.log(`全局黑名单 URL 数: ${blacklist.size}`);

  let allPickedUrls = [];
  for (const art of ARTICLES) {
    const picks = await pickForArticle(art, blacklist);
    if (!picks) { console.log(`跳过 ${art.dir}`); continue; }
    const artDir = path.join(BATCH_DIR, art.dir);
    const names = ['cover.jpg','img1.jpg','img2.jpg','img3.jpg'];
    picks.forEach((c, i) => {
      fs.copyFileSync(path.join(CAND_ROOT, art.dir, `cand_${c.idx}.jpg`), path.join(artDir, names[i]));
      allPickedUrls.push(`${names[i].split('.')[0]}=${c.url}`);
      console.log(`  → ${names[i]} ← cand_${c.idx} (${(c.size/1024).toFixed(0)}KB, ${c.domain})`);
    });
  }
  const usedPath = path.join(BATCH_DIR, 'used_images.txt');
  fs.writeFileSync(usedPath, `0718 batch: ${allPickedUrls.join(', ')}\n`);
  console.log('\n✅ 4篇配图全部完成，已写 used_images.txt');
}
main().catch(e => { console.error(e); process.exit(1); });
