# forecast —— 板块涨跌预测

用户说「分析」「预测明天」「看下板块」时走这条流程。

## 步骤链

```
01-market-fetch   抓行情/日K/外盘/资金/情绪/财报/新闻
   ↓ Claude 读数据，按 references/market-forecast.md 做五维打分
   ↓ 写 analysis.md（套 references/score-template.md）
02-result-page    分析 markdown → 结果页 HTML
```

**抓数和打分是两件事**：`market-fetch` 只负责把数据落盘；方向判断、当日归因、底部信号、T+1 回检由 Claude 按 `references/market-forecast.md` 完成。没有「自动出方向」的原子。

## 运行

```bash
# 第一次：只抓数（约 30 秒）
node recipe/forecast/run.mjs --prompt "分析今天的板块" --only market-fetch

# Claude 读 01-market-fetch/ 下的 JSON，写 /tmp/forecast_YYYYMMDD-HHMM.md
# 然后续跑渲染（复用同一次 run）
node recipe/forecast/run.mjs --resume <时间戳> --md /tmp/forecast_YYYYMMDD-HHMM.md

# 也可以一次跑完（前提是 md 已经写好）
node recipe/forecast/run.mjs --prompt "分析今天的板块" --md /tmp/forecast_YYYYMMDD-HHMM.md
```

产物：

```
runs/forecast/<时间戳>/
├── 01-market-fetch/   quotes.json / history.json / overseas.json / flow.json ...
└── 02-result-page/report.html
```

## 可选：多区域看板

```bash
node atom/forecast-dashboard/src/index.mjs \
  --report runs/forecast/<时间戳>/02-result-page/report.html \
  --snapshot <美基星图 summary.json> \
  --out results/dashboard.html
```

## 数据到达后必须做的事

按 `references/market-forecast.md` 执行，重点：

1. **判时点**：<15:00 预测今日收盘；≥15:00 预测次日
2. **当日实盘归因**：机构/游资/散户三方净额，缺一不可
3. **逐板块五维打分**：外盘 0.25 / 资金 0.25 / 技术 0.25 / 情绪 0.15 / 消息 0.10
4. **底部信号三件套**：放量长下影 / 机构流出收敛 / 连续 3 日不创新低
5. **T+1 回检**：回填 `results/INDEX.md` 上一次预测的实盘列，用 `history.json` 收盘价，不用 `quotes.json` 盘中快照
6. **归档**：结果页文件名 `YYYYMMDD-HHMM.html`，每次新建，不覆盖

## 参考

- 完整分析规则：`references/market-forecast.md`（原 30KB SKILL.md）
- 报告模板：`references/score-template.md`
- 板块清单与代理标的：`atom/market-fetch/src/py/sectors.json`
- 原始方案：`references/PLAN.md`

## 相关原子

| 原子 | 作用 |
|---|---|
| `market-fetch` | 9 个 Python 抓数脚本 |
| `result-page` | 分析 md → 结果页 HTML |
| `forecast-dashboard` | 结果页 + 美基星图快照 → 多区域看板 |
| `holdings-analysis` | 基金持仓 × 预测 → 盈亏估算与调仓建议 |
| `fund-ocr` | 基金持仓截图 → 文本 |