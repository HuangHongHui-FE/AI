# 提取抖音note页面图集高清原图URL并下载
from playwright.sync_api import sync_playwright
import re, os, urllib.request

URL = "https://v.douyin.com/VtJUN9NwyuU/"
OUT = "douyin_hd"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1",
                        viewport={"width": 390, "height": 844}, locale="zh-CN")
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(6000)
    page.evaluate(r'''() => { document.querySelectorAll('[class*="login"],[class*="modal"],[class*="mask"]').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width>300&&r.height>300) e.style.display='none'}); document.body.style.overflow='auto' }''')
    page.wait_for_timeout(2000)
    urls = page.evaluate(r'''() => {
      const s = new Set();
      document.querySelectorAll('img').forEach(i => { if(i.src) s.add(i.src); if(i.dataset.src) s.add(i.dataset.src); });
      document.querySelectorAll('source').forEach(s2 => { if(s2.srcset) s2.srcset.split(',').forEach(x=>s.add(x.trim().split(' ')[0])) });
      return [...s];
    }''')
    html = page.content()
    b.close()

img_urls = re.findall(r"https?://[^\"'\s<>\\]+douyinpic[^\"'\s<>\\]+", html)
img_urls += [u for u in urls if 'douyinpic' in u]
img_urls = list(dict.fromkeys(img_urls))
print(f"找到 {len(img_urls)} 个候选URL")

ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1"
n = 0
for u in img_urls:
    if any(x in u for x in ['100x100','avatar','emoji','rating-','static']):
        continue
    n += 1
    ext = '.jpg'
    if '.png' in u: ext = '.png'
    elif '.webp' in u: ext = '.webp'
    path = f"{OUT}/img_{n:03d}{ext}"
    try:
        req = urllib.request.Request(u, headers={'User-Agent': ua, 'Referer': 'https://www.douyin.com/'})
        data = urllib.request.urlopen(req, timeout=30).read()
        open(path, 'wb').write(data)
        print(f"saved {path} {len(data)}B")
    except Exception as e:
        print(f"fail {u[:80]}: {e}")
