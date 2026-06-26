// download_20260621.js — 下载 20260621 批次 4 篇文章配图
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260621';
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
  return new Promise((resolve, reject) => {
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
  '01-我们把家里的Wi-Fi分成两个': {
    cover: 1024995,
    images: [
      { id: 1640779, slot: 'img1', label: '客厅生活' },
      { id: 1024996, slot: 'img2', label: '夫妻' },
      { id: 1640780, slot: 'img3', label: '客厅' },
    ],
  },
  '02-同事辞职开了家代吵架工作室': {
    cover: 2765025,
    images: [
      { id: 4160201, slot: 'img1', label: '办公格子' },
      { id: 3801216, slot: 'img2', label: '打电话' },
      { id: 2765026, slot: 'img3', label: '小办公室' },
    ],
  },
  '03-我开始记录今天没做什么': {
    cover: 3784769,
    images: [
      { id: 5690102, slot: 'img1', label: '笔记本/备忘录' },
      { id: 3784771, slot: 'img2', label: '独处' },
      { id: 5690103, slot: 'img3', label: '笔记本' },
    ],
  },
  '04-00后整顿职场三年后': {
    cover: 4160202,
    images: [
      { id: 2284171, slot: 'img1', label: '地铁通勤' },
      { id: 4160203, slot: 'img2', label: '办公' },
      { id: 1181501, slot: 'img3', label: '风景' },
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
