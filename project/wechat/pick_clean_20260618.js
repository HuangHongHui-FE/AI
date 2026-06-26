// pick_clean_20260618.js — 为 20260618 扫干净 photo ID
const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';
const BATCH = '20260618';
const BATCH_DIR = path.join(PACKAGE_ROOT, BATCH);
const BLACKLIST_FILE = path.join(PACKAGE_ROOT, 'image_blacklist.txt');

const blacklist = new Set(fs.readFileSync(BLACKLIST_FILE, 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean));
console.log(`🚫 黑名单加载：${blacklist.size} 个 ID\n`);

function probe(id, width = 200) {
  return new Promise(resolve => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      const next = r => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => resolve({ id, size: Buffer.concat(chunks).length }));
      };
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, next)
          .on('error', () => resolve({ id, size: 0 }));
      } else next(res);
    }).on('error', () => resolve({ id, size: 0 }));
  });
}

// 主题池：避开历史 + 20260619 用过的范围
const themes = {
  mother_daughter: { start: 1024310, count: 40, label: '母女' },
  bank_atm:        { start: 3585040, count: 40, label: '银行/ATM' },
  hands:           { start: 356055,  count: 40, label: '手/给' },
  interview:       { start: 3760067, count: 40, label: '面试/会议室' },
  office_desk:    { start: 3801210, count: 40, label: '办公桌' },
  calendar_note:   { start: 279320,  count: 40, label: '日历/笔记本' },
  coffee_morning:  { start: 302899,  count: 40, label: '早茶/咖啡' },
  couple_home:     { start: 1024980, count: 40, label: '夫妻家里' },
  kitchen_dishes:  { start: 2637181, count: 40, label: '厨房碗' },
  argument:        { start: 3944405, count: 40, label: '吵架/冷战' },
};

async function findClean(key, need = 5) {
  const t = themes[key];
  const clean = [];
  for (let i = 0; i < t.count && clean.length < need; i++) {
    const id = t.start + i;
    if (blacklist.has(String(id))) continue;
    const r = await probe(id);
    if (r.size > 2000) {
      clean.push(id);
      console.log(`  ✅ [${t.label}] ${id} (${(r.size/1024).toFixed(1)}KB)`);
    } else process.stdout.write('.');
  }
  console.log('');
  return clean;
}

async function main() {
  console.log('🔍 开始扫描未撞库 ID...\n');
  const pool = {};
  for (const key of Object.keys(themes)) {
    console.log(`扫描：${themes[key].label}`);
    pool[key] = await findClean(key, 4);
  }
  console.log('\n📦 可用 ID 池：');
  for (const [k, v] of Object.entries(pool)) {
    console.log(`  ${k.padEnd(16)}: ${v.join(', ') || '(无)'}`);
  }
  fs.writeFileSync(path.join(BATCH_DIR, 'image_candidates.json'), JSON.stringify(pool, null, 2));
  console.log(`\n💾 候选写入 ${BATCH}/image_candidates.json`);
}

main().catch(console.error);
