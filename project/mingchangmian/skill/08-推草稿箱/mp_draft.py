#!/usr/bin/env python3
# 把 article.json 通过「操作浏览器」发进公众号草稿箱（不走微信 API，因此不受 IP 白名单限制）
#
# 用法:
#   cd skill/08-推草稿箱
#   python3 mp_draft.py <article.json 路径> [--author 署名] [--head-image x.gif] [--no-save]
#
# 首次跑（或浏览器 profile 失效）会让你扫码登录。登录态存在持久化 profile 里，
# 之后不用反复扫 —— 直到公众号会话过期。
import argparse, base64, json, os, re, sys, time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/Library/Caches/mingchangmian-mp-profile")  # 比 /tmp 长寿
EDITOR = ("https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit"
          "&type=10&isMul=1&createType=0&lang=zh_CN&token=%s")
HOME = "https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=%s"
LOGIN_WAIT = 360      # 扫码等待上限（秒）
AUTH_INPUT = "#author"        # 可见的 input
DESC_INPUT = "#js_description"  # 可见的 textarea（摘要）
SAVE_BTN = "text=保存为草稿"


# ---------- Markdown → 微信编辑器能接受的 HTML ----------
def _inline(s):
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)


def md_to_html(md):
    out = []
    for b in md.split("\n\n"):
        b = b.strip()
        if not b:
            continue
        if b.startswith("> "):
            out.append("<blockquote><p>%s</p></blockquote>" % _inline(b[2:].strip()))
        else:
            out.append("<p>%s</p>" % _inline(b.replace("\n", "<br>")))
    return "".join(out)


def _pick(root, sel, timeout=10):
    """同一选择器常有多个副本（浮层里的隐藏副本），只有一个是可见的 —— 遍历着点"""
    t0 = time.time()
    while time.time() - t0 < timeout:
        loc = root.locator(sel)
        for i in range(loc.count()):
            try:
                if loc.nth(i).is_visible():
                    return loc.nth(i)
            except Exception:
                pass
        time.sleep(0.5)
    return None


def _js_click_text(page, txt):
    """按文字点 button（绕过蒙层拦截）"""
    return page.evaluate("""(t)=>{let hit=false;
        document.querySelectorAll('button').forEach(b=>{
          if((b.innerText||'').trim()===t && b.getBoundingClientRect().width>0
             && !b.className.includes('disabled')){b.click(); hit=true;}});
        return hit;}""", txt)


