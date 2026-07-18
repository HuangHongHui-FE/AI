// download_20260611.js — 下载今日4篇文章的配图
const https = require('https');
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260611';

// 已验证可用的 Pexels photo ID 池
const availablePool = [3182708,3182710,3182712,3182713,3182714,3182715,3182716,3183008,3183009,3183010,3183011,3183012,3183013,3183015,3183017,3183019,3184000,3184006,3184007,3184010,3184013,3184014,3184015,3184016,3184017,3184019,3807003,3807004,3807005,3807006,3807007,3807008,3807009,3807011,3807013,3807015,3807018,3807019,4259002,4259003,4259004,4259005,4259008,4259009,4259010,4259011,4259012,4259013,4259017,4259019,4160000,4160001,4160002,4160004,4160005,4160007,4160008,4160010,4160011,4160012,4160014,4160015,4160016,4160017,4160018,4160019,2764800,2764803,2764811,2764815,1181002,1181003,1181006,1181010,1181012,1181013,1181015,1181018,5690000,5690001,5690002,5690003,5690004,5690005,5690006,5690007,5690008,5690009,5690010,5690011,5690012,5690013,5690014,5690015,5690016,5690017,5690018,5690019];

// 20260610 已使用的 ID（避免重复）
const usedIds = new Set([5690013, 4259010, 4259017, 4259005, 3184007, 4160010, 3184017, 5690004, 5690005, 4259019, 1181015, 1181010, 4160007, 3182713, 4160008, 1181018, 5690011, 3183008, 3182712, 3182710]);

// 20260609 使用的ID（从文件结构推断，那批用img1-5命名）
// 加上之前批次的：3184418, 4259139, 3807743, 3184299, 3184420, 3184288, 3184310, 2765020, 3184419, 4160200, 2765000, 2765010, 4160100, 1181200, 1181244, 1181300, 5690000, 1181400, 5690100
const moreUsed = [3184418, 4259139, 3807743, 3184299, 3184420, 3184288, 3184310, 2765020, 3184419, 4160200, 2765000, 2765010, 4160100, 1181200, 1181244, 1181300, 5690000, 1181400, 5690100];
moreUsed.forEach(id => usedIds.add(id));

// 去重后的可用ID池
const freshPool = availablePool.filter(id => !usedIds.has(id));
console.log(`可用ID池: ${freshPool.length} 个\n`);

// Pexels 下载函数
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

// 今日文章配置
const articles = {
  '01-老公退休后天天在家': {
    cover: { file: 'cover.jpg', w: 900 },
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'].map(f => ({ file: f, w: 900 }))
  },
  '05-47岁学架子鼓邻居敲门哭了': {
    cover: { file: 'cover.jpg', w: 900 },
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'].map(f => ({ file: f, w: 900 }))
  },
  '06-女儿出嫁老公厕所里哭': {
    cover: { file: 'cover.jpg', w: 900 },
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'].map(f => ({ file: f, w: 900 }))
  },
  '09-50岁戒掉攀比解释等别人开口': {
    cover: { file: 'cover.jpg', w: 900 },
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'].map(f => ({ file: f, w: 900 }))
  }
};

async function main() {
  let idIndex = 0;
  const usedLog = {};

  for (const [dirName, config] of Object.entries(articles)) {
    const artDir = path.join(baseDir, dirName);
    console.log(`📥 ${dirName}`);
    const used = [];

    // 下载封面
    const coverId = freshPool[idIndex++];
    const coverPath = path.join(artDir, config.cover.file);
    const coverR = await downloadPexels(coverId, coverPath, config.cover.w);
    if (coverR) {
      console.log(`  ✅ cover.jpg (ID:${coverId}, ${(coverR.size/1024).toFixed(0)}KB)`);
      used.push(coverId);
    } else {
      console.log(`  ❌ cover.jpg (ID:${coverId}) 失败，重试...`);
      const retryId = freshPool[idIndex++];
      const retryR = await downloadPexels(retryId, coverPath, config.cover.w);
      if (retryR) {
        console.log(`  ✅ cover.jpg (ID:${retryId}, retry)`);
        used.push(retryId);
      }
    }

    // 下载文中配图
    for (let i = 0; i < config.images.length; i++) {
      const imgId = freshPool[idIndex++];
      const imgPath = path.join(artDir, config.images[i].file);
      const imgR = await downloadPexels(imgId, imgPath, config.images[i].w);
      if (imgR) {
        console.log(`  ✅ ${config.images[i].file} (ID:${imgId}, ${(imgR.size/1024).toFixed(0)}KB)`);
        used.push(imgId);
      } else {
        console.log(`  ❌ ${config.images[i].file} (ID:${imgId}) 失败，重试...`);
        const retryId = freshPool[idIndex++];
        const retryR = await downloadPexels(retryId, imgPath, config.images[i].w);
        if (retryR) {
          console.log(`  ✅ ${config.images[i].file} (ID:${retryId}, retry)`);
          used.push(retryId);
        }
      }
    }

    usedLog[dirName] = used;
    console.log('');
  }

  // 保存使用记录
  const logContent = Object.entries(usedLog)
    .map(([dir, ids]) => `${dir}: ${ids.join(', ')}`)
    .join('\n');
  fs.writeFileSync(path.join(baseDir, 'used_images.txt'), logContent);
  console.log('✅ used_images.txt 已保存');
  console.log('\n📸 今日使用图片ID:');
  console.log(logContent);
}

main().catch(console.error);