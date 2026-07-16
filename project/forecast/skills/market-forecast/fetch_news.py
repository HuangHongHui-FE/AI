#!/usr/bin/env python3
# 抓当日财经快讯(东财快讯接口),落盘 cache/YYYYMMDD/news.txt;东财限频则降级留空
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

URL = ("http://np-listapi.eastmoney.com/comm/web/getFastNewsList?"
       "client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=30&pageNo=1")


def fetch(retry=2):
    # 抓东财7x24快讯,带重试;东财限频返回异常结构,降级
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "15", URL,
                             "-H", "User-Agent: Mozilla/5.0",
                             "-H", "Referer: https://news.eastmoney.com/"],
                            capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            items = data["data"]["list"]
            if items:
                return items
        except Exception:
            time.sleep(1.0)
    return None


items = fetch()
dst = os.path.join(OUT, "news.txt")
if not items:
    open(dst, "w", encoding="utf-8").write("[news] 抓取失败,消息面缺失\n")
    print(f"[news] FAIL -> {dst}")
    raise SystemExit(0)

lines = []
for it in items:
    # 每条:时间 + 标题/摘要
    t = time.strftime("%H:%M", time.localtime(it.get("showTime", 0) / 1000)) if it.get("showTime") else ""
    title = it.get("title", "") or it.get("digest", "")
    lines.append(f"{t} {title}")

open(dst, "w", encoding="utf-8").write("\n".join(lines))
print(f"[news] {len(lines)} items -> {dst}")
