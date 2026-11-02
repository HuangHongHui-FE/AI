# event-thread —— 事件脉络梳理

用户说「梳理事件脉络」「时间线」「来龙去脉」时走这条流程。

## 步骤链

```
01-fetch-facts  抓新闻事实（≥8 条，来源要多）
02-fact-card    校验事实卡 ← 硬门槛：无来源的节点不许进发布
03-write-article 生成写作 prompt → 【Claude 按时间线写正文】
04-selfcheck    硬门自查
05-format-html  转 HTML
06-cover-image  生成封面
07-wechat-draft 推草稿
```

## 事实卡是硬门槛

每一条时间节点必须自带可追溯来源（title + url），日期必须可校验（拒绝「近日」这类模糊词），时间线必须单调不减。校验不过不落 `facts.json`，写作步骤拿不到数据自然跑不下去。

## 运行

```bash
node recipe/event-thread/run.mjs --prompt "梳理事件脉络" \
  --query "事件关键词" --facts facts/event.json
# 写稿后
node recipe/event-thread/run.mjs --resume <时间戳> --title "标题" --cover_source img.jpg
```
