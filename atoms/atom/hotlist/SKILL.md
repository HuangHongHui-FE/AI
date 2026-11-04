---
name: hotlist
description: 抓多平台实时热榜（头条/百度/抖音/B站/微博五源），输出结构化 hotlist.json 并标注跨榜重叠。用于公众号/头条选题第一步。
---

# hotlist —— 实时热榜抓取

把当下各平台热搜抓成结构化数据，供后续选点、找图、写作使用。
**纯公开接口，不需要任何凭据**。

## 触发

「看下今天热榜」「有啥热点」「抓个热搜」「选个热点」

## 用法

```bash
# 抓全部五平台
node atom/hotlist/src/index.mjs --out runs/<...>/01-hotlist/hotlist.json

# 只要两个平台，每榜 10 条
node atom/hotlist/src/index.mjs --platforms toutiao,weibo --limit 10

# 只看终端，不落盘
node atom/hotlist/src/index.mjs
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--out` | 不写 | 输出 JSON 路径；不传则只打印到终端 |
| `--platforms` | 全部 | 逗号分隔，可选 `toutiao, baidu, douyin, bilibili, weibo` |
| `--limit` | 20 | 每榜保留条数 |

## 输出

stdout 为 JSON（结构化结果），stderr 为人读榜单。

```json
{
  "generated_at": "2026-10-29T20:52:06+08:00",
  "platforms_ok": 5,
  "platforms_failed": 0,
  "sources": {
    "toutiao": { "label": "今日头条", "ok": true, "count": 50, "items": [{ "rank": 1, "title": "…", "heat": "1001万", "url": "…" }] }
  },
  "overlaps": [
    { "title": "二十届五中全会公报", "labels": ["抖音热榜", "B站热搜"], "platform_count": 2, "members": [...] }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `sources.<key>.ok` | 单平台成败，失败不影响其他平台 |
| `sources.<key>.meta.active_time` | 抖音独有，榜单刷新时间，用来证实是实时数据 |
| `overlaps` | **跨榜重叠话题**——多个榜同时收录 = 真热，选点优先 |
| `platforms_failed` | 失败平台数；全部失败才 exit 1 |

## 数据来源

| 平台 | 接口 | 备注 |
|---|---|---|
| 今日头条 | `toutiao.com/hot-event/hot-board/` | 50 条，带 HotValue |
| 百度热搜 | `top.baidu.com/board?tab=realtime` | HTML 里内嵌 `<!--s-data:{...}-->`，带 hotScore；wise 接口只有排名没有热度 |
| 抖音热榜 | `iesdouyin.com/web/api/v2/hotsearch/billboard/word/` | 带 active_time 实时证明 |
| B站热搜 | `api.bilibili.com/x/web-interface/search/square` | 20 条 |
| 微博热搜 | `weibo.com/ajax/side/hotSearch` | **PC 端**免登录；m 端会跳访客系统 |

知乎抓不到（官方 API 401 要登录 token），已放弃；四榜+微博重叠度高，够用。

## 终端展示

stderr 先给平台总览，再逐榜列明细，每条带热度值和热度条：

```
【平台总览】5 个平台可用，共 100 条
  今日头条    20 条   最高 1967.1万   新疆军区数千名新兵夜间紧急拉动演练
  百度热搜    20 条   最高 790.5万    不断开创黄河保护治理工作新局面
  ...

【今日头条】20 条
   1. 1967.1万   ████████████  新疆军区数千名新兵夜间紧急拉动演练
   2. 1779.9万   ███████████   高市早苗以怪异姿势面见日本天皇
```

热度条按**该平台最热一条**归一，只能比同榜——各平台热度算法不同，跨榜不可比；跨榜要看的是 `overlaps`。

## 已知坑

1. **百度改成抓 HTML 里的 `s-data`**，wise 接口没有热度数字；页面结构变了会在 `parse` 里直接报「找不到 s-data」
2. **微博必须带 `Referer: https://weibo.com/`**，裸请求偶发 302
3. **m 端微博接口返回「Sina Visitor System」**，别再试
4. **tophub.today 拿不到内容**——页面 JS 异步加载，curl 下 HTML 里没有热词（`tt-redian-text` 那份实现依赖它，已不可用）
5. **第三方聚合 API（vvhan/oioweb/tenapi 等）2026-06 全挂**，不要引入
6. **字段会变**：解析失败时先看原始 JSON 结构，别盲改正则

## 不做

- 不做定时轮询（用户要时抓一次）
- 不做选题筛选（选点是用户的决定，本原子只负责给出榜单）
- 不存历史库（每次都是当下快照）
