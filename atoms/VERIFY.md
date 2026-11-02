# 验证手册

每一步都是**一条命令 + 一句「应该看到什么」**。任何一步不对就停下，不必往下走。

所有命令都在 `atoms/` 目录下执行：

```bash
cd /Users/zcy1/code_self/AI/atoms
```

**先建一个测试目录**，下面所有产物都放这里，验完整体删掉即可：

```bash
mkdir -p /tmp/atomtest && cd /Users/zcy1/code_self/AI/atoms
```

**测试素材**（都是仓库里现成的真实文件，不用自己找）：

> 选这篇是因为它**正文不带内图**——历史稿件的内图早被清掉了，用带内图的稿会触发「缺图硬拦」。
> 想验内图上传那一段，见第 5.4 步末尾的补充说明。

| 用途 | 路径 |
|---|---|
| 一篇真实历史稿件 | `../project/wechat-img/output/2026-10-20/01-上海抢金/article.json` |
| 该稿件配套封面 | `../project/wechat-img/output/2026-10-20/01-上海抢金/cover.jpg` |
| 张竖图（640x870） | `../project/wechat-img/input/20260822-04-台媒造谣北京冰箱/03-冰箱.jpg` |
| 一张横图 | `../project/wechat-img/input/20260822-02-台风沙德尔/03-台风登陆现场.jpg` |

---

## 第 0 步：30 秒自检

```bash
node atom/scripts/lint-paths.mjs
```

**应该看到**：`lint-paths: 通过（检查 79 个文件）`

这一条挂了说明有硬编码路径或密钥，先别往下。

---

## 第 1 步：离线回归（3 分钟，最重要）

```bash
npm test
```

**应该看到**结尾：

```
✓ recipe/wechat-hotspot
✓ cover-image
✓ dedup-log
✓ fanqie-publish
✓ format-html
✓ hotlist
✓ selfcheck
✓ wechat-draft
✓ wechat-newspic

9/9 项回归通过
```

**这一步在验什么**：120 条断言，跑本地 mock 服务器，不联网、不碰你的任何账号。它验证的是「代码逻辑对不对、契约字段对不对、拦截规则生不生效」。

**这一步验不了什么**：真实微信公众号、头条、番茄的接口。

> 某项失败时，单独跑那一项看详细输出：
>
> ```bash
> node atom/selfcheck/fixtures/regression.mjs      # 15 条
> node atom/format-html/fixtures/regression.mjs    # 21 条
> node atom/dedup-log/fixtures/regression.mjs      # 16 条
> node atom/wechat-draft/fixtures/regression.mjs   # 11 条
> node atom/wechat-newspic/fixtures/regression.mjs # 12 条
> node atom/fanqie-publish/fixtures/regression.mjs # 14 条
> node atom/cover-image/fixtures/regression.mjs    # 7 条
> node atom/hotlist/fixtures/regression.mjs        # 6 条
> node recipe/wechat-hotspot/fixtures/regression.mjs # 18 条
> ```

---

## 第 2 步：和旧代码对比（证明「迁移没走样」）

```bash
npm run test:all
```

比 `npm test` 多跑三组**逐字节对比**，把 `project/` 里的旧实现请出来当裁判：

| 裁判 | 怎么比 | 应该看到 |
|---|---|---|
| `project/wechat-img/src/preflight.js` | 670 篇历史稿逐篇判 FAIL/PASS | 一致率 **100.0%**，新更严 0、新更松 0 |
| `project/wechat-img/src/html.js` | 6 个主题渲染同一篇 markdown | `✓ 与源 html.js 一致：ocean — 5984 字节`（6 行全 ✓） |
| `project/wechat-img/src/cover.js` | 6 种布局处理同一张图 | `✓ 与源 cover.js 一致：plain — a7905285`（6 行全 ✓） |

**这一步为什么重要**：它证明新代码不是「重写了一个差不多的东西」，而是「逐字节等价」。

想看 dedup-log 的对比就手动跑（这条不在 `test:all` 里）：

```bash
cd ../project/wechat-img && node src/recent.js 5 > /tmp/a.txt
cd ../../atoms
node atom/dedup-log/src/index.mjs --logs ../project/wechat-img/logs --n 5 2>/tmp/b.txt >/dev/null
diff /tmp/a.txt /tmp/b.txt && echo "完全一致"
```

**应该看到**：`完全一致`（没有任何 diff 输出）

---

