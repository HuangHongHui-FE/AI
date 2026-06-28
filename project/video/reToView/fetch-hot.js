// 抓取今日各平台热榜（解析 tophub.today 主页聚合数据）
// 零依赖，Node 18+ 内置 fetch
// 用法: node fetch-hot.js   输出 hot.json

import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WANT = ['微博', '知乎', '抖音', '百度', '哔哩哔哩', 'B站', '今日头条', '头条', '微信', '贴吧', '虎扑', '豆瓣', '澎湃', 'IT之家', '36氪', '少数派', '吾爱', 'V2EX', 'GitHub', '掘金'];

function parseCards(html) {
  // 卡片: <div class="cc-cd" id="node-xxxx"> ... 平台名在 <div class="cc-cd-lb">...<span>平台</span></div>
  // 子类: <span class="cc-cd-sb-st">类型</span>
  // 条目: <span class="s ">rank</span><span class="t">title</span><span class="e">extra</span>
  const cards = [];
  const parts = html.split(/<div class="cc-cd"/);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].slice(0, 20000);
    const titleM = block.match(/<div class="cc-cd-lb"[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/);
    if (!titleM) continue;
    const platform = titleM[1].replace(/\s+/g, ' ').trim();
    const kindM = block.match(/<span class="cc-cd-sb-st">\s*([\s\S]*?)\s*<\/span>/);
    const kind = kindM ? kindM[1].replace(/\s+/g, ' ').trim() : '';
    const itemRe = /<span class="s\s*">([^<]*)<\/span>\s*<span class="t">([\s\S]*?)<\/span>(?:\s*<span class="e">([^<]*)<\/span>)?/g;
    const items = [];
    let m;
    while ((m = itemRe.exec(block))) {
      const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (title) items.push({ rank: m[1].trim(), title, extra: (m[3] || '').trim() });
    }
    if (items.length) cards.push({ platform, kind, count: items.length, items: items.slice(0, 25) });
  }
  return cards;
}

async function main() {
  console.log('fetching tophub.today ...');
  const r = await fetch('https://tophub.today/', { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN' }, signal: AbortSignal.timeout(25000) });
  const html = await r.text();
  console.log('got', html.length, 'bytes, status', r.status);
  if (html.length < 100000) {
    console.log('页面异常小，可能被反爬拦截');
    writeFileSync('hot.json', JSON.stringify({ fetchedAt: new Date().toISOString(), error: 'page too small, likely captcha', length: html.length }, null, 2));
    process.exit(1);
  }

  const cards = parseCards(html);
  console.log('parsed cards:', cards.length);

  const all = { fetchedAt: new Date().toISOString(), sources: {} };
  for (const c of cards) {
    const key = c.platform;
    all.sources[key] = { label: `${c.platform}${c.kind}`, count: c.count, items: c.items };
    const matched = WANT.some(w => c.platform.includes(w));
    if (matched) {
      console.log(`\n[${c.platform}${c.kind}] ${c.count} 条`);
      c.items.slice(0, 8).forEach(it => console.log(`  ${it.rank}. ${it.title}${it.extra ? '  (' + it.extra + ')' : ''}`));
    }
  }

  writeFileSync('hot.json', JSON.stringify(all, null, 2), 'utf8');
  console.log('\n已写入 hot.json');
}

main().catch(e => { console.error(e); process.exit(1); });
