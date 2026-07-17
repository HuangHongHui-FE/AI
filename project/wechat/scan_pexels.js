// scan_pexels.js — 扫描 Pexels 找可用 photo ID
const https = require('https');

function test(id) {
  return new Promise(r => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=200`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
      const handle = (rr) => {
        const chunks = [];
        rr.on('data', c => chunks.push(c));
        rr.on('end', () => {
          const s = Buffer.concat(chunks).length;
          r({ id, size: s });
        });
        rr.on('error', () => r({ id, size: 0 }));
      };
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, handle)
          .on('error', () => r({ id, size: 0 }))
          .on('timeout', function() { this.destroy(); r({ id, size: 0 }); });
      } else {
        handle(res);
      }
    }).on('error', () => r({ id, size: 0 }))
      .on('timeout', function() { this.destroy(); r({ id, size: 0 }); });
  });
}

async function scan(start, count) {
  const ids = [...Array(count)].map((_, i) => start + i);
  const results = [];
  // 并发 20
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const r = await Promise.all(batch.map(test));
    results.push(...r);
  }
  return results.filter(x => x.size > 1000);
}

(async () => {
  const ranges = [
    [5180000, 60],   // 家庭/生活类
    [6700000, 60],   // 中年/老人
    [7190000, 60],   // 室内/厨房
    [7590000, 60],   // 城市景观
    [8800000, 60],   // 网吧/年轻人
    [4390000, 60],   // 会议室/办公
  ];
  for (const [start, count] of ranges) {
    process.stdout.write(`Scanning ${start}-${start + count - 1}... `);
    const found = await scan(start, count);
    console.log(`found ${found.length}: ${found.map(x => x.id).slice(0, 20).join(',')}`);
  }
})();
