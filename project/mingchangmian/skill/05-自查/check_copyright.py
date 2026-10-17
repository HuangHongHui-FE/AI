#!/usr/bin/env python3
"""版权与原创度自查（可执行版）—— 对应 05-自查 的 C 节。

清单靠人眼，占比必须实测。这个脚本量 C3 的硬指标，并给出结论。

用法:
  python3 check_copyright.py <成片.mp4> [--clip 3.0,3.0,2.8] [--speech-sec 88.9]
  # --clip 每个原片清晰镜头的时长（秒，逗号分隔）；--speech-sec 原创解说配音总时长

不传 --clip 时会尝试自动识别：把画面分成网格，检测「清晰可辨的原片画面」出现的时长。
自动识别是启发式的（见 detect_clips 注释），结果仅供参考，**以人工确认的 --clip 为准**。
"""
import argparse
import json
import os
import re
import subprocess
import sys

FF = os.environ.get(
    "FFMPEG",
    "/Users/hongenhuang/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg")

# C3 阈值（业界常见审核口径，非法律硬线）
MAX_CLIP_SEC = 3.0        # 单个原片镜头
MAX_CLIP_RATIO = 0.10     # 原片累计占比
MIN_ORIGINAL_RATIO = 0.50  # 原创解说占比


def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    if not m:
        sys.exit("读不到时长：" + path)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def detect_clips(video, thr=0.55):
    """启发式检测「原片清晰画面」的时长。

    ⚠️ 这是近似，不是判定：原理是按秒抽帧，算画面的拉普拉斯方差（清晰度）。
    模糊压暗的底片方差低、清晰原片方差高。阈值靠试，不同素材要调。
    **可靠做法是在合成脚本里记录每个插入片段的时长，用 --clip 传进来。**
    """
    tmp = "/tmp/_cc_%d" % os.getpid()
    os.makedirs(tmp, exist_ok=True)
    subprocess.run([FF, "-y", "-v", "error", "-i", video, "-vf", "fps=1",
                    os.path.join(tmp, "f%05d.png")], check=True)
    frames = sorted(os.listdir(tmp))
    try:
        from PIL import Image, ImageFilter, ImageStat
    except ImportError:
        for f in frames:
            os.remove(os.path.join(tmp, f))
        os.rmdir(tmp)
        return None, "未安装 Pillow，跳过自动识别（pip3 install --user Pillow）"

    sharp = []
    for f in frames:
        im = Image.open(os.path.join(tmp, f)).convert("L").resize((320, 180))
        edges = im.filter(ImageFilter.FIND_EDGES)
        sharp.append(ImageStat.Stat(edges).stddev[0])
    for f in frames:
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)

    if not sharp:
        return None, "没抽到帧"
    hi = max(sharp)
    # 用「相对最高清晰度的比例」判清晰段
    hits = [i for i, v in enumerate(sharp) if v > hi * thr]
    # 归并连续段
    segs, cur = [], []
    for i in hits:
        if cur and i == cur[-1] + 1:
            cur.append(i)
        else:
            if cur:
                segs.append(len(cur))
            cur = [i]
    if cur:
        segs.append(len(cur))
    return segs, None


def main():
    ap = argparse.ArgumentParser(description="版权与原创度自查（05-自查 C 节）")
    ap.add_argument("video")
    ap.add_argument("--clip", default="",
                    help="每个原片清晰镜头时长，逗号分隔（最可靠，从合成脚本抄）")
    ap.add_argument("--speech-sec", type=float, default=0.0,
                    help="原创解说配音总时长（秒）")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit("找不到成片：" + args.video)

    total = duration(args.video)
    print("成片: %s" % os.path.basename(args.video))
    print("总时长: %.2f 秒\n" % total)

    # 原片镜头时长
    clips, note = None, None
    if args.clip:
        clips = [float(x) for x in args.clip.split(",") if x.strip()]
    else:
        clips, note = detect_clips(args.video)
        if note:
            print("自动识别不可用：%s\n" % note)
        elif clips is not None:
            print("自动识别到原片清晰段（近似）: %s 秒" % clips)
            print("  ⚠️ 启发式结果仅供参考，可靠数据请用 --clip 传入合成时的记录\n")

    fails, warns = [], []

    if clips:
        clip_total = sum(clips)
        ratio = clip_total / total
        print("── C3 原片占比 ──")
        print("  镜头数: %d   累计: %.2f 秒   占比: %.1f%%" % (len(clips), clip_total, ratio * 100))
        longest = max(clips)
        print("  最长单镜头: %.2f 秒" % longest)
        if longest > MAX_CLIP_SEC:
            fails.append("单镜头 %.2f 秒 > %.1f 秒上限" % (longest, MAX_CLIP_SEC))
        else:
            print("  ✓ 单镜头 ≤ %.1f 秒" % MAX_CLIP_SEC)
        if ratio > MAX_CLIP_RATIO:
            fails.append("原片占比 %.1f%% ≥ %.0f%% 上限" % (ratio * 100, MAX_CLIP_RATIO * 100))
        else:
            print("  ✓ 原片占比 < %.0f%%" % (MAX_CLIP_RATIO * 100))
    else:
        warns.append("没拿到原片镜头时长，C3 占比未校验（用 --clip 传入）")

    # 原创解说占比
    if args.speech_sec > 0:
        o = args.speech_sec / total
        print("\n── 原创解说占比 ──")
        print("  解说配音: %.2f 秒   占比: %.1f%%" % (args.speech_sec, o * 100))
        if o < MIN_ORIGINAL_RATIO:
            fails.append("原创解说占比 %.1f%% < %.0f%%" % (o * 100, MIN_ORIGINAL_RATIO * 100))
        else:
            print("  ✓ 原创占比 > %.0f%%" % (MIN_ORIGINAL_RATIO * 100))
    else:
        warns.append("没传 --speech-sec，原创解说占比未校验")

    print("\n── 结论 ──")
    for f in fails:
        print("  ✗ " + f)
    for w in warns:
        print("  ! " + w)
    if not fails and not warns:
        print("  ✓ C3 硬指标全过")
    elif not fails:
        # ⚠️ 有项没校验就不能说「全过」—— 那正是本 skill 一直在防的「静默成功」
        print("  ⚠️ 已校验的项通过，但有 %d 项未校验，**不能算全过**" % len(warns))
    print("\n⚠️ 本脚本只量「占比」这类可计算指标。C2/C4/C5 靠人眼，清单见 skill/05-自查/README.md。")
    print("⚠️ 占比达标 ≠ 已获授权。法律安全线仍是授权或合理使用认定，且国内司法边界不统一。")
    sys.exit(1 if (fails or warns) else 0)


if __name__ == "__main__":
    main()
