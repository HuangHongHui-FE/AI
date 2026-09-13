#!/usr/bin/env node
// 临时 K 线脚本：东财接口不可用时改用腾讯月K数据源，逻辑同 src/kline.cjs
const https = require('https');
const sharp = require('sharp');

const [, , code, title, outPath] = process.argv;

// 抓腾讯前复权月K数据
function fetch(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

(async () => {
  const txt = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},month,,,320,qfq`);
  const j = JSON.parse(txt);
  const key = Object.keys(j.data)[0];
  const klines = j.data[key].qfqmonth || j.data[key].month;
  const pts = klines.map(a => ({ d: a[0], close: +a[2] })).filter(p => p.close > 0);
  if (pts.length < 2) { console.error('✗ K线数据点不足'); process.exit(1); }

  const W = 900, H = 420, padL = 58, padR = 20, padT = 40, padB = 40;
  const xs = pts.map((_, i) => padL + (i / (pts.length - 1)) * (W - padL - padR));
  const prices = pts.map(p => p.close);
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const ys = prices.map(p => H - padB - ((p - mn) / (mx - mn || 1)) * (H - padT - padB));
  const poly = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = prices.at(-1).toFixed(2), first = prices[0].toFixed(2);
  const pct = (((prices.at(-1) - prices[0]) / prices[0]) * 100).toFixed(0);
  const sym = pct >= 0 ? '+' : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#1a1a2e"/>
<text x="${W / 2}" y="26" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff">${title}</text>
<text x="${padL}" y="58" font-size="13" fill="#888">最低 ¥${mn.toFixed(2)}</text>
<text x="${W - padR}" y="58" text-anchor="end" font-size="13" fill="#888">最高 ¥${mx.toFixed(2)}</text>
<polyline points="${poly}" fill="none" stroke="#FF6B35" stroke-width="2"/>
<text x="${padL}" y="${H - 12}" font-size="13" fill="#888">${pts[0].d} ¥${first}</text>
<text x="${W - padR}" y="${H - 12}" text-anchor="end" font-size="13" fill="#FF6B35">${pts.at(-1).d} ¥${last} (${sym}${pct}%)</text>
</svg>`;

  await sharp(Buffer.from(svg, 'utf8')).jpeg({ quality: 90 }).toFile(outPath);
  console.log(`OK K线图 ${pts.length} 个月 -> ${outPath}`);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
