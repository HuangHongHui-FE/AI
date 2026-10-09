#!/usr/bin/env python3
# 抓取所有板块代理标的近60个交易日日K,计算均线/量比/位置分位,落盘 cache/YYYYMMDD/history.json
# 用途: ①技术面从"单日盘口近似"升级为多日均线趋势 ②T+1回检直接取目标日真实收盘价(避免盘中快照误当收盘) ③"是否放量"用真实5日均额基准
# 数据源(三源兜底): ①新浪 KLineData(3位小数,ETF精度必备,量→额估算) ②腾讯 fqkline(仅2位小数,精度不足作兜底) ③东财 push2his kline(含真实成交额,概念板块唯一源,但日内限频)
# 东财日内易限频(实测连续请求后整站拒绝),故置于末位;ETF一律优先新浪保精度
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECTORS = json.load(open(os.path.join(ROOT, "skills/market-forecast/sectors.json")))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)
LMT = 60  # 抓取交易日数,需覆盖 MA60
UA = {"User-Agent": "Mozilla/5.0"}


def curl(url, referer):
    # 统一走 curl,规避 python 请求头/SSL 兼容问题
    r = subprocess.run(["curl", "-s", "--max-time", "15", url, "-H", f"Referer: {referer}"] +
                       sum([["-H", f"{k}: {v}"] for k, v in UA.items()], []), capture_output=True)
    return r.stdout


def em_kline(secid, retry=0):
    # 源①东财: 返回 [[日期,开,收,高,低,额,涨跌幅],...];amount 真实值
    url = (f"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}"
           f"&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
           f"&klt=101&fqt=1&end=20500101&lmt={LMT}")
    for i in range(retry + 1):
        raw = curl(url, "https://quote.eastmoney.com/")
        try:
            kl = (json.loads(raw).get("data") or {}).get("klines") or []
            if kl:
                return [[f[0], f[1], f[2], f[3], f[4], f[6], f[8]] for f in (k.split(",") for k in kl)]
        except Exception:
            pass
        time.sleep(1.5 * (i + 1))  # 递增退避
    return []


def tx_kline(code, retry=1):
    # 源②腾讯: 返回 [[日期,开,收,高,低,量(手)],...];无成交额,由 量×100×收盘 估算
    sc = ("sh" if code[0] in "56" else "sz") + code
    url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={sc},day,,,{LMT},qfq"
    for i in range(retry + 1):
        raw = curl(url, "https://gu.qq.com/")
        try:
            d = json.loads(raw)["data"][sc]
            kl = d.get("qfqday") or d.get("day") or []
            if kl:
                return [[k[0], k[1], k[2], k[3], k[4], float(k[5]) * 100 * float(k[2]), None] for k in kl]
        except Exception:
            pass
        time.sleep(1.0 * (i + 1))
    return []


def sina_kline(code, retry=1):
    # 源③新浪: 返回 [{day,open,high,low,close,volume}];量单位为股,额=量×收盘估算
    sc = ("sh" if code[0] in "56" else "sz") + code
    url = (f"https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData"
           f"?symbol={sc}&scale=240&ma=no&datalen={LMT}")
    for i in range(retry + 1):
        raw = curl(url, "https://finance.sina.com.cn/")
        try:
            d = json.loads(raw)
            if d:
                return [[x["day"], x["open"], x["close"], x["high"], x["low"],
                         float(x["volume"]) * float(x["close"]), None] for x in d]
        except Exception:
            pass
        time.sleep(1.0 * (i + 1))
    return []


# 概念板块的代理ETF:东财概念板块日K不可用时,用同主题ETF的日K做趋势代理(点位不同,仅取涨跌幅/量比/连涨跌)
CONCEPT_PROXY = {"BK0968": "159755", "BK1027": "159711"}


def fetch(secid, code, bk):
    # 依次尝试: 新浪(收盘价3位精度,ETF必需) -> 腾讯(仅2位小数,精度不足) -> 东财(有真实成交额但日内限频)
    if code:
        kl = sina_kline(code)
        if kl:
            return kl, "sina"
        kl = tx_kline(code)
        if kl:
            return kl, "tx"
    kl = em_kline(secid)
    if kl:
        return kl, "em"
    if not code and bk and bk in CONCEPT_PROXY:
        # 概念板块无ETF时代理;点位与ETF不同,仅涨跌幅/量比/连涨跌可比
        kl = sina_kline(CONCEPT_PROXY[bk]) or tx_kline(CONCEPT_PROXY[bk])
        if kl:
            return kl, f"proxy({CONCEPT_PROXY[bk]})"
    return [], "none"


