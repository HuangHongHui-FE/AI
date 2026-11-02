---
name: wechat-newspic
description: 把一组图片 + 文案推成公众号「图片消息」（贴图/小绿书）草稿。图片张数由目录里剩下的图决定（用户删图后目录即事实来源），封面默认取第一张并复用其 media_id。
---

# wechat-newspic —— 公众号贴图

**给什么**：图片目录 + 标题 + 文案
**还什么**：`media_id`（图片消息草稿已进后台）

源实现 `dy-chat-img/post_draft.js` **把 access_token 硬编码在源码里**（一旦推到远端就是永久泄露）。此原子改为只读环境变量。

## 触发

「贴图」「发图片消息」「小绿书」

## 用法

```bash
node atom/wechat-newspic/src/index.mjs \
  --title "标题" \
  --images-dir 贴图热点/20261030-某热点/ \
  --body "整篇文案（讲共同主题，不逐图）" \
  --account dychatimg \
  --out-dir runs/<...>/08-wechat-newspic

# 文案从文件读
node atom/wechat-newspic/src/index.mjs --title t --images-dir d/ --body-file body.md

# 试运行（只校验，不调 API）
node atom/wechat-newspic/src/index.mjs --title t --images-dir d/ --dry-run
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--title` | 必填 | 标题 |
| `--images-dir` | 必填 | 图片目录 |
| `--body` / `--body-file` | 空 | 文案（整篇一段讲透主题，不逐图配文） |
| `--digest` | 文案前 54 字 | 摘要 |
| `--cover` | 目录第一张 | 封面 |
| `--account` | 通用 `WECHAT_APPID` | 公众号别名 |

## 与 wechat-draft 的区别

| | wechat-draft | wechat-newspic |
|---|---|---|
| 消息类型 | 图文（article） | **图片消息（newspic）** |
| 正文 | HTML | 纯文本 |
| 图片 | `<img>` 内嵌 | `image_info.image_list` |
| 图片上传 | `uploadimg`（临时 URL） | **`add_material`（永久素材，newspic 只认 media_id）** |

⚠️ 这两个不能混：贴图的正文图必须走永久素材拿 `media_id`，普通正文图上传返回的是 CDN URL，塞进 `image_list` 微信不认。

## 图片张数的真相

**不读草稿 JSON 里写的期望张数，只数目录里实际剩几张。** 用户删完图，目录就是事实来源。源实现就有这条保护（目录图不足会报错），本原子直接以目录为准。

实测：目录 3 张 → 草稿 3 张；用户删到 1 张 → 草稿 1 张。

## 排序

按文件名**自然排序**（`001, 002, 010` 而不是 `001, 010, 002`）——顺序即贴图展示顺序。

## 封面复用

封面默认取目录第一张。因为这张已经在正文图列表里上传过了，**直接复用它的 media_id**，不重复上传（源实现会重复上传一次，白占永久素材额度）。

## 输出

```json
{
  "ok": true, "account": "DYCHATIMG", "title": "...",
  "media_id": "draft-...", "thumb_media_id": "media-1", "count": 3,
  "images": [{ "file": "001.jpg", "media_id": "media-1" }]
}
```

## 回归

```bash
node atom/wechat-newspic/fixtures/regression.mjs
```

12 条断言：payload 结构 / 图片数跟随目录 / 自然排序 / 封面复用 / 空目录拦截 / dry-run 不调 API。不联网。

## 首次配置

需 `.env` 里配置贴图号凭据：

```bash
WECHAT_DYCHATIMG_APPID=wx...
WECHAT_DYCHATIMG_SECRET=...
```

## 已知坑

1. **token 过期（42001）**：已自动刷新重试一次
2. **40164 IP 白名单**：报错带处置提示，须在公众平台加当前 IP
3. **图片格式**：会做 sniff 校验，非图片文件直接 exit 2
4. **同 appid 多篇推送必须串行**——并发会让 token 互踩
