---
name: fact-card
description: 校验事件事实卡。每条时间节点必须自带可追溯来源、日期必须可校验（拒绝「近日」这类模糊词）、时间线必须单调不减。可选按 parts 切篇。通过后输出 facts.json 供写作消费。
---

# fact-card —— 事实卡校验

**给什么**：事实卡 JSON（slug/name/summary/nodes）
**还什么**：校验结果 + 归一后的 `facts.json`

设计原则：**先有事实，后有文章**。无来源的节点不许进发布流程。

## 触发

「校验事实卡」「核一下时间线」「事实卡能过吗」

## 用法

```bash
# 单张校验（通过则同时落 facts.json）
node atom/fact-card/src/index.mjs --facts facts/xxx.json --out-dir 03-fact-card

# 批量校验整个目录
node atom/fact-card/src/index.mjs --facts-dir facts/ --today 2026-10-30

# 指定「今天」（默认取本地日期，用于拦截未来日期）
node atom/fact-card/src/index.mjs --facts x.json --today 2026-10-30
```

## 事实卡结构

```json
{
  "slug": "event-slug",
  "name": "事件名称",
  "summary": "一句话摘要",
  "ended": "2026-10-30",          // 空/省略 = 仍在发展中
  "parts": [{ "title": "第一篇标题", "until": "2026-01-01" }],
  "nodes": [{
    "date": "2026-10-30",
    "title": "节点标题",
    "level": "turning",          // normal / major / turning / climax
    "detail": "叙述",
    "facts": ["细节1", "细节2"],
    "data": ["数字"],
    "sources": [{ "publisher": "媒体名", "title": "报道标题", "url": "https://..." }],
    "confidence": "low"          // 可选，存疑时标 low
  }]
}
```

## 硬拦项

| 检查 | 说明 |
|---|---|
| date 缺失/格式错 | 只接受 `YYYY-MM` / `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` |
| **模糊时间词** | 近日/日前/最近/近期/月初/上旬/当天… 一律拒绝——查不实就是没查 |
| date 晚于今天 | 事件尚未发生或日期填错 |
| sources 为空 | 每个节点至少一条来源 |
| sources 缺 title/url | 来源必须可追溯 |
| url 非 http(s) | `ftp://` 之类不算 |
| level 非法值 | 只能是 normal/major/turning/climax |
| **时间线乱序** | 后一个节点早于前一个，叙事顺序会乱 |

## WARN 项

- 全卡多节点只有 1 家来源 → 建议补第 2 源
- 有节点标 `confidence=low` → 正文须体现不确定性
- 超半数节点只精确到月 → 建议补到日

## 切篇（parts）

定义 `parts: [{title, until}]` 后，按日期边界切分，断点落在**叙事边界**而不是节点数均分。

```json
"parts": [
  { "title": "第一篇", "until": "2020-12-31" },
  { "title": "第二篇", "until": "2023-12-31" }
]
```

校验时会打印切篇预览（每篇几个节点），可直接核对总节点数是否守恒。

⚠️ **切篇有个已踩过的坑**：切完最后一篇时若直接 `break`，与最后边界**同日**的其余节点会被静默丢弃（2026-10-18 实踩：两个 10-16 节点只保留了前一个）。本实现不 break，剩余节点累积并入末篇。

## 输出

```json
{
  "ok": true, "slug": "...", "name": "...",
  "errors": [], "warnings": ["..."],
  "stats": { "nodes": 23, "publishers": 28, "month_only": 0, "ongoing": true },
  "parts": [{ "index": 1, "title": "...", "nodes": 6 }]
}
```

退出码：`0` 通过 / `1` 有错误。

## 已验证

5 张历史事实卡（含 23 节点 / 28 家来源的复杂案例）全部正确通过，切篇节点数守恒（6+10+7=23）。
7 类恶意数据（模糊日期、无来源、未来日期、坏链接、坏 level、乱序、缺字段）全部正确拦截。
