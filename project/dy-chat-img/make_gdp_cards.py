# 篇2 GDP十强省份自制数据卡片(零搬运信息图)
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


rows = [('广东', 14.1), ('江苏', 13.7), ('山东', 9.8), ('浙江', 9.0), ('河南', 6.1), ('四川', 6.1), ('湖北', 5.9), ('福建', 5.6), ('湖南', 5.3), ('安徽', 5.0)]


def card(path, kind):
    img = Image.new('RGB', (W, H), '#101010')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill='#e8c062')
    if kind == 'cover':
        d.text((60, 160), 'GDP十强', font=font(96, True), fill='#ffffff')
        for i, l in enumerate(['省份洗牌', '广东稳坐第一35年']):
            d.text((60, 300 + i * 60), l, font=font(44), fill='#e8c062')
        fb = font(26)
        for i, l in enumerate(wrap(d, '一张图看懂中国各省经济版图谁在涨谁在掉', fb, W - 120)):
            d.text((60, 500 + i * 38), l, font=fb, fill='#cccccc')
        d.text((60, H - 70), '数据来源：国家统计局2024全年值，单位万亿元', font=font(20), fill='#777777')
    elif kind == 'rank':
        d.text((60, 80), '2024全年GDP十强', font=font(52, True), fill='#ffffff')
        d.text((60, 150), '单位：万亿元', font=font(24), fill='#888888')
        maxv = 14.1
        for i, (p, v) in enumerate(rows):
            y = 210 + i * 82
            bw = int((v / maxv) * (W - 320))
            d.text((60, y), str(i + 1), font=font(40, True), fill='#e8c062')
            d.text((110, y), p, font=font(36, True), fill='#ffffff')
            d.rectangle([260, y + 8, 260 + bw, y + 50], fill=('#e8c062' if i < 4 else '#5a5a5a'))
            d.text((270 + bw, y), str(v), font=font(30), fill=('#e8c062' if i < 4 else '#aaaaaa'))
        d.text((60, H - 70), '数据：国家统计局2024年终值核算', font=font(20), fill='#777777')
    elif kind == 'shuffle':
        d.text((60, 120), '洗牌看点', font=font(60, True), fill='#e8c062')
        fb = font(30)
        lines = ['安徽追得最猛 新能源车加半导体', '把安徽从第十一一路顶到压着湖南', '河南四川挤在六万亿档', '第五第六咬得很紧', '前四广东江苏山东浙江位子铁打', '中部省份才是真正戏台', '后段洗牌远比头部热闹']
        for i, l in enumerate(lines):
            for j, seg in enumerate(wrap(d, l, fb, W - 120)):
                d.text((60, 240 + i * 80 + j * 40), seg, font=fb, fill='#ffffff')
        d.text((60, H - 70), '趋势性表述 以统计局公开数据为准', font=font(20), fill='#777777')
    img.save(path, quality=88)


for k in ['cover', 'rank', 'shuffle']:
    card(f'gdp_{k}.jpg', k)
print('生成3张GDP卡片')
