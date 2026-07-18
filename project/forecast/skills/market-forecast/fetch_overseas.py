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


def curl_sina(codes):
    # 批量抓新浪行情,GBK解码返回文本
    url = f"https://hq.sinajs.cn/list={','.join(codes)}"
    r = subprocess.run(["curl", "-s", "--max-time", "15", url, "-H", f"Referer: {REF}",
                         "-H", f"User-Agent: {UA}"], capture_output=True)
    return r.stdout.decode("gbk", errors="replace")


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

dst = os.path.join(OUT, "overseas.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"), "indicators": overseas},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[overseas] {len(overseas)} indicators -> {dst}")
