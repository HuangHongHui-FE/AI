// download_20260619.js — 用干净 ID 下载 4 篇文章配图（封面+文中图）
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260619';
const BATCH_DIR = path.join(PACKAGE_ROOT, BATCH);
const BLACKLIST_FILE = path.join(PACKAGE_ROOT, 'image_blacklist.txt');

// 按 skill 05 强制流程：每次下载前必须校验 ID 未在黑名单中
const blacklist = new Set(
  fs.readFileSync(BLACKLIST_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
);

// 当天已用的 ID，避免单批内重复
const usedToday = new Set();

function assertNotUsed(id) {
  const s = String(id);
  if (blacklist.has(s)) {
    throw new Error(`❌ photo ID ${id} 在历史黑名单中，禁止下载`);
  }
  if (usedToday.has(s)) {
    throw new Error(`❌ photo ID ${id} 本批次已用过，禁止重复下载`);
  }
}

function downloadPexels(photoId, filepath, width = 900) {
  return new Promise((resolve, reject) => {
    const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, handle)
          .on('error', () => resolve(null));
      } else {
        handle(res);
      }
    }).on('error', () => resolve(null));
  });
}

// 4 篇文章的配图分配（cover 1 张 + img 3 张），全部来自 pick_clean_images 的干净池
const articles = {
  '01-结婚七年我们开始说谢谢': {
    cover: 1024993,                              // couple
    images: [
      { id: 1640777, slot: 'img1', label: '面/餐桌' },
      { id: 374078,  slot: 'img2', label: '男人独坐' },
      { id: 1025003, slot: 'img3', label: '双人背影' },
    ],
  },
  '02-公司让我培训接替我的新人': {
    cover: 374074,                               // man_sitting
    images: [
      { id: 1287149, slot: 'img1', label: '独处/窗边' },
      { id: 1024994, slot: 'img2', label: '双人讨论' },
      { id: 1287147, slot: 'img3', label: '独处思考' },
    ],
  },
  '03-我开始允许自己一整天什么都不做': {
    cover: 1287145,                             // solitude
    images: [
      { id: 3784763, slot: 'img1', label: '女人窗边' },
      { id: 1115897, slot: 'img2', label: '雨窗' },
      { id: 1640783, slot: 'img3', label: '食物' },
    ],
  },
  '04-离婚冷静期第29天他做了顿饭': {
    cover: 2284166,                            // cooking
    images: [
      { id: 2284170, slot: 'img1', label: '厨房' },
      { id: 1640784, slot: 'img2', label: '饭菜' },
      { id: 3784767, slot: 'img3', label: '女人窗边' },
    ],
  },
};

async function main() {
  // Step 1: 下载前预检全部 ID
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

  // Step 2: 下载
  const logLines = [];
  for (const [dir, cfg] of Object.entries(articles)) {
    const artDir = path.join(BATCH_DIR, dir);
    console.log(`\n📥 ${dir}`);

    // cover
    const coverPath = path.join(artDir, 'cover.jpg');
    const coverR = await downloadPexels(cfg.cover, coverPath, 900);
    if (coverR) {
      console.log(`  ✅ cover.jpg (ID:${cfg.cover}, ${(coverR.size/1024).toFixed(0)}KB)`);
    } else {
      console.log(`  ❌ cover.jpg 下载失败`);
    }

    // inline images
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

  // Step 3: 写当天 used_images.txt
  const usedFile = path.join(BATCH_DIR, 'used_images.txt');
  fs.writeFileSync(usedFile, logLines.join('\n') + '\n');
  console.log(`\n💾 used_images.txt 已写入 ${usedFile}`);

  // Step 4: 刷新全局黑名单
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
