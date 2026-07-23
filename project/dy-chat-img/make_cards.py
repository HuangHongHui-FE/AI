#!/usr/bin/env python3
# 生成7张热搜盘点信息图卡片（封面+6正文），原创零搬运
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 1200
def font(sz, bold=False):
    p = '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/PingFang.ttc'
    try: return ImageFont.truetype(p, sz)
    except: return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', sz)

def wrap(d, text, fnt, max_w):
    out, line = [], ''
    for ch in text:
        if d.textlength(line + ch, font=fnt) <= max_w: line += ch
        else: out.append(line); line = ch
    if line: out.append(line)
    return out

def card(path, tag, topic, hot, line, color, is_cover=False):
    img = Image.new('RGB', (W, H), color)
    d = ImageDraw.Draw(img)
    f_tag = font(28, True)
    tw = d.textlength(tag, font=f_tag)
    d.rectangle([40, 40, 40 + tw + 40, 84], fill='#e8c062')
    d.text((60, 47), tag, font=f_tag, fill=color)
    if is_cover:
        d.text((60, 260), '7/20 热搜榜', font=font(74, True), fill='#ffffff')
        f_s = font(34)
        for i, l in enumerate(['在哭、在算、在抢跑']):
            d.text((62, 390 + i * 50), l, font=f_s, fill='#e8c062')
        f_b = font(26)
        for i, l in enumerate(wrap(d, '6个真热点，一张图看懂今天微博在吵什么', f_b, W - 120)):
            d.text((60, 560 + i * 40), l, font=f_b, fill='#cccccc')
        d.text((60, H - 70), '热度来自微博热搜归档，可查', font=font(22), fill='#888888')
    else:
        f_t = font(46, True)
        y = 180
        for l in wrap(d, topic, f_t, W - 120):
            d.text((60, y), l, font=f_t, fill='#ffffff'); y += 64
        d.text((60, 430), hot, font=font(150, True), fill='#e8c062')
        d.text((60, 610), '微博热度', font=font(28), fill='#999999')
        f_l = font(36)
        y = 760
        for l in wrap(d, line, f_l, W - 120):
            d.text((60, y), l, font=f_l, fill='#ffffff'); y += 52
    img.save(path, 'JPEG', quality=88)
    print('made', path)

cards = [
    ('悼念', '谢贤去世', '2264万', '港片黄金时代，最后一盏灯', '#2b2b2b'),
    ('娱乐', '余文乐宣布离婚', '865万', '从志明与春娇，到各自安好', '#3a3a3a'),
    ('科技', '清华姚班 全球AI半壁江山', '223万', '中国AI的引擎，藏在哪个教室', '#1f3a5f'),
    ('民生', '31省上半年人均可支配收入公布', '49万', '钱袋子的半年报，你城市排第几', '#2e5c4c'),
    ('突发', '崇左地震', '318万', '广西崇左，人在自然面前小', '#5c2e2e'),
    ('财经', '半导体板块半月回撤超40%', '64万', '涨太狠的，迟早都要还', '#5c4a1f'),
]

card('cover-20260721a.jpg', '盘点', '7/20 热搜榜', '', '', '#1a1a1a', is_cover=True)
for i, (tag, topic, hot, line, color) in enumerate(cards, 1):
    card(f'img{i}.jpg', tag, topic, hot, line, color)
