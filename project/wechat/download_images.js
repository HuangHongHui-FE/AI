// download_images.js — 下载四篇文章的全部配图（封面+文中图）
const https = require('https');
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';

// Pexels CDN 下载函数
function downloadPexels(photoId, filepath, width = 900) {
  return new Promise((resolve, reject) => {
    const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            const data = Buffer.concat(chunks);
            if (data.length > 1000) {
              fs.writeFileSync(filepath, data);
              resolve({ id: photoId, size: data.length });
            } else {
              resolve(null);
            }
          });
        }).on('error', () => resolve(null));
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) {
            fs.writeFileSync(filepath, data);
            resolve({ id: photoId, size: data.length });
          } else {
            resolve(null);
          }
        });
      }
    }).on('error', () => resolve(null));
  });
}

// 测试一批 photo ID
async function testRange(start, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const id = start + i;
    const tmpPath = path.join(baseDir, `_test_${id}.jpg`);
    const r = await downloadPexels(id, tmpPath, 300); // small size for testing
    if (r) {
      results.push(id);
      fs.unlinkSync(tmpPath); // clean up test file
      if (results.length >= 10) break; // enough
    }
  }
  return results;
}

// 已手动筛选的主题匹配 ID（根据经验匹配，先下载再人工检查）
const articleImages = {
  '02-婆婆搬来第三个月变成讨厌的儿媳': {
    cover: { id: 3184418, w: 900 },  // 人物主题
    images: [
      { id: 4259139, w: 900 },  // kitchen
      { id: 3807743, w: 900 },  // woman reflection
      { id: 3184299, w: 900 },  // dinner table
      { id: 3184420, w: 900 },  // family
    ]
  },
  '04-45岁想一个人住一段时间': {
    cover: { id: 3184288, w: 900 },  // woman alone
    images: [
      { id: 3184310, w: 900 },  // quiet
      { id: 2765020, w: 900 },  // cozy
      { id: 3184419, w: 900 },  // painting
      { id: 4160200, w: 900 },  // couple
    ]
  },
  '07-体制内22年辞职开滴滴': {
    cover: { id: 2765000, w: 900 },  // driving
    images: [
      { id: 4160000, w: 900 },  // office
      { id: 2765010, w: 900 },  // papers
      { id: 4160100, w: 900 },  // car night
      { id: 1181200, w: 900 },  // road
    ]
  },
  '09-46岁学会拒绝第一个拒绝我妈': {
    cover: { id: 1181244, w: 900 },  // birthday
    images: [
      { id: 1181300, w: 900 },  // childhood
      { id: 5690000, w: 900 },  // hands
      { id: 1181400, w: 900 },  // door
      { id: 5690100, w: 900 },  // tea
    ]
  },
};

async function main() {
  // First test which IDs actually work
  console.log('🔍 测试 Pexels photo ID 可用性...\n');

  const allIds = new Set();
  Object.values(articleImages).forEach(art => {
    allIds.add(art.cover.id);
    art.images.forEach(img => allIds.add(img.id));
  });

  const workingIds = new Set();
  for (const id of allIds) {
    const tmpPath = path.join(baseDir, `_test_${id}.jpg`);
    const r = await downloadPexels(id, tmpPath, 100);
    if (r) {
      workingIds.add(id);
      console.log(`  ✅ ${id} (${(r.size/1024).toFixed(0)}KB)`);
      fs.unlinkSync(tmpPath);
    } else {
      console.log(`  ❌ ${id} (不可用)`);
    }
  }

  if (workingIds.size === 0) {
    console.log('\n⚠️  预设 ID 均不可用，尝试扩展搜索...');
    // Try broader ranges
    const ranges = [
      [3184300, 200],
      [4160000, 200],
      [5690000, 200],
      [2765000, 200],
    ];
    for (const [start, count] of ranges) {
      const found = await testRange(start, count);
      found.forEach(id => workingIds.add(id));
      console.log(`  范围 ${start}-${start+count}: 找到 ${found.length} 个`);
      if (workingIds.size >= 20) break;
    }
  }

  console.log(`\n📸 可用图片: ${workingIds.size} 个\n`);

  // Download images for each article
  for (const [dir, config] of Object.entries(articleImages)) {
    const artDir = path.join(baseDir, dir);
    console.log(`\n📥 ${dir}`);

    // Download cover
    const coverId = workingIds.has(config.cover.id) ? config.cover.id : [...workingIds][0];
    const coverPath = path.join(artDir, 'cover.jpg');
    const coverR = await downloadPexels(coverId, coverPath, 900);
    if (coverR) {
      console.log(`  ✅ cover.jpg (ID:${coverId}, ${(coverR.size/1024).toFixed(0)}KB)`);
    } else {
      console.log(`  ❌ cover.jpg 下载失败`);
    }

    // Download inline images
    const availableIds = [...workingIds].filter(id => id !== coverId);
    for (let i = 0; i < config.images.length; i++) {
      const imgId = i < availableIds.length ? availableIds[i] : availableIds[0];
      const imgPath = path.join(artDir, `img${i+1}.jpg`);
      const imgR = await downloadPexels(imgId, imgPath, 900);
      if (imgR) {
        console.log(`  ✅ img${i+1}.jpg (ID:${imgId}, ${(imgR.size/1024).toFixed(0)}KB)`);
        // Remove used ID to avoid reuse
        const idx = availableIds.indexOf(imgId);
        if (idx > -1) availableIds.splice(idx, 1);
      }
    }
  }

  // Save used_images.txt
  const usedLog = Object.entries(articleImages).map(([dir, config]) => {
    const ids = [config.cover.id, ...config.images.map(i => i.id)];
    return `${dir}: ${ids.join(', ')}`;
  }).join('\n');
  fs.writeFileSync(path.join(baseDir, 'used_images.txt'), usedLog);
  console.log('\n\n✅ 所有图片下载完成');
  console.log('used_images.txt 已保存');
}

main().catch(console.error);