---
name: kline
description: 抓股票/指数 K 线数据（日/周/月），东财为主源、腾讯自动兜底，可选直接出 900x420 JPEG 折线图。用于公司拆解配图、行情走势图。
---

# kline —— K 线数据 + 走势图

**给什么**：股票代码
**还什么**：K 线数据数组；可选一张走势图 JPEG

原实现是两个独立脚本：`company/src/kline.cjs`（东财）和 `kline_tx.cjs`（腾讯兜底），靠人工判断何时切换。此原子把兜底做成自动。

## 触发

「出个 K 线图」「股价走势」「近一年走势」

## 用法

```bash
# 只要数据
node atom/kline/src/index.mjs --code 600519 --period month --limit 12

# 出图
node atom/kline/src/index.mjs --code 300750 --period month --out chart.jpg --title "宁德时代月K"

# 强制走腾讯源（东财挂掉时）
node atom/kline/src/index.mjs --code 00700 --source tencent --period month --json
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--code` | 必填 | `600519` / `300750` / `00700` / `AAPL` / `1.600519` |
| `--period` | `month` | `day` / `week` / `month` |
| `--limit` | 0（全量） | 只取最近 N 根 |
| `--source` | `auto` | `auto` / `eastmoney` / `tencent` |
| `--out` | 无 | 出图路径 |
| `--title` | 空 | 图上标题 |
| `--json` | 关 | 回传完整 rows（默认只回最近 10 根） |
| `--currency` | `¥` | 价格符号 |

## 代码推导

| 输入 | 东财 secid | 腾讯代码 |
|---|---|---|
| `600519` | `1.600519`（沪） | `sh600519` |
| `300750` | `0.300750`（深） | `sz300750` |
| `00700` | `116.00700`（港） | `hk00700` |
| `AAPL` | `105.AAPL`（美） | `usAAPL` |
| `1.600519` | 原样 | — |

## 输出

```json
{
  "ok": true, "source": "eastmoney", "code": "0.300750", "period": "month",
  "count": 101, "first_date": "2018-06-29", "last_date": "2026-10-30",
  "last_close": 229.57,
  "rows": [{ "date": "2026-10-30", "open": 210, "close": 229.57, "high": 231, "low": 208, "volume": 123 }],
  "chart": { "outPath": "...", "w": 900, "h": 420, "points": 101, "pct": 1191.17 }
}
```

退出码：`0` 成功 / `1` 两个源都失败 / `2` 参数错误。

## 已修复的源实现问题

| 问题 | 原实现 | 现在 |
|---|---|---|
| `end` 参数写死 | `end=20260801` | 取当天日期 |
| 兜底靠人工 | 两个独立脚本 | `auto` 自动回落并在返回里标 `source` |
| 代码形态不统一 | 东财要 secid、腾讯要纯代码 | 自动推导，同一个 `--code` 通用 |

## 已知坑

1. **腾讯与东财的价格精度不同**——同一标的两个源可能差几分钱（`fetch_history.py` 那边更严重：新浪 3 位小数 / 腾讯 2 位，ETF 必须用新浪）。本原子用于画图够用，**精确计算不要用**
2. **东财偶发 socket hang up**——`auto` 会自动回落腾讯
3. **图上的标注已避开折线**——上边距留 80px，最高/最低标在 62px 处，折线从 80px 起
4. 不支持分时/分钟级——本原子只管日/周/月

## 已验证

- 东财 `600519` / `300750` 月 K 正常，101 个点
- 腾讯 `hk00700` 兜底正常
- 无效代码（`INVALIDCODE123`）两个源都返回空，正确报错 exit 2
