---
name: fund-ocr
description: 基金持仓截图 → 逐条切片 → OCR 文本。按固定条高切片并灰度锐化，再用 tesseract.js 识别；输出 strips.json / ocr.json / text.txt。用于把基金 App 截图转成持仓文本。
---

# fund-ocr —— 基金截图 OCR

**给什么**：一张基金持仓截图
**还什么**：切片图 + 逐条 OCR 文本

原实现是 `project/forecast/ocr_strips.js` + `ocr_strips2.js`（先切到 `/tmp`，再二次 OCR，路径写死）。

## 用法

```bash
# 完整 OCR
node atom/fund-ocr/src/index.mjs --image jijin.jpg --out-dir ocr/

# 只切片不 OCR（不需要 tesseract.js，先看条高对不对）
node atom/fund-ocr/src/index.mjs --image jijin.jpg --out-dir ocr/ --plan
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--image` | 必填 | 持仓截图 |
| `--out-dir` | `./fund-ocr` | 切片/OCR 产物目录 |
| `--strip-height` | 55 | 每条基金的高度（像素） |
| `--overlap` | 5 | 相邻切片重叠 |
| `--width` | 1200 | 切片缩放宽度 |
| `--start-y` | 40 | 跳过顶部表头 |
| `--lang` | `chi_sim+eng` | tesseract 语言包 |
| `--plan` | 关 | 只切片，不加载 OCR |

## 输出

```json
{
  "ok": true,
  "image": "/abs/jijin.jpg",
  "width": 1080,
  "height": 1920,
  "strips": 32,
  "files": ["/abs/ocr/strip-000.png", "..."],
  "ocr": true,
  "text_file": "/abs/ocr/text.txt",
  "ocr_file": "/abs/ocr/ocr.json"
}
```

`ocr.json` 每条：`{ index, y, height, file, text }`。

## 依赖

- `sharp`（atoms 根依赖）
- `tesseract.js`（**可选**；只做 OCR 时需要，`npm install` 会按 workspace 装上）
- 首次 OCR 需要联网下载中文语言包

## 注意

1. 条高随截图分辨率变：先 `--plan` 出切片，Read 几张看有没有切歪，再调 `--strip-height`。
2. OCR 是启发式，金额/收益率可能有错位；重要数字要人工核对。
3. 输出文本可直接喂给 `holdings-analysis`（需要按 `名称｜金额｜盈亏｜收益率` 再整理）。