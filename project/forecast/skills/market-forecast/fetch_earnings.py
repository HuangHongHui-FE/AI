#!/usr/bin/env python3
# 抓财报/业绩预告,落盘 cache/YYYYMMDD/earnings.json
# 报告期自动推导(不再硬编码),按今天日期判断当前已到/正在披露的定期报告
# A股实际财报(主): RPT_LICO_FN_CPD,EITIME=实际公告时间(NOTICE_DATE只是报告期标注日,不是披露时间!)
# A股业绩预告: RPT_PUBLIC_OP_PREDICT,NOTICE_DATE即实际公告日(该接口无EITIME)
# 美股: 维护近期科技巨头财报窗口常量(无稳定curl源,标"惯例窗口估计")
import json, time, subprocess, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECTORS = json.load(open(os.path.join(ROOT, "skills/market-forecast/sectors.json")))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

today = datetime.date.today()
HEADERS = ["-H", "User-Agent: Mozilla/5.0", "-H", "Referer: https://data.eastmoney.com/"]


def period_end(d):
    # 由日期反推当前最近一个已过报告期末;按 0331/0630/0930/1231 四档
    y = d.year
    cands = [datetime.date(y, 3, 31), datetime.date(y, 6, 30),
             datetime.date(y, 9, 30), datetime.date(y, 12, 31),
             datetime.date(y - 1, 12, 31)]
    past = [c for c in cands if c <= d]
    return max(past)


def period_label(p):
    # 报告期末 -> 中文名
    return {3: "一季报", 6: "中报", 9: "三季报", 12: "年报"}[p.month]


REPORT = period_end(today)
RD = REPORT.strftime("%Y-%m-%d")
PREV = period_end(REPORT - datetime.timedelta(days=1))
PREV_RD = PREV.strftime("%Y-%m-%d")


def curl_json(url, retry=2):
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "20", url] + HEADERS,
                           capture_output=True, text=True)
        try:
            return json.loads(r.stdout)
        except Exception:
            time.sleep(1.0)
    return None


def paged(report, cols, filt, page_size=500, max_pages=20):
    # 分页抓全量(东财单页上限500,超过静默截断)
    out = []
    for p in range(1, max_pages + 1):
        url = ("https://datacenter-web.eastmoney.com/api/data/v1/get"
               f"?reportName={report}&columns={cols}"
               f"&filter={filt}&pageSize={page_size}&pageNumber={p}")
        d = curl_json(url)
        res = (d or {}).get("result")
        if not res:
            break
        out.extend(res.get("data") or [])
        if p >= res.get("pages", 1):
            break
        time.sleep(0.15)
    return out


def forecast_kind(inc_l):
    # 预告方向: INCREASEL>0=预喜, <0=预减
    try:
        v = float(inc_l)
    except Exception:
        return None
    if v > 0:
        return "预增" if v >= 30 else "略增"
    if v < 0:
        return "预减" if v <= -30 else "略减"
    return "持平"


# 1) 业绩预告(当前报告期)
fc_rows = paged("RPT_PUBLIC_OP_PREDICT",
                "SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE,REPORTDATE,INCREASEL,INCREASET,FORECASTCONTENT",
                f"(REPORTDATE='{RD}')", page_size=500, max_pages=20)
fc_map = {str(r.get("SECURITY_CODE", "")): r for r in fc_rows}

# 2) 实际财报(当前报告期),EITIME=实际公告时间
rep_rows = paged("RPT_LICO_FN_CPD",
                 "SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE,EITIME,"
                 "PARENT_NETPROFIT,SJLTZ,YSTZ,XSMLL,SJLHZ",
                 f"(REPORTDATE='{RD}')", page_size=500, max_pages=20)
rep_map = {str(r.get("SECURITY_CODE", "")): r for r in rep_rows}

# 3) 上期实际财报(用于算"本期是否已披露"和环比)
prev_rows = paged("RPT_LICO_FN_CPD",
                  "SECURITY_CODE,NOTICE_DATE,EITIME", f"(REPORTDATE='{PREV_RD}')",
                  page_size=500, max_pages=20)
prev_map = {str(r.get("SECURITY_CODE", "")): r for r in prev_rows}


