# mingchangmian 历史素材与产出

从 `project/mingchangmian`（feature/20261007 分支）全量迁入的**数据**，不是原子代码。
能力实现见 `atoms/atom/{gif-clip,video-cut,copyright-check,publish-kit,wechat-browser-draft,video-channel-draft}`，
流程见 `atoms/recipe/mingchangmian` 与 `atoms/recipe/mingchangmian-video`。

## 目录

| 目录 | 内容 | 用途 |
|---|---|---|
| `clips/` | 已切好的首图 GIF | 历史成品；也可作 `publish-kit` / `cover-image` 的测试素材 |
| `output/` | 历史文章产出（article.json / article.html / cover.jpg / 发布物料.md） | 回归对照、写作参考 |
| `logs/` | 每篇发文日志 | `dedup-log` 的跨天去重输入 |

## 未随迁

- `名场面/` 媒体库（约 2.1GB：素材 / 成品 / resource / 图片）—— 原项目 `.gitignore` 已排除，
  不进 git；需要时从原机器拷贝。
- `skill/` 步骤文档与脚本 —— 文档在 `atoms/recipe/mingchangmian/references/`，
  脚本已拆成上述原子。
- `_已停用/publish.py` —— 原项目已停用的自动发布，故意不迁。

## 使用

```bash
# 用历史日志做写作维度避撞
node atoms/atom/dedup-log/src/index.mjs --logs atoms/testdata/mingchangmian/logs --n 5

# 用历史 GIF 重出物料（示例）
node atoms/atom/publish-kit/src/index.mjs \
  --article atoms/testdata/mingchangmian/output/2026-10-09/01-我靠袁华/article.json \
  --html <format-html 产出的 content.html> \
  --gif atoms/testdata/mingchangmian/clips/024-我靠袁华.gif \
  --out-dir /tmp/mcm-kit
```