#!/usr/bin/env python3
# 把成片发布到微信视频号（浏览器自动化）—— 默认只存草稿，不发表
#
# 用法（仓库根目录）:
#   python3 skill/B4-发视频号/publish.py "名场面/成品/019-爆笑吕子乔 肾宝，味道好极了.mp4" \
#       --desc "肾宝，味道好极了#名场面 #孙艺洲" --short "吕子乔这段肾宝广告 太洗脑了"
#
# 首次跑（或会话过期）会弹 Chrome 让你扫码登录视频号助手，登录态存在持久化 profile 里。
# 加 --publish 才真正点「发表」，默认只点「保存草稿」。
import argparse, os, re, sys, time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/Library/Caches/mingchangmian-mp-profile")
LOGIN_WAIT = 300

# 视频号短标题的字符限制（用户 2026-10-08 给的规则）：
# 只允许 书名号、引号、冒号、加号、问号、百分号、摄氏度；逗号要用空格代替。
# ⚠️ 违反这条平台不报错，只是「保存草稿」静默失败 —— 实测卡了很久才定位到。
SHORT_ALLOWED_PUNCT = set("《》「」“”‘’：:+？%℃")
SHORT_BANNED = set("，。、；！,.;!·—～~()（）【】[]{}<>/\\|@#$^&*=")


def clean_short_title(s):
    """按平台规则清洗短标题：非法标点换成空格，压缩多余空格"""
    out = []
    for ch in s:
        if ch in SHORT_ALLOWED_PUNCT:
            out.append(ch)
        elif ch in SHORT_BANNED:
            out.append(" ")
        else:
            out.append(ch)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def frame_by_locator(page, sel, tries=25, gap=3):
    """按 locator 能否解析到来选 frame。

    ⚠️ 这个页面是 Wujie 微前端，**frame.evaluate 里的 document 和 locator 看到的不是同一个文档**：
    evaluate 查 `document.querySelector('.post-upload-wrap')` 能命中，
    但同一个 frame 上 `locator('.post-upload-wrap')` 却解析不到。
    所以选 frame、探状态、点按钮**一律用 locator**，不要用 evaluate。
    """
    for _ in range(tries):
        for f in list(page.frames):
            try:
                if f.locator(sel).count() > 0:
                    return f
            except Exception:
                pass
        time.sleep(gap)
    return None


def main():
    ap = argparse.ArgumentParser(description="发视频号（默认存草稿）")
    ap.add_argument("video", help="成片路径")
    ap.add_argument("--desc", required=True, help="视频描述（惯例：<台词>#名场面 #人物>）")
    ap.add_argument("--short", default="", help="短标题（会自动清洗非法标点）")
    ap.add_argument("--publish", action="store_true", help="真正点发表（默认只存草稿）")
    ap.add_argument("--profile", default=PROFILE, help="浏览器持久化 profile 目录")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit("找不到视频：" + args.video)
    short = clean_short_title(args.short)
    if args.short and short != args.short:
        print("[!] 短标题已按平台规则清洗：\n    原 %r\n    新 %r" % (args.short, short), flush=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            args.profile, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto("https://channels.weixin.qq.com/platform/",
                      wait_until="domcontentloaded", timeout=60000)
            time.sleep(10)
            if "login" in page.url:
                print("=" * 58, flush=True)
                print(">>> 请用微信扫浏览器里的二维码，登录视频号助手 <<<", flush=True)
                print("=" * 58, flush=True)
                t0 = time.time()
                while time.time() - t0 < LOGIN_WAIT and "login" in page.url:
                    time.sleep(3)
                if "login" in page.url:
                    sys.exit("[✗] 扫码等待超时")
                page.goto("https://channels.weixin.qq.com/platform/", timeout=60000)
                time.sleep(8)

            print("[1] 进发布页", flush=True)
            page.click("text=发表视频", timeout=15000); time.sleep(12)

            print("[2] 上传", flush=True)
            fup = frame_by_locator(page, ".ant-upload-drag-container")
            if not fup:
                sys.exit("[✗] 找不到上传区")
            with page.expect_file_chooser(timeout=20000) as fc:
                fup.locator(".ant-upload-drag-container").first.click(timeout=10000)
            fc.value.set_files(args.video)

            print("[3] 等描述框（上传后才挂载）", flush=True)
            fr = frame_by_locator(page, ".input-editor[contenteditable]", tries=40)
            if not fr:
                sys.exit("[✗] 找不到描述框")

            print("[4] 填视频描述", flush=True)
            el = fr.locator(".input-editor[contenteditable]").first
            for _ in range(5):
                el.click(timeout=6000); time.sleep(0.8)
                page.keyboard.type(args.desc, delay=28); time.sleep(1.5)
                if el.evaluate("e=>e.innerText").strip():
                    break
                time.sleep(2)

            if short:
                print("[5] 填短标题", flush=True)
                inp = fr.locator('input[placeholder*="短标题"]').first
                inp.click(timeout=6000); time.sleep(0.5)
                page.keyboard.type(short, delay=30); time.sleep(1.5)
                print("    ✓ %r" % inp.input_value(), flush=True)

            btn = "发表" if args.publish else "保存草稿"
            print("[6] 点『%s』（**发布不可逆**）" % btn, flush=True)
            fr.locator("button").filter(has_text=btn).last.click(timeout=8000)
            time.sleep(40)   # 别急着跳走，保存是异步的
            page.screenshot(path="/tmp/vh_result.png")

            print("[7] 核实：进草稿箱看计数", flush=True)
            page.mouse.click(44, 205); time.sleep(6)   # 左侧第 2 个图标 = 内容管理
            page.evaluate("""()=>{const els=[...document.querySelectorAll('a,div,span,li')]
                .filter(e=>(e.innerText||'').trim()==='草稿箱');
                if(els.length){const e=els[els.length-1];(e.closest('a')||e).click();}}""")
            time.sleep(15)
            page.screenshot(path="/tmp/vh_draftbox.png", full_page=True)
            print("    草稿箱页已截图 /tmp/vh_draftbox.png，请人工核对计数", flush=True)
            time.sleep(20)
        finally:
            try: ctx.close()
            except Exception: pass


if __name__ == "__main__":
    main()
