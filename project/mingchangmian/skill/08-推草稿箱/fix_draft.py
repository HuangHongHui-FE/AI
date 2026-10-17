#!/usr/bin/env python3
# 修补已有公众号草稿：进草稿箱 → 找到 → 编辑 → 清空正文 → 重贴（带头图）→ 设封面 → 保存
#
# 为什么不新建：新建会多出一篇重复稿。编辑已有草稿是原地替换，草稿箱不会变多。
#
# 用法:
#   python3 fix_draft.py <草稿标题关键词> <article.json> [--head-image x.gif]
#
# ⚠️ 2026-10-17 重写：旧版从 `/tmp/mp_session.json` 读 token，而**那个文件从来没人写过**
#    （mp_draft.py 不落盘 token），所以这条路一直是坏的。现在改成复用 mp_draft 的
#    `ensure_login()` —— 登录态在持久化 profile 里，本来也不需要 session 文件。
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_draft import (PROFILE, md_to_html, md_to_plain, head_img_tag,  # noqa: E402
                      set_cover_from_body, ensure_login, cover_is_set, _pick, _close_dialog)

SHOT_DIR = os.environ.get("MP_SHOT_DIR", os.path.expanduser("~/.hermes/cache/scratch/mp"))


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

    os.makedirs(SHOT_DIR, exist_ok=True)
    os.makedirs(PROFILE, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            try:
                ctx.grant_permissions(["clipboard-read", "clipboard-write"])
            except Exception:
                pass
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            tok, back = ensure_login(ctx, page)
            page = back or page

            # 草稿箱必须从左侧菜单进（直接拼 URL 是空的）
            page.goto("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=%s" % tok,
                      wait_until="domcontentloaded", timeout=60000)
            time.sleep(6)
            m = _pick(page, "text=内容管理", 10)
            if m:
                m.click(); time.sleep(2)
            s = _pick(page, "text=草稿箱", 10)
            if s:
                s.click()
            time.sleep(12)
            for _ in range(8):
                if args.keyword in page.inner_text("body"):
                    break
                time.sleep(3)
            print("[1] 定位到草稿:", args.keyword, flush=True)

            # 悬停卡片 → 第 2 个 icon-btn = 编辑（会开新标签页）
            card = page.locator(".weui-desktop-card").filter(has_text=args.keyword).first
            card.scroll_into_view_if_needed(); time.sleep(1)
            card.hover(); time.sleep(2)
            n0 = len(ctx.pages)
            card.locator(".weui-desktop-publish__opr a.weui-desktop-icon-btn").nth(1).click()
            time.sleep(10)
            ed = ctx.pages[-1] if len(ctx.pages) > n0 else page
            ed.bring_to_front(); time.sleep(5)
            ed.screenshot(path=os.path.join(SHOT_DIR, "fix_before.png"), full_page=True)

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
            chars = len(body.inner_text())
            print("    正文 %d 字 / 图 %d 张" % (chars, now), flush=True)
            if chars < 200:
                sys.exit("[✗] 正文只有 %d 字，粘贴失败，已中止（未保存）" % chars)

            if args.head_image:
                print("[5] 封面", flush=True)
                # ⚠️ 编辑已有草稿的页面里，封面区的下拉浮层**不吃自动化 hover**
                #    （2026-10-17 试过 hover 预览层/封面区/真实鼠标移入+微移/mousedown，
                #     `#js_cover_null` 始终 display:none）。所以先判断：
                #    封面已在（`.js_cover_preview_new` 有 mmbiz 背景图）就**跳过**，
                #    没在才尝试设，失败了就明确告警让人手动补 —— 不静默当成功。
                if cover_is_set(ed):
                    print("   ✓ 封面已在，跳过（改封面请手动操作）", flush=True)
                else:
                    print("   封面不在，尝试从正文首图设置...", flush=True)
                    if not set_cover_from_body(ed):
                        print("   ⚠️ 封面没设上 —— 编辑页的封面下拉不吃自动化。", flush=True)
                        print("      请手动：点左侧封面区 → 从正文选择 → 选图 → 下一步 → 确认",
                              flush=True)

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
            _close_dialog(ed)
            done = False
            for sel in ["text=保存为草稿", "button:has-text('保存为草稿')", "text=保存"]:
                b = _pick(ed, sel, 8)
                if b:
                    b.click(timeout=6000); done = True; break
            if not done:
                sys.exit("[✗] 没找到保存按钮")
            time.sleep(10)

            # 回读校验：状态条出现「已保存」才算真存进去
            saved = ed.evaluate("""()=>{const t=document.body.innerText;
                return /已保存/.test(t) ? (t.match(/\\d\\d:\\d\\d\\s*已保存[^\\n]*/)||['已保存'])[0] : '';}""")
            ed.screenshot(path=os.path.join(SHOT_DIR, "fix_after.png"), full_page=True)
            print("[✓] 已保存（状态条：%s）" % saved if saved
                  else "[?] 点了保存但没看到『已保存』—— 去草稿箱核对", flush=True)
            print("[7] 留 40 秒供核对", flush=True); time.sleep(40)
        finally:
            try:
                ctx.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()
