#!/usr/bin/env python3
# 把成片发到微信视频号草稿箱（浏览器自动化）—— **只存草稿，绝不发表**。
#
# 用法:
#   python3 vh_draft.py "<成片路径>" --desc "<描述>" [--short "<短标题>"]
#
# 2026-10-17 复核：发布页选择器与 2026-10-10 停用时一致。与旧 publish.py 的差异：
#   1. 登录态判定不再只看 page.url（登录二维码是同 URL 页里的 iframe，会误判「已登录」）
#   2. 去掉 --publish，**本脚本永远只存草稿**
#   3. 等视频真正就绪（video.readyState）再填表，而不是只等描述框出现
#   4. 用 is_enabled() 判按钮状态（禁用态/可用态都是灰的，看截图分辨不出来）
#   5. 保存后抓 toast + 进草稿箱回读核对，不静默成功
import argparse, os, re, sys, time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/Library/Caches/mingchangmian-mp-profile")
LOGIN_WAIT = 420
SHOT_DIR = os.environ.get("VH_SHOT_DIR", os.path.expanduser("~/.hermes/cache/scratch/mp"))

# 视频号短标题字符白名单（用户 2026-10-08 给的规则）：
# 只允许 书名号《》/引号「」/冒号：/加号+/问号？/百分号%/摄氏度℃；逗号用空格代替。
# ⚠️ 违反这条平台**不报错**，只是「保存草稿」静默失败 —— 实测卡很久才定位到。
SHORT_ALLOWED_PUNCT = set("《》「」“”‘’：:+？%℃")
SHORT_BANNED = set("，。、；！,.;!·—～~()（）【】[]{}<>/\\|@#$^&*=")


def clean_short_title(s):
    out = []
    for ch in s:
        if ch in SHORT_ALLOWED_PUNCT:
            out.append(ch)
        elif ch in SHORT_BANNED:
            out.append(" ")
        else:
            out.append(ch)
    return re.sub(r"\s+", " ", "".join(out)).strip()


# 视频号短标题**硬上限 16 字**（2026-10-17 实测）。
# ⚠️ 超了平台**不报 toast、不弹窗**，只在输入框下面出红字「标题超过16字限制」，
#    然后「保存草稿」变灰点不动 —— 表现和「短标题非法标点」一样是**静默失败**。
#    别只看按钮灰不灰就以为是异步提交中。
SHORT_MAX_LEN = 16


def is_logged_in(page):
    """⚠️ 不能只看 page.url：登录二维码是同 URL 页面里嵌的 iframe，
    登录前后 URL 都是 /platform/。用 URL 判会误报「已是登录态」。"""
    for f in page.frames:
        try:
            if "connect/qrconnect" in f.url or "login.html" in f.url:
                return False
        except Exception:
            pass
    try:
        return page.locator("text=内容管理").count() > 0
    except Exception:
        return False


