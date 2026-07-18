const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/31672/AI/project/wechat/文章包/20260612';

function download(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => { fs.writeFileSync(filepath, Buffer.concat(chunks)); resolve(Buffer.concat(chunks).length); });
        }).on('error', reject);
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => { fs.writeFileSync(filepath, Buffer.concat(chunks)); resolve(Buffer.concat(chunks).length); });
      }
    }).on('error', reject);
  });
}

function pexelsUrl(id, w = 900) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

// All photo IDs from verified pool that haven't been used yet
const AVAILABLE = {
  people: [3184418, 3184419, 3184420, 3184299, 3184288],
  office: [2765000, 2765010, 2765020, 4160000, 4160100, 4160200],
  life:   [1181200, 1181244, 1181300, 1181400, 1181500],
  general:[5690000, 5690100, 3182765, 3184300, 3184310]
};

// Flatten and deduplicate
const allIds = [...new Set([...AVAILABLE.people, ...AVAILABLE.office, ...AVAILABLE.life, ...AVAILABLE.general])];

// Assign photos to articles
const articles = {
  '01-结婚十五年AA制他住院我看了余额': {
    cover: allIds[0],  // 3184418
    imgs: [allIds[15], allIds[3], allIds[1]]  // 3182765, 3184299, 3184419
  },
  '02-老公健身怀疑有情况情敌是他自己': {
    cover: allIds[5],  // 2765000
    imgs: [allIds[6], allIds[10], allIds[11]]  // 2765010, 1181200, 1181244
  },
  '04-妻子做短视频月入三万饭桌没人说话': {
    cover: allIds[8],  // 4160000
    imgs: [allIds[9], allIds[12], allIds[13], allIds[14]]  // 4160100, 1181300, 1181400, 1181500
  },
  '10-还完三十年房贷发现房子装不下人生': {
    cover: allIds[16], // 5690000
    imgs: [allIds[17], allIds[18], allIds[19], allIds[2]]  // 5690100, 3184300, 3184310, 3184420
  }
};

async function main() {
  const usedIds = [];
  let totalDownloaded = 0;

  for (const [dir, config] of Object.entries(articles)) {
    const dirPath = path.join(BASE, dir);
    console.log(`\n📁 ${dir}`);

    // Download cover
    const coverPath = path.join(dirPath, 'cover.jpg');
    const coverUrl = pexelsUrl(config.cover, 900);
    console.log(`  Cover: photo-${config.cover}`);
    try {
      const size = await download(coverUrl, coverPath);
      console.log(`    ✅ ${(size/1024).toFixed(1)} KB`);
      usedIds.push(`${dir}: photo-${config.cover}`);
      totalDownloaded++;
    } catch(e) {
      console.log(`    ❌ Failed: ${e.message}`);
    }

    // Download in-article images
    for (let i = 0; i < config.imgs.length; i++) {
      const imgNum = i + 1;
      const imgPath = path.join(dirPath, `img${imgNum}.jpg`);
      const imgUrl = pexelsUrl(config.imgs[i], 900);
      console.log(`  img${imgNum}: photo-${config.imgs[i]}`);
      try {
        const size = await download(imgUrl, imgPath);
        console.log(`    ✅ ${(size/1024).toFixed(1)} KB`);
        if (i === 0) usedIds[usedIds.length - 1] += `, photo-${config.imgs[i]}`;
        else {
          // Append to last entry for this article
          const last = usedIds[usedIds.length - 1];
          usedIds[usedIds.length - 1] = last + `, photo-${config.imgs[i]}`;
        }
        totalDownloaded++;
      } catch(e) {
        console.log(`    ❌ Failed: ${e.message}`);
      }
    }
  }

  // Write used_images.txt
  const usedPath = path.join(BASE, 'used_images.txt');
  fs.writeFileSync(usedPath, usedIds.join('\n'));
  console.log(`\n✅ Downloaded ${totalDownloaded} images`);
  console.log(`📝 Recorded to used_images.txt`);
}

main().catch(console.error);