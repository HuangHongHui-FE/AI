#!/usr/bin/env python3
# 只读核对：列出公众号草稿箱现有草稿（标题 / 更新时间 / 有没有封面）。
# **不做任何写入**。保存后想确认「到底存进去没有」就跑这个 ——
# 别信脚本的「已保存」，看这里的时间戳。
#
# 用法:
#   cd skill/08-推草稿箱
#   python3 list_drafts.py
import json, os, sys, time
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_draft import PROFILE, ensure_login, _pick  # noqa: E402

SHOT_DIR = os.environ.get("MP_SHOT_DIR", os.path.expanduser("~/.hermes/cache/scratch/mp"))

CARDS = """()=>[...document.querySelectorAll('.weui-desktop-card')].map((c,i)=>{
  const th=c.querySelector('.weui-desktop-publish__cover__thumb');
  const bg=th?getComputedStyle(th).backgroundImage:'';
  return {i, txt:(c.innerText||'').replace(/\\s+/g,' ').trim().slice(0,80),
          hasCover: !!bg && bg!=='none' && bg.length>40};})"""


def main():
    os.makedirs(SHOT_DIR, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            tok, back = ensure_login(ctx, page)
            page = back or page
            page.goto("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=%s" % tok,
                      wait_until="domcontentloaded", timeout=60000)
            time.sleep(6)
            # 草稿箱必须从左侧菜单进（直接拼 URL 会是空的）
            m = _pick(page, "text=内容管理", 10)
            if m:
                m.click(); time.sleep(2)
            s = _pick(page, "text=草稿箱", 10)
            if s:
                s.click()
            time.sleep(14)
            cards = page.evaluate(CARDS)
            tab = page.evaluate("()=>{const m=document.body.innerText.match(/文章\\s*\\d+/);"
                                "return m?m[0]:'';}")
            print("草稿箱 %d 篇（%s）:" % (len(cards), tab), flush=True)
            for c in cards:
                print("  [%d] %s | 封面=%s" % (c["i"], c["txt"], c["hasCover"]), flush=True)
            page.screenshot(path=os.path.join(SHOT_DIR, "list_drafts.png"), full_page=True)
            print("截图 %s/list_drafts.png" % SHOT_DIR, flush=True)
            time.sleep(3)
        finally:
            try:
                ctx.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()
