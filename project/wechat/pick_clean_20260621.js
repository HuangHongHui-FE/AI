// pick_clean_20260621.js — 为 20260621 批次扫描未撞库 photo ID
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BLACKLIST_FILE = path.join(PACKAGE_ROOT, 'image_blacklist.txt');
const blacklist = new Set(fs.readFileSync(BLACKLIST_FILE, 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean));

console.log(`🚫 黑名单加载：${blacklist.size} 个 ID\n`);

function probe(id, width = 200) {
  return new Promise(resolve => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, res => {
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
    }).on('error', () => resolve({ id, size: 0 }))
      .on('timeout', function() { this.destroy(); resolve({ id, size: 0 }); });
  });
}

// 今天4篇文章需要的主题：
// 1. Wi-Fi分两个：客厅沙发、夫妻、路由器/网络
// 2. 代吵架工作室：小办公室、电脑、电话
// 3. 记录没做什么：笔记本/备忘录、独处、放松
// 4. 00后安静辞职：办公格子间、地铁、风景头像
const themes = {
  living_room: { start: 1640777, count: 60, label: '客厅/生活场景' },     // 食物+室内+沙发一类
  couple_home: { start: 1024993, count: 60, label: '夫妻/双人' },
  small_office:{ start: 2765024, count: 80, label: '小办公室/电脑' },     // 探新范围
  phone_call:  { start: 3801213, count: 80, label: '打电话/手机' },       // 在 38012xx 后面找
  notebook:    { start: 5690100, count: 100, label: '笔记本/备忘录' },    // 5690000s 段新
  solitude2:   { start: 3784767, count: 80, label: '独处/窗边' },
  workspace:   { start: 4160200, count: 80, label: '办公格子间' },
  subway:      { start: 2284170, count: 80, label: '地铁/通勤' },
  landscape:   { start: 1181500, count: 80, label: '风景/山' },
};

async function findClean(themeKey, need = 5) {
  const t = themes[themeKey];
  const clean = [];
  for (let i = 0; i < t.count && clean.length < need; i++) {
    const id = t.start + i;
    if (blacklist.has(String(id))) continue;
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
  console.log('🔍 扫描未撞库 photo ID...\n');
  const pool = {};
  for (const key of Object.keys(themes)) {
    console.log(`扫描主题：${themes[key].label}`);
    pool[key] = await findClean(key, 5);
  }
  console.log('\n📦 可用 ID 池：');
  for (const [k, v] of Object.entries(pool)) {
    console.log(`  ${k.padEnd(14)}: ${v.join(', ') || '(无)'}`);
  }
  fs.writeFileSync(path.join(PACKAGE_ROOT, '20260621', 'image_candidates.json'),
    JSON.stringify(pool, null, 2));
  console.log('\n💾 候选 ID 已写入 20260621/image_candidates.json');
}

main().catch(console.error);
