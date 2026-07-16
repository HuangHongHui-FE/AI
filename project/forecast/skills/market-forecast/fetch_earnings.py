#!/usr/bin/env python3
# 抓财报披露日历,落盘 cache/YYYYMMDD/earnings.json
# A股: 东财 RPT_LICO_FN_CPD 抓未来N天已预约中报披露日(随8月变密,长期有效)
# 美股: 维护近期科技巨头财报窗口常量(无稳定curl源,标"惯例窗口估计")
import json, time, subprocess, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

# 未来多少天的披露日纳入;覆盖到中报密集期
DAYS_AHEAD = 45
today = datetime.date.today()
end = today + datetime.timedelta(days=DAYS_AHEAD)
S, E = today.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
HEADERS = ["-H", "User-Agent: Mozilla/5.0", "-H", "Referer: https://data.eastmoney.com/"]

# A股预约披露日: REPORTDATE=2026中报, NOTICE_DATE在未来区间
URL = ("https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE"
       "&sortTypes=1&pageSize=2000&pageNumber=1&reportName=RPT_LICO_FN_CPD"
       "&columns=SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE"
       f"&filter=(REPORTDATE='2026-06-30')(NOTICE_DATE>='{S}')(NOTICE_DATE<='{E}')")


def fetch_a():
    # 抓A股中报预约披露日;东财限频时返回空,降级
    for _ in range(2):
        r = subprocess.run(["curl", "-s", "--max-time", "15", URL] + HEADERS,
                           capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            rows = (data.get("result") or {}).get("data") or []
            if rows is not None:
                return rows
        except Exception:
            time.sleep(1.0)
    return None


# 美股近期重要财报窗口(惯例估计,确切日以公司公告为准);impact=对A股联动板块
US_EARNINGS = [
    {"name": "Tesla", "window": "7月下旬", "report": "Q2 2026", "impact": "新能源车/智驾/机器人"},
    {"name": "Alphabet", "window": "7月下旬", "report": "Q2 2026", "impact": "AI应用/互联网/广告"},
    {"name": "Meta", "window": "7月下旬", "report": "Q2 2026", "impact": "AI应用/互联网/算力需求"},
    {"name": "Amazon", "window": "8月初", "report": "Q2 2026", "impact": "云计算/电商/跨境物流"},
    {"name": "AMD", "window": "8月初", "report": "Q2 2026", "impact": "半导体/算力芯片"},
    {"name": "Apple", "window": "8月初", "report": "财年Q3", "impact": "消费电子/果链"},
    {"name": "Nvidia", "window": "8月中下旬", "report": "财年Q1(5-7月)", "impact": "算力/CPO/半导体(最强传导)"},
    {"name": "Microsoft", "window": "7月下旬", "report": "财年Q4", "impact": "云计算/AI应用/办公软件"},
]

a_rows = fetch_a()
dst = os.path.join(OUT, "earnings.json")
if a_rows is None:
    a_share = []
    note_a = "东财限频,A股预约披露日未取到"
else:
    a_share = [{"code": r.get("SECURITY_CODE"), "name": r.get("SECURITY_NAME_ABBR"),
                "date": (r.get("NOTICE_DATE") or "")[:10]} for r in a_rows]
    note_a = f"A股未来{DAYS_AHEAD}天已预约中报披露{len(a_share)}家(权重股多8月中下旬才预约)"

json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"),
           "a_share": a_share, "a_share_note": note_a,
           "us": US_EARNINGS,
           "us_note": "美股窗口为惯例估计,确切日以公司公告为准(提前1-2周)"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[earnings] A股预约披露{len(a_share)}家 / 美股巨头{len(US_EARNINGS)}家 -> {dst}")
