# 02 切图

> **输入**：`01-选题` 给出的「片名 + 名场面」
> **产出**：`input/clips/<名>.gif` —— 一篇一张，同时作正文头图 + 封面底图
> **可扩展点**：换/加视频源站点、改画幅与画质参数、加新的切片方式，都改本文件 + `../gif_clip.py`

---

## 这一步做什么

给选定的名场面找到视频源，切出一张 3-8 秒的 GIF。

## 1. 定视频源

每条名场面需要：**B站视频链接（BV号）+ 名场面所在时间段（开始-结束）**。

- 找法：WebSearch 搜「片名 名场面 B站」拿 BV 号；时间段先估，下完 raw.mp4 后用 ffmpeg 抽几帧确认台词/画面在不在区间内，不对就微调重切。
- **B站 cookie**：高清源 / 部分影视需要登录。脚本已支持 `--cookies-from-browser chrome`（自动读浏览器登录态，半年内不用维护）和 `--cookies <cookies.txt>`；默认不带 cookie，报登录错误时加上即可。
- 找不到视频源（BV 号搜不到 / 链接失效）→ 回 `01-选题` 换一条，不为单卡住。

## 2. 切 GIF

```bash
python3 skill/gif_clip.py "<B站URL>" <开始> <结束> <输出名>
# 例: python3 skill/gif_clip.py "https://www.bilibili.com/video/BVxxxx" 01:23 01:31 让子弹飞-站着挣钱
# → 输出 input/clips/让子弹飞-站着挣钱.gif
```

时间格式：秒数（`95`）/ `MM:SS`（`01:35`）/ `HH:MM:SS` 都行。

**一张就够**：这张 GIF 同时作正文头图 + 封面底图（`06-推草稿` 的 `--image` 指它，封面由推草稿脚本套 slogan 生成）。

**参数约束**：
- 时长 **3-8 秒**（名场面精华帧，太长体积爆炸、太短没情绪）
- 默认 fps 10 / 宽 360，体积应 < 3MB；超 3MB 缩短时长或改宽 240 重切
- **不要切整段长戏**，挑最有辨识度的一两句台词/一个动作的窗口

> **流程 B 的 [`B2-切首图`](../B2-切首图/README.md) 复用本节全部约束**，只是输入换成本地源文件、时间段改用用户给的钩子段（不经 B站 / yt-dlp / cookie）。
> 改这里的约束，B2 跟着生效 —— 所以**别在 B2 里另写一份数字**，会漂移。

## 3. 验证

切完 Read 一下 `input/clips/<名>.gif` 预览（>5MB 读不动就 ls 看体积，体积合理即过）。画面不对（切错段、黑屏、带无关片头）→ 调时间码重切。

---

## 本步的坑 / 不要做

1. **B站 playurl 接口 412（最常见，且 cookie 救不了）**：`yt-dlp` 在「Downloading video formats」这步报 `HTTP Error 412: Precondition Failed`。注意区分——`bilisearch` 搜索和 `web-interface/view` 都正常，**只有 playurl 被拦**，加 `--cookies-from-browser chrome`、加 UA 都无效（yt-dlp 2025.10.14 是 Python 3.9 能装的最后一版，新版接口对不上）。
   **绕法**：走 `platform=html5` 的接口拿直链，再手动跑 `gif_clip.py` 里同一套 ffmpeg 两遍法：
   ```bash
   # 1) 拿 cid 和直链（UA + Referer 必须有）
   curl -s -H "User-Agent: Mozilla/5.0 ... Chrome/120.0 Safari/537.36" \
        -H "Referer: https://www.bilibili.com/video/<BV号>" \
        "https://api.bilibili.com/x/player/playurl?bvid=<BV号>&cid=<cid>&qn=32&fnval=1&fnver=0&fourk=1&platform=html5&high_quality=1"
   # → data.durl[0].url 就是 360p 直链，curl 下它即可
   # 2) 再按下面「参数约束」的 ffmpeg 参数切（fps=10, scale=360:-1:flags=lanczos + palettegen/paletteuse）
   ```
   `cid` 从 `https://api.bilibili.com/x/web-interface/view?aid=<aid>` 的 `data.cid` 取（`bilisearch` 返回的是 aid）。
2. **B站高清源需要登录态**：脚本已支持 `--cookies-from-browser chrome`（自动读浏览器登录态）和 `--cookies <cookies.txt>`；默认不带 cookie。
3. **切片时间码偏移**：估的时间码常差几秒，**下完 raw.mp4 后抽帧确认台词在不在窗口**，不对就 ±3 秒重切，**别盲推**。抽帧定位的省事做法：用 `fps=1/<间隔>` + `tile` 做带时间码的缩略图总览（`drawtext=text='%{pts\:hms}'`），一眼看清整段场景结构，再逐秒放大确认边界。
4. **第三方工具水印**：搬运号常在右下角留「CR VideoMate」之类的工具水印。量准它的纵向范围（字幕一般占 y=173-188、水印占 y=192-200 这种量级），用 `crop=360:ih-13:0:0` **精确裁掉水印、保住字幕**。裁多了会把字幕切掉。
5. **GIF 体积**：8 秒以上或宽 480 容易破 5MB，公众号加载慢且读不动。卡在 3-8 秒 / 宽 360。
6. **封面比例**：公众号封面 2.35:1，而切出来的 GIF 通常是 1.89:1，合成封面时上下会各裁一刀 → **画面最底部的字幕会被裁没**。挑窗口时留意首帧在 2.35:1 下还剩什么（详见 `05-自查`）。
7. 不切整段长戏当首图；不一篇配多图（名场面号一篇一张 GIF，多了反而稀释）。
8. 暴力/血腥镜头的 GIF 不切（选台词窗口而非打斗窗口）。
