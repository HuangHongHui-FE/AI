# toutiao-hotspot —— 今日头条热点

用户说「写热点发头条」「今日头条发文」时走这条流程。

## 步骤链

```
01-hotlist       抓热榜            ← 用户选点（停手点）
02-find-image    批量找图 10 张
03-fetch-facts   抓新闻事实
04-write-article 生成写作 prompt → 【Claude 写正文】
05-title-hook    标题合规校验
06-selfcheck     硬门自查（头条规则集）
07-format-html   转 HTML
08-toutiao-publish 填入编辑器（半自动：人工点发布）
```

## 头条的特殊约束

| 项 | 说明 |
|---|---|
| 标题 | 可到 30 字（比公众号的 22 宽松） |
| 摘要 | 可到 100 字 |
| 第一人称 | **不限制**（平台风格不同），`selfcheck --ruleset toutiao` |
| 发布 | **无草稿 API + a_bogus 反爬**，只能半自动 |

## 运行

```bash
node recipe/toutiao-hotspot/run.mjs --prompt "写热点发头条" \
  --subject "主体" --event "事件" --query "关键词"
# 写稿后
node recipe/toutiao-hotspot/run.mjs --resume <时间戳> \
  --title "标题" --raw_title "热榜原词"
```

首次用前先登录：`node atom/toutiao-publish/src/index.mjs --login`
