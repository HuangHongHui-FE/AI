#!/usr/bin/env python3
# 名场面批量剪辑：扫描 名场面/素材/ 里文件名带钩子段的源视频，逐条调 剪辑模板.py 出成品
#
# 文件名约定：<编号>-<标题>-<起始秒>-<结束秒>.mp4
#   023-我没上车，我还没上车-101-106.mp4  → 钩子取源视频 101–106 秒
#
# 用法（在仓库根目录跑即可，不用先 cd）:
#   python3 skill/B1-剪成片/批量剪.py              # 跳过已成品、跳过缺秒数的
#   python3 skill/B1-剪成片/批量剪.py --only 019,020
#   python3 skill/B1-剪成片/批量剪.py --force       # 已成品也重剪
import argparse, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
# 媒体根目录：脚本在 skill/B1-剪成片/ 下，素材和成品在仓库的 名场面/ 里
MEDIA = os.path.normpath(os.path.join(HERE, os.pardir, os.pardir, "名场面"))
SRC_DIR, OUT_DIR = os.path.join(MEDIA, "素材"), os.path.join(MEDIA, "成品")
TEMPLATE = os.path.join(HERE, "剪辑模板.py")
CTA = "成品/004-食s了你-2月16日.mp4"   # 片尾关注卡来源（末尾 2 秒），相对 名场面/


def clean_title(t):
    """文件名是人手敲的，清掉杂讯：去 #话题标签、连续空格压成一个"""
    t = re.sub(r"#[^\s#]*", "", t)
    return re.sub(r"\s+", " ", t).strip()


def parse(stem):
    """'019-标题-50-56' → (编号, 标题, 起, 止)；不符合则 None"""
    m = re.match(r"^(\d{3})-(.+)-(\d+)-(\d+)$", stem)
    if not m:
        return None
    num, title, a, b = m.groups()
    return num, clean_title(title), int(a), int(b)


def main():
    ap = argparse.ArgumentParser(description="名场面批量剪辑")
    ap.add_argument("--only", default=None, help="只剪指定编号，逗号分隔，如 019,020")
    ap.add_argument("--force", action="store_true", help="已成品也重剪")
    args = ap.parse_args()

    if not os.path.isdir(SRC_DIR):
        sys.exit("找不到素材目录：%s" % SRC_DIR)
    only = set(args.only.split(",")) if args.only else None

    todo, skipped = [], []
    for name in sorted(os.listdir(SRC_DIR)):
        if not name.endswith(".mp4"):
            continue
        stem = name[:-4]
        p = parse(stem)
        if not p:
            skipped.append((stem, "文件名缺钩子秒数"))
            continue
        num, title, a, b = p
        # 成品名去掉钩子段：`-0-4` 是给素材的指令，不是成品的属性（和现有成品 001~016 命名一致）
        out_name = "%s-%s.mp4" % (num, title)
        if only and num not in only:
            continue
        if os.path.exists(os.path.join(OUT_DIR, out_name)) and not args.force:
            skipped.append((stem, "已有成品"))
            continue
        todo.append((name, out_name, num, title, a, b))

    if not todo:
        print("没有要剪的。跳过的 %d 条：" % len(skipped))
        for s, why in skipped:
            print("  - %s（%s）" % (s, why))
        return

    print("待剪 %d 条，跳过 %d 条\n" % (len(todo), len(skipped)))
    ok, fail = [], []
    for i, (name, out_name, num, title, a, b) in enumerate(todo, 1):
        print("=" * 60)
        print("[%d/%d] %s" % (i, len(todo), name))
        print("        → %s" % out_name)
        print("        标题卡「%s」  钩子 %d-%d 秒（%d 秒）" % (title, a, b, b - a))
        t0 = time.time()
        r = subprocess.run([sys.executable, TEMPLATE,
                            os.path.join(SRC_DIR, name), title,
                            os.path.join(OUT_DIR, out_name),
                            "--hook-range", "%d-%d" % (a, b), "--cta", CTA])
        if r.returncode == 0:
            ok.append(out_name)
            print("        ✓ %.0f 秒" % (time.time() - t0))
        else:
            fail.append(name)
            print("        ✗ 失败（退出码 %d）" % r.returncode)

    print("\n" + "=" * 60)
    print("完成 %d 条，失败 %d 条" % (len(ok), len(fail)))
    for n in fail:
        print("  ✗", n)
    if skipped:
        print("\n跳过：")
        for s, why in skipped:
            print("  - %s（%s）" % (s, why))


if __name__ == "__main__":
    main()
