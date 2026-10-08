#!/usr/bin/env python3
# 名场面剪辑模板 —— 固定四段流程
#
#   [钩子段] → [打字机标题卡] → [正文（完整源视频，钩子段在内）] → [片尾关注卡]
#
# 钩子段会出现两次：开头预告一次，正文里再播一次。
#
# 用法（在仓库根目录跑即可，**不用先 cd**）:
#   python3 skill/B1-剪成片/剪辑模板.py <源视频> <标题> --hook-range 47-53 --cta <关注卡视频>
# 例:
#   python3 skill/B1-剪成片/剪辑模板.py "素材/018-高三八班、全体起立.mp4" "高三八班、全体起立" \
#       --hook-range 47-53 --cta "成品/004-食s了你-2月16日.mp4"
#
# 素材/成品都在仓库的 名场面/ 下：<源视频>、--cta、--music 的相对路径都按 名场面/ 解析，
# 不传 output 时成品落到 名场面/成品/ 下、与源文件同名。
#
# 音频全程连续：标题卡那 3 秒由钩子段的音频顺延顶上，不会出现静音。
import argparse, os, subprocess, sys, tempfile

# ============ 可调参数 ============
CARD_DUR  = 3.0    # 打字机标题卡时长（秒）
TYPE_STEP = 0.15   # 打字机每字间隔（秒）
WM_TEXT   = "名场面"
WM_PERIOD = 12.0   # 水印从左上扫到右下走完一趟要几秒
WM_ALPHA  = 0.35   # 水印透明度
WM_MARGIN = 24     # 水印离边距
CTA_TAIL  = 2.0    # 从关注卡视频尾部截取多少秒
CRF       = 20     # 画质（越小越清晰、体积越大）

FONT = "/System/Library/Fonts/PingFang.ttc"
CARD_COLOR = "0x0a0a0a"
# =================================

# 媒体根目录：本脚本在 skill/B1-剪成片/ 下，素材和成品都在仓库的 名场面/ 里。
# 脚本挪进来之后就不用先 cd 了 —— 用户给的 `素材/xxx.mp4` 这类相对路径都按这里解析。
MEDIA_ROOT = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir, "名场面"))


def resolve(p):
    """相对路径按 名场面/ 解析，绝对路径原样返回"""
    return p if os.path.isabs(p) else os.path.join(MEDIA_ROOT, p)


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        from shutil import which
        return which("ffmpeg")


def probe(exe, path):
    """返回 (宽, 高, fps, 是否有音轨, 时长)"""
    out = subprocess.run([exe, "-i", path], capture_output=True, text=True).stderr
    w = h = fps = None
    for line in out.splitlines():
        if "Stream #" in line and "Video:" in line:
            for tok in line.split(","):
                tok = tok.strip()
                if "x" in tok and tok.replace("x", "").split()[0].isdigit():
                    parts = tok.split()[0].split("x")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        w, h = int(parts[0]), int(parts[1])
                if tok.endswith("fps"):
                    try: fps = float(tok.split()[0])
                    except ValueError: pass
    has_audio = "Audio:" in out
    dur = 0.0
    for line in out.splitlines():
        if "Duration:" in line:
            t = line.split("Duration:")[1].split(",")[0].strip()
            hh, mm, ss = t.split(":")
            dur = int(hh) * 3600 + int(mm) * 60 + float(ss)
    return w, h, (fps or 30.0), has_audio, dur


def esc(s):
    """drawtext 文本转义"""
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def typewriter(title, w, h):
    """打字机效果：逐字累积显示，每字显示 TYPE_STEP 秒"""
    n = len(title)
    fs = min(int(w * 0.8 / n), int(h * 0.22))
    parts = []
    for i in range(1, n + 1):
        prefix = esc(title[:i])
        if i < n:
            en = "between(t,%.2f,%.2f)" % ((i - 1) * TYPE_STEP, i * TYPE_STEP)
        else:
            en = "gte(t,%.2f)" % ((n - 1) * TYPE_STEP)
        parts.append(
            "drawtext=fontfile=%s:text='%s':fontsize=%d:fontcolor=white"
            ":borderw=2:bordercolor=black@0.8"
            ":x=(w-text_w)/2:y=(h-text_h)/2:enable='%s'" % (FONT, prefix, fs, en)
        )
    return ",".join(parts)


