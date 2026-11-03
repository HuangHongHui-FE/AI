---
name: video-cut
description: 名场面固定四段剪辑：钩子段 → 打字机标题卡 → 正文（完整源视频）→ 片尾关注卡。单条或批量（按文件名 <编号>-<标题>-<起>-<止>.mp4 读钩子段）。依赖 imageio-ffmpeg。
---

# video-cut —— 名场面剪辑

**给什么**：源视频 + 标题 + 钩子时间段（批量模式从文件名读）
**还什么**：成品 mp4

原实现是 `project/mingchangmian/skill/B1-剪成片/剪辑模板.py` + `批量剪.py`。

## 用法

```bash
# 单条
node atom/video-cut/src/index.mjs --mode single \
  --source "素材/018-高三八班、全体起立.mp4" \
  --title "高三八班、全体起立" \
  --hook-range 47-53 \
  --cta "成品/004-食s了你-2月16日.mp4" \
  --media-root 名场面

# 批量：扫描 <media-root>/素材/，按文件名读钩子段
node atom/video-cut/src/index.mjs --mode batch --media-root 名场面 --plan
node atom/video-cut/src/index.mjs --mode batch --media-root 名场面 --only 019,020
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--mode` | `single` | `single` / `batch` |
| `--source` | single 必填 | 源视频，相对 `--media-root` |
| `--title` | single 必填 | 标题卡文字 |
| `--hook-range` | single 必填 | 钩子段秒数，如 `47-53`；会播两遍 |
| `--cta` | 无 | 片尾关注卡视频，取末尾 2 秒 |
| `--out` | `<media-root>/成品/<源文件名>` | 成品路径 |
| `--media-root` | 当前目录 | 素材/成品根目录 |
| `--music` | 无 | 背景音乐 |
| `--font` | 系统 PingFang | 标题字体路径 |
| `--only` / `--force` / `--plan` | — | 批量模式选项 |

## 批量文件名约定

```text
023-我没上车，我还没上车-101-106.mp4
→ 编号 023，标题「我没上车，我还没上车」，钩子 101–106 秒
→ 成品 成品/023-我没上车，我还没上车.mp4
```

不符合约定的文件跳过（缺钩子秒数）。

## 输出

```json
{ "ok": true, "mode": "single", "file": "/abs/名场面/成品/018-....mp4", "bytes": 12345678 }
```

批量模式返回 `{ ok, mode:"batch", stdout }`。

## 依赖

- `imageio-ffmpeg`（提供 ffmpeg）
- 字体：默认 `/System/Library/Fonts/PingFang.ttc`，可用 `--font` 覆盖