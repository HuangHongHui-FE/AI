// find_imgs_tt_20260904.js — 头条(so.toutiao)搜索抓中文自媒体配图，供选"国内真实感"夫妻冷战图
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// find_imgs_tt.js — 头条(so.toutiao)中文自媒体图源，搜情感/婚姻/真人真事配图
// 用法: node find_imgs_tt.js "<文章目录名前缀>" "<关键词1|关键词2|...>" [目标张数=18]
//   例: node find_imgs_tt.js "01-我从不在吵架后先开口" "夫妻冷战 卧室|中年夫妻 吵架|婚姻 冷战 不说话"
// 输出: cache/cand/tt_<目录前缀>/ 下候选 + cache/preview/tt_<目录前缀>/ 下预览，供人工挑
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1';

const ART_DIR = process.argv[2] || '01-我从不在吵架后先开口除非对方说了这句话';
const KWS = (process.argv[3] || '夫妻冷战 卧室').split('|');
const TARGET = parseInt(process.argv[4], 10) || 18;

// 第5个参数可选：直接指定候选图输出目录（给人工筛图用），不传则仍走 cache/cand
const OUT_DIR = process.argv[5];
const CAND_ROOT = OUT_DIR || '/Users/zcy1/code_self/AI/project/wechat/cache/cand/' + ART_DIR.replace(/[\/\\ ]/g, '_').slice(0, 40) + '_tt';
const PREV_ROOT = '/Users/zcy1/code_self/AI/project/wechat/cache/preview/' + ART_DIR.replace(/[\/\\ ]/g, '_').slice(0, 40) + '_tt';

function httpGet(url, headers) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise(resolve => {
    const r = lib.get(url, { headers, timeout: 15000 }, res => {
      const next = rr => { const c=[]; rr.on('data',x=>c.push(x)); rr.on('end',()=>resolve(Buffer.concat(c))); rr.on('error',()=>resolve(Buffer.alloc(0))); };
      if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        const l2 = loc.startsWith('https') ? https : http;
        l2.get(loc, { headers, timeout: 15000 }, next).on('error', () => resolve(Buffer.alloc(0)));
      } else next(res);
    });
    r.on('timeout', () => { r.destroy(); resolve(Buffer.alloc(0)); });
    r.on('error', () => resolve(Buffer.alloc(0)));
  });
}

// 抓头条搜索，提取国内图床 URL（byteimg/toutiaoimg），排除头像/图标/纯头像图
async function toutiaoSearch(kw) {
  const urls = [];
  for (let t = 0; t < 3; t++) { // 重试：部分请求不返全量
    const buf = await httpGet('https://so.toutiao.com/search?dvpf=pc&keyword=' + encodeURIComponent(kw), { 'User-Agent': UA_M, Referer: 'https://so.toutiao.com/' });
    const html = buf.toString();
    const re = /https?:\/\/[a-z0-9.-]+\.(?:toutiaoimg|byteimg)\.com\/[^"'\s<>\\]+/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[0].replace(/&amp;/g, '&');
      if (urls.includes(u)) continue;
      // 头像/小图标/表情弃：300x300、avatar、motor-img、crop-center:.*:(36|48|60|80|100|120)...
      if (/avatar|motor-img|~crop-center|300x300|\/img\//i.test(u)) continue;
      if (/~tplv-.*-\d+x\d+\./i.test(u) && !/crop-center:\d{3,}/.test(u)) continue; // 过小缩略
      urls.push(u);
    }
    if (urls.length > 0) break;
  }
  return urls;
}

function downloadImg(url, filepath) {
  return httpGet(url, { 'User-Agent': UA_M, Referer: 'https://so.toutiao.com/' }).then(buf => {
    if (buf.length > 20000) { fs.writeFileSync(filepath, buf); return buf.length; }
    return 0;
  });
}

async function main() {
  const pkgRoot = '/Users/zcy1/code_self/AI/project/wechat/文章包';
  const blacklist = new Set();
  for (const d of fs.readdirSync(pkgRoot).filter(x => /^\d{8}$/.test(x))) {
    const f = path.join(pkgRoot, d, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/https?:\/\/[^\s,]+/g) || [];
    m.forEach(u => blacklist.add(u.replace(/"$/, '')));
  }
  console.log(`黑名单 ${blacklist.size}`);

  const candDir = CAND_ROOT;
  if (fs.existsSync(candDir)) fs.rmSync(candDir, { recursive: true, force: true });
  fs.mkdirSync(candDir, { recursive: true });

  const seen = new Set();
  const urlList = [];
  for (const kw of KWS) {
    const us = await toutiaoSearch(kw);
    for (const u of us) { if (!seen.has(u)) { seen.add(u); urlList.push(u); } }
    console.log(`「${kw}」→ ${us.length} 条(累计 ${urlList.length})`);
    await new Promise(r => setTimeout(r, 350)); // 控速
  }
  console.log(`总候选: ${urlList.length}`);

  const cands = [];
  let tried = 0;
  for (const u of urlList) {
    if (cands.length >= TARGET) break;
    if (tried++ > 240) break;
    if (blacklist.has(u)) continue;
    const fp = path.join(candDir, `cand_${cands.length}.jpg`);
    const size = await downloadImg(u, fp);
    if (size) { cands.push({ url: u, size, idx: cands.length }); console.log(`  ✅ #${cands.length - 1} ${(size/1024).toFixed(0)}KB`); }
    else fs.existsSync(fp) && fs.unlinkSync(fp);
  }
  console.log(`成功下载 ${cands.length} 张`);

  // 出预览到 PREV_ROOT
  // 指定 OUT_DIR 时跳过预览（候选图直接给人筛）
  const py = OUT_DIR ? { stdout: '', stderr: '' } : spawnSync('python3', ['-c', `
import os, glob
from PIL import Image
prevd = '${PREV_ROOT}'
os.makedirs(prevd, exist_ok=True)
for f in glob.glob(os.path.join('${CAND_ROOT}', 'cand_*.jpg')):
    idx = os.path.basename(f)[5:-4]
    try:
        im = Image.open(f).convert('RGB')
        w = 480; h = int(im.height*w/im.width)
        im.resize((w,h)).save(os.path.join(prevd, 'prev_'+idx+'.jpg'), quality=80)
    except Exception as e: print('坏图', os.path.basename(f)); os.remove(f)
`], { encoding: 'utf8' });
  console.log((py.stdout || '') + (py.stderr || ''));
  console.log(`\n✅ 头条图下载完成, 预览: ${PREV_ROOT}/`);
}
main().catch(e => { console.error(e); process.exit(1); });