## 第 3 步：真实联网的原子（不需要任何凭据）

这几个是公开接口，现在就能跑：

```bash
# ① 热榜
node atom/hotlist/src/index.mjs --limit 5
```
**应该看到**：stderr 打出五个平台的榜单（头条/百度/抖音/B站/微博），末尾 JSON 里 `"ok": true`。
重点看**前几条是不是今天的新闻**——这是判断数据是不是实时的最直接办法。

```bash
# ② K 线
node atom/kline/src/index.mjs --code 300750 --period month --out /tmp/atomtest/k.jpg --title "宁德时代"
```
**应该看到**：`✓ K线图 101 个点 ...`，然后 `open /tmp/atomtest/k.jpg` 能打开一张深蓝色背景的折线图。
重点看：**图上最高/最低标注有没有压到折线上**（我修过一次这个重叠）。

```bash
# ③ 找图
node atom/find-image/src/index.mjs --subject "全红婵" --event "全运会夺冠" --out-dir /tmp/atomtest/imgs --target 20
```
**应该看到**：`完成：20 张`。
重点验证两件事：
```bash
ls /tmp/atomtest/imgs/*.jpg | wc -l                              # 期望 20
md5 /tmp/atomtest/imgs/*.jpg | awk '{print $NF}' | sort | uniq -d | wc -l   # 期望 0（无重复）
file /tmp/atomtest/imgs/001-主图.jpg                              # 期望 "JPEG image data"（不是 WebP/PNG）
```
这三条分别对应我修过的：张数、内容级去重、假 jpg 格式。

```bash
# ④ 抓事实
node atom/fetch-facts/src/index.mjs --query "美舰闯南沙" --out-dir /tmp/atomtest/facts
cat /tmp/atomtest/facts/facts.md
```
**应该看到**：抓到的条目数、来源媒体名、以及 stderr 里的「事件簇」汇总（如 `· [10 家] 美舰冲闯...`）。
重点看**来源媒体是不是真的**（人民日报/观察者网/央广网这些），如果全是空字符串说明解析坏了。

---

## 第 4 步：产物能直接看的原子

```bash
# 先把上面那篇真实稿件转成 markdown 供后续使用
node -e "
const a=JSON.parse(require('fs').readFileSync('../project/wechat-img/output/2026-10-20/01-上海抢金/article.json','utf8'));
require('fs').writeFileSync('/tmp/atomtest/article.md', a.body_markdown);
console.log('标题:',a.title,'| 正文',a.body_markdown.length,'字');
"

# 排版：生成主题预览，肉眼扫一遍
node atom/format-html/src/index.mjs --md /tmp/atomtest/article.md --out-dir /tmp/atomtest/fmt --theme ocean --title "测试"
open /tmp/atomtest/fmt/preview.html
```
**应该看到**：浏览器打开一篇带灰底白卡的文章，有标题色条、加粗带浅底、引用块有左竖线。
把 `--theme` 换成 `warm` / `wine` / `graphite` 再跑，**配色应该明显不同**。

```bash
# 封面：横图
node atom/cover-image/src/index.mjs   --image ../project/wechat-img/input/20260822-02-台风沙德尔/03-台风登陆现场.jpg   --out /tmp/atomtest/cover.jpg
open /tmp/atomtest/cover.jpg
```
**应该看到**：一张 900x383 的横图（2.35:1），主体完整没被切碎。

```bash
# 封面：竖图（640x870，这是重点，我修过这条）
node atom/cover-image/src/index.mjs   --image ../project/wechat-img/input/20260822-04-台媒造谣北京冰箱/03-冰箱.jpg   --out /tmp/atomtest/cover-v.jpg
open /tmp/atomtest/cover-v.jpg
```
**应该看到**：人物主体完整，而不是被压扁/只剩腰部。原图顶部的文字/水印应该被裁掉了。

```bash
# 贴图竖图：把整个 input 目录的图转成 1080x1920
node atom/img-normalize/src/index.mjs   --src-dir ../project/wechat-img/input/20260822-02-台风沙德尔   --out-dir /tmp/atomtest/tietu --preset tietu-9x16
open /tmp/atomtest/tietu/03-台风登陆现场.jpg
```
**应该看到**：原图完整居中，上下是**模糊的同一张图**填充，不拉伸不变形。

