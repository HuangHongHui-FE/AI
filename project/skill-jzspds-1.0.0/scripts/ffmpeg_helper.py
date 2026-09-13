#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ffmpeg_helper.py — 由鬼畜视频时间轴 JSON 辅助生成 FFmpeg 命令片段。

用法：
    python ffmpeg_helper.py script.json
    python ffmpeg_helper.py --text '重复3次，加速1.5x，倒放'

作用：
    读取 timeline 的 action/effect 关键词，输出对应的 FFmpeg filter 片段。
    片段为「参考」性质：需按实际素材路径、时长、分辨率、音轨补齐后使用。
    本脚本不要求本机安装 ffmpeg，只做命令文本生成。
"""
import json
import re
import sys


def suggest(action: str) -> list:
    """根据 action 文本关键词返回 (说明, ffmpeg片段) 列表。"""
    a = action or ""
    tips = []

    # 倒放
    if re.search(r"倒放|reverse", a, re.I):
        tips.append(("倒放", "ffmpeg -i in.mp4 -vf reverse -af areverse out.mp4"))

    # 变速 / 加速（匹配 0.5x / 1.5x / 2x 等）
    m = re.search(r"([0-9.]+)\s*[x倍]", a)
    if m and ("速" in a or "加速" in a or "变速" in a):
        sp = float(m.group(1))
        if sp > 0:
            tips.append((
                f"变速 {sp}x",
                f"ffmpeg -i in.mp4 -filter_complex \"[0:v]setpts=PTS/{sp}[v];[0:a]atempo={sp}[a]\" "
                f"-map \"[v]\" -map \"[a]\" out.mp4"
            ))

    # 重复 / 循环
    m2 = re.search(r"重复\s*([0-9]+)|循环\s*([0-9]+)|loop\s*([0-9]+)", a, re.I)
    if m2:
        n = int(next(g for g in m2.groups() if g))
        tips.append((f"重复 {n} 次", f"ffmpeg -stream_loop {n - 1} -i in.mp4 -c copy out.mp4"))

    # 变调
    if re.search(r"变调|调音|pitch", a, re.I):
        tips.append((
            "变调(升半音)",
            "ffmpeg -i in.mp4 -filter_complex "
            "\"[0:a]asetrate=44100*1.0595,aresample=44100,atempo=1/1.0595[a]\" "
            "-map 0:v -map \"[a]\" out.mp4"
        ))

    # 故障 / RGB 分离
    if re.search(r"rgb|故障|分离|glitch", a, re.I):
        tips.append(("RGB 分离", "ffmpeg -i in.mp4 -vf \"rgbashift=rh=5:bh=-5\" out.mp4"))

    # 像素化 / 马赛克
    if re.search(r"像素|马赛克|pixel", a, re.I):
        tips.append((
            "像素化",
            "ffmpeg -i in.mp4 -vf \"scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor\" out.mp4"
        ))

    # 抖动 / 震动
    if re.search(r"抖动|震动|shake", a, re.I):
        tips.append((
            "抖动(近似)",
            "ffmpeg -i in.mp4 -vf \"crop=in_w-20:in_h-20:x='mod(n*7,20)':y='mod(n*5,20)'\" out.mp4"
        ))

    # 字幕 / 弹幕
    m3 = re.search(r"字幕|弹幕|文字|drawtext", a, re.I)
    if m3:
        tips.append((
            "加字幕",
            "ffmpeg -i in.mp4 -vf \"drawtext=text='字幕':fontcolor=yellow:fontsize=72:"
            "x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=black\" out.mp4"
        ))

    # 旋转
    if re.search(r"旋转|rotate", a, re.I):
        tips.append(("旋转", "ffmpeg -i in.mp4 -vf \"rotate=PI/2\" out.mp4"))

    return tips


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    if sys.argv[1] == "--text" and len(sys.argv) >= 3:
        timeline = [{"time": "-", "action": sys.argv[2]}]
    else:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
        timeline = data.get("timeline", [data])

    print("=== 鬼畜视频 FFmpeg 命令片段（参考，需按素材补齐路径/时长）===\n")
    for item in timeline:
        time_range = item.get("time", "-")
        action = item.get("action", "") + " " + item.get("effect", "")
        print(f"[{time_range}] {item.get('action', '')}")
        tips = suggest(action)
        if not tips:
            print("  (未匹配到关键词，请描述具体技法：变速/重复/倒放/变调/RGB/像素/抖动/字幕/旋转)")
        for desc, cmd in tips:
            print(f"  • {desc}:\n    {cmd}")
        print()
    print("提示：多片段拼接用 concat；成片加音轨用 -map；导出竖屏见 references/prompt-templates.md。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
