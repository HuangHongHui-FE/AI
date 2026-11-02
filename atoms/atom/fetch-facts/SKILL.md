---
name: fetch-facts
description: 按热点关键词抓新闻事实条目（标题 + 摘要 + 来源媒体 + 原文链接 + 发布时间），自动把同一事件的多家报道归成事件簇。国内源优先用头条搜索（百度/搜狗/必应在部分网络下被拦）。
---

# fetch-facts —— 抓新闻事实

**给什么**：热点关键词
**还什么**：带来源的事实条目列表 + 事件簇（同一事件几家在报）

原实现里没有独立模块——日志里说的「头条搜索 abstract 抓取」一直是临时脚本或人工完成。此原子把它固化。

## 触发

「查一下这个事」「找点资料」「抓新闻」

## 用法

```bash
# 抓一批事实
node atom/fetch-facts/src/index.mjs --query "美舰闯南沙" --out-dir 03-fetch-facts

# 要求至少 8 条（不够则 exit 1）
node atom/fetch-facts/src/index.mjs --query "黄金 抢购" --min 8

# 自定义关键词变体（默认会补「回应/官方/通报」三个角度）
node atom/fetch-facts/src/index.mjs --query "某事件" --variants "某事件 调查,某事件 进展"
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--query` | 必填 | 热点关键词 |
| `--min` | 3 | 最少要抓几条，不足则 exit 1 |
| `--variants` | 自动补 3 个 | 逗号分隔的补充关键词 |
| `--out-dir` | 不写 | 落 `facts-raw.json` + `facts.md` |

## 输出

```json
{
  "ok": true, "query": "...", "count": 11, "publisher_count": 10,
  "publishers": { "人民日报": 1, "观察者网": 1 },
  "clusters": [{ "id": 1, "title": "...", "sources": ["人民日报", "全民新视野"], "count": 10 }],
  "facts": [{ "title": "...", "abstract": "...", "publisher": "...", "url": "...", "published_at": "2026-10-20", "cluster": 1 }]
}
```

`clusters` 是关键：同一事件被 10 家媒体报道 vs 1 家，可信度完全不同。

## 解析方式（重要）

头条搜索页的每个结果是一条内嵌 JSON script 块：

```html
<script data-druid-card-data-id="..." type="application/json">{"data":{...}}</script>
```

块内含 `title` / `abstract` / `summary` / `source` / `article_url` / `datetime`。

⚠️ **不能对整页跑「title→abstract」非贪婪正则**——一个结果块里 `abstract` 出现在 `title` **之前**（`highlight.abstract` 在前），跨块匹配会把 N 条结果吞成 1 条。实测这种写法 19 条只出 4 条；改成逐块 `JSON.parse` 后出 11 条 / 10 家媒体。

## 事件簇算法

去标点后做 2 字滑窗，重合率 ≥ 0.4 判定为同一事件。阈值是网格搜索出来的：2-gram 在 0.30~0.50 区间对 3 对同事件全命中、3 对不同事件全分开。**不同媒体的报道不合并**——各家摘要含的细节不同，正是多源核对的价值所在，只在结果里打上 `cluster` 标记。

## 已知坑

1. **关键词粒度极大影响召回**：`"上海人排队买黄金"` 只出 1 条；`"黄金 抢购"` 出 5 条（4 家媒体）。**优先用 2~3 个核心词**，别用完整长句
2. **分页 offset 无效**：`offset=0/10/20` 返回内容完全相同（实测页面长度 581207 / 581971 / 581961，abstract 数都是 19）。扩召回只能靠换关键词，不能靠翻页
3. **同一事件标题高度雷同**：10 家媒体的标题常常只差标点。这是正常的，不要当重复数据丢弃
4. **URL 常缺失**：头条结果里很多没有 `article_url`，此时用搜索页链接兜底并标 `url_is_search: true`——**这类链接不是原文，写稿引用时要谨慎**
5. 头条搜索热度高的词（时政/军事）召回好，冷门词和消费类召回弱

## 已验证

- `美舰闯南沙`：11 条 / 10 家媒体 / 2 个事件簇，含人民日报
- `黄金 抢购`：5 条 / 4 家媒体 / 4 个事件
- `上海人排队买黄金`：仅 1 条 → 印证「长句召回差」