def frame_by_locator(page, sel, tries=25, gap=3):
    """按 locator 能否解析到来选 frame。

    ⚠️ Wujie 微前端：**frame.evaluate 的 document 和 locator 看到的不是同一个文档**。
    选 frame 一律用 locator，不要用 evaluate 判存在性。
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


def wait_video_ready(page, timeout=180):
    """等视频真正就绪：video.readyState>=2 且 duration>0。"""
    t0 = time.time()
    while time.time() - t0 < timeout:
        for f in list(page.frames):
            try:
                st = f.evaluate("""()=>{const v=document.querySelector('video');
                    return v? {r:v.readyState, d:Math.round(v.duration||0)} : null;}""")
            except Exception:
                continue
            if st and st.get("r", 0) >= 2 and st.get("d", 0) > 0:
                return st
        time.sleep(3)
    return None


def btn_state(fr, label):
    """按钮状态：存在？可用？"""
    try:
        b = fr.locator("button").filter(has_text=label).last
        if b.count() == 0:
            return None
        return {"enabled": b.is_enabled(), "visible": b.is_visible()}
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description="发视频号草稿（只存草稿，绝不发表）")
    ap.add_argument("video")
    ap.add_argument("--desc", required=True)
    ap.add_argument("--short", default="")
    ap.add_argument("--profile", default=PROFILE)
    args = ap.parse_args()

    # 先校验短标题（不依赖视频是否存在），再查视频
    short = clean_short_title(args.short)
    if args.short and short != args.short:
        print("[!] 短标题已清洗：\n    原 %r\n    新 %r" % (args.short, short), flush=True)
    if short and len(short) > SHORT_MAX_LEN:
        sys.exit("[✗] 短标题 %d 字，超过平台 %d 字上限：%r\n"
                 "    （超限平台不报错，只让『保存草稿』变灰 —— 直接拦在这里）"
                 % (len(short), SHORT_MAX_LEN, short))

    if not os.path.exists(args.video):
        sys.exit("找不到视频：" + args.video)
    os.makedirs(SHOT_DIR, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            args.profile, channel="chrome", headless=False,
            args=["--start-maximized"], viewport=None)
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto("https://channels.weixin.qq.com/platform/",
                      wait_until="domcontentloaded", timeout=60000)
            time.sleep(12)

            if not is_logged_in(page):
                print("=" * 58, flush=True)
                print(">>> 请扫码登录视频号助手 <<<", flush=True)
                print("=" * 58, flush=True)
                t0 = time.time()
                while time.time() - t0 < LOGIN_WAIT:
                    if is_logged_in(page):
                        break
                    time.sleep(3)
                if not is_logged_in(page):
                    page.screenshot(path=os.path.join(SHOT_DIR, "vh_login_timeout.png"))
                    sys.exit("[✗] 扫码等待超时")
                print("[✓] 登录成功", flush=True); time.sleep(6)
            else:
                print("[✓] 已有登录态", flush=True)

            print("[1] 进发布页", flush=True)
            page.locator("text=发表视频").first.click(timeout=15000)
            time.sleep(14)
            print("    URL:", page.url, flush=True)

            print("[2] 上传 %s" % os.path.basename(args.video), flush=True)
            fup = frame_by_locator(page, ".ant-upload-drag-container")
            if not fup:
                sys.exit("[✗] 找不到上传区")
            with page.expect_file_chooser(timeout=20000) as fc:
                fup.locator(".ant-upload-drag-container").first.click(timeout=10000)
            fc.value.set_files(args.video)

            print("[3] 等视频就绪（readyState>=2 且 duration>0）", flush=True)
            st = wait_video_ready(page, timeout=180)
            if not st:
                page.screenshot(path=os.path.join(SHOT_DIR, "vh_not_ready.png"), full_page=True)
                sys.exit("[✗] 视频 180 秒内没就绪（截图 vh_not_ready.png）")
            print("    ✓ 就绪：%d 秒 / readyState=%d" % (st["d"], st["r"]), flush=True)

            print("[4] 等表单挂载", flush=True)
            fr = frame_by_locator(page, ".input-editor[contenteditable]", tries=40)
            if not fr:
                sys.exit("[✗] 找不到描述框")
            time.sleep(3)

            print("[5] 填描述", flush=True)
            box = fr.locator(".input-editor[contenteditable]").first
            ok_desc = False
            for _ in range(5):
                box.click(timeout=6000); time.sleep(0.8)
                page.keyboard.type(args.desc, delay=25); time.sleep(1.5)
                got = box.evaluate("e=>e.innerText").strip()
                if got:
                    print("    ✓ %r" % got[:70], flush=True); ok_desc = True; break
                time.sleep(2)
            if not ok_desc:
                sys.exit("[✗] 描述没填进去，中止（未保存）")

            if short:
                print("[6] 填短标题", flush=True)
                inp = fr.locator('input[placeholder*="短标题"]').first
                inp.click(timeout=6000); time.sleep(0.5)
                page.keyboard.type(short, delay=25); time.sleep(1.5)
                v = inp.input_value()
                print("    ✓ %r" % v, flush=True)
                if v.strip() != short:
                    sys.exit("[✗] 短标题回读不一致，中止（未保存）")

            print("[7] 检查表单校验错误（红字提示）", flush=True)
            errs = []
            try:
                errs = fr.evaluate("""()=>{const out=[];
                  document.querySelectorAll('*').forEach(e=>{
                    const t=(e.innerText||'').trim();
                    const cs=getComputedStyle(e);
                    // 红色小字 = 平台校验错误（如「标题超过16字限制」）
                    if(t && t.length<40 && /超过|限制|不能为空|非法|不允许|格式/.test(t)
                       && (cs.color.includes('rgb(250') || cs.color.includes('rgb(255')
                           || cs.color.includes('rgb(240')))
                      out.push(t);});
                  return [...new Set(out)];}""")
            except Exception:
                pass
            if errs:
                page.screenshot(path=os.path.join(SHOT_DIR, "vh_form_error.png"), full_page=True)
                sys.exit("[✗] 表单有校验错误，已中止（未保存）：%s\n    截图 vh_form_error.png"
                         % " / ".join(errs))
            print("    ✓ 没有校验错误", flush=True)

            print("[8] 等『保存草稿』可用", flush=True)
            for i in range(20):
                s = btn_state(fr, "保存草稿")
                if s and s["enabled"]:
                    print("    ✓ 可用（第 %d 次探测）" % (i + 1), flush=True)
                    break
                time.sleep(3)
            else:
                page.screenshot(path=os.path.join(SHOT_DIR, "vh_save_disabled.png"),
                                full_page=True)
                sys.exit("[✗] 『保存草稿』一直不可用（截图 vh_save_disabled.png）")

            print("[9] 点『保存草稿』（**绝不点发表**）", flush=True)
            fr.locator("button").filter(has_text="保存草稿").last.click(timeout=8000)

            print("[10] 等保存结果", flush=True)
            toast = ""
            for i in range(12):
                time.sleep(5)
                try:
                    t = fr.evaluate("""()=>{const sels=['.weui-desktop-toast','[class*=toast]',
                        '[class*=Toast]','[class*=message]','[class*=Message]'];
                      for(const s of sels){const e=document.querySelector(s);
                        if(e&&(e.innerText||'').trim()) return e.innerText.trim();}
                      return '';}""")
                except Exception:
                    t = ""
                if t:
                    toast = t
                    print("    toast: %r" % t, flush=True)
                    break
            page.screenshot(path=os.path.join(SHOT_DIR, "vh_saved.png"), full_page=True)
            print("    截图 %s/vh_saved.png" % SHOT_DIR, flush=True)
            if not toast:
                print("    ! 没抓到 toast（不代表失败，下面进草稿箱核对）", flush=True)

            print("[10] 进「内容管理 → 草稿箱」核对", flush=True)
            page.goto("https://channels.weixin.qq.com/platform/",
                      wait_until="domcontentloaded", timeout=60000)
            time.sleep(12)
            page.locator(".finder-ui-desktop-menu__item").nth(0).click(timeout=10000)
            time.sleep(5)
            d = None
            for i in range(10):
                loc = page.locator(".finder-ui-desktop-sub-menu__item").filter(has_text="草稿箱")
                if loc.count() and loc.first.is_visible():
                    d = loc.first; break
                time.sleep(2)
            if d:
                d.click(); time.sleep(15)
            print("    URL:", page.url, flush=True)
            page.screenshot(path=os.path.join(SHOT_DIR, "vh_draftbox.png"), full_page=True)
            cnt = ""
            for f in page.frames:
                try:
                    t = f.inner_text("body")
                    m = re.search(r"草稿箱\s*\((\d+)\)", t)
                    if m:
                        cnt = m.group(1); break
                except Exception:
                    pass
            print("    草稿箱计数: %s" % (cnt or "(没读到，看截图)"), flush=True)

            print("[i] 留 60 秒供核对", flush=True)
            time.sleep(60)
        finally:
            try:
                ctx.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()
