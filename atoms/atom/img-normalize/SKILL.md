---
name: img-normalize
description: 图片格式归一。按文件头识别真实格式（防「扩展名 jpg 实际是 webp/png」导致微信 40137），统一转标准 JPEG；可选按目标比例模糊填充（贴图 9:16 满屏不拉伸）。
---

# img-normalize —— 图片归一

**给什么**：任意图片（单张或整目录）
**还什么**：标准 JPEG；可选按目标比例模糊填充

源实现是 `dy-chat-img/fix_tietu_ratio.py`（Python + PIL），跨机器要装 Python 环境。此原子用 sharp 重写，纯 Node。

## 触发

「转成 jpg」「图片格式不对」「贴图竖图」「修一下比例」

## 用法

```bash
# 单张转标准 JPEG
node atom/img-normalize/src/index.mjs --src a.jpg --out b.jpg

# 整目录转 JPEG
node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/

# 贴图：全部转 1080x1920，横图用模糊填充补满（不拉伸）
node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/ --preset tietu-9x16

# 自定义画布
node atom/img-normalize/src/index.mjs --src-dir in/ --out-dir out/ --width 1080 --height 1920

# 只检查真实格式（不改文件）
node atom/img-normalize/src/index.mjs --check-dir in/
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--src` / `--src-dir` | 必填其一 | 单张 / 整目录 |
| `--out` / `--out-dir` | 必填 | 输出路径 |
| `--preset` | 无 | `tietu-9x16`（1080x1920）/ `cover-2.35`（900x383） |
| `--width` `--height` | 无 | 自定义画布（须同时给） |
| `--quality` | 88 | JPEG 质量 |
| `--check-dir` | 无 | 只报告格式不符，不写文件 |

## 三种 mode

| mode | 条件 | 行为 |
|---|---|---|
| `passthrough` | 没给目标尺寸 | 只 sniff + 转 JPEG，尺寸不变 |
| `exact` | 尺寸已完全一致 | 只转格式，避免二次编码损失 |
| `blur-fill` | 尺寸不符 | 原图等比缩到画布内居中，背景=原图铺满后高斯模糊 |

## 为什么必须 sniff

微信推草稿对格式极敏感：**扩展名 `.jpg` 但实际是 WebP/PNG 会报 40137**。`find-image` 下载的图经常是这种情况。`--check-dir` 就是为这个坑准备的审计工具。

实测：3 个文件里 2 个是「jpg 壳 png/webp 芯」，转换后全部为标准 JPEG。

## 模糊填充效果（贴图场景）

横图（1694x1008）转 1080x1920：原图完整居中显示，上下由原图放大 60px 高斯模糊填充。不拉伸、不变形、不裁切主体——这是贴图竖图的标准做法。

## 已知坑

1. **不要对已同尺寸的图反复跑**——虽然 `exact` 模式不缩放，但每次都会重新编码，多次往返会累积画质损失
2. **GIF 会被压成单帧 JPEG**——动图不在本原子能力范围内
3. `--check-dir` 只看扩展名与文件头是否一致，不校验图片是否损坏
