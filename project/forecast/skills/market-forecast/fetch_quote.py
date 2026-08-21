#!/usr/bin/env python3
# 抓取所有板块代理标的实时行情(新浪 hq.sinajs.cn 批量),整理后落盘 cache/YYYYMMDD/quotes.json
# 新浪返回GBK编码、逗号分隔;价格已是真实价免换算;1个请求取全部标的,限频风险低
import json, time, subprocess, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECTORS = json.load(open(os.path.join(ROOT, "skills/market-forecast/sectors.json")))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)


def sina_code(code):
    # 5/6开头(沪市ETF/科创)→sh, 0/1/3开头(深市)→sz
    return ("sh" if code[0] in "56" else "sz") + code


def fetch_em_block(bk, retry=2):
    # 东财板块行情(有 concept_bk 的无ETF概念板块,如固态电池 BK0968);fltt=2 已是格式化值
    url = (f"http://push2.eastmoney.com/api/qt/stock/get?secid=90.{bk}&fltt=2"
           f"&fields=f43,f44,f45,f46,f48,f57,f58,f60,f170")
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "12", url,
                            "-H", "Referer: https://data.eastmoney.com/",
                            "-H", "User-Agent: Mozilla/5.0"], capture_output=True, text=True)
        try:
            return json.loads(r.stdout).get("data") or {}
        except Exception:
            time.sleep(0.8)
    return {}


def fetch_all(retry=2):
    # 一次批量抓全部标的行情(跳过无 code 的 concept_bk 概念板块)
    codes = ",".join(sina_code(s["code"]) for s in SECTORS["sectors"] if s.get("code"))
    url = f"https://hq.sinajs.cn/list={codes}"
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "15", url,
                            "-H", "Referer: https://finance.sina.com.cn/",
                            "-H", "User-Agent: Mozilla/5.0"], capture_output=True)
        if r.stdout:
            return r.stdout.decode("gbk", errors="replace")
        time.sleep(0.8)
    return ""


text = fetch_all()
parsed = {}
for line in text.splitlines():
    m = re.match(r'var hq_str_(\w+)="(.*)";', line.strip())
    if not m:
        continue
    sc, raw = m.groups()
    f = raw.split(",")
    if len(f) < 32:
        continue
    parsed[sc] = {
        "name_cn": f[0], "open": float(f[1]), "prevclose": float(f[2]),
        "price": float(f[3]), "high": float(f[4]), "low": float(f[5]),
        "volume": float(f[8]), "amount": float(f[9]),
        "date": f[30], "time": f[31],
    }

result = []
for s in SECTORS["sectors"]:
    if s.get("concept_bk"):
        # 无ETF概念板块: 用东财板块行情(点位/涨跌幅/成交额), secid=90.BKxxxx
        d = fetch_em_block(s["concept_bk"])
        if not d.get("f43"):
            result.append({"name": s["name"], "market": s["market"], "label": s["label"],
                           "concept_bk": s["concept_bk"], "error": "em block fetch fail"})
            continue
        result.append({
            "name": s["name"], "market": s["market"], "label": s["label"],
            "concept_bk": s["concept_bk"], "price": d.get("f43"), "prevclose": d.get("f60"),
            "open": d.get("f46"), "high": d.get("f44"), "low": d.get("f45"),
            "pct": d.get("f170"), "volume": 0, "amount": d.get("f48"),
            "qdate": DATE, "qtime": time.strftime("%H:%M:%S"),
        })
        continue
    sc = sina_code(s["code"])
    p = parsed.get(sc)
    if not p or p["price"] == 0:
        result.append({"name": s["name"], "code": s["code"], "market": s["market"], "error": "fetch fail"})
        continue
    prev = p["prevclose"] or p["price"]
    # 涨跌幅自算,避免依赖接口字段
    pct = (p["price"] - prev) / prev * 100 if prev else 0
    result.append({
        "name": s["name"], "code": s["code"], "market": s["market"], "label": s["label"],
        "price": p["price"], "prevclose": prev, "open": p["open"],
        "high": p["high"], "low": p["low"], "pct": round(pct, 2),
        "volume": p["volume"], "amount": p["amount"],
        "qdate": p["date"], "qtime": p["time"],
    })

dst = os.path.join(OUT, "quotes.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "sectors": result},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[quotes] {len([r for r in result if 'error' not in r])}/{len(result)} ok -> {dst}")
