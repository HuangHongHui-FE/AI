#!/usr/bin/env python3
# 抓东财行业板块资金流(板块级真实机构/散户拆分),落盘 cache/YYYYMMDD/flow.json
# 1次请求拿全部行业板块;主力=超大单+大单(机构) 小单=散户;ETF无此概念故不用ETF资金字段
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

# f14板块名 f62主力净额(机构) f66超大单 f72大单 f78中单 f84小单(散户) f184主力占比 f3涨跌幅
URL = ("http://{host}/api/qt/clist/get?pn=1&pz=500&po=1&np=1&fltt=2"
       "&fs=m:90+t:2&fields=f14,f62,f66,f72,f78,f84,f184,f3")
HOSTS = ["push2.eastmoney.com", "82.push2.eastmoney.com", "19.push2.eastmoney.com"]


def fetch(retry=3):
    # 1次请求拿全部行业板块资金流;多域名轮换+重试
    for attempt in range(retry):
        host = HOSTS[attempt % len(HOSTS)]
        r = subprocess.run(["curl", "-s", "--max-time", "15", URL.format(host=host),
                             "-H", "User-Agent: Mozilla/5.0",
                             "-H", "Referer: https://data.eastmoney.com/"],
                            capture_output=True, text=True)
        try:
            diff = json.loads(r.stdout)["data"]["diff"]
            if diff:
                return diff
        except Exception:
            pass
        time.sleep(2.0)
    return None


diff = fetch()
dst = os.path.join(OUT, "flow.json")
if not diff:
    json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "error": "东财限频,资金拆分缺失"},
              open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[flow] FAIL (eastmoney limited) -> {dst}")
    raise SystemExit(0)

sectors = []
for d in diff:
    sectors.append({
        "name": d.get("f14", ""),
        "main": d.get("f62", 0),       # 主力净额=机构(超大+大单)
        "superbig": d.get("f66", 0),  # 超大单
        "big": d.get("f72", 0),       # 大单
        "medium": d.get("f78", 0),    # 中单
        "retail": d.get("f84", 0),    # 小单=散户
        "main_pct": d.get("f184", 0),
        "pct": d.get("f3", 0),
    })

json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "count": len(sectors), "industries": sectors},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[flow] {len(sectors)} industries(含机构/散户拆分) -> {dst}")