```bash
# 音频（用上面转好的 article.md）
node atom/tts-audio/src/index.mjs --text-file /tmp/atomtest/article.md --out /tmp/atomtest/ep.mp3
afplay /tmp/atomtest/ep.mp3
cat /tmp/atomtest/ep.script.txt
```
**应该看到**：能听到女声朗读，`script.txt` 里是去掉 markdown 符号的纯文本。
重点听：**有没有把「第一段」「##」这种结构符号念出来**。

---

## 第 5 步：公众号相关（需要你的凭据）

### 5.1 先确认凭据配好了

```bash
cp .env.example .env     # 如果还没有
# 编辑 .env，填 WECHAT_WECHATIMG_APPID / WECHAT_WECHATIMG_SECRET
npm run accounts
```
**应该看到**：列出你配的别名，`hasSecret: true`。

### 5.2 验 token（不产生任何草稿，最安全）

```bash
node atom/wechat-draft/src/index.mjs --verify --account wechatimg
```
**应该看到**：`"ok": true`

- 报 `40164` → 出口 IP 不在白名单，去 mp.weixin.qq.com → 开发 → 基本配置 → IP 白名单，加当前 IP
- 报 `40013` → appid 填错了
- 报 `40125` → secret 填错了

### 5.3 本地校验（还是不发）

```bash
node atom/wechat-draft/src/index.mjs \
  --html /tmp/atomtest/fmt/content.html \
  --cover /tmp/atomtest/cover.jpg \
  --title "测试" --account wechatimg --dry-run
```
**应该看到**：`"dry_run": true`，且 `images` 数组列出了正文里的图。

### 5.4 真推一篇到草稿箱（不会发布）

```bash
node atom/wechat-draft/src/index.mjs \
  --html /tmp/atomtest/fmt/content.html \
  --cover /tmp/atomtest/cover.jpg \
  --title "【测试】原子库验证" \
  --digest "测试摘要" \
  --account wechatimg \
  --out-dir /tmp/atomtest/draft
```
**应该看到**：

```
✓ 草稿已生成：media_id=...
```

（这篇稿件没有内图，所以不会出现「✓ 内文图已上传」——内图那段见下方单独验）

然后去 mp.weixin.qq.com → 草稿箱，**确认标题、封面、正文、内文图都对**，看完删掉。

**这一步特别要盯的**：
- 封面在草稿箱里显示正常吗？（有些布局会被微信报 53402 裁剪失败，那就要换布局）
- 内文图显示出来了吗？——这篇稿件没有内图，所以 `images` 是空数组，输出里不会出现「✓ 内文图已上传」

**想验内图上传**，自己造一份最小 HTML：

```bash
cat > /tmp/atomtest/with-img.html <<'EOF'
<p>这是正文第一段。</p>
<p><img src="../project/wechat-img/input/20260822-02-台风沙德尔/03-台风登陆现场.jpg" alt="台风现场"></p>
<p>这是正文第二段。</p>
EOF

node atom/wechat-draft/src/index.mjs \
  --html /tmp/atomtest/with-img.html \
  --cover /tmp/atomtest/cover.jpg \
  --title "【测试】内图上传" --account wechatimg \
  --out-dir /tmp/atomtest/draft2
```
**应该看到**：`✓ 内文图已上传: 03-台风登陆现场.jpg`，草稿箱里那张图正常显示。

顺便验一下两条硬拦截（都该 `exit 2`）：

```bash
# 缺图：引用一个不存在的文件
sed 's#03-台风登陆现场.jpg#不存在的图.jpg#' /tmp/atomtest/with-img.html > /tmp/atomtest/missing.html
node atom/wechat-draft/src/index.mjs --html /tmp/atomtest/missing.html --cover /tmp/atomtest/cover.jpg --title t
# 期望：[ERROR] 正文引用了 1 张不存在的图

# 撞脸：正文引用封面同一文件
echo '<p><img src="/tmp/atomtest/cover.jpg"></p>' > /tmp/atomtest/clash.html
node atom/wechat-draft/src/index.mjs --html /tmp/atomtest/clash.html --cover /tmp/atomtest/cover.jpg --title t
# 期望：[ERROR] 正文引用了封面文件（cover.jpg）…撞脸
```

### 5.5 贴图（另一个号）

```bash
node atom/wechat-newspic/src/index.mjs \
  --title "【测试】贴图" \
  --images-dir /tmp/atomtest/tietu \
  --body "测试文案" \
  --account dychatimg \
  --out-dir /tmp/atomtest/newspic
```
**应该看到**：`✓ 草稿已生成`，草稿箱里是一条**图片消息**（不是图文），图片按 001→002 顺序排列。

