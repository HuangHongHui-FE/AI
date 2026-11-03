---
name: publish-kit
description: 把已排版正文 + 首图 GIF 拼成「打开就能复制粘贴」的物料：copy.html（正文内嵌 base64 首图）+ 发布物料.md（公众号标题/摘要/正文、视频号短标题/描述、抖音快手文案）。不推送任何平台。
---

# publish-kit —— 出发布物料

**给什么**：`article.json` + `format-html` 的 `content.html` + 首图 GIF（+ 可选封面、成片）
**还什么**：`copy.html` + `发布物料.md`

原实现是 `project/mingchangmian/skill/06-出物料/出物料.py`（依赖同级 wechat-img 的 `--dry-run`）。此原子改成消费 `format-html` 的产物，不再依赖旧项目。

## 用法

```bash
node atom/publish-kit/src/index.mjs \
  --article output/2026-10-09/01-我靠袁华/article.json \
  --html 05-format-html/content.html \
  --gif input/clips/024-我靠袁华.gif \
  --cover 06-cover/cover.jpg \
  --video 名场面/成品/024-我靠袁华.mp4 \
  --out-dir output/2026-10-09/01-我靠袁华
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--article` | 必填 | article.json（含 title/digest/body_markdown/video_*） |
| `--html` | 必填 | `format-html` 产出的 `content.html` |
| `--gif` | 必填 | 首图 GIF，会 base64 内嵌进 `copy.html` |
| `--cover` | 无 | 封面图；只写进物料说明，不复制 |
| `--video` | article.video | 成片路径 |
| `--out-dir` | article 所在目录 | 物料输出目录 |
| `--date` | 今天 | 物料里的日期 |

## 产物

- `copy.html`：浏览器打开 → 全选复制 → 粘进公众号编辑器；首图 GIF 已内嵌
- `发布物料.md`：标题/摘要/正文复制说明、封面、视频号短标题/描述、抖音快手文案

## 短标题检查

视频号短标题有平台白名单：

- 允许：`《》「」“”‘’：:+？%℃`
- 禁止：`，。、；！,.;!·—～~()（）【】[]{}<>/\|@#$^&*=`

命中禁止标点会在 stdout 的 `short_bad_punct` 里返回并打警告——平台不报错、静默失败，**必须换成空格**。

## 注意

1. 不推送任何平台，只准备物料。
2. `copy.html` 内嵌 base64，单文件可能 5MB+，体积来自 GIF。
3. 封面不覆盖已有文件；要换封面直接替换 `cover.jpg` 即可。