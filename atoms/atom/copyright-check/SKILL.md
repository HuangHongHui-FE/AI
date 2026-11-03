---
name: copyright-check
description: 视频版权与原创度硬指标自查：单个原片镜头 ≤3 秒、原片累计占比 <10%、原创解说占比 ≥50%。能量化的三项给 FAIL/WARN；C2/C4/C5 仍靠人眼。
---

# copyright-check —— 版权与原创度自查

**给什么**：成片 mp4（可选：每个原片镜头时长、原创解说配音时长）
**还什么**：三项硬指标的 PASS/FAIL

原实现是 `project/mingchangmian/skill/05-自查/check_copyright.py`。

## 用法

```bash
# 最可靠：把合成时记录的原片镜头时长传进来
node atom/copyright-check/src/index.mjs \
  --video 成品.mp4 --clip 2.8,3.0,2.4 --speech-sec 88.9

# 不传 --clip：按画面清晰度自动识别（启发式，仅供参考）
node atom/copyright-check/src/index.mjs --video 成品.mp4 --speech-sec 88.9
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--video` | 必填 | 成片路径 |
| `--clip` | 自动识别 | 每个原片清晰镜头时长（秒，逗号分隔） |
| `--speech-sec` | 0 | 原创解说配音总时长（秒） |

## 阈值（C3）

| 指标 | 上限/下限 |
|---|---|
| 单个原片镜头 | ≤ 3.0 秒 |
| 原片累计占比 | < 10% |
| 原创解说占比 | ≥ 50% |

## 输出

```json
{
  "ok": true,
  "total_sec": 120.5,
  "clips": [2.8, 3.0],
  "clip_total": 5.8,
  "clip_ratio": 0.048,
  "longest_clip": 3.0,
  "speech_sec": 88.9,
  "speech_ratio": 0.738,
  "fails": [],
  "warns": []
}
```

退出码：`0` 全过 / `1` 有 FAIL 或未校验项 / `2` 参数错误。

## 注意

1. 自动识别是按帧清晰度的启发式，**以 --clip 为准**。
2. 没传 `--clip` 或 `--speech-sec` 会记 WARN，**不能算全过**（防「静默成功」）。
3. 占比达标 ≠ 已获授权。法律安全线仍是授权或合理使用认定，且国内司法边界不统一。
4. C2/C4/C5 靠人眼，清单见 `recipe/mingchangmian/references/05-自查.md`。

## 依赖

- `imageio-ffmpeg` 或系统 `ffmpeg`
- 自动识别清晰段时还需要 Pillow