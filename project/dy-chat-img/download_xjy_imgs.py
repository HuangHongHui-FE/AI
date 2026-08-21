#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 许家印被判处无期徒刑热点·强相关图片批量下载
# 数据源：360图片接口 + 必应cn（兜底），按标题相关性+尺寸过滤，输出到指定目录
import json, os, re, subprocess, sys, time, urllib.parse

OUT = sys.argv[1] if len(sys.argv) > 1 else "xjy_imgs"
os.makedirs(OUT, exist_ok=True)

UA_M = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1"
UA_PC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# 关键词池：人物/品牌 + 事件组合，覆盖宣判/庭审/债务危机/清盘退市等维度
KEYWORDS = [
    "许家印 宣判", "许家印 无期徒刑", "许家印 庭审", "许家印 出庭",
    "许家印 被捕", "许家印 满头白发", "恒大 债务危机", "恒大 烂尾楼",
    "中国恒大 清盘", "恒大 退市", "恒大集团 判决", "许家印 恒大 结局",
]

# 强相关事件词：标题命中则判定强相关
EVENT_WORDS = ["宣判", "无期", "判决", "庭审", "法庭", "法院", "被捕", "抓", "调查",
               "债务", "清盘", "退市", "危机", "烂尾", "判刑", "服刑", "入狱", "落马",
               "白发", "审判", "羁押", "失信", "追缴", "没收", "罚金", "房产", "资产", "结局", "被抓"]
# 人物/品牌词：必须命中其一
SUBJECT_WORDS = ["许家印", "恒大"]

def fetch_360(kw, page=0):
    """360 图片接口，翻页 sn=page*30"""
    q = urllib.parse.quote(kw)
    url = f"https://image.so.com/j?q={q}&src=tab_www&sn={page*30}&pn=30"
    try:
        out = subprocess.run(["curl", "-s", "-m", "20", "-A", UA_M,
                              "-H", "Referer: https://image.so.com/", url],
                             capture_output=True, text=True, timeout=25).stdout
        d = json.loads(out)
        items = []
        for it in d.get("list", []):
            img = it.get("img") or it.get("thumb")
            if not img:
                continue
            items.append({"title": it.get("title", ""), "url": img,
                          "w": int(it.get("width") or 0), "h": int(it.get("height") or 0)})
        return items
    except Exception as e:
        return []

def fetch_bing(kw, page=0):
    """必应cn 兜底，解析 murl"""
    q = urllib.parse.quote(kw)
    url = f"https://cn.bing.com/images/search?q={q}&form=HDRSC2&first={page*35+1}"
    try:
        out = subprocess.run(["curl", "-s", "-m", "20", "-A", UA_PC,
                              "-H", "Referer: https://cn.bing.com/", url],
                             capture_output=True, text=True, timeout=25).stdout
        urls = re.findall(r'murl&quot;:&quot;(https?://[^&"]+?)&quot;', out)
        items = []
        for u in urls:
            items.append({"title": "", "url": u.replace("\\/", "/"), "w": 0, "h": 0})
        return items
    except Exception:
        return []

def is_strong(item):
    """强相关判定：标题含人物/品牌词 且 含事件词；标题为空的按候选保留"""
    t = item.get("title", "")
    if not t:
        return False
    if not any(w in t for w in SUBJECT_WORDS):
        return False
    return any(w in t for w in EVENT_WORDS)

def is_subject(item):
    """弱相关：仅含人物/品牌词"""
    t = item.get("title", "")
    return any(w in t for w in SUBJECT_WORDS)

def dl(url, path):
    """带防盗链下载，返回字节数"""
    try:
        subprocess.run(["curl", "-s", "-m", "30", "-A", UA_M,
                        "-H", "Referer: https://image.so.com/",
                        "-e", "https://image.so.com/", "-o", path, url],
                       check=True, timeout=35)
        return os.path.getsize(path)
    except Exception:
        return 0

def sniff(path):
    """按文件头识别真实格式并返回扩展名"""
    with open(path, "rb") as f:
        head = f.read(16)
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return "bin"

def main():
    seen, strong, weak = set(), [], []
    # 先抓取所有关键词的候选（360 每词翻 3 页 + 必应 1 页兜底）
    for kw in KEYWORDS:
        for pg in range(3):
            for it in fetch_360(kw, pg):
                if it["url"] in seen:
                    continue
                seen.add(it["url"])
                (strong if is_strong(it) else weak if is_subject(it) else None)
                if is_strong(it):
                    strong.append(it)
                elif is_subject(it):
                    weak.append(it)
        time.sleep(0.5)
        for it in fetch_bing(kw, 0):
            if it["url"] in seen:
                continue
            seen.add(it["url"])
            weak.append(it)
        time.sleep(0.5)
        print(f"[{kw}] 强相关累计 {len(strong)}，弱相关累计 {len(weak)}", flush=True)

    # 排序：强相关优先，且优先大图；弱相关仅作补位
    pool = strong + weak
    order = sorted(pool, key=lambda it: (it in strong, it["w"] * it["h"]), reverse=True)
    print(f"\n候选池共 {len(order)} 张（强相关 {len(strong)} / 弱相关 {len(weak)}），开始下载...")

    got, n = 0, 1
    for it in order:
        if got >= 50:
            break
        u = it["url"]
        # 尺寸过滤：横竖任意一边>=300，且宽高比不太极端
        w, h = it["w"], it["h"]
        if w and h and (max(w, h) < 300 or w / h > 4 or h / w > 4):
            continue
        tmp = f"{OUT}/_tmp_{n}"
        size = dl(u, tmp)
        if size < 5000:
            continue
        ext = sniff(tmp)
        if ext == "bin":
            os.remove(tmp)
            continue
        path = f"{OUT}/{got+1:03d}.{ext}"
        os.rename(tmp, path)
        tag = "强" if it in strong else "弱"
        print(f"[{got+1:03d}][{tag}] {os.path.getsize(path)//1024}KB {w}x{h} {u[:70]}", flush=True)
        got += 1
        n += 1

    print(f"\n完成：下载 {got} 张到 {OUT}/")
    if got < 50:
        print("未达 50 张，可换关键词或降低筛选强度重跑")

if __name__ == "__main__":
    main()