def _btn_enabled(page, txt, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = page.evaluate("""(t)=>{let r=null;
            document.querySelectorAll('button').forEach(b=>{
              if((b.innerText||'').trim()===t && b.getBoundingClientRect().width>0)
                r={dis:b.className.includes('disabled')};});
            return r;}""", txt)
        if st and not st["dis"]:
            return True
        time.sleep(0.7)
    return False


def _mouse_click_sel(page, sel, nth=0):
    """用真实鼠标点元素的中心 —— JS .click() 对 Vue 的选中态**不生效**（实测 2026-10-17），
    必须发真实鼠标事件。"""
    box = page.evaluate("""([s,n])=>{const e=document.querySelectorAll(s)[n];
        if(!e) return null; const r=e.getBoundingClientRect();
        if(r.width<2||r.height<2) return null;
        return {x:r.x+r.width/2, y:r.y+r.height/2};}""", [sel, nth])
    if not box:
        return False
    page.mouse.move(box["x"], box["y"]); time.sleep(0.3)
    page.mouse.click(box["x"], box["y"]); return True


def _close_dialog(page):
    """把挡在保存按钮前面的弹窗关掉（不然「保存为草稿」点不到）"""
    for sel in ["button:has-text('取消')", ".weui-desktop-dialog__close-btn"]:
        el = _pick(page, sel, 3)
        if el:
            try:
                el.click(timeout=4000); time.sleep(2)
                print("   已关掉挡住的弹窗", flush=True)
                return True
            except Exception:
                pass
    return False


def cover_is_set(page):
    """封面到底设上了没有。

    ⚠️ 只看 `.js_cover_preview_new` 有没有 `mmbiz` 背景图。**别信这两样**：
    - 那句「拖拽或选择封面」文案：封面**设上了它照样显示**；
    - `.js_share_type_image`：封面设上了它仍是 `display:none`。
    2026-10-17 实测：封面已在列表显示缩略图，编辑页这两处却都还是「未设」的样子 ——
    拿它们判定会得到假阴性。
    """
    return bool(page.evaluate("""()=>{const d=document.querySelector('.js_cover_preview_new');
        if(!d) return false;
        const bg=getComputedStyle(d).backgroundImage||'';
        return bg.includes('mmbiz') || (bg.includes('url(') && !bg.includes('svg'));}"""))


def set_cover_from_body(page):
    """把正文里第一张图设为封面。

    微信的封面**必须来自正文已有图片或图片库**，没有「直接上传本地文件」的入口
    （对话框只有：从正文选择 / 从图片库选择 / 微信扫码上传 / 一键生成封面）。

    ⚠️ 2026-10-17 实测的坑：
    1. 弹窗里的缩略图是 **`span.appmsg_content_img`（background-image，不是 `<img>`）**，
       旧选择器找 `.weui-desktop-dialog img` 必然落空；
    2. 选中它**必须用真实鼠标点击**，JS `.click()` 不触发 Vue 的选中态 →「下一步」一直 disabled。
       而且点完后要等「下一步」从 disabled 变可用；
    3. 裁切页按钮是 **「上一步 / 确认」**，**不叫「完成」**；
    4. **封面区的选择器必须精确**：`[class*='js_cover_btn_area']` 在**编辑已有草稿**的页面里
       会连下拉菜单（`pop-opr__group js_cover_opr js_cover_btn_area`）一起匹配到，
       取错元素会让 hover 干等 30 秒超时（fix_draft 路上踩到）。
       用 `.select-cover__btn.js_cover_btn_area`（复合类名，唯一）或 `#js_cover_area`。

    失败不影响文章本身，返回 False 让调用方继续（但要记得关掉弹窗）。
    """
    try:
        b = _pick(page, ".select-cover__btn.js_cover_btn_area", 8) or _pick(page, "#js_cover_area", 8)
        if not b:
            print("   ! 找不到封面区", flush=True)
            return False
        # hover 让下拉浮层出现（失败就重试，别一口气干等 30 秒）
        c = None
        for _ in range(3):
            try:
                b.hover(timeout=6000); time.sleep(2)
            except Exception:
                pass
            c = _pick(page, "a.js_selectCoverFromContent", 4)
            if c:
                break
            print("   · 下拉浮层没出来，重试 hover", flush=True)
        if not c:
            print("   ! 找不到『从正文选择』", flush=True)
            return False
        c.click(); time.sleep(5)

        if not _mouse_click_sel(page, "span.appmsg_content_img"):
            print("   ! 弹窗里没有可选的图", flush=True)
            return False
        time.sleep(2)
        if not _btn_enabled(page, "下一步", 12):
            print("   ! 选了图但『下一步』没启用", flush=True)
            return False
        _js_click_text(page, "下一步"); time.sleep(5)
        # 裁切页：按钮是「上一步 / 确认」（**不叫「完成」** —— 2026-10-17 实测）
        got_it = False
        for name in ["确认", "完成", "确定"]:
            if _btn_enabled(page, name, 8):
                _js_click_text(page, name)
                got_it = True
                print("   裁切页点『%s』" % name, flush=True)
                time.sleep(5)
                break
        if not got_it:
            print("   ! 裁切页没找到确认按钮", flush=True)
            return False
        # 校验：靠 `.js_cover_preview_new` 有没有 mmbiz 背景图判断
        # （别用 `js_share_type_image` 或「拖拽或选择封面」文案 —— 封面设上了它们也不变，
        #  见 cover_is_set 的注释）
        shown = cover_is_set(page)
        print("   %s 封面%s" % ("✓" if shown else "?", "已设为正文首图" if shown else "状态未确认"),
              flush=True)
        return bool(shown)
    except Exception as e:
        print("   ! 设封面失败:", str(e)[:90], flush=True)
        return False


def md_to_plain(md):
    return re.sub(r"^> ", "", re.sub(r"\*\*(.+?)\*\*", r"\1", md), flags=re.M)


def head_img_tag(path):
    """把图片变成内联 data: URI 的 <p><img></p>，用于拼进待粘贴的 HTML。

    ⚠️ 不要试图去点编辑器工具栏的「图片」按钮上传 —— 实测 5 种点法（文本选择器 /
    精确类选择器 / force 点击 / JS click / 鼠标坐标）全部无效，会静默失败或点到正文上。
    正确做法是**本地把整篇 HTML 组装好、一次性粘贴**：微信的粘贴处理器认得 data: URI，
    会自己把它转成正文图片。这是唯一跑通的路径（2026-10-09 验证）。
    """
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    # display:block 是必须的 —— 图片当行内元素时，宿主段落的 line-height 会小于图片高度，
    # 微信会弹「内容结构检测：行高小于字体大小，可能导致文字重叠」拦你一道（点「继续插入」也能过，
    # 但每次都被拦很烦）。设成块级就没有行高问题了。
    return ('<p><img style="display:block;max-width:100%%;margin:0 auto" '
            'src="data:image/gif;base64,%s"></p>' % b64)


# ---------- 登录 ----------
def _find_token_page(ctx):
    """在 context 的**所有**页面里找带 token 的后台页。

    ⚠️ 不能只看最初那个 page：扫码成功后，微信常常**另开一个标签页**打开后台，
    原登录页会一直停在「扫码成功」不动 —— 脚本傻等 360 秒后超时（2026-10-17 踩到）。
    """
    for pg in list(ctx.pages):
        try:
            u = pg.url
        except Exception:
            continue
        if "token=" in u and "cgi-bin" in u:
            return u.split("token=")[1].split("&")[0], pg
    return None, None


def ensure_login(ctx, page):
    """返回 (token, 后台页)；未登录则提示扫码并等待"""
    page.goto("https://mp.weixin.qq.com/", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    tok, pg = _find_token_page(ctx)
    if tok:
        print("[✓] 已有登录态", flush=True)
    else:
        print("=" * 58, flush=True)
        print(">>> 请在弹出的 Chrome 窗口里扫码登录公众号 <<<", flush=True)
        print("=" * 58, flush=True)
        t0 = time.time()
        while time.time() - t0 < LOGIN_WAIT:
            tok, pg = _find_token_page(ctx)
            if tok:
                break
            time.sleep(2)
        else:
            sys.exit("[✗] 扫码等待超时")
        print("[✓] 登录成功", flush=True)
    return tok, pg


# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description="浏览器发公众号草稿")
    ap.add_argument("article", help="article.json 路径")
    ap.add_argument("--author", default=None, help="作者署名（默认取 .env 的 AUTHOR_NAME）")
    ap.add_argument("--head-image", default=None,
                    help="正文开头插入的图片（建议 640 宽的 GIF，360 宽会在正文里糊）")
    ap.add_argument("--no-save", action="store_true", help="只填不保存（挑错用）")
    ap.add_argument("--shot-dir", default="/tmp", help="截图输出目录")
    args = ap.parse_args()

    art = json.loads(open(args.article, encoding="utf-8").read())
    for k in ("title", "body_markdown"):
        if not art.get(k):
            sys.exit("article.json 缺少字段: " + k)

    author = args.author
    if not author:
        env = os.path.join(os.path.dirname(os.path.abspath(args.article)), "../../../.env")
        try:
            for line in open(env, encoding="utf-8"):
                if line.startswith("AUTHOR_NAME="):
                    author = line.split("=", 1)[1].strip()
        except OSError:
            pass
        author = author or "名场面档案"

    os.makedirs(PROFILE, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        except Exception:
            pass
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        tok, back = ensure_login(ctx, page)
        # 扫码成功后微信会另开标签页；用那个后台页继续，别在登录页上干活
        page = back or page
        print("[1] token = %s...  打开编辑器" % tok[:8], flush=True)
        page.goto(EDITOR % tok, wait_until="domcontentloaded", timeout=60000)
        time.sleep(8)

        # 关掉可能弹出的引导层
        for sel in ["text=我知道了", "button:has-text('我知道了')"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1500):
                    el.click(); print("   已关掉引导弹窗", flush=True); time.sleep(1); break
            except Exception:
                pass

        # 标题 = 第 1 个 ProseMirror（#title 那个 textarea 是隐藏镜像，高 0，不能用）
        print("[2] 标题...", flush=True)
        ttl = page.locator("div.ProseMirror").nth(0)
        ttl.click(); time.sleep(0.6)
        # ⚠️ 先清空：标题框可能残留自动填充的字符，直接 type 会拼出脏标题
        page.keyboard.press("Meta+a"); time.sleep(0.3)
        page.keyboard.press("Backspace"); time.sleep(0.6)
        page.keyboard.type(art["title"], delay=8); time.sleep(1)

        print("[3] 作者...", flush=True)
        try:
            page.fill(AUTH_INPUT, author)
        except Exception as e:
            print("   ! 作者字段:", str(e)[:70], flush=True)

        print("[4] 摘要...", flush=True)
        try:
            page.fill(DESC_INPUT, art.get("digest", ""))
        except Exception as e:
            print("   ! 摘要字段:", str(e)[:70], flush=True)

        # 正文 = 第 2 个 ProseMirror
        print("[5] 正文...", flush=True)
        ed = page.locator("div.ProseMirror").nth(1)
        ed.click(); time.sleep(0.6)
        html, plain = md_to_html(art["body_markdown"]), md_to_plain(art["body_markdown"])
        if args.head_image and os.path.exists(args.head_image):
            print("   拼入头图: %s" % os.path.basename(args.head_image), flush=True)
            html = head_img_tag(args.head_image) + html
        # ⚠️ 必须**先真的删干净**再粘，不能指望「全选后粘贴覆盖」：
        #    ProseMirror 里 Cmd+A 的选中范围不稳定，粘贴会变成「追加」——
        #    实测连跑 3 次就贴了 3 份，正文 797 字变 1589 字、头图出现 3 张（2026-10-09 踩到）。
        #    所以：全选 + 退格删掉，回读确认为空，再粘。
        ed.click(); time.sleep(0.5)
        for _ in range(3):
            page.keyboard.press("Meta+a"); time.sleep(0.4)
        page.keyboard.press("Backspace"); time.sleep(1.2)
        left = ed.inner_text().strip()
        if left:
            print("   清空后仍有 %d 字，再删一次" % len(left), flush=True)
            page.keyboard.press("Meta+a"); time.sleep(0.4)
            page.keyboard.press("Backspace"); time.sleep(1.2)
            left = ed.inner_text().strip()
        print("   清空后正文 %d 字" % len(left), flush=True)

        try:
            page.evaluate("""([h,t])=>navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([h],{type:'text/html'}),
                'text/plain': new Blob([t],{type:'text/plain'})})])""", [html, plain])
            time.sleep(1); page.keyboard.press("Meta+v"); time.sleep(5)
        except Exception as e:
            print("   剪贴板粘贴失败，回退 execCommand:", str(e)[:80], flush=True)
        got = ed.inner_text()
        if len(got) < 200:
            page.evaluate("(h)=>document.execCommand('insertHTML',false,h)", html); time.sleep(3)
            got = ed.inner_text()
        if len(got) < 200:
            print("   回退逐字输入（慢）", flush=True)
            ed.type(plain, delay=1); time.sleep(2)
            got = ed.inner_text()

        title_v = page.locator("div.ProseMirror").nth(0).inner_text()
        print("[6] 回读：标题 %d 字 / 正文 %d 字" % (len(title_v), len(got)), flush=True)
        page.screenshot(path=os.path.join(args.shot_dir, "mp_filled.png"), full_page=True)

        # 内容不完整就绝不保存，避免往草稿箱塞废稿
        if len(title_v) < 5 or len(got) < 200:
            print("[✗] 内容不完整，已中止（未保存）。看 mp_filled.png", flush=True)
            time.sleep(60); ctx.close(); sys.exit(3)

        if args.no_save:
            print("[*] --no-save：填完了但不保存，浏览器留 90 秒", flush=True)
            time.sleep(90); ctx.close(); return

        # 封面：只能取自正文已有的图，所以要在头图粘进正文之后做
        if args.head_image:
            print("[7] 设封面（从正文首图）...", flush=True)
            set_cover_from_body(page)
            page.screenshot(path=os.path.join(args.shot_dir, "mp_cover.png"), full_page=True)

        # 粘完头图后，微信可能弹「内容结构检测」挡在保存按钮前面（行高/嵌套之类）。
        # 它是警告不是硬拦，点「继续插入」就能过 —— 但不点的话，「保存为草稿」根本点不到。
        for _ in range(3):
            hit = False
            for sel in ["button:has-text('继续插入')", "text=继续插入"]:
                try:
                    b = page.locator(sel).first
                    if b.count() and b.is_visible(timeout=1200):
                        b.click(timeout=4000)
                        print("   已关掉『内容结构检测』弹窗", flush=True)
                        hit = True; time.sleep(1.5); break
                except Exception:
                    pass
            if not hit:
                break

        print("[8] 保存为草稿...", flush=True)
        # ⚠️ 封面/结构检测的弹窗如果还开着，会挡住保存按钮 —— 先清干净
        _close_dialog(page)
        ok = False
        for sel in [SAVE_BTN, "button:has-text('保存为草稿')"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2500):
                    el.click(); ok = True; break
            except Exception:
                pass
        if not ok:
            # 兜底：JS 直接点（前面弹窗残留时 Playwright 的 click 会判定被遮挡）
            ok = page.evaluate("""()=>{let hit=false;
                document.querySelectorAll('button').forEach(b=>{
                  if((b.innerText||'').trim()==='保存为草稿' && b.getBoundingClientRect().width>0){
                    b.click(); hit=true;}});return hit;}""")
        if not ok:
            sys.exit("[✗] 找不到『保存为草稿』按钮")
        time.sleep(10)

        # 回读校验：底部状态条出现「已保存」才算真存进去了（防止「静默成功」）
        saved = page.evaluate("""()=>{const t=document.body.innerText;
            return /已保存/.test(t) ? (t.match(/\\d\\d:\\d\\d\\s*已保存[^\\n]*/)||['已保存'])[0] : '';}""")
        page.screenshot(path=os.path.join(args.shot_dir, "mp_saved.png"), full_page=True)
        if saved:
            print("[✓] 已保存（状态条：%s）。截图 %s/mp_saved.png" % (saved, args.shot_dir), flush=True)
        else:
            print("[?] 点了保存但没看到『已保存』状态 —— 去草稿箱核对！截图 %s/mp_saved.png"
                  % args.shot_dir, flush=True)
        print("[!] 浏览器留 60 秒供你核对", flush=True)
        time.sleep(60)
        ctx.close()


if __name__ == "__main__":
    main()
