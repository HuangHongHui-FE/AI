---
name: wechat-draft
description: 把排好版的微信正文 HTML + 封面图推成公众号草稿。支持多公众号（--account 按别名选号）、token 按号隔离缓存、内文图自动上传、缺图与封面撞脸硬拦截。用于公众号发文流程最后一步。
---

# wechat-draft —— 推公众号草稿

**给什么**：正文 HTML（本地图片路径）+ 封面图 + 标题
**还什么**：`media_id`（草稿已进公众号后台，人工点发送）

原实现散在 4 个项目里且 md5 完全一致（`wechat-img` / `event-thread` / `company` / `manga`），此原子是其唯一实现。

## 触发

「推草稿」「发公众号」「推到公众号后台」

## 用法

```bash
# 推草稿
node atom/wechat-draft/src/index.mjs \
  --html 04-write-article/content.html \
  --cover 06-cover-image/cover.jpg \
  --title "标题内容" --digest "摘要" \
  --account wechatimg \
  --out-dir runs/<...>/07-wechat-draft

# 发布前预检 token（42001 过期 / 40164 IP 白名单）
node atom/wechat-draft/src/index.mjs --verify --account wechatimg

# 清掉该号 token 缓存，强制下次重新取
node atom/wechat-draft/src/index.mjs --clear-token --account wechatimg

# 只走本地校验，不调微信 API
node atom/wechat-draft/src/index.mjs --html x.html --cover c.jpg --title t --dry-run
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--html` | 必填 | 微信正文 HTML（`<img src>` 可为本地路径） |
| `--cover` | 必填 | 封面图路径（`.jpg`） |
| `--title` | 必填 | 草稿标题 |
| `--digest` | 空 | 摘要 |
| `--author` | 空 | 署名 |
| `--account` | 通用 `WECHAT_APPID` | 公众号别名，见 `.env.example` |
| `--cache-dir` | `.cache/wechat-token` | token 缓存目录 |
| `--dry-run` | 关 | 只校验不推送 |
| `--allow-missing-img` | 关 | 跳过缺图拦截（**仅调试**，线上别用） |
| `--embed-cover` | 关 | 正文顶部再插一张封面图（默认关，避免与封面重复） |

## 输出

```json
{
  "ok": true,
  "account": "WECHATIMG",
  "draft_media_id": "draft-...",
  "thumb_media_id": "thumb-...",
  "images_uploaded": 3,
  "images_failed": []
}
```

退出码：`0` 成功 / `1` API 业务失败 / `2` 参数或环境错误（缺图、封面撞脸、凭据缺失）。

## 多公众号

一个 `.env` 里按别名并存，靠 `--account` 选：

```bash
WECHAT_WECHATIMG_APPID=wx...
WECHAT_WECHATIMG_SECRET=...
WECHAT_MINGCHANGMIAN_APPID=wx...
WECHAT_MINGCHANGMIAN_SECRET=...
```

`npm run accounts` 可列出已配置别名。token 按别名分文件缓存（`token-wechatimg.json`），互不覆盖。

同 appid 的多篇推送必须**串行**，并发会让 token 互踩。

## 两条硬拦截（都是真实踩过的坑）

1. **缺图**：正文引用了不存在的本地图。静默跳过会推出「没有内文图」的文章——用户删图后未重新对齐 `article.json` 时必踩。
2. **封面撞脸**：正文引用了封面同一文件。封面已用该图，正文再引=开局首图重复。

两条都 exit 2 且不生成草稿，避免推两次。

## 首次配置

无需额外二进制依赖，只要 Node 22+。凭据从 `.env` 读（`atoms/.env`，不入库）。

## 已知坑

1. **42001 token 过期**：已自动刷新重试一次；仍失败就 `--clear-token` 后重试
2. **40164 出口 IP 不在白名单**：报错已带处置提示，须登录微信公众平台加当前 IP
3. **40137 图片格式非法**：`find-image` 已统一转标准 JPEG；自己传的图请先过 `img-normalize`
4. 封面必须 `.jpg`——微信 `add_material` 对超大 PNG 会超限

## 回归

```bash
node atom/wechat-draft/fixtures/regression.mjs
```

起本地 mock 微信 API，覆盖 token 缓存 / 42001 重试 / 上传 / 写草稿 / 缺图拦截 / 撞脸拦截 共 11 条断言，不联网。
