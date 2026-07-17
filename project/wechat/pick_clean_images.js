// pick_clean_images.js — 为 20260619 批次选未撞库的 photo ID
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BLACKLIST_FILE = path.join(PACKAGE_ROOT, 'image_blacklist.txt');
const blacklist = new Set(fs.readFileSync(BLACKLIST_FILE, 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean));

console.log(`🚫 黑名单加载完成：${blacklist.size} 个 ID\n`);

// 测试单个 photo ID 是否在 Pexels 上可用
function probe(id, width = 200) {
  return new Promise(resolve => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      const next = res2 => {
        const chunks = [];
        res2.on('data', c => chunks.push(c));
        res2.on('end', () => resolve({ id, size: Buffer.concat(chunks).length }));
      };
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, next)
          .on('error', () => resolve({ id, size: 0 }));
      } else {
        next(res);
      }
    }).on('error', () => resolve({ id, size: 0 }));
  });
}

// 主题池：每个主题给一个 ID 起点和扫描数量，避免与黑名单重复
const themes = {
  food:       { start: 1640777, count: 30, label: '食物/餐桌' },
  kitchen:    { start: 2637  , count: 30, label: '厨房' },
  solitude:   { start: 1287145, count: 30, label: '独处/窗边' },
  couple:     { start: 1024993, count: 30, label: '夫妻/双人' },
  man_sitting:{ start: 374074 , count: 30, label: '男人独坐' },
  woman_window:{start: 3784760, count: 30, label: '女人窗边' },
  rain_window:{ start: 1115882, count: 30, label: '雨窗' },
  cooking:    { start: 2284166, count: 30, label: '做饭' },
};

async function findClean(themeKey, need = 6) {
  const t = themes[themeKey];
  const clean = [];
  for (let i = 0; i < t.count && clean.length < need; i++) {
    const id = t.start + i;
    if (blacklist.has(String(id))) continue;            // 历史撞库，跳过
    const r = await probe(id);
    if (r.size > 2000) {
      clean.push(id);
      console.log(`  ✅ [${t.label}] ${id} (${(r.size/1024).toFixed(1)}KB)`);
    } else {
      process.stdout.write('.');
    }
  }
  console.log('');
  return clean;
}

async function main() {
  console.log('🔍 开始扫描未撞库的 photo ID...\n');
  const pool = {};
  for (const key of Object.keys(themes)) {
    console.log(`扫描主题：${themes[key].label}`);
    pool[key] = await findClean(key, 5);
  }
  console.log('\n📦 可用 ID 池（已避开黑名单）：');
  for (const [k, v] of Object.entries(pool)) {
    console.log(`  ${k.padEnd(12)}: ${v.join(', ') || '(无)'}`);
  }
  fs.writeFileSync(path.join(PACKAGE_ROOT, '20260619', 'image_candidates.json'),
    JSON.stringify(pool, null, 2));
  console.log('\n💾 候选 ID 已写入 20260619/image_candidates.json');
}

main().catch(console.error);
