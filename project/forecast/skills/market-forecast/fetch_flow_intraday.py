#!/usr/bin/env python3
# 抓重点板块盘中逐分钟资金流(机构/游资/散户拆分),落盘 cache/YYYYMMDD/flow_intraday.json
# 东财 fflow/kline 接口: secid=90.BKxxxx, klt=1(1分钟), 返回逐分钟累计净流入
# 字段 f51时间 f52主力 f53小单(散户) f54中单(游资/大户) f55大单 f56超大单(累计值,差分得每分钟增量)
# ETF无资金拆分,改用东财行业板块(同fetch_flow.py口径);港股无fflow跳过
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECTORS = json.load(open(os.path.join(ROOT, "skills/market-forecast/sectors.json")))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

HOSTS = ["push2delay.eastmoney.com", "push2.eastmoney.com", "82.push2.eastmoney.com"]
HEADERS = ["-H", "User-Agent: Mozilla/5.0", "-H", "Referer: https://data.eastmoney.com/"]

# forecast板块名 → 东财行业板块名(相近映射);无对应的(机器人/红利低波/宽基/港股)跳过
MAP = {
    "半导体": "半导体", "CPO": "通信设备", "AI算力": "计算机设备", "AI应用": "软件开发",
    "消费电子": "消费电子", "新能源车": "电池", "光伏": "光伏设备",
    "创新药A股": "化学制药", "医药医疗": "医药生物", "食品饮料": "食品饮料",
    "银行": "银行Ⅱ", "券商": "证券Ⅱ", "军工": "国防军工", "有色金属": "有色金属",
    "煤炭": "煤炭", "钢铁": "钢铁", "房地产": "房地产开发", "农业种植": "农林牧渔",
    "稀土永磁": "小金属",
}


def curl(url, retry=2):
    # 多域名轮换+重试
    for attempt in range(retry + 1):
        host = HOSTS[attempt % len(HOSTS)]
        r = subprocess.run(["curl", "-s", "--max-time", "12", url.format(host=host)] + HEADERS,
                           capture_output=True, text=True)
        try:
            return json.loads(r.stdout)
        except Exception:
            time.sleep(0.8)
    return None


# Step1: 抓东财行业板块列表,建 {板块名: BK代码}
indu = {}
j = curl("http://{host}/api/qt/clist/get?pn=1&pz=200&po=1&np=1&fltt=2&fs=m:90+t:2&fields=f12,f14")
if j:
    for d in (j.get("data") or {}).get("diff", []) or []:
        indu[d.get("f14", "")] = d.get("f12", "")  # 东财名 → BK代码

# Step2: 对映射板块抓逐分钟资金流
result = {}
miss = []
for sname, ename in MAP.items():
    bk = indu.get(ename)
    if not bk:
        miss.append(f"{sname}→{ename}(东财无此板块)")
        continue
    j = curl("http://{host}/api/qt/stock/fflow/kline/get?secid=90." + bk +
             "&klt=1&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&lmt=0")
    k = (j or {}).get("data") or {}
    klines = k.get("klines") or []
    if not klines:
        miss.append(f"{sname}(fflow空/限频)")
        continue
    # 解析 klines "time,main,retail,medium,big,superbig" 累计值
    pts = []
    for line in klines:
        p = line.split(",")
        if len(p) < 6:
            continue
        pts.append({"t": p[0], "main": float(p[1]), "retail": float(p[2]),
                    "medium": float(p[3]), "big": float(p[4]), "superbig": float(p[5])})
    result[sname] = {"bk": bk, "ename": ename, "points": len(pts), "klines": pts}

dst = os.path.join(OUT, "flow_intraday.json")
json.dump({"date": DATE, "ts": time.strftime("%H:%M:%S"),
           "fields": "main主力=超大+大(机构),retail小单(散户),medium中单(游资/大户),big大单,superbig超大单 均为累计净流入(元)",
           "sectors": result, "miss": miss,
           "note": "累计值随时间累积;每分钟增量=后-前;尾盘值=当日收盘主力/游资/散户净额"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[flow_intraday] {len(result)}板块盘中分时资金流 -> {dst}")
if miss:
    print(f"  缺失: {', '.join(miss)}")
