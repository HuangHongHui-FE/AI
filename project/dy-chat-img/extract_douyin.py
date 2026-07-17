from playwright.sync_api import sync_playwright
import json, re, sys

url = "https://www.douyin.com/note/7658269272149539961?previous_page=app_code_link"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
        locale="zh-CN",
    )
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(10000)

    # 尝试从页面内容中提取图片 URL
    html = page.content()
    # 抖音图片常见域名
    imgs = re.findall(r'https?://[^"\'\s<>]+\.(?:jpg|jpeg|png|webp)', html)
    imgs = list(set(imgs))

    # 保存所有 URL
    with open('douyin_images.txt', 'w', encoding='utf-8') as f:
        for u in imgs:
            f.write(u + '\n')

    # 过滤可能的聊天记录图片：排除已知 UI/装饰图域名
    chat_imgs = []
    skip_domains = ['douyinstatic.com', 'byteimg.com/tos-cn-i-9r5gewecjs', 'byteimg.com/tos-cn-i-lkdc6loazq',
                    'douyin-web-extension', 'aweme-client-static-resource', 'resource-platform']
    for u in imgs:
        lower = u.lower()
        if any(d in lower for d in skip_domains):
            continue
        if 'douyinpic.com' in lower or 'tos-cn-i' in lower or 'byteimg.com' in lower:
            # 排除头像小图
            if '/aweme/100x100/' in lower or '/aweme-avatar/' in lower:
                continue
            chat_imgs.append(u)

    print(f"found {len(imgs)} total urls, {len(chat_imgs)} likely chat images")
    for u in chat_imgs[:30]:
        print(u)

    # 同时保存 HTML 供分析
    with open('douyin_rendered.html', 'w', encoding='utf-8') as f:
        f.write(html)

    browser.close()
