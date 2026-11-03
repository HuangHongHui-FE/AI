---
name: holdings-analysis
description: 基金持仓 × 板块预测 → 逐只/分板块盈亏估算与调仓建议。输入持仓（JSON 或「名称｜金额｜盈亏｜收益率」文本）和预测 JSON，输出结构化结果 + markdown 报告。
---

# holdings-analysis —— 持仓分析

**给什么**：基金持仓 + 当日/次日板块预测
**还什么**：逐只基金估算、板块汇总、减仓/加仓建议、集中度

原实现是 `project/forecast/analyze_holdings.js`（一次性脚本，持仓和预测都硬编码在源码里）。此原子把两者参数化。

## 用法

```bash
node atom/holdings-analysis/src/index.mjs \
  --holdings holdings.json \
  --forecast forecast.json \
  --out result.json --md report.md
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--holdings` | 必填 | JSON 数组，或每行 `名称｜金额｜盈亏｜收益率` 的文本 |
| `--forecast` | 必填 | `{ "板块": { "dir","conf","score","estPct","risk" } }` |
| `--out` | 不落盘 | JSON 结果 |
| `--md` | 不落盘 | markdown 报告 |
| `--decay` | 0.6 | 次日预估 = 今日 estPct × decay |
| `--next-label` | 次日 | 报告里的“下一交易日”称呼 |

### holdings 格式

```json
[
  { "name": "华夏上证科创板半导体材料设备", "amount": 52162.05, "pnl": -8019.31, "pct": -13.33 }
]
```

或文本：

```text
华夏上证科创板半导体材料设备｜52162.05｜-8019.31｜-13.33%
国泰黄金 ETF 联接 C｜175.77｜-24.80｜-12.36%
```

### forecast 格式

```json
{
  "半导体": { "dir": "▼", "conf": "H", "score": -1.75, "estPct": -3.0, "risk": "费半拖累" },
  "黄金":   { "dir": "▲", "conf": "M", "score": 0.75,  "estPct": 1.0,  "risk": "地缘避险" }
}
```

## 输出

```json
{
  "ok": true,
  "totals": { "amount": 193809.79, "pnl": -14037.5, "pct": -6.76, "today_est_pnl": -3519.19, "next_est_pnl": -2111.5 },
  "funds": [{ "name": "...", "sector": "半导体", "todayEstPnl": -1564.86, "risk": "..." }],
  "sectors": [{ "sector": "半导体", "amount": 52162, "pct": 26.9, "score": -1.75, "advice": "⚠️ 强烈建议减仓" }],
  "advice": { "reduce": [], "add": [] },
  "concentration": { "top3": ["半导体", "..."], "top3_pct": 71.2 }
}
```

## 规则

- 基金 → 板块按内置关键词表匹配（`src/lib/mapping.mjs`），匹配不到按 QDII/全球 → QDII全球，混合/灵活 → 中证500
- 调仓建议按综合分：≤-1.0 强烈减仓 / ≤-0.5 减仓 / ≥0.5 加仓 / ≥0.2 持有观望 / ≥-0.3 持有微调 / 其余谨慎持有
- 减仓清单：综合分 ≤ -0.8 且持仓 > 100 元；加仓清单：综合分 ≥ 0.3 且不是债券

## 注意

方向性预估，非投资建议。实际收益受盘中波动、隔夜外盘、地缘事件影响。