---

## 第 6 步：头条（需要扫码）

```bash
node atom/toutiao-publish/src/index.mjs --login
```
**应该看到**：弹出浏览器 → 你扫码 → 脚本检测到登录态自动保存并关闭浏览器，输出 `✓ 登录态已保存`。

```bash
node atom/toutiao-publish/src/index.mjs \
  --article ../project/wechat-img/output/2026-10-20/01-上海抢金/article.json \
  --html /tmp/atomtest/fmt/content.html \
  --cover /tmp/atomtest/cover.jpg
```
**应该看到**：浏览器打开头条编辑页，**标题自动填好、正文自动贴进去**，然后停在那里等你操作。

**这一步最容易出问题**：如果报「找不到『标题输入框』元素」，说明头条改版了，跑 `--inspect` 看真实 DOM：

```bash
node atom/toutiao-publish/src/index.mjs --inspect --auth-dir .cache/toutiao
```
它会打印页面上所有输入框/可编辑区/按钮的选择器，你照着改 `atom/toutiao-publish/src/lib/editor.mjs` 的 `SELECTORS` 常量。

---

## 第 7 步：番茄（需要登录态文件）

```bash
# 先列书，确认鉴权有效
node atom/fanqie-publish/src/index.mjs --list --auth ../project/novel/.auth/fanqie.json
```
**应该看到**：列出你账号下的书（book_id + 书名 + 字数）。

⚠️ 我测的时候这个 token 已经过期了（返回「登录信息有误」）。如果报这个，需要重新抓 cookie + csrfToken 写回那个文件。

```bash
# 存草稿
node atom/fanqie-publish/src/index.mjs \
  --book <你的book_id> \
  --file 某章.md \
  --auth ../project/novel/.auth/fanqie.json
```
**应该看到**：`✓ 已存入草稿箱：item_id=...`
然后去番茄作家后台看草稿箱。

**关键验证点**：这本书**没有**被发布出去——脚本根本不含发布接口。

---

## 第 8 步：完整链路（可选）

```bash
node recipe/wechat-hotspot/run.mjs --prompt "验证" --subject "全红婵" --event "全运会夺冠"
```
**应该看到**：

```
  01-hotlist ✓
  01-hotlist ⏸ 产出已就绪，等待用户决定（.../01-hotlist/user-decision.json）
未完成
```

打开那个 `hotlist.json` 看看榜单。

```bash
# 模拟你选了某个热点
echo '{"chosen_topic":"全红婵夺冠"}' > runs/wechat-hotspot/<时间戳>/01-hotlist/user-decision.json

# 续跑（必须用 --resume）
node recipe/wechat-hotspot/run.mjs --resume <时间戳> --query "全红婵" --title "测试标题"
```
**应该看到**：跳过 01，跑完 02-find-image，再停在筛图点。

**这里要验的关键点**：`--resume` 是必须的。如果你不加 `--resume` 直接重跑，会新建一个目录、上一次的 `user-decision.json` 就丢在旧目录里了。

后面步骤会跑到 `04-write-article` 产出 `prompt.md` 后停下——因为正文需要 Claude 来写。你把写好的正文存成 `runs/.../04-write-article/article.json`，再 `--resume` 就会继续跑到推草稿。

---

## 我已经知道的脆弱点

验的时候这些地方要格外看：

| 位置 | 现象 | 为什么 |
|---|---|---|
| `find-image` + 2 字母实体 | 图片误伤率高 | 比如 `AL` 会匹配到一堆无关图，多实体全含也挡不住 |
| `fetch-facts` + 长句关键词 | 只抓到 1-2 条 | `"上海人排队买黄金"` 只出 1 条，`"黄金 抢购"` 出 5 条。要用 2-3 个核心词 |
| `toutiao-publish` | 报找不到元素 | 选择器是 2026-07-27 确认的，头条一改版就失效 |
| `fanqie-publish` | 登录信息有误 | token 过期，需重抓 |
| 微信封面某些布局 | 报 53402 | 横向渐变/半色块/白卡类布局会被拒，用 `diagonal-split` 等 |

---

## 只想验 1 分钟的话

```bash
node atom/scripts/lint-paths.mjs && npm test
```

两条都绿 → 代码是活的、逻辑是对的、契约是对齐的。剩下的是真实账号相关，那本来就得你在自己号上验。
