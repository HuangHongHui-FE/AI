// 跨榜重叠检测：同一话题在多榜出现 = 真热，选点时优先考虑
// 做法：分词做粗匹配（标题互相包含 ≥6 字即为重叠），避免引入分词依赖

// 提取可比较的片段：去标点、取中文字符串
function normalize(s) {
  return String(s).replace(/[\s\p{P}]/gu, "");
}

// 判断两个标题是否指向同一话题（任一包含对方的核心片段）
function sameTopic(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  // 否则找最长公共子串，≥6 个中文字符视为同一话题
  const min = Math.min(x.length, y.length);
  for (let len = Math.min(min, 20); len >= 6; len--) {
    for (let i = 0; i + len <= x.length; i++) {
      if (y.includes(x.slice(i, i + len))) return true;
    }
  }
  return false;
}

// 汇总所有平台条目，输出被 ≥2 个平台同时收录的话题
export function findOverlap(results) {
  const flat = [];
  for (const [key, r] of Object.entries(results)) {
    if (!r.ok) continue;
    for (const it of r.items) flat.push({ platform: key, label: r.label, ...it });
  }

  const groups = [];
  const used = new Set();
  for (let i = 0; i < flat.length; i++) {
    if (used.has(i)) continue;
    const group = [flat[i]];
    used.add(i);
    for (let j = i + 1; j < flat.length; j++) {
      if (used.has(j)) continue;
      if (flat[j].platform === flat[i].platform) continue; // 同平台不同条目不算跨榜
      if (sameTopic(flat[i].title, flat[j].title)) {
        group.push(flat[j]);
        used.add(j);
      }
    }
    const platforms = [...new Set(group.map((g) => g.platform))];
    if (platforms.length >= 2) {
      groups.push({
        title: group[0].title,
        platforms,
        labels: [...new Set(group.map((g) => g.label))],
        platform_count: platforms.length,
        members: group.map((g) => ({ platform: g.platform, rank: g.rank, title: g.title, heat: g.heat })),
      });
    }
  }
  // 上榜平台数多的排前面
  return groups.sort((a, b) => b.platform_count - a.platform_count);
}
