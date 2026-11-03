---
name: result-page
description: 分析结果 markdown → 可浏览的结果页 HTML。自动生成方向速览卡片（▲看涨/▼看跌/△震荡）、方向彩色徽章、表格斑马纹、红涨绿跌。用于板块预测结果的归档与对比。
---

# result-page —— 结果页渲染

**给什么**：分析结果 markdown
**还什么**：带样式的 HTML 结果页

原实现是 `project/forecast/skills/market-forecast/md2html.py`。此原子包一层统一入口。

## 用法

```bash
node atom/result-page/src/index.mjs --md /tmp/forecast_20261103-2016.md --out results/20261103-2016.html

# 不传 --out 时，输出到同名 .html
node atom/result-page/src/index.mjs --md results/20261103-2016.md
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--md` | 必填 | 输入 markdown |
| `--out` | 同名 `.html` | 输出路径 |

## 输出

```json
{ "ok": true, "file": "/abs/results/20261103-2016.html", "bytes": 3500, "has_direction": true }
```

`has_direction` 为 false 说明输入 md 里没有「看涨/看跌/震荡」标记——检查方向表是否写对。

## 它会自动做的事

- **方向速览卡片**：从带「方向」列的表格自动生成 ▲/▼/△ 三组列表
- **方向彩色徽章**：表格单元格按方向着色
- **红涨绿跌**：涨跌幅数字自动染色
- **表格斑马纹**

## 依赖

- **Python 3**（只用标准库：sys / re / html）

## 注意

1. 输入 md 的表格必须有「方向」列，否则不会生成速览卡片
2. 样式都在 `src/py/md2html.py` 的 CSS 常量里，改样式改那里
3. 原 forecast 流程是「写 md 到 /tmp → 转 html → 不留存 md」，这个习惯建议保留
