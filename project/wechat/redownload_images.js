// redownload_images.js — 给每篇文章分配完全不重复的图片
const https = require('https');
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';
const allIds = JSON.parse(fs.readFileSync(path.join(baseDir, 'available_ids.json'), 'utf8'));

// 随机打乱
for (let i = allIds.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
}

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
            if (data.length > 1000) { fs.writeFileSync(filepath, data); resolve({ id: photoId, size: data.length }); }
            else resolve(null);
          });
        }).on('error', () => resolve(null));
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) { fs.writeFileSync(filepath, data); resolve({ id: photoId, size: data.length }); }
          else resolve(null);
        });
      }
    }).on('error', () => resolve(null));
  });
}

const articles = [
  '02-婆婆搬来第三个月变成讨厌的儿媳',
  '04-45岁想一个人住一段时间',
  '07-体制内22年辞职开滴滴',
  '09-46岁学会拒绝第一个拒绝我妈',
];

async function main() {
  let idPool = [...allIds];
  const usedMap = {};

  for (const dir of articles) {
    const artDir = path.join(baseDir, dir);
    const used = [];

    // 5 images per article (cover + 4 inline)
    for (let i = 0; i < 5; i++) {
      const photoId = idPool.shift();
      const filename = i === 0 ? 'cover.jpg' : `img${i}.jpg`;
      const filepath = path.join(artDir, filename);

      const r = await downloadPexels(photoId, filepath, 900);
      if (r) {
        used.push(photoId);
        console.log(`  ${dir}/${filename} <- ID:${photoId} (${(r.size/1024).toFixed(0)}KB)`);
      } else {
        console.log(`  ${dir}/${filename} <- ID:${photoId} FAILED, retrying...`);
        // Put back and try next
        const nextId = idPool.shift();
        const r2 = await downloadPexels(nextId, filepath, 900);
        if (r2) {
          used.push(nextId);
          console.log(`  ${dir}/${filename} <- ID:${nextId} (${(r2.size/1024).toFixed(0)}KB)`);
        }
      }
    }
    usedMap[dir] = used;
    console.log('');
  }

  // Save used_images.txt
  const log = Object.entries(usedMap).map(([dir, ids]) => `${dir}: ${ids.join(', ')}`).join('\n');
  fs.writeFileSync(path.join(baseDir, 'used_images.txt'), log);
  console.log('used_images.txt saved');

  // Verify no overlap
  const allUsed = Object.values(usedMap).flat();
  const unique = new Set(allUsed);
  console.log(`\nTotal images: ${allUsed.length}, Unique: ${unique.size}`);
  if (allUsed.length !== unique.size) {
    console.log('WARNING: Duplicate images detected!');
  } else {
    console.log('✅ All images are unique across articles');
  }
}

main().catch(console.error);