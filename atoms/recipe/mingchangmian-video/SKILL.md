# mingchangmian-video —— 名场面视频

用户说「写名场面」并**给了视频素材**时走这条流程。

## 步骤链

```
01-video-cut       源视频 → 四段成品（钩子 → 标题卡 → 正文 → 关注卡）
02-gif-clip        源视频钩子段 → GIF 首图（不带成品水印）
   ↓ Claude 起标题 + 写正文，落 article.json
03-selfcheck       公众号硬门
04-ai-flavor       AI 味预检
05-copyright-check 原片单镜头/占比/原创解说三项硬指标
06-format-html     正文 → 微信 HTML
07-cover-image     GIF 首帧 → 封面
08-publish-kit     copy.html + 发布物料.md（含视频号短标题/描述）
```

**终点是物料，不是发布**。视频号/抖音/快手由人手动发。

## 素材文件名约定

```text
素材/018-高三八班、全体起立-47-53.mp4
→ 编号 018，标题「高三八班、全体起立」，钩子 47–53 秒
```

`video-cut --mode single` 用显式参数；批量用 `--mode batch --media-root 名场面`。

## 运行

```bash
# 第一段：剪成品 + 切 GIF
node recipe/mingchangmian-video/run.mjs --prompt "写名场面" --only video-cut,gif-clip \
  --source "名场面/素材/018-高三八班、全体起立-47-53.mp4" \
  --title "高三八班、全体起立" \
  --hook_range 47-53 \
  --start 47 --end 53 \
  --name "018-高三八班" \
  --media_root 名场面

# Claude 写 article.json + body.md
# 第二段：续跑后半段（不要加 --only：跳过步骤的目录不会进模板上下文）
node recipe/mingchangmian-video/run.mjs --resume <id> \
  --article output/2026-11-03/01-高三八班/article.json \
  --title "高三八班" --name "018-高三八班" \
  --clip 2.8,2.4 --speech-sec 35 --date 2026-11-03
```

## 版权硬指标

| 指标 | 阈值 |
|---|---|
| 单个原片镜头 | ≤ 3.0 秒 |
| 原片累计占比 | < 10% |
| 原创解说占比 | ≥ 50% |

不传 `--clip` / `--speech-sec` 会记 WARN，`copyright-check` 判未通过——不能静默跳过。

## 可选手动步骤：发视频号草稿

```bash
node atom/video-channel-draft/src/index.mjs \
  --video runs/mingchangmian-video/<id>/01-video-cut/final.mp4 \
  --desc "..." --short "高三八班 全体起立"
```

短标题 ≤16 字，不能带逗号；只存草稿，绝不发表。

## 写作与合规

- 钩子段必须播两遍（标题卡前一次、正文里一次），不许「优化」成一遍
- 首图从**源视频**切，不从成品切（成品有水印）
- 一篇只配一张 GIF 首图
- 完整规范：`references/B1-剪成片.md`、`references/B2-切首图.md`、`references/B4-出视频物料.md`、`references/05-自查.md`
- 视频号短标题规则：`references/B5-发视频号.md`

## 相关原子

| 原子 | 作用 |
|---|---|
| `video-cut` | 四段剪辑（单条/批量） |
| `gif-clip` | 源视频 → GIF 首图 |
| `copyright-check` | 版权/原创度硬指标 |
| `selfcheck` / `ai-flavor` | 硬门 + AI 味 |
| `format-html` / `cover-image` | 排版 + 封面 |
| `publish-kit` | 出可复制物料 |
| `video-channel-draft` | 可选：发视频号草稿 |