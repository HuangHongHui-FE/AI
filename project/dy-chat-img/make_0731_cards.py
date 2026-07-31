# 20260731 高温科普 三种温度辨清 自制信息图(零搬运)
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 1200


def font(sz, bold=False):
    # 中文字体：标题用黑体加粗，正文用苹方
    p = '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/PingFang.ttc'
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', sz)


def wrap(d, text, fnt, max_w):
    # 按字符宽度逐字换行
    out, line = [], ''
    for ch in text:
        if d.textlength(line + ch, font=fnt) <= max_w:
            line += ch
        else:
            out.append(line)
            line = ch
    if line:
        out.append(line)
    return out


def base(img, top=True):
    # 顶部金条 + 统一深底
    d = ImageDraw.Draw(img)
    if top:
        d.rectangle([0, 0, W, 8], fill='#e8c062')
    return d


def footer(d, text):
    # 底部来源标注条
    d.rectangle([0, H - 50, W, H], fill='#000000')
    d.text((60, H - 38), text, font=font(20), fill='#777777')


# 封面
def cover(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 220), '50℃', font=font(160, True), fill='#e8c062')
    d.text((60, 430), '量的到底是啥', font=font(72, True), fill='#ffffff')
    fb = font(26)
    for i, ln in enumerate(wrap(d, '气温 地表温度 体感温度 根本不是一回事 盛夏别被一个数字带跑', fb, W - 120)):
        d.text((60, 600 + i * 40), ln, font=fb, fill='#cccccc')
    d.rectangle([60, 820, W - 60, 824], fill='#333333')
    d.text((60, 870), '气象常识 · 定性表述 不编造数据', font=font(22), fill='#888888')
    footer(d, '图源：自制信息图 · 高温科普')
    img.save(path, quality=88)


# 三种温度对照
def temps(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '三种温度 别混着说', font=font(52, True), fill='#e8c062')
    d.text((60, 145), '同一个天 气象台报的和地面烤的能差出几十度', font=font(22), fill='#888888')
    cols = [
        ('气温', '#e8c062', '百叶箱离地1.5米\n遮阴通风处测的\n气象台预报的就是它\n夏天多在30至40度'),
        ('地表温度', '#d4a878', '地面吸太阳辐射后的表面温\n柏油路水泥地吸热更强\n盛夏可冲上五六十度\n所以烫脚的不是气温'),
        ('体感温度', '#a8c8d4', '气温加湿度风辐射综合\n湿度大汗难蒸发 体感更高\n风一吹又拉低\n人实际感受到的数'),
    ]
    cw = (W - 120) // 3
    for i, (name, col, desc) in enumerate(cols):
        x = 60 + i * cw
        d.rectangle([x, 210, x + cw - 10, 760], fill='#1a1a1a', outline=col)
        d.text((x + 16, 240), name, font=font(26, True), fill=col)
        for j, ln in enumerate(desc.split('\n')):
            d.text((x + 16, 320 + j * 60), ln, font=font(19), fill='#dddddd')
    d.rectangle([60, 810, W - 60, 1010], fill='#1a1a1a', outline='#e8c062')
    d.text((80, 840), '一句话', font=font(28, True), fill='#e8c062')
    fb = font(24)
    for j, ln in enumerate(wrap(d, '看预报认气温 出门认地温 难受认体感 三个数各有各的用处', fb, W - 160)):
        d.text((80, 900 + j * 40), ln, font=fb, fill='#dddddd')
    footer(d, '图源：自制信息图 · 气象常识定性表述')
    img.save(path, quality=88)


# 原理：为什么差这么多
def why(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '差出几十度 凭啥', font=font(52, True), fill='#e8c062')
    d.text((60, 145), '同一时刻气温和地温能差二三十度 不是测错了', font=font(22), fill='#888888')
    rows = [
        ('辐射烤地面', '#e8c062', '太阳先晒热地面 地面再把空气烤热 空气传热慢 所以地面烫 气温还没跟上'),
        ('湿度卡散热', '#b8d4a8', '汗靠蒸发带走热量 湿度大蒸发不动 热量憋在身上 体感比气温高出一截'),
        ('风带走热量', '#a8c8d4', '风把贴身热空气吹走 换来凉空气 没风时体感回弹 风一大体感骤降'),
        ('材质吸热差', '#d4a878', '柏油水泥吸热强草丛水面弱 同一片地踩不同表面 温度能差出十几度'),
    ]
    y = 220
    for title, col, desc in rows:
        d.rectangle([60, y, W - 60, y + 150], fill='#1a1a1a', outline=col)
        d.text((80, y + 18), title, font=font(30, True), fill=col)
        fb = font(22)
        for j, ln in enumerate(wrap(d, desc, fb, W - 160)):
            d.text((80, y + 70 + j * 36), ln, font=fb, fill='#dddddd')
        y += 170
    footer(d, '图源：自制信息图 · 物理机制科普')
    img.save(path, quality=88)


# 热射病危险信号+防暑清单
def heatstroke(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '真要命的是热射病', font=font(50, True), fill='#e8c062')
    d.text((60, 140), '中暑里最重的一种 体温冲过40度 无汗意识模糊 救慢了要命', font=font(22), fill='#b88080')
    # 危险信号
    d.rectangle([60, 220, W - 60, 560], fill='#1a1a1a', outline='#d4786a')
    d.text((80, 245), '看到这些信号 别扛', font=font(28, True), fill='#d4786a')
    sigs = ['体温飙高 皮肤却干烫不出汗', '头晕呕吐 意识开始发糊',
            '说话乱 抽搐 甚至昏倒', '在高温里待过 又出现上面任一条']
    fb = font(23)
    for i, s in enumerate(sigs):
        d.text((100, 310 + i * 56), '· ' + s, font=fb, fill='#dddddd')
    # 防暑清单
    d.rectangle([60, 600, W - 60, 990], fill='#1a1a1a', outline='#e8c062')
    d.text((80, 625), '能避就避的几条', font=font(28, True), fill='#e8c062')
    tips = ['正午十点到下午四点能不外出就不外出',
            '别等渴了才喝 小口持续补水 适当补盐',
            '给老人小孩留空调 别为了省电硬扛',
            '户外干活定时进阴凉 互相关照状态',
            '车里别留人 留的是命不是分钟']
    for i, s in enumerate(tips):
        for j, ln in enumerate(wrap(d, s, fb, W - 200)):
            d.text((100, 690 + i * 56 + j * 34), ln, font=fb, fill='#dddddd')
    footer(d, '图源：自制信息图 · 医学常识定性表述')
    img.save(path, quality=88)


if __name__ == '__main__':
    cover('cover-20260731.jpg')
    temps('img1.jpg')
    why('img2.jpg')
    heatstroke('img3.jpg')
    print('done: cover-20260731.jpg + img1/2/3.jpg')
