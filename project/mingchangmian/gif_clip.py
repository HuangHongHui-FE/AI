#!/usr/bin/env python3
# 名场面切片工具：给定视频链接 + 时间段，下载片段并转成公众号可用的 GIF
# 用法: python3 gif_clip.py <视频URL> <开始> <结束> [输出名] [--cookies-from-browser chrome]
# 时间格式: 秒数(如 95) 或 MM:SS(如 01:35) 或 HH:MM:SS
# 依赖: yt-dlp, imageio-ffmpeg (pip 装), 网络可访问目标站点
import argparse, subprocess, sys, os, shutil, tempfile

# 自动定位 ffmpeg 二进制：优先用 imageio-ffmpeg 自带的，省得单独装
def find_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg")  # 回退到系统 ffmpeg

# imageio-ffmpeg 的二进制文件名是 ffmpeg-macos-xxx，yt-dlp 找的是 `ffmpeg`。
# 在 .bin 下建一个名为 ffmpeg 的软链指向它，并把 .bin 加进子进程 PATH。
def ensure_ffmpeg_link(ffmpeg_exe):
    bin_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bin")
    os.makedirs(bin_dir, exist_ok=True)
    link = os.path.join(bin_dir, "ffmpeg")
    need = not os.path.exists(link) or not os.path.samefile(link, ffmpeg_exe) if os.path.exists(link) else True
    if need:
        if os.path.lexists(link):
            os.remove(link)
        os.symlink(ffmpeg_exe, link)
    return bin_dir

# 把 "01:35" / "95" / "00:01:35" 统一成秒，再转成 ffmpeg 可读的 HH:MM:SS
def to_hhmmss(t):
    parts = [int(p) for p in str(t).split(":")]
    secs = sum(p * 60 ** (len(parts) - i - 1) for i, p in enumerate(parts))
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"

def run(cmd, env=None):
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True, env=env)

def main():
    ap = argparse.ArgumentParser(description="名场面切片：视频URL+时段 → GIF")
    ap.add_argument("url", help="视频链接（B站/YouTube/直链）")
    ap.add_argument("start", help="开始时间：秒数 / MM:SS / HH:MM:SS")
    ap.add_argument("end", help="结束时间：同上")
    ap.add_argument("name", nargs="?", default="clip", help="输出名（默认 clip）")
    ap.add_argument("--cookies-from-browser", default=None,
                    help="读浏览器登录态，如 chrome/safari/firefox（B站高清源需要）")
    ap.add_argument("--cookies", default=None, help="Netscape cookies.txt 路径")
    args = ap.parse_args()

    start, end = to_hhmmss(args.start), to_hhmmss(args.end)
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        sys.exit("找不到 ffmpeg，请 pip install imageio-ffmpeg")
    bin_dir = ensure_ffmpeg_link(ffmpeg)
    env = os.environ.copy()
    env["PATH"] = bin_dir + os.pathsep + env.get("PATH", "")  # 让 yt-dlp 能找到 ffmpeg

    out_dir = os.path.join(os.path.dirname(__file__), "clips")
    os.makedirs(out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp()
    raw = os.path.join(tmp, "raw.mp4")        # 下载的片段
    palette = os.path.join(tmp, "palette.png") # 调色板，提升 GIF 质量
    gif = os.path.join(out_dir, f"{args.name}.gif")

    # 1) 用 yt-dlp 只下目标时段（省带宽省时间），--force-keyframes-at-cuts 保证精确切割
    # 用 `python -m yt_dlp` 调用，不依赖 PATH 里有 yt-dlp 命令；ffmpeg 通过 bin_dir 软链 + PATH 提供
    # cookie：B站高清源/部分影视需要登录态，--cookies-from-browser 自动读浏览器，半年内不用维护
    yd = [sys.executable, "-m", "yt_dlp", "--download-sections", f"*{start}-{end}",
          "--force-keyframes-at-cuts", "--ffmpeg-location", bin_dir,
          "-f", "mp4/best", "-o", raw]
    if args.cookies_from_browser:
        yd += ["--cookies-from-browser", args.cookies_from_browser]
    if args.cookies:
        yd += ["--cookies", args.cookies]
    yd.append(args.url)
    run(yd, env=env)

    # 2) 两遍法转 GIF：先采样生成调色板，再用调色板量化，避免直接转出来糊成马赛克
    vf = f"fps=10,scale=360:-1:flags=lanczos"  # 10帧、宽360，公众号配图够用且体积可控
    run([ffmpeg, "-y", "-i", raw, "-vf", f"{vf},palettegen", palette], env=env)
    run([ffmpeg, "-y", "-i", raw, "-i", palette, "-lavfi", f"{vf} [x]; [x][1:v] paletteuse", gif], env=env)

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n✓ 完成: {gif}  ({os.path.getsize(gif) // 1024} KB)")

if __name__ == "__main__":
    main()
