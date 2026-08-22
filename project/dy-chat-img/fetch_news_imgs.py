#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 从事件报道正文抓强相关图：WebSearch 拿到的新闻链接 → curl 抓页 → 提取正文图 URL → 下载
# 用法: python3 fetch_news_imgs.py <输出目录> <新闻URL...>
# 说明: 适用于刚发生的热点（图库未建立索引，通用图搜搜不到事件图）——从具体报道正文挖配图最可行
import os, re, subprocess, sys, time

UA_PC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

def main():
    outdir = sys.argv[1]
    urls = sys.argv[2:]
    os.makedirs(outdir, exist_ok=True)
    # 各新闻站 Referer（部分站防盗链校验）
    refs = {
        "sina": "https://news.sina.com.cn/", "ifeng": "https://ishare.ifeng.com/",
        "hsw": "https://news.hsw.cn/", "qq": "https://news.qq.com/",
        "btime": "https://item.btime.com/", "scol": "https://focus.scol.com.cn/",
        "eastmoney": "https://caifuhao.eastmoney.com/", "sohu": "https://m.sohu.com/",
        "cnr": "https://news.cnr.cn/", "southcn": "https://news.southcn.com/",
    }
    def pick_ref(url):
        for k, v in refs.items():
            if k in url:
                return v
        return "https://www.baidu.com/"

    got, seen = 0, set()
    # 编号接续目录已有最大号，避免补抓覆盖旧图
    existing = [int(m.group(1)) for f in os.listdir(outdir) if (m := re.match(r"(\d+)\.(?:jpg|png)$", f))]
    start = max(existing) + 1 if existing else 1
    for url in urls:
        fn = f"/tmp/np_{re.sub(r'[^0-9a-zA-Z]','',url)[-12:]}.html"
        try:
            subprocess.run(["curl", "-s", "-m", "20", "-A", UA_PC,
                            "-H", f"Referer: {pick_ref(url)}",
                            "-H", "Accept-Language: zh-CN,zh;q=0.9",
                            "-L", url, "-o", fn], timeout=30)
        except Exception:
            continue
        if not os.path.exists(fn):
            print(f"[skip] {url} curl 失败无文件")
            continue
        html = open(fn, encoding="utf-8", errors="ignore").read()
        if len(html) < 5000:
            print(f"[skip] {url} 页面过小(动态渲染/拦截) {len(html)}B")
            continue
        # 提取正文图：排除 logo/icon/avatar/banner/qrcode/默认小图
        imgs = re.findall(r'https?://[^\s"\'<>\\]+\.(?:jpe?g|png|webp)', html)
        imgs = [u for u in imgs if not re.search(r'(logo|icon|avatar|banner|qrcode|/img/|\.css|w20h20|w100h100)', u)]
        imgs = list(dict.fromkeys(imgs))
        print(f"[{url[:50]}] 提取 {len(imgs)} 张候选图")
        for u in imgs:
            if got >= 3:
                break  # 每篇最多取3张，避免吞版头图
            if u in seen:
                continue
            # 新浪图用原始 URL（改尺寸参数会触发反爬返回 XML）
            out = f"{outdir}/{start+got:03d}.jpg"
            ext = u.rsplit(".", 1)[-1].lower()
            subprocess.run(["curl", "-s", "-m", "15", "-A", UA_PC,
                            "-H", f"Referer: {pick_ref(url)}",
                            "-o", out, u], timeout=20)
            sz = os.path.getsize(out)
            if sz < 8000:
                os.remove(out)
                continue
            # 识别真实格式，非图片删掉
            with open(out, "rb") as f:
                head = f.read(8)
            if head[:3] != b"\xff\xd8\xff" and head[:8] != b"\x89PNG\r\n\x1a\n" and head[:4] != b"RIFF":
                os.remove(out)
                continue
            if ext not in ("jpg", "png") or ext == "webp":
                os.rename(out, f"{outdir}/{start+got:03d}.{ext if ext in ('jpg','png') else 'png'}")
            seen.add(u)
            print(f"  [{start+got:03d}] {sz//1024}KB {u[:80]}")
            got += 1
        time.sleep(0.5)
    print(f"\n完成：抓取 {got} 张报道正文图到 {outdir}/")

if __name__ == "__main__":
    main()
