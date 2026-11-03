---
name: real-story-pack
description: 真人真事包装。给已有初稿加一层「真实感滤镜」——12 类真实感锚点（时间戳/地理/身份/品牌/对话/数字/感官/揭秘/第三方/前后对照/凭证/收尾呼应），至少命中 8 类且不踩红线。只产出包装 prompt 与校验结果，不自己改写正文。
---

# real-story-pack —— 真人真事包装

**给什么**：一篇初稿（`article.json` 或 markdown）
**还什么**：包装 prompt（plan）或锚点覆盖校验（verify）

原实现是 `project/wechat/skills/04-真人真事包装.md`（全自然语言规范），此原子把「锚点清单 + 红线」固化，并给出可机器判定的覆盖度。

## 触发

「包装成真人真事」「加真实感」「这篇太假了」「按 12 类锚点改」

## 用法

```bash
# plan：产出包装 prompt（Claude 据此改写）
node atom/real-story-pack/src/index.mjs \
  --article 02-write-article/article.json \
  --out-dir 03-real-story-pack

# verify：校验包装后的稿件
node atom/real-story-pack/src/index.mjs --verify 03-real-story-pack/article.json

# 要求命中 10 类（默认 8）
node atom/real-story-pack/src/index.mjs --verify article.json --min 10
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--article` | plan 必填 | 初稿路径；`.json` 取 `body_markdown`，其余按 markdown 读 |
| `--verify` | — | 校验模式，传包装后稿件路径 |
| `--out-dir` | 不落盘 | 写 `prompt.md` + `anchors.json`（plan）或 `verify.json`（verify） |
| `--min` | 8 | 至少命中的锚点类数 |

## 12 类锚点

| # | 锚点 | 一句话判据 |
|---|---|---|
| 1 | 时间戳 | 精确到星期/日期/时刻，不是「那天晚上」 |
| 2 | 地理锚点 | 城市 + 区域 + 户型/地标，不是「我家」 |
| 3 | 身份/职业细节 | 年龄 + 职业 + 当前状态，至少两项 |
| 4 | 品牌/工具名 | 大众都在用的工具/品牌 |
| 5 | 对话还原 | 直接引语 + 停顿/沉默 |
| 6 | 具体数字 | 阿拉伯数字 + 具体单位 |
| 7 | 感官细节 | 五感中至少一种 |
| 8 | 「后来才知道」揭秘 | 事后回看的倒叙 |
| 9 | 第三方见证 | 在场的人说具体的话 |
| 10 | 前后对照 | 以前 vs 现在，两个状态都具体 |
| 11 | 凭证暗示 | 截图/聊天记录/备忘录/便利贴等 |
| 12 | 收尾呼应 | 结尾回到具体小动作或小物件 |

判据是**弱检测**：只回答「有没有这一类」，不判断写得好不好。人读和朗读测试仍要做。

## 红线（命中即 FAIL）

- 编造具体真实人名（用「老周」「小林」这类代号）
- 编造具体小区名（用「东五环 89 平老破小」这类类型描述）
- 编造可被核实的公司名（用「某互联网中厂」）
- 编造公共事件细节
- 抄袭真实他人经历

## 输出

plan：
```json
{ "ok": true, "prompt": "…", "anchor_ids": ["time", "place", "..."] }
```

verify：
```json
{
  "ok": true,
  "score": 9,
  "min": 8,
  "anchors": [{ "id": "time", "name": "时间戳", "found": true, "evidence": "上周三晚上十一点半" }],
  "missing": ["地理锚点", "…"],
  "abstract": [{ "text": "那天晚上", "hint": "改成具体日期 + 星期 + 时刻" }],
  "red_lines": [],
  "warns": []
}
```

退出码：`0` 通过 / `1` 未通过（锚点不足或有红线）/ `2` 参数错误。

## 分工

- `real-story-pack` 管**真实感**：有没有落到具体人/地/时/物。
- `selfcheck` 管**通用硬门**：第一人称、模板句、句长节奏。
- `ai-flavor` 管**AI 味**：套话、万能句式。
- 三者都过，再进排版与发布。