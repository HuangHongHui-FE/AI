---
name: forecast-dashboard
description: 把板块预测结果 HTML + 美基星图 snapshot 合成多区域看板。两种版式：dashboard（卡片+筛选）和 tables（分区域 tab + 表头排序 + 行展开）。预测层与行情层分别标注日期，不混用。
---

# forecast-dashboard —— 多区域预测看板

**给什么**：预测结果 HTML（result-page 产出）+ 美基星图 snapshot JSON
**还什么**：多区域看板 HTML + 同名 JSON 模型

原实现是 `project/forecast/scripts/build_forecast_dashboard.py` 与 `build_forecast_tables.py`。

## 用法

```bash
# 表格版（默认）：顶部区域 tab，表头排序，行尾「展开」看原因/资金/五维/风险
node atom/forecast-dashboard/src/index.mjs \
  --report results/20261016-1728.html \
  --snapshot snapshot/summary.json \
  --out results/dashboard.html

# 卡片版：区域筛选 + 搜索 + 排序
node atom/forecast-dashboard/src/index.mjs \
  --report ... --snapshot ... --out ... --mode dashboard
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--report` | 必填 | 预测结果 HTML（`result-page` 产出） |
| `--snapshot` | 必填 | 美基星图 `summary.json` |
| `--out` | `dashboard.html` | 输出 HTML；同名 `.json` 侧车文件一起生成 |
| `--mode` | `tables` | `tables` / `dashboard` |

## 输出

```json
{ "ok": true, "file": "/abs/dashboard.html", "json_file": "/abs/dashboard.json", "bytes": 52000, "mode": "tables" }
```

## 注意

1. **预测层与行情层不是同一天**：报告日期来自预测 HTML，快照日期来自 snapshot，页面里分别标注，不能当成同一时点比较。
2. 报告必须包含五维打分表；缺列会少卡片但不会崩。
3. 两个 Python 脚本只用标准库（`argparse/html/json/os/re/statistics/time`）。

## 依赖

- **Python 3**（标准库）
- 无网络请求