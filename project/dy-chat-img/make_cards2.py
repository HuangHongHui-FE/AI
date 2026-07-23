#!/usr/bin/env python3
# 生成7张「月薪过万」主题信息图卡片（封面+6正文），围绕同一主题切片，原创零搬运
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

def card(path, title, sub, is_cover=False):
    img = Image.new('RGB', (W, H), '#161616')
    d = ImageDraw.Draw(img)
    # 顶部小标
    d.rectangle([40, 40, 200, 80], fill='#c9a14a')
    d.text((52, 47), '月薪过万', font=font(26, True), fill='#161616')
    if is_cover:
        # 封面：大主题
        f_t = font(70, True)
        y = 300
        for l in wrap(d, '月薪过万', f_t, W - 120):
            d.text((60, y), l, font=f_t, fill='#ffffff'); y += 92
        f_s = font(40, True)
        d.text((60, 470), '早就不算门槛了', font=f_s, fill='#c9a14a')
        f_b = font(28)
        for i, l in enumerate(wrap(d, '为什么拿到一万块，反而更焦虑了', f_b, W - 120)):
            d.text((60, 590 + i * 42), l, font=f_b, fill='#aaaaaa')
    else:
        # 正文：大字观点 + 小字一句
        f_t = font(54, True)
        y = 220
        for l in wrap(d, title, f_t, W - 120):
            d.text((60, y), l, font=f_t, fill='#ffffff'); y += 72
        # 金色分隔短线
        d.rectangle([60, y + 20, 160, y + 24], fill='#c9a14a')
        f_s = font(32)
        y2 = y + 70
        for l in wrap(d, sub, f_s, W - 120):
            d.text((60, y2), l, font=f_s, fill='#cccccc'); y2 += 48
    img.save(path, 'JPEG', quality=88)
    print('made', path)

cards = [
    ('门槛失效', '十年前是高薪，现在只是起跑线'),
    ('城市折叠', '一线过万刚及格，县城过万算体面'),
    ('看着多到手少', '五险一金一扣，万元缩水两成'),
    ('跑不赢的是增速', '工资涨五个点，物价房价涨多少'),
    ('过万的人最不敢花', '上有老下有小，一万拆成几份'),
    ('真正的富裕是时间', '卡里数字给不了，时间自由才算'),
]

card('cover-20260721b.jpg', '', '', is_cover=True)
for i, (title, sub) in enumerate(cards, 1):
    card(f'img{i}.jpg', title, sub)
