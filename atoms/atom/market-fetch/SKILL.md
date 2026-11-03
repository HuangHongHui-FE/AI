---
name: market-fetch
description: A 股板块数据抓取。顺序跑 9 个 Python 脚本，把行情、近 60 日日K、外盘、资金流、盘中资金曲线、市场情绪、财报、新闻落盘成 JSON。供板块涨跌预测消费。
---

# market-fetch —— 板块数据抓取

**给什么**：一个输出目录
**还什么**：9 个 JSON/TXT 文件，覆盖预测所需的全部维度

原实现是 `project/forecast/scripts/run_forecast.sh` 那串 `python3 xxx.py`。此原子把它做成统一入口：
路径参数化（不再写死 `ROOT/cache/DATE`）、单个失败降级不中断、输出结构化清单。

## 用法

```bash
# 抓全套（约 30 秒）
node atom/market-fetch/src/index.mjs --out-dir cache/20261103

# 只抓指定几个（调试用）
node atom/market-fetch/src/index.mjs --out-dir out --only quote,flow

# 调超时（默认每脚本 120 秒）
node atom/market-fetch/src/index.mjs --out-dir out --timeout 180000
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--out-dir` | `./cache/<YYYYMMDD>` | 落盘目录 |
| `--only` | 全部 | 逗号分隔的脚本 id |
| `--timeout` | 120000 | 单个脚本超时（毫秒） |

## 9 个脚本

| id | 产出 | 内容 |
|---|---|---|
| `quote` | `quotes.json` | 各板块代理标的实时行情（价格/涨跌幅/量额）**关键脚本** |
| `history` | `history.json` | 近 60 日日K：均线 MA5/10/20/60、距 MA20%、量比、连涨跌天数、20 日位置分位 |
| `overseas` | `overseas.json` | 外盘（美股指数、费半、A50 期指、恒指期货） |
| `env` | `env.json` | 利率/汇率等环境变量 |
| `flow` | `flow.json` | 行业板块资金收盘聚合（机构/游资/散户净额） |
| `flow_intraday` | `flow_intraday.json` | 重点板块盘中逐分钟资金曲线 |
| `sentiment` | `sentiment.json` | 全市场情绪：涨跌家数、涨停跌停、赚钱效应 |
| `earnings` | `earnings.json` | 报告期推导 + 龙头财报（公告时间取 EITIME）+ 美股巨头财报窗口 |
| `news` | `news.txt` | 财经快讯（新浪等） |

## 降级策略

- 任意脚本失败 → 记录到 `scripts[].error`，**继续跑后面的**
- `quote` 失败 → 整体 `ok=false`、exit 1（没有行情就没法分析）
- 其余失败只降级，不影响退出码

原 shell 里 `|| echo "[xxx] 降级跳过"` 的语义保留在这里。

## 输出

```json
{
  "ok": true,
  "out_dir": "/abs/path/cache/20261103",
  "date": "20261103",
  "scripts": [{ "id": "quote", "ok": true, "ms": 991, "files": ["quotes.json"], "error": "" }],
  "files": ["quotes.json", "history.json", ...],
  "failed": []
}
```

## 依赖

- **Python 3**（脚本只用标准库：json / sys / urllib / os / re）
- 网络：东财、新浪、腾讯公开接口

## 注意

1. **不带分析能力**：这个原子只负责抓数据，五维打分和方向判断由 Claude 按 SKILL 规则做
2. `history` 最慢（约 18 秒），抓 60 日日K
3. 数据有时效：`quotes.json` 是抓取时刻的快照，收盘后抓才是收盘价
