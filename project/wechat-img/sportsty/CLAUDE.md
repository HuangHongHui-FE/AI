# 赛事分析稿（仿「雨神战术板」）写作与发布

在这个目录里收到「写两篇/写一篇 赛事分析稿」「照上次那个格式写」之类的要求时，按本文件执行，不要另起炉灶。

样板稿在仓库 `output/2026-10-29/01-切尔西VS曼联/`、`02-曼城VS布莱顿/`（若已被清理，看 `template/`）。**格式、字数、结尾块逐字照抄，不要自由发挥。**

---

## 产出物

```
sportsty/output/YYYY-MM-DD/NN-主队VS客队/
  article.json   你写
  media.jpg      配图（实拍，非文字图表）
  cover.jpg      publish.mjs 自动裁（没有才生成）
  meta.json      发布后生成，记录 media_id
```

`output/` 已被 .gitignore 忽略，不用提交。

---

## 第 0 步 · 定题（比赛从哪来）

不要凭空编赛程。两个来源，先跑：

```bash
# 1) 近三日赛程（直播吧首页，含联赛轮次、开球时间、是否有直播）
curl -sL -A "Mozilla/5.0" https://www.zhibo8.cc/ -o /tmp/zb.html

# 2) 竞彩编号（结尾三行要用「周五 001 澳超 …」这种写法，编号必须真实）
curl -sL -H "Referer: https://www.sporttery.cn/" \
  "https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=hhad,had&channel=c" -o /tmp/sp.json
```

从 HTML/JSON 里读赛程与编号。定题规则：

- 挑**当天或次日、五大联赛/英超**里话题最热的两场，两篇不同赛事。
- 主稿**不要**占用结尾三行里已列出的场次（那三场是引流用的）。
- 一场按「客队有麻烦、主队占优」的方向写；方向由事实决定，不要硬拗。

## 第 1 步 · 抓事实（每篇至少 5 条硬事实，含数字/人名/原话）

新闻列表与正文都在直播吧，抓列表拿链接，再抓正文：

```bash
curl -sL -A "Mozilla/5.0" https://news.zhibo8.cc/zuqiu/ -o /tmp/znews.html
# 取某条新闻正文：文章页从 <div class="title"> 之后开始
curl -sL -A "Mozilla/5.0" "https://news.zhibo8.com/zuqiu/2026-10-29/<id>native.htm" -o /tmp/a.html
python3 -c "
import re,html
h=open('/tmp/a.html',encoding='utf-8',errors='ignore').read()
i=h.find('<div class=\"title\">')
t=re.sub(r'<script.*?</script>','',h[i:],flags=re.S)
t=html.unescape(re.sub(r'<[^>]+>','\n',t))
print('\n'.join(x.strip() for x in t.split('\n') if x.strip())[:4000])"
```

要拿到的东西：主帅发布会原话、伤病与停赛、近期战绩与排名、历史交锋、场外变量（金主到场、转会账本、名宿开炮）。**数字一律带来源与日期**（如「《邮报》援引 CIES」「10月24日英超彩经」）。查不到就不写，不编比分、不编伤情。

## 第 2 步 · 配图（必须实拍，不能是文字图表）

```bash
node ../src/find_img.cjs --batch "英超" "切尔西 曼联" /tmp/img1 8
# 或单张：node ../src/find_img.cjs --news "关键词" /tmp/x.jpg
```

看图挑一张：**横向、有球员/教练/球场、无大面积水印、跟这一场的具体情节有关**（例如发布会、晋级庆祝）。看一眼 `manifest.md` 里的来源标题再决定。挑好后存成该篇目录下的 `media.jpg`。

封面不单独做：`publish.mjs` 会在缺封面时用 `media.jpg` 裁 900×383（`position: attention`），与内文同一张图。

## 第 3 步 · 写 article.json

**结构（严格 5 段，图片在第 2 段之后）：**

1. 客队近况：赛前最硬的事（发布会原话、伤病、人事）
2. 客队更深的问题（账本/数据/名宿评价）
3. ——配图——
4. 主队状态与数据
5. 交锋记录 / 战术克制 / 场外变量
6. 伤停汇总 + 一句看好方向（「本场看好 X 主场拿下三分」）

**字数**：正文（不含结尾块）780–830 字；连结尾块合计 950–1000 字。

**标题**：`联赛：主队VS客队，客队＋四字判断！`，≤22 字，用真队名。
**摘要**：≤54 字，一句最硬的事实＋悬念。

**HTML 版式（数值别改）：**

```html
<p style="margin: 0 0 18px;"><span leaf="">正文段落</span></p>
<section style="text-align: center; margin: 18px 0;"><img src="media.jpg" style="max-width:100%;display:block;margin:0 auto;" /></section>
```

- 段间距 18px，图片上下各 18px
- 正文不要写 font-size、color（跟随微信默认 17px）
- 不要把配图放到第一段之前；不要引用封面文件

## 第 4 步 · 拼结尾（逐字照抄，不要改写）

把 `template/cta.html` 原样接到正文最后。它包含：蓝色引导句 → 三行红色赛程（20px、`rgb(255,41,65)`、加粗）→ **公众号名片（真实 `<mp-common-profile>` 标签）** → 结尾那句（15px、高亮 `rgb(255,76,65)`）。

三行赛程按第 0 步拿到的**当周真实编号**替换（格式：`周五 001 澳超 布里斯班狮吼VS奥克兰FC`）。

名片是「雨神战术板」的真实卡片，`data-id="MzY4NTMyNTg5MA=="`。要换成别的号，只改 `data-nickname`、`data-id`、`data-headimg`、`data-signature` 四个属性——别用表格画一个假的。

## 第 5 步 · 预览与推送

```bash
node publish.mjs output/YYYY-MM-DD/01-主队VS客队 --dry-run   # 本地预览 article.html
node publish.mjs output/YYYY-MM-DD/01-主队VS客队             # 推草稿
node publish.mjs output/YYYY-MM-DD/01-xxx output/YYYY-MM-DD/02-yyy  # 一次推多篇
```

`meta.json` 里有 media_id 时会**原地更新**，不会产生重复草稿。

推送前自查：

- [ ] 5 段结构，图片在第 2 段后，正文 780–830 字
- [ ] 标题 ≤22 字，摘要 ≤54 字
- [ ] 至少 5 条带来源的硬事实，无「据传/疑似/据说」
- [ ] 配图是实拍照片，不是数据卡；`media.jpg` 已在目录里
- [ ] 结尾块与 `template/cta.html` 逐字一致（含名片标签）
- [ ] 没有第一人称「我」，没有「说到底/不是X是Y」这类套话
