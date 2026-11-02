# wechat-tietu —— 公众号贴图

用户说「贴图」「发图片消息」「小绿书」时走这条流程。

## 步骤链

```
01-find-image    批量找图 ≥20 张     ← 用户删图筛到 3-9 张（停手点）
02-img-normalize 统一转 1080x1920（非 9:16 用模糊填充补满）
03-wechat-newspic 推图片消息草稿（张数 = 目录里剩下的图）
```

## 停手点

**筛图必须由用户做**。Claude 负责下足候选，删剩哪几张是用户的决定。

## 文案

贴图文案走**整篇一段讲透主题**，不逐图配文（2026 起的新规范）。用 `--body-file` 传一个 markdown 文件。

## 运行

```bash
node recipe/wechat-tietu/run.mjs --prompt "贴图：某热点" \
  --subject "主体" --event "事件"
# 筛图后
node recipe/wechat-tietu/run.mjs --resume <时间戳> \
  --title "标题" --body_file body.md
```

## 与 wechat-hotspot 的区别

| | wechat-hotspot | wechat-tietu |
|---|---|---|
| 产出 | 图文消息（article） | 图片消息（newspic） |
| 正文 | 长文 markdown → HTML | 一段纯文本 |
| 图 | 内文图 2-3 张 | 3-9 张满屏竖图 |
| 用号 | `wechatimg` | `dychatimg` |

两个配方共用编排器代码（`run.mjs` 完全一致，未改一行）——这就是「新增项目只写配置」的验证。
