---
name: gif-clip
description: 视频 URL/本地文件 + 时间段 → GIF。URL 走 yt-dlp 只下目标片段，本地文件直接 ffmpeg 裁；两遍调色板量化，默认 10fps / 宽 360。用于公众号名场面首图。
---

# gif-clip —— 视频切片转 GIF

**给什么**：视频链接（或本地视频）+ 起止时间
**还什么**：GIF 文件

原实现是 `project/mingchangmian/skill/gif_clip.py`。

## 用法

```bash
# B 站等在线源：只下载目标片段
node atom/gif-clip/src/index.mjs \
  --source "https://www.bilibili.com/video/BV..." \
  --start 47 --end 53 \
  --name 018-高三八班 --out-dir input/clips

# 本地文件（B2 首图）：不联网、不用 cookie
node atom/gif-clip/src/index.mjs \
  --source "名场面/素材/018-高三八班.mp4" \
  --start 00:47 --end 00:53 \
  --name 018-高三八班 --out-dir input/clips
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--source` | 必填 | 视频 URL 或本地路径 |
| `--start` / `--end` | 必填 | 秒数 / `MM:SS` / `HH:MM:SS` |
| `--name` | `clip` | 输出名（不含 `.gif`） |
| `--out-dir` | 当前目录 | GIF 输出目录 |
| `--fps` | 10 | 帧率；体积超 3MB 时降到 7-8 |
| `--width` | 360 | 输出宽度；公众号正文头图建议 640 |
| `--cookies-from-browser` | — | 读浏览器登录态（B 站高清源） |
| `--cookies` | — | Netscape cookies.txt 路径 |

## 参数约束（源 02-切图）

- 时长 3-8 秒
- fps 10
- 宽 360（首图）/ 640（正文头图）
- 两遍调色板，体积 < 3MB

## 依赖

- `yt-dlp`（Python 包，在线源需要）
- `imageio-ffmpeg`（提供 ffmpeg 二进制；没有则回退系统 `ffmpeg`）
- 本地文件模式不需要网络

## 输出

```json
{ "ok": true, "file": "/abs/input/clips/018-高三八班.gif", "bytes": 2852826 }
```