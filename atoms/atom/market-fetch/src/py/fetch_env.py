#!/usr/bin/env python3
# 抓市场环境因子(宏观/地缘/商品/汇率/情绪),落盘 cache/YYYYMMDD/env.json
# 补 fetch_overseas.py 缺的维度:油价/汇率/VIX/亚太/国债期货/两融/金银比
# 这些是"影响市场的外部变量",与板块涨跌分开看
import json, time, subprocess, os

ROOT = os.environ.get("MARKET_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.environ.get("MARKET_OUT") or os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)
REF = "https://finance.sina.com.cn/"
EM = "https://quote.eastmoney.com/"


def curl(url, ref=REF):
    # 统一 curl,带 Referer 规避拦截;新浪 hq 接口返回 GBK,用 ignore 容错(只用数字字段)
    r = subprocess.run(["curl", "-s", "--max-time", "15", url, "-H", f"Referer: {ref}"],
                       capture_output=True)
    return r.stdout.decode("utf-8", errors="ignore") or r.stdout.decode("gbk", errors="ignore")


def sina_hf(sym):
    # 新浪外盘/期货 hf_ 前缀:取最新价与昨收算涨跌
    raw = curl(f"https://hq.sinajs.cn/list={sym}")
    try:
        body = raw.split('="')[1].rstrip('";\n')
        f = body.split(",")
        cur, prev = float(f[0]), float(f[7])
        if prev <= 0:
            return None
        return {"price": cur, "pct": round((cur / prev - 1) * 100, 2)}
    except Exception:
        return None


def sina_znb(sym):
    # 新浪全球指数 znb_:name,price,chg,pct,...
    raw = curl(f"https://hq.sinajs.cn/list={sym}")
    try:
        body = raw.split('="')[1].rstrip('";\n')
        f = body.split(",")
        return {"price": float(f[1]), "chg": float(f[2]), "pct": float(f[3])}
    except Exception:
        return None


def sina_fx(sym):
    # 新浪外汇 fx_:涨跌幅在倒数第4位附近,直接取第10位(涨跌额)算%
    raw = curl(f"https://hq.sinajs.cn/list={sym}")
    try:
        body = raw.split('="')[1].rstrip('";\n')
        f = body.split(",")
        cur = float(f[1]); prev = float(f[3]) if float(f[3]) > 0 else cur
        return {"price": cur, "pct": round((cur / prev - 1) * 100, 3)}
    except Exception:
        return None


env = {}

# 1) 原油(布伦特OIL/美油CL) —— 油价上冲=通胀预期升温+航空/化工成本压力,石油板块受益
for k, s in (("布伦特原油", "hf_OIL"), ("WTI原油", "hf_CL")):
    v = sina_hf(s)
    if v:
        env[k] = v

# 2) 贵金属(黄金/白银) —— 避险温度计;金银比走高=避险,走低=风险偏好回升
for k, s in (("COMEX黄金", "hf_GC"), ("COMEX白银", "hf_SI")):
    v = sina_hf(s)
    if v:
        env[k] = v
if "COMEX黄金" in env and "COMEX白银" in env:
    ratio = env["COMEX黄金"]["price"] / env["COMEX白银"]["price"]
    env["金银比"] = {"price": round(ratio, 1), "note": "走高=避险升温,走低=风险偏好回升"}

# 3) 汇率(离岸人民币) —— 人民币贬值→外资流出压力,港股/外资重仓股承压
v = sina_fx("fx_susdcnh")
if v:
    env["离岸人民币"] = v
    env["离岸人民币"]["note"] = "数值=1美元兑人民币,数值上行=人民币贬值"

# 4) VIX恐慌指数 —— >20=市场恐慌,>30=系统性风险
v = sina_znb("znb_VIX")
if v:
    env["VIX"] = v
    env["VIX"]["note"] = ">20恐慌,>30系统性风险,<15平静"

# 5) 亚太股指 —— A股开盘前的先行参考;日经/港股
for k, s in (("日经225", "znb_NKY"), ("恒生指数", "znb_HSI")):
    v = sina_znb(s)
    if v:
        env[k] = v
v = sina_hf("hf_NK")  # 日经期货
if v:
    env["日经225期货"] = v

# 6) 国债期货 —— 债涨=避险/宽松预期(利多成长),债跌=risk-on或资金紧(利空成长)
for k, s in (("5年期国债期货", "nf_TF0"), ("10年期国债期货", "nf_T0"), ("30年期国债期货", "nf_TL0")):
    raw = curl(f"https://hq.sinajs.cn/list={s}")
    try:
        body = raw.split('="')[1].rstrip('";\n')
        f = body.split(",")
        cur, prev = float(f[0]), float(f[7])
        if prev > 0:
            env[k] = {"price": cur, "pct": round((cur / prev - 1) * 100, 3),
                      "note": "债价涨=避险/宽松预期"}
    except Exception:
        pass

# 7) 两融余额(东财,滞后1日) —— 杠杆资金活跃度,连续下降=去杠杆
raw = curl("https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_RZRQ_LSHJ"
           "&columns=ALL&pageSize=2&sortColumns=DIM_DATE&sortTypes=-1", "https://data.eastmoney.com/")
try:
    d = json.loads(raw)["result"]["data"]
    env["两融余额"] = {"date": d[0]["DIM_DATE"][:10],
                     "balance": round(d[0]["NEW"], 1),
                     "chg_pct": d[0].get("ZDF"),
                     "chg_5d": d[0].get("ZDF5D"),
                     "note": "单位亿元,较上日/5日变化%;连续下降=杠杆资金撤离"}
except Exception:
    env["两融余额"] = {"error": "东财限频或接口变更"}

dst = os.path.join(OUT, "env.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "env": env},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[env] {len(env)} 个环境因子 -> {dst}")
for k, v in env.items():
    if "pct" in v:
        print(f"  {k:14s} {v['pct']:+7.2f}%")
