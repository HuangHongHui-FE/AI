// download_imgs_20260629.js — 下载4篇文章配图(cover+img1-3)，全局黑名单去重
const https = require('https');
const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260629';
const BLACKLIST_FILE = '/Users/zcy1/code_self/AI/project/wechat/文章包/image_blacklist.txt';

// 加载全局黑名单
const blacklist = new Set(
  fs.readFileSync(BLACKLIST_FILE, 'utf8').match(/\d{6,}/g) || []
);
console.log(`📛 黑名单已加载 ${blacklist.size} 个 ID`);

// Pexels 下载
function downloadPexels(photoId, filepath, width = 900) {
  return new Promise((resolve) => {
    const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const next = (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 3000) {
            fs.writeFileSync(filepath, data);
            resolve({ id: photoId, size: data.length });
          } else resolve(null);
        });
      };
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, next).on('error', () => resolve(null));
      } else next(res);
    }).on('error', () => resolve(null));
  });
}

// 候选 ID：历史验证过的段附近扩展
const ranges = [
  ...[...Array(30)].map((_, i) => 3184400 + i),
  ...[...Array(30)].map((_, i) => 4160200 + i),
  ...[...Array(30)].map((_, i) => 5690100 + i),
  ...[...Array(20)].map((_, i) => 1181500 + i),
  ...[...Array(20)].map((_, i) => 2765020 + i),
];

const dirs = [
  '01-我录下老公的呼噜声给他听',
  '02-结婚十二年我第一次自己过生日',
  '03-离职那天我把工位的绿植搬回了家',
  '04-我开始给自己写悼词',
];

async function main() {
  const working = [];
  console.log('🔍 测试可用 ID（避开黑名单）...');
  for (const id of ranges) {
    if (blacklist.has(String(id))) continue;
    if (working.length >= 24) break;
    const tmp = path.join(BATCH_DIR, `_t_${id}.jpg`);
    const r = await downloadPexels(id, tmp, 100);
    if (r) {
      working.push(id);
      fs.existsSync(tmp) && fs.unlinkSync(tmp);
      console.log(`  ✅ ${id} (${(r.size/1024).toFixed(0)}KB)`);
    }
  }
  console.log(`📸 可用且未用: ${working.length} 个\n`);
  if (working.length < 16) { console.log('❌ 可用图不足16张，需扩展范围'); process.exit(1); }

  const used = [];
  const usedIds = [];
  let idx = 0;
  for (const dir of dirs) {
    const artDir = path.join(BATCH_DIR, dir);
    const ids = working.slice(idx, idx + 4); idx += 4;
    ids.forEach(id => usedIds.push(String(id)));
    // cover + img1/2/3
    const cover = await downloadPexels(ids[0], path.join(artDir, 'cover.jpg'), 900);
    console.log(`\n📥 ${dir}`);
    console.log(`  cover ${cover ? '✅ ' + ids[0] : '❌'}`);
    for (let i = 1; i < 4; i++) {
      const r = await downloadPexels(ids[i], path.join(artDir, `img${i}.jpg`), 900);
      console.log(`  img${i} ${r ? '✅ ' + ids[i] : '❌'}`);
    }
    used.push(`${dir}: cover=${ids[0]}, img1=${ids[1]}, img2=${ids[2]}, img3=${ids[3]}`);
  }

  // 只追加实际用过的16个ID到黑名单
  fs.appendFileSync(BLACKLIST_FILE, '\n' + usedIds.join('\n') + '\n');
  fs.writeFileSync(path.join(BATCH_DIR, 'used_images.txt'), used.join('\n') + '\n');
  console.log('\n✅ 全部下载完成，黑名单与 used_images.txt 已更新');
}
main().catch(e => { console.error(e); process.exit(1); });
