// K 线数据抓取：东财主源（secid 形态），失败回落到腾讯（纯代码形态）
// 两个源的返回都归一成 [{date, open, close, high, low, volume}]，下游画图不需知道用的哪个源
// 注意东财的 end 参数曾写死成未来日期（20260801），这里改成取当天

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

// 本地日期 YYYYMMDD
function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// K 线周期：东财 klt（101日/102周/103月），腾讯 interval（day/week/month）
const PERIODS = {
  day: { eastmoney: 101, tencent: "day" },
  week: { eastmoney: 102, tencent: "week" },
  month: { eastmoney: 103, tencent: "month" },
};

// 东财 secid 推导：6 开头→沪(1)，0/3 开头→深(0)，港股→116，美股→105
// 已带点的（如 1.600519 / 116.00700）原样使用
export function toEastmoneySecid(code) {
  const s = String(code).trim();
  if (/^\d+\.\d+$/.test(s)) return s;
  if (/^\d{6}$/.test(s)) return `${s.startsWith("6") ? "1" : "0"}.${s}`;
  if (/^\d{5}$/.test(s)) return `116.${s}`; // 港股 5 位
  if (/^[A-Z]+$/i.test(s)) return `105.${s.toUpperCase()}`; // 美股代码
  return s;
}

// 腾讯代码推导：6 开头→sh，0/3→sz，港股→hk，美股→us
export function toTencentCode(code) {
  const s = String(code).trim();
  if (/^(sh|sz|hk|us)/i.test(s)) return s.toLowerCase();
  if (/^\d{6}$/.test(s)) return `${s.startsWith("6") ? "sh" : "sz"}${s}`;
  if (/^\d{5}$/.test(s)) return `hk${s}`;
  if (/^[A-Z]+$/i.test(s)) return `us${s.toUpperCase()}`;
  return s;
}

// 归一：每行统一成 {date, open, close, high, low, volume}
function normalizeRow(a) {
  return {
    date: a[0],
    open: Number(a[1]),
    close: Number(a[2]),
    high: Number(a[3]),
    low: Number(a[4]),
    volume: Number(a[5]) || 0,
  };
}

// 东财源：fields2=f51..f55 依次是 日期,开,收,高,低
export async function fetchEastmoney(code, period = "month", limit = 0) {
  const secid = toEastmoneySecid(code);
  const klt = PERIODS[period]?.eastmoney || 103;
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
    `&ut=fa5fd1943c7b386f172d6893dbfd32&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56` +
    `&klt=${klt}&fqt=1&beg=19900101&end=${ymd()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://quote.eastmoney.com/" } });
  if (!res.ok) throw new Error(`东财 HTTP ${res.status}`);
  const j = await res.json();
  const rows = j?.data?.klines;
  if (!Array.isArray(rows) || rows.length < 2) throw new Error("东财返回 K 线为空");
  let out = rows.map((line) => normalizeRow(line.split(","))).filter((r) => r.close > 0);
  if (limit > 0) out = out.slice(-limit);
  return { source: "eastmoney", code: secid, period, rows: out };
}

// 腾讯单次请求：返回原始行数组（不足 2 条时由调用方决定是否换后缀重试）
async function fetchTencentRows(txCode, interval, n) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${txCode},${interval},,,${n},qfq`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`腾讯 HTTP ${res.status}`);
  const j = await res.json();
  const node = j?.data?.[txCode] || j?.data?.[Object.keys(j?.data || {})[0]];
  const rows = node?.[`qfq${interval}`] || node?.[interval];
  return Array.isArray(rows) ? rows : [];
}

// 腾讯源：qfqmonth / qfqday / qfqweek 字段，顺序 日期,开,收,高,低,量
// 美股无交易所后缀时腾讯只返当天 1 条（usAAPL），须补 .N（纽交所）/ .OQ（纳斯达克）才有历史
export async function fetchTencent(code, period = "month", limit = 0) {
  const base = toTencentCode(code);
  const interval = PERIODS[period]?.tencent || "month";
  const n = limit > 0 ? limit : 320;
  const candidates = /^us[A-Z]+$/i.test(base) ? [base, `${base}.N`, `${base}.OQ`] : [base];
  let lastErr = null;
  for (const txCode of candidates) {
    try {
      const rows = await fetchTencentRows(txCode, interval, n);
      if (rows.length < 2) {
        lastErr = new Error("腾讯返回 K 线为空");
        continue;
      }
      let out = rows.map(normalizeRow).filter((r) => r.close > 0);
      if (limit > 0) out = out.slice(-limit);
      return { source: "tencent", code: txCode, period, rows: out };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("腾讯返回 K 线为空");
}

// 主入口：东财优先，失败自动回落腾讯（返回里 source 标明实际用的哪个源）
export async function fetchKline(code, { period = "month", limit = 0, source = "auto" } = {}) {
  const errors = [];
  if (source === "eastmoney" || source === "auto") {
    try {
      return await fetchEastmoney(code, period, limit);
    } catch (e) {
      errors.push(`东财：${e.message}`);
      if (source === "eastmoney") throw new Error(errors.join("；"));
    }
  }
  try {
    const r = await fetchTencent(code, period, limit);
    return { ...r, fallback_errors: errors };
  } catch (e) {
    errors.push(`腾讯：${e.message}`);
    throw new Error(`两个源都失败 —— ${errors.join("；")}`);
  }
}
