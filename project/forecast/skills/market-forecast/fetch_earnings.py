#!/usr/bin/env python3
# 抓财报/业绩预告,落盘 cache/YYYYMMDD/earnings.json
# A股业绩预告(主): 东财 RPT_PUBLIC_OP_PREDICT 全市场,按 sectors.json 的leaders匹配各板块龙头
#   - 业绩预告比预约披露日更前瞻,预告本身就是催化;INCREASEL/INCREASET=预增幅度上下限
# A股预约披露日(辅): RPT_LICO_FN_CPD 全市场未来N天(随8月变密)
# 美股: 维护近期科技巨头财报窗口常量(无稳定curl源,标"惯例窗口估计")
import json, time, subprocess, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECTORS = json.load(open(os.path.join(ROOT, "skills/market-forecast/sectors.json")))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

DAYS_AHEAD = 45
today = datetime.date.today()
end = today + datetime.timedelta(days=DAYS_AHEAD)
S, E = today.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
HEADERS = ["-H", "User-Agent: Mozilla/5.0", "-H", "Referer: https://data.eastmoney.com/"]

# 业绩预告(全市场中报): 取利润预告,按龙头代码本地匹配
URL_FORECAST = ("https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE"
                "&sortTypes=-1&pageSize=3000&pageNumber=1&reportName=RPT_PUBLIC_OP_PREDICT"
                "&columns=SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE,REPORTDATE,FORECASTTYPE,"
                "INCREASEL,INCREASET,FORECASTCONTENT&filter=(REPORTDATE='2026-06-30')")
# 预约披露日(全市场未来N天)
URL_CPD = ("https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE"
           "&sortTypes=1&pageSize=2000&pageNumber=1&reportName=RPT_LICO_FN_CPD"
           "&columns=SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE"
           f"&filter=(REPORTDATE='2026-06-30')(NOTICE_DATE>='{S}')(NOTICE_DATE<='{E}')")


def curl_json(url, retry=2):
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "20", url] + HEADERS,
                           capture_output=True, text=True)
        try:
            return json.loads(r.stdout)
        except Exception:
            time.sleep(1.0)
    return None


def forecast_kind(inc_l, ftype):
    # 预告方向: INCREASEL>0=预喜(预增/扭亏/略增), <0=预减(预减/续亏/略减)
    if inc_l is None:
        return "未知"
    try:
        v = float(inc_l)
    except Exception:
        return "未知"
    if v > 0:
        return "预增" if v >= 30 else "略增"
    if v < 0:
        return "预减" if v <= -30 else "略减"
    return "持平"


# 1) 抓全市场业绩预告,建 代码→预告 字典
fc = curl_json(URL_FORECAST)
fc_map = {}
if fc and fc.get("result"):
    for r in fc["result"].get("data", []) or []:
        fc_map[str(r.get("SECURITY_CODE", ""))] = r

# 2) 按板块leaders匹配龙头预告
a_leaders = []
for s in SECTORS["sectors"]:
    leaders = s.get("leaders", [])
    if not leaders:
        continue
    sec_res = {"sector": s["name"], "leaders": []}
    for ld in leaders:
        code = str(ld["code"])
        # A股6位代码直接匹配;港股5位代码在A股预告接口无,标"港股不适用"
        r = fc_map.get(code)
        if r:
            sec_res["leaders"].append({
                "code": code, "name": ld["name"],
                "notice_date": (r.get("NOTICE_DATE") or "")[:10],
                "kind": forecast_kind(r.get("INCREASEL"), r.get("FORECASTTYPE")),
                "increase_low": r.get("INCREASEL"), "increase_high": r.get("INCREASET"),
                "content": (r.get("FORECASTCONTENT") or "")[:40],
            })
        else:
            sec_res["leaders"].append({"code": code, "name": ld["name"], "forecast": "未披露"})
    a_leaders.append(sec_res)

# 3) 预约披露日(全市场)
cpd = curl_json(URL_CPD)
a_share = []
if cpd and cpd.get("result"):
    a_share = [{"code": r.get("SECURITY_CODE"), "name": r.get("SECURITY_NAME_ABBR"),
                "date": (r.get("NOTICE_DATE") or "")[:10]} for r in cpd["result"].get("data", []) or []]

# 美股近期重要财报窗口(惯例估计,确切日以公司公告为准)
US_EARNINGS = [
    {"name": "Tesla", "window": "7月下旬", "report": "Q2 2026", "impact": "新能源车/智驾/机器人"},
    {"name": "Alphabet", "window": "7月下旬", "report": "Q2 2026", "impact": "AI应用/互联网/广告"},
    {"name": "Meta", "window": "7月下旬", "report": "Q2 2026", "impact": "AI应用/互联网/算力需求"},
    {"name": "Microsoft", "window": "7月下旬", "report": "财年Q4", "impact": "云计算/AI应用/办公软件"},
    {"name": "Amazon", "window": "8月初", "report": "Q2 2026", "impact": "云计算/电商/跨境物流"},
    {"name": "AMD", "window": "8月初", "report": "Q2 2026", "impact": "半导体/算力芯片"},
    {"name": "Apple", "window": "8月初", "report": "财年Q3", "impact": "消费电子/果链"},
    {"name": "Nvidia", "window": "8月中下旬", "report": "财年Q1(5-7月)", "impact": "算力/CPO/半导体(最强传导)"},
]

dst = os.path.join(OUT, "earnings.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"),
           "a_leaders": a_leaders,
           "a_leaders_note": "各板块龙头业绩预告(2026中报),按INCREASEL判预增/预减;港股龙头预告不在此A股接口",
           "a_share": a_share,
           "a_share_note": f"A股未来{DAYS_AHEAD}天已预约中报披露{len(a_share)}家(权重股多8月中下旬才预约)",
           "us": US_EARNINGS,
           "us_note": "美股窗口为惯例估计,确切日以公司公告为准"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
n_fc = sum(1 for s in a_leaders for l in s["leaders"] if l.get("kind"))
print(f"[earnings] 龙头业绩预告 {n_fc} 家已披露 / 板块{len(a_leaders)} / 美股{len(US_EARNINGS)} -> {dst}")
