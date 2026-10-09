#!/usr/bin/env python3
# 修补已有公众号草稿：进草稿箱 → 找到 → 编辑 → 清空正文 → 重贴（带头图）→ 设封面 → 保存
#
# 为什么不新建：新建会多出一篇重复稿。编辑已有草稿是原地替换，草稿箱不会变多。
#
# 用法:
#   python3 fix_draft.py <关键词> <article.json> [--head-image x.gif]
import argparse, base64, json, os, re, sys, time
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_draft import md_to_html, md_to_plain, head_img_tag, set_cover_from_body, _pick  # noqa

PROFILE = os.path.expanduser("~/Library/Caches/mingchangmian-mp-profile")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keyword", help="草稿标题里的关键词，用来定位")
    ap.add_argument("article")
    ap.add_argument("--head-image", default=None)
    args = ap.parse_args()

    art = json.loads(open(args.article, encoding="utf-8").read())
    html, plain = md_to_html(art["body_markdown"]), md_to_plain(art["body_markdown"])
    if args.head_image and os.path.exists(args.head_image):
        html = head_img_tag(args.head_image) + html
        print("拼入头图:", os.path.basename(args.head_image), flush=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            ctx.grant_permissions(["clipboard-read", "clipboard-write"])
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            tok = json.load(open("/tmp/mp_session.json"))["token"]
            page.goto("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=%s" % tok,
                      wait_until="domcontentloaded", timeout=60000); time.sleep(8)
            page.click("text=内容管理", timeout=15000); time.sleep(2)
            page.click("text=草稿箱", timeout=15000); time.sleep(8)
            for _ in range(8):
                if args.keyword in page.inner_text("body"):
                    break
                time.sleep(3)
            print("[1] 定位到草稿:", args.keyword, flush=True)

            page.hover("text=" + args.keyword); time.sleep(2)
            n0 = len(ctx.pages)
            page.locator("a.weui-desktop-icon-btn").nth(1).click(); time.sleep(10)
            ed = ctx.pages[-1] if len(ctx.pages) > n0 else page
            ed.bring_to_front(); time.sleep(4)

            body = ed.locator("div.ProseMirror").nth(1)
            print("[2] 编辑前正文 %d 字 / 图 %d 张"
                  % (len(body.inner_text()), ed.locator("div.ProseMirror img").count()), flush=True)

            # 清空（必须真删，不能靠粘贴覆盖 —— ProseMirror 的 Cmd+A 选中范围不稳定）
            body.click(); time.sleep(0.5)
            for _ in range(3):
                ed.keyboard.press("Meta+a"); time.sleep(0.4)
            ed.keyboard.press("Backspace"); time.sleep(1.5)
            left = body.inner_text().strip()
            if left:
                ed.keyboard.press("Meta+a"); time.sleep(0.4)
                ed.keyboard.press("Backspace"); time.sleep(1.5)
                left = body.inner_text().strip()
            print("[3] 清空后 %d 字" % len(left), flush=True)

            print("[4] 粘贴（含头图）", flush=True)
            ed.evaluate("""([h,t])=>navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([h],{type:'text/html'}),
                'text/plain': new Blob([t],{type:'text/plain'})})])""", [html, plain])
            time.sleep(1); ed.keyboard.press("Meta+v"); time.sleep(6)
            now = ed.locator("div.ProseMirror img").count()
            print("    正文 %d 字 / 图 %d 张" % (len(body.inner_text()), now), flush=True)

            if args.head_image:
                print("[5] 设封面", flush=True)
                set_cover_from_body(ed)

            print("[6] 关弹窗 + 保存", flush=True)
            for _ in range(3):
                hit = False
                for sel in ["button:has-text('继续插入')", "text=继续插入"]:
                    try:
                        b = ed.locator(sel).first
                        if b.count() and b.is_visible(timeout=1200):
                            b.click(timeout=4000); hit = True; time.sleep(1.5); break
                    except Exception:
                        pass
                if not hit:
                    break
            done = False
            for sel in ["text=保存为草稿", "button:has-text('保存为草稿')", "text=保存"]:
                b = _pick(ed, sel, 8)
                if b:
                    b.click(timeout=6000); done = True
                    print("    ✓ 已保存", flush=True); break
            if not done:
                print("    ✗ 没找到保存按钮", flush=True)
            time.sleep(10)
            ed.screenshot(path="/tmp/fix_out.png", full_page=True)
            print("[7] 留 40 秒", flush=True); time.sleep(40)
        finally:
            try: ctx.close()
            except Exception: pass


if __name__ == "__main__":
    main()
