---
name: ai-flavor
description: 文章 AI 味本地预检。在贴朱雀等 AIGC 检测工具之前先跑一遍，标出最像 AI 的地方（过渡词过密、抽象名词堆叠、万能句式、句长过匀、信息密度低等），给出 0-100 分与逐条证据。支持记录朱雀实测结果并校准规则权重，越用越准。
---

# ai-flavor —— AI 味预检

**给什么**：文章正文（`article.json` 或纯文本）
**还什么**：AI 味得分（0-100）+ 分级 + 逐条命中的规则与证据

> 这是**本地预检**，不调朱雀。最终判定以朱雀实测为准；实测结果可回填，用来校准规则权重。

## 为什么要它

生成完的文章贴到朱雀前，先跑一遍，知道哪几句最像 AI、该往哪改。比「贴上去被判定 AI 生成再重写」省一轮。

与 `selfcheck` 的分工：

| | 管什么 |
|---|---|
| `selfcheck` | 平台**红线**（第一人称、禁飞句式、情绪尾、字数）——硬拦，不过不能发 |
| `ai-flavor` | **像不像人写**（软指标）——给分数和证据，阈值可调 |

## 用法

```bash
# 预检
node atom/ai-flavor/src/index.mjs --article article.json
node atom/ai-flavor/src/index.mjs --text "正文内容"

# 落盘
node atom/ai-flavor/src/index.mjs --article a.json --out-dir 04-ai-flavor
```

输出：

```json
{
  "ok": true, "score": 52, "level": "medium",
  "hits": [
    { "id": "low-info", "label": "具体信息密度低", "strength": 1, "weight": 1.5,
      "hits": ["每千字具体信息 0.0 处（<6 偏空）"] }
  ],
  "stats": { "chars": 106, "sentences": 5 }
}
```

退出码恒为 `0`——这是体检不是硬门，拦不拦由调用方按 `level` 决定。

## 9 条规则

| id | 查什么 |
|---|---|
| `connector` | 首先/其次/此外/然而/综上… 过渡词过密 |
| `abstract` | 底层逻辑/赋能/闭环/抓手/维度… 抽象名词堆叠 |
| `empty-emotion` | 令人震惊/引人深思/发人深省… 空泛情绪 |
| `template-sentence` | 不是X而是Y / 真正的X是Y / 说到底… 万能句式 |
| `uniform-length` | 句长变异系数 <0.5（人写通常起伏明显） |
| `short-lead` | >40% 的段落以 ≤8 字短句开场 |
| `low-info` | 每千字数字/引号原话/英文专名 <6 处 |
| `parallel` | 连续三句同开头（排比三连） |
| `no-scene` | 全文无数字、无引号原话、无英文专名 |

分级（按 683 篇历史稿实测分布定）：`<25 low` / `25-44 medium` / `≥45 high`。

## 不断优化：反馈 + 校准

每贴一次朱雀，把结果记下来：

```bash
# 朱雀判定为 AI（概率 0.87）
node atom/ai-flavor/src/index.mjs --feedback --article a.json --label ai --zhuque 0.87

# 朱雀判定为人工
node atom/ai-flavor/src/index.mjs --feedback --article b.json --label human --zhuque 0.12
```

反馈累积到 `atom/ai-flavor/data/feedback.jsonl`（本地，不入库）。两类各攒 ≥5 条后：

```bash
node atom/ai-flavor/src/index.mjs --calibrate
```

输出每条规则在「AI 样本 vs 人写样本」上的均值差（区分度）和建议权重：

```
规则            AI均值  人写均值  区分度  现权重 → 建议
具体信息密度低   0.72    0.15    0.57    1.5 → 2.5
抽象名词堆叠     0.31    0.28    0.03    1.2 → 1.3
...
当前阈值（≥25 判 AI）与本批实测的一致率：86.7%
```

区分度为负的规则说明它在反向指认（AI 文章里反而少），应下调。按建议值改 `src/lib/rules.mjs` 里的 `weight` 和分级阈值即可。

## 已知边界

1. **不是检测器**，是启发式规则——真实判定以朱雀为准
2. 初始权重是拍的，**没有经过朱雀标签校准**，前几篇的区分度可能一般
3. 阈值 25/45 基于 683 篇历史稿分布，样本偏「已通过平台的稿子」，不代表全体
4. 短文本（<300 字）密度类规则会被放大，读分数时结合 `stats.chars` 看
