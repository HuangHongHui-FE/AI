// download_20260627.js — 下载 20260627 批次 4 篇文章配图（封面+3张文中图=16张）
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260627';
const BATCH_DIR = path.join(PACKAGE_ROOT, BATCH);
const BLACKLIST_FILE = path.join(PACKAGE_ROOT, 'image_blacklist.txt');

const blacklist = new Set(
  fs.readFileSync(BLACKLIST_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
);
const usedToday = new Set();

function assertNotUsed(id) {
  const s = String(id);
  if (blacklist.has(s)) throw new Error(`❌ photo ID ${id} 在历史黑名单中，禁止下载`);
  if (usedToday.has(s)) throw new Error(`❌ photo ID ${id} 本批次已用过，禁止重复下载`);
}

function downloadPexels(photoId, filepath, width = 900) {
  return new Promise((resolve) => {
    const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, (res) => {
      const handle = (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) {
            fs.writeFileSync(filepath, data);
            resolve({ id: photoId, size: data.length });
          } else {
            resolve(null);
          }
        });
      };
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, handle)
          .on('error', () => resolve(null));
      } else {
        handle(res);
      }
    }).on('error', () => resolve(null))
      .on('timeout', function() { this.destroy(); resolve(null); });
  });
}

const articles = {
  '01-我和老公分床睡第三十天': {
    cover: 9000100,
    images: [
      { id: 9000101, slot: 'img1', label: '次卧/枕头' },
      { id: 9000102, slot: 'img2', label: '客厅/夜晚' },
      { id: 9000103, slot: 'img3', label: '床/晨光' },
    ],
  },
  '02-35岁那年我主动申请降职': {
    cover: 9000200,
    images: [
      { id: 9000201, slot: 'img1', label: '会议室/咖啡' },
      { id: 9000202, slot: 'img2', label: '幼儿园/接孩子' },
      { id: 9000203, slot: 'img3', label: '电梯/下班' },
    ],
  },
  '03-我开始给五年后的自己写信': {
    cover: 9000300,
    images: [
      { id: 9000301, slot: 'img1', label: 'iPhone备忘录' },
      { id: 9000302, slot: 'img2', label: '信封/钢笔' },
      { id: 9000303, slot: 'img3', label: '抽屉/夜灯' },
    ],
  },
  '04-211毕业的表姐回县城当全职太太': {
    cover: 9000400,
    images: [
      { id: 9000401, slot: 'img1', label: '县城/厨房' },
      { id: 9000402, slot: 'img2', label: '凉菜/小桌' },
      { id: 9000403, slot: 'img3', label: '备忘录/档案' },
    ],
  },
};

async function main() {
  console.log('🔍 下载前预检（跨天 + 当天双重校验）...\n');
  for (const [dir, cfg] of Object.entries(articles)) {
    assertNotUsed(cfg.cover);
    usedToday.add(String(cfg.cover));
    for (const img of cfg.images) {
      assertNotUsed(img.id);
      usedToday.add(String(img.id));
    }
    console.log(`  ✅ ${dir} 全部 ID 通过校验`);
  }
  console.log(`\n本批共 ${usedToday.size} 个 ID，全部不在黑名单中。\n`);

  const logLines = [];
  for (const [dir, cfg] of Object.entries(articles)) {
    const artDir = path.join(BATCH_DIR, dir);
    const line = [`${dir}: cover=${cfg.cover}`];
    // cover
    const coverPath = path.join(artDir, 'cover.jpg');
    const coverRes = await downloadPexels(cfg.cover, coverPath);
    console.log(`  cover.jpg ← ${cfg.cover} ${coverRes ? `(${coverRes.size} bytes)` : '❌ 失败'}`);
    // images
    for (const img of cfg.images) {
      const p = path.join(artDir, `${img.slot}.jpg`);
      const res = await downloadPexels(img.id, p);
      console.log(`  ${img.slot}.jpg ← ${img.id} ${res ? `(${res.size} bytes)` : '❌ 失败'}`);
      line.push(`${img.slot}=${img.id}`);
    }
    logLines.push(line.join(', '));
  }

  const logFile = path.join(BATCH_DIR, 'used_images.txt');
  fs.writeFileSync(logFile, logLines.join('\n') + '\n');
  console.log(`\n✅ used_images.txt 已写入：${logFile}`);
  console.log(`\n全部完成，共下载 ${usedToday.size} 张图片。`);
}

main().catch(e => { console.error(e); process.exit(1); });
