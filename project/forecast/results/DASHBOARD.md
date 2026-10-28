# 多区域看板（表格版）

- 入口：`results/dashboard.html`（表格版，顶部区域 tab + 每行展开）
- 本期：`results/20261016-1728-dashboard.html`（带日期的副本）
- 数据模型：`results/dashboard.json`
- 生成脚本：`scripts/build_forecast_tables.py`

## 交互

- 顶部 tab 切换：总览 / 美股 / A股 / 港股 / 日韩 / 黄金 / 预测与操作
- A股内再分：`预测归因（10/16 → 10/19）` / `主题快照（10/27）`
- 点击任意表头排序（涨跌幅、综合分、方向、置信、数量等）；再次点击切换升/降序
- 每行最后有“展开”：查看涨跌原因、变化趋势、结构/资金、五维打分、风险、数据来源
- 总览里的“宏观指标（17）”默认折叠，点开看 10/16 + 10/27 两层指标

## 数据层

| 层 | 日期 | 来源 | 内容 |
|---|---|---|---|
| 预测层 | 2026-10-16 17:28 | `results/20261016-1728.html` + `cache/20261016/overseas.json` | A股/港股涨跌原因、五维打分、次日方向、操作建议、回检 |
| 行情层 | 2026-10-27 23:29 | 美基星图快照 `summary.json` | 美股 26 主题、A股 26 主题、韩国/日本指数与板块、黄金 |

两个日期不同，页面已分别标注；不要直接横向比较。美股/日韩报告未逐板块归因，展开后的“原因”是宏观背景；A股/港股预测层的原因来自 10/16 报告。

## 重新生成

```bash
cd /Users/hongenhuang/code/self/AI/project/forecast

python3 scripts/build_forecast_tables.py \
  --report results/20261016-1728.html \
  --snapshot /Users/hongenhuang/code/self/AI/try/rea/result/meiji-star/snapshot/summary.json \
  --out results/dashboard.html

cp results/dashboard.html results/20261016-1728-dashboard.html
cp results/dashboard.json results/20261016-1728-dashboard.json
```

如果 `summary.json` 过期或要换日期，先到
`/Users/hongenhuang/code/self/AI/try/rea/result/meiji-star/` 运行
`python3 meiji_api.py snapshot`（token 过期时先运行 `python3 refresh_token.py`），
再用新的 `snapshot/summary.json` 重新生成。

原来的卡片版脚本 `scripts/build_forecast_dashboard.py` 仍保留，可用 `--out results/dashboard-cards.html` 单独生成；当前默认入口是表格版。

## 限制

- 这是“预测 + 行情”双层看板，不是同一交易日的全市场快照。
- 美股/日韩未逐板块归因，只有宏观背景；A股/港股归因来自 10/16 报告。
- 品牌金价为每日参考价，不是官方实时挂牌价。
- 仅供研究与复盘，不构成投资建议。