def watermark(w, h, skips=()):
    """从左上角移到右下角的水印；走完一趟回到左上。skips=[(起,止)] 这些时间段不显示。

    ⚠️ 表达式必须用单引号包起来——mod(t,12) 里的逗号不加引号会被滤镜图
    解析器当成滤镜分隔符，报 "Error parsing a filter description"。"""
    fs = max(18, int(h / 16))
    p = "mod(t,%.2f)/%.2f" % (WM_PERIOD, WM_PERIOD)
    x = "'%d+(w-text_w-2*%d)*(%s)'" % (WM_MARGIN, WM_MARGIN, p)
    y = "'%d+(h-text_h-2*%d)*(%s)'" % (WM_MARGIN, WM_MARGIN, p)
    en = ""
    if skips:
        cond = "*".join("not(between(t,%.2f,%.2f))" % (a, b) for a, b in skips)
        en = ":enable='%s'" % cond
    return (
        "drawtext=fontfile=%s:text='%s':fontsize=%d:fontcolor=white@%.2f"
        ":borderw=1:bordercolor=black@0.5:x=%s:y=%s%s"
        % (FONT, WM_TEXT, fs, WM_ALPHA, x, y, en)
    )


def parse_range(s):
    """'47-53' → (47.0, 53.0)"""
    a, _, b = s.partition("-")
    return float(a), float(b)


