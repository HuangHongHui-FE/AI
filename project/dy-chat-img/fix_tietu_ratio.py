#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 贴图正文图统一转 9:16(1080x1920)：横图/扁图/短竖图 用「模糊填充」法补成满屏竖图，不拉伸不变形
# 用法: python3 fix_tietu_ratio.py <来源目录> <输出目录>
import os, sys
from PIL import Image, ImageFilter

SRC = sys.argv[1]
OUT = sys.argv[2]
W, H = 1080, 1920  # 微信贴图全屏竖图(与 003.jpg 一致)

os.makedirs(OUT, exist_ok=True)

def blur_fill(img):
    """原图等比缩放到不超出画布居中，背景=原图模糊放大，铺满9:16"""
    img = img.convert("RGB")
    # 背景：整图缩放铺满画布再高斯模糊
    bg = img.resize((W, H), Image.LANCZOS)
    bg = bg.filter(ImageFilter.GaussianBlur(60))
    # 前景：按高度缩放(高度不足则按宽度)，等比居中
    fw, fh = img.size
    scale = min(H / fh, W / fw)
    fh, fw = int(fh * scale), int(fw * scale)
    fg = img.resize((fw, fh), Image.LANCZOS)
    bg.paste(fg, ((W - fw) // 2, (H - fh) // 2))
    return bg

for fn in sorted(os.listdir(SRC)):
    if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
        continue
    im = Image.open(os.path.join(SRC, fn))
    w, h = im.size
    if (w, h) == (W, H):
        im.convert("RGB").save(os.path.join(OUT, fn), quality=88)
        print(f"[原比例] {fn} ({w}x{h}) 已复制")
        continue
    out = blur_fill(im)
    out.save(os.path.join(OUT, fn), quality=88)
    print(f"[转竖图] {fn} ({w}x{h} -> {W}x{H}) 模糊填充完成")
