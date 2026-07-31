# 20260726 长鑫上市+奇瑞不卷 两篇自制信息图卡片(零搬运)
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 1200


def font(sz, bold=False):
    p = '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/PingFang.ttc'
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', sz)


def wrap(d, text, fnt, max_w):
    # 按字符宽度换行
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
    d = ImageDraw.Draw(img)
    if top:
        d.rectangle([0, 0, W, 8], fill='#e8c062')
    return d


# ===== 长鑫篇 4 张 =====
def cxmt_cover(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 200), '上市了', font=font(110, True), fill='#ffffff')
    d.text((60, 360), '和我们没啥关系', font=font(64, True), fill='#e8c062')
    fb = font(26)
    for i, l in enumerate(wrap(d, '长鑫存储估值千亿敲钟在即 一线工程师却这么说', fb, W - 120)):
        d.text((60, 520 + i * 38), l, font=fb, fill='#cccccc')
    d.text((60, H - 70), '国产DRAM龙头 · 内容基于公开行业信息', font=font(20), fill='#777777')
    img.save(path, quality=88)


def cxmt_monopoly(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), 'DRAM 全球三家垄断', font=font(50, True), fill='#ffffff')
    d.text((60, 150), '手机电脑里的内存条 长期靠进口', font=font(24), fill='#888888')
    cols = [('三星', '#e8c062', '韩国\n份额最大\n行业风向标'),
            ('SK海力士', '#b8d4a8', '韩国\n高端产能\n服务器内存强'),
            ('美光', '#d4a8a8', '美国\n在华有厂\n供货全球')]
    cw = (W - 120) // 3
    for i, (name, col, desc) in enumerate(cols):
        x = 60 + i * cw
        d.rectangle([x, 230, x + cw - 10, 720], fill='#1a1a1a', outline=col)
        d.text((x + 20, 260), name, font=font(28, True), fill=col)
        for j, ln in enumerate(desc.split('\n')):
            d.text((x + 20, 360 + j * 50), ln, font=font(22), fill='#dddddd')
    d.rectangle([60, 770, W - 60, 980], fill='#1a1a1a', outline='#e8c062')
    d.text((80, 800), '长鑫存储', font=font(36, True), fill='#e8c062')
    fb = font(24)
    for j, ln in enumerate(wrap(d, '国内唯一能量产DRAM的厂 总部合肥 砸了八年才立住产线', fb, W - 160)):
        d.text((80, 870 + j * 40), ln, font=fb, fill='#dddddd')
    d.text((60, H - 70), '行业格局以公开市场数据为准', font=font(20), fill='#777777')
    img.save(path, quality=88)


def cxmt_chain(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), '上市造富链', font=font(56, True), fill='#e8c062')
    d.text((60, 160), '越往上越吃肉 越往下越无感', font=font(26), fill='#cccccc')
    rows = [('资方 地方国资+国家大基金', '#e8c062', '押注最早 吃肉最厚'),
            ('管理层+核心持股员工', '#b8d4a8', '期权集中 喝汤'),
            ('普通工程师', '#d4a8a8', '工资+加班 上市预期差着量级')]
    y = 250
    for name, col, desc in rows:
        d.rectangle([60, y, W - 60, y + 220], fill='#1a1a1a', outline=col)
        d.text((80, y + 30), name, font=font(30, True), fill=col)
        for j, ln in enumerate(wrap(d, desc, font(24), W - 160)):
            d.text((80, y + 100 + j * 40), ln, font=font(24), fill='#dddddd')
        y += 250
    fb = font(24)
    for j, ln in enumerate(wrap(d, '期权池就那么大 摊到一线份额跟预期差着量级 真正扛冲量压力的恰恰是产线夜班', fb, W - 120)):
        d.text((60, y + 20 + j * 40), ln, font=fb, fill='#e8c062')
    d.text((60, H - 70), '分配视角基于公开股权激励常识', font=font(20), fill='#777777')
    img.save(path, quality=88)


def cxmt_meaning(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), '别只盯着谁分到钱', font=font(50, True), fill='#e8c062')
    d.text((60, 150), '看它到底干成了什么', font=font(26), fill='#cccccc')
    pts = ['几十年全球就三星海力士美光三家产DRAM',
           '长鑫是国内唯一能把内存芯片做出来的',
           '手机电脑里那根内存条过去基本靠进口',
           '合肥托底 大基金进场 砸八年立住产线',
           '上市是给资本一个出口 不是国产替代的终点']
    y = 240
    for p in pts:
        d.rectangle([60, y, W - 60, y + 150], fill='#1a1a1a')
        d.ellipse([90, y + 60, 110, y + 80], fill='#e8c062')
        for j, ln in enumerate(wrap(d, p, font(26, True), W - 200)):
            d.text((140, y + 50 + j * 40), ln, font=font(26, True), fill='#ffffff')
        y += 170
    d.text((60, H - 70), '核心技术国产化 以行业公开进展为准', font=font(20), fill='#777777')
    img.save(path, quality=88)


