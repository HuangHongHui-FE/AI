// download_20260628.js — 下载 20260628 批次 4 篇文章配图（封面+3张文中图=16张）
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260628';
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
  '01-我把结婚照从客厅摘了下来': {
    cover: 9000530,
    images: [
      { id: 9000531, slot: 'img1', label: '客厅空墙/相框印' },
      { id: 9000532, slot: 'img2', label: '银杏照片/墙面' },
      { id: 9000533, slot: 'img3', label: '衣柜纸箱/旧物' },
    ],
  },
  '02-我主动放弃了今年的年终评优': {
    cover: 9000540,
    images: [
      { id: 9000541, slot: 'img1', label: '飞书消息/办公室' },
      { id: 9000542, slot: 'img2', label: '幼儿园门口' },
      { id: 9000543, slot: 'img3', label: '馄饨碗/路灯' },
    ],
  },
  '03-我开始给情绪打分': {
    cover: 9000550,
    images: [
      { id: 9000551, slot: 'img1', label: 'iPhone备忘录' },
      { id: 9000553, slot: 'img2', label: '桂花树/小区' },
      { id: 9000560, slot: 'img3', label: '紫色小狗画' },
    ],
  },
  '04-我妈58岁开始学AI画图': {
    cover: 9000570,
    images: [
      { id: 9000571, slot: 'img1', label: 'MatePad/即梦界面' },
      { id: 9000572, slot: 'img2', label: '1988红棉袄新娘图' },
      { id: 9000573, slot: 'img3', label: '枣树土房老照片' },
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

  // 把本批 16 个 ID 追加进 image_blacklist.txt（持久化黑名单）
  const newIds = [...usedToday];
  fs.appendFileSync(BLACKLIST_FILE, '\n# 20260628\n' + newIds.join('\n') + '\n');
  console.log(`✅ image_blacklist.txt 已追加 ${newIds.length} 个 ID`);

  console.log(`\n全部完成，共下载 ${usedToday.size} 张图片。`);
}

main().catch(e => { console.error(e); process.exit(1); });
