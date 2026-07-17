from playwright.sync_api import sync_playwright
import os
import re
import argparse

parser = argparse.ArgumentParser(description='下载抖音图文/图片型视频中的高清原图')
parser.add_argument('--url', required=True, help='抖音分享链接或 note 页面链接')
parser.add_argument('--out', default='douyin_raw_imgs', help='图片保存目录')
args = parser.parse_args()

os.makedirs(args.out, exist_ok=True)

saved = []
counter = [0]

def save_image(response):
    try:
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('image/'):
            return
        # 跳过太小的图标/头像
        body = response.body()
        if len(body) < 10000:
            return
        # 跳过已知的 UI/装饰图
        url_lower = response.url.lower()
        skip_patterns = ['douyinstatic.com', 'web_extension', 'wallpaper', 'im-resource',
                         'chat_days', 'plant_tree', 'jxweakbtn', '100x100', 'aweme-avatar']
        if any(p in url_lower for p in skip_patterns):
            return
        ext = 'jpg'
        if 'png' in content_type:
            ext = 'png'
        elif 'webp' in content_type:
            ext = 'webp'
        counter[0] += 1
        path = f'{args.out}/img_{counter[0]:03d}.{ext}'
        with open(path, 'wb') as f:
            f.write(body)
        saved.append((path, response.url, len(body)))
        print(f"saved {path} ({len(body)} bytes)")
    except Exception as e:
        print(f"error saving response: {e}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
        locale="zh-CN",
    )
    page = context.new_page()
    page.on("response", save_image)

    page.goto(args.url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(5000)

    # 移除登录弹窗和遮罩
    for _ in range(3):
        page.evaluate('''() => {
            const selectors = [
                '[class*="login"]', '[class*="Login"]', '[class*="modal"]', '[class*="Modal"]',
                '[class*="mask"]', '[class*="Mask"]', '[class*="overlay"]', '[class*="dialog"]'
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 300 && rect.height > 300) {
                        el.style.display = 'none';
                    }
                });
            });
            document.body.style.overflow = 'auto';
        }''')
        page.wait_for_timeout(2000)

    # 滚动页面触发懒加载
    page.evaluate('''() => {
        window.scrollTo(0, document.body.scrollHeight);
    }''')
    page.wait_for_timeout(5000)

    browser.close()

print(f"\ntotal saved: {len(saved)}")
for path, url, size in saved:
    print(f"{path} | {size} bytes | {url[:80]}...")
