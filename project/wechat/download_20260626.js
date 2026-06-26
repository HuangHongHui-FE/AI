// download_20260626.js — 下载 20260626 批次 4 篇文章配图（封面+3张文中图=16张）
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260626';
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
  '01-我把老公的游戏账号改了密码': {
    cover: 4220000,
    images: [
      { id: 4220001, slot: 'img1', label: '电脑/书房' },
      { id: 4220002, slot: 'img2', label: '客厅/沙发' },
      { id: 4220003, slot: 'img3', label: '冰箱/便签' },
    ],
  },
  '02-同事被裁后开了一家陪诊工作室': {
    cover: 6618000,
    images: [
      { id: 6618001, slot: 'img1', label: '医院走廊' },
      { id: 6618002, slot: 'img2', label: '老人/陪诊' },
      { id: 6618004, slot: 'img3', label: '办公桌/工作室' },
    ],
  },
  '03-我开始每周给自己写一封辞职信': {
    cover: 6820000,
    images: [
      { id: 6820001, slot: 'img1', label: '手机/备忘录' },
      { id: 6820002, slot: 'img2', label: '咖啡/夜晚' },
      { id: 6820003, slot: 'img3', label: '笔记本/写作' },
    ],
  },
  '04-中考分流后我侄子主动选了职高': {
    cover: 7580001,
    images: [
      { id: 7580002, slot: 'img1', label: '雨夜/小区' },
      { id: 7580030, slot: 'img2', label: '职高/车间' },
      { id: 7580032, slot: 'img3', label: '少年/书包' },
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
