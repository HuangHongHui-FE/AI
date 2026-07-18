#!/usr/bin/env python3
# 抓全市场情绪指标,落盘 cache/YYYYMMDD/sentiment.json
# ulist.np 取上证指数(市场级统计): f104涨/f105跌/f106平/f107涨停/f108跌停 一次拿全
# push2 限频时降级到 push2delay(延迟行情,统计够用)
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

HOSTS = ["push2delay.eastmoney.com", "push2.eastmoney.com", "82.push2.eastmoney.com"]
HEADERS = ["-H", "User-Agent: Mozilla/5.0", "-H", "Referer: https://data.eastmoney.com/"]
# 沪+深合计涨跌平家数;涨停跌停f107/f108为市场级口径(各指数相同),只取一份
URL = "http://{host}/api/qt/ulist.np/get?fltt=2&fields=f104,f105,f106,f107,f108&secids=1.000001,0.399001"


def fetch(retry=3):
    # 取沪+深涨跌统计;多域名轮换+重试
    for attempt in range(retry):
        host = HOSTS[attempt % len(HOSTS)]
        r = subprocess.run(["curl", "-s", "--max-time", "15", URL.format(host=host)] + HEADERS,
                           capture_output=True, text=True)
        try:
            diff = json.loads(r.stdout)["data"]["diff"]
            if diff:
                return diff, host
        except Exception:
            pass
        time.sleep(1.5)
    return None, None


diff, host = fetch()
dst = os.path.join(OUT, "sentiment.json")
if not diff:
    json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "error": "东财限频,情绪数据缺失"},
              open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[sentiment] FAIL (eastmoney limited) -> {dst}")
    raise SystemExit(0)

# 涨跌平按沪深合计;涨停跌停市场级口径取第一份(各指数相同,避免重复加)
up = sum(int(d.get("f104", 0)) for d in diff)
down = sum(int(d.get("f105", 0)) for d in diff)
flat = sum(int(d.get("f106", 0)) for d in diff)
zt = int(diff[0].get("f107", 0))    # 涨停家数(市场级)
dt = int(diff[0].get("f108", 0))    # 跌停家数(市场级)
total = up + down + flat
ratio = round(up / total * 100, 1) if total else 0  # 赚钱效应=涨家数占比
temp = zt - dt  # 情绪温度=涨停-跌停,正偏热负偏冷

json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "host": host,
           "up": up, "down": down, "flat": flat, "total": total,
           "limit_up": zt, "limit_down": dt,
           "profit_ratio": ratio, "sentiment_temp": temp,
           "note": "f104涨/f105跌/f106平/f107涨停/f108跌停,取上证指数市场级统计"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[sentiment] 涨{up}/跌{down}/平{flat} 涨停{zt}/跌停{dt} 赚钱效应{ratio}% -> {dst}")
