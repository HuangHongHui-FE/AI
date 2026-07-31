#!/usr/bin/env python3
# 篇1 厦大644分误报分校 自制对照信息图卡片(零搬运)
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 1200


def font(sz, bold=False):
    p = '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/PingFang.ttc'
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', sz)


def wrap(d, text, fnt, max_w):
    out = []
    line = ''
    for ch in text:
        if d.textlength(line + ch, font=fnt) <= max_w:
            line += ch
        else:
            out.append(line)
            line = ch
    if line:
        out.append(line)
    return out


def card(path, kind):
    img = Image.new('RGB', (W, H), '#101010')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill='#e8c062')
    if kind == 'cover':
        d.text((60, 160), '644分', font=font(120, True), fill='#ffffff')
        d.text((60, 320), '误报了分校', font=font(60, True), fill='#e8c062')
        fb = font(26)
        for i, l in enumerate(wrap(d, '一字之差 差一个厦大 高分低录的志愿坑', fb, W - 120)):
            d.text((60, 480 + i * 38), l, font=fb, fill='#cccccc')
        d.text((60, H - 70), '高校名称科普 · 内容基于公开招生信息', font=font(20), fill='#777777')
    elif kind == 'vs':
        d.text((60, 80), '校区 vs 分校 vs 独立学院', font=font(46, True), fill='#ffffff')
        d.text((60, 150), '一字之差 办学层次完全不同', font=font(24), fill='#888888')
        cols = [('校区', '#e8c062', '本部一部分\n同校同文凭\n985/211待遇'),
                ('分校', '#b8d4a8', '办学延伸\n独立招生\n文凭标注分校'),
                ('独立学院', '#d4a8a8', '民办性质\n借用母体名\n文凭独立')]
        cw = (W - 120) // 3
        for i, (name, col, desc) in enumerate(cols):
            x = 60 + i * cw
            d.rectangle([x, 230, x + cw - 10, 980], fill='#1a1a1a', outline=col)
            d.text((x + 20, 260), name, font=font(32, True), fill=col)
            for j, ln in enumerate(desc.split('\n')):
                d.text((x + 20, 360 + j * 60), ln, font=font(24), fill='#dddddd')
        d.text((60, H - 70), '办学性质以教育部公布为准', font=font(20), fill='#777777')
    elif kind == 'case':
        d.text((60, 100), '嘉庚学院 ≠ 厦大本部', font=font(50, True), fill='#e8c062')
        rows = [('厦门大学', '厦门 思明/翔安', '985 公办 本部'),
                ('厦门大学嘉庚学院', '漳州 招商局开发区', '独立学院 民办')]
        y = 230
        for name, addr, attr in rows:
            d.rectangle([60, y, W - 60, y + 300], fill='#1a1a1a')
            d.text((80, y + 30), name, font=font(34, True), fill='#ffffff')
            for j, ln in enumerate(wrap(d, '地址 ' + addr, font(26), W - 160)):
                d.text((80, y + 110 + j * 40), ln, font=font(26), fill='#b8d4a8')
            for j, ln in enumerate(wrap(d, '性质 ' + attr, font(26), W - 160)):
                d.text((80, y + 190 + j * 40), ln, font=font(26), fill='#d4a8a8')
            y += 340
        d.text((60, H - 70), '同用厦大名 实为两个办学实体', font=font(20), fill='#777777')
    elif kind == 'tips':
        d.text((60, 100), '志愿防坑 4 条', font=font(56, True), fill='#e8c062')
        tips = ['1 看全称 带“XX大学XX学院”多是独立学院',
                '2 查性质 公办民办本部分校分开看',
                '3 核代码 每校独立院校代码别混',
                '4 对地址 校区在厦 分院可能在另一城']
        for i, t in enumerate(tips):
            d.rectangle([60, 240 + i * 200, W - 60, 240 + i * 200 + 170], fill='#1a1a1a')
            for j, ln in enumerate(wrap(d, t, font(30, True), W - 160)):
                d.text((90, 260 + i * 200 + j * 42), ln, font=font(30, True), fill='#ffffff')
        d.text((60, H - 70), '高分更要看清名字', font=font(20), fill='#777777')
    img.save(path, quality=88)


for k in ['cover', 'vs', 'case', 'tips']:
    card(f'xm_{k}.jpg', k)
print('生成4张厦大对照卡片')
