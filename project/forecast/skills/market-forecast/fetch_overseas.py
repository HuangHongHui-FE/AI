#!/usr/bin/env python3
# 抓隔夜外盘与期货先行指标(新浪),落盘 cache/YYYYMMDD/overseas.json
# 纳指/费半/标普走新浪美股;A50期指/恒指期货走新浪期货hf_前缀
import json, time, subprocess, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

UA = "Mozilla/5.0"
REF = "https://finance.sina.com.cn/"
# 外盘指数(新浪美股) code->中文名映射
US = {"gb_$ndx": "纳指", "gb_$sox": "费半", "gb_$inx": "标普500"}
# 期货(新浪hf_)
HF = {"hf_CHA50CFD": "富时A50期指", "hf_HSI": "恒指期货"}
# 全球利率/美元(东财,171=债券收益率市场 100=指数市场):美债收益率是全球资产定价锚,美元指数影响外资流向
EM = {"171.US10Y": "美债10Y", "171.US30Y": "美债30Y", "171.US2Y": "美债2Y",
      "171.CN10Y": "中国10Y国债", "100.UDI": "美元指数"}


def curl_sina(codes):
    # 批量抓新浪行情,GBK解码返回文本
    url = f"https://hq.sinajs.cn/list={','.join(codes)}"
    r = subprocess.run(["curl", "-s", "--max-time", "15", url, "-H", f"Referer: {REF}",
                         "-H", f"User-Agent: {UA}"], capture_output=True)
    return r.stdout.decode("gbk", errors="replace")


def curl_em(secid):
    # 抓东财单只行情(fltt=2返回真实小数),失败返回None
    url = (f"https://push2delay.eastmoney.com/api/qt/stock/get?secid={secid}"
           f"&fields=f43,f58,f169,f170,f86&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b")
    r = subprocess.run(["curl", "-s", "--max-time", "10", url, "-A", UA], capture_output=True)
    try:
        return json.loads(r.stdout.decode("utf-8", errors="replace")).get("data")
    except Exception:
        return None


overseas = {}
txt = curl_sina(list(US.keys()))
for line in txt.splitlines():
    m = re.match(r'var hq_str_([\w$]+)="(.*)";', line.strip())  # [\w$]兼容美股代码的$符
    if not m:
        continue
    sc, raw = m.groups()
    f = raw.split(",")
    if sc in US and len(f) > 2:
        overseas[US[sc]] = {"price": float(f[1]), "pct": float(f[2]), "time": f[3]}

txt = curl_sina(list(HF.keys()))
for line in txt.splitlines():
    m = re.match(r'var hq_str_([\w$]+)="(.*)";', line.strip())
    if not m:
        continue
    sc, raw = m.groups()
    f = raw.split(",")
    if sc in HF and len(f) > 7:
        price, settle = float(f[0]), float(f[7])  # [0]现价 [7]昨结
        overseas[HF[sc]] = {"price": price, "pct": round((price - settle) / settle * 100, 2) if settle else 0,
                            "time": f[6], "qdate": f[12]}

# 债券收益率/美元指数走东财(单只循环,加间隔防限频);chg=涨跌额(bp),pct%对收益率参考意义弱
for secid, name in EM.items():
    d = curl_em(secid)
    if d and d.get("f43") is not None:
        overseas[name] = {"price": d["f43"], "pct": d.get("f170", 0), "chg": d.get("f169", 0),
                          "time": time.strftime("%H:%M:%S", time.localtime(d["f86"])) if d.get("f86") else ""}
    time.sleep(0.6)

# 中美利差(中国10Y-美国10Y):负值扩大=人民币贬值压力/外资流出压力,是港股与外资敏感板块的核心先行
if "中国10Y国债" in overseas and "美债10Y" in overseas:
    overseas["中美利差"] = {"price": round(overseas["中国10Y国债"]["price"] - overseas["美债10Y"]["price"], 4),
                            "pct": 0, "chg": 0, "time": overseas["美债10Y"]["time"]}

dst = os.path.join(OUT, "overseas.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "indicators": overseas},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[overseas] {len(overseas)} indicators -> {dst}")
