// check_duplicates.js — 跨天图片去重校验
// 按 skill 05 的强制流程：扫描所有历史 used_images.txt，找出重复用过的 photo ID
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = 'C:/Users/31672/AI/project/wechat/文章包';

// 收集所有历史记录：photo ID -> [{date, article, line}]
function buildHistory() {
  const usage = new Map(); // id -> [{date, article}]
  const dates = fs.readdirSync(PACKAGE_ROOT).filter(d => /^\d{8}$/.test(d)).sort();
  for (const date of dates) {
    const f = path.join(PACKAGE_ROOT, date, 'used_images.txt');
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [articlePart, ...rest] = line.split(':');
      const article = (articlePart || '').trim();
      // 抽取所有 >=6 位数字 ID
      const ids = (rest.join(':').match(/\d{6,}/g)) || [];
      ids.forEach(id => {
        if (!usage.has(id)) usage.set(id, []);
        usage.get(id).push(`${date}/${article}`);
      });
    }
  }
  return usage;
}

function main() {
  const history = buildHistory();
  console.log(`📋 扫描完成，历史共出现 ${history.size} 个不同的 photo ID\n`);

  const dupes = [...history.entries()].filter(([_, locs]) => locs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (dupes.length === 0) {
    console.log('✅ 没有任何跨天重复的 photo ID');
    return;
  }

  console.log(`❌ 发现 ${dupes.length} 个被重复使用的 photo ID：\n`);
  console.log('ID         | 重复次数 | 使用位置');
  console.log('-'.repeat(80));
  for (const [id, locs] of dupes) {
    console.log(`${id.padEnd(10)} | ${String(locs.length).padEnd(8)} | ${locs.join(' | ')}`);
  }

  // 输出黑名单到当天目录之外的全局文件，供后续下载流程读
  const blacklistFile = path.join(PACKAGE_ROOT, 'image_blacklist.txt');
  const lines = [...history.keys()].sort();
  fs.writeFileSync(blacklistFile, lines.join('\n') + '\n');
  console.log(`\n💾 全局黑名单已写入 ${blacklistFile}（共 ${lines.length} 个 ID）`);
}

main();
