#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 贴图热点搜图：主体词(subject) × 事件词(events) 组合，360图片+必应cn 下载强相关图
# 用法: python3 search_hot_imgs.py <主体词> <事件词逗号分隔> <输出目录> [目标张数]
# 示例: python3 search_hot_imgs.py 许家印 "无期徒刑,宣判,判决,庭审,被捕,清盘" 贴图热点/20260821-许家印 50
import json, os, re, subprocess, sys, time, urllib.parse

def main():
    subject = sys.argv[1] if len(sys.argv) > 1 else "热点主体"
    events = [s.strip() for s in (sys.argv[2] if len(sys.argv) > 2 else "热点,事件").split(",")]
    outdir = sys.argv[3] if len(sys.argv) > 3 else "贴图热点"
    need = int(sys.argv[4]) if len(sys.argv) > 4 else 50
    os.makedirs(outdir, exist_ok=True)

    UA_M = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1"
    UA_PC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    # 关键词池 = 主体×事件 组合 + 主体本身，覆盖不同维度
    kws = [f"{subject} {e}" for e in events] + [subject]
    # 事件命中词：事件词列表本身（含事件+主体词都算相关）
    def is_strong(t):
        if not t or subject not in t:
            return False
        return any(e in t for e in events) or any(e in subject for e in [""]) and True
    def is_subject(t):
        return subject in t or any(e in t for e in events)

    def fetch_360(kw, pg=0):
        """360 图片接口翻页，带 title 供相关性判定"""
        url = f"https://image.so.com/j?q={urllib.parse.quote(kw)}&src=tab_www&sn={pg*30}&pn=30"
        try:
            out = subprocess.run(["curl", "-s", "-m", "20", "-A", UA_M,
                                  "-H", "Referer: https://image.so.com/", url],
                                 capture_output=True, text=True, timeout=25).stdout
            items = []
            for it in json.loads(out).get("list", []):
                img = it.get("img") or it.get("thumb")
                if img:
                    items.append({"title": it.get("title", ""), "url": img,
                                  "w": int(it.get("width") or 0), "h": int(it.get("height") or 0)})
            return items
        except Exception:
            return []

    def fetch_bing(kw):
        """必应 cn 兜底，解析 murl"""
        url = f"https://cn.bing.com/images/search?q={urllib.parse.quote(kw)}&form=HDRSC2&first=1"
        try:
            out = subprocess.run(["curl", "-s", "-m", "20", "-A", UA_PC,
                                  "-H", "Referer: https://cn.bing.com/", url],
                                 capture_output=True, text=True, timeout=25).stdout
            return [{"title": "", "url": u.replace("\\/", "/"), "w": 0, "h": 0}
                    for u in re.findall(r'murl&quot;:&quot;(https?://[^&"]+?)&quot;', out)]
        except Exception:
            return []

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
        """按文件头识别真实格式返回扩展名"""
        with open(path, "rb") as f:
            head = f.read(16)
        if head[:3] == b"\xff\xd8\xff":
            return "jpg"
        if head[:8] == b"\x89PNG\r\n\x1a\n":
            return "png"
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            return "webp"
        return "bin"

    # 抓取全部关键词候选（360 每词 3 页 + 必应 1 页兜底）
    seen, strong, weak = set(), [], []
    for kw in kws:
        for pg in range(3):
            for it in fetch_360(kw, pg):
                if it["url"] in seen:
                    continue
                seen.add(it["url"])
                (strong if is_strong(it["title"]) else weak if is_subject(it["title"]) else None)
                if is_strong(it["title"]):
                    strong.append(it)
                elif is_subject(it["title"]):
                    weak.append(it)
        time.sleep(0.4)
        for it in fetch_bing(kw):
            if it["url"] in seen:
                continue
            seen.add(it["url"])
            weak.append(it)
        time.sleep(0.4)
        print(f"[{kw}] 强相关 {len(strong)} / 弱相关 {len(weak)}", flush=True)

    # 排序：强相关优先 + 大图优先；弱相关仅补位
    pool = strong + weak
    order = sorted(pool, key=lambda it: (it in strong, it["w"] * it["h"]), reverse=True)
    print(f"\n候选池 {len(order)} 张（强相关 {len(strong)}），开始下载目标 {need} 张...")

    got, n = 0, 1
    titles = {}
    for it in order:
        if got >= need:
            break
        w, h = it["w"], it["h"]
        if w and h and (max(w, h) < 300 or w / h > 4 or h / w > 4):
            continue
        tmp = f"{outdir}/_tmp_{n}"
        if dl(it["url"], tmp) < 5000:
            continue
        ext = sniff(tmp)
        if ext == "bin":
            os.remove(tmp)
            continue
        path = f"{outdir}/{got+1:03d}.{ext}"
        os.rename(tmp, path)
        titles[os.path.basename(path)] = it["title"]
        print(f"[{os.path.basename(path)}] {os.path.getsize(path)//1024}KB {w}x{h}", flush=True)
        got += 1
        n += 1

    # 生成 manifest 供用户核验来源
    with open(f"{outdir}/manifest.md", "w", encoding="utf-8") as f:
        f.write(f"# {subject} 热点图片（{len(titles)} 张）\n\n")
        for fn in sorted(titles):
            f.write(f"- `{fn}` — {titles[fn] or '（无标题候选，已按强相关排序）'}\n")
    print(f"\n完成：{got} 张存入 {outdir}/，清单见 manifest.md")
    if got < need:
        print("未达目标张数，可补充事件词或放宽筛选重跑")

if __name__ == "__main__":
    main()