# ===== 奇瑞篇 4 张 =====
def qirui_cover(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 220), '不卷了', font=font(140, True), fill='#ffffff')
    d.text((60, 400), '我们不再参加内卷', font=font(48, True), fill='#e8c062')
    fb = font(26)
    for i, l in enumerate(wrap(d, '尹同跃这句话底气是出海那条腿', fb, W - 120)):
        d.text((60, 540 + i * 38), l, font=fb, fill='#cccccc')
    d.text((60, H - 70), '内容基于公开行业信息 · 不照搬榜单原文', font=font(20), fill='#777777')
    img.save(path, quality=88)


def qirui_choice(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), '卷价格 vs 卷价值', font=font(50, True), fill='#ffffff')
    d.text((60, 150), '奇瑞选了后者', font=font(26), fill='#888888')
    cols = [('卷价格', '#d4a8a8', '往下打\n利润打没\n谁也活不好\n国内一条腿走路\n只能跟着卷'),
            ('卷价值', '#e8c062', '往上走\n出口渠道\n高端品牌\n卖到毛利厚的市场\n奇瑞走的路')]
    cw = (W - 120) // 2
    for i, (name, col, desc) in enumerate(cols):
        x = 60 + i * cw
        d.rectangle([x, 230, x + cw - 10, 980], fill='#1a1a1a', outline=col)
        d.text((x + 30, 260), name, font=font(36, True), fill=col)
        for j, ln in enumerate(desc.split('\n')):
            d.text((x + 30, 380 + j * 70), ln, font=font(26), fill='#dddddd')
    d.text((60, H - 70), '判断基于公开企业表态与行业格局', font=font(20), fill='#777777')
    img.save(path, quality=88)


def qirui_route(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), '不卷的底气 第二曲线', font=font(48, True), fill='#e8c062')
    d.text((60, 150), '海外兜底 才敢说不卷', font=font(26), fill='#cccccc')
    rows = [('出口', '#e8c062', '中国乘用车出口连续多年第一 卖到俄罗斯南美中东'),
            ('高端化', '#b8d4a8', '往价格毛利更厚的档位走 不靠低价堆量'),
            ('国内不硬卷', '#d4a8a8', '国内价格战打到边际收益为负 不把价格当唯一武器')]
    y = 250
    for name, col, desc in rows:
        d.rectangle([60, y, W - 60, y + 250], fill='#1a1a1a', outline=col)
        d.text((80, y + 30), name, font=font(34, True), fill=col)
        for j, ln in enumerate(wrap(d, desc, font(26), W - 160)):
            d.text((80, y + 110 + j * 40), ln, font=font(26), fill='#dddddd')
        y += 280
    d.text((60, H - 70), '出口数据以中汽协公开口径为准', font=font(20), fill='#777777')
    img.save(path, quality=88)


def qirui_logic(path):
    img = Image.new('RGB', (W, H), '#101010')
    d = base(img)
    d.text((60, 80), '不卷给行业的信号', font=font(48, True), fill='#e8c062')
    d.text((60, 150), '比奇瑞自己更值得看', font=font(26), fill='#cccccc')
    pts = ['卷价格在国内已卷到边际收益为负',
           '靠出口起家的车企敢说不卷 说明第二条曲线立住了',
           '国内只一条腿走路的 越卷越没利润',
           '下一阶段比谁先找到第二曲线 出海高端或新赛道',
           '只会卷价格的车企 今年能活 明年未必']
    y = 240
    for p in pts:
        d.rectangle([60, y, W - 60, y + 150], fill='#1a1a1a')
        d.ellipse([90, y + 60, 110, y + 80], fill='#e8c062')
        for j, ln in enumerate(wrap(d, p, font(26, True), W - 200)):
            d.text((140, y + 50 + j * 40), ln, font=font(26, True), fill='#ffffff')
        y += 170
    d.text((60, H - 70), '趋势判断 以行业公开数据为准', font=font(20), fill='#777777')
    img.save(path, quality=88)


cxmt_cover('cxmt_cover.jpg')
cxmt_monopoly('cxmt_monopoly.jpg')
cxmt_chain('cxmt_chain.jpg')
cxmt_meaning('cxmt_meaning.jpg')
qirui_cover('qirui_cover.jpg')
qirui_choice('qirui_choice.jpg')
qirui_route('qirui_route.jpg')
qirui_logic('qirui_logic.jpg')
print('生成8张: 长鑫4 + 奇瑞4')
