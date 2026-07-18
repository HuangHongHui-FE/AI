#!/usr/bin/env python3
# 抓当日财经快讯,落盘 cache/YYYYMMDD/news.txt
# 双源互补: 东财7x24(偏A股) + 新浪7x24(偏全球外围);东财限频时新浪兜底
import json, time, subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = time.strftime("%Y%m%d")
OUT = os.path.join(ROOT, "cache", DATE)
os.makedirs(OUT, exist_ok=True)

# 东财7x24快讯(A股偏多)
URL_EM = ("http://np-listapi.eastmoney.com/comm/web/getFastNewsList?"
          "client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=30&pageNo=1")
# 新浪7x24(全球财经,zhibo_id=152)
URL_SINA = ("https://zhibo.sina.com.cn/api/zhibo/feed?"
            "page=1&page_size=40&zhibo_id=152&tag_id=0&type=0&dire=f&dpc=1")


def curl(url, ref, retry=2):
    for _ in range(retry + 1):
        r = subprocess.run(["curl", "-s", "--max-time", "15", url,
                            "-H", "User-Agent: Mozilla/5.0", "-H", f"Referer: {ref}"],
                           capture_output=True, text=True)
        if r.stdout:
            try:
                return json.loads(r.stdout)
            except Exception:
                pass
        time.sleep(1.0)
    return None


def fetch_em():
    # 东财7x24: showTime毫秒时间戳 + title/digest
    d = curl(URL_EM, "https://news.eastmoney.com/")
    items = []
    try:
        for it in (d["data"]["list"] or []):
            t = time.strftime("%H:%M", time.localtime(it["showTime"] / 1000)) if it.get("showTime") else ""
            items.append((t, it.get("title", "") or it.get("digest", ""), "东财"))
    except Exception:
        pass
    return items


def fetch_sina():
    # 新浪7x24: create_time字符串 + rich_text
    d = curl(URL_SINA, "https://finance.sina.com.cn/")
    items = []
    try:
        for it in d["result"]["data"]["feed"]["list"]:
            ct = (it.get("create_time", "") or "")[11:16]  # 取 HH:MM
            txt = it.get("rich_text", "") or ""
            # 去HTML标签
            import re
            txt = re.sub(r"<[^>]+>", "", txt).strip()
            if txt:
                items.append((ct, txt, "新浪"))
    except Exception:
        pass
    return items


# 双源合并,按时间倒序,去重(标题前15字相同视为重复)
em, sina = fetch_em(), fetch_sina()
all_items = em + sina
seen, lines = set(), []
for t, txt, src in sorted(all_items, reverse=True):
    key = txt[:15]
    if key in seen:
        continue
    seen.add(key)
    lines.append(f"[{src}] {t} {txt}")

dst = os.path.join(OUT, "news.txt")
if not lines:
    open(dst, "w", encoding="utf-8").write("[news] 双源均失败,消息面缺失\n")
    print(f"[news] FAIL (东财+新浪均限频) -> {dst}")
    raise SystemExit(0)

open(dst, "w", encoding="utf-8").write("\n".join(lines))
print(f"[news] 东财{len(em)}+新浪{len(sina)}条 合并去重{len(lines)}条 -> {dst}")
