// setup_images.js — 测试Pexels图片ID并下载今日4篇文章全部配图
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/31672/AI/project/wechat/文章包/20260613';

const articles = [
  {
    dir: '01-分床睡三个月感情反而变好了',
    cover: 3184418,  // bed/bedroom
    images: [3184419, 2765020, 1181200, 1181500] // pillow, cozy, window
  },
  {
    dir: '02-从大厂跳小公司发现表演工作',
    cover: 2765000,  // office
    images: [4160000, 4160100, 2765010, 4160200] // desk, office, papers
  },
  {
    dir: '03-带00后徒弟半年开始改简历',
    cover: 3184299,  // young/team
    images: [2765020, 3182765, 5690000, 5690100] // office, meeting
  },
  {
    dir: '04-我妈75岁学会网购打乱退休计划',
    cover: 3184288,  // family/older
    images: [1181244, 1181300, 1181400, 1181500] // packages, home, phone
  }
];

function download(id, filepath, width = 900) {
  return new Promise((resolve) => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    const go = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          go(res.headers.location);
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) {
            fs.writeFileSync(filepath, data);
            resolve({ ok: true, size: data.length });
          } else {
            resolve({ ok: false });
          }
        });
      }).on('error', () => resolve({ ok: false }));
    };
    go(url);
  });
}

async function main() {
  // 1. Collect all unique IDs
  const allIds = new Set();
  articles.forEach(a => {
    allIds.add(a.cover);
    a.images.forEach(id => allIds.add(id));
  });
  console.log(`测试 ${allIds.size} 个 Pexels photo ID...\n`);

  // 2. Test each ID
  const working = new Set();
  for (const id of allIds) {
    const tmp = path.join(BASE, `_test_${id}.jpg`);
    const r = await download(id, tmp, 100);
    if (r.ok) {
      working.add(id);
      console.log(`  ✅ ${id} (${(r.size/1024).toFixed(0)}KB)`);
      fs.unlinkSync(tmp);
    } else {
      console.log(`  ❌ ${id} 不可用，扩展搜索附近ID...`);
      // Try nearby IDs
      for (let offset = 1; offset <= 50; offset++) {
        const newId = id + offset;
        const r2 = await download(newId, tmp, 100);
        if (r2.ok) {
          working.add(newId);
          console.log(`     → ✅ ${newId} 替代`);
          fs.unlinkSync(tmp);
          break;
        }
        try { fs.unlinkSync(tmp); } catch(e) {}
      }
    }
  }

  console.log(`\n可用: ${working.size} 个\n`);

  // 3. Download images for each article
  const available = [...working];
  let usedIdx = 0;

  for (const art of articles) {
    const dir = path.join(BASE, art.dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`📥 ${art.dir}`);

    // Cover
    let coverId = working.has(art.cover) ? art.cover : available[usedIdx++ % available.length];
    const coverPath = path.join(dir, 'cover.jpg');
    const cr = await download(coverId, coverPath, 900);
    console.log(`  cover.jpg → ID:${coverId} ${cr.ok ? '✅' : '❌'}`);

    // Inline images
    for (let i = 0; i < art.images.length; i++) {
      const imgId = available[(usedIdx++) % available.length];
      const imgPath = path.join(dir, `img${i+1}.jpg`);
      const ir = await download(imgId, imgPath, 900);
      console.log(`  img${i+1}.jpg → ID:${imgId} ${ir.ok ? '✅' : '❌'}`);
    }
  }

  // Save used_images.txt
  const log = articles.map(a => {
    return `${a.dir}: cover=${a.cover}`;
  }).join('\n');
  fs.writeFileSync(path.join(BASE, 'used_images.txt'), log);
  console.log('\n✅ 图片下载完成');
}

main().catch(console.error);