def main():
    ap = argparse.ArgumentParser(description="名场面剪辑模板（固定四段流程）")
    ap.add_argument("input")
    ap.add_argument("title", help="标题卡文字")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--hook-range", default=None,
                    help="钩子段在源视频中的时间段，如 47-53（必填，这段会播两遍）")
    ap.add_argument("--cta", default=None, help="片尾关注卡视频（取它最后几秒）")
    ap.add_argument("--cta-tail", type=float, default=CTA_TAIL, help="关注卡截取秒数")
    ap.add_argument("--music", default=None, help="背景音乐（可选）")
    ap.add_argument("--no-card", action="store_true", help="不加标题卡")
    args = ap.parse_args()

    exe = ffmpeg()
    if not exe:
        sys.exit("找不到 ffmpeg")

    src = resolve(args.input)
    w, h, fps, has_audio, dur = probe(exe, src)
    if not w:
        sys.exit("读不出视频信息：" + src)
    print("源: %dx%d @%.0ffps  %.2fs  音轨:%s" % (w, h, fps, dur, "有" if has_audio else "无"))

    out = resolve(args.output) if args.output else \
        os.path.join(MEDIA_ROOT, "成品", os.path.basename(src))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)

    card = 0.0 if args.no_card else CARD_DUR

    # 钩子段
    hs, he = (0.0, 0.0)
    if args.hook_range:
        hs, he = parse_range(args.hook_range)
        hs = max(0.0, min(hs, dur))
        he = max(hs, min(he, dur))
    hlen = he - hs
    if hlen <= 0:
        print("⚠ 未给 --hook-range，本次不带钩子段")

    # 各分支参数必须一致，否则 concat 报 "Error reinitializing filters"。
    # 源视频常见 SAR=404:405 这类非 1:1 采样比，纯色源却是 1:1，所以统一 setsar=1。
    vnorm = "setsar=1,fps=%.0f,format=yuv420p" % fps
    anorm = "aformat=sample_rates=44100:channel_layouts=stereo"

    # ---------------- 输入 ----------------
    cmd = [exe, "-y", "-i", src]
    idx = 1
    card_idx = cta_idx = music_idx = None
    if card:
        card_idx = idx
        cmd += ["-f", "lavfi", "-i",
                "color=c=%s:s=%dx%d:r=%.0f:d=%.2f" % (CARD_COLOR, w, h, fps, card)]
        idx += 1

    cta_start = cta_dur = 0.0
    cta_has_audio = False
    if args.cta:
        cta_src = resolve(args.cta)
        _, _, _, cta_has_audio, cta_total = probe(exe, cta_src)
        cta_dur = min(args.cta_tail, cta_total)
        cta_start = max(0.0, cta_total - cta_dur)
        cta_idx = idx
        cmd += ["-i", cta_src]
        idx += 1
        print("片尾关注卡: %s  取 %.2f-%.2f（%.2fs）  音轨:%s"
              % (os.path.basename(cta_src), cta_start, cta_total, cta_dur,
                 "有" if cta_has_audio else "无"))

    if args.music:
        music_idx = idx
        cmd += ["-stream_loop", "-1", "-i", resolve(args.music)]
        idx += 1

    # ---------------- 画面 ----------------
    fg, vparts = [], []
    if hlen > 0:                                    # ① 钩子段
        fg.append("[0:v]trim=%.3f:%.3f,setpts=PTS-STARTPTS,%s[vh]" % (hs, he, vnorm))
        vparts.append("[vh]")
    if card:                                        # ② 打字机标题卡
        fg.append("[%d:v]%s,setsar=1[cardv]" % (card_idx, typewriter(args.title, w, h)))
        vparts.append("[cardv]")
    fg.append("[0:v]trim=0:%.3f,setpts=PTS-STARTPTS,%s[vm]" % (dur, vnorm))
    vparts.append("[vm]")                           # ③ 正文 = 完整源视频（钩子段在内）
    fg.append("%sconcat=n=%d:v=1:a=0[cv]" % ("".join(vparts), len(vparts)))

    cur = "[cv]"
    if cta_idx is not None:                         # ④ 片尾关注卡
        fg.append("[%d:v]trim=%.3f:%.3f,setpts=PTS-STARTPTS,scale=%d:%d,%s[ctav]"
                  % (cta_idx, cta_start, cta_start + cta_dur, w, h, vnorm))
        fg.append("%s[ctav]concat=n=2:v=1:a=0[cv2]" % cur)
        cur = "[cv2]"

    # 水印：标题卡、片尾关注卡期间关掉
    card_at = hlen
    cta_at = hlen + card + dur
    skips = []
    if card:
        skips.append((card_at, card_at + card))
    if cta_idx is not None:
        skips.append((cta_at, cta_at + cta_dur))
    fg.append("%s%s[vout]" % (cur, watermark(w, h, skips)))

    # ---------------- 音频（全程连续，卡片期间由钩子音频顺延顶上）----------------
    aparts = []
    if hlen > 0:
        # 钩子音频多取 card 秒，正好盖住标题卡那 3 秒，避免静音。
        # 钩子若太靠片尾、取不满，就用 apad 补静音凑足长度，否则音视频会错位。
        if not has_audio:
            # 源视频没有音轨（实测 023/028 就是），[0:a] 不存在会让整个滤镜图失败 —— 补静音
            fg.append("anullsrc=r=44100:cl=stereo:d=%.3f,%s[ah]" % (hlen + card, anorm))
        else:
            ah_end = he + card
            if ah_end <= dur:
                fg.append("[0:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS,%s[ah]" % (hs, ah_end, anorm))
            else:
                fg.append("[0:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS,apad=pad_dur=%.3f,%s[ah]"
                          % (hs, he, ah_end - dur, anorm))
        aparts.append("[ah]")
    if has_audio:
        fg.append("[0:a]atrim=0:%.3f,asetpts=PTS-STARTPTS,%s[am]" % (dur, anorm))
    else:
        fg.append("anullsrc=r=44100:cl=stereo:d=%.3f,%s[am]" % (dur, anorm))
    aparts.append("[am]")
    if cta_idx is not None:
        if cta_has_audio:
            fg.append("[%d:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS,%s[ac]"
                      % (cta_idx, cta_start, cta_start + cta_dur, anorm))
        else:
            fg.append("anullsrc=r=44100:cl=stereo:d=%.3f,%s[ac]" % (cta_dur, anorm))
        aparts.append("[ac]")
    fg.append("%sconcat=n=%d:v=0:a=1[aout]" % ("".join(aparts), len(aparts)))

    amap = "[aout]"
    if music_idx is not None:
        fg.append("[%d:a]volume=0.25[bgm]" % music_idx)
        fg.append("[aout][bgm]amix=inputs=2:duration=first:dropout_transition=0[amixout]")
        amap = "[amixout]"

    # 滤镜链写文件传（-filter_complex_script），避免超长 argv 和转义问题
    fg_path = os.path.join(tempfile.gettempdir(), "mcqm_filtergraph.txt")
    with open(fg_path, "w", encoding="utf-8") as fh:
        fh.write(";".join(fg))

    cmd += ["-filter_complex_script", fg_path,
            "-map", "[vout]", "-map", amap,
            "-c:v", "libx264", "-crf", str(CRF), "-preset", "medium", "-pix_fmt", "yuv420p",
            "-r", "%.0f" % fps, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]

    print("结构: 钩子 %.1fs → 标题卡 %.1fs → 正文 %.2fs → 关注卡 %.1fs  合计 %.1fs"
          % (hlen, card, dur, cta_dur, hlen + card + dur + cta_dur))
    subprocess.run(cmd, check=True)
    print("\n✓ 完成: %s  (%.1f MB)" % (out, os.path.getsize(out) / 1024 / 1024))


if __name__ == "__main__":
    main()
