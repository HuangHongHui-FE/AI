// download_20260622.js — 下载 20260622 批次 4 篇文章配图
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260622';
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
  '01-35岁我把存款分了三份': {
    cover: 1025004,
    images: [
      { id: 1640786, slot: 'img1', label: '客厅生活' },
      { id: 1025008, slot: 'img2', label: '夫妻' },
      { id: 1025020, slot: 'img3', label: '阳台' },
    ],
  },
  '02-面试官问我你父母做什么的': {
    cover: 4160204,
    images: [
      { id: 4160205, slot: 'img1', label: '会议室' },
      { id: 2284172, slot: 'img2', label: '地铁' },
      { id: 2284173, slot: 'img3', label: '地铁通勤' },
    ],
  },
  '03-我删掉了所有效率App那一周': {
    cover: 3784772,
    images: [
      { id: 5690104, slot: 'img1', label: '手机/App' },
      { id: 5690105, slot: 'img2', label: '笔记' },
      { id: 3784773, slot: 'img3', label: '独处' },
    ],
  },
  '04-高考结束那天我妈突然哭了': {
    cover: 1181502,
    images: [
      { id: 1181503, slot: 'img1', label: '校园/街景' },
      { id: 2765027, slot: 'img2', label: '家庭室内' },
      { id: 1181504, slot: 'img3', label: '风景' },
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
    console.log(`\n📥 ${dir}`);

    const coverPath = path.join(artDir, 'cover.jpg');
    const coverR = await downloadPexels(cfg.cover, coverPath, 900);
    if (coverR) {
      console.log(`  ✅ cover.jpg (ID:${cfg.cover}, ${(coverR.size/1024).toFixed(0)}KB)`);
    } else {
      console.log(`  ❌ cover.jpg 下载失败`);
    }

    const imgIds = [];
    for (const img of cfg.images) {
      const imgPath = path.join(artDir, `${img.slot}.jpg`);
      const r = await downloadPexels(img.id, imgPath, 900);
      if (r) {
        console.log(`  ✅ ${img.slot}.jpg (ID:${img.id}, ${(r.size/1024).toFixed(0)}KB, ${img.label})`);
        imgIds.push(`${img.slot}=${img.id}`);
      } else {
        console.log(`  ❌ ${img.slot}.jpg 下载失败`);
      }
    }
    logLines.push(`${dir}: cover=${cfg.cover}, ${imgIds.join(', ')}`);
  }

  const usedFile = path.join(BATCH_DIR, 'used_images.txt');
  fs.writeFileSync(usedFile, logLines.join('\n') + '\n');
  console.log(`\n💾 used_images.txt 已写入 ${usedFile}`);

  blacklist.forEach(id => usedToday.add(id));
  const newBlacklist = [...usedToday].sort((a, b) => Number(a) - Number(b));
  fs.writeFileSync(BLACKLIST_FILE, newBlacklist.join('\n') + '\n');
  console.log(`💾 全局黑名单已刷新：${newBlacklist.length} 个 ID（含本批新增 ${usedToday.size - blacklist.size} 个）`);

  console.log('\n✅ 全部完成');
}

main().catch(err => {
  console.error('\n' + err.message);
  process.exit(1);
});
