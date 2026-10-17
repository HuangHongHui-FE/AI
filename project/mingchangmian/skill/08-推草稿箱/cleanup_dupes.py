#!/usr/bin/env python3
# 清理重复草稿：保留有封面的那篇，删掉其余同名无封面的
import json, os, time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/Library/Caches/mingchangmian-mp-profile")
OUT = "/Users/hongenhuang/.hermes/cache/scratch/mp"
KEEP = "夏洛特烦恼拿鱼叉的袁华"


def pick(root, sel, timeout=8):
    t0 = time.time()
    while time.time() - t0 < timeout:
        loc = root.locator(sel)
        for i in range(loc.count()):
            try:
                if loc.nth(i).is_visible():
                    return loc.nth(i)
            except Exception:
                pass
        time.sleep(0.4)
    return None


CARDS = """()=>[...document.querySelectorAll('.weui-desktop-card')].map((c,i)=>{
  const th=c.querySelector('.weui-desktop-publish__cover__thumb');
  const bg=th?getComputedStyle(th).backgroundImage:'';
  return {i, txt:(c.innerText||'').replace(/\\s+/g,' ').trim().slice(0,60),
          hasCover: !!bg && bg!=='none' && bg.length>40};})"""


with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=False,
                                               args=["--start-maximized"], viewport=None)
    page = None
    for pg in ctx.pages:
        if "token=" in pg.url and "cgi-bin" in pg.url:
            page = pg
    if not page:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://mp.weixin.qq.com/", wait_until="domcontentloaded"); time.sleep(5)
        for pg in ctx.pages:
            if "token=" in pg.url and "cgi-bin" in pg.url:
                page = pg
    tok = page.url.split("token=")[1].split("&")[0]
    page.goto("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=%s" % tok,
              wait_until="domcontentloaded", timeout=60000)
    time.sleep(6)
    m = pick(page, "text=内容管理", 10)
    if m:
        m.click(); time.sleep(2)
    s = pick(page, "text=草稿箱", 10)
    if s:
        s.click()
    time.sleep(12)

    for rnd in range(15):
        cards = page.evaluate(CARDS)
        print("[%d] %d 篇: %s" % (rnd, len(cards),
              json.dumps([(c["i"], c["txt"][-8:], c["hasCover"]) for c in cards], ensure_ascii=False)),
              flush=True)
        victims = [c for c in cards if KEEP in c["txt"] and not c["hasCover"]]
        if not victims:
            print("清理完毕", flush=True)
            break
        v = victims[0]
        card = page.locator(".weui-desktop-card").nth(v["i"])
        card.scroll_into_view_if_needed(); time.sleep(1)
        card.hover(); time.sleep(2)
        # 该卡片里第 1 个 icon-btn = 删除（第 2 个是编辑，第 3 个是发表）
        icon = page.locator(".weui-desktop-card").nth(v["i"]) \
                   .locator(".weui-desktop-publish__opr a.weui-desktop-icon-btn").first
        if not icon.is_visible():
            print("   ! 图标不可见", flush=True)
            break
        icon.hover(); time.sleep(1.5)
        icon.click(); time.sleep(3)
        # 可见 popover 里的「删除」
        pop = page.locator(".weui-desktop-popover:visible").first
        btn = pop.get_by_role("button", name="删除").first
        if not btn.count():
            btn = pop.locator("button", has_text="删除").first
        print("   确认删除:", btn.count() > 0, flush=True)
        if btn.count():
            btn.click(); time.sleep(5)
        else:
            page.screenshot(path=os.path.join(OUT, "cleanup_fail.png"), full_page=True)
            break

    cards = page.evaluate(CARDS)
    print("最终 %d 篇: %s" % (len(cards),
          json.dumps([(c["i"], c["txt"][-8:], c["hasCover"]) for c in cards], ensure_ascii=False)),
          flush=True)
    page.screenshot(path=os.path.join(OUT, "draftbox_final.png"), full_page=True)
    time.sleep(2)
    ctx.close()
