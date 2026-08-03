#!/usr/bin/env node
// K线图生成：抓东财历史月K数据，SVG 折线图转 JPG
// 用法: node src/kline.cjs <secid> "<标题>" <输出路径>
// secid: 港股 116.00700 / 沪市 1.600519 / 深市 0.000001
const https = require('https');
const sharp = require('sharp');

const [, , secid, title, outPath] = process.argv;
if (!secid || !outPath) {
  console.error('用法: node src/kline.cjs <secid> "<标题>" <输出路径>');
  process.exit(1);
}

// 抓东财月K历史数据
function fetch(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

(async () => {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfd32&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55&klt=103&fqt=1&beg=19900101&end=20260801`;
  const txt = await fetch(url);
  const m = txt.match(/"klines":\[([^\]]*)\]/);
  if (!m) { console.error('✗ K线数据抓取失败，secid=' + secid); process.exit(1); }
  const klines = m[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
  // 每行：日期,开,收,高,低,量
  const pts = klines.map(s => { const a = s.split(','); return { d: a[0], close: +a[2] }; }).filter(p => p.close > 0);
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
