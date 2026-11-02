---
name: cover-image
description: 把一张图裁成公众号封面 2.35:1（900x383），默认纯图不叠字，可选 22 套装饰布局。竖图/窄图自动上移裁切窗口保主体。用于公众号图文封面。
---

# cover-image —— 公众号封面

**给什么**：一张原图
**还什么**：900x383 JPEG 封面

原实现 `cover.js` 在 `wechat-img` / `event-thread` 里 md5 完全一致，此原子是其唯一实现 + 竖图补救。

## 触发

「做封面」「生成封面图」

## 用法

```bash
# 默认：纯图裁切，不叠任何装饰（2026-08-26 起的默认）
node atom/cover-image/src/index.mjs --image 001-主图.jpg --out cover.jpg

# 指定布局
node atom/cover-image/src/index.mjs --image x.jpg --out cover.jpg --style diagonal-split

# 随机抽一个布局，避开指定项
node atom/cover-image/src/index.mjs --image x.jpg --out cover.jpg --random --exclude plain,vignette

# 列出所有布局
node atom/cover-image/src/index.mjs --list
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--image` | 必填 | 原图路径 |
| `--out` | 必填 | 输出路径，必须 `.jpg` |
| `--style` | `plain` | 布局名 |
| `--random` | 关 | 随机抽布局 |
| `--exclude` | 无 | 逗号分隔，随机时排除 |

输出：`{ ok, file, style, w:900, h:383, mode, ratio:"2.35" }`

## 布局（22 套）

`plain`（默认，纯裁切）、`diagonal-split`、`vertical-soft-gradient`、`vignette`、`grid-split`、`left-half-block`、`top-bottom-split`、`blur-bg-card`、`pure-color-no-image` 等。

⚠️ **微信会报 53402 封面裁剪失败**的布局：横向渐变、半色块、白卡类。实测安全的：`diagonal-split` / `vertical-soft-gradient` / 分栏类。

## 竖图补救

原 `cover.js` 一律 `resize(fit:cover)`，竖图（如 1080x2016）直接压成 2.35:1 会把整个人横向拉扁或只留腰部。本原子对比例 < 1.2 的图先 `extract` 一个 2.35:1 的最大裁切框（垂直位置取顶部 15%，人脸/标题多在上方），再缩到封面尺寸。

实测 1080x2016 的跳水图：直接 resize 主体破碎；extract 后主体完整、顶部水印文字块被裁掉。

## 实现约束

- 封面**不叠加任何文字**（2026-08-24 用户决定），`slogan` 参数已废弃
- 图片质量统一 90，输出必为 JPEG
- 与源 `cover.js` 逐字节一致（`plain`/`diagonal-split`/`vignette`/`blur-bg-card`/`pure-color-no-image` 五种已对比）

## 已知坑

1. **头图 w/h ≥ 1.7 才适合做封面**——4:3 或 3:2 裁 2.35:1 会切掉 40%+，主体破碎。选图时就该按横图挑
2. **正文严禁引用封面同文件**——`wechat-draft` 会硬拦
3. 布局名写错会回落 `plain` 并在 stderr 提示
