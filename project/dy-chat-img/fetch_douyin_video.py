# 抓取抖音视频播放地址
from playwright.sync_api import sync_playwright
import re

URL = "https://www.iesdouyin.com/share/video/7001523570132208937/?region=CN"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1",
                        viewport={"width": 390, "height": 844}, locale="zh-CN")
    page = ctx.new_page()
    vs = []
    page.on("request", lambda r: vs.append(r.url) if (r.url.endswith('.mp4') or '.mp4?' in r.url) else None)
    page.on("response", lambda r: vs.append(r.url) if (r.url.endswith('.mp4') or '.mp4?' in r.url) else None)
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(8000)
    # 也从DOM/HTML提取video src
    src = page.evaluate(r'''() => { const v=document.querySelector('video'); return v ? (v.src || v.currentSrc || '') : '' }''')
    html = page.content()
    b.close()

print("video src(dom):", src[:200] if src else "(空)")
mp4 = re.findall(r'https?://[^"\'\s<>\\]+\.mp4[^"\'\s<>\\]*', html)
print(f"html中mp4 URL: {len(mp4)}")
for u in mp4[:5]: print("  ", u[:150])
vs = list(dict.fromkeys(vs))
print(f"网络请求mp4: {len(vs)}")
for u in vs[:5]: print("  ", u[:150])
