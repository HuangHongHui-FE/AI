from playwright.sync_api import sync_playwright
import os

os.makedirs('douyin_screenshots', exist_ok=True)

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
    page.wait_for_timeout(5000)

    # 尝试关闭或移除登录弹窗
    for attempt in range(3):
        page.evaluate('''() => {
            // 移除常见的登录弹窗、遮罩
            const selectors = [
                '[class*="login"]', '[class*="Login"]', '[class*="login-popup"]',
                '[class*="modal"]', '[class*="Modal"]', '[class*="mask"]', '[class*="Mask"]',
                '[class*="overlay"]', '[class*="dialog"]'
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    // 只移除覆盖全屏或接近全屏的
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 300 && rect.height > 300) {
                        el.style.display = 'none';
                    }
                });
            });
            // 移除 body 上的遮罩样式
            document.body.style.overflow = 'auto';
        }''')
        page.wait_for_timeout(2000)

    # 先截个整页看看
    page.screenshot(path='douyin_screenshots/fullpage.png', full_page=True)
    print("saved fullpage screenshot")

    # 获取所有图片元素
    imgs = page.query_selector_all('img')
    print(f"found {len(imgs)} img elements")

    # 按面积排序，截图前 30 张较大的
    boxes = []
    for i, img in enumerate(imgs):
        try:
            box = img.bounding_box()
            if box and box['width'] > 100 and box['height'] > 100:
                boxes.append((i, box, img))
        except:
            pass

    boxes.sort(key=lambda x: x[1]['width'] * x[1]['height'], reverse=True)

    for idx, (i, box, img) in enumerate(boxes[:30], 1):
        path = f'douyin_screenshots/img_{idx:02d}.png'
        try:
            img.screenshot(path=path)
            print(f"saved {path} ({int(box['width'])}x{int(box['height'])})")
        except Exception as e:
            print(f"failed {path}: {e}")

    browser.close()