def announce_dt(r):
    # 实际公告时间:优先 EITIME(完整时分),退回 NOTICE_DATE
    return (r.get("EITIME") or r.get("NOTICE_DATE") or "")[:19]


# 4) 按板块龙头聚合
a_leaders = []
for s in SECTORS["sectors"]:
    leaders = s.get("leaders", [])
    if not leaders:
        continue
    sec = {"sector": s["name"], "leaders": []}
    for ld in leaders:
        code = str(ld["code"])
        rep = rep_map.get(code)          # 已出实际财报
        fc = fc_map.get(code)            # 业绩预告
        item = {"code": code, "name": ld["name"]}
        if rep:
            item.update({
                "status": "已披露财报",
                "announce": announce_dt(rep),
                "netprofit": rep.get("PARENT_NETPROFIT"),
                "yoy": rep.get("SJLTZ"),        # 归母净利同比%
                "rev_yoy": rep.get("YSTZ"),     # 营收同比%
                "qoq": rep.get("SJLHZ"),        # 单季环比%
                "gross_margin": rep.get("XSMLL"),
            })
        elif fc:
            item.update({
                "status": "仅预告",
                "announce": (fc.get("NOTICE_DATE") or "")[:10],
                "kind": forecast_kind(fc.get("INCREASEL")),
                "increase_low": fc.get("INCREASEL"),
                "increase_high": fc.get("INCREASET"),
            })
        else:
            item["status"] = "未披露"
        sec["leaders"].append(item)
    a_leaders.append(sec)

# 5) 近期已公告(按实际公告时间倒序,取近3个自然日)
cutoff = (today - datetime.timedelta(days=3)).strftime("%Y-%m-%d")
recent = []
for r in rep_rows:
    dt = announce_dt(r)
    if dt >= cutoff:
        recent.append({"code": r.get("SECURITY_CODE"), "name": r.get("SECURITY_NAME_ABBR"),
                       "announce": dt, "yoy": r.get("SJLTZ"), "qoq": r.get("SJLHZ")})
recent.sort(key=lambda x: x["announce"], reverse=True)

# 6) 美股近期重要财报窗口(惯例估计,确切日以公司公告为准)
US_EARNINGS = [
    {"name": "Tesla", "window": "10月下旬", "report": "Q3 2026", "impact": "新能源车/智驾/机器人"},
    {"name": "Alphabet", "window": "10月下旬", "report": "Q3 2026", "impact": "AI应用/互联网/广告"},
    {"name": "Meta", "window": "10月下旬", "report": "Q3 2026", "impact": "AI应用/互联网/算力需求"},
    {"name": "Microsoft", "window": "10月下旬", "report": "财年Q1", "impact": "云计算/AI应用/办公软件"},
    {"name": "Amazon", "window": "10月底", "report": "Q3 2026", "impact": "云计算/电商/跨境物流"},
    {"name": "AMD", "window": "11月初", "report": "Q3 2026", "impact": "半导体/算力芯片"},
    {"name": "Apple", "window": "10月底", "report": "财年Q4", "impact": "消费电子/果链"},
    {"name": "Nvidia", "window": "11月下旬", "report": "财年Q3", "impact": "算力/CPO/半导体(最强传导)"},
]

n_rep = sum(1 for s in a_leaders for l in s["leaders"] if l.get("status") == "已披露财报")
n_fc = sum(1 for s in a_leaders for l in s["leaders"] if l.get("status") == "仅预告")
dst = os.path.join(OUT, "earnings.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"),
           "report_period": RD, "report_label": period_label(REPORT),
           "a_leaders": a_leaders,
           "a_leaders_note": f"各板块龙头{period_label(REPORT)};公告时间取EITIME(实际入库时间),非NOTICE_DATE(报告期标注日);港股龙头不在此A股接口",
           "recent_disclosed": recent,
           "recent_count": len(recent),
           "recent_note": f"近3日已公告{len(recent)}家(全量,按实际公告时间倒序)",
           "us": US_EARNINGS,
           "us_note": "美股窗口为惯例估计,确切日以公司公告为准"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[earnings] 报告期{period_label(REPORT)}({RD}) 龙头已披露财报{n_rep}家/仅预告{n_fc}家"
      f"/近3日公告{len(recent)}家 -> {dst}")
