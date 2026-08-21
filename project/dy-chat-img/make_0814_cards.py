# 20260814 反诈科普 读承诺性文字骗局 自制信息图(零搬运)
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


def base(img):
    # 顶部金条 + 统一深底
    d = ImageDraw.Draw(img)
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
    d.text((60, 210), '别念!', font=font(150, True), fill='#d4786a')
    d.text((60, 420), '陌生人让你读的字', font=font(66, True), fill='#ffffff')
    fb = font(26)
    for i, ln in enumerate(wrap(d, '亲口念出来 就成了你的「承诺」 那几句话 可能正对着一个录音', fb, W - 120)):
        d.text((60, 600 + i * 40), ln, font=fb, fill='#cccccc')
    d.rectangle([60, 820, W - 60, 824], fill='#333333')
    d.text((60, 870), '反诈科普 · 基于公开警示常识 不编造案例', font=font(22), fill='#888888')
    footer(d, '图源：自制信息图 · 反诈科普')
    img.save(path, quality=88)


# 街头骗术三步
def setup(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '街头那幕 三秒就能设套', font=font(50, True), fill='#e8c062')
    d.text((60, 140), '一段求助 一句「帮我念一下」 坑就挖好了', font=font(22), fill='#888888')
    steps = [
        ('① 拦你求助', '#d4786a', '老人或路人叫住你 说看不清/看不懂 「帮我念几个字」 姿态放得极低'),
        ('② 你一念', '#e8c062', '对着那张纸你开口了 手机或录音笔早开着 你的声音 一字不落'),
        ('③ 声音成「证据」', '#a8c8d4', '回头它变成「你承认欠钱」「你同意担保」的录音 拿来讹你 跟你谈条件'),
    ]
    y = 210
    for title, col, desc in steps:
        d.rectangle([60, y, W - 60, y + 180], fill='#1a1a1a', outline=col)
        d.text((80, y + 20), title, font=font(30, True), fill=col)
        fb = font(22)
        for j, ln in enumerate(wrap(d, desc, fb, W - 160)):
            d.text((80, y + 75 + j * 36), ln, font=fb, fill='#dddddd')
        y += 200
    d.rectangle([60, y, W - 60, y + 110], fill='#1a1a1a', outline='#e8c062')
    fb = font(24)
    for j, ln in enumerate(wrap(d, '你以为的举手之劳 是对方在收你的「口头承诺」', fb, W - 160)):
        d.text((80, y + 22 + j * 40), ln, font=fb, fill='#e8c062')
    footer(d, '图源：自制信息图 · 反诈科普')
    img.save(path, quality=88)


# 为什么不能念 法律视角
def law(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '几个字而已?法律上不是', font=font(50, True), fill='#e8c062')
    d.text((60, 140), '你没签字 但「你说过」 在证据里分量不一样', font=font(22), fill='#888888')
    rows = [
        ('口头也算数', '#e8c062', '承诺不一定要白纸黑字 当面讲出来、能证明自愿 就可能被认定是合同或承诺'),
        ('录音可作证据', '#a8c8d4', '合法取得的录音能当证据用 你的声音就是那条最省事的「字据」'),
        ('不用你签字', '#d4786a', '签字要你点头盖章 可录音只要「你开口」 防备难度高了一截'),
    ]
    y = 210
    for title, col, desc in rows:
        d.rectangle([60, y, W - 60, y + 150], fill='#1a1a1a', outline=col)
        d.text((80, y + 18), title, font=font(30, True), fill=col)
        fb = font(22)
        for j, ln in enumerate(wrap(d, desc, fb, W - 160)):
            d.text((80, y + 70 + j * 36), ln, font=fb, fill='#dddddd')
        y += 170
    d.rectangle([60, y, W - 60, y + 110], fill='#1a1a1a', outline='#d4786a')
    fb = font(24)
    for j, ln in enumerate(wrap(d, '签字要你点头 可「念出来」只差你开口', fb, W - 160)):
        d.text((80, y + 22 + j * 40), ln, font=fb, fill='#d4786a')
    footer(d, '图源：自制信息图 · 法律常识定性表述')
    img.save(path, quality=88)


# 识破与自保清单
def protect(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 70), '遇到这种事 这样处理', font=font(50, True), fill='#e8c062')
    d.text((60, 140), '帮人有一百种方式 不必要用「开口」这一种', font=font(22), fill='#888888')
    tips = [
        '陌生人让你念/读/复述任何一段话 直接拒:你自己能读',
        '涉及钱、欠条、担保、委托、验证码的字 一个字都别碰',
        '对方越急 越强调「就几个字」 越不要读 别给录音机会',
        '已开口被录音 别被「录音在我手上」唬住 留存现场证据 必要时报警',
        '要帮 可以帮他找保安/店员/警察 你的善意不用交在嘴上',
    ]
    y = 215
    fb = font(23)
    for i, s in enumerate(tips):
        d.rectangle([60, y, W - 60, y + 150], fill='#1a1a1a', outline='#e8c062' if i % 2 == 0 else '#a8c8d4')
        d.text((80, y + 15), f'{i + 1}', font=font(34, True), fill='#e8c062' if i % 2 == 0 else '#a8c8d4')
        for j, ln in enumerate(wrap(d, s, fb, W - 190)):
            d.text((130, y + 22 + j * 36), ln, font=fb, fill='#dddddd')
        y += 170
    footer(d, '图源：自制信息图 · 反诈科普')
    img.save(path, quality=88)


if __name__ == '__main__':
    cover('cover-20260814.jpg')
    setup('img1.jpg')
    law('img2.jpg')
    protect('img3.jpg')
    print('done: cover-20260814.jpg + img1/2/3.jpg')