def calc_ma(closes, n):
    # 近n日收盘均值;不足n日返回None
    return round(sum(closes[-n:]) / n, 4) if len(closes) >= n else None


def build(rows):
    # 由日K序列派生: 均线/均线排列/量比/连续涨跌/近20日位置分位;涨跌幅缺失时自算
    closes = [r["close"] for r in rows]
    for i, r in enumerate(rows):
        if r["pct"] is None:  # 腾讯/新浪源无涨跌幅字段,用前收自算
            prev = rows[i - 1]["close"] if i > 0 else r["open"]
            r["pct"] = round((r["close"] - prev) / prev * 100, 2) if prev else 0
    last = rows[-1]
    ma5, ma10, ma20, ma60 = (calc_ma(closes, n) for n in (5, 10, 20, 60))
    prev5 = [r["amount"] for r in rows[-6:-1]]
    vol_ratio = round(last["amount"] / (sum(prev5) / len(prev5)), 2) if prev5 and sum(prev5) else None
    streak = 0
    for r in reversed(rows):
        if r["pct"] > 0 and streak >= 0:
            streak += 1
        elif r["pct"] < 0 and streak <= 0:
            streak -= 1
        else:
            break
    win20 = [r["close"] for r in rows[-20:]]
    pos20 = round((last["close"] - min(win20)) / (max(win20) - min(win20)) * 100, 1) \
        if max(win20) > min(win20) else None
    return {"klines": rows[-6:], "ma5": ma5, "ma10": ma10, "ma20": ma20, "ma60": ma60,
            "above_ma20": None if ma20 is None else round((last["close"] / ma20 - 1) * 100, 2),
            "vol_ratio": vol_ratio, "streak": streak, "pos20": pos20}


def trend(d):
    # 均线趋势文字判断(供技术面直接引用)
    if d.get("ma20") is None:
        return "数据不足"
    tags = ["多头排列" if d["ma5"] and d["ma10"] and d["ma5"] > d["ma10"] > d["ma20"] else
            ("空头排列" if d["ma5"] and d["ma10"] and d["ma5"] < d["ma10"] < d["ma20"] else "均线纠缠")]
    tags.append(f"{'站上' if d['above_ma20'] >= 0 else '跌破'}MA20({d['above_ma20']:+.2f}%)")
    if d.get("vol_ratio"):
        tags.append(f"{'放量' if d['vol_ratio'] >= 1.2 else ('缩量' if d['vol_ratio'] <= 0.8 else '平量')}{d['vol_ratio']}倍")
    if d.get("streak"):
        tags.append(f"连{abs(d['streak'])}{'涨' if d['streak'] > 0 else '跌'}")
    if d.get("pos20") is not None:
        tags.append(f"20日位置{d['pos20']}%")
    return " ".join(tags)


out, miss, srcs = {}, [], {}
for s in SECTORS["sectors"]:
    secid = s.get("secid") or (f"90.{s['concept_bk']}" if s.get("concept_bk") else None)
    if not secid:
        continue
    kl, src = fetch(secid, s.get("code"), s.get("concept_bk"))
    if not kl:
        miss.append(s["name"])
        time.sleep(0.3)
        continue
    rows = [{"d": k[0], "open": float(k[1]), "close": float(k[2]), "high": float(k[3]),
             "low": float(k[4]), "amount": float(k[5]),
             "pct": float(k[6]) if k[6] is not None else None} for k in kl]
    d = build(rows)
    d["code"] = s.get("code") or s["concept_bk"]
    d["src"] = src
    d["trend"] = trend(d)
    out[s["name"]] = d
    srcs[src] = srcs.get(src, 0) + 1
    time.sleep(0.35)  # 限频保护

dst = os.path.join(OUT, "history.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "lmt": LMT,
           "fields": "klines=近6日(日期/开/收/高/低/额/涨跌幅);ma5/10/20/60=均线;above_ma20=距MA20%;vol_ratio=今额/前5日均额;streak=连涨跌天数;pos20=近20日位置分位;src=数据源(em东财/tx腾讯/sina新浪);trend=文字判断",
           "sectors": out}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[history] {len(out)}/{len(out) + len(miss)} ok  源分布={srcs} -> {dst}" + (f"  miss={miss}" if miss else ""))
