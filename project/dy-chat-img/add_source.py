#!/usr/bin/env python3
# B 档图源处理：给指定目录所有 jpg 底部加来源标注条（二创痕迹，避免裸搬）
# 用法: python3 add_source.py <图片目录>
from PIL import Image, ImageDraw, ImageFont
import glob, sys

def font(sz):
    try: return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', sz)
    except: return ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', sz)

d = sys.argv[1] if len(sys.argv) > 1 else '.'
files = sorted(glob.glob(f'{d}/*.jpg'))
for p in files:
    im = Image.open(p).convert('RGB')
    w, h = im.size
    bar = 46
    im2 = Image.new('RGB', (w, h + bar), (0, 0, 0))
    im2.paste(im, (0, 0))
    dr = ImageDraw.Draw(im2)
    dr.text((14, h + 11), '图源：网络，侵删', font=font(22), fill=(170, 170, 170))
    im2.save(p, 'JPEG', quality=88)
print(f'processed {len(files)} imgs in {d}